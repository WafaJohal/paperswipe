/* ═══════════════════════════════════════════════════════════
   PaperSwipe — app.js
   Feed-based academic paper triage tool
   Sync: GitHub Gist as a personal cloud backend
═══════════════════════════════════════════════════════════ */

// ── CONSTANTS ────────────────────────────────────────────
const ARXIV_CATS = [
  { id: 'cs.AI',           label: 'cs.AI' },
  { id: 'cs.LG',           label: 'cs.LG' },
  { id: 'cs.CL',           label: 'cs.CL' },
  { id: 'cs.CV',           label: 'cs.CV' },
  { id: 'cs.RO',           label: 'cs.RO' },
  { id: 'cs.HC',           label: 'cs.HC' },
  { id: 'cs.NE',           label: 'cs.NE' },
  { id: 'cs.IR',           label: 'cs.IR' },
  { id: 'stat.ML',         label: 'stat.ML' },
  { id: 'eess.AS',         label: 'eess.AS' },
  { id: 'q-bio.NC',        label: 'q-bio.NC' },
  { id: 'physics.data-an', label: 'phys.data' },
];

const DEFAULT_PROFILE = {
  keywords:   ['large language models', 'human-robot interaction'],
  categories: ['cs.AI', 'cs.RO', 'cs.HC'],
  venues:     ['CHI', 'UIST', 'ICRA', 'NeurIPS', 'HRI'],
  authors:    [],
  limit:      40,
  source:     'both',
  sort:       'recent',
};

const GIST_FILENAME = 'paperswipe-data.json';

// ── STATE ────────────────────────────────────────────────
let profile   = lsLoad('ps_profile')   || DEFAULT_PROFILE;
let seenIds   = new Set(lsLoad('ps_seen') || []);
let stack     = lsLoad('ps_stack')     || [];
let lastFetch = lsLoad('ps_lastFetch') || null;

// Gist credentials — stored in localStorage per device, never in the repo
let gistToken  = lsLoad('ps_gist_token') || '';
let gistId     = lsLoad('ps_gist_id')    || '';
let syncStatus = 'idle'; // idle | syncing | ok | error

let allPapers   = [];
let papers      = [];
let idx         = 0;
let history     = [];
let activeTier  = 'all';
let activeSrc   = 'all';
let detailPaper = null;

const tagLists = { keyword: [], category: [], venue: [], author: [] };

// ── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  renderCatGrid();
  loadProfileUI();
  bindSourceTabs();
  bindSettingsEnterKeys();
  bindKeyboard();
  renderSyncUI();

  // Pull remote data first if Gist is configured
  if (gistToken && gistId) {
    setSyncStatus('syncing', 'Syncing from Gist…');
    await gistPull();
  }

  updateStackUI();

  const hasProfile = profile.keywords.length || profile.categories.length ||
                     profile.venues.length    || profile.authors.length;
  if (hasProfile) refreshFeed();
  else showEmpty('Feed not configured', 'Set up your keywords, categories, and venues to start receiving papers.');
});

// ═══════════════════════════════════════════════════════════
// GIST SYNC
// ═══════════════════════════════════════════════════════════

function gistHeaders() {
  return {
    'Authorization': `token ${gistToken}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

// Pull remote → merge into local. Remote stack wins, but local-only items are kept.
async function gistPull() {
  if (!gistToken || !gistId) return;
  setSyncStatus('syncing', 'Pulling from Gist…');
  try {
    const resp = await fetch(`https://api.github.com/gists/${gistId}`, { headers: gistHeaders() });
    if (!resp.ok) throw new Error(`GitHub API ${resp.status}`);
    const data = await resp.json();
    const raw  = data.files?.[GIST_FILENAME]?.content;
    if (!raw) throw new Error(`File "${GIST_FILENAME}" not found in Gist — did you create it?`);

    const remote = JSON.parse(raw);

    // Merge stacks: keep remote order, append any local-only items
    const remoteIds = new Set((remote.stack || []).map(p => p.id));
    const localOnly = stack.filter(p => !remoteIds.has(p.id));
    stack   = [...(remote.stack || []), ...localOnly];

    // Union seen sets
    seenIds = new Set([...(remote.seen || []), ...seenIds]);

    // Profile: remote wins (last device to save wins)
    if (remote.profile) profile = remote.profile;

    lsSave('ps_stack',   stack);
    lsSave('ps_seen',    [...seenIds]);
    lsSave('ps_profile', profile);

    setSyncStatus('ok', `Synced · ${nowTime()}`);
    updateStackUI();
    loadProfileUI();
  } catch (e) {
    console.error('Gist pull failed:', e);
    setSyncStatus('error', `Sync failed: ${e.message}`);
  }
}

