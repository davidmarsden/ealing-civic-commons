#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const PAM_WEEKLY = 'https://pam.ealing.gov.uk/online-applications/search.do?action=weeklyList&searchType=Application';
const PLANNING_DATA = 'https://www.planning.data.gov.uk/entity.json';
const PLANWIRE = 'https://api.planwire.io/v1/applications?council_id=ealing';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const EALING_TZ = 'Europe/London';

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
  while ((match = re.exec(tag))) result[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  return result;
}

function cookiesFrom(response) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  return values.map((value) => value.split(';', 1)[0]).filter(Boolean).join('; ');
}

function responseDiagnostics(response) {
  return {
    status: response.status,
    status_text: response.statusText,
    url: response.url,
    server: response.headers.get('server'),
    via: response.headers.get('via'),
    request_id: response.headers.get('x-request-id') ?? response.headers.get('x-correlation-id'),
  };
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    redirect: 'follow',
    ...options,
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-GB,en;q=0.9',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`${response.status} ${response.statusText}`);
    error.diagnostics = responseDiagnostics(response);
    throw error;
  }
  return { response, text };
}

function parseWeeklyForm(html, baseUrl) {
  const forms = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi)].map((match) => match[0]);
  const form = forms.find((candidate) => /weeklyListForm|week|weekly/i.test(candidate)) ?? forms[0];
  if (!form) throw new Error('PAM weekly-list form not found');

  const formAttrs = attrs(form.match(/<form\b[^>]*>/i)?.[0] ?? '<form>');
  const params = new URLSearchParams();
  const selects = new Map();

  for (const match of form.matchAll(/<input\b[^>]*>/gi)) {
    const input = attrs(match[0]);
    if (!input.name) continue;
    const type = (input.type || 'text').toLowerCase();
    if (/submit|button|reset|file/i.test(type)) continue;
    if ((type === 'checkbox' || type === 'radio') && !('checked' in input)) continue;
    params.append(input.name, input.value ?? '');
  }

  for (const match of form.matchAll(/<select\b[^>]*>[\s\S]*?<\/select>/gi)) {
    const selectAttrs = attrs(match[0].match(/<select\b[^>]*>/i)?.[0] ?? '');
    if (!selectAttrs.name) continue;
    const options = [...match[0].matchAll(/<option\b[^>]*>[\s\S]*?<\/option>/gi)].map((option) => {
      const optionAttrs = attrs(option[0].match(/<option\b[^>]*>/i)?.[0] ?? '');
      return {
        value: optionAttrs.value ?? stripTags(option[0]),
        label: stripTags(option[0]),
        selected: 'selected' in optionAttrs,
      };
    });
    selects.set(selectAttrs.name, options);
    const selected = options.find((option) => option.selected) ?? options[0];
    if (selected) params.append(selectAttrs.name, selected.value);
  }

  return {
    method: (formAttrs.method || 'get').toUpperCase(),
    action: new URL(formAttrs.action || baseUrl, baseUrl),
    params,
    selects,
  };
}

function parsePamWeek(label) {
  const match = String(label).trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return null;
  const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const month = months[match[2]];
  if (month == null) return null;
  return new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
}

function currentMondayEaling(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: EALING_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const weekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[values.weekday];
  if (!weekday) throw new Error(`Could not determine Ealing weekday for ${now.toISOString()}`);
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) - (weekday - 1)));
}

function setSelect(form, name, predicate) {
  const options = form.selects.get(name) ?? [];
  const chosen = options.find(predicate);
  if (!chosen) throw new Error(`PAM form option not found for ${name}`);
  form.params.set(name, chosen.value);
  return { label: chosen.label, value: chosen.value };
}

function chooseLatestCompletedWeek(form) {
  const monday = currentMondayEaling();
  const options = (form.selects.get('week') ?? [])
    .map((option) => ({ ...option, date: parsePamWeek(option.label) }))
    .filter((option) => option.date && option.date < monday)
    .sort((a, b) => b.date - a.date);
  if (!options.length) throw new Error('PAM has no completed weekly-list option');
  const chosen = options[0];
  form.params.set('week', chosen.value);
  return { label: chosen.label, value: chosen.value };
}

function extractPamApplications(html, baseUrl) {
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']*applicationDetails\.do\?[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const seen = new Set();
  const applications = [];
  for (const [, href, body] of links) {
    const url = new URL(decodeEntities(href), baseUrl).toString();
    if (seen.has(url)) continue;
    seen.add(url);
    applications.push({ url, link_text: stripTags(body) || null });
  }
  return applications;
}

function classifyPamResultsPage(html, applications) {
  if (applications.length > 0) return 'applications';
  const text = stripTags(html);
  if (/no results found|no matching applications|no applications (?:were )?found|your search (?:has )?returned no results|your search did not return any results/i.test(text)) return 'no-results';
  throw new Error('PAM returned HTTP 200 but the results page was not recognized');
}

async function probePam() {
  const started = Date.now();
  const first = await fetchText(PAM_WEEKLY);
  const cookie = cookiesFrom(first.response);
  const form = parseWeeklyForm(first.text, first.response.url);

  form.params.set('dateType', 'DC_Validated');
  const parish = setSelect(form, 'searchCriteria.parish', (option) => /^all$/i.test(option.label));
  const ward = setSelect(form, 'searchCriteria.ward', (option) => /^all$/i.test(option.label));
  const week = chooseLatestCompletedWeek(form);

  const requestHeaders = {
    referer: first.response.url,
    ...(cookie ? { cookie } : {}),
  };

  let second;
  if (form.method === 'POST') {
    second = await fetchText(form.action, {
      method: 'POST',
      headers: { ...requestHeaders, 'content-type': 'application/x-www-form-urlencoded' },
      body: form.params,
    });
  } else {
    const action = new URL(form.action);
    for (const [key, value] of form.params) action.searchParams.append(key, value);
    second = await fetchText(action, { headers: requestHeaders });
  }

  const applications = extractPamApplications(second.text, second.response.url);
  return {
    ok: true,
    authoritative: true,
    source: 'Ealing PAM / Civica Public Access',
    url: second.response.url,
    form_method: form.method,
    session_cookie_received: Boolean(cookie),
    selected: {
      dateType: 'DC_Validated',
      parish,
      ward,
      week,
      field_names: [...new Set([...form.params.keys()])],
    },
    result_page: classifyPamResultsPage(second.text, applications),
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
    return {
      ok: false,
      source: name,
      error: error instanceof Error ? error.message : String(error),
      ...(error?.diagnostics ? { diagnostics: error.diagnostics } : {}),
    };
  }
}

const results = {
  generated_at: new Date().toISOString(),
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
  if (verbose && value.diagnostics) console.log('     diagnostics:', value.diagnostics);
}

if (results.pam.ok === false) process.exitCode = 2;
