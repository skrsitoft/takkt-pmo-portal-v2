console.log(window.supabase);

const supabaseUrl =
  'https://xxsbgzbkzpkbgmaibxwp.supabase.co';

const supabaseKey =
  'sb_publishable_h_hO-uJf4YbbXJ4ziAeyKQ_FrXQbK7_';

const supabaseClient =
  window.supabase.createClient(
    supabaseUrl,
    supabaseKey
  );

console.log('Supabase connected');

// ═══════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════
let projects = {};   // { id: { setup:{}, weekly:{} } }
let activeId  = null;
let milestones = []; // shared milestone store for active project
let nextMsId  = 1;
let currentTab = 'setup';

// ═══════════════════════════════════════════════════
// STORAGE  (window.storage API)
// ═══════════════════════════════════════════════════
async function storeSave(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
}

async function storeGet(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}

async function storeDel(key) {
    localStorage.removeItem(key);
}

async function storeList(prefix) {
    const keys = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        if (key.startsWith(prefix)) {
            keys.push(key);
        }
    }

    return keys;
}
  async function testConnection() {

    const { data, error } =
        await supabaseClient
            .from('projects')
            .select('*');

    console.log(data);
    console.log(error);

    alert('Connection OK');
}

// ═══════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════
function showDashboard() {
  // deselect active project in sidebar
  document.querySelectorAll('.proj-item').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-dashboard').classList.add('active');

  // hide project-specific topbar elements
  document.getElementById('tabBar').style.display = 'none';
  document.getElementById('btnExport').style.display = 'none';
  document.getElementById('btnDelete').style.display = 'none';
  document.getElementById('topbarName').textContent = 'Portfolio Dashboard';
  document.getElementById('topbarArea').style.display = 'none';

  buildDashboard();
  showPane('dashboard');
}

function buildDashboard() {
  const list = Object.values(projects).sort((a,b) => {
    const areaOrder = ['Efficiency','IT Infrastructure','Application','Employee Experience','OFD Priorities'];
    const ai = areaOrder.indexOf(a.setup?.area||''); const bi = areaOrder.indexOf(b.setup?.area||'');
    if (ai !== bi) return (ai===-1?99:ai) - (bi===-1?99:bi);
    return (a.setup?.name||'').localeCompare(b.setup?.name||'');
  });

  // meta line
  const redCount = list.filter(p => p.weekly?.health?.overall === 'red').length;
  document.getElementById('db-meta').textContent =
    `${list.length} project${list.length!==1?'s':''} total${redCount ? ` · ${redCount} in red status` : ''}`;

  const tbody = document.getElementById('db-tbody');
  tbody.innerHTML = '';

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="db-empty">No projects yet. Create your first project from the sidebar.</td></tr>';
    return;
  }

  let lastArea = null;
  list.forEach(p => {
    const s = p.setup || {};
    const w = p.weekly || {};
    const h = w.health || {};
    const isFirstInArea = s.area !== lastArea;
    lastArea = s.area;

    const tr = document.createElement('tr');
    if (isFirstInArea) tr.classList.add('area-first');
    tr.onclick = () => showOnePager(p.id);

    const dot = v => `<td class="sd"><div class="status-dot ${v||'empty'}"></div></td>`;
    const updates = (w.keyUpdates||[]).filter(Boolean);
    const updatesHtml = updates.length
      ? `<ul class="db-updates">${updates.slice(0,3).map(u=>`<li>${esc(u)}</li>`).join('')}${updates.length>3?`<li style="color:var(--grey-mid)">+${updates.length-3} more</li>`:''}</ul>`
      : `<span style="color:#ccc;font-size:11px;">—</span>`;

    const mitigations = (w.risks||[]).filter(r => r.mitigation);
    const mitigationsHtml = mitigations.length
      ? `<ul class="db-updates">${mitigations.slice(0,3).map(r=>`<li><span style="font-weight:600;color:${r.priority==='High'?'var(--red)':r.priority==='Medium'?'var(--yellow)':'var(--green)'}">${esc(r.priority||'')}</span> – ${esc(r.mitigation)}</li>`).join('')}${mitigations.length>3?`<li style="color:var(--grey-mid)">+${mitigations.length-3} more</li>`:''}</ul>`
      : `<span style="color:#ccc;font-size:11px;">—</span>`;

    tr.innerHTML = `
      <td><div class="db-area-badge">${esc(s.area||'—')}</div></td>
      <td>
        <div class="db-proj-name">${esc(s.name||'Unnamed')}</div>
        <div class="db-proj-desc">${esc(s.shortDesc||'')}</div>
      </td>
      <td class="db-pm">${esc(s.pm||'—')}<br><span style="color:var(--grey-mid)">${esc(s.itlt||'')}</span></td>
      ${dot(h.overall)}${dot(h.scope)}${dot(h.schedule)}${dot(h.risk)}${dot(h.quality)}${dot(h.budget)}
      <td>${updatesHtml}</td>
      <td>${mitigationsHtml}</td>
      <td class="sd" id="del-cell-${p.id}"></td>`;
    tbody.appendChild(tr);

    // wire delete button via JS (not inline) so stopPropagation works
    const delTd = document.getElementById('del-cell-' + p.id);
    const delBtn = document.createElement('button');
    delBtn.className = 'db-del-btn';
    delBtn.title = 'Delete project';
    delBtn.innerHTML = '🗑';
    delBtn.addEventListener('click', e => { e.stopPropagation(); confirmDelete(p.id); });
    delTd.appendChild(delBtn);
  });
}

