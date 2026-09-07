#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const PAM_WEEKLY = 'https://pam.ealing.gov.uk/online-applications/search.do?action=weeklyList&searchType=Application';
const PLANNING_DATA = 'https://www.planning.data.gov.uk/entity.json';
const PLANWIRE = 'https://api.planwire.io/v1/applications?council_id=ealing';
const USER_AGENT = 'EalingCivicCommonsPlanningProbe/0.1 (+https://civiccommons.co.uk/)';

const args = new Set(process.argv.slice(2));
const outputArg = process.argv.find((value) => value.startsWith('--output='));
const outputPath = resolve(outputArg ? outputArg.slice('--output='.length) : 'planning-probe.json');
const verbose = args.has('--verbose');

function decodeEntities(value = '') {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(value = '') {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function attrs(tag = '') {
  const result = {};
  const re = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = re.exec(tag))) {
    result[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return result;
}

function parseForm(html) {
  const forms = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi)].map((m) => m[0]);
  const form = forms.find((f) => /week|weekly/i.test(f)) ?? forms[0];
  if (!form) throw new Error('PAM weekly-list form not found');

  const open = form.match(/<form\b[^>]*>/i)?.[0] ?? '<form>';
  const formAttrs = attrs(open);
  const fields = [];

  for (const match of form.matchAll(/<input\b[^>]*>/gi)) {
    const a = attrs(match[0]);
    if (!a.name || /submit|button|reset/i.test(a.type ?? '')) continue;
    fields.push({ type: (a.type || 'text').toLowerCase(), name: a.name, value: a.value ?? '', checked: 'checked' in a });
  }

  for (const match of form.matchAll(/<select\b[^>]*>[\s\S]*?<\/select>/gi)) {
    const selectOpen = match[0].match(/<select\b[^>]*>/i)?.[0] ?? '';
    const a = attrs(selectOpen);
    if (!a.name) continue;
    const options = [...match[0].matchAll(/<option\b[^>]*>[\s\S]*?<\/option>/gi)].map((option) => {
      const optionOpen = option[0].match(/<option\b[^>]*>/i)?.[0] ?? '';
      const oa = attrs(optionOpen);
      return { value: oa.value ?? stripTags(option[0]), label: stripTags(option[0]), selected: 'selected' in oa };
    });
    fields.push({ type: 'select', name: a.name, options });
  }

  return {
    method: (formAttrs.method || 'get').toUpperCase(),
    action: formAttrs.action || PAM_WEEKLY,
    fields,
  };
}

function choosePamPayload(form) {
  const params = new URLSearchParams();
  const selected = {};

  for (const field of form.fields) {
    if (field.type === 'hidden') {
      params.set(field.name, field.value);
      continue;
    }
    if (field.type === 'radio' || field.type === 'checkbox') {
      if (field.checked || /valid/i.test(field.value) || /valid/i.test(field.name)) {
        params.set(field.name, field.value || 'true');
        selected[field.name] = field.value || 'true';
      }
      continue;
    }
    if (field.type !== 'select') continue;

    const lower = field.name.toLowerCase();
    let option;
    if (/week|date/.test(lower)) {
      option = field.options.find((o) => o.value && !/select|choose/i.test(o.label));
    } else if (/ward|parish/.test(lower)) {
      option = field.options.find((o) => !o.value || /all/i.test(o.label));
    } else {
      option = field.options.find((o) => o.selected) ?? field.options[0];
    }
    if (option) {
      params.set(field.name, option.value);
      selected[field.name] = option.label;
    }
  }

  return { params, selected };
}

function extractPamApplications(html) {
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']*applicationDetails\.do\?[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const seen = new Set();
  const applications = [];
  for (const [, href, body] of links) {
    const url = new URL(decodeEntities(href), PAM_WEEKLY).toString();
    if (seen.has(url)) continue;
    seen.add(url);
    applications.push({ url, link_text: stripTags(body) || null });
  }
  return applications;
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    redirect: 'follow',
    ...options,
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml', ...(options.headers || {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return { response, text };
}

async function probePam() {
  const started = Date.now();
  const first = await fetchText(PAM_WEEKLY);
  const form = parseForm(first.text);
  const { params, selected } = choosePamPayload(form);
  const action = new URL(form.action, first.response.url);
  let second;
  if (form.method === 'POST') {
    second = await fetchText(action, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params,
    });
  } else {
    for (const [key, value] of params) action.searchParams.set(key, value);
    second = await fetchText(action);
  }
  const applications = extractPamApplications(second.text);
  return {
    ok: true,
    authoritative: true,
    source: 'Ealing PAM / Civica Public Access',
    url: second.response.url,
    form_method: form.method,
    selected,
    applications_found: applications.length,
    sample: applications.slice(0, 10),
    elapsed_ms: Date.now() - started,
  };
}

async function probePlanningData() {
  const started = Date.now();
  const url = new URL(PLANNING_DATA);
  url.searchParams.set('dataset', 'planning-application');
  url.searchParams.set('organisation_entity', '115');
  url.searchParams.set('limit', '20');
  url.searchParams.set('entry_date_year', String(new Date().getUTCFullYear()));
  url.searchParams.set('entry_date_match', 'since');
  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const data = await response.json();
  const entities = data.entities ?? data.results ?? [];
  return {
    ok: true,
    authoritative: false,
    licence: 'Open Government Licence v3.0',
    source: 'Planning Data (MHCLG)',
    url: url.toString(),
    count: entities.length,
    sample: entities.slice(0, 5).map((item) => ({
      entity: item.entity,
      reference: item.reference,
      name: item.name,
      entry_date: item['entry-date'],
      start_date: item['start-date'],
      point: item.point,
    })),
    elapsed_ms: Date.now() - started,
  };
}

async function probePlanWire() {
  const apiKey = process.env.PLANWIRE_API_KEY;
  if (!apiKey) return { ok: null, skipped: true, reason: 'PLANWIRE_API_KEY not set' };
  const started = Date.now();
  const url = new URL(PLANWIRE);
  url.searchParams.set('limit', '20');
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'application/json', authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const data = await response.json();
  const rows = data.applications ?? data.results ?? data.data ?? [];
  return {
    ok: true,
    authoritative: false,
    source: 'PlanWire',
    url: url.toString(),
    count: rows.length,
    sample: rows.slice(0, 5),
    elapsed_ms: Date.now() - started,
  };
}

async function safe(name, fn) {
  try {
    return await fn();
  } catch (error) {
    return { ok: false, source: name, error: error instanceof Error ? error.message : String(error) };
  }
}

const generatedAt = new Date().toISOString();
const results = {
  generated_at: generatedAt,
  purpose: 'Diagnostic comparison only. No planning records are persisted or republished by this probe.',
  pam: await safe('Ealing PAM', probePam),
  planning_data: await safe('Planning Data', probePlanningData),
  planwire: await safe('PlanWire', probePlanWire),
};

await writeFile(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');

console.log(`Planning probe written to ${outputPath}`);
for (const [key, value] of Object.entries(results)) {
  if (key === 'generated_at' || key === 'purpose') continue;
  const state = value.ok === true ? 'OK' : value.skipped ? 'SKIP' : 'FAIL';
  const count = value.applications_found ?? value.count;
  console.log(`${state.padEnd(4)} ${key.padEnd(15)}${count == null ? '' : ` ${count} records`}${value.error ? ` — ${value.error}` : ''}${value.reason ? ` — ${value.reason}` : ''}`);
  if (verbose && value.selected) console.log('     selection:', value.selected);
}

if (results.pam.ok === false) process.exitCode = 2;
