const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const API = '/.netlify/functions/review-queue';
let currentStatus = 'pending';

function token() { return sessionStorage.getItem('civic-commons:review-token') || ''; }
function reviewer() { return localStorage.getItem('civic-commons:reviewer') || 'Editor'; }
function headers() { return { authorization: `Bearer ${token()}`, 'content-type': 'application/json' }; }
function fmtDate(value) { if (!value) return ''; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { dateStyle:'medium', timeStyle:'short' }).format(date); }

async function api(path = '', options = {}) {
  const response = await fetch(`${API}${path}`, { cache:'no-store', ...options, headers: { ...headers(), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function stateLabel(value) { return value === 'needs-info' ? 'Needs info' : value.charAt(0).toUpperCase() + value.slice(1); }

function decisionButtons(record) {
  const labels = [
    ['accepted', record.kind === 'item-contribution' ? 'Accept & publish' : 'Accept'],
    ['needs-info', 'Needs info'],
    ['rejected', 'Reject']
  ];
  const decisions = labels.filter(([status]) => status !== record.status).map(([status, label]) => `<button type="button" data-decision="${status}">${label}</button>`).join('');
  const retry = record.kind === 'item-contribution' && record.status === 'accepted'
    ? '<button type="button" data-reconcile-publication>Retry publish</button>'
    : '';
  return `<div class="review-decision">${retry}${decisions}</div>`;
}

function card(record) {
  const p = record.payload || {};
  const priv = record.private || {};
  const title = p.title || p.body?.slice(0, 100) || `${record.kind} candidate`;
  const link = p.url || p.relatedUrl || p.originalUrl || p.commonsPermalink;
  const privateBits = [priv.displayName && `Name: ${esc(priv.displayName)}`, priv.email && `Email: ${esc(priv.email)}`, priv.moderationContext && esc(priv.moderationContext)].filter(Boolean);
  const latest = Array.isArray(record.history) && record.history.length ? record.history[record.history.length - 1] : null;
  return `<article class="review-card" data-id="${esc(record.id)}">
    <div class="review-card-head"><div><div class="review-meta"><span class="review-kind">${esc(record.kind)}</span><span>${esc(record.source)}</span><span>${esc(fmtDate(record.createdAt))}</span></div><h2>${esc(title)}</h2></div><span class="review-state ${esc(record.status)}">${esc(stateLabel(record.status))}</span></div>
    ${p.body ? `<p class="review-body">${esc(p.body)}</p>` : ''}
    <div class="review-meta">${p.contributionType ? `<span>${esc(p.contributionType)}</span>` : ''}${p.noticeType ? `<span>${esc(p.noticeType)}</span>` : ''}${p.area ? `<span>${esc(p.area)}</span>` : ''}${(p.topics || []).map(topic => `<span>${esc(topic)}</span>`).join('')}</div>
    ${link ? `<p class="review-link"><a href="${esc(link)}" target="_blank" rel="noopener noreferrer">Open source ↗</a></p>` : ''}
    <p><small>${esc(record.provenance || '')}</small></p>
    ${privateBits.length ? `<div class="review-private"><strong>Private moderation data</strong><br>${privateBits.join('<br>')}</div>` : ''}
    ${decisionButtons(record)}
    ${latest ? `<div class="review-history">Last decision: ${esc(latest.reviewer)} · ${esc(stateLabel(latest.to))} · ${esc(fmtDate(latest.at))}${latest.note ? ` — ${esc(latest.note)}` : ''}</div>` : ''}
  </article>`;
}

async function loadQueue() {
  $('#queueStatus').textContent = 'Loading review queue…';
  try {
    const query = currentStatus === 'all' ? '' : `?status=${encodeURIComponent(currentStatus)}`;
    const data = await api(query);
    $('#queueList').innerHTML = data.records.length ? data.records.map(card).join('') : '<div class="review-empty">Nothing in this part of the queue.</div>';
    $('#queueStatus').textContent = `${data.records.length} ${currentStatus === 'all' ? 'review items' : currentStatus.replace('-', ' ')} item${data.records.length === 1 ? '' : 's'}.`;
    bindDecisions();
  } catch (error) {
    $('#queueStatus').textContent = error.message;
    if (/Unauthorised/i.test(error.message)) lock();
  }
}

function bindDecisions() {
  document.querySelectorAll('[data-decision]').forEach(button => button.addEventListener('click', async () => {
    const cardEl = button.closest('[data-id]');
    const status = button.dataset.decision;
    const note = status === 'accepted' ? '' : (window.prompt(`${stateLabel(status)} note (optional):`, '') || '');
    button.disabled = true;
    try {
      const data = await api('', { method:'POST', body: JSON.stringify({ action:'decision', id:cardEl.dataset.id, status, reviewer:reviewer(), note }) });
      if (data.promotion?.type === 'public-contribution') {
        $('#queueStatus').textContent = data.promotion.published ? 'Contribution accepted and published.' : 'Contribution withdrawn from public view.';
      }
      await loadQueue();
    } catch (error) {
      $('#queueStatus').textContent = error.message;
      button.disabled = false;
    }
  }));

  document.querySelectorAll('[data-reconcile-publication]').forEach(button => button.addEventListener('click', async () => {
    const cardEl = button.closest('[data-id]');
    button.disabled = true;
    $('#queueStatus').textContent = 'Reconciling public contribution…';
    try {
      const data = await api('', { method:'POST', body: JSON.stringify({ action:'reconcile-publication', id:cardEl.dataset.id }) });
      $('#queueStatus').textContent = data.promotion?.published ? 'Contribution published.' : 'Contribution is not currently public.';
      await loadQueue();
    } catch (error) {
      $('#queueStatus').textContent = error.message;
      button.disabled = false;
    }
  }));
}

function unlock() {
  $('#loginPanel').hidden = true;
  $('#queuePanel').hidden = false;
  loadQueue();
}

function lock() {
  sessionStorage.removeItem('civic-commons:review-token');
  $('#queuePanel').hidden = true;
  $('#loginPanel').hidden = false;
  $('#tokenInput').value = '';
}

$('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  sessionStorage.setItem('civic-commons:review-token', $('#tokenInput').value.trim());
  localStorage.setItem('civic-commons:reviewer', $('#reviewerInput').value.trim() || 'Editor');
  $('#loginStatus').textContent = 'Checking access…';
  try { await api('?status=pending'); $('#loginStatus').textContent = ''; unlock(); }
  catch (error) { sessionStorage.removeItem('civic-commons:review-token'); $('#loginStatus').textContent = error.message; }
});

$('#reviewerInput').value = reviewer();
$('#refreshQueue').addEventListener('click', loadQueue);
$('#forgetToken').addEventListener('click', lock);
document.querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', () => {
  currentStatus = button.dataset.status;
  document.querySelectorAll('[data-status]').forEach(candidate => candidate.classList.toggle('active', candidate === button));
  loadQueue();
}));

$('#importNotices').addEventListener('click', async () => {
  const button = $('#importNotices');
  button.disabled = true;
  $('#queueStatus').textContent = 'Checking current Ealing notices on Public Notice Portal…';
  try {
    const data = await api('', { method:'POST', body: JSON.stringify({ action:'import-public-notices', limit:16 }) });
    $('#queueStatus').textContent = `Public Notice Portal: ${data.discovered} found, ${data.created} newly queued, ${data.alreadyQueued} already present${data.failed ? `, ${data.failed} failed` : ''}.`;
    currentStatus = 'pending';
    document.querySelectorAll('[data-status]').forEach(candidate => candidate.classList.toggle('active', candidate.dataset.status === 'pending'));
    await loadQueue();
  } catch (error) { $('#queueStatus').textContent = error.message; }
  finally { button.disabled = false; }
});

if (token()) unlock();
