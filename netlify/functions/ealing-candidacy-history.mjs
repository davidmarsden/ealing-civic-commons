import { EALING_CANDIDACY_HISTORY, EALING_CANDIDACY_HISTORY_META } from '../lib/ealing-candidacy-history.mjs';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=1800',
      'access-control-allow-origin': '*'
    }
  });
}

function normal(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function publicRecord(record) {
  return {
    id: record.id,
    electionYear: record.electionYear,
    electionDate: record.electionDate,
    electionType: record.electionType,
    electionLabel: record.electionLabel,
    candidateNameSource: record.candidateNameSource,
    ward: record.ward,
    ballot: record.ballot,
    votes: record.votes,
    result: record.result,
    provenance: record.provenance,
    identity: record.identity
  };
}

export default async request => {
  const url = new URL(request.url);
  const route = String(url.searchParams.get('route') || '').replace(/^\/+|\/+$/g, '');
  const query = normal(url.searchParams.get('q') || '');
  let records = EALING_CANDIDACY_HISTORY;

  if (route) {
    records = records.filter(record => record.identity?.status === 'matched' && record.identity?.route === route);
  } else if (query.length >= 2) {
    records = records.filter(record => normal(record.candidateNameSource).includes(query));
  } else {
    return json({ matched: false, reason: 'Provide route or q', records: [], meta: EALING_CANDIDACY_HISTORY_META }, 400);
  }

  return json({
    matched: records.length > 0,
    records: records.map(publicRecord),
    meta: EALING_CANDIDACY_HISTORY_META
  });
};
