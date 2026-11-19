#!/usr/bin/env node
// Planning ingest parsing against trimmed copies of Ealing's Idox Public Access
// pages (November 2026): paging through the weekly list, and the details tab.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { detailsTabUrl, nextPageLink, normalizeApplication } from './ingest-ealing-planning.mjs';

const fixture = name => readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const BASE = 'https://pam.ealing.gov.uk/online-applications/weeklyListResults.do?action=firstPage';
const page = n => `https://pam.ealing.gov.uk/online-applications/pagedSearchResults.do?action=page&searchCriteria.page=${n}`;

// Paging. Until November 2026 only weeklyListResults.do links were followed, so
// every week stopped after its first 10 applications.
const pager = await fixture('pam-pager.html');
assert.equal(nextPageLink(pager, BASE, 1), page(2), 'the "next" link');
const unmarked = pager.replace(/ class="next"/, '').replace(/>Next </, '>&raquo; <');
assert.equal(nextPageLink(unmarked, BASE, 1), page(2), 'else the following page number');
const lastPage = `<p class="pager"><a href="/online-applications/pagedSearchResults.do?action=page&amp;searchCriteria.page=2" class="previous">Previous</a>
  <a href="/online-applications/pagedSearchResults.do?action=page&amp;searchCriteria.page=1" class="page">1</a>
  <a href="/online-applications/pagedSearchResults.do?action=page&amp;searchCriteria.page=2" class="page">2</a><strong>3</strong></p>`;
assert.equal(nextPageLink(lastPage, page(3), 3), null, 'no next page after the last');
assert.equal(nextPageLink('<a href="/online-applications/pagedSearchResults.do?action=printPreview">Next</a>', BASE, 1), null, 'print preview is not a page');
assert.equal(nextPageLink('<a href="weeklyListResults.do?action=nextPage">More</a>', BASE, 1), 'https://pam.ealing.gov.uk/online-applications/weeklyListResults.do?action=nextPage', 'older Idox next link');

// Details tab: type, ward and decision level join the summary's fields.
const summaryUrl = 'https://pam.ealing.gov.uk/online-applications/applicationDetails.do?keyVal=TOLOTPJM0KK00&activeTab=summary';
assert.equal(detailsTabUrl(summaryUrl), 'https://pam.ealing.gov.uk/online-applications/applicationDetails.do?keyVal=TOLOTPJM0KK00&activeTab=details');
const summary = `<table><tr><th>Reference</th><td>264200FUL</td></tr><tr><th>Address</th><td>1 High Street Southall UB1 3AA</td></tr>
  <tr><th>Proposal</th><td>Demolition and erection of a six storey building</td></tr><tr><th>Status</th><td>Pending Consideration</td></tr></table>`;
const record = normalizeApplication(`${summary}\n${await fixture('pam-details-tab.html')}`, summaryUrl, null, '16 Nov 2026');
assert.equal(record.reference, '264200FUL');
assert.equal(record.address, '1 High Street Southall UB1 3AA', 'the applicant address is not the site address');
assert.equal(record.application_type, 'Full Planning Application');
assert.equal(record.ward, 'Southall Broadway');
assert.equal(record.expected_decision_level, 'Delegated Decision');

console.log('planning ingest tests passed');