// ═══════════════════════════════════════════════════
// ONE PAGER MODAL
// ═══════════════════════════════════════════════════
function showOnePager(id) {
  const p = projects[id];
  if (!p) return;
  const s = p.setup || {};
  const w = p.weekly || {};
  const h = w.health || {};
  const b = w.budget || {};

  // remove existing
  const ex = document.getElementById('opModal');
  if (ex) ex.remove();

  
  // ── helpers ──
  const statusLabel = v => ({ green:'On Track', yellow:'At Risk', red:'Off Track', grey:'N/A' }[v] || '—');
  const healthRow = (label, val, note) => `
    <tr>
      <td>${label}</td>
      <td><span class="op-health-badge ${val||'grey'}">${statusLabel(val)}</span>${note ? `<span class="op-health-note">${esc(note)}</span>` : ''}</td>
    </tr>`;

  const kpiColor = v => { const n = parseFloat(v); if (isNaN(n)) return ''; return n >= 1 ? 'green' : 'red'; };

  // ── scope lines ──
  const scopeLines = (s.scope||'').split('\n').filter(Boolean).map(l =>
    `<div class="op-scope-line">${esc(l.replace(/^[•\-]\s*/,''))}</div>`).join('');

  // ── key updates ──
  const bullets = (w.keyUpdates||[]).filter(Boolean).map(u =>
    `<div class="op-bullet">${esc(u)}</div>`).join('') || '<span style="color:#ccc">No updates this week.</span>';

  // ── milestones ──
  const msRows = (w.milestones||[]).filter(m => m.name).map(m => {
    const pct = m.complete ? parseInt(m.complete) : null;
    const pctColor = pct === null ? '' : pct >= 100 ? 'color:var(--green)' : pct >= 70 ? 'color:var(--yellow)' : 'color:var(--red)';
    const statusDot = m.status ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${m.status==='green'?'var(--green)':m.status==='yellow'?'#EAB308':m.status==='red'?'var(--red)':'#ccc'};margin-right:4px;"></span>` : '';
    return `<tr>
      <td>${esc(m.name)}</td>
      <td style="white-space:nowrap">${esc(m.dueDateOrig||'—')}</td>
      <td style="white-space:nowrap">${esc(m.dueDateLatest||'—')}</td>
      <td class="op-ms-pct" style="${pctColor}">${pct !== null ? pct+'%' : '—'}</td>
      <td>${statusDot}${statusLabel(m.status)}</td>
      <td>${m.done==='yes' ? '✓' : ''}</td>
    </tr>`;
  }).join('');



  // ── risks ──
  const riskRows = (w.risks||[]).filter(r => r.description).map(r => `
    <tr>
      <td><span class="pri-badge ${r.priority||''}">${esc(r.type||'R')} · ${esc(r.priority||'')}</span></td>
      <td>${esc(r.description||'')}</td>
      <td>${esc(r.owner||'—')}</td>
      <td>${esc(r.mitigation||'—')}</td>
      <td style="white-space:nowrap">${esc(r.dueDate||'—')}</td>
    </tr>`).join('');

  // ── snapshot history ──
  const snapshots = (p.snapshots || []);
  const snapIcon = v => ({ green:'🟢', yellow:'🟡', red:'🔴', grey:'⚪' }[v] || '⚪');
  const historyHtml = snapshots.length ? `
    <div style="padding:0 20px 20px;">
      <div class="op-card">
        <div class="op-card-header"><h3>📅 Status History</h3></div>
        <div class="op-card-body" style="padding:0;overflow-x:auto;">
          <table class="op-ms-table">
            <thead><tr><th>Week of</th><th>Overall</th><th>Scope</th><th>Schedule</th><th>Risk</th><th>Quality</th><th>Progress</th><th>Note</th></tr></thead>
            <tbody>
              ${snapshots.map(s => `<tr>
                <td style="white-space:nowrap;font-weight:600">
                <a href="#"
                onclick="showSnapshot('${p.id}','${s.date}')">
                ${esc(s.date || '—')}
              </a>
            </td>
                <td>${snapIcon(s.overall)} ${statusLabel(s.overall)}</td>
                <td>${snapIcon(s.scope)} ${statusLabel(s.scope)}</td>
                <td>${snapIcon(s.schedule)} ${statusLabel(s.schedule)}</td>
                <td>${snapIcon(s.risk)} ${statusLabel(s.risk)}</td>
                <td>${snapIcon(s.quality)} ${statusLabel(s.quality)}</td>
                <td>${s.progress ? s.progress+'%' : '—'}</td>
                <td style="color:var(--grey-mid)">${esc(s.note||'')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>` : '';

  const overlay = document.createElement('div');
  overlay.className = 'op-overlay';
  overlay.id = 'opModal';
  overlay.innerHTML = `
    <div class="op-modal">

      <!-- top bar -->
      <div class="op-topbar">
        <div>
          <div class="op-title">${esc(s.name||'Unnamed Project')}</div>
          <div class="op-update-date">Latest Update: ${esc(w.date || 'N/A')}</div>
          <div class="op-meta">${esc(s.area||'')}${s.pm ? ' · PM: '+esc(s.pm) : ''}${s.owner ? ' · Owner: '+esc(s.owner) : ''}${s.sponsor ? ' · Sponsor: '+esc(s.sponsor) : ''}</div>
        </div>
        <button class="op-close" id="opClose">✕</button>
      </div>

      <!-- row 1: scope + health -->
      <div class="op-body">

        <div class="op-card">
          <div class="op-card-header"><h3>🎯 Scope & Objectives</h3></div>
          <div class="op-card-body">${scopeLines || '<span style="color:#ccc">No scope defined.</span>'}</div>
        </div>

        <div class="op-card">
          <div class="op-card-header"><h3>🏥 Project Health</h3></div>
          <div class="op-card-body" style="padding:0;">
            <table class="op-health-table">
              ${healthRow('Overall',  h.overall,  h.overallNote)}
              ${healthRow('Scope',    h.scope,    h.scopeNote)}
              ${healthRow('Schedule', h.schedule, h.scheduleNote)}
              ${healthRow('Risk',     h.risk,     h.riskNote)}
              ${healthRow('Quality',  h.quality,  h.qualityNote)}
            </table>
            ${(b.progress || b.budgetKEUR || b.spendToDate) ? `
            <div style="padding:12px 14px;border-top:1px solid var(--grey-light);">
              <div style="font-size:10px;font-weight:700;color:var(--grey-mid);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;">Budget</div>
              <div class="op-budget-grid">
                ${b.progress    ? `<div class="op-kpi"><span class="op-kpi-label">Progress</span><span class="op-kpi-val">${esc(b.progress)}%</span></div>` : ''}
                ${b.budgetKEUR  ? `<div class="op-kpi"><span class="op-kpi-label">Budget (kEUR)</span><span class="op-kpi-val">${esc(b.budgetKEUR)}</span></div>` : ''}
                ${b.spendToDate ? `<div class="op-kpi"><span class="op-kpi-label">Spend to Date</span><span class="op-kpi-val">${esc(b.spendToDate)}</span></div>` : ''}
                ${b.spendForecast ? `<div class="op-kpi"><span class="op-kpi-label">Forecast</span><span class="op-kpi-val">${esc(b.spendForecast)}</span></div>` : ''}
                ${b.cpiBudget   ? `<div class="op-kpi"><span class="op-kpi-label">CPI (Budget)</span><span class="op-kpi-val ${kpiColor(b.cpiBudget)}">${esc(b.cpiBudget)}</span></div>` : ''}
                ${b.cpiForecast ? `<div class="op-kpi"><span class="op-kpi-label">CPI (Forecast)</span><span class="op-kpi-val ${kpiColor(b.cpiForecast)}">${esc(b.cpiForecast)}</span></div>` : ''}
              </div>
            </div>` : ''}
          </div>
        </div>

        <!-- row 2: key updates -->
        <div class="op-card">
          <div class="op-card-header"><h3>📢 Key Updates</h3></div>
          <div class="op-card-body">${bullets}</div>
        </div>

        <!-- row 3: milestones (full width) -->
        <div class="op-card">
          <div class="op-card-header"><h3>🏁 Key Milestones</h3></div>
          <div class="op-card-body" style="padding:0;overflow-x:auto;">
            ${msRows ? `<table class="op-ms-table">
              <thead><tr><th>Name</th><th>Due (orig.)</th><th>Due (latest)</th><th>%</th><th>Status</th><th>Done</th></tr></thead>
              <tbody>${msRows}</tbody>
            </table>` : '<div style="padding:14px;color:#ccc;font-size:13px;">No milestones defined.</div>'}
          </div>
        </div>

      </div>

      <!-- risks full width -->
      <div style="padding:0 20px 20px;">
        <div class="op-card">
          <div class="op-card-header"><h3>⚠️ Risks & Issues</h3></div>
          <div class="op-card-body" style="padding:0;overflow-x:auto;">
            ${riskRows ? `<table class="op-risk-table">
              <thead><tr><th>Priority</th><th>Description</th><th>Owner</th><th>Mitigation</th><th>Due Date</th></tr></thead>
              <tbody>${riskRows}</tbody>
            </table>` : '<div style="padding:14px;color:#ccc;font-size:13px;">No risks defined.</div>'}
          </div>
        </div>
      </div>

      ${historyHtml}

      <!-- footer -->
      <div class="op-footer">
        <span class="op-footer-date">Week of: ${esc(w.date||'—')} · Generated: ${new Date().toLocaleDateString()}</span>
        <div style="display:flex;gap:8px;">
          <button class="btn-ghost" id="opEdit">✏️ Edit project</button>
          <button class="btn-ghost" id="opCloseBtn">Close</button>
        </div>
      </div>

    </div>`;

  document.body.appendChild(overlay);

  document.getElementById('opClose').addEventListener('click', () => overlay.remove());
  document.getElementById('opCloseBtn').addEventListener('click', () => overlay.remove());
  document.getElementById('opEdit').addEventListener('click', () => { overlay.remove(); loadProject(id); });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ═══════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  console.log("INIT START");
  document.getElementById('btnDelete').addEventListener('click', () => {
    if (activeId) confirmDelete(activeId);
  });
  showLoading(true);
  try {

  const { data, error } =
    await supabaseClient
      .from('projects')
      .select('*');

  if (error) {
    console.error(error);
  } else {
    console.log("DATA FROM DB");
    console.log(data);

    projects = {};

    data.forEach(row => {

      projects[row.id] = {

        id: row.id,

        setup: {
          name: row.name || '',
          area: row.area || '',
          pm: row.pm || '',
          owner: row.owner || '',
          sponsor: row.sponsor || '',
          itlt: row.itlt || '',
          shortDesc: row.short_desc || '',
          scope: row.scope || ''
        },
          weekly: row.weekly_data || {},

          milestones:
            row.milestones || [],

          snapshots:
            row.snapshots || []


      };

    });
    console.log("PROJECTS AFTER BUILD");
    console.log(projects);

  }

} catch(e) {
  console.error(e);
}
console.log("PROJECTS:");
console.log(projects);
  renderSidebar();
  showLoading(false);
  document.getElementById('w_date').value = new Date().toISOString().split('T')[0];
  // auto-open dashboard if projects exist
  if (Object.keys(projects).length > 0) showDashboard();
});

// ═══════════════════════════════════════════════════
// LOADING
// ═══════════════════════════════════════════════════
function showLoading(v) {
  let el = document.getElementById('loadingOverlay');
  if (v && !el) {
    el = document.createElement('div');
    el.id = 'loadingOverlay';
    el.className = 'loading';
    el.innerHTML = '<div class="loading-box"><div class="spinner"></div><p>Loading projects...</p></div>';
    document.body.appendChild(el);
  } else if (!v && el) el.remove();
}

// ═══════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════
function renderSidebar() {
  const c = document.getElementById('sidebarProjects');
  c.innerHTML = '';
  const list = Object.values(projects).sort((a,b) => (a.setup?.name||'').localeCompare(b.setup?.name||''));
  if (!list.length) {
    c.innerHTML = '<div style="padding:10px 20px;font-size:12px;color:#444;">No projects yet.</div>';
    return;
  }
  list.forEach(p => {
    const overall = p.weekly?.health?.overall || 'grey';
    const div = document.createElement('div');
    div.className = 'proj-item' + (p.id === activeId ? ' active' : '');
    div.onclick = () => loadProject(p.id);
    const delBtn = document.createElement('button');
    delBtn.className = 'proj-del';
    delBtn.title = 'Delete project';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      confirmDelete(p.id);
    });
    div.innerHTML = `<div class="proj-dot ${overall}"></div><div class="proj-name">${esc(p.setup?.name || 'Unnamed')}</div>`;
    div.appendChild(delBtn);
    c.appendChild(div);
  });
}

// ═══════════════════════════════════════════════════
// PROJECT CRUD
// ═══════════════════════════════════════════════════
function newProject() {
  const id = 'p_' + Date.now();
  projects[id] = { id, setup: { name:'', area:'', pm:'', owner:'', sponsor:'', itlt:'', shortDesc:'', scope:'' }, weekly: {}, milestones: [] };
  activeId = id;
  renderSidebar();
  openProject(id);
}

async function loadProject(id) {
  // save current before switching
  if (activeId && activeId !== id) await autoSave();
  activeId = id;
  renderSidebar();
  openProject(id);
}

function openProject(id) {
  const p = projects[id];
  if (!p) return;

  // deactivate dashboard nav
  document.getElementById('nav-dashboard').classList.remove('active');

  // show UI
  document.getElementById('tabBar').style.display = 'flex';
  document.getElementById('btnExport').style.display = 'inline-flex';
  document.getElementById('btnDelete').style.display = 'inline-flex';
  document.getElementById('topbarName').textContent = p.setup?.name || 'New Project';
  const areaEl = document.getElementById('topbarArea');
  if (p.setup?.area) { areaEl.textContent = p.setup.area; areaEl.style.display = 'inline-block'; }
  else areaEl.style.display = 'none';

  // load milestones
  milestones = (p.milestones || []).map(m => ({...m}));
  nextMsId = milestones.length ? Math.max(...milestones.map(m=>m.id)) + 1 : 1;

  // populate setup fields
  const s = p.setup || {};
  setVal('s_name', s.name); setVal('s_area', s.area); setVal('s_pm', s.pm);
  setVal('s_owner', s.owner); setVal('s_sponsor', s.sponsor);
  setVal('s_itlt', s.itlt); setVal('s_shortdesc', s.shortDesc); setVal('s_scope', s.scope);

  // populate weekly fields
  const w = p.weekly || {};
  setVal('w_date', w.date || new Date().toISOString().split('T')[0]);
  setVal('w_note', w.health?.overallNote || w.statusNote);
  setVal('w_overall', w.health?.overall); csById('w_overall');
  setVal('w_scope',   w.health?.scope);   csById('w_scope');   setVal('w_scope_note', w.health?.scopeNote);
  setVal('w_sched',   w.health?.schedule);csById('w_sched');   setVal('w_sched_note', w.health?.scheduleNote);
  setVal('w_risk',    w.health?.risk);    csById('w_risk');    setVal('w_risk_note',  w.health?.riskNote);
  setVal('w_qual',    w.health?.quality); csById('w_qual');    setVal('w_qual_note',  w.health?.qualityNote);
  setVal('w_prog',      w.budget?.progress);
  setVal('w_budg_val',  w.budget?.budgetKEUR);
  setVal('w_spend',     w.budget?.spendToDate);
  setVal('w_fcast',     w.budget?.spendForecast);
  setVal('w_cpi_budget',w.budget?.cpiBudget);
  setVal('w_cpi_fcast', w.budget?.cpiForecast);

  // bullets
  const bc = document.getElementById('w_bullets');
  bc.innerHTML = '';
  (w.keyUpdates || ['']).forEach(v => addBullet(v));

  // risks
  const rc = document.getElementById('w_risks');
  rc.innerHTML = '';
  (w.risks || [{}]).forEach(r => addRisk(r));

  // render milestones in weekly pane only
  renderWeeklyMs();

  switchTab(currentTab, false);
  showPane('setup'); // always open setup first when loading a new project
  switchTab('setup', false);
}

// ═══════════════════════════════════════════════════
// AUTO SAVE
// ═══════════════════════════════════════════════════
async function autoSave() {
  if (!activeId) return;
  readActiveMilestones();
  const p = projects[activeId];
  p.setup = readSetup();
  p.milestones = milestones.map(m => ({...m}));
  await storeSave('proj:' + activeId, p);
}

// ═══════════════════════════════════════════════════
// SAVE SETUP
// ═══════════════════════════════════════════════════
console.log("SAVE SETUP");
console.log("ACTIVE ID:", activeId);
console.log("IS NEW:", activeId.startsWith('p_'));
async function saveSetup() {

  if (!activeId) return;
  console.log("UPDATE PROJECT");
  const p = projects[activeId];

  p.setup = readSetup();
  p.milestones = milestones.map(m => ({ ...m }));

  const project = {
    name: p.setup.name,
    area: p.setup.area,
    pm: p.setup.pm,
    owner: p.setup.owner,
    sponsor: p.setup.sponsor,
    itlt: p.setup.itlt,
    short_desc: p.setup.shortDesc,
    scope: p.setup.scope
  };

  let error;
console.log("ACTIVE ID:", activeId);
console.log("IS NEW:", activeId.startsWith('p_'));
if (!activeId.startsWith('p_')) {

  ({ error } = await supabaseClient
    .from('projects')
    .update(project)
    .eq('id', activeId));

} else {
  console.log("INSERT PROJECT");
  const result = await supabaseClient
    .from('projects')
    .insert([project])
    .select()
    .single();

  error = result.error;

  if (!error) {

    delete projects[activeId];

    activeId = result.data.id;

    projects[activeId] = {
      id: result.data.id,
      setup: p.setup,
      weekly: p.weekly || {},
      milestones: p.milestones || []
    };
  }
}

if (error) {
  console.error(error);
  showToast('❌ ' + error.message);
  return;
}

  document.getElementById('topbarName').textContent =
      p.setup.name || 'New Project';

  const aEl = document.getElementById('topbarArea');

  if (p.setup.area) {
      aEl.textContent = p.setup.area;
      aEl.style.display = 'inline-block';
  } else {
      aEl.style.display = 'none';
  }

  renderSidebar();

  showToast('✅ Saved to Supabase!');
}

function readSetup() {
  return {
    name:      gv('s_name'), area:  gv('s_area'), pm: gv('s_pm'),
    owner:     gv('s_owner'), sponsor: gv('s_sponsor'),
    itlt:      gv('s_itlt'), shortDesc: gv('s_shortdesc'), scope: gv('s_scope'),
  };
}

// ═══════════════════════════════════════════════════
// SAVE WEEKLY
// ═══════════════════════════════════════════════════
async function saveWeekly() {

  if (!activeId) return;

  readWeeklyMs();

  const p = projects[activeId];

  p.milestones = milestones.map(m => ({ ...m }));

  const weekly = readWeekly();

  // ── snapshot: save current week before overwriting ──
  if (p.weekly && p.weekly.date) {

    if (!p.snapshots) p.snapshots = [];

    const exists =
      p.snapshots.find(
        s => s.date === p.weekly.date
      );

    if (!exists) {

      p.snapshots.unshift({
        date:       p.weekly.date,
        overall:    p.weekly.health?.overall,
        scope:      p.weekly.health?.scope,
        schedule:   p.weekly.health?.schedule,
        risk:       p.weekly.health?.risk,
        quality:    p.weekly.health?.quality,
        note:       p.weekly.health?.overallNote,
        keyUpdates: p.weekly.keyUpdates || [],
        progress:   p.weekly.budget?.progress,
      });

      if (p.snapshots.length > 20) {
        p.snapshots =
          p.snapshots.slice(0, 20);
      }
    }
  }

  p.weekly = weekly;

  const { error } =
    await supabaseClient
      .from('projects')
      .update({

        weekly_data: p.weekly || {},

        milestones:
          p.milestones || [],

        risks:
          p.weekly?.risks || [],

        snapshots:
          p.snapshots || []

      })
      .eq('id', activeId);

  if (error) {

    console.error(error);

    showToast(
      '❌ ' + error.message
    );

    return;
  }

  renderSidebar();

  showToast(
    '✅ Week saved to Supabase!'
  );
}

  

function readWeekly() {
  const bullets = [...document.querySelectorAll('#w_bullets input[type=text]')].map(i=>i.value).filter(Boolean);
  const risks   = [...document.querySelectorAll('#w_risks .rep-row')].map(row => {
    const sels = row.querySelectorAll('select');
    const ta   = row.querySelector('textarea');
    const ins  = row.querySelectorAll('input[type=text],input[type=date]');
    return { type:sels[0]?.value, priority:sels[1]?.value, description:ta?.value, owner:ins[0]?.value, mitigation:ins[1]?.value, dueDate:ins[2]?.value };
  }).filter(r=>r.description);
  return {
    date: gv('w_date'), statusNote: gv('w_note'), keyUpdates: bullets,
    health: {
      overall:gv('w_overall'), overallNote:gv('w_note'),
      scope:gv('w_scope'), scopeNote:gv('w_scope_note'),
      schedule:gv('w_sched'), scheduleNote:gv('w_sched_note'),
      risk:gv('w_risk'), riskNote:gv('w_risk_note'),
      quality:gv('w_qual'), qualityNote:gv('w_qual_note'),
    },
    budget: {
      progress:gv('w_prog'), budgetKEUR:gv('w_budg_val'),
      spendToDate:gv('w_spend'), spendForecast:gv('w_fcast'),
      cpiBudget:gv('w_cpi_budget'), cpiForecast:gv('w_cpi_fcast'),
    },
    milestones: milestones.map(m=>({...m})),
    risks,
  };
}

// ═══════════════════════════════════════════════════
// DELETE PROJECT
// ═══════════════════════════════════════════════════
function confirmDelete(id) {
  const p = projects[id];
  if (!p) return;
  const name = p?.setup?.name || 'Unnamed project';

  // remove any existing modal
  const existing = document.getElementById('confirmModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'confirmModal';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">Delete project?</div>
      <div class="modal-sub">
        "<strong>${esc(name)}</strong>" will be permanently deleted.<br>This cannot be undone.
      </div>
      <div class="modal-actions">
        <button class="btn-ghost" id="modalCancel">Cancel</button>
        <button class="btn-danger" id="modalConfirm">🗑 Delete</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  document.getElementById('modalCancel').onclick  = () => modal.remove();
  document.getElementById('modalConfirm').onclick = () => { modal.remove(); doDelete(id); };
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}


  async function doDelete(id) {

  console.log("DELETE:", id);

  if (!id || !projects[id]) return;

  if (!id.startsWith('p_')) {

    const { error } =
      await supabaseClient
        .from('projects')
        .delete()
        .eq('id', id);

    console.log("DELETE ERROR:", error);

    if (error) {
      console.error(error);
      showToast('❌ ' + error.message);
      return;
    }
  }

  delete projects[id];

  if (activeId === id) {
    activeId = null;
    milestones = [];

    document.getElementById('tabBar').style.display = 'none';
    document.getElementById('btnExport').style.display = 'none';
    document.getElementById('btnDelete').style.display = 'none';

    document.getElementById('topbarName').textContent =
      'Select a project';

    document.getElementById('topbarArea').style.display = 'none';
  }

  renderSidebar();

  if (Object.keys(projects).length > 0) {
    showDashboard();
  } else {
    showPane('empty');
    document
      .getElementById('nav-dashboard')
      .classList.remove('active');
  }

  showToast('Project deleted.');
}

// ═══════════════════════════════════════════════════
// MILESTONES — shared store
// ═══════════════════════════════════════════════════
function readSetupMs() {
  const rows = document.querySelectorAll('#s_ms .rep-row');
  const updated = [];
  rows.forEach(row => {
    const id = parseInt(row.dataset.id);
    const ex = milestones.find(m=>m.id===id) || {};
    updated.push({ ...ex, id,
      name:         row.querySelector('.ms-name').value,
      dueDateOrig:  row.querySelector('.ms-orig').value,
      dueDateLatest:row.querySelector('.ms-lat').value,
    });
  });
  milestones = updated;
}

function readWeeklyMs() {
  const rows = document.querySelectorAll('#w_ms .rep-row');
  const updated = [];
  rows.forEach(row => {
    const id = parseInt(row.dataset.id);
    const ex = milestones.find(m=>m.id===id) || {};
    const ssel = row.querySelector('.ms-status');
    updated.push({ ...ex, id,
      name:         row.querySelector('.ms-name').value,
      dueDateOrig:  row.querySelector('.ms-orig').value,
      dueDateLatest:row.querySelector('.ms-lat').value,
      complete:     row.querySelector('.ms-pct').value,
      status:       ssel ? ssel.value : (ex.status||''),
      done:         row.querySelector('.ms-done').value,
    });
  });
  milestones = updated;
}

function readActiveMilestones() {
  readWeeklyMs();
}

function renderSetupMs() {
  const c = document.getElementById('s_ms'); c.innerHTML = '';
  milestones.forEach((m,i) => buildSetupMsRow(c, m, i));
}

function renderWeeklyMs() {
  const c = document.getElementById('w_ms'); c.innerHTML = '';
  milestones.forEach((m,i) => buildWeeklyMsRow(c, m, i));
}

function buildSetupMsRow(container, m, idx) {
  const div = document.createElement('div');
  div.className = 'rep-row'; div.dataset.id = m.id;
  div.innerHTML = `
    <div class="rep-label">Milestone ${idx+1}</div>
    <button class="rm-btn" onclick="removeMs(${m.id})">✕</button>
    <div class="fr c1" style="margin-bottom:10px;">
      <div class="f"><label>Name</label><input type="text" class="ms-name" placeholder="e.g. Go-Live KK-CH" value="${esc(m.name||'')}"></div>
    </div>
    <div class="fr c2">
      <div class="f"><label>Due Date (original)</label><input type="date" class="ms-orig" value="${m.dueDateOrig||''}"></div>
      <div class="f"><label>Due Date (latest)</label><input type="date" class="ms-lat" value="${m.dueDateLatest||''}"></div>
    </div>`;
  container.appendChild(div);
}

function buildWeeklyMsRow(container, m, idx) {
  const div = document.createElement('div');
  div.className = 'rep-row'; div.dataset.id = m.id;
  div.innerHTML = `
    <div class="rep-label">Milestone ${idx+1}</div>
    <button class="rm-btn" onclick="removeMs(${m.id})">✕</button>
    <div class="fr c1" style="margin-bottom:10px;">
      <div class="f"><label>Name</label><input type="text" class="ms-name" placeholder="e.g. Go-Live KK-CH" value="${esc(m.name||'')}"></div>
    </div>
    <div class="fr c4">
      <div class="f"><label>Due Date (orig.)</label><input type="date" class="ms-orig" value="${m.dueDateOrig||''}"></div>
      <div class="f"><label>Due Date (latest)</label><input type="date" class="ms-lat" value="${m.dueDateLatest||''}"></div>
      <div class="f"><label>Complete (%)</label><input type="number" class="ms-pct" min="0" max="100" placeholder="0–100" value="${m.complete||''}"></div>
      <div class="f"><label>Status</label>
        <select class="ms-status" onchange="cs(this)">
          <option value="">Select...</option>
          <option value="green"  ${m.status==='green' ?'selected':''}>✅ On Track</option>
          <option value="yellow" ${m.status==='yellow'?'selected':''}>⚠️ At Risk</option>
          <option value="red"    ${m.status==='red'   ?'selected':''}>🔴 Off Track</option>
          <option value="grey"   ${m.status==='grey'  ?'selected':''}>⬜ Not Started</option>
        </select></div>
    </div>
    <div class="fr c2" style="margin-top:10px;">
      <div class="f"><label>Done?</label>
        <select class="ms-done">
          <option value="no"  ${m.done!=='yes'?'selected':''}>No</option>
          <option value="yes" ${m.done==='yes'?'selected':''}>Yes ✓</option>
        </select></div>
    </div>`;
  const ss = div.querySelector('.ms-status');
  if (m.status) cs(ss);
  container.appendChild(div);
}

function addMs(view) {
  const m = { id: nextMsId++, name:'', dueDateOrig:'', dueDateLatest:'', complete:'', status:'', done:'no' };
  milestones.push(m);
  if (view==='setup') buildSetupMsRow(document.getElementById('s_ms'), m, milestones.length-1);
  else                buildWeeklyMsRow(document.getElementById('w_ms'), m, milestones.length-1);
}

function removeMs(id) {
  milestones = milestones.filter(m => m.id !== id);
  document.querySelectorAll(`.rep-row[data-id="${id}"]`).forEach(el => el.remove());
  ['s_ms','w_ms'].forEach(cid => {
    document.querySelectorAll(`#${cid} .rep-label`).forEach((el,i) => el.textContent = `Milestone ${i+1}`);
  });
}

