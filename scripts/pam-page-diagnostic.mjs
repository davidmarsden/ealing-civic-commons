#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const PAM_WEEKLY = 'https://pam.ealing.gov.uk/online-applications/search.do?action=weeklyList&searchType=Application';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const outputArg = process.argv.find((value) => value.startsWith('--output='));
const outputPath = resolve(outputArg ? outputArg.slice('--output='.length) : 'pam-page-diagnostic.json');

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
  return decodeEntities(value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
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

function parseWeeklyForm(html) {
  const forms = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi)].map((m) => m[0]);
  const form = forms.find((f) => /week|weekly/i.test(f)) ?? forms[0];
  if (!form) throw new Error('No form found on PAM weekly-list page');

  const open = form.match(/<form\b[^>]*>/i)?.[0] ?? '<form>';
  const a = attrs(open);
  const params = new URLSearchParams();
  const selected = {};

  for (const match of form.matchAll(/<input\b[^>]*>/gi)) {
    const input = attrs(match[0]);
    if (!input.name || /submit|button|reset/i.test(input.type ?? '')) continue;
    if ((input.type || 'text').toLowerCase() === 'hidden') params.set(input.name, input.value ?? '');
    if (/radio|checkbox/i.test(input.type ?? '') && ('checked' in input || /valid/i.test(input.value ?? '') || /valid/i.test(input.name))) {
      params.set(input.name, input.value || 'true');
      selected[input.name] = input.value || 'true';
    }
  }

  for (const match of form.matchAll(/<select\b[^>]*>[\s\S]*?<\/select>/gi)) {
    const select = attrs(match[0].match(/<select\b[^>]*>/i)?.[0] ?? '');
    if (!select.name) continue;
    const options = [...match[0].matchAll(/<option\b[^>]*>[\s\S]*?<\/option>/gi)].map((option) => {
      const oa = attrs(option[0].match(/<option\b[^>]*>/i)?.[0] ?? '');
      return { value: oa.value ?? stripTags(option[0]), label: stripTags(option[0]), selected: 'selected' in oa };
    });
    const lower = select.name.toLowerCase();
    let chosen;
    if (/week|date/.test(lower)) chosen = options.find((o) => o.value && !/select|choose/i.test(o.label));
    else if (/ward|parish/.test(lower)) chosen = options.find((o) => !o.value || /all/i.test(o.label));
    else chosen = options.find((o) => o.selected) ?? options[0];
    if (chosen) {
      params.set(select.name, chosen.value);
      selected[select.name] = chosen.label;
    }
  }

  return { method: (a.method || 'get').toUpperCase(), action: a.action || PAM_WEEKLY, params, selected };
}

function summarizePage(response, html) {
  const title = stripTags(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '') || null;
  const headings = [...html.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean)
    .slice(0, 8);
  const forms = [...html.matchAll(/<form\b[^>]*>/gi)].map((m) => {
    const a = attrs(m[0]);
    return { method: (a.method || 'get').toUpperCase(), action: a.action || null, id: a.id || null, name: a.name || null };
  }).slice(0, 8);
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({ href: decodeEntities(m[1]), text: stripTags(m[2]) }))
    .filter((item) => item.text)
    .slice(0, 12);
  const text = stripTags(html).slice(0, 1200);

  return {
    status: response.status,
    status_text: response.statusText,
    url: response.url,
    title,
    headings,
    forms,
    links,
    text_excerpt: text,
    server: response.headers.get('server'),
    via: response.headers.get('via'),
    content_type: response.headers.get('content-type'),
    location: response.headers.get('location'),
    request_id: response.headers.get('x-request-id') ?? response.headers.get('x-correlation-id'),
  };
}

const result = {
  generated_at: new Date().toISOString(),
  purpose: 'Safe PAM page-identification diagnostic. Full HTML is not stored.',
};

try {
  const first = await fetchText(PAM_WEEKLY);
  const cookie = cookiesFrom(first.response);
  result.session_cookie_received = Boolean(cookie);
  result.initial_page = summarizePage(first.response, first.text);

  let form;
  try {
    form = parseWeeklyForm(first.text);
  } catch (error) {
    result.error_stage = 'initial-form-parse';
    result.error = error instanceof Error ? error.message : String(error);
    throw error;
  }

  const action = new URL(form.action, first.response.url);
  result.submitted = {
    method: form.method,
    action: action.toString(),
    selected: form.selected,
  };

  const headers = { referer: first.response.url, ...(cookie ? { cookie } : {}) };
  let second;
  if (form.method === 'POST') {
    second = await fetchText(action, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/x-www-form-urlencoded' },
      body: form.params,
    });
  } else {
    for (const [key, value] of form.params) action.searchParams.set(key, value);
    second = await fetchText(action, { headers });
  }

  result.returned_page = summarizePage(second.response, second.text);
} catch (error) {
  if (!result.error) result.error = error instanceof Error ? error.message : String(error);
  if (!result.error_stage) result.error_stage = 'request-or-submission';
  process.exitCode = 2;
} finally {
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`PAM page diagnostic written to ${outputPath}`);
  console.log(JSON.stringify(result, null, 2));
}
