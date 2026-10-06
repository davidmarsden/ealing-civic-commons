const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

function maturityLabel(issue) {
  return issue.maturity === 'issue-hub' ? 'Issue hub' : 'Developing issue';
}

function issueCard(issue) {
  return `<article class="issue-directory-item">
    <div class="entity-kicker"><span class="tag">${esc(maturityLabel(issue))}</span></div>
    <h3><a href="/${esc(issue.route)}">${esc(issue.name)} →</a></h3>
    <p>${esc(issue.description || '')}</p>
  </article>`;
}

async function loadOngoingIssues() {
  const root = document.getElementById('ongoingIssues');
  if (!root) return;
  try {
    const response = await fetch('/.netlify/functions/civic-issues', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Issue directory HTTP ${response.status}`);
    const data = await response.json();
    const issues = (data.issues || []).filter(issue => issue.status === 'ongoing');
    if (!issues.length) {
      root.innerHTML = '<p class="entity-empty">No ongoing civic issues are currently published.</p>';
      return;
    }
    root.innerHTML = issues.map(issueCard).join('');
  } catch (error) {
    console.warn('Ongoing issue directory unavailable', error);
    root.innerHTML = '<p class="entity-empty">The ongoing issue directory is temporarily unavailable.</p>';
  }
}

loadOngoingIssues();