// Push local → Gist. Debounced so rapid swipes don't hammer the API.
let pushTimer = null;
function gistPushDebounced() {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(gistPush, 3000);
}

async function gistPush() {
  if (!gistToken || !gistId) return;
  setSyncStatus('syncing', 'Saving to Gist…');
  try {
    const payload = {
      stack,
      seen:      [...seenIds],
      profile,
      updatedAt: new Date().toISOString(),
    };
    const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: gistHeaders(),
      body: JSON.stringify({
        files: { [GIST_FILENAME]: { content: JSON.stringify(payload, null, 2) } },
      }),
    });
    if (!resp.ok) throw new Error(`GitHub API ${resp.status}`);
    setSyncStatus('ok', `Saved · ${nowTime()}`);
  } catch (e) {
    console.error('Gist push failed:', e);
    setSyncStatus('error', `Save failed: ${e.message}`);
  }
}

// One-time connect: validate credentials then do first pull
async function connectGist() {
  const token = document.getElementById('gistTokenInput').value.trim();
  const id    = document.getElementById('gistIdInput').value.trim();
  if (!token || !id) { showToast('Enter both token and Gist ID'); return; }

  const btn = document.getElementById('connectGistBtn');
  btn.textContent = 'Connecting…'; btn.disabled = true;
  try {
    const resp = await fetch(`https://api.github.com/gists/${id}`, {
      headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' },
    });
    if (!resp.ok) throw new Error(`GitHub returned ${resp.status} — check token & Gist ID`);

    gistToken = token; gistId = id;
    lsSave('ps_gist_token', gistToken);
    lsSave('ps_gist_id',    gistId);

    await gistPull();
    renderSyncUI();
    showToast('✓ Gist connected and synced');
    updateStackUI();
  } catch (e) {
    showToast(`Connection failed: ${e.message}`);
    setSyncStatus('error', e.message);
  }
  btn.textContent = 'Connect'; btn.disabled = false;
}

function disconnectGist() {
  if (!confirm('Disconnect Gist sync? Local data is kept but changes will no longer sync.')) return;
  gistToken = ''; gistId = '';
  lsSave('ps_gist_token', '');
  lsSave('ps_gist_id',    '');
  setSyncStatus('idle', 'Not connected');
  renderSyncUI();
  showToast('Gist disconnected');
}

function setSyncStatus(status, msg) {
  syncStatus = status;
  const dot  = document.getElementById('syncDot');
  const text = document.getElementById('syncText');
  if (!dot || !text) return;
  dot.className    = `sync-dot sync-${status}`;
  text.textContent = msg;
}

function renderSyncUI() {
  const connected = !!(gistToken && gistId);
  document.getElementById('syncSetup')?.classList.toggle('hidden', connected);
  document.getElementById('syncActive')?.classList.toggle('hidden', !connected);
  if (!connected) setSyncStatus('idle', 'Not connected');
  // Show Gist ID in active panel
  const cg = document.getElementById('connectedGistId');
  if (cg) cg.textContent = gistId ? gistId.slice(0, 16) + '…' : '';
  // Pre-fill inputs on re-open
  const ti = document.getElementById('gistTokenInput');
  const ii = document.getElementById('gistIdInput');
  if (ti && gistToken) ti.value = gistToken;
  if (ii && gistId)    ii.value = gistId;
}

// ═══════════════════════════════════════════════════════════
// FETCH (papers from arXiv / Semantic Scholar)
// ═══════════════════════════════════════════════════════════

