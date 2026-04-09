/* ═══════════════════════════════════════════════════════════
   PaperSwipe — app.js
   Feed-based academic paper triage tool
═══════════════════════════════════════════════════════════ */

// ── CONSTANTS ────────────────────────────────────────────
const ARXIV_CATS = [
  { id: 'cs.AI',        label: 'cs.AI' },
  { id: 'cs.LG',        label: 'cs.LG' },
  { id: 'cs.CL',        label: 'cs.CL' },
  { id: 'cs.CV',        label: 'cs.CV' },
  { id: 'cs.RO',        label: 'cs.RO' },
  { id: 'cs.HC',        label: 'cs.HC' },
  { id: 'cs.NE',        label: 'cs.NE' },
  { id: 'cs.IR',        label: 'cs.IR' },
  { id: 'stat.ML',      label: 'stat.ML' },
  { id: 'eess.AS',      label: 'eess.AS' },
  { id: 'q-bio.NC',     label: 'q-bio.NC' },
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

// ── STATE ────────────────────────────────────────────────
let profile    = lsLoad('ps_profile')    || DEFAULT_PROFILE;
let seenIds    = new Set(lsLoad('ps_seen') || []);
let stack      = lsLoad('ps_stack')      || [];
let lastFetch  = lsLoad('ps_lastFetch')  || null;

let allPapers  = [];   // raw fetched pool
let papers     = [];   // filtered queue
let idx        = 0;    // current card position
let history    = [];   // undo stack
let activeTier = 'all';
let activeSrc  = 'all';
let detailPaper = null;

// settings form mirror
const tagLists = { keyword: [], category: [], venue: [], author: [] };

// ── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderCatGrid();
  loadProfileUI();
  updateStackUI();
  bindSourceTabs();
  bindSettingsEnterKeys();
  bindKeyboard();

  const hasProfile = profile.keywords.length || profile.categories.length ||
                     profile.venues.length    || profile.authors.length;
  if (hasProfile) refreshFeed();
});

// ── FETCH ────────────────────────────────────────────────
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
    if (profile.source === 'arxiv' || profile.source === 'both') {
      results = results.concat(await fetchArxiv());
    }
    if (profile.source === 'semantic' || profile.source === 'both') {
      results = results.concat(await fetchSemantic());
    }

    // Deduplicate by title fingerprint
    const seen = new Map();
    results = results.filter(p => {
      const k = p.title.toLowerCase().replace(/\W/g, '').slice(0, 45);
      if (seen.has(k)) return false;
      seen.set(k, true);
      return true;
    });

    // Remove already-seen
    results = results.filter(p => !seenIds.has(p.id));

    if (profile.sort === 'recent') {
      results.sort((a, b) => (b.year || 0) - (a.year || 0));
    }

    results = results.slice(0, profile.limit);
    allPapers = results;
    applySourceFilter();
    updateSourceCounts();

    lastFetch = new Date().toISOString();
    lsSave('ps_lastFetch', lastFetch);

    if (papers.length === 0) {
      showEmpty('Feed is empty', 'No new papers since your last visit. Try widening your keywords or categories.');
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
  if (profile.keywords.length) {
    const kw = profile.keywords.map(k => `all:${encodeURIComponent(k)}`).join('+OR+');
    parts.push(`(${kw})`);
  }
  if (profile.categories.length) {
    const cats = profile.categories.map(c => `cat:${c}`).join('+OR+');
    parts.push(`(${cats})`);
  }
  if (profile.authors.length) {
    const aus = profile.authors.map(a => `au:${encodeURIComponent(a)}`).join('+OR+');
    parts.push(`(${aus})`);
  }
  if (!parts.length) return [];

  const q    = parts.join('+OR+');
  const sort = profile.sort === 'recent' ? 'submittedDate' : 'relevance';
  const url  = `https://export.arxiv.org/api/query?search_query=${q}&sortBy=${sort}&sortOrder=descending&start=0&max_results=${Math.min(profile.limit, 100)}`;

  try {
    const resp = await fetch(url);
    const text = await resp.text();
    return parseArxivXML(text);
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
    const matchedBy = whyMatched({ title, abstract, authors, categories: cats, venue: cats[0] || '' });
    return { id, title, abstract, published, year, authors, categories: cats, venue: cats[0] || '', url: id, source: 'arxiv', citeCount: null, doi: '', matchedBy };
  }).filter(p => p.title && p.abstract);
}

