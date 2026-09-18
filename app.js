'use strict';

/* ══════════════════════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════════════════════ */
const PALETTE = [
  '#E07B54','#5B8CDB','#7AC08A','#C47AC0','#D4A843','#56A8B5','#D46E6E','#8A7AC4',
  '#4DB38C','#C49A56','#7A9EC4','#C47AA0','#6EC49A','#A07AC4','#C4A07A','#4D9BC4'
];

const DEFAULT_PEOPLE = [
  {id:'q1',  name:'Akshay K',                 color:'#E07B54', email:'akshay.khonde@impactguru.com'},
  {id:'q2',  name:'Kripa',                    color:'#5B8CDB', email:'kripa.doshi@impactguru.com'},
  {id:'q3',  name:'Omkar',                    color:'#7AC08A', email:'omkar.chavan@impactguru.com'},
  {id:'q4',  name:'Raeesa',                   color:'#C47AC0', email:'raeesa@impactguru.com'},
  {id:'q5',  name:'Rajas',                    color:'#D4A843', email:'rajas.deosthalee@impactguru.com'},
  {id:'q6',  name:'Sakshi',                   color:'#56A8B5', email:'sakshi.sukheja@impactguru.com'},
  {id:'q7',  name:'Sumeet T',                 color:'#D46E6E', email:'sumeet.tripathy@impactguru.com'},
  {id:'q8',  name:'Karishma Sarvesh Shirsat', color:'#8A7AC4', email:'karishma.shirsat@impactguru.com'},
  {id:'q9',  name:'Anmol Singh Panesar',      color:'#4DB38C', email:'anmol.panesar@impactguru.com'},
  {id:'q10', name:'Bharadwaj Kanamarlapudi',  color:'#C49A56', email:'bharadwaj@impactguru.com'},
  {id:'q11', name:'Khushboo Jain',            color:'#7A9EC4', email:'khushboo.jain@impactguru.com'},
  {id:'q12', name:'Ruchika Mehra',            color:'#C47AA0', email:'ruchika.mehra@impactguru.com'},
  {id:'q13', name:'Shashank Mogaveera',       color:'#6EC49A', email:'shashank.mogaveera@impactguru.com'},
  {id:'q14', name:'Madhav',                   color:'#A07AC4', email:'madhav.bhardwaj@impactguru.com'},
  {id:'q15', name:'Tanisha',                  color:'#C4A07A', email:'tanisha.bhave@impactguru.com'},
  {id:'q16', name:'Shubham Gaud',             color:'#4D9BC4', email:'shubham.gaud@impactguru.com'},
  {id:'q17', name:'Sajan Biswas',             color:'#D48A6E', email:'sajan.biswas@impactguru.com'},
  {id:'q18', name:'Dhruvi Dagli',             color:'#6EA0C4', email:'dagli.dhruvi@impactguru.com'},
  {id:'q19', name:'Shubham Yadav',            color:'#A8C46E', email:'shubham.yadav@impactguru.com'},
  {id:'q20', name:'Sonali',                   color:'#C46EA0', email:'sonali.sahu@impactguru.com'},
].map(p => ({...p, active:true, telegramChatId:null, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()}));

// Stages are data, not hardcoded control flow — editable via state.stages if ever needed.
const DEFAULT_STAGES = ['New','Assigned','In Progress','Waiting for Response','Response Received','Follow-up Required','Blocked','Completed','Cancelled'];
const CLOSED_STAGES = ['Completed','Cancelled'];
const STAGE_STYLE = {
  'New':'b-open','Assigned':'b-info','In Progress':'b-info','Waiting for Response':'b-warn',
  'Response Received':'b-info','Follow-up Required':'b-warn','Blocked':'b-bad','Completed':'b-ok','Cancelled':'b-open'
};
const OLD_STATUS_TO_STAGE = {
  'Not Started':'New','Open':'Assigned','In Progress':'In Progress',
  'In Progress - Delayed':'Follow-up Required','Done':'Completed','Blocked':'Blocked'
};
const PRIORITIES = ['High','Medium','Low'];
const TELEGRAM_STATUSES = ['None','Sent','Waiting for Response','Response Received'];
const FUNCTIONS = ['Performance Marketing','Retention Marketing','New Channels','Help from Other Departments'];
const TYPES = ['Action Pointer','Decision','Risk','FYI'];
const CSV_HEADERS = ['id','actionItem','description','function','type','owner','stakeholders','nextStep','priority','stage','dueDate','followUpDate','remarks','action'];
const DELETE_ACTION_RE = /^(remove|delete)$/i;
const STATE_VERSION = 5;

/* ══════════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════════ */
const uid = () => 't' + Math.random().toString(36).slice(2,9);
const nowISO = () => new Date().toISOString();
const todayISO = () => new Date().toISOString().slice(0,10);
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const personById = id => (state.people||[]).find(p => p.id === id);
const stageStyle = s => STAGE_STYLE[s] || 'b-open';
function initials(name){ return String(name||'?').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase(); }
function fmtDate(iso){ return iso ? new Date(iso.slice(0,10)+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'; }
function fmtDateTime(iso){ if(!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) + ' ' + d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); }
function relTime(iso){
  if(!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff/60000);
  if(mins < 1) return 'just now';
  if(mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins/60);
  if(hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs/24);
  if(days < 30) return `${days}d ago`;
  return fmtDate(iso);
}
function daysBetween(aISO, bISO){ return Math.round((new Date(bISO+'T00:00:00') - new Date(aISO+'T00:00:00'))/86400000); }
function isOverdue(item, dateField='dueDate'){
  const d = item[dateField];
  if(!d) return false;
  return d < todayISO() && !CLOSED_STAGES.includes(item.stage);
}
function isDueToday(item, dateField='dueDate'){ return item[dateField] === todayISO(); }
function isDueTomorrow(item, dateField='dueDate'){
  const t = new Date(); t.setDate(t.getDate()+1);
  return item[dateField] === t.toISOString().slice(0,10);
}
function isDueThisWeek(item, dateField='dueDate'){
  const d = item[dateField];
  if(!d) return false;
  const today = todayISO();
  const end = new Date(); end.setDate(end.getDate()+6);
  return d >= today && d <= end.toISOString().slice(0,10);
}

/* current-user attribution (no auth system exists — lightweight name tag for audit trail) */
function getCurrentUser(){
  let name = localStorage.getItem('atCurrentUser');
  if(!name){
    name = (window.prompt('Your name (used to attribute changes in the audit trail):') || '').trim() || 'Unknown';
    localStorage.setItem('atCurrentUser', name);
  }
  return name;
}

function logHistory(item, field, oldValue, newValue, source='user', actor){
  item.history = item.history || [];
  item.history.push({ ts: nowISO(), field, oldValue: oldValue ?? null, newValue: newValue ?? null, actor: actor || getCurrentUser(), source });
}

/* ══════════════════════════════════════════════════════════════════
   STATE — persisted as one JSON blob via /api/state (Upstash-backed)
   ══════════════════════════════════════════════════════════════════ */
let state = null;

function migrate(raw){
  const s = raw;
  s.stages = (Array.isArray(s.stages) && s.stages.length) ? s.stages.slice() : DEFAULT_STAGES.slice();
  s.people = (s.people||[]).map(p => ({
    id: p.id, name: p.name, color: p.color || PALETTE[0], email: p.email || '',
    telegramChatId: p.telegramChatId ?? null,
    active: p.active !== undefined ? p.active : true,
    createdAt: p.createdAt || nowISO(), updatedAt: p.updatedAt || p.createdAt || nowISO()
  }));
  s.items = (s.items||[]).map(item => {
    if(!item.stage){
      item.stage = OLD_STATUS_TO_STAGE[item.status] || item.status || 'New';
    }
    if(!s.stages.includes(item.stage)) s.stages.push(item.stage);
    item.priority = PRIORITIES.includes(item.priority) ? item.priority : 'Medium';
    item.description = item.description || '';
    item.stakeholders = item.stakeholders || [];
    item.nextStep = item.nextStep || [];
    item.ownerId = item.ownerId || item.nextStep[0] || item.stakeholders[0] || null;
    item.createdAt = item.createdAt || (item.dateOfDisc ? item.dateOfDisc+'T00:00:00.000Z' : nowISO());
    item.updatedAt = item.updatedAt || item.createdAt;
    item.dueDate = item.dueDate || null;
    item.followUpDate = item.followUpDate || null;
    item.remarks = item.remarks || '';
    item.createdBy = item.createdBy || null;
    item.completedAt = item.completedAt || (item.stage === 'Completed' ? item.updatedAt : null);
    item.cancelledAt = item.cancelledAt || (item.stage === 'Cancelled' ? item.updatedAt : null);
    item.telegram = item.telegram || {
      status: item.lastFollowUp ? 'Sent' : 'None',
      lastOutboundMessageId: null, lastOutboundChatId: null,
      lastMessage: null, lastMessageAt: item.lastFollowUp || null,
      lastResponse: null, lastResponseAt: null
    };
    item.telegramLog = item.telegramLog || [];
    item.history = item.history && item.history.length ? item.history : [
      { ts: item.createdAt, field: 'created', oldValue: null, newValue: item.stage, actor: item.createdBy || 'system', source: 'system' }
    ];
    return item;
  });
  s.meta = s.meta || {};
  s.meta.processedTelegramUpdateIds = s.meta.processedTelegramUpdateIds || [];
  s.version = STATE_VERSION;
  return s;
}

async function loadState(){
  try{
    const res = await fetch('/api/state');
    if(!res.ok) return null;
    const saved = await res.json();
    if(!saved) return null;
    return migrate(saved);
  }catch(e){ return null; }
}
async function saveState(){
  try{
    await fetch('/api/state', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state)
    });
  }catch(e){ console.error('save failed', e); }
}