async function refreshFeed() {
  const hasProfile = profile.keywords.length || profile.categories.length ||
                     profile.venues.length    || profile.authors.length;
  if (!hasProfile) { openSettings(); showToast('Set up your feed profile first'); return; }

  setLoading();
  setFeedDot('loading');
  const btn = document.getElementById('refreshBtn');
  btn.textContent = '↻ Loading…';

  try {
    let results = [];
    if (profile.source === 'arxiv' || profile.source === 'both')    results = results.concat(await fetchArxiv());
    if (profile.source === 'semantic' || profile.source === 'both') results = results.concat(await fetchSemantic());

    // Deduplicate by title fingerprint
    const seen = new Map();
    results = results.filter(p => {
      const k = p.title.toLowerCase().replace(/\W/g, '').slice(0, 45);
      if (seen.has(k)) return false;
      seen.set(k, true); return true;
    });

    results = results.filter(p => !seenIds.has(p.id));
    if (profile.sort === 'recent') results.sort((a, b) => (b.year || 0) - (a.year || 0));
    results = results.slice(0, profile.limit);

    allPapers = results;
    applySourceFilter();
    updateSourceCounts();

    lastFetch = new Date().toISOString();
    lsSave('ps_lastFetch', lastFetch);

    if (papers.length === 0) {
      showEmpty('Feed is empty', 'No new papers since your last visit. Try widening keywords or categories.');
      setFeedDot('idle');
    } else {
      renderCard();
      setFeedDot('live');
      showToast(`${papers.length} new papers in your feed`);
      updateInfoBar();
    }
  } catch (e) {
    console.error(e);
    showEmpty('Fetch failed', 'Could not reach paper sources. Check your connection and retry.');
    setFeedDot('idle');
  }
  btn.textContent = '↻ Refresh';
}

async function fetchArxiv() {
  const parts = [];
  if (profile.keywords.length)
    parts.push(`(${profile.keywords.map(k => `all:${encodeURIComponent(k)}`).join('+OR+')})`);
  if (profile.categories.length)
    parts.push(`(${profile.categories.map(c => `cat:${c}`).join('+OR+')})`);
  if (profile.authors.length)
    parts.push(`(${profile.authors.map(a => `au:${encodeURIComponent(a)}`).join('+OR+')})`);
  if (!parts.length) return [];

  const sort = profile.sort === 'recent' ? 'submittedDate' : 'relevance';
  const url  = `https://export.arxiv.org/api/query?search_query=${parts.join('+OR+')}&sortBy=${sort}&sortOrder=descending&start=0&max_results=${Math.min(profile.limit, 100)}`;
  try {
    return parseArxivXML(await (await fetch(url)).text());
  } catch (e) { console.warn('arXiv fetch failed', e); return []; }
}

function parseArxivXML(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return [...doc.querySelectorAll('entry')].map(e => {
    const id        = e.querySelector('id')?.textContent?.trim() || '';
    const title     = (e.querySelector('title')?.textContent || '').trim().replace(/\s+/g, ' ');
    const abstract  = (e.querySelector('summary')?.textContent || '').trim().replace(/\s+/g, ' ');
    const published = (e.querySelector('published')?.textContent || '').trim();
    const authors   = [...e.querySelectorAll('author name')].map(n => n.textContent.trim());
    const cats      = [...e.querySelectorAll('category')].map(c => c.getAttribute('term')).slice(0, 4);
    const year      = published ? new Date(published).getFullYear() : null;
    return { id, title, abstract, published, year, authors, categories: cats,
             venue: cats[0] || '', url: id, source: 'arxiv', citeCount: null, doi: '',
             matchedBy: whyMatched({ title, abstract, authors, categories: cats, venue: cats[0] || '' }) };
  }).filter(p => p.title && p.abstract);
}

async function fetchSemantic() {
  if (!profile.keywords.length && !profile.authors.length) return [];
  const queries = [...profile.keywords.slice(0, 3), ...(profile.authors.length ? [profile.authors[0]] : [])];
  const fields  = 'title,abstract,authors,year,venue,externalIds,citationCount,openAccessPdf,publicationDate';
  let all = [];
  for (const q of queries) {
    try {
      const resp = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=20&fields=${fields}`);
      if (!resp.ok) continue;
      const data = await resp.json();
      all = all.concat((data.data || []).map(p => {
        const doi     = p.externalIds?.DOI || '';
        const arxivId = p.externalIds?.ArXiv || '';
        const pdfUrl  = p.openAccessPdf?.url || (arxivId ? `https://arxiv.org/abs/${arxivId}` : '') || (doi ? `https://doi.org/${doi}` : '');
        const authors = (p.authors || []).map(a => a.name);
        return { id: p.paperId || '', title: p.title || '', abstract: p.abstract || '',
                 published: p.publicationDate || (p.year ? `${p.year}-01-01` : ''),
                 year: p.year || null, authors, categories: [], venue: p.venue || '',
                 url: pdfUrl || `https://www.semanticscholar.org/paper/${p.paperId}`,
                 doi, source: 'semantic', citeCount: p.citationCount || null,
                 matchedBy: whyMatched({ title: p.title || '', abstract: p.abstract || '', authors, categories: [], venue: p.venue || '' }) };
      }).filter(p => p.title && p.abstract));
    } catch (e) { console.warn('S2 query failed', e); }
  }
  return all;
}