async function fetchSemantic() {
  if (!profile.keywords.length && !profile.authors.length) return [];
  const queries = [...profile.keywords.slice(0, 3), ...(profile.authors.length ? [profile.authors[0]] : [])];
  const fields  = 'title,abstract,authors,year,venue,externalIds,citationCount,openAccessPdf,publicationDate';
  let all = [];

  for (const q of queries) {
    try {
      const url  = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=20&fields=${fields}`;
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const data = await resp.json();
      const mapped = (data.data || []).map(p => {
        const doi     = p.externalIds?.DOI || '';
        const arxivId = p.externalIds?.ArXiv || '';
        const pdfUrl  = p.openAccessPdf?.url
                      || (arxivId ? `https://arxiv.org/abs/${arxivId}` : '')
                      || (doi    ? `https://doi.org/${doi}` : '');
        const authors   = (p.authors || []).map(a => a.name);
        const matchedBy = whyMatched({ title: p.title || '', abstract: p.abstract || '', authors, categories: [], venue: p.venue || '' });
        return {
          id: p.paperId || '',
          title: p.title || '',
          abstract: p.abstract || '',
          published: p.publicationDate || (p.year ? `${p.year}-01-01` : ''),
          year: p.year || null,
          authors,
          categories: [],
          venue: p.venue || '',
          url: pdfUrl || `https://www.semanticscholar.org/paper/${p.paperId}`,
          doi, source: 'semantic', citeCount: p.citationCount || null, matchedBy,
        };
      }).filter(p => p.title && p.abstract);
      all = all.concat(mapped);
    } catch (e) { console.warn('S2 query failed', e); }
  }
  return all;
}

