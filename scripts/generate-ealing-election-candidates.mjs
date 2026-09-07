import { writeFile } from 'node:fs/promises';

const OUTPUT = new URL('../netlify/lib/ealing-election-candidates.mjs', import.meta.url);
const MAIN_BASE = 'https://www.ealing.gov.uk/info/201276/council_elections/3595/council_elections_results_7_may_2026';
const BY_ELECTION_URL = 'https://www.ealing.gov.uk/info/201279/by-elections/3611/north_acton_ward_by-election_result_25_june_2026';
const FETCH_ATTEMPTS = 3;
const RETRY_DELAY_MS = 750;

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function cleanText(value) {
  return decodeHtml(String(value || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function candidateName(cellHtml) {
  const withBreaks = String(cellHtml || '').replace(/<br\s*\/?>/gi, '|');
  const pieces = withBreaks
    .split('|')
    .map(cleanText)
    .filter(Boolean);
  if (pieces.length >= 2) return `${pieces.slice(1).join(' ')} ${pieces[0]}`.replace(/\s+/g, ' ').trim();
  return cleanText(cellHtml);
}

function slugify(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function wardFromHtml(html) {
  const headings = [...String(html).matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map(match => cleanText(match[1]));
  const heading = headings.find(value => /\bward$/i.test(value));
  if (!heading) return null;
  return heading.replace(/\s+ward$/i, '').trim();
}

function parseResultTable(html, { sourceUrl, electionDate, wardOverride = null, electionLabel }) {
  const ward = wardOverride || wardFromHtml(html);
  if (!ward) throw new Error(`Could not identify ward from ${sourceUrl}`);
  const records = [];
  for (const rowMatch of String(html).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = rowMatch[1];
    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(match => match[1]);
    if (cells.length < 3) continue;
    const name = candidateName(cells[0]);
    const party = cleanText(cells[1]);
    const voteText = cleanText(cells[2]);
    const voteMatch = voteText.replaceAll(',', '').match(/\b(\d+)\b/);
    if (!name || !party || !voteMatch) continue;
    const elected = /\belected\b/i.test(rowHtml);
    const votes = Number(voteMatch[1]);
    records.push({
      id: `ealing-election:${electionDate}:${slugify(ward)}:${slugify(name)}`,
      name,
      ward,
      party,
      votes,
      elected,
      electionDate,
      electionLabel,
      sourceUrl
    });
  }
  if (!records.length) throw new Error(`No candidate rows parsed for ${ward} from ${sourceUrl}`);
  return records;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url) {
  let lastError;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { accept: 'text/html,*/*;q=0.8', 'user-agent': 'Ealing-Civic-Commons/1.0 election-record-refresh' } });
      if (response.ok) return response.text();
      lastError = new Error(`Ealing election page HTTP ${response.status}: ${url}`);
      if (response.status < 500 || attempt === FETCH_ATTEMPTS) throw lastError;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === FETCH_ATTEMPTS) throw lastError;
    }
    console.warn(`Election source fetch failed (attempt ${attempt}/${FETCH_ATTEMPTS}) for ${url}; retrying.`);
    await sleep(RETRY_DELAY_MS * attempt);
  }
  throw lastError ?? new Error(`Unable to fetch ${url}`);
}

async function generate() {
  const candidacies = [];
  const wardSet = new Set();
  for (let page = 2; page <= 25; page += 1) {
    const sourceUrl = `${MAIN_BASE}/${page}`;
    const html = await fetchPage(sourceUrl);
    const rows = parseResultTable(html, { sourceUrl, electionDate: '2026-05-07', electionLabel: 'Ealing Council election, 7 May 2026' });
    rows.forEach(record => { candidacies.push(record); wardSet.add(record.ward); });
  }

  const byElectionHtml = await fetchPage(BY_ELECTION_URL);
  candidacies.push(...parseResultTable(byElectionHtml, {
    sourceUrl: BY_ELECTION_URL,
    electionDate: '2026-06-25',
    electionLabel: 'North Acton ward by-election, 25 June 2026',
    wardOverride: 'North Acton'
  }));

  if (wardSet.size !== 24) throw new Error(`Expected 24 wards in 7 May 2026 election results; parsed ${wardSet.size}`);
  if (candidacies.length < 200) throw new Error(`Election candidate import unexpectedly returned only ${candidacies.length} candidacies`);

  candidacies.sort((a, b) => a.name.localeCompare(b.name) || a.electionDate.localeCompare(b.electionDate) || a.ward.localeCompare(b.ward));
  const meta = {
    source: 'Ealing Council official election results',
    electionYear: 2026,
    mainElectionDate: '2026-05-07',
    byElectionDate: '2026-06-25',
    wardCount: wardSet.size,
    candidacyCount: candidacies.length,
    generatedAt: new Date().toISOString(),
    generated: true
  };
  const moduleText = `// Generated from official Ealing Council 2026 election-result pages. No home addresses or nomination-form personal data are imported.\nexport const EALING_2026_CANDIDACIES = ${JSON.stringify(candidacies, null, 2)};\nexport const EALING_2026_CANDIDACIES_META = ${JSON.stringify(meta, null, 2)};\n`;
  await writeFile(OUTPUT, moduleText, 'utf8');
  console.log(`Generated ${candidacies.length} Ealing 2026 candidacy records across ${wardSet.size} wards plus the North Acton by-election.`);
}

try {
  await generate();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`Election candidate refresh skipped: ${message}`);
  console.warn('Keeping the committed election-candidate module unchanged so a temporary Ealing Council outage does not fail the site build.');
}