// ═══════════════════════════════════════════════════
// BULLETS
// ═══════════════════════════════════════════════════
function addBullet(val='') {
  const c = document.getElementById('w_bullets');
  const d = document.createElement('div');
  d.className = 'b-row';
  d.innerHTML = `<input type="text" placeholder="Key update this week..." value="${esc(val)}"><button class="rm-btn" onclick="this.parentElement.remove()">✕</button>`;
  c.appendChild(d);
}

// ═══════════════════════════════════════════════════
// RISKS
// ═══════════════════════════════════════════════════
function addRisk(r={}) {
  const c = document.getElementById('w_risks');
  const idx = c.children.length + 1;
  const d = document.createElement('div');
  d.className = 'rep-row';
  d.innerHTML = `
    <div class="rep-label">Risk / Issue ${idx}</div>
    <button class="rm-btn" onclick="this.parentElement.remove();renumberRisks()">✕</button>
    <div class="fr c2" style="margin-bottom:10px;">
      <div class="f"><label>Type</label>
        <select><option value="R" ${r.type==='R'?'selected':''}>R – Risk</option><option value="I" ${r.type==='I'?'selected':''}>I – Issue</option></select></div>
      <div class="f"><label>Priority</label>
        <select>
          <option value="Low"    ${r.priority==='Low'   ?'selected':''}>Low</option>
          <option value="Medium" ${r.priority==='Medium'?'selected':''}>Medium</option>
          <option value="High"   ${r.priority==='High'  ?'selected':''}>High</option>
        </select></div>
    </div>
    <div class="fr c2" style="margin-bottom:10px;">
      <div class="f"><label>Description</label><textarea rows="2" placeholder="What is the risk or issue?">${esc(r.description||'')}</textarea></div>
      <div class="f"><label>Owner</label><input type="text" placeholder="Responsible person" value="${esc(r.owner||'')}"></div>
    </div>
    <div class="fr c2">
      <div class="f"><label>Mitigation Action</label><input type="text" placeholder="What is being done?" value="${esc(r.mitigation||'')}"></div>
      <div class="f"><label>Due Date</label><input type="date" value="${r.dueDate||''}"></div>
    </div>`;
  c.appendChild(d);
}

