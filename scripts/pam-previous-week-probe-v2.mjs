#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const START = 'https://pam.ealing.gov.uk/online-applications/search.do?action=weeklyList&searchType=Application';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const outputArg = process.argv.find((value) => value.startsWith('--output='));
const outputPath = resolve(outputArg ? outputArg.slice('--output='.length) : 'pam-previous-week-probe-v2.json');

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

function cookiesFrom(response) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  return values.map((value) => value.split(';', 1)[0]).filter(Boolean).join('; ');
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
  return { response, text };
}

function parseWeeklyForm(html, baseUrl) {
  const forms = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi)].map((m) => m[0]);
  const form = forms.find((f) => /weeklyListForm|week|weekly/i.test(f)) ?? forms[0];
  if (!form) throw new Error('PAM weekly-list form not found');

  const open = form.match(/<form\b[^>]*>/i)?.[0] ?? '<form>';
  const formAttrs = attrs(open);
  const params = new URLSearchParams();
  const selects = new Map();

  for (const match of form.matchAll(/<input\b[^>]*>/gi)) {
    const a = attrs(match[0]);
    if (!a.name) continue;
    const type = (a.type || 'text').toLowerCase();
    if (/submit|button|reset|file/i.test(type)) continue;
    if ((type === 'checkbox' || type === 'radio') && !('checked' in a)) continue;
    params.append(a.name, a.value ?? '');
  }

  for (const match of form.matchAll(/<select\b[^>]*>[\s\S]*?<\/select>/gi)) {
    const selectOpen = match[0].match(/<select\b[^>]*>/i)?.[0] ?? '';
    const a = attrs(selectOpen);
    if (!a.name) continue;
    const options = [...match[0].matchAll(/<option\b[^>]*>[\s\S]*?<\/option>/gi)].map((option) => {
      const optionOpen = option[0].match(/<option\b[^>]*>/i)?.[0] ?? '';
      const oa = attrs(optionOpen);
      return {
        value: oa.value ?? stripTags(option[0]),
        label: stripTags(option[0]),
        selected: 'selected' in oa,
      };
    });
    selects.set(a.name, options);
    const chosen = options.find((o) => o.selected) ?? options[0];
    if (chosen) params.append(a.name, chosen.value);
  }

  return {
    method: (formAttrs.method || 'get').toUpperCase(),
    action: new URL(formAttrs.action || baseUrl, baseUrl),
    params,
    selects,
  };
}

function setSelectByLabel(form, name, labelPattern) {
  const options = form.selects.get(name) ?? [];
  const chosen = options.find((option) => labelPattern.test(option.label));
  if (!chosen) throw new Error(`PAM form option not found for ${name}`);
  form.params.set(name, chosen.value);
  return { label: chosen.label, value: chosen.value };
}

const result = {
  generated_at: new Date().toISOString(),
  week: '31 Aug 2026',
  date_type: 'DC_Validated',
  error_stage: null,
};

let exitCode = 0;

try {
  result.error_stage = 'initial_request';
  const first = await fetchText(START);
  result.initial_status = first.response.status;
  result.initial_url = first.response.url;
  const cookie = cookiesFrom(first.response);
  result.session_cookie_received = Boolean(cookie);

  result.error_stage = 'parse_form';
  const form = parseWeeklyForm(first.text, first.response.url);
  form.params.set('dateType', 'DC_Validated');
  const parish = setSelectByLabel(form, 'searchCriteria.parish', /^all$/i);
  const ward = setSelectByLabel(form, 'searchCriteria.ward', /^all$/i);
  const week = setSelectByLabel(form, 'week', /^31\s+Aug\s+2026$/i);

  result.submitted = {
    method: form.method,
    action: form.action.toString(),
    parish,
    ward,
    week,
    field_names: [...new Set([...form.params.keys()])],
  };

  result.error_stage = 'results_request';
  const requestOptions = {
    headers: {
      referer: first.response.url,
      ...(cookie ? { cookie } : {}),
    },
  };
  let second;
  if (form.method === 'POST') {
    second = await fetchText(form.action, {
      ...requestOptions,
      method: 'POST',
      headers: { ...requestOptions.headers, 'content-type': 'application/x-www-form-urlencoded' },
      body: form.params,
    });
  } else {
    const action = new URL(form.action);
    for (const [key, value] of form.params) action.searchParams.append(key, value);
    second = await fetchText(action, requestOptions);
  }

  const links = [...second.text.matchAll(/<a\b[^>]*href=["']([^"']*applicationDetails\.do\?[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const seen = new Set();
  const applications = [];
  for (const [, href, body] of links) {
    const url = new URL(decodeEntities(href), second.response.url).toString();
    if (seen.has(url)) continue;
    seen.add(url);
    applications.push({ url, link_text: stripTags(body) || null });
  }

  const visible = stripTags(second.text);
  Object.assign(result, {
    status: second.response.status,
    final_url: second.response.url,
    explicit_no_results: /no results found/i.test(visible),
    permission_denied: /permission denied/i.test(visible),
    applications_found: applications.length,
    sample: applications.slice(0, 20),
    text_excerpt: visible.slice(0, 600),
  });
  result.error_stage = null;

  if (!second.response.ok || result.permission_denied || (result.applications_found === 0 && !result.explicit_no_results)) exitCode = 2;
} catch (error) {
  result.error = error instanceof Error ? error.message : String(error);
  exitCode = 2;
} finally {
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

console.log(`PAM previous-week v2 probe written to ${outputPath}`);
console.log(JSON.stringify(result, null, 2));
process.exitCode = exitCode;