function whyMatched(p) {
  for (const kw of profile.keywords)
    if ((p.title + ' ' + p.abstract).toLowerCase().includes(kw.toLowerCase()))
      return { type: 'keyword', value: kw };
  for (const cat of profile.categories)
    if ((p.categories || []).some(c => c.toLowerCase().includes(cat.toLowerCase())))
      return { type: 'category', value: cat };
  for (const v of profile.venues)
    if ((p.venue || '').toLowerCase().includes(v.toLowerCase()))
      return { type: 'venue', value: v };
  for (const au of profile.authors)
    if ((p.authors || []).some(a => a.toLowerCase().includes(au.toLowerCase())))
      return { type: 'author', value: au };
  return null;
}

// ── SOURCE FILTER ────────────────────────────────────────
function applySourceFilter() {
  papers = activeSrc === 'all' ? allPapers : allPapers.filter(p => p.source === activeSrc);
  idx = 0; history = [];
  renderCard();
}

function bindSourceTabs() {
  document.getElementById('srcTabs').addEventListener('click', e => {
    const tab = e.target.closest('.src-tab');
    if (!tab) return;
    document.querySelectorAll('.src-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeSrc = tab.dataset.src;
    applySourceFilter();
  });
}

function updateSourceCounts() {
  document.getElementById('cntAll').textContent      = allPapers.length;
  document.getElementById('cntArxiv').textContent    = allPapers.filter(p => p.source === 'arxiv').length;
  document.getElementById('cntSemantic').textContent = allPapers.filter(p => p.source === 'semantic').length;
}

// ── CARD RENDERING ───────────────────────────────────────
function setLoading() {
  document.getElementById('stage').innerHTML = `
    <div class="empty-state">
      <div class="spinner"></div>
      <p>Fetching your feed…</p>
    </div>`;
  showActRow(false);
  document.getElementById('infoBar').classList.add('hidden');
}

function showEmpty(title, sub) {
  document.getElementById('stage').innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">🔭</div>
      <h3>${esc(title)}</h3>
      <p>${esc(sub)}</p>
      <button class="button button-primary" onclick="openSettings()">⚙ Feed Settings</button>
    </div>`;
  showActRow(false);
  document.getElementById('infoBar').classList.add('hidden');
}

function renderCard() {
  const stage = document.getElementById('stage');
  stage.innerHTML = '';
  const rem = papers.slice(idx);

  if (rem.length === 0) {
    showEmpty('All caught up!', `You've triaged all ${papers.length} papers. Refresh for more.`);
    return;
  }

  if (rem.length > 2) { const g = mkEl('div', 'ghost ghost-2'); stage.appendChild(g); }
  if (rem.length > 1) { const g = mkEl('div', 'ghost ghost-1'); stage.appendChild(g); }

  const card = buildCard(rem[0]);
  stage.appendChild(card);
  setupDrag(card);
  showActRow(true);
  updateProgress();
  updateInfoBar();
}

function buildCard(p) {
  const srcCls   = p.source === 'arxiv' ? 'bs-arxiv' : 'bs-semantic';
  const srcLbl   = p.source === 'arxiv' ? 'arXiv' : 'S2';
  const yearTag  = p.year    ? `<span class="badge-src bs-year">${p.year}</span>` : '';
  const venueTag = p.venue   ? `<span class="badge-src bs-venue">${esc(p.venue.slice(0, 30))}</span>` : '';
  const catTags  = p.categories.slice(0, 2).map(c => `<span class="badge-src bs-cat">${esc(c)}</span>`).join('');
  const newTag   = isNew(p)  ? `<span class="badge-src bs-new">new</span>` : '';
  const citeTag  = p.citeCount ? `<span class="badge-src bs-venue">${p.citeCount} cited</span>` : '';
  const authLine = p.authors.slice(0, 4).join(', ') + (p.authors.length > 4 ? ' et al.' : '');
  const matchTag = p.matchedBy ? `<span class="card-match">via ${esc(p.matchedBy.value)}</span>` : '';

  const card = document.createElement('div');
  card.className = 'paper-card';
  card.innerHTML = `
    <div class="ol ol-save">SAVE ♥</div>
    <div class="ol ol-skip">SKIP ✕</div>
    <div class="card-top">
      <span class="badge-src ${srcCls}">${srcLbl}</span>
      ${newTag}${yearTag}${venueTag}${catTags}${citeTag}
    </div>
    <h3 class="card-title">${esc(p.title)}</h3>
    <p class="card-authors">${esc(authLine)}</p>
    <div class="card-abstract collapsed">${esc(p.abstract)}</div>
    <button class="expand-hint" onclick="toggleAbs(this)">▾ expand abstract</button>
    <div class="card-footer">
      ${matchTag}
      <a class="card-link" href="${esc(p.url)}" target="_blank" onclick="event.stopPropagation()">open ↗</a>
    </div>`;
  return card;
}