function renumberRisks() {
  document.querySelectorAll('#w_risks .rep-label').forEach((el,i) => el.textContent = `Risk / Issue ${i+1}`);
}

// ═══════════════════════════════════════════════════
// EXPORT JSON
// ═══════════════════════════════════════════════════
function exportJSON() {
  if (!activeId) { showToast('⚠️ Select a project first.'); return; }
  readActiveMilestones();
  const p = projects[activeId];
  const data = {
    meta: { reportDate: gv('w_date'), generatedAt: new Date().toISOString() },
    project: readSetup(),
    weeklyUpdate: readWeekly(),
  };
  const slug = (data.project.name||'project').replace(/\s+/g,'_').toLowerCase().replace(/[^a-z0-9_]/g,'');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `takkt_${slug}_${data.meta.reportDate||'draft'}.json`; a.click();
  URL.revokeObjectURL(url);
  showToast('✅ JSON exported!');
}

// ═══════════════════════════════════════════════════
// EXPORT EXCEL
// ═══════════════════════════════════════════════════
function exportExcel() {
  if (!window.XLSX) { showToast('⚠️ Excel library not loaded yet, try again.'); return; }
  const wb = XLSX.utils.book_new();
  const areaOrder = ['Efficiency','IT Infrastructure','Application','Employee Experience','OFD Priorities'];
  const list = Object.values(projects).sort((a,b) => {
    const ai = areaOrder.indexOf(a.setup?.area||''); const bi = areaOrder.indexOf(b.setup?.area||'');
    if (ai !== bi) return (ai===-1?99:ai) - (bi===-1?99:bi);
    return (a.setup?.name||'').localeCompare(b.setup?.name||'');
  });
  const sl = v => ({ green:'On Track', yellow:'At Risk', red:'Off Track', grey:'N/A' }[v] || '');

  // ── Sheet 1: Portfolio Dashboard ──
  const dashRows = [
    ['Area','Project','Short Description','PM','ITLT','Overall','Scope','Schedule','Risk','Quality','Progress %','Budget kEUR','Spend to Date','Spend Forecast','CPI Budget','CPI Forecast','Week of']
  ];
  list.forEach(p => {
    const s = p.setup||{}, w = p.weekly||{}, h = w.health||{}, b = w.budget||{};
    dashRows.push([
      s.area||'', s.name||'', s.shortDesc||'', s.pm||'', s.itlt||'',
      sl(h.overall), sl(h.scope), sl(h.schedule), sl(h.risk), sl(h.quality),
      b.progress||'', b.budgetKEUR||'', b.spendToDate||'', b.spendForecast||'',
      b.cpiBudget||'', b.cpiForecast||'', w.date||''
    ]);
  });
  const wsDash = XLSX.utils.aoa_to_sheet(dashRows);
  wsDash['!cols'] = [8,22,24,18,10,11,11,11,11,11,10,10,12,14,10,10,10].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, wsDash, 'Dashboard');

  // ── Sheet 2: Key Updates ──
  const updRows = [['Project','Week of','#','Key Update']];
  list.forEach(p => {
    (p.weekly?.keyUpdates||[]).filter(Boolean).forEach((u,i) => {
      updRows.push([p.setup?.name||'', p.weekly?.date||'', i+1, u]);
    });
  });
  const wsUpd = XLSX.utils.aoa_to_sheet(updRows);
  wsUpd['!cols'] = [{wch:24},{wch:12},{wch:4},{wch:60}];
  XLSX.utils.book_append_sheet(wb, wsUpd, 'Key Updates');

  // ── Sheet 3: Milestones ──
  const msRows2 = [['Project','Milestone','Due Date (orig)','Due Date (latest)','Complete %','Status','Done']];
  list.forEach(p => {
    (p.weekly?.milestones||[]).filter(m=>m.name).forEach(m => {
      msRows2.push([p.setup?.name||'', m.name, m.dueDateOrig||'', m.dueDateLatest||'', m.complete||'', sl(m.status), m.done==='yes'?'Yes':'No']);
    });
  });
  const wsMs = XLSX.utils.aoa_to_sheet(msRows2);
  wsMs['!cols'] = [{wch:24},{wch:40},{wch:14},{wch:14},{wch:10},{wch:12},{wch:6}];
  XLSX.utils.book_append_sheet(wb, wsMs, 'Milestones');

  // ── Sheet 4: Risks & Issues ──
  const riskRows2 = [['Project','Type','Priority','Description','Owner','Mitigation Action','Due Date']];
  list.forEach(p => {
    (p.weekly?.risks||[]).filter(r=>r.description).forEach(r => {
      riskRows2.push([p.setup?.name||'', r.type||'', r.priority||'', r.description||'', r.owner||'', r.mitigation||'', r.dueDate||'']);
    });
  });
  const wsRisk = XLSX.utils.aoa_to_sheet(riskRows2);
  wsRisk['!cols'] = [{wch:24},{wch:6},{wch:8},{wch:40},{wch:18},{wch:40},{wch:12}];
  XLSX.utils.book_append_sheet(wb, wsRisk, 'Risks & Issues');

  // ── Sheet 5: Status History ──
  const histRows = [['Project','Week of','Overall','Scope','Schedule','Risk','Quality','Progress %','Note']];
  list.forEach(p => {
    (p.snapshots||[]).forEach(s => {
      histRows.push([p.setup?.name||'', s.date||'', sl(s.overall), sl(s.scope), sl(s.schedule), sl(s.risk), sl(s.quality), s.progress||'', s.note||'']);
    });
  });
  const wsHist = XLSX.utils.aoa_to_sheet(histRows);
  wsHist['!cols'] = [{wch:24},{wch:12},{wch:11},{wch:11},{wch:11},{wch:11},{wch:11},{wch:10},{wch:40}];
  XLSX.utils.book_append_sheet(wb, wsHist, 'Status History');

  const date = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `TAKKT_IT_Portfolio_${date}.xlsx`);
  showToast('✅ Excel exported!');
}

