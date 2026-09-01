import assert from 'node:assert/strict';
import { validateEvidenceCollection, validateEvidenceObject } from '../netlify/lib/evidence.mjs';
import { normalizeEalingProbe } from '../netlify/lib/ealing-evidence.mjs';

const probe = {
  generatedAt: '2026-08-31T22:00:00.000Z',
  groups: [
    {
      id: 'imd', label: 'Deprivation / IMD', note: 'Published LSOA values.', indicators: [{
        id: 'I3091', name: 'Index of Multiple Deprivation (IMD) Score', dataType: 'score', instances: [{
          date: '2025', geography: { name: 'LSOA 2021' }, serviceUrl: 'https://example.test/FeatureServer/0', fieldId: 'IMD2025', unit: null,
          observations: [
            { place: 'Dormers Wells — Ealing 014D', area: { name: 'Ealing 014D', code: 'E01001292', wardName: 'Dormers Wells', townName: 'Southall' }, value: 19.948 },
            { place: 'Southall Green — Ealing 017A', area: { name: 'Ealing 017A', code: 'E01001294', wardName: 'Southall Green', townName: 'Southall' }, value: 32.702 }
          ],
          summary: { kind: 'numeric', values: { count: 2, min: 19.948, median: 26.325, max: 32.702 } },
          comparator: { label: 'Ealing LSOA 2021 median', kind: 'numeric', values: { count: 199, min: 5, median: 24.1, max: 60 } }
        }]
      }]
    },
    {
      id: 'air-quality', label: 'Air quality', note: 'Method not exposed.', indicators: [{
        id: 'I30920', name: 'Benzene', dataType: null, instances: [{
          date: '2023', geography: { name: 'LSOA 2021' }, serviceUrl: 'https://example.test/FeatureServer/0', fieldId: 'BENZENE', unit: null,
          observations: [
            { place: 'Dormers Wells — Ealing 014D', area: { name: 'Ealing 014D', code: 'E01001292', wardName: 'Dormers Wells', townName: 'Southall' }, value: 0.12 },
            { place: 'Southall Green — Ealing 017A', area: { name: 'Ealing 017A', code: 'E01001294', wardName: 'Southall Green', townName: 'Southall' }, value: 0.12 }
          ],
          summary: { kind: 'numeric', values: { count: 2, min: 0.12, median: 0.12, max: 0.12 } },
          comparator: { label: 'Ealing LSOA 2021 median', kind: 'numeric', values: { count: 199, min: 0.1, median: 0.12, max: 0.2 } }
        }]
      }]
    },
    {
      id: 'homelessness', label: 'Homelessness', note: 'Borough only.', indicators: [{
        id: 'I44455', name: 'Core homelessness rate (% of households)', dataType: 'rate', instances: [{
          date: '2020–2023', geography: { name: 'Ealing borough' }, serviceUrl: 'https://example.test/FeatureServer/0', fieldId: 'HOMELESS', unit: '%', scopeNote: 'Repeated borough value.',
          observations: [{ place: 'Ealing borough', area: { name: 'Ealing borough', code: '', wardName: '', townName: '' }, value: 2.09 }],
          summary: { kind: 'numeric', values: { count: 1, min: 2.09, median: 2.09, max: 2.09 } }, comparator: null
        }]
      }]
    }
  ]
};

const normalized = normalizeEalingProbe(probe);
assert.equal(normalized.objects.length, 3);
assert.equal(normalized.collections.length, 2);
assert.equal(normalized.exclusions.some(item => item.group === 'air-quality'), true);
assert.equal(normalized.collections.some(item => item.indicatorId === 'I30920'), false);

for (const object of normalized.objects) assert.equal(validateEvidenceObject(object).valid, true, object.id);
for (const collection of normalized.collections) assert.equal(validateEvidenceCollection(collection).valid, true, collection.id);

const homelessness = normalized.objects.find(item => item.indicator.id === 'I44455');
assert.equal(homelessness.geography.level, 'Ealing borough');
assert.equal(homelessness.geography.scope, 'borough');
assert(homelessness.methodology.warnings.includes('borough-value-repeated-on-small-area-layer'));

const imd = normalized.collections.find(item => item.indicatorId === 'I3091');
assert.equal(imd.comparator.population, 199);
assert.equal(imd.comparator.value, 24.1);

const validObject = normalized.objects.find(item => item.indicator.id === 'I3091');
for (const badValue of [null, '', false, [], {}]) {
  const candidate = { ...validObject, value: badValue };
  assert.equal(validateEvidenceObject(candidate).valid, false, `value ${JSON.stringify(badValue)} must be rejected`);
}
assert.equal(validateEvidenceObject({ ...validObject, value: '19.948' }).valid, true, 'numeric strings remain valid published values');
assert.equal(validateEvidenceObject({ ...validObject, value: 'suppressed' }).valid, true, 'non-empty published text remains valid');

const badComparator = {
  ...validObject,
  comparators: [{ ...validObject.comparators[0], value: false }]
};
assert.equal(validateEvidenceObject(badComparator).valid, false, 'boolean comparator values must be rejected');

console.log(`Validated ${normalized.objects.length} evidence objects and ${normalized.collections.length} collections; AQ excluded and malformed values rejected.`);