function seed(){
  const T = todayISO();
  const legacyItems = [
    {id:'i1', dateOfDisc:T, function:'Performance Marketing', type:'Action Pointer', actionItem:'Add ROAS to the email and WhatsApp reporting slide', stakeholders:['q6'], nextStep:['q6'], status:'Not Started', remarks:'Directive: PJ'},
    {id:'i2', dateOfDisc:T, function:'Performance Marketing', type:'Action Pointer', actionItem:'Add domestic/international split to reporting slide', stakeholders:['q6'], nextStep:['q6'], status:'Not Started', remarks:'Directive: KJ'},
    {id:'i3', dateOfDisc:T, function:'Performance Marketing', type:'Action Pointer', actionItem:'Improve landing page ROI (raise story-page trust factor from 6 to 8) and revamp the landing page', stakeholders:['q15'], nextStep:['q6'], status:'Not Started', remarks:'Directive: PJ, KJ, VK'},
    {id:'i17', dateOfDisc:T, function:'Retention Marketing', type:'Action Pointer', actionItem:'Add push notification data to the next quarterly review', stakeholders:['q6'], nextStep:['q3'], status:'Not Started', remarks:'Directive: KJ'},
    {id:'i18', dateOfDisc:T, function:'Retention Marketing', type:'Action Pointer', actionItem:'Launch app push notifications', stakeholders:['q6'], nextStep:['q3'], status:'In Progress', remarks:'Directive: VK'},
    {id:'i26', dateOfDisc:T, function:'New Channels', type:'Action Pointer', actionItem:'Restart YouTube push (creatives and videos); pursue agency account for YT Performance Max', stakeholders:['q6'], nextStep:['q4'], status:'Not Started', remarks:'Directive: PJ'},
    {id:'i37', dateOfDisc:T, function:'Help from Other Departments', type:'Action Pointer', actionItem:'Link creative-team incentives to hook and hold rate performance; publish data', stakeholders:['q6'], nextStep:['q2'], status:'Not Started', remarks:'Directive: PJ'},
    {id:'i46', dateOfDisc:T, function:'Retention Marketing', type:'Action Pointer', actionItem:'Send Sukvinder/Paramjeet case to Punjab Flood donors', stakeholders:['q3'], nextStep:[], status:'In Progress', remarks:''},
    {id:'i47', dateOfDisc:T, function:'Retention Marketing', type:'Action Pointer', actionItem:'Razorpay SPC test', stakeholders:['q3'], nextStep:[], status:'In Progress', remarks:'', lastFollowUp:T},
  ];

  const daysAgo = n => { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); };
  const daysAhead = n => { const d = new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };

  const demo = [
    {id:'demo1', actionItem:'Finalize Q3 retention budget with finance', description:'Needs sign-off before campaign brief goes out.', function:'Retention Marketing', type:'Action Pointer', ownerId:'q12', stakeholders:['q12'], nextStep:['q12'], priority:'High', stage:'Follow-up Required', dueDate:daysAgo(4), followUpDate:daysAgo(1), remarks:'Overdue — chase finance'},
    {id:'demo2', actionItem:'Ship native ad pilot creative set', function:'New Channels', type:'Action Pointer', ownerId:'q9', stakeholders:['q9'], nextStep:['q9'], priority:'Medium', stage:'In Progress', dueDate:daysAhead(3), followUpDate:daysAhead(2), remarks:''},
    {id:'demo3', actionItem:'Confirm hospital POC SOP video is approved', function:'Help from Other Departments', type:'Decision', ownerId:'q18', stakeholders:['q18','q19'], nextStep:['q18'], priority:'High', stage:'Waiting for Response', dueDate:daysAhead(1), followUpDate:todayISO(), remarks:'Sent on Telegram, awaiting reply'},
    {id:'demo4', actionItem:'Review CAC vs CPM Q1 vs Q4 report', function:'Performance Marketing', type:'Risk', ownerId:'q5', stakeholders:['q5'], nextStep:['q5'], priority:'Medium', stage:'New', dueDate:daysAhead(7), followUpDate:null, remarks:''},
    {id:'demo5', actionItem:'Migrate donor app push provider', function:'Retention Marketing', type:'Action Pointer', ownerId:'q3', stakeholders:['q3'], nextStep:['q3'], priority:'Low', stage:'Assigned', dueDate:daysAhead(14), followUpDate:null, remarks:''},
    {id:'demo6', actionItem:'Close out Reddit content pilot recap', function:'New Channels', type:'FYI', ownerId:'q1', stakeholders:['q1'], nextStep:[], priority:'Low', stage:'Completed', dueDate:daysAgo(10), followUpDate:null, remarks:'Wrapped up, results shared'},
    {id:'demo7', actionItem:'Old Snapchat pilot — deprioritised', function:'New Channels', type:'Action Pointer', ownerId:'q1', stakeholders:['q1'], nextStep:[], priority:'Low', stage:'Cancelled', dueDate:null, followUpDate:null, remarks:'No longer a priority this quarter'},
    {id:'demo8', actionItem:'Escalate Meta ad account approval delay', function:'New Channels', type:'Risk', ownerId:'q4', stakeholders:['q4'], nextStep:['q4'], priority:'High', stage:'Blocked', dueDate:daysAgo(2), followUpDate:daysAgo(1), remarks:'Blocked on Meta support ticket'},
    {id:'demo9', actionItem:'Share LTV/repeat-donor ROAS model draft', function:'Retention Marketing', type:'Decision', ownerId:'q3', stakeholders:['q3','q6'], nextStep:['q6'], priority:'Medium', stage:'Response Received', dueDate:daysAgo(1), followUpDate:null, remarks:'Response received on Telegram, needs final review'},
    {id:'demo10', actionItem:'Book Zepto retention-practices interview', function:'Help from Other Departments', type:'Action Pointer', ownerId:'q3', stakeholders:['q3'], nextStep:['q3'], priority:'Medium', stage:'New', dueDate:todayISO(), followUpDate:todayISO(), remarks:'Due today'},
  ];

  const items = legacyItems.map(it => ({
    ...it,
    stage: OLD_STATUS_TO_STAGE[it.status] || 'New',
    priority: 'Medium',
    description: '',
    ownerId: it.nextStep[0] || it.stakeholders[0] || null,
    createdAt: it.dateOfDisc + 'T09:00:00.000Z',
    updatedAt: it.dateOfDisc + 'T09:00:00.000Z',
    dueDate: null, followUpDate: null, createdBy: 'Sumeet T', completedAt: null, cancelledAt: null,
    telegram: { status: it.lastFollowUp ? 'Sent' : 'None', lastOutboundMessageId:null, lastOutboundChatId:null, lastMessage:null, lastMessageAt: it.lastFollowUp||null, lastResponse:null, lastResponseAt:null },
    telegramLog: [],
    history: [{ ts: it.dateOfDisc+'T09:00:00.000Z', field:'created', oldValue:null, newValue: OLD_STATUS_TO_STAGE[it.status]||'New', actor:'Sumeet T', source:'system' }]
  })).concat(demo.map(it => ({
    ...it,
    createdAt: nowISO(), updatedAt: nowISO(), createdBy: 'Sumeet T', completedAt: it.stage==='Completed'?nowISO():null, cancelledAt: it.stage==='Cancelled'?nowISO():null,
    telegram: it.stage==='Waiting for Response' ? { status:'Waiting for Response', lastOutboundMessageId:null, lastOutboundChatId:null, lastMessage:'Could you confirm the SOP video is approved?', lastMessageAt:nowISO(), lastResponse:null, lastResponseAt:null }
             : it.stage==='Response Received' ? { status:'Response Received', lastOutboundMessageId:null, lastOutboundChatId:null, lastMessage:'Sharing the model draft — can you take a look?', lastMessageAt:nowISO(), lastResponse:'Yes, looked at it — looks good, one tweak needed.', lastResponseAt:nowISO() }
             : { status:'None', lastOutboundMessageId:null, lastOutboundChatId:null, lastMessage:null, lastMessageAt:null, lastResponse:null, lastResponseAt:null },
    telegramLog: it.stage==='Response Received' ? [
      {direction:'outbound', text:'Sharing the model draft — can you take a look?', at:nowISO(), chatId:null, messageId:null},
      {direction:'inbound', text:'Yes, looked at it — looks good, one tweak needed.', at:nowISO(), chatId:null, messageId:null}
    ] : it.stage==='Waiting for Response' ? [
      {direction:'outbound', text:'Could you confirm the SOP video is approved?', at:nowISO(), chatId:null, messageId:null}
    ] : [],
    history: [{ ts: nowISO(), field:'created', oldValue:null, newValue: it.stage, actor:'Sumeet T', source:'system' }]
  })));

  return { version: STATE_VERSION, stages: DEFAULT_STAGES.slice(), people: DEFAULT_PEOPLE.map(p=>({...p})), items, meta:{ processedTelegramUpdateIds: [] } };
}

/* ══════════════════════════════════════════════════════════════════
   PEOPLE CHIPS
   ══════════════════════════════════════════════════════════════════ */
function personChipHTML(p, small=false){
  if(!p) return '<span style="color:var(--muted)">—</span>';
  const sz = small ? 16 : 18;
  return `<span class="pchip ${p.active===false?'inactive':''}" style="background:${p.color}22;color:${p.color};border-color:${p.color}44">
    <span class="av" style="background:${p.color};width:${sz}px;height:${sz}px;font-size:${small?8:9}px">${esc(initials(p.name))}</span>
    ${esc(p.name)}
  </span>`;
}

