const OBJECT_KINDS = new Set(['statistic']);
const GEO_SCOPES = new Set(['borough', 'town', 'ward', 'neighbourhood']);
const WARNING_CODES = new Set([
  'flat-spatial-values',
  'narrow-spatial-range',
  'measurement-method-unknown',
  'monitor-location-unknown',
  'borough-value-repeated-on-small-area-layer',
  'historic-boundary-mismatch',
  'source-metadata-incomplete'
]);

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function publishedValue(value) {
  return (typeof value === 'number' && Number.isFinite(value)) || nonEmpty(value);
}

function numericValue(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  return nonEmpty(value) && Number.isFinite(Number(value.trim()));
}

function push(errors, condition, path, message) {
  if (!condition) errors.push({ path, message });
}

export function validateEvidenceObject(value) {
  const errors = [];
  push(errors, value && typeof value === 'object' && !Array.isArray(value), '$', 'must be an object');
  if (errors.length) return { valid: false, errors };

  push(errors, value.schemaVersion === 1, 'schemaVersion', 'must equal 1');
  push(errors, nonEmpty(value.id), 'id', 'must be a stable non-empty id');
  push(errors, OBJECT_KINDS.has(value.kind), 'kind', 'must be a supported evidence kind');
  push(errors, value.indicator && typeof value.indicator === 'object', 'indicator', 'is required');
  push(errors, publishedValue(value.value), 'value', 'must contain a published number or non-empty string');
  push(errors, value.period && nonEmpty(value.period.label), 'period.label', 'is required');
  push(errors, value.geography && nonEmpty(value.geography.level), 'geography.level', 'is required');
  push(errors, value.geography && nonEmpty(value.geography.name), 'geography.name', 'is required');
  push(errors, value.geography && GEO_SCOPES.has(value.geography.scope), 'geography.scope', 'must be borough, town, ward or neighbourhood');
  push(errors, value.provenance && nonEmpty(value.provenance.publisher), 'provenance.publisher', 'is required');
  push(errors, value.provenance && nonEmpty(value.provenance.sourceSystem), 'provenance.sourceSystem', 'is required');
  push(errors, value.provenance && nonEmpty(value.provenance.serviceUrl), 'provenance.serviceUrl', 'is required');
  push(errors, value.provenance && nonEmpty(value.provenance.fieldId), 'provenance.fieldId', 'is required');
  push(errors, value.provenance && nonEmpty(value.provenance.retrievedAt), 'provenance.retrievedAt', 'is required');
  push(errors, value.methodology && nonEmpty(value.methodology.publicationScope), 'methodology.publicationScope', 'is required');
  push(errors, value.methodology && nonEmpty(value.methodology.aggregation), 'methodology.aggregation', 'is required');

  const warnings = value.methodology?.warnings || [];
  push(errors, Array.isArray(warnings), 'methodology.warnings', 'must be an array');
  if (Array.isArray(warnings)) {
    warnings.forEach((warning, index) => {
      const code = typeof warning === 'string' ? warning : warning?.code;
      push(errors, WARNING_CODES.has(code), `methodology.warnings[${index}]`, `unknown warning code: ${code ?? 'missing'}`);
    });
  }

  const comparators = value.comparators || [];
  push(errors, Array.isArray(comparators), 'comparators', 'must be an array');
  if (Array.isArray(comparators)) {
    comparators.forEach((comparator, index) => {
      push(errors, nonEmpty(comparator?.label), `comparators[${index}].label`, 'is required');
      push(errors, numericValue(comparator?.value), `comparators[${index}].value`, 'must be numeric');
      push(errors, nonEmpty(comparator?.geographyLevel), `comparators[${index}].geographyLevel`, 'is required');
      push(errors, nonEmpty(comparator?.method), `comparators[${index}].method`, 'is required');
      push(errors, Number.isInteger(comparator?.population) && comparator.population > 0, `comparators[${index}].population`, 'must be a positive integer');
      if (value.geography?.level && comparator?.geographyLevel) {
        push(errors, comparator.geographyLevel === value.geography.level, `comparators[${index}].geographyLevel`, 'must match the observation geography level');
      }
    });
  }

  if (warnings.some(w => (typeof w === 'string' ? w : w?.code) === 'borough-value-repeated-on-small-area-layer')) {
    push(errors, value.geography?.scope === 'borough', 'geography.scope', 'repeated borough values must normalize to borough scope');
    push(errors, value.geography?.level === 'Ealing borough', 'geography.level', 'repeated borough values must normalize to Ealing borough level');
  }

  return { valid: errors.length === 0, errors };
}

export function validateEvidenceCollection(value) {
  const errors = [];
  push(errors, value && typeof value === 'object' && !Array.isArray(value), '$', 'must be an object');
  if (errors.length) return { valid: false, errors };

  push(errors, value.schemaVersion === 1, 'schemaVersion', 'must equal 1');
  push(errors, nonEmpty(value.id), 'id', 'must be a stable non-empty id');
  push(errors, nonEmpty(value.indicatorId), 'indicatorId', 'is required');
  push(errors, nonEmpty(value.period), 'period', 'is required');
  push(errors, nonEmpty(value.place), 'place', 'is required');
  push(errors, Array.isArray(value.observations) && value.observations.length > 0, 'observations', 'must contain at least one evidence id');

  const summary = value.summary;
  if (summary) {
    push(errors, Number.isInteger(summary.count) && summary.count > 0, 'summary.count', 'must be a positive integer');
    if (summary.kind === 'distribution') {
      push(errors, Array.isArray(summary.values), 'summary.values', 'must be an array for a distribution');
    } else {
      ['min', 'median', 'max'].forEach(key => push(errors, numericValue(summary[key]), `summary.${key}`, 'must be numeric'));
      if ([summary.min, summary.median, summary.max].every(numericValue)) {
        push(errors, Number(summary.min) <= Number(summary.median) && Number(summary.median) <= Number(summary.max), 'summary', 'must satisfy min <= median <= max');
      }
    }
  }

  if (value.comparator) {
    push(errors, nonEmpty(value.comparator.label), 'comparator.label', 'is required');
    push(errors, Number.isInteger(value.comparator.population) && value.comparator.population > 0, 'comparator.population', 'must be a positive integer');
    push(errors, nonEmpty(value.comparator.method), 'comparator.method', 'is required');
    if (value.comparator.method === 'median') {
      push(errors, numericValue(value.comparator.value), 'comparator.value', 'must be numeric for a median comparator');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function assertEvidenceObject(value) {
  const result = validateEvidenceObject(value);
  if (!result.valid) throw new Error(`Invalid evidence object: ${result.errors.map(error => `${error.path} ${error.message}`).join('; ')}`);
  return value;
}

export function assertEvidenceCollection(value) {
  const result = validateEvidenceCollection(value);
  if (!result.valid) throw new Error(`Invalid evidence collection: ${result.errors.map(error => `${error.path} ${error.message}`).join('; ')}`);
  return value;
}

export const evidenceWarningCodes = [...WARNING_CODES];
