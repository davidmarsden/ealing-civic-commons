#!/usr/bin/env node
import assert from 'node:assert/strict';
import { checkRefresh } from './check-planning-refresh.mjs';

const recs = n => Array.from({ length: n }, (_, i) => ({ reference: `R${i}` }));
const base = { baseLatest: { week: '28 Sep 2026', records: recs(10) }, baseArchive: { records: recs(50) } };
assert.deepEqual(checkRefresh({ ...base, latest: { week: '12 Oct 2026', records: recs(10) }, archive: { records: recs(70) } }), []);
assert.match(checkRefresh({ ...base, latest: { week: '12 Oct 2026', records: [] }, archive: { records: recs(70) } }).join(), /no records/);
assert.match(checkRefresh({ ...base, latest: { week: '21 Sep 2026', records: recs(5) }, archive: { records: recs(70) } }).join(), /older than/);
assert.match(checkRefresh({ ...base, latest: { week: '12 Oct 2026', records: recs(5) }, archive: { records: recs(40) } }).join(), /shrank from 50 to 40/);
assert.match(checkRefresh({ ...base, latest: { week: 'soon', records: recs(5) }, archive: { records: recs(70) } }).join(), /not a date/);
// First run with no base data is allowed.
assert.deepEqual(checkRefresh({ latest: { week: '12 Oct 2026', records: recs(3) }, archive: { records: recs(3) } }), []);
console.log('planning refresh guard tests passed');
