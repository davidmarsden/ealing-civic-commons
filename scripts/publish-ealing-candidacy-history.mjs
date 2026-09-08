import { writeFile } from 'node:fs/promises';
import { EALING_CANDIDACY_HISTORY, EALING_CANDIDACY_HISTORY_META } from '../netlify/lib/ealing-candidacy-history.mjs';

const OUTPUT = new URL('../public/ealing-candidacy-history.json', import.meta.url);

await writeFile(
  OUTPUT,
  `${JSON.stringify({ records: EALING_CANDIDACY_HISTORY, meta: EALING_CANDIDACY_HISTORY_META })}\n`,
  'utf8'
);

console.log(`Published ${EALING_CANDIDACY_HISTORY.length} candidacy records to public/ealing-candidacy-history.json.`);