/* ══════════════════════════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════════════════════════ */
let quickFilter = null; // 'open'|'overdue'|'dueToday'|'waiting'|'followupToday'|'completed'|null

function dashCounts(){
  const all = state.items;
  return {
    open: all.filter(r => !CLOSED_STAGES.includes(r.stage)).length,
    overdue: all.filter(r => isOverdue(r)).length,
    dueToday: all.filter(r => isDueToday(r) && !CLOSED_STAGES.includes(r.stage)).length,
    waiting: all.filter(r => r.stage === 'Waiting for Response').length,
    followupToday: all.filter(r => isDueToday(r,'followUpDate') && !CLOSED_STAGES.includes(r.stage)).length,
    completed: all.filter(r => r.stage === 'Completed').length,
  };
}

function renderDash(){
  const c = dashCounts();
  const tiles = [
    ['open','Total Open',c.open,''],
    ['overdue','Overdue',c.overdue,'color:var(--bad)'],
    ['dueToday','Due Today',c.dueToday,'color:var(--warn)'],
    ['waiting','Waiting for Response',c.waiting,'color:var(--info)'],
    ['followupToday','Follow-up Today',c.followupToday,'color:var(--warn)'],
    ['completed','Completed',c.completed,'color:var(--ok)'],
  ];
  document.getElementById('dashBar').innerHTML = tiles.map(([key,label,val,style]) => `
    <button class="tile ${quickFilter===key?'active':''}" data-quick="${key}">
      <span class="v" style="${style}">${val}</span><span class="l">${esc(label)}</span>
    </button>`).join('');
  document.querySelectorAll('[data-quick]').forEach(b => {
    b.onclick = () => { quickFilter = quickFilter === b.dataset.quick ? null : b.dataset.quick; renderAll(); };
  });

  const body = document.getElementById('ownerSummaryBody');
  const active = state.people.filter(p => p.active !== false);
  const rows = active.map(p => {
    const mine = state.items.filter(r => r.ownerId === p.id);
    return {
      p,
      open: mine.filter(r => !CLOSED_STAGES.includes(r.stage)).length,
      overdue: mine.filter(r => isOverdue(r)).length,
      dueToday: mine.filter(r => isDueToday(r) && !CLOSED_STAGES.includes(r.stage)).length,
      waiting: mine.filter(r => r.stage === 'Waiting for Response').length,
    };
  }).filter(r => r.open > 0 || r.waiting > 0).sort((a,b) => b.open - a.open);
  body.innerHTML = rows.map(r => `
    <tr data-ownerrow="${r.p.id}">
      <td>${personChipHTML(r.p, true)}</td>
      <td class="num">${r.open}</td>
      <td class="num" style="${r.overdue?'color:var(--bad);font-weight:700':''}">${r.overdue}</td>
      <td class="num">${r.dueToday}</td>
      <td class="num" style="${r.waiting?'color:var(--info);font-weight:700':''}">${r.waiting}</td>
    </tr>`).join('') || `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:14px">No open workload</td></tr>`;
  body.querySelectorAll('[data-ownerrow]').forEach(tr => {
    tr.onclick = () => { document.getElementById('fltPerson').value = tr.dataset.ownerrow; renderAll(); };
  });
}

/* ══════════════════════════════════════════════════════════════════
   FILTER DROPDOWNS
   ══════════════════════════════════════════════════════════════════ */
function refreshDropdowns(){
  const stageSel = document.getElementById('fltStage');
  const curStage = stageSel.value;
  stageSel.innerHTML = `<option value="">All stages</option>` + state.stages.map(s=>`<option ${curStage===s?'selected':''}>${esc(s)}</option>`).join('');

  const personSel = document.getElementById('fltPerson');
  const curPerson = personSel.value;
  personSel.innerHTML = `<option value="">All owners</option>` + state.people.map(p => `<option value="${p.id}" ${curPerson===p.id?'selected':''}>${esc(p.name)}${p.active===false?' (inactive)':''}</option>`).join('');
}

/* ══════════════════════════════════════════════════════════════════
   SORT + FILTER
   ══════════════════════════════════════════════════════════════════ */
let sortKey = 'updatedAt', sortDir = -1;
const PRIORITY_RANK = {High:3, Medium:2, Low:1};

function matchesQuickFilter(r){
  switch(quickFilter){
    case 'open': return !CLOSED_STAGES.includes(r.stage);
    case 'overdue': return isOverdue(r);
    case 'dueToday': return isDueToday(r) && !CLOSED_STAGES.includes(r.stage);
    case 'waiting': return r.stage === 'Waiting for Response';
    case 'followupToday': return isDueToday(r,'followUpDate') && !CLOSED_STAGES.includes(r.stage);
    case 'completed': return r.stage === 'Completed';
    default: return true;
  }
}

function matchesDueFilter(r, val){
  switch(val){
    case 'overdue': return isOverdue(r);
    case 'today': return isDueToday(r);
    case 'tomorrow': return isDueTomorrow(r);
    case 'week': return isDueThisWeek(r);
    default: return true;
  }
}
function matchesFollowupFilter(r, val){
  switch(val){
    case 'overdue': return isOverdue(r,'followUpDate');
    case 'today': return isDueToday(r,'followUpDate');
    case 'week': return isDueThisWeek(r,'followUpDate');
    default: return true;
  }
}

function sortedFiltered(){
  const q = document.getElementById('searchBox').value.trim().toLowerCase();
  const fStage = document.getElementById('fltStage').value;
  const fPerson = document.getElementById('fltPerson').value;
  const fPriority = document.getElementById('fltPriority').value;
  const fDue = document.getElementById('fltDue').value;
  const fFollow = document.getElementById('fltFollowup').value;
  const fTelegram = document.getElementById('fltTelegram').value;

  let rows = state.items.filter(r => {
    const owner = personById(r.ownerId);
    const hay = [r.actionItem, r.description, r.remarks, r.function, r.type, owner?.name].join(' ').toLowerCase();
    return (!q || hay.includes(q))
      && (!fStage || r.stage === fStage)
      && (!fPerson || r.ownerId === fPerson || (r.stakeholders||[]).includes(fPerson) || (r.nextStep||[]).includes(fPerson))
      && (!fPriority || r.priority === fPriority)
      && matchesDueFilter(r, fDue)
      && matchesFollowupFilter(r, fFollow)
      && (!fTelegram || (r.telegram?.status || 'None') === fTelegram)
      && matchesQuickFilter(r);
  });

  rows.sort((a,b) => {
    let va, vb;
    if(sortKey === 'owner'){ va = personById(a.ownerId)?.name || ''; vb = personById(b.ownerId)?.name || ''; }
    else if(sortKey === 'priority'){ va = PRIORITY_RANK[a.priority]||0; vb = PRIORITY_RANK[b.priority]||0; }
    else if(sortKey === 'telegram'){ va = a.telegram?.status||''; vb = b.telegram?.status||''; }
    else if(sortKey === 'dueDate' || sortKey === 'followUpDate'){ va = a[sortKey]||'9999-99-99'; vb = b[sortKey]||'9999-99-99'; }
    else { va = a[sortKey] || ''; vb = b[sortKey] || ''; }
    return (va<vb?-1:va>vb?1:0)*sortDir;
  });
  return rows;
}

function updateRowCount(rows){
  document.getElementById('rowCount').textContent = rows.length ? `${rows.length} of ${state.items.length} tasks` : '0 tasks';
}

/* ══════════════════════════════════════════════════════════════════
   TABLE VIEW
   ══════════════════════════════════════════════════════════════════ */
let viewMode = 'list';

function dueCellHTML(r){
  if(!r.dueDate) return '<span style="color:var(--muted)">—</span>';
  if(isOverdue(r)) return `<span class="badge b-bad">${esc(fmtDate(r.dueDate))}</span>`;
  if(isDueToday(r)) return `<span class="badge b-warn">Today</span>`;
  return `<span style="font-size:12.5px">${esc(fmtDate(r.dueDate))}</span>`;
}
function followupCellHTML(r){
  if(!r.followUpDate) return '<span style="color:var(--muted)">—</span>';
  if(isOverdue(r,'followUpDate')) return `<span class="badge b-bad">${esc(fmtDate(r.followUpDate))}</span>`;
  if(isDueToday(r,'followUpDate')) return `<span class="badge b-warn">Today</span>`;
  return `<span style="font-size:12.5px">${esc(fmtDate(r.followUpDate))}</span>`;
}
function telegramCellHTML(r){
  const s = r.telegram?.status || 'None';
  const cls = s==='Response Received' ? 'b-ok' : s==='Waiting for Response' ? 'b-warn' : s==='Sent' ? 'b-info' : 'b-open';
  return `<span class="badge ${cls}">${esc(s)}</span>`;
}
function stageSelectHTML(r){
  return `<select class="stage-sel ${stageStyle(r.stage)}" data-stagechange="${r.id}">
    ${state.stages.map(s=>`<option value="${esc(s)}" ${r.stage===s?'selected':''}>${esc(s)}</option>`).join('')}
  </select>`;
}

