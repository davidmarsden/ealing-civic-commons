#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PAM_WEEKLY = 'https://pam.ealing.gov.uk/online-applications/search.do?action=weeklyList&searchType=Application';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const EALING_TZ = 'Europe/London';
const MAX_RESULT_PAGES = 50;
const DETAIL_DELAY_MS = 200;


function decodeEntities(value = '') {
  return String(value)
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(value = '') {
  return decodeEntities(
    String(value)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
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

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
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
  if (!response.ok) {
    const error = new Error(`${response.status} ${response.statusText}: ${response.url}`);
    error.status = response.status;
    error.url = response.url;
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
  return month == null ? null : new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
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
  return chosen;
}

// Completed weekly-list options, newest first.
export function completedWeeks(options, now = new Date()) {
  const monday = currentMondayEaling(now);
  return options
    .map((option) => ({ ...option, date: parsePamWeek(option.label) }))
    .filter((option) => option.date && option.date < monday)
    .sort((a, b) => b.date - a.date);
}

// The latest completed week, or the one labelled `wanted` (for backfilling).
function chooseWeek(form, wanted = null) {
  const options = completedWeeks(form.selects.get('week') ?? []);
  if (!options.length) throw new Error('PAM has no completed weekly-list option');
  const chosen = wanted ? options.find((option) => option.label === wanted || option.value === wanted) : options[0];
  if (!chosen) throw new Error(`PAM has no completed weekly-list option "${wanted}"`);
  form.params.set('week', chosen.value);
  return chosen;
}

function applicationLinks(html, baseUrl) {
  const found = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']*applicationDetails\.do\?[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    found.push({
      url: new URL(decodeEntities(match[1]), baseUrl).toString(),
      list_description: stripTags(match[2]) || null,
    });
  }
  return found;
}

// Idox pages its results through pagedSearchResults.do?action=page&searchCriteria.page=N
// (older installations use weeklyListResults.do?action=nextPage). Take the link
// marked "next", else the link to the page after the current one.
export function nextPageLink(html, baseUrl, currentPage = 1) {
  let following = null;
  for (const match of html.matchAll(/(<a\b[^>]*>)([\s\S]*?)<\/a>/gi)) {
    const link = attrs(match[1]);
    if (!/(?:weeklyListResults|pagedSearchResults)\.do\?/i.test(link.href || '')) continue;
    const url = new URL(link.href, baseUrl);
    if (!/^(?:nextPage|page)$/i.test(url.searchParams.get('action') || '')) continue;
    if (/action=nextPage/i.test(url.search) || /\bnext\b/i.test(link.class || '') || /^next\b/i.test(stripTags(match[2]))) return url.toString();
    if (Number(url.searchParams.get('searchCriteria.page')) === currentPage + 1) following ??= url.toString();
  }
  return following;
}

