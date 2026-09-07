#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const START = 'https://pam.ealing.gov.uk/online-applications/search.do?action=weeklyList&searchType=Application';
const RESULTS = 'https://pam.ealing.gov.uk/online-applications/weeklyListResults.do?action=firstPage';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const outputArg = process.argv.find((value) => value.startsWith('--output='));
const outputPath = resolve(outputArg ? outputArg.slice('--output='.length) : 'pam-previous-week-probe.json');

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

function parseAllValue(html, selectName) {
  const selectMatch = [...html.matchAll(/<select\b[^>]*>[\s\S]*?<\/select>/gi)]
    .find((match) => attrs(match[0].match(/<select\b[^>]*>/i)?.[0] ?? '').name === selectName);
  if (!selectMatch) return '';
  for (const option of selectMatch[0].matchAll(/<option\b[^>]*>[\s\S]*?<\/option>/gi)) {
    const open = option[0].match(/<option\b[^>]*>/i)?.[0] ?? '';
    const a = attrs(open);
    const label = stripTags(option[0]);
    if (/^all$/i.test(label)) return a.value ?? '';
  }
  return '';
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
  result.session_cookie_received = Boolean(cookiesFrom(first.response));

  const cookie = cookiesFrom(first.response);
  const params = new URLSearchParams({
    dateType: 'DC_Validated',
    'searchCriteria.parish': parseAllValue(first.text, 'searchCriteria.parish'),
    'searchCriteria.ward': parseAllValue(first.text, 'searchCriteria.ward'),
    week: '31 Aug 2026',
  });
  result.submitted = Object.fromEntries(params);

  result.error_stage = 'results_request';
  const second = await fetchText(RESULTS, {
    method: 'POST',
    headers: {
      referer: first.response.url,
      ...(cookie ? { cookie } : {}),
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  const links = [...second.text.matchAll(/<a\b[^>]*href=["']([^"']*applicationDetails\.do\?[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const seen = new Set();
  const applications = [];
  for (const [, href, body] of links) {
    const url = new URL(decodeEntities(href), RESULTS).toString();
    if (seen.has(url)) continue;
    seen.add(url);
    applications.push({ url, link_text: stripTags(body) || null });
  }

  const visible = stripTags(second.text);
  Object.assign(result, {
    status: second.response.status,
    final_url: second.response.url,
    explicit_no_results: /no results found/i.test(visible),
    applications_found: applications.length,
    sample: applications.slice(0, 20),
    text_excerpt: visible.slice(0, 600),
  });
  result.error_stage = null;

  if (!second.response.ok || (result.applications_found === 0 && !result.explicit_no_results)) exitCode = 2;
} catch (error) {
  result.error = error instanceof Error ? error.message : String(error);
  exitCode = 2;
} finally {
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

console.log(`PAM previous-week probe written to ${outputPath}`);
console.log(JSON.stringify(result, null, 2));
process.exitCode = exitCode;