function isNew(p) {
  if (!lastFetch || !p.published) return false;
  return new Date(p.published) > new Date(lastFetch);
}

function toggleAbs(btn) {
  const ab = btn.previousElementSibling;
  ab.classList.contains('collapsed')
    ? (ab.classList.replace('collapsed', 'expanded'), btn.textContent = '▴ collapse')
    : (ab.classList.replace('expanded', 'collapsed'), btn.textContent = '▾ expand abstract');
}

function updateProgress() {
  const pct = papers.length > 0 ? (idx / papers.length * 100).toFixed(1) : 0;
  document.getElementById('pFill').style.width = pct + '%';
  document.getElementById('pText').textContent = `${idx} / ${papers.length}`;
}

function updateInfoBar() {
  if (!papers.length) return;
  document.getElementById('infoBar').classList.remove('hidden');
  const when = lastFetch
    ? new Date(lastFetch).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'now';
  document.getElementById('infoText').textContent = `${papers.length} papers · fetched ${when}`;
}

function showActRow(show) {
  ['actRow', 'progressRow'].forEach(id => document.getElementById(id).classList.toggle('hidden', !show));
}

function setFeedDot(state) {
  const dot    = document.getElementById('feedDot');
  const status = document.getElementById('feedStatus');
  dot.className = 'feed-dot' + (state === 'idle' ? ' idle' : '');
  if      (state === 'loading') status.textContent = 'Fetching feed…';
  else if (state === 'idle')    status.textContent = 'Feed up to date';
  else                          status.textContent = `${papers.length} papers ready`;
}

// ── DRAG ────────────────────────────────────────────────
const drag = { on: false, el: null, startX: 0, startY: 0, dx: 0 };

function setupDrag(card) {
  card.addEventListener('mousedown', dragStart, { passive: true });
  card.addEventListener('touchstart', dragStart, { passive: true });
}

function dragStart(e) {
  if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') return;
  drag.on = true; drag.el = e.currentTarget;
  const pt = e.touches ? e.touches[0] : e;
  drag.startX = pt.clientX; drag.startY = pt.clientY;
  drag.el.style.transition = 'none';
  document.addEventListener('mousemove', dragMove, { passive: true });
  document.addEventListener('mouseup',   dragEnd);
  document.addEventListener('touchmove', dragMove, { passive: true });
  document.addEventListener('touchend',  dragEnd);
}

function dragMove(e) {
  if (!drag.on || !drag.el) return;
  const pt = e.touches ? e.touches[0] : e;
  drag.dx  = pt.clientX - drag.startX;
  const dy = (pt.clientY - drag.startY) * 0.22;
  drag.el.style.transform = `translate(${drag.dx}px, ${dy}px) rotate(${drag.dx * 0.052}deg)`;
  const r = Math.min(Math.abs(drag.dx) / 100, 1);
  drag.el.querySelector('.ol-save').style.opacity = drag.dx > 0 ? r : 0;
  drag.el.querySelector('.ol-skip').style.opacity = drag.dx < 0 ? r : 0;
}

function dragEnd() {
  if (!drag.on || !drag.el) return;
  drag.on = false;
  document.removeEventListener('mousemove', dragMove);
  document.removeEventListener('mouseup',   dragEnd);
  document.removeEventListener('touchmove', dragMove);
  document.removeEventListener('touchend',  dragEnd);

  if      (drag.dx >  80) animSave(drag.el, 'must');
  else if (drag.dx < -80) animSkip(drag.el);
  else {
    drag.el.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)';
    drag.el.style.transform  = '';
    drag.el.querySelector('.ol-save').style.opacity = 0;
    drag.el.querySelector('.ol-skip').style.opacity = 0;
    setTimeout(() => { if (drag.el) drag.el.style.transition = ''; }, 320);
  }
  drag.dx = 0; drag.el = null;
}