// ═══════════════════════════════════════════════════
// DEMO DATA
// ═══════════════════════════════════════════════════
function loadDemo() {
  setVal('s_name','Test Project'); setVal('s_area','Efficiency');
  setVal('s_pm','Kristóf'); setVal('s_owner','Kristóf ');
  setVal('s_sponsor','Akos '); setVal('s_itlt','Akos ');
  setVal('s_shortdesc','Moc project');
  setVal('s_scope','This is the scope');

  milestones = []; nextMsId = 1;
  [
    { name:'Milestone 1 ', dueDateOrig:'2026-03-31' },
    { name:'Milestone 2',   dueDateOrig:'2026-05-31' },
    { name:'Milestone 3',   dueDateOrig:'2026-09-30' },
    { name:'Milestone 4',       dueDateOrig:'2026-12-31' },
  ].forEach(m => milestones.push({ id:nextMsId++, dueDateLatest:'', complete:'', status:'', done:'no', ...m }));

  renderSetupMs(); renderWeeklyMs();
  showToast('Demo data loaded!');
}

// ═══════════════════════════════════════════════════
// TAB / PANE SWITCHING
// ═══════════════════════════════════════════════════
function switchTab(tab, sync=true) {
  if (sync) {
    if (currentTab==='weekly') readWeeklyMs();
    if (tab==='weekly') renderWeeklyMs();
  }
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  showPane(tab);
}

function showPane(name) {
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  document.getElementById('pane-'+name).classList.add('active');
}

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════
function cs(sel) { // colorStatus
  sel.className = sel.className.replace(/\bs-\w+/g,'').trim();
  const map = {green:'s-green',yellow:'s-yellow',red:'s-red',grey:'s-grey'};
  if (sel.value && map[sel.value]) sel.classList.add(map[sel.value]);
}
function csById(id) { const el = document.getElementById(id); if (el) cs(el); }
function gv(id) { return document.getElementById(id)?.value || ''; }
function setVal(id, v) { const el = document.getElementById(id); if (el && v !== undefined && v !== null) el.value = v; }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
function showSnapshot(projectId, date) {

    const p = projects[projectId];

    if (!p) return;

    const snap =
        p.snapshots.find(
            s => s.date === date
        );

    console.log("SNAPSHOT DATA");
    console.log(snap);

}