function normalizeLabel(value) {
  return stripTags(value).replace(/\s*:\s*$/, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function extractLabelValues(html) {
  const pairs = new Map();
  const add = (label, value) => {
    const key = normalizeLabel(label);
    const clean = stripTags(value);
    if (key && clean && !pairs.has(key)) pairs.set(key, clean);
  };

  // Civica Public Access renders application summary metadata as list items
  // containing sibling spans such as <span class="title">…</span> and
  // <span class="value">…</span>.
  for (const item of html.matchAll(/<(?:li|div)\b[^>]*>([\s\S]*?)<\/(?:li|div)>/gi)) {
    const body = item[1];
    const title = body.match(/<span\b[^>]*class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
    const value = body.match(/<span\b[^>]*class=["'][^"']*\bvalue\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
    if (title && value) add(title[1], value[1]);
  }

  // Fallbacks for alternative/older markup.
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = match[1];
    const th = row.match(/<th\b[^>]*>([\s\S]*?)<\/th>/i);
    const td = row.match(/<td\b[^>]*>([\s\S]*?)<\/td>/i);
    if (th && td) add(th[1], td[1]);
  }
  for (const match of html.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi)) {
    add(match[1], match[2]);
  }

  return pairs;
}

function field(pairs, patterns) {
  for (const [label, value] of pairs) {
    if (patterns.some((pattern) => pattern.test(label))) return value;
  }
  return null;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// The "Further Information" tab: application type, ward and decision level.
export function detailsTabUrl(summaryUrl) {
  const url = new URL(summaryUrl);
  url.searchParams.set('activeTab', 'details');
  return url.toString();
}

export function normalizeApplication(html, authoritativeUrl, listDescription, weekLabel) {
  const pairs = extractLabelValues(html);
  const reference = field(pairs, [/^reference$/, /application reference/, /^ref\.?(?: no)?$/]);
  const address = field(pairs, [/^address$/, /site address/, /location/]);
  const parsedProposal = field(pairs, [/^proposal$/, /description of proposal/, /^description$/]);
  const proposal = parsedProposal ?? listDescription;
  const keyVal = new URL(authoritativeUrl).searchParams.get('keyVal');
  const warnings = [];
  if (!reference) warnings.push('reference_missing');
  if (!address) warnings.push('address_missing');
  if (!parsedProposal) warnings.push('proposal_not_parsed_from_detail');
  if (!proposal) warnings.push('proposal_missing');

  const record = {
    id: `planning:ealing:${slugify(reference || keyVal || authoritativeUrl)}`,
    type: 'planning-application',
    authority: 'London Borough of Ealing',
    reference,
    address,
    proposal,
    application_type: field(pairs, [/application type/, /^type$/]),
    status: field(pairs, [/^status$/, /application status/]),
    decision: field(pairs, [/^decision$/, /decision type/]),
    validated_date: field(pairs, [/validated/, /validation date/]),
    decision_date: field(pairs, [/decision.*date/, /decision issued/]),
    ward: field(pairs, [/^ward$/, /electoral ward/]),
    expected_decision_level: field(pairs, [/expected decision level/]),
    parish: field(pairs, [/^parish$/]),
    applicant_name: field(pairs, [/applicant name/, /^applicant$/]),
    agent_name: field(pairs, [/agent name/, /^agent$/]),
    case_officer: field(pairs, [/case officer/, /^officer$/]),
    weekly_list: weekLabel,
    authoritative_url: authoritativeUrl,
    source: 'Ealing PAM / Civica Public Access',
    parse_warnings: warnings,
  };

  // A list-description fallback alone is not sufficient evidence that the
  // application detail page was recognized. At least one core field must be
  // parsed from the detail metadata itself.
  record.core_fields_parsed = Boolean(reference || address || parsedProposal);
  return record;
}

async function collectWeeklyLinks(firstResults, cookie) {
  const applications = new Map();
  let current = firstResults;
  let pagesScanned = 0;

  while (pagesScanned < MAX_RESULT_PAGES) {
    pagesScanned += 1;
    const before = applications.size;
    for (const app of applicationLinks(current.text, current.response.url)) {
      if (!applications.has(app.url)) applications.set(app.url, app);
    }

    const next = nextPageLink(current.text, current.response.url, pagesScanned);
    if (!next) return { applications: [...applications.values()], pages_scanned: pagesScanned };
    if (applications.size === before && pagesScanned > 1) {
      throw new Error('PAM weekly pagination did not advance to new applications');
    }

    current = await fetchText(next, {
      headers: { referer: current.response.url, ...(cookie ? { cookie } : {}) },
    });
  }

  throw new Error(`PAM weekly results exceeded safety limit of ${MAX_RESULT_PAGES} pages`);
}

async function listWeeks() {
  const first = await fetchText(PAM_WEEKLY);
  const form = parseWeeklyForm(first.text, first.response.url);
  for (const option of completedWeeks(form.selects.get('week') ?? [])) console.log(option.label);
}

async function main(outputPath, wantedWeek = null) {
  const result = {
    generated_at: new Date().toISOString(),
    purpose: 'Inspection-only normalized planning ingestion. No records are published or persisted to Civic Commons storage.',
    source: 'Ealing PAM / Civica Public Access',
    ok: false,
    week: null,
    pages_scanned: 0,
    applications_discovered: 0,
    applications_normalized: 0,
    records_rejected: 0,
    records: [],
    errors: [],
  };

  try {
    const first = await fetchText(PAM_WEEKLY);
    const cookie = cookiesFrom(first.response);
    const form = parseWeeklyForm(first.text, first.response.url);
    form.params.set('dateType', 'DC_Validated');
    setSelect(form, 'searchCriteria.parish', (option) => /^all$/i.test(option.label));
    setSelect(form, 'searchCriteria.ward', (option) => /^all$/i.test(option.label));
    const week = chooseWeek(form, wantedWeek);
    result.week = week.label;

    const headers = { referer: first.response.url, ...(cookie ? { cookie } : {}) };
    let firstResults;
    if (form.method === 'POST') {
      firstResults = await fetchText(form.action, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/x-www-form-urlencoded' },
        body: form.params,
      });
    } else {
      const action = new URL(form.action);
      for (const [key, value] of form.params) action.searchParams.append(key, value);
      firstResults = await fetchText(action, { headers });
    }

    const weekly = await collectWeeklyLinks(firstResults, cookie);
    result.pages_scanned = weekly.pages_scanned;
    result.applications_discovered = weekly.applications.length;

    for (const [index, application] of weekly.applications.entries()) {
      if (index > 0) await sleep(DETAIL_DELAY_MS);
      try {
        const detail = await fetchText(application.url, {
          headers: { referer: firstResults.response.url, ...(cookie ? { cookie } : {}) },
        });
        // The details tab is extra; a record is still complete without it.
        await sleep(DETAIL_DELAY_MS);
        const extra = await fetchText(detailsTabUrl(detail.response.url), {
          headers: { referer: detail.response.url, ...(cookie ? { cookie } : {}) },
        }).then((response) => response.text, () => null);
        const record = normalizeApplication(
          `${detail.text}\n${extra ?? ''}`,
          detail.response.url,
          application.list_description,
          week.label,
        );
        if (extra == null) record.parse_warnings.push('details_tab_unavailable');
        if (!record.core_fields_parsed) {
          result.records_rejected += 1;
          result.errors.push({
            url: application.url,
            error: 'Detail page returned HTTP 200 but no core planning fields were recognized',
          });
          continue;
        }
        result.records.push(record);
      } catch (error) {
        result.errors.push({
          url: application.url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    result.applications_normalized = result.records.length;
    result.ok = result.applications_discovered > 0 && result.applications_normalized > 0;
    if (!result.ok) {
      throw new Error('No planning applications with recognized core fields were normalized from the completed weekly list');
    }
  } catch (error) {
    result.fatal_error = error instanceof Error ? error.message : String(error);
    process.exitCode = 2;
  } finally {
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }

  console.log(`Ealing planning ingestion written to ${outputPath}`);
  console.log(
    `Week: ${result.week ?? 'unknown'}; pages: ${result.pages_scanned}; discovered: ${result.applications_discovered}; normalized: ${result.applications_normalized}; rejected: ${result.records_rejected}; errors: ${result.errors.length}`,
  );
  if (result.fatal_error) console.error(result.fatal_error);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
  // --list-weeks prints the completed weeks PAM offers; --week="02 Nov 2026" ingests that week.
  if (process.argv.includes('--list-weeks')) await listWeeks();
  else await main(resolve(arg('output') ?? 'ealing-planning-ingest.json'), arg('week'));
}