function animSave(card, tier) {
  card = card || document.querySelector('.paper-card'); if (!card) return;
  card.classList.add('go-right');
  setTimeout(() => { commitSave(tier); renderCard(); }, 320);
}

function animSkip(card) {
  card = card || document.querySelector('.paper-card'); if (!card) return;
  card.classList.add('go-left');
  setTimeout(() => { commitSkip(); renderCard(); }, 320);
}

// ── ACTIONS ─────────────────────────────────────────────
function doSkip()  { animSkip(); }
function doMust()  { animSave(null, 'must'); }
function doMaybe() { animSave(null, 'maybe'); }

function commitSave(tier) {
  if (idx >= papers.length) return;
  const p = papers[idx];
  history.push({ action: 'save', idx, paper: p, tier });
  seenIds.add(p.id);
  if (!stack.find(s => s.id === p.id)) {
    stack.push({ ...p, tier, savedAt: Date.now() });
    updateStackUI();
    showToast(tier === 'must' ? '♥ Saved as must-read' : '☆ Saved as maybe');
  }
  idx++;
  persist();
}

function commitSkip() {
  if (idx >= papers.length) return;
  history.push({ action: 'skip', idx, paper: papers[idx] });
  seenIds.add(papers[idx].id);
  idx++;
  persist();
}

function undoLast() {
  if (!history.length) { showToast('Nothing to undo'); return; }
  const last = history.pop();
  idx = last.idx;
  seenIds.delete(last.paper.id);
  if (last.action === 'save') { stack = stack.filter(s => s.id !== last.paper.id); updateStackUI(); }
  persist(); renderCard(); showToast('Undone');
}

// ── DETAIL MODAL ─────────────────────────────────────────
function openDetail() {
  if (idx >= papers.length) return;
  detailPaper = papers[idx];
  populateDetailModal(detailPaper);
  document.getElementById('detailOverlay').classList.remove('hidden');
}

function populateDetailModal(p) {
  const sc = p.source === 'arxiv' ? 'bs-arxiv' : 'bs-semantic';
  const sl = p.source === 'arxiv' ? 'arXiv' : 'Semantic Scholar';
  document.getElementById('mSrc').innerHTML     = `<span class="badge-src ${sc}">${sl}</span>${p.venue ? ` <span class="badge-src bs-venue">${esc(p.venue)}</span>` : ''}`;
  document.getElementById('mTitle').textContent    = p.title;
  document.getElementById('mAuthors').textContent  = p.authors.join(', ');
  document.getElementById('mAbstract').textContent = p.abstract;
  document.getElementById('mLink').href            = p.url;
  document.getElementById('mBibtex').textContent   = makeBibtex(p);
}

function saveFromModal(tier) { commitSave(tier); closeOverlay('detailOverlay'); renderCard(); }
function skipFromModal()     { commitSkip();     closeOverlay('detailOverlay'); renderCard(); }

function copyBibtex() {
  if (!detailPaper) return;
  navigator.clipboard?.writeText(makeBibtex(detailPaper))
    .then(() => showToast('BibTeX copied'))
    .catch(() => showToast('Copy failed'));
}

// ── STACK UI ─────────────────────────────────────────────
function setTier(tier, el) {
  activeTier = tier;
  el.closest('.tier-row').querySelectorAll('.tier-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tier === tier)
  );
  renderStackItems(document.getElementById('slist'));
}

function setTierModal(tier, el) {
  el.closest('.tier-row').querySelectorAll('.tier-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tier === tier)
  );
  const prev = activeTier; activeTier = tier;
  renderStackItems(document.getElementById('mStackList'));
  activeTier = prev;
}

function updateStackUI() {
  const must  = stack.filter(p => p.tier === 'must').length;
  const maybe = stack.filter(p => p.tier === 'maybe').length;
  document.getElementById('hBadge').textContent   = stack.length;
  document.getElementById('tcAll').textContent    = stack.length;
  document.getElementById('tcMust').textContent   = must;
  document.getElementById('tcMaybe').textContent  = maybe;
  renderStackItems(document.getElementById('slist'));
}

