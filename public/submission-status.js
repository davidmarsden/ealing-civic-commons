const panel = document.querySelector('#submissionStatus');
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const fmt = value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-GB', { dateStyle:'medium', timeStyle:'short' }).format(date); };

const token = new URL(location.href).searchParams.get('token') || '';
if (!token) {
  panel.innerHTML = '<h2>Status link missing</h2><p>This page needs the private status link created when the submission was made.</p>';
} else {
  try {
    const url = new URL('/.netlify/functions/submission-status', location.origin); url.searchParams.set('token', token);
    const response = await fetch(url, { cache:'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    const action = data.publishedPath
      ? `<p><a class="submit-button" href="${esc(data.publishedPath)}">View published contribution →</a></p>`
      : data.commonsPath ? `<p><a href="${esc(data.commonsPath)}">Return to the civic story →</a></p>` : '';
    panel.innerHTML = `<p class="eyebrow">${esc(data.label)}</p><h2>${esc(data.title)}</h2><p><strong>Reference:</strong> <code>${esc(data.reference)}</code></p><p>Submitted ${esc(fmt(data.submittedAt))}${data.updatedAt ? ` · last updated ${esc(fmt(data.updatedAt))}` : ''}</p>${data.state === 'received' ? '<p>Your submission is safely in the moderation queue. Nothing is published automatically.</p>' : ''}${data.state === 'needs-info' ? '<p>A reviewer needs more information before this can be published.</p>' : ''}${data.state === 'published' ? '<p>Your contribution has been published after human review.</p>' : ''}${data.state === 'not-published' ? '<p>Your submission was reviewed and was not published.</p>' : ''}${data.state === 'accepted' ? '<p>Your submission has been accepted for further Civic Commons review, but does not have an automatic public publication path yet.</p>' : ''}${action}<p><small>This status page exposes no email address or private moderation notes.</small></p>`;
  } catch (error) {
    panel.innerHTML = `<h2>Status unavailable</h2><p>${esc(error.message)}</p><p>If you submitted very recently, wait a moment and try again.</p>`;
  }
}