function whyMatched(p) {
  for (const kw of profile.keywords) {
    if ((p.title + ' ' + p.abstract).toLowerCase().includes(kw.toLowerCase()))
      return { type: 'keyword', value: kw };
  }
  for (const cat of profile.categories) {
    if ((p.categories || []).some(c => c.toLowerCase().includes(cat.toLowerCase())))
      return { type: 'category', value: cat };
  }
  for (const v of profile.venues) {
    if ((p.venue || '').toLowerCase().includes(v.toLowerCase()))
      return { type: 'venue', value: v };
  }
  for (const au of profile.authors) {
    if ((p.authors || []).some(a => a.toLowerCase().includes(au.toLowerCase())))
      return { type: 'author', value: au };
  }
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
  document.getElementById('cntAll').textContent     = allPapers.length;
  document.getElementById('cntArxiv').textContent   = allPapers.filter(p => p.source === 'arxiv').length;
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
  const srcCls  = p.source === 'arxiv' ? 'bs-arxiv' : 'bs-semantic';
  const srcLbl  = p.source === 'arxiv' ? 'arXiv' : 'S2';
  const yearTag = p.year  ? `<span class="badge-src bs-year">${p.year}</span>` : '';
  const venueTag = p.venue ? `<span class="badge-src bs-venue">${esc(p.venue.slice(0, 30))}</span>` : '';
  const catTags  = p.categories.slice(0, 2).map(c => `<span class="badge-src bs-cat">${esc(c)}</span>`).join('');
  const newTag   = isNew(p) ? `<span class="badge-src bs-new">new</span>` : '';
  const authLine = p.authors.slice(0, 4).join(', ') + (p.authors.length > 4 ? ' et al.' : '');
  const matchTag = p.matchedBy
    ? `<span class="card-match">via ${esc(p.matchedBy.value)}</span>`
    : '';
  const citeTag  = p.citeCount ? `<span class="badge-src bs-venue">${p.citeCount} citations</span>` : '';

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
    <div class="card-abstract collapsed" id="cabstract">${esc(p.abstract)}</div>
    <button class="expand-hint" onclick="toggleAbs(this)">▾ expand abstract</button>
    <div class="card-footer">
      ${matchTag}
      <a class="card-link" href="${esc(p.url)}" target="_blank" onclick="event.stopPropagation()">open ↗</a>
    </div>
  `;
  return card;
}

function isNew(p) {
  if (!lastFetch || !p.published) return false;
  return new Date(p.published) > new Date(lastFetch);
}

function toggleAbs(btn) {
  const ab = btn.previousElementSibling;
  if (ab.classList.contains('collapsed')) {
    ab.classList.replace('collapsed', 'expanded');
    btn.textContent = '▴ collapse';
  } else {
    ab.classList.replace('expanded', 'collapsed');
    btn.textContent = '▾ expand abstract';
  }
}

function updateProgress() {
  const pct = papers.length > 0 ? (idx / papers.length * 100).toFixed(1) : 0;
  document.getElementById('pFill').style.width = pct + '%';
  document.getElementById('pText').textContent = `${idx} / ${papers.length}`;
}

function updateInfoBar() {
  if (!papers.length) return;
  const bar = document.getElementById('infoBar');
  bar.classList.remove('hidden');
  const when = lastFetch
    ? new Date(lastFetch).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'now';
  document.getElementById('infoText').textContent = `${papers.length} papers · fetched ${when}`;
}

function showActRow(show) {
  ['actRow', 'progressRow'].forEach(id => {
    document.getElementById(id).classList.toggle('hidden', !show);
  });
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
  const pt  = e.touches ? e.touches[0] : e;
  drag.dx   = pt.clientX - drag.startX;
  const dy  = (pt.clientY - drag.startY) * 0.22;
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

  if      (drag.dx > 80)  animSave(drag.el, 'must');
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
  const sl = p.source === 'arxiv' ? 'arXiv'    : 'Semantic Scholar';
  document.getElementById('mSrc').innerHTML = `<span class="badge-src ${sc}">${sl}</span>${p.venue ? ` <span class="badge-src bs-venue">${esc(p.venue)}</span>` : ''}`;
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
    .then(()  => showToast('BibTeX copied'))
    .catch(()  => showToast('Copy failed'));
}

// ── STACK UI ─────────────────────────────────────────────
function setTier(tier, el) {
  activeTier = tier;
  el.closest('.tier-row').querySelectorAll('.tier-tab').forEach(t => t.classList.toggle('active', t.dataset.tier === tier));
  renderStackItems(document.getElementById('slist'));
}

function setTierModal(tier, el) {
  el.closest('.tier-row').querySelectorAll('.tier-tab').forEach(t => t.classList.toggle('active', t.dataset.tier === tier));
  const tmp = activeTier; activeTier = tier;
  renderStackItems(document.getElementById('mStackList'));
  activeTier = tmp; // restore for sidebar
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
    const tierIcon = p.tier === 'must' ? '♥' : '☆';
    const tierColor = p.tier === 'must' ? 'var(--chri-sage)' : 'var(--muted)';
    return `
    <div class="sitem" onclick="openSaved(${i})">
      <div class="sitem-body">
        <div class="sitem-title">${esc(p.title)}</div>
        <div class="sitem-meta">
          <span class="badge-src ${sc}" style="font-size:0.62rem;padding:2px 6px">${p.source === 'arxiv' ? 'arXiv' : 'S2'}</span>
          ${p.year || ''}
          ${p.venue ? '· ' + esc(p.venue.slice(0, 20)) : ''}
          · <span style="color:${tierColor}">${tierIcon}</span>
        </div>
      </div>
      <div class="sitem-acts">
        <button class="ibtn" onclick="event.stopPropagation(); toggleTier(${i})" title="Toggle tier">⇅</button>
        <button class="ibtn del" onclick="event.stopPropagation(); removeStack(${i})" title="Remove">✕</button>
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
  const tmp = activeTier; activeTier = 'all';
  renderStackItems(document.getElementById('mStackList'));
  activeTier = tmp;
  document.getElementById('stackOverlay').classList.remove('hidden');
}

