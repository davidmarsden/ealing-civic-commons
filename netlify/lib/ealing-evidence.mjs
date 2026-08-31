import { assertEvidenceCollection, assertEvidenceObject } from './evidence.mjs';

const EXPLORER_BASE = 'https://data.ealing.gov.uk/data-catalog-explorer/indicator/';

function slug(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';
}

function scopeFor(level) {
  if (level === 'Ealing borough') return 'borough';
  if (level === 'Town Profile') return 'town';
  if (level === 'Ward') return 'ward';
  return 'neighbourhood';
}

function warningCodes(groupId, instance) {
  const warnings = [];
  if (groupId === 'air-quality') {
    warnings.push('measurement-method-unknown', 'monitor-location-unknown');
    const summary = instance.summary?.values;
    const comparator = instance.comparator?.values;
    if (summary && Number(summary.max) === Number(summary.min)) warnings.push('flat-spatial-values');
    else if (summary && comparator) {
      const localSpan = Number(summary.max) - Number(summary.min);
      const widerSpan = Number(comparator.max) - Number(comparator.min);
      if (Number.isFinite(localSpan) && Number.isFinite(widerSpan) && widerSpan > 0 && localSpan / widerSpan <= 0.2) warnings.push('narrow-spatial-range');
    }
  }
  if (instance.geography?.name === 'Ealing borough' && instance.scopeNote) warnings.push('borough-value-repeated-on-small-area-layer');
  return [...new Set(warnings)];
}

function objectComparators(instance) {
  if (instance.comparator?.kind !== 'numeric' || !instance.comparator.values) return [];
  return [{
    label: instance.comparator.label,
    value: instance.comparator.values.median,
    geographyLevel: instance.geography.name,
    population: instance.comparator.values.count,
    method: 'median'
  }];
}

function geographyFor(observation, instance) {
  const area = observation.area || {};
  const level = instance.geography?.name || 'Unknown';
  return {
    level,
    code: area.code || null,
    name: area.name || observation.place || level,
    ward: area.wardName || null,
    town: area.townName || (level === 'Ealing borough' ? null : 'Southall'),
    scope: scopeFor(level)
  };
}

function evidenceId(indicatorId, period, geography) {
  const geoPart = geography.code || geography.name;
  return `ealing-data:${indicatorId}:${slug(period)}:${slug(geography.level)}:${slug(geoPart)}`;
}

function collectionId(indicatorId, period, geography, place) {
  return `ealing-data:${indicatorId}:${slug(period)}:${slug(geography)}:${slug(place)}`;
}

function normalizeSummary(summary) {
  if (!summary?.values) return null;
  if (summary.kind === 'distribution') return { kind: 'distribution', count: summary.values.reduce((sum, item) => sum + Number(item.count || 0), 0), values: summary.values };
  return { kind: 'numeric', ...summary.values };
}

function normalizeCollectionComparator(instance) {
  const comparator = instance.comparator;
  if (!comparator) return null;
  if (comparator.kind === 'distribution') {
    return {
      label: comparator.label,
      population: comparator.values.reduce((sum, item) => sum + Number(item.count || 0), 0),
      method: 'distribution',
      values: comparator.values
    };
  }
  return {
    label: comparator.label,
    population: comparator.values.count,
    method: 'median',
    value: comparator.values.median,
    min: comparator.values.min,
    max: comparator.values.max
  };
}

export function normalizeEalingProbe(probe) {
  const objects = [];
  const collections = [];
  const retrievedAt = probe.generatedAt || new Date().toISOString();

  for (const group of probe.groups || []) {
    for (const indicator of group.indicators || []) {
      for (const instance of indicator.instances || []) {
        if (instance.error || !instance.observations?.length) continue;
        const warnings = warningCodes(group.id, instance);
        const ids = [];

        for (const observation of instance.observations) {
          const geography = geographyFor(observation, instance);
          const object = {
            schemaVersion: 1,
            id: evidenceId(indicator.id, instance.date, geography),
            kind: 'statistic',
            indicator: {
              id: indicator.id,
              name: indicator.name,
              theme: group.label,
              dataType: indicator.dataType || null,
              unit: instance.unit || null
            },
            value: observation.value,
            period: { label: instance.date, start: null, end: null },
            geography,
            comparators: objectComparators(instance),
            provenance: {
              publisher: 'Ealing Council',
              sourceSystem: 'Ealing Data / InstantAtlas / ArcGIS',
              indicatorUrl: `${EXPLORER_BASE}${indicator.id}/`,
              serviceUrl: instance.serviceUrl,
              fieldId: instance.fieldId,
              retrievedAt
            },
            methodology: {
              publicationScope: instance.geography?.name || 'Unknown',
              measurementType: group.id === 'air-quality' ? 'unknown' : 'published-statistic',
              aggregation: 'direct-published-value',
              warnings
            },
            relationships: {
              towns: geography.town ? [geography.town] : [],
              wards: geography.ward ? [geography.ward] : [],
              topics: [group.id]
            }
          };
          assertEvidenceObject(object);
          objects.push(object);
          ids.push(object.id);
        }

        const place = instance.geography?.name === 'Ealing borough' ? 'Ealing' : 'Southall';
        const collection = {
          schemaVersion: 1,
          id: collectionId(indicator.id, instance.date, instance.geography?.name, place),
          indicatorId: indicator.id,
          indicatorName: indicator.name,
          theme: group.label,
          dataType: indicator.dataType || null,
          unit: instance.unit || null,
          period: instance.date,
          place,
          geographyLevel: instance.geography?.name || 'Unknown',
          observations: ids,
          summary: normalizeSummary(instance.summary),
          comparator: normalizeCollectionComparator(instance),
          methodology: { warnings, note: instance.scopeNote || group.note || null },
          provenance: { publisher: 'Ealing Council', sourceSystem: 'Ealing Data / InstantAtlas / ArcGIS', retrievedAt }
        };
        assertEvidenceCollection(collection);
        collections.push(collection);
      }
    }
  }

  return {
    schemaVersion: 1,
    generatedAt: retrievedAt,
    source: 'Ealing Data',
    objects,
    collections
  };
}
