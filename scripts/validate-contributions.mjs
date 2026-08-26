import fs from 'node:fs';

const path = new URL('../public/data/contributions.json', import.meta.url);
const allowedTypes = new Set([
  'Correction',
  'Related source',
  'Evidence / document',
  'Local information',
  'Comment / context'
]);
const forbiddenPrivateFields = new Set(['email', 'contactEmail', 'ip', 'ipAddress']);

function fail(message) {
  console.error(`Contribution registry validation failed: ${message}`);
  process.exitCode = 1;
}

let registry;
try {
  registry = JSON.parse(fs.readFileSync(path, 'utf8'));
} catch (error) {
  fail(`could not parse public/data/contributions.json (${error.message})`);
  process.exit();
}

if (registry.version !== 1) fail('version must be 1');
if (!Array.isArray(registry.contributions)) fail('contributions must be an array');

const ids = new Set();
for (const [index, contribution] of (registry.contributions || []).entries()) {
  const label = `entry ${index + 1}`;
  if (!contribution || typeof contribution !== 'object' || Array.isArray(contribution)) {
    fail(`${label} must be an object`);
    continue;
  }

  for (const field of forbiddenPrivateFields) {
    if (Object.prototype.hasOwnProperty.call(contribution, field)) {
      fail(`${label} contains forbidden private field "${field}"`);
    }
  }

  if (!contribution.id || typeof contribution.id !== 'string') {
    fail(`${label} requires a string id`);
  } else if (ids.has(contribution.id)) {
    fail(`${label} duplicates id "${contribution.id}"`);
  } else {
    ids.add(contribution.id);
  }

  if (!contribution.threadId || typeof contribution.threadId !== 'string' || !contribution.threadId.startsWith('civic-item:')) {
    fail(`${label} requires a civic-item threadId`);
  }

  if (!allowedTypes.has(contribution.type)) {
    fail(`${label} has unsupported type "${contribution.type}"`);
  }

  if (contribution.status !== 'published') {
    fail(`${label} must have status "published"; unpublished moderation records do not belong in the public registry`);
  }

  if (!contribution.body || typeof contribution.body !== 'string' || !contribution.body.trim()) {
    fail(`${label} requires a non-empty body`);
  }

  if (!contribution.publishedAt || Number.isNaN(Date.parse(contribution.publishedAt))) {
    fail(`${label} requires a valid publishedAt date`);
  }

  if (contribution.relatedUrl) {
    try {
      const url = new URL(contribution.relatedUrl);
      if (!['http:', 'https:'].includes(url.protocol)) fail(`${label} relatedUrl must use HTTP or HTTPS`);
    } catch {
      fail(`${label} relatedUrl is not a valid absolute URL`);
    }
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`Contribution registry OK: ${(registry.contributions || []).length} published contribution(s).`);