// ── SETTINGS ─────────────────────────────────────────────
function openSettings() {
  loadProfileUI();
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
  const inp  = document.getElementById(inputMap[type]);
  const vals = inp.value.split(',').map(v => v.trim()).filter(Boolean);
  vals.forEach(v => { if (!tagLists[type].includes(v)) tagLists[type].push(v); });
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
  if (i >= 0) tagLists.category.splice(i, 1);
  else tagLists.category.push(id);
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
  refreshFeed();
}

function clearSeen() {
  if (!confirm('Clear all seen-paper history? Previously swiped papers may reappear.')) return;
  seenIds = new Set();
  lsSave('ps_seen', []);
  showToast('Seen history cleared');
}

function clearStack() {
  if (!confirm('Clear your entire reading stack? This cannot be undone.')) return;
  stack = []; updateStackUI(); persist();
  showToast('Stack cleared');
}

function bindSettingsEnterKeys() {
  const pairs = [
    ['kwInput', 'keyword'], ['catInput', 'category'],
    ['venueInput', 'venue'], ['authorInput', 'author'],
  ];
  pairs.forEach(([id, type]) => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addTag(type); }
    });
  });
}

// ── BIBTEX ───────────────────────────────────────────────
function makeBibtex(p) {
  const lastName = p.authors[0]?.split(' ').pop() || 'Author';
  const word0    = p.title.split(' ')[0] || 'Paper';
  const key      = (lastName + (p.year || '') + word0).replace(/[^a-zA-Z0-9]/g, '');
  const type     = p.venue ? 'inproceedings' : 'misc';
  const lines = [
    `@${type}{${key},`,
    `  title     = {${p.title}},`,
    `  author    = {${p.authors.join(' and ')}},`,
    p.year   ? `  year      = {${p.year}},`       : '',
    p.venue  ? `  booktitle = {${p.venue}},`       : '',
    p.doi    ? `  doi       = {${p.doi}},`         : '',
    `  url       = {${p.url}},`,
    `  abstract  = {${p.abstract.slice(0, 300)}...},`,
    `}`,
  ].filter(Boolean);
  return lines.join('\n');
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

    const anyModal = ['detailOverlay', 'stackOverlay']
      .some(id => !document.getElementById(id).classList.contains('hidden'));
    if (anyModal) {
      if (e.key === 'Escape') {
        closeOverlay('detailOverlay');
        closeOverlay('stackOverlay');
      }
      return;
    }
    if (!document.getElementById('settingsOverlay').classList.contains('hidden')) {
      if (e.key === 'Escape') closeSettings();
      return;
    }

    if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') doSkip();
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') doMust();
    if (e.key === 'm'          || e.key === 'M')                  doMaybe();
    if (e.key === ' ')  { e.preventDefault(); openDetail(); }
    if (e.key === 'u'  || e.key === 'U') undoLast();
    if (e.key === 'r'  || e.key === 'R') refreshFeed();
  });
}

// ── OVERLAYS ─────────────────────────────────────────────
function closeOverlay(id) {
  document.getElementById(id).classList.add('hidden');
}

// ── UTILS ────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('up');
  setTimeout(() => t.classList.remove('up'), 2300);
}

function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mkEl(tag, cls) {
  const el = document.createElement(tag);
  el.className = cls;
  return el;
}

function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
}

function persist() {
  lsSave('ps_seen',  [...seenIds]);
  lsSave('ps_stack', stack);
}

function lsSave(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* quota */ }
}

function lsLoad(k) {
  try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; }
}