function renderStackItems(container) {
  const items = activeTier === 'all' ? stack : stack.filter(p => p.tier === activeTier);
  if (!items.length) {
    container.innerHTML = '<div class="stack-empty">No papers here yet.</div>';
    return;
  }
  container.innerHTML = items.map(p => {
    const i  = stack.indexOf(p);
    const sc = p.source === 'arxiv' ? 'bs-arxiv' : 'bs-semantic';
    const tc = p.tier === 'must' ? 'var(--chri-sage)' : 'var(--muted)';
    return `
    <div class="sitem" onclick="openSaved(${i})">
      <div class="sitem-body">
        <div class="sitem-title">${esc(p.title)}</div>
        <div class="sitem-meta">
          <span class="badge-src ${sc}" style="font-size:0.62rem;padding:2px 6px">${p.source === 'arxiv' ? 'arXiv' : 'S2'}</span>
          ${p.year || ''} ${p.venue ? '· ' + esc(p.venue.slice(0, 20)) : ''}
          · <span style="color:${tc}">${p.tier === 'must' ? '♥' : '☆'}</span>
        </div>
      </div>
      <div class="sitem-acts">
        <button class="ibtn" onclick="event.stopPropagation();toggleTier(${i})" title="Toggle tier">⇅</button>
        <button class="ibtn del" onclick="event.stopPropagation();removeStack(${i})" title="Remove">✕</button>
      </div>
    </div>`;
  }).join('');
}

function openSaved(i) {
  detailPaper = stack[i];
  populateDetailModal(stack[i]);
  document.getElementById('detailOverlay').classList.remove('hidden');
}

function toggleTier(i) {
  if (!stack[i]) return;
  stack[i].tier = stack[i].tier === 'must' ? 'maybe' : 'must';
  updateStackUI(); persist();
  showToast(`Moved to ${stack[i].tier}`);
}

function removeStack(i) {
  stack.splice(i, 1); updateStackUI(); persist();
  showToast('Removed from stack');
}

function openStack() {
  document.getElementById('mtcAll').textContent   = stack.length;
  document.getElementById('mtcMust').textContent  = stack.filter(p => p.tier === 'must').length;
  document.getElementById('mtcMaybe').textContent = stack.filter(p => p.tier === 'maybe').length;
  const prev = activeTier; activeTier = 'all';
  renderStackItems(document.getElementById('mStackList'));
  activeTier = prev;
  document.getElementById('stackOverlay').classList.remove('hidden');
}

// ── SETTINGS ─────────────────────────────────────────────
function openSettings() {
  loadProfileUI();
  renderSyncUI();
  document.getElementById('settingsOverlay').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settingsOverlay').classList.add('hidden');
}

function settingsClickOut(e) {
  if (e.target === document.getElementById('settingsOverlay')) closeSettings();
}

function loadProfileUI() {
  tagLists.keyword  = [...profile.keywords];
  tagLists.category = [...profile.categories];
  tagLists.venue    = [...profile.venues];
  tagLists.author   = [...profile.authors];
  document.getElementById('limitInput').value  = profile.limit  || 40;
  document.getElementById('sourceInput').value = profile.source || 'both';
  document.getElementById('sortInput').value   = profile.sort   || 'recent';
  renderAllTags();
  updateCatGrid();
}

function renderAllTags() {
  const map = { keyword: 'kwTags', category: 'catTags', venue: 'venueTags', author: 'authorTags' };
  for (const [type, id] of Object.entries(map)) {
    document.getElementById(id).innerHTML = tagLists[type].map((v, i) =>
      `<span class="tag ${type}">${esc(v)}<button onclick="removeTag('${type}',${i})">✕</button></span>`
    ).join('');
  }
}

function addTag(type) {
  const inputMap = { keyword: 'kwInput', category: 'catInput', venue: 'venueInput', author: 'authorInput' };
  const inp = document.getElementById(inputMap[type]);
  inp.value.split(',').map(v => v.trim()).filter(Boolean)
    .forEach(v => { if (!tagLists[type].includes(v)) tagLists[type].push(v); });
  inp.value = '';
  renderAllTags();
  if (type === 'category') updateCatGrid();
}

function removeTag(type, i) {
  tagLists[type].splice(i, 1);
  renderAllTags();
  if (type === 'category') updateCatGrid();
}

function renderCatGrid() {
  document.getElementById('catGrid').innerHTML = ARXIV_CATS.map(c =>
    `<div class="cat-chip${profile.categories.includes(c.id) ? ' on' : ''}" data-cat="${c.id}" onclick="toggleCat('${c.id}',this)">${c.label}</div>`
  ).join('');
}

function updateCatGrid() {
  document.querySelectorAll('.cat-chip').forEach(el =>
    el.classList.toggle('on', tagLists.category.includes(el.dataset.cat))
  );
}