function renderTable(){
  const rows = sortedFiltered();
  updateRowCount(rows);
  const tbody = document.getElementById('tableBody');
  if(!rows.length){
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--muted)">No tasks match the current filters.</td></tr>`;
    renderSortIndicators();
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="task-cell" data-open="${r.id}">${esc(r.actionItem)}</td>
      <td>${personChipHTML(personById(r.ownerId))}</td>
      <td class="status-cell">${stageSelectHTML(r)}</td>
      <td><span class="badge pri-${r.priority}">${esc(r.priority)}</span></td>
      <td class="date-cell">${dueCellHTML(r)}</td>
      <td class="date-cell">${followupCellHTML(r)}</td>
      <td>${telegramCellHTML(r)}</td>
      <td class="date-cell" title="${esc(fmtDateTime(r.updatedAt))}">${relTime(r.updatedAt)}</td>
      <td><div style="display:flex;gap:4px">
        <button class="btn sm" data-followup="${r.id}" title="Send follow-up email">✉</button>
        <button class="btn sm" data-tgfollowup="${r.id}" title="Send follow-up on Telegram">✈</button>
        <button class="btn sm" data-edit="${r.id}">Edit</button>
        <button class="btn sm" data-del="${r.id}" style="color:var(--bad)">✕</button>
      </div></td>
    </tr>`).join('');

  wireRowActions(tbody);
  renderSortIndicators();
}

function wireRowActions(scope){
  scope.querySelectorAll('[data-open]').forEach(el => el.onclick = () => openDrawer(el.dataset.open));
  scope.querySelectorAll('[data-followup]').forEach(b => b.onclick = () => sendFollowUp(b.dataset.followup));
  scope.querySelectorAll('[data-tgfollowup]').forEach(b => b.onclick = () => sendTelegramFollowUp(b.dataset.tgfollowup));
  scope.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openItemModal(b.dataset.edit));
  scope.querySelectorAll('[data-del]').forEach(b => b.onclick = () => deleteItem(b.dataset.del));
  scope.querySelectorAll('[data-stagechange]').forEach(sel => sel.onchange = () => changeStage(sel.dataset.stagechange, sel.value));
}

function deleteItem(id){
  if(!confirm('Delete this task? This cannot be undone.')) return;
  state.items = state.items.filter(r => r.id !== id);
  saveState(); renderAll();
  toast('Task deleted');
}

function changeStage(id, newStage){
  const r = state.items.find(x => x.id === id);
  if(!r || r.stage === newStage) return;
  const old = r.stage;
  r.stage = newStage;
  r.updatedAt = nowISO();
  if(newStage === 'Completed') r.completedAt = nowISO();
  if(newStage === 'Cancelled') r.cancelledAt = nowISO();
  logHistory(r, 'stage', old, newStage, 'user');
  saveState(); renderAll();
  toast(`Stage: ${old} → ${newStage}`);
}

function renderSortIndicators(){
  document.querySelectorAll('thead th[data-col]').forEach(th => {
    th.classList.toggle('sorted', th.dataset.col === sortKey);
    const ind = th.querySelector('.sort-ind');
    if(ind) ind.textContent = th.dataset.col === sortKey ? (sortDir>0?'↑':'↓') : '↕';
  });
}

/* ══════════════════════════════════════════════════════════════════
   KANBAN VIEW
   ══════════════════════════════════════════════════════════════════ */
function kanbanCardHTML(r){
  return `<div class="kcard" draggable="true" data-drag="${r.id}">
    <div class="kc-text" data-open="${r.id}">${esc(r.actionItem)}</div>
    <div class="kc-chips">
      <span class="badge pri-${r.priority}">${esc(r.priority)}</span>
      ${r.dueDate ? dueCellHTML(r) : ''}
    </div>
    <div class="kc-people">${personChipHTML(personById(r.ownerId), true)}</div>
    <div class="kc-foot">
      ${telegramCellHTML(r)}
      <div style="display:flex;gap:4px">
        <button class="btn sm" data-followup="${r.id}" title="Send follow-up email">✉</button>
        <button class="btn sm" data-tgfollowup="${r.id}" title="Send follow-up on Telegram">✈</button>
        <button class="btn sm" data-edit="${r.id}">Edit</button>
        <button class="btn sm" data-del="${r.id}" style="color:var(--bad)">✕</button>
      </div>
    </div>
  </div>`;
}

function renderKanban(){
  const rows = sortedFiltered();
  updateRowCount(rows);
  const board = document.getElementById('kanbanView');
  board.innerHTML = state.stages.map(s => {
    const list = rows.filter(r => r.stage === s);
    return `<section class="kcol" data-col="${esc(s)}">
      <header><span class="badge ${stageStyle(s)}" style="pointer-events:none">${esc(s)}</span><span class="n">${list.length}</span></header>
      <div class="kcards">${list.map(kanbanCardHTML).join('') || '<div class="kc-empty">No tasks</div>'}</div>
    </section>`;
  }).join('');

  wireRowActions(board);

  board.querySelectorAll('.kcard').forEach(card => {
    card.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', card.dataset.drag); card.classList.add('dragging'); });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
  board.querySelectorAll('.kcol').forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('dragover'); });
    col.addEventListener('dragleave', () => col.classList.remove('dragover'));
    col.addEventListener('drop', e => {
      e.preventDefault(); col.classList.remove('dragover');
      const id = e.dataTransfer.getData('text/plain');
      changeStage(id, col.dataset.col);
    });
  });
}

function renderCurrentView(){
  if(viewMode === 'kanban') renderKanban(); else renderTable();
}
function renderAll(){
  renderDash();
  refreshDropdowns();
  renderCurrentView();
}

/* ══════════════════════════════════════════════════════════════════
   FOLLOW-UPS — Gmail + Telegram
   ══════════════════════════════════════════════════════════════════ */
const FOLLOWUP_CC = 'sumeet.tripathy@impactguru.com';

function followUpText(r){
  const owner = personById(r.ownerId);
  return [
    `Follow-up on: "${r.actionItem}"`, ``,
    `Function: ${r.function || '—'}`, `Stage: ${r.stage}`, `Priority: ${r.priority}`,
    r.dueDate ? `Due: ${fmtDate(r.dueDate)}` : null,
    r.remarks ? `Remarks: ${r.remarks}` : null, ``,
    `Could you share a quick update on where this stands?`
  ].filter(x => x !== null).join('\n');
}

function followUpComposeUrl(r){
  const assigned = [r.ownerId, ...(r.stakeholders||[]), ...(r.nextStep||[])].map(id => personById(id)).filter(Boolean);
  const to = [...new Set(assigned.map(p => p.email).filter(Boolean))].join(',');
  const subject = `Follow-up: ${r.actionItem.length > 60 ? r.actionItem.slice(0,57)+'…' : r.actionItem}`;
  const params = new URLSearchParams({ view:'cm', fs:'1', to, cc: FOLLOWUP_CC, su: subject, body: followUpText(r) });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

function sendFollowUp(id){
  const r = state.items.find(x => x.id === id);
  if(!r) return;
  window.open(followUpComposeUrl(r), '_blank', 'noopener');
  r.followUpDate = r.followUpDate; // unchanged; this is just the email channel
  logHistory(r, 'email_followup', null, todayISO(), 'user');
  r.updatedAt = nowISO();
  saveState(); renderAll();
  toast('Gmail compose opened in a new tab');
}

async function sendTelegramFollowUp(id){
  const r = state.items.find(x => x.id === id);
  if(!r) return;
  try{
    const res = await fetch('/api/telegram/send-followup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: id, text: followUpText(r) })
    });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Failed to send');
    state = migrate(data.state); // server updated telegram fields + history; adopt its copy
    renderAll();
    if(data.sentTo.length && data.skipped.length) toast(`Sent on Telegram to ${data.sentTo.join(', ')}. Not connected: ${data.skipped.join(', ')}`);
    else if(data.sentTo.length) toast(`Sent on Telegram to ${data.sentTo.join(', ')}`);
    else toast('No one on this task has connected Telegram yet — get their link from Owners');
  }catch(e){
    toast('Telegram send failed: ' + e.message);
  }
}

/* ══════════════════════════════════════════════════════════════════
   TASK DETAIL DRAWER
   ══════════════════════════════════════════════════════════════════ */
function historyLine(h){
  const map = {
    created: `Task created`,
    stage: `Stage changed: ${esc(h.oldValue)||'—'} → ${esc(h.newValue)||'—'}`,
    ownerId: `Reassigned: ${esc(personById(h.oldValue)?.name||'Unassigned')} → ${esc(personById(h.newValue)?.name||'Unassigned')}`,
    priority: `Priority changed: ${esc(h.oldValue)||'—'} → ${esc(h.newValue)||'—'}`,
    dueDate: `Due date changed: ${h.oldValue?fmtDate(h.oldValue):'—'} → ${h.newValue?fmtDate(h.newValue):'—'}`,
    followUpDate: `Follow-up date changed: ${h.oldValue?fmtDate(h.oldValue):'—'} → ${h.newValue?fmtDate(h.newValue):'—'}`,
    actionItem: `Task text edited`,
    description: `Description edited`,
    remarks: `Remarks edited`,
    email_followup: `Follow-up email sent`,
    csv_import: `Updated via CSV import`,
  };
  return map[h.field] || `${esc(h.field)} changed`;
}

function openDrawer(id){
  const r = state.items.find(x => x.id === id);
  if(!r) return;
  const owner = personById(r.ownerId);
  const stake = (r.stakeholders||[]).map(personById).filter(Boolean);
  const next = (r.nextStep||[]).map(personById).filter(Boolean);
  const drawer = document.getElementById('drawer');
  drawer.innerHTML = `
    <div class="dh">
      <div style="flex:1">
        <div style="font-weight:750;font-size:15px;line-height:1.4">${esc(r.actionItem)}</div>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
          <span class="badge ${stageStyle(r.stage)}">${esc(r.stage)}</span>
          <span class="badge pri-${r.priority}">${esc(r.priority)}</span>
          <span class="fn-chip">${esc(r.function||'—')}</span>
        </div>
      </div>
      <button class="iconbtn" id="drawerClose">✕</button>
    </div>
    <div class="db">
      <div class="dsec">
        <h4>Task information</h4>
        ${r.description ? `<div style="margin-bottom:10px;font-size:13px">${esc(r.description)}</div>` : ''}
        <div class="dgrid">
          <div><div class="k">Owner</div><div class="val">${personChipHTML(owner)}</div></div>
          <div><div class="k">Created by</div><div class="val">${esc(r.createdBy||'—')}</div></div>
          <div><div class="k">Due date</div><div class="val">${r.dueDate?fmtDate(r.dueDate):'—'}</div></div>
          <div><div class="k">Follow-up date</div><div class="val">${r.followUpDate?fmtDate(r.followUpDate):'—'}</div></div>
          <div><div class="k">Created</div><div class="val">${fmtDateTime(r.createdAt)}</div></div>
          <div><div class="k">Updated</div><div class="val">${fmtDateTime(r.updatedAt)}</div></div>
          ${r.completedAt?`<div><div class="k">Completed</div><div class="val">${fmtDateTime(r.completedAt)}</div></div>`:''}
          ${r.cancelledAt?`<div><div class="k">Cancelled</div><div class="val">${fmtDateTime(r.cancelledAt)}</div></div>`:''}
        </div>
        ${stake.length ? `<div style="margin-top:10px"><div class="k">Stakeholders</div><div class="people-wrap" style="margin-top:4px">${stake.map(p=>personChipHTML(p,true)).join('')}</div></div>` : ''}
        ${next.length ? `<div style="margin-top:10px"><div class="k">Next step owner(s)</div><div class="people-wrap" style="margin-top:4px">${next.map(p=>personChipHTML(p,true)).join('')}</div></div>` : ''}
        ${r.remarks ? `<div style="margin-top:10px"><div class="k">Remarks</div><div class="val">${esc(r.remarks)}</div></div>` : ''}
      </div>

      <div class="dsec">
        <h4>Telegram</h4>
        <div class="dgrid" style="margin-bottom:10px">
          <div><div class="k">Status</div><div class="val">${telegramCellHTML(r)}</div></div>
          <div><div class="k">Last response</div><div class="val">${r.telegram?.lastResponseAt?fmtDateTime(r.telegram.lastResponseAt):'—'}</div></div>
        </div>
        ${(r.telegramLog||[]).slice().reverse().map(m => `
          <div class="tg-msg ${m.direction==='outbound'?'out':'in'}">
            ${esc(m.text)}
            <div class="tg-meta">${m.direction==='outbound'?'Sent':'Received'} · ${fmtDateTime(m.at)}</div>
          </div>`).join('') || `<div style="font-size:12px;color:var(--muted)">No Telegram messages yet.</div>`}
      </div>

      <div class="dsec">
        <h4>History</h4>
        <div class="timeline">
          ${(r.history||[]).slice().reverse().map(h => `
            <div class="tl-item">
              <div class="tl-t">${fmtDateTime(h.ts)}<span class="tl-src">${esc(h.source)}</span></div>
              <div class="tl-d">${historyLine(h)} <span style="color:var(--muted)">— ${esc(h.actor||'—')}</span></div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
  document.getElementById('drawerClose').onclick = closeDrawer;
  document.getElementById('drawerOverlay').classList.add('open');
}
function closeDrawer(){ document.getElementById('drawerOverlay').classList.remove('open'); }

/* ══════════════════════════════════════════════════════════════════
   PEOPLE PICKER WIDGET (multi-select chips)
   ══════════════════════════════════════════════════════════════════ */
function buildPeoplePicker(containerId, selectedIds, allPeople){
  const wrap = document.getElementById(containerId);
  const render = () => {
    const sel = selectedIds;
    wrap.innerHTML = `
      <div class="selected-wrap">
        ${sel.map(id => { const p = allPeople.find(x=>x.id===id); return p ? `
          <span class="pchip" style="background:${p.color}22;color:${p.color};border-color:${p.color}44">
            <span class="av" style="background:${p.color}">${esc(initials(p.name))}</span>
            ${esc(p.name)}<button class="rm" data-rm="${p.id}" aria-label="Remove ${esc(p.name)}">×</button>
          </span>` : ''; }).join('')}
        ${!sel.length ? '<span style="color:var(--muted);font-size:12px">None selected</span>' : ''}
      </div>
      <div class="people-options">
        ${allPeople.filter(p=>p.active!==false).map(p => `<span class="pchip po ${sel.includes(p.id)?'selected':''}"
          data-pid="${p.id}" style="background:${p.color}22;color:${p.color};border-color:${p.color}44;cursor:pointer">
          <span class="av" style="background:${p.color}">${esc(initials(p.name))}</span>${esc(p.name)}</span>`).join('')}
      </div>`;
    wrap.querySelectorAll('[data-rm]').forEach(b => {
      b.onclick = e => { e.stopPropagation(); const i = selectedIds.indexOf(b.dataset.rm); if(i>-1){ selectedIds.splice(i,1); render(); } };
    });
    wrap.querySelectorAll('[data-pid]').forEach(chip => {
      chip.onclick = () => {
        const id = chip.dataset.pid;
        const i = selectedIds.indexOf(id);
        if(i>-1) selectedIds.splice(i,1); else selectedIds.push(id);
        render();
      };
    });
  };
  render();
}

/* ══════════════════════════════════════════════════════════════════
   ITEM CREATE/EDIT MODAL
   ══════════════════════════════════════════════════════════════════ */
function openItemModal(id){
  const existing = id ? state.items.find(r => r.id === id) : null;
  document.getElementById('itemModalTitle').textContent = existing ? 'Edit task' : 'New action';
  const stakeIds = existing ? [...(existing.stakeholders||[])] : [];
  const nextIds  = existing ? [...(existing.nextStep||[])]     : [];

  document.getElementById('itemModalBody').innerHTML = `
    <div class="field"><label>Task</label>
      <textarea id="fAction" rows="2" placeholder="What needs to happen?">${esc(existing?.actionItem||'')}</textarea></div>
    <div class="field"><label>Description <span>(optional detail)</span></label>
      <textarea id="fDesc" rows="2" placeholder="Additional context…">${esc(existing?.description||'')}</textarea></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="field"><label>Function</label>
        <input id="fFunc" list="fnList" value="${esc(existing?.function||FUNCTIONS[0])}">
        <datalist id="fnList">${FUNCTIONS.map(f=>`<option value="${esc(f)}">`).join('')}</datalist></div>
      <div class="field"><label>Type</label>
        <input id="fType" list="typeList" value="${esc(existing?.type||TYPES[0])}">
        <datalist id="typeList">${TYPES.map(t=>`<option value="${esc(t)}">`).join('')}</datalist></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="field"><label>Owner</label>
        <select id="fOwner"><option value="">Unassigned</option>
          ${state.people.filter(p=>p.active!==false).map(p=>`<option value="${p.id}" ${existing?.ownerId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}
        </select></div>
      <div class="field"><label>Priority</label>
        <select id="fPriority">${PRIORITIES.map(p=>`<option ${(existing?.priority||'Medium')===p?'selected':''}>${p}</option>`).join('')}</select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="field"><label>Stage</label>
        <select id="fStage">${state.stages.map(s=>`<option ${(existing?.stage||'New')===s?'selected':''}>${esc(s)}</option>`).join('')}</select></div>
      <div class="field"><label>Due date</label>
        <input type="date" id="fDue" value="${existing?.dueDate||''}"></div>
    </div>
    <div class="field"><label>Next follow-up date</label>
      <input type="date" id="fFollowup" value="${existing?.followUpDate||''}"></div>
    <div class="field"><label>Stakeholders <span>(click to add/remove — optional)</span></label>
      <div class="people-picker" id="stakeWrap"></div></div>
    <div class="field"><label>Next step owner(s) <span>(optional)</span></label>
      <div class="people-picker" id="nextWrap"></div></div>
    <div class="field"><label>Comments / remarks</label>
      <input id="fRemarks" value="${esc(existing?.remarks||'')}" placeholder="e.g. Present RCA by 15 Jul"></div>`;

  buildPeoplePicker('stakeWrap', stakeIds, state.people);
  buildPeoplePicker('nextWrap',  nextIds,  state.people);

  document.getElementById('itemOverlay').classList.add('open');
  document.getElementById('itemCancel').onclick = () => document.getElementById('itemOverlay').classList.remove('open');
  document.getElementById('itemSave').onclick = () => {
    const action = document.getElementById('fAction').value.trim();
    if(!action){ toast('Task text is required'); return; }
    const vals = {
      actionItem: action,
      description: document.getElementById('fDesc').value.trim(),
      function: document.getElementById('fFunc').value.trim(),
      type: document.getElementById('fType').value.trim(),
      ownerId: document.getElementById('fOwner').value || null,
      priority: document.getElementById('fPriority').value,
      stage: document.getElementById('fStage').value,
      dueDate: document.getElementById('fDue').value || null,
      followUpDate: document.getElementById('fFollowup').value || null,
      stakeholders: stakeIds,
      nextStep: nextIds,
      remarks: document.getElementById('fRemarks').value.trim(),
    };

    if(existing){
      const actor = getCurrentUser();
      ['actionItem','description','function','type','ownerId','priority','stage','dueDate','followUpDate','remarks'].forEach(f => {
        if(String(existing[f]||'') !== String(vals[f]||'')) logHistory(existing, f, existing[f], vals[f], 'user', actor);
      });
      if(vals.stage === 'Completed' && existing.stage !== 'Completed') existing.completedAt = nowISO();
      if(vals.stage === 'Cancelled' && existing.stage !== 'Cancelled') existing.cancelledAt = nowISO();
      Object.assign(existing, vals);
      existing.updatedAt = nowISO();
    } else {
      const obj = {
        id: uid(), ...vals,
        createdAt: nowISO(), updatedAt: nowISO(), createdBy: getCurrentUser(),
        completedAt: vals.stage==='Completed'?nowISO():null, cancelledAt: vals.stage==='Cancelled'?nowISO():null,
        telegram: { status:'None', lastOutboundMessageId:null, lastOutboundChatId:null, lastMessage:null, lastMessageAt:null, lastResponse:null, lastResponseAt:null },
        telegramLog: [], history: []
      };
      logHistory(obj, 'created', null, obj.stage, 'user');
      state.items.unshift(obj);
    }
    saveState(); document.getElementById('itemOverlay').classList.remove('open');
    renderAll(); toast(existing ? 'Task updated' : 'Task added');
  };
}

/* ══════════════════════════════════════════════════════════════════
   MANAGE PEOPLE (OWNERS)
   ══════════════════════════════════════════════════════════════════ */
function renderPeoplePanel(){
  const body = document.getElementById('peoplePanelBody');
  body.innerHTML = `
    <div class="manage-people">
      <h4>Team members (${state.people.length})</h4>
      ${state.people.map(p => `
        <div class="person-row ${p.active===false?'inactive':''}" data-pid="${p.id}" style="flex-direction:column;align-items:stretch;gap:8px">
          <div style="display:flex;align-items:center;gap:10px">
            <span class="av" style="background:${p.color};width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:800;color:#fff;flex-shrink:0">${esc(initials(p.name))}</span>
            <input class="pname-input" data-pid="${p.id}" value="${esc(p.name)}" style="flex:1;padding:5px 8px">
            <label style="display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap">
              <input type="checkbox" class="pactive-input" data-pid="${p.id}" ${p.active!==false?'checked':''} style="width:auto"> Active
            </label>
            <button class="btn sm" data-delperson="${p.id}" style="color:var(--bad);flex-shrink:0" title="Remove person">✕</button>
          </div>
          <input class="pemail-input" type="email" data-pid="${p.id}" value="${esc(p.email||'')}" placeholder="email@example.com (for follow-ups)" style="margin-left:38px;width:calc(100% - 38px);padding:5px 8px;font-size:12.5px">
          <div style="display:flex;align-items:center;gap:8px;margin-left:38px;font-size:12px">
            <span style="color:${p.telegramChatId ? 'var(--ok)' : 'var(--muted)'}">✈ ${p.telegramChatId ? 'Telegram connected' : 'Telegram not connected'}</span>
            <button class="btn sm" data-tglink="${p.id}" style="margin-left:auto">Copy connect link</button>
          </div>
        </div>`).join('')}
    </div>
    <div id="addPersonForm" style="display:none;border:1px solid var(--line);border-radius:8px;padding:14px;margin-top:12px;flex-direction:column;gap:10px">
      <div class="field"><label>Name</label><input id="newPersonName" placeholder="Full name or role"></div>
      <div class="field"><label>Email <span>(optional, for follow-ups)</span></label><input id="newPersonEmail" type="email" placeholder="email@example.com"></div>
      <div class="field"><label>Colour</label>
        <div style="display:flex;gap:5px;flex-wrap:wrap" id="newColorPalette">
          ${PALETTE.map((c,i) => `<button class="color-swatch ${i===0?'active':''}" data-nc="${c}" style="background:${c}"></button>`).join('')}
        </div>
      </div>
      <button class="btn primary sm" id="saveNewPerson">Add person</button>
    </div>`;

  body.querySelectorAll('.pname-input').forEach(inp => {
    inp.onblur = () => { const p = state.people.find(x=>x.id===inp.dataset.pid); if(p){ p.name = inp.value.trim() || p.name; p.updatedAt=nowISO(); saveState(); renderAll(); } };
  });
  body.querySelectorAll('.pemail-input').forEach(inp => {
    inp.onblur = () => { const p = state.people.find(x=>x.id===inp.dataset.pid); if(p){ p.email = inp.value.trim(); p.updatedAt=nowISO(); saveState(); } };
  });
  body.querySelectorAll('.pactive-input').forEach(inp => {
    inp.onchange = () => { const p = state.people.find(x=>x.id===inp.dataset.pid); if(p){ p.active = inp.checked; p.updatedAt=nowISO(); saveState(); renderPeoplePanel(); renderAll(); } };
  });
  body.querySelectorAll('[data-tglink]').forEach(b => {
    b.onclick = async () => {
      try{
        const res = await fetch(`/api/telegram/link/${b.dataset.tglink}`);
        const data = await res.json();
        if(!res.ok) throw new Error(data.error || 'Failed to get link');
        await navigator.clipboard.writeText(data.url);
        toast('Telegram connect link copied — send it to them');
      }catch(e){ toast('Could not get link: ' + e.message); }
    };
  });
  body.querySelectorAll('[data-delperson]').forEach(b => {
    b.onclick = () => {
      const pid = b.dataset.delperson;
      if(!confirm('Remove this person? Their tasks will become unassigned.')) return;
      state.people = state.people.filter(p => p.id !== pid);
      state.items.forEach(r => {
        if(r.ownerId === pid) r.ownerId = null;
        r.stakeholders = (r.stakeholders||[]).filter(id=>id!==pid);
        r.nextStep = (r.nextStep||[]).filter(id=>id!==pid);
      });
      saveState(); renderPeoplePanel(); renderAll();
      toast('Person removed');
    };
  });
  document.getElementById('addPersonBtn').onclick = () => {
    const f = document.getElementById('addPersonForm');
    f.style.display = f.style.display === 'none' ? 'flex' : 'none';
  };
  let newColor = PALETTE[0];
  body.querySelectorAll('[data-nc]').forEach(sw => {
    sw.onclick = () => { body.querySelectorAll('[data-nc]').forEach(s=>s.classList.remove('active')); sw.classList.add('active'); newColor = sw.dataset.nc; };
  });
  document.getElementById('saveNewPerson').onclick = () => {
    const name = document.getElementById('newPersonName').value.trim();
    if(!name){ toast('Enter a name'); return; }
    const email = document.getElementById('newPersonEmail').value.trim();
    const np = { id: uid(), name, color: newColor, email, active:true, telegramChatId:null, createdAt:nowISO(), updatedAt:nowISO() };
    state.people.push(np);
    saveState(); renderPeoplePanel(); renderAll();
    toast(`${name} added`);
  };
}

/* ══════════════════════════════════════════════════════════════════
   CSV IMPORT / EXPORT
   ══════════════════════════════════════════════════════════════════ */
function parseCSV(text){
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for(let i=0;i<text.length;i++){
    const c = text[i], next = text[i+1];
    if(inQuotes){
      if(c === '"' && next === '"'){ field += '"'; i++; }
      else if(c === '"'){ inQuotes = false; }
      else field += c;
    } else {
      if(c === '"') inQuotes = true;
      else if(c === ','){ row.push(field); field=''; }
      else if(c === '\n'){ row.push(field); rows.push(row); row=[]; field=''; }
      else if(c === '\r'){ /* skip */ }
      else field += c;
    }
  }
  if(field.length || row.length){ row.push(field); rows.push(row); }
  if(!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  // Recognize an "action" column (any case) — e.g. a value of "Remove"/"Delete" —
  // separately from the "actionItem" column, so hand-annotated exports (mark a
  // row "Remove", re-upload) work without renaming anything.
  const actionColKey = headers.find(h => h.toLowerCase() === 'action');
  return rows.slice(1).filter(r => r.some(f => f.trim()!=='')).map(r => {
    const obj = {};
    headers.forEach((h,i) => obj[h] = (r[i]||'').trim());
    obj._deleteFlag = actionColKey ? DELETE_ACTION_RE.test(obj[actionColKey]||'') : false;
    return obj;
  });
}

function csvField(v){
  v = String(v ?? '');
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v;
}
function rowsToCSV(headers, rows){
  return [headers.join(','), ...rows.map(r => headers.map(h => csvField(r[h])).join(','))].join('\n');
}
function downloadCSV(filename, csvText){
  const blob = new Blob([csvText], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

function itemToCSVRow(r){
  const names = ids => (ids||[]).map(id=>personById(id)?.name).filter(Boolean).join(';');
  return {
    id: r.id, actionItem: r.actionItem, description: r.description||'', function: r.function||'', type: r.type||'',
    owner: personById(r.ownerId)?.name || '', stakeholders: names(r.stakeholders), nextStep: names(r.nextStep),
    priority: r.priority, stage: r.stage, dueDate: r.dueDate||'', followUpDate: r.followUpDate||'', remarks: r.remarks||'',
    action: '' // type "remove" here and re-import to delete that task
  };
}

function resolvePerson(str){
  if(!str) return null;
  const s = str.trim();
  if(!s) return null;
  let p = state.people.find(x => x.id === s);
  if(p) return p;
  p = state.people.find(x => x.name.toLowerCase() === s.toLowerCase());
  return p || null;
}
function resolvePeopleList(str){
  if(!str) return { ids: [], unresolved: [] };
  const parts = str.split(';').map(s=>s.trim()).filter(Boolean);
  const ids = [], unresolved = [];
  parts.forEach(p => { const person = resolvePerson(p); if(person) ids.push(person.id); else unresolved.push(p); });
  return { ids, unresolved };
}
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

let csvPreviewRows = [];

function validateCSVRow(raw, seenIds){
  const notes = [];
  let status = 'new';

  if(raw._deleteFlag){
    const id = raw.id || '';
    if(!id) notes.push('Delete requested but no Task ID given');
    else if(seenIds.has(id)) notes.push(`Duplicate Task ID "${id}" within this file`);
    else if(!state.items.some(it => it.id === id)) notes.push(`Cannot delete: unknown Task ID "${id}"`);
    else seenIds.add(id);
    return {
      raw, notes, status: notes.length ? 'invalid' : 'delete', id: id || uid(),
      actionItem: raw.actionItem || (state.items.find(it=>it.id===id)?.actionItem) || '',
      description:'', function:'', type:'', ownerId:null, stakeholders:[], nextStep:[],
      priority:'Medium', stage: state.items.find(it=>it.id===id)?.stage || 'New',
      dueDate:null, followUpDate:null, remarks:''
    };
  }

  const actionItem = raw.actionItem || '';
  if(!actionItem){ notes.push('Missing task text'); }

  let priority = raw.priority || 'Medium';
  if(raw.priority && !PRIORITIES.includes(raw.priority)){ notes.push(`Unknown priority "${raw.priority}"`); }
  else if(!PRIORITIES.includes(priority)) priority = 'Medium';

  let stage = raw.stage || 'New';
  if(raw.stage && !state.stages.includes(raw.stage)){ notes.push(`Unknown stage "${raw.stage}"`); }

  if(raw.dueDate && !ISO_DATE_RE.test(raw.dueDate)) notes.push('Invalid due date (expected YYYY-MM-DD)');
  if(raw.followUpDate && !ISO_DATE_RE.test(raw.followUpDate)) notes.push('Invalid follow-up date (expected YYYY-MM-DD)');

  let ownerId = null;
  if(raw.owner){
    const p = resolvePerson(raw.owner);
    if(!p){ notes.push(`Unknown owner "${raw.owner}"`); } else ownerId = p.id;
  }
  const stakeR = resolvePeopleList(raw.stakeholders);
  const nextR = resolvePeopleList(raw.nextStep);
  if(stakeR.unresolved.length) notes.push(`Unknown stakeholder(s): ${stakeR.unresolved.join(', ')}`);
  if(nextR.unresolved.length) notes.push(`Unknown next-step owner(s): ${nextR.unresolved.join(', ')}`);

  const id = raw.id || '';
  if(id && seenIds.has(id)){ status = 'duplicate'; notes.push(`Duplicate Task ID "${id}" within this file`); }
  else if(id){
    seenIds.add(id);
    status = state.items.some(it => it.id === id) ? 'update' : 'new';
  }

  const hasBlockingError = notes.some(n => !n.startsWith('Unknown stakeholder') && !n.startsWith('Unknown next-step'));
  if(hasBlockingError && status !== 'duplicate') status = 'invalid';

  return {
    raw, notes, status,
    id: id || uid(),
    actionItem, description: raw.description||'', function: raw.function||'', type: raw.type||'',
    ownerId, stakeholders: stakeR.ids, nextStep: nextR.ids,
    priority: PRIORITIES.includes(priority)?priority:'Medium',
    stage: state.stages.includes(stage)?stage:'New',
    dueDate: ISO_DATE_RE.test(raw.dueDate||'') ? raw.dueDate : null,
    followUpDate: ISO_DATE_RE.test(raw.followUpDate||'') ? raw.followUpDate : null,
    remarks: raw.remarks || ''
  };
}

function renderCSVPreview(){
  const rows = csvPreviewRows;
  const counts = { new:0, update:0, invalid:0, duplicate:0, delete:0 };
  rows.forEach(r => counts[r.status]++);
  document.getElementById('csvSummary').innerHTML = [
    ['Total', rows.length, ''], ['New', counts.new, 'color:var(--ok)'], ['Update', counts.update, 'color:var(--info)'],
    ['Delete', counts.delete, 'color:var(--bad)'], ['Invalid', counts.invalid, 'color:var(--bad)'], ['Duplicate', counts.duplicate, 'color:var(--warn)'],
  ].map(([l,v,style]) => `<div class="cs-tile"><div class="v" style="${style}">${v}</div><div class="l">${l}</div></div>`).join('');

  const table = document.getElementById('csvPreviewTable');
  table.innerHTML = `<thead><tr><th>#</th><th>Status</th><th>Task</th><th>Owner</th><th>Stage</th><th>Priority</th><th>Due</th><th>Notes</th></tr></thead>
    <tbody>${rows.map((r,i) => `<tr class="csv-row-${r.status}">
      <td>${i+1}</td><td>${r.status}</td><td>${esc(r.actionItem||r.raw.actionItem||'')}</td>
      <td>${esc(personById(r.ownerId)?.name || r.raw.owner || '—')}</td><td>${esc(r.stage)}</td><td>${esc(r.priority)}</td>
      <td>${r.dueDate?fmtDate(r.dueDate):'—'}</td><td>${esc(r.notes.join('; '))}</td>
    </tr>`).join('')}</tbody>`;
}

function showCsvStep(n){
  document.getElementById('csvStep1').classList.toggle('active', n===1);
  document.getElementById('csvStep2').classList.toggle('active', n===2);
}

function handleCSVFile(file){
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCSV(String(reader.result));
    const seenIds = new Set();
    csvPreviewRows = rows.map(raw => validateCSVRow(raw, seenIds));
    renderCSVPreview();
    showCsvStep(2);
  };
  reader.readAsText(file);
}

function confirmCSVImport(){
  const actor = getCurrentUser();
  let created = 0, updated = 0, deleted = 0;
  const toDelete = new Set(csvPreviewRows.filter(r => r.status === 'delete').map(r => r.id));
  if(toDelete.size){
    state.items = state.items.filter(it => !toDelete.has(it.id));
    deleted = toDelete.size;
  }
  csvPreviewRows.forEach(r => {
    if(r.status === 'delete') return; // handled above
    if(r.status === 'new'){
      const obj = {
        id: r.id, actionItem: r.actionItem, description: r.description, function: r.function, type: r.type,
        ownerId: r.ownerId, stakeholders: r.stakeholders, nextStep: r.nextStep, priority: r.priority, stage: r.stage,
        dueDate: r.dueDate, followUpDate: r.followUpDate, remarks: r.remarks,
        createdAt: nowISO(), updatedAt: nowISO(), createdBy: actor, completedAt: r.stage==='Completed'?nowISO():null, cancelledAt: r.stage==='Cancelled'?nowISO():null,
        telegram: { status:'None', lastOutboundMessageId:null, lastOutboundChatId:null, lastMessage:null, lastMessageAt:null, lastResponse:null, lastResponseAt:null },
        telegramLog: [], history: []
      };
      logHistory(obj, 'created', null, obj.stage, 'csv', actor);
      state.items.push(obj);
      created++;
    } else if(r.status === 'update'){
      const existing = state.items.find(it => it.id === r.id);
      if(!existing) return;
      ['actionItem','description','function','type','ownerId','priority','stage','dueDate','followUpDate','remarks'].forEach(f => {
        if(String(existing[f]||'') !== String(r[f]||'')) logHistory(existing, f, existing[f], r[f], 'csv', actor);
      });
      if(r.stage === 'Completed' && existing.stage !== 'Completed') existing.completedAt = nowISO();
      if(r.stage === 'Cancelled' && existing.stage !== 'Cancelled') existing.cancelledAt = nowISO();
      Object.assign(existing, { actionItem:r.actionItem, description:r.description, function:r.function, type:r.type, ownerId:r.ownerId, stakeholders:r.stakeholders, nextStep:r.nextStep, priority:r.priority, stage:r.stage, dueDate:r.dueDate, followUpDate:r.followUpDate, remarks:r.remarks });
      existing.updatedAt = nowISO();
      updated++;
    }
  });
  saveState(); renderAll();
  document.getElementById('csvOverlay').classList.remove('open');
  toast(`CSV import: ${created} created, ${updated} updated, ${deleted} deleted`);
}

function exportCSV(scope){
  let rows = state.items;
  if(scope === 'filtered') rows = sortedFiltered();
  else if(scope === 'overdue') rows = state.items.filter(isOverdue);
  else if(scope === 'followup') rows = state.items.filter(r => isDueToday(r,'followUpDate') || isOverdue(r,'followUpDate'));
  const csv = rowsToCSV(CSV_HEADERS, rows.map(itemToCSVRow));
  downloadCSV(`action-tracker-export-${todayISO()}.csv`, csv);
  toast(`Exported ${rows.length} tasks`);
}

function downloadCSVTemplate(){
  const sample = [
    { id:'', actionItem:'Follow up on vendor contract', description:'Confirm renewal terms', function:'Retention Marketing', type:'Action Pointer', owner:'Sumeet T', stakeholders:'', nextStep:'Sumeet T', priority:'High', stage:'New', dueDate: todayISO(), followUpDate:'', remarks:'' },
    { id:'', actionItem:'Review creative performance report', description:'', function:'Performance Marketing', type:'FYI', owner:'Rajas', stakeholders:'', nextStep:'', priority:'Medium', stage:'In Progress', dueDate:'', followUpDate:'', remarks:'' },
  ];
  downloadCSV('action-tracker-template.csv', rowsToCSV(CSV_HEADERS, sample));
}

/* ══════════════════════════════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════════════════════════════ */
function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(()=>el.classList.remove('show'), 2800);
}

/* ══════════════════════════════════════════════════════════════════
   LEGACY: IMPORT FROM MEETING NOTES (kept — Anthropic API, best-effort)
   ══════════════════════════════════════════════════════════════════ */
function showImportStep(n){
  ['importStep1','importStep2','importStep3','importStep4'].forEach((id,i) => document.getElementById(id).classList.toggle('active', i+1===n));
}
function closeImport(){
  document.getElementById('importOverlay').classList.remove('open');
  showImportStep(1);
  document.getElementById('transcriptBox').value = '';
}
async function extractFromTranscript(){
  const raw = document.getElementById('transcriptBox').value.trim();
  if(!raw){ toast('Please paste some meeting notes first'); return; }
  showImportStep(2);
  const meetingDate = document.getElementById('importDate').value || todayISO();
  const fn = document.getElementById('importFunction').value;
  const teamList = state.people.filter(p=>p.active!==false).map(p => p.name).join(', ');
  const prompt = `You are an assistant that reads meeting transcripts and extracts structured action items.

Meeting date: ${meetingDate}
Function/Department: ${fn}
Known team members: ${teamList}

TRANSCRIPT:
${raw}

Extract every action item and learning/discussion point from the transcript.
For each item, determine:
- "type": either "Action Pointer" or "Learning/Discussion"
- "actionItem": a clear, concise statement (1-2 sentences max)
- "owner": name from the team list who owns the next action. Empty string if unclear.
- "priority": one of "High","Medium","Low"
- "remarks": any timeline/deadline/context. Empty string if none.

Respond ONLY with a valid JSON array. No markdown, no prose.`;
  let extracted = [];
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
    });
    if (!resp.ok) throw new Error('API ' + resp.status);
    const data = await resp.json();
    const text = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('').trim();
    const clean = text.replace(/^```[a-z]*\n?/,'').replace(/\n?```$/,'').trim();
    extracted = JSON.parse(clean);
    if (!Array.isArray(extracted)) throw new Error('Not an array');
  } catch(e) {
    console.error('AI extraction failed:', e);
    extracted = [{ type:'Action Pointer', actionItem:'Review meeting notes and identify action items manually', owner:'', priority:'Medium', remarks:'AI extraction unavailable — please edit or add items manually' }];
    toast('AI unavailable — showing fallback. You can edit items manually.');
  }
  const reviewItems = extracted.map((item, i) => ({
    _rid: 'r'+i, type: item.type || 'Action Pointer', actionItem: item.actionItem || '',
    ownerId: resolvePerson(item.owner||'')?.id || null, priority: PRIORITIES.includes(item.priority)?item.priority:'Medium',
    remarks: item.remarks || '', dateOfDisc: meetingDate, function: fn, included: true
  }));
  document.getElementById('importSummary').innerHTML = `<div style="font-weight:700">${reviewItems.length} item(s) extracted from your notes</div>`;
  renderReviewList(reviewItems);
  showImportStep(3);
}
function renderReviewList(items){
  const list = document.getElementById('reviewList');
  list.innerHTML = items.map((item, idx) => `
    <div class="review-card" data-rid="${item._rid}" style="border:1px solid var(--line);border-radius:10px;padding:10px 14px">
      <label style="display:flex;align-items:center;gap:8px;font-weight:650;font-size:13px">
        <input type="checkbox" class="rc-check" data-idx="${idx}" ${item.included?'checked':''}>
        ${esc(item.actionItem)}
      </label>
      <div style="font-size:12px;color:var(--muted);margin-top:4px">Owner: ${esc(personById(item.ownerId)?.name||'—')} · Priority: ${esc(item.priority)} ${item.remarks?('· '+esc(item.remarks)):''}</div>
    </div>`).join('');
  list.querySelectorAll('.rc-check').forEach(cb => cb.onchange = () => { items[+cb.dataset.idx].included = cb.checked; });
  let allSelected = true;
  document.getElementById('toggleAllBtn').onclick = () => {
    allSelected = !allSelected;
    document.getElementById('toggleAllBtn').textContent = allSelected ? 'Deselect all' : 'Select all';
    items.forEach((item,i) => { item.included = allSelected; list.querySelectorAll('.rc-check')[i].checked = allSelected; });
  };
  document.getElementById('confirmImportBtn').onclick = () => {
    const toAdd = items.filter(r => r.included);
    if(!toAdd.length){ toast('Select at least one item to import'); return; }
    const actor = getCurrentUser();
    toAdd.forEach(item => {
      const obj = {
        id: uid(), actionItem: item.actionItem, description:'', function: item.function, type: item.type,
        ownerId: item.ownerId, stakeholders: item.ownerId?[item.ownerId]:[], nextStep: item.ownerId?[item.ownerId]:[],
        priority: item.priority, stage: 'New', dueDate: null, followUpDate: null, remarks: item.remarks,
        createdAt: nowISO(), updatedAt: nowISO(), createdBy: actor, completedAt:null, cancelledAt:null,
        telegram: { status:'None', lastOutboundMessageId:null, lastOutboundChatId:null, lastMessage:null, lastMessageAt:null, lastResponse:null, lastResponseAt:null },
        telegramLog: [], history: []
      };
      logHistory(obj, 'created', null, 'New', 'user', actor);
      state.items.unshift(obj);
    });
    saveState();
    document.getElementById('doneMsg').textContent = `${toAdd.length} task${toAdd.length===1?'':'s'} added to tracker!`;
    showImportStep(4);
    renderAll();
  };
}

/* ══════════════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════════════ */
async function init(){
  const loaded = await loadState();
  state = loaded || seed();
  if(!loaded) saveState();

  document.getElementById('themeBtn').onclick = () => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme==='dark'?'light':'dark';
  };
  document.getElementById('addItemBtn').onclick = () => openItemModal(null);
  document.getElementById('managePeopleBtn').onclick = async () => {
    try{
      const res = await fetch('/api/state');
      if(res.ok){ const fresh = await res.json(); if(fresh) state = migrate(fresh); }
    }catch(e){}
    renderPeoplePanel();
    document.getElementById('peopleOverlay').classList.add('open');
  };
  document.getElementById('peopleClose').onclick = () => document.getElementById('peopleOverlay').classList.remove('open');

  // CSV import
  document.getElementById('csvImportBtn').onclick = () => { showCsvStep(1); document.getElementById('csvOverlay').classList.add('open'); };
  document.getElementById('csvClose').onclick = () => document.getElementById('csvOverlay').classList.remove('open');
  document.getElementById('csvDropZone').onclick = () => document.getElementById('csvFileInput').click();
  document.getElementById('csvFileInput').onchange = e => { if(e.target.files[0]) handleCSVFile(e.target.files[0]); };
  document.getElementById('csvDropZone').addEventListener('dragover', e => e.preventDefault());
  document.getElementById('csvDropZone').addEventListener('drop', e => { e.preventDefault(); if(e.dataTransfer.files[0]) handleCSVFile(e.dataTransfer.files[0]); });
  document.getElementById('csvTemplateBtn').onclick = downloadCSVTemplate;
  document.getElementById('csvBack').onclick = () => showCsvStep(1);
  document.getElementById('csvConfirm').onclick = confirmCSVImport;

  // CSV export (simple scope prompt via small confirm chain)
  document.getElementById('csvExportBtn').onclick = () => {
    const scope = (window.prompt('Export which tasks? Type: all, filtered, overdue, or followup', 'all') || '').trim().toLowerCase();
    if(['all','filtered','overdue','followup'].includes(scope)) exportCSV(scope);
    else if(scope) toast('Unknown scope — use all, filtered, overdue, or followup');
  };

  // Import from notes (legacy)
  document.getElementById('importBtn').onclick = () => {
    document.getElementById('importDate').value = todayISO();
    showImportStep(1);
    document.getElementById('importOverlay').classList.add('open');
  };
  document.getElementById('importClose').onclick = closeImport;
  document.getElementById('importClose2').onclick = closeImport;
  document.getElementById('extractBtn').onclick = extractFromTranscript;
  document.getElementById('backToStep1').onclick = () => showImportStep(1);
  document.getElementById('importDoneBtn').onclick = closeImport;

  document.querySelectorAll('.overlay').forEach(o => o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); }));
  document.getElementById('drawerOverlay').addEventListener('click', e => { if(e.target===document.getElementById('drawerOverlay')) closeDrawer(); });
  document.addEventListener('keydown', e => { if(e.key==='Escape'){ document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('open')); closeDrawer(); } });

  document.getElementById('searchBox').addEventListener('input', renderCurrentView);
  ['fltStage','fltPerson','fltPriority','fltDue','fltFollowup','fltTelegram'].forEach(id => document.getElementById(id).addEventListener('change', renderCurrentView));
  document.getElementById('clearFlt').onclick = () => {
    document.getElementById('searchBox').value='';
    ['fltStage','fltPerson','fltPriority','fltDue','fltFollowup','fltTelegram'].forEach(id=>document.getElementById(id).value='');
    quickFilter = null;
    renderAll();
  };
  document.querySelectorAll('#viewToggle [data-view]').forEach(b => {
    b.onclick = () => {
      viewMode = b.dataset.view;
      document.querySelectorAll('#viewToggle [data-view]').forEach(x => x.classList.toggle('active', x===b));
      document.getElementById('tableView').style.display = viewMode==='list' ? '' : 'none';
      document.getElementById('kanbanView').style.display = viewMode==='kanban' ? 'flex' : 'none';
      renderCurrentView();
    };
  });
  document.querySelectorAll('thead th[data-col]').forEach(th => {
    th.onclick = () => {
      if(sortKey===th.dataset.col) sortDir*=-1; else { sortKey=th.dataset.col; sortDir=1; }
      renderTable();
    };
  });

  renderAll();
}
init();
