// Generated at build time from the Department for Education Get Information about Schools (GIAS) public bulk download.
// This checked-in fallback keeps module resolution stable if the upstream bulk file is temporarily unavailable.
export const EALING_SCHOOLS = [];
export const EALING_SCHOOLS_META = {
  source: 'Get Information about Schools (GIAS)',
  localAuthorityCode: '307',
  generatedAt: null,
  sourceDate: null,
  count: 0,
  degraded: true
};

export function findEalingSchoolByRoute(value) {
  const route = String(value || '').trim().replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '');
  return EALING_SCHOOLS.find(entity => entity.route === route) || null;
}