function toggleCat(id, el) {
  const i = tagLists.category.indexOf(id);
  i >= 0 ? tagLists.category.splice(i, 1) : tagLists.category.push(id);
  el.classList.toggle('on');
  renderAllTags();
}

function saveAndRefresh() {
  profile = {
    keywords:   [...tagLists.keyword],
    categories: [...tagLists.category],
    venues:     [...tagLists.venue],
    authors:    [...tagLists.author],
    limit:      parseInt(document.getElementById('limitInput').value) || 40,
    source:     document.getElementById('sourceInput').value,
    sort:       document.getElementById('sortInput').value,
  };
  lsSave('ps_profile', profile);
  closeSettings();
  gistPushDebounced(); // sync updated profile
  refreshFeed();
}

function clearSeen() {
  if (!confirm('Clear all seen-paper history? Previously swiped papers may reappear.')) return;
  seenIds = new Set();
  lsSave('ps_seen', []);
  gistPushDebounced();
  showToast('Seen history cleared');
}

function clearStack() {
  if (!confirm('Clear your entire reading stack? This cannot be undone.')) return;
  stack = []; updateStackUI(); persist();
  showToast('Stack cleared');
}

function bindSettingsEnterKeys() {
  [['kwInput','keyword'],['catInput','category'],['venueInput','venue'],['authorInput','author']].forEach(([id, type]) => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addTag(type); }
    });
  });
}

// ── BIBTEX ───────────────────────────────────────────────
function makeBibtex(p) {
  const key  = ((p.authors[0]?.split(' ').pop() || 'Author') + (p.year || '') + (p.title.split(' ')[0] || 'Paper')).replace(/[^a-zA-Z0-9]/g, '');
  const type = p.venue ? 'inproceedings' : 'misc';
  return [
    `@${type}{${key},`,
    `  title     = {${p.title}},`,
    `  author    = {${p.authors.join(' and ')}},`,
    p.year  ? `  year      = {${p.year}},`       : '',
    p.venue ? `  booktitle = {${p.venue}},`       : '',
    p.doi   ? `  doi       = {${p.doi}},`         : '',
    `  url       = {${p.url}},`,
    `  abstract  = {${p.abstract.slice(0, 300)}...},`,
    `}`,
  ].filter(Boolean).join('\n');
}

function exportBibtex() {
  if (!stack.length) { showToast('Stack is empty'); return; }
  download('reading-stack.bib', stack.map(makeBibtex).join('\n\n'), 'text/plain');
  showToast(`Exported ${stack.length} BibTeX entries`);
}

function exportJson() {
  if (!stack.length) { showToast('Stack is empty'); return; }
  download('reading-stack.json', JSON.stringify(stack, null, 2), 'application/json');
  showToast(`Exported ${stack.length} papers`);
}

// ── KEYBOARD ─────────────────────────────────────────────
function bindKeyboard() {
  document.addEventListener('keydown', e => {
    const tag = document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    const anyModal = ['detailOverlay','stackOverlay'].some(id => !document.getElementById(id).classList.contains('hidden'));
    if (anyModal) { if (e.key === 'Escape') { closeOverlay('detailOverlay'); closeOverlay('stackOverlay'); } return; }
    if (!document.getElementById('settingsOverlay').classList.contains('hidden')) {
      if (e.key === 'Escape') closeSettings(); return;
    }

    if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') doSkip();
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') doMust();
    if (e.key === 'm'          || e.key === 'M')                  doMaybe();
    if (e.key === ' ')  { e.preventDefault(); openDetail(); }
    if (e.key === 'u'  || e.key === 'U') undoLast();
    if (e.key === 'r'  || e.key === 'R') refreshFeed();
    if (e.key === 's'  || e.key === 'S') { e.preventDefault(); gistPush(); showToast('Saving to Gist…'); }
  });
}

// ── OVERLAYS ─────────────────────────────────────────────
function closeOverlay(id) {
  document.getElementById(id).classList.add('hidden');
}

// ── PERSIST ──────────────────────────────────────────────
// Writes to localStorage immediately. Debounce-pushes to Gist.
function persist() {
  lsSave('ps_seen',  [...seenIds]);
  lsSave('ps_stack', stack);
  gistPushDebounced();
}

// ── UTILS ────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('up');
  setTimeout(() => t.classList.remove('up'), 2300);
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function esc(s = '') {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function mkEl(tag, cls) {
  const el = document.createElement(tag); el.className = cls; return el;
}

function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; a.click();
}

function lsSave(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function lsLoad(k)    { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
