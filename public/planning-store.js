export async function loadPlanningStore(queryKey = 'planning') {
  for (const path of ['/data/planning-archive.json', '/data/planning-latest.json']) {
    const response = await fetch(`${path}?${queryKey}=${Date.now()}`, { cache: 'no-store' });
    if (response.ok) return response.json();
    if (response.status !== 404) throw new Error(`Planning store HTTP ${response.status}: ${path}`);
  }
  throw new Error('No published planning store available');
}
