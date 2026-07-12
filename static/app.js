const API = 'http://127.0.0.1:5000';
const CURRENCY_SYMBOL = '₹';
let VEHICLES = [], DRIVERS = [], TRIPS = [], MAINT = [], REPORTS = [];
let ACTIVE_FILTERS = { type:'', status:'', region:'' };

const STATUS_COLOR = {
  'Available':'#28a745','On Trip':'#0d6efd','In Shop':'#ffc107','Retired':'#6c757d',
  'Off Duty':'#6c757d','Suspended':'#dc3545','Draft':'#adb5bd','Dispatched':'#0d6efd',
  'Completed':'#28a745','Cancelled':'#dc3545','Active':'#ffc107','Closed':'#28a745'
};
const STATUS_BADGE = {
  'Available':'success','On Trip':'primary','In Shop':'warning text-dark','Retired':'secondary',
  'Off Duty':'secondary','Suspended':'danger','Draft':'secondary','Dispatched':'primary',
  'Completed':'success','Cancelled':'danger','Active':'warning text-dark','Closed':'success'
};

// ---------- number/currency formatting ----------
function fmtCurrency(n){
  if(n === null || n === undefined || n === '' || isNaN(n)) return '—';
  return CURRENCY_SYMBOL + Number(n).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function fmtNum(n, decimals=1){
  if(n === null || n === undefined || n === '' || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-IN', {minimumFractionDigits:decimals, maximumFractionDigits:decimals});
}

function statusBadge(status){
  return `<span class="badge badge-status bg-${STATUS_BADGE[status]||'secondary'}">${status}</span>`;
}
function statusCell(id, status){
  const color = STATUS_COLOR[status] || '#ccc';
  return `<td style="border-left:4px solid ${color}">${id}</td>`;
}
function emptyRow(colspan, icon, msg){
  return `<tr class="empty-row"><td colspan="${colspan}"><i class="bi ${icon} fs-3 d-block mb-2"></i>${msg}</td></tr>`;
}
function skeletonRows(colspan, rows=3){
  let out='';
  for(let i=0;i<rows;i++){
    out += `<tr class="skeleton-row">${Array(colspan).fill('<td><div class="skeleton-bar"></div></td>').join('')}</tr>`;
  }
  return out;
}

// Safe helper: only attaches a listener if the element actually exists,
// so one missing/misnamed ID in the HTML can never take down the rest of the script.
function on(id, event, handler){
  const el = document.getElementById(id);
  if(!el){ console.warn(`[app.js] Element #${id} not found — skipping ${event} listener.`); return; }
  el.addEventListener(event, handler);
}

// ---------- AUTH ----------
on('signInBtn', 'click', function(){
  try{
    const role = document.getElementById('loginRole').value;
    const email = document.getElementById('loginEmail').value || 'user@transitops.com';
    sessionStorage.setItem('to_user', JSON.stringify({email, role}));
    boot();
  }catch(err){
    const el = document.getElementById('loginError');
    if(el){ el.style.display = 'block'; el.textContent = 'Login error: ' + err.message; }
    console.error(err);
  }
});
on('logoutBtn', 'click', ()=>{
  sessionStorage.removeItem('to_user');
  location.reload();
});
function boot(){
  const user = JSON.parse(sessionStorage.getItem('to_user') || 'null');
  if(!user){ return; }
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('userChip').innerHTML = `<i class="bi bi-person-circle" aria-hidden="true"></i> ${user.email} <span class="badge bg-secondary ms-1">${user.role}</span>`;
  applyRoleAccess(user.role);
  showSkeletons();
  refreshAll();
}

// ---------- RBAC ----------
// PDF 3.1: Only authenticated users access the app (handled by boot/login gate above).
// Role-based access control: hide/disable actions not relevant to a role.
// Roles: Fleet Manager, Driver, Safety Officer, Financial Analyst
const ROLE_SECTION_ACCESS = {
  'Fleet Manager': ['dashboard','vehicles','drivers','trips','maintenance','reports'],
  'Driver': ['dashboard','trips'],
  'Safety Officer': ['dashboard','drivers'],
  'Financial Analyst': ['dashboard','reports']
};
function applyRoleAccess(role){
  const allowed = ROLE_SECTION_ACCESS[role] || ['dashboard'];
  document.querySelectorAll('.nav-link[data-section]').forEach(link=>{
    const section = link.dataset.section;
    if(allowed.includes(section)){
      link.style.display = '';
    } else {
      link.style.display = 'none';
    }
  });
  // Land on the first allowed section if current active one is hidden
  const activeLink = document.querySelector('.nav-link.active');
  if(activeLink && allowed.indexOf(activeLink.dataset.section) === -1){
    const firstAllowed = document.querySelector(`.nav-link[data-section="${allowed[0]}"]`);
    if(firstAllowed) firstAllowed.click();
  }
}

// ---------- THEME ----------
function toggleTheme(){
  document.body.classList.toggle('dark');
  const btn = document.getElementById('themeToggle');
  const icon = document.querySelector('#themeToggle i');
  const isDark = document.body.classList.contains('dark');
  icon.className = isDark ? 'bi bi-sun' : 'bi bi-moon-stars';
  icon.setAttribute('aria-hidden','true');
  btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  sessionStorage.setItem('to_theme', isDark ? 'dark' : 'light');
}
on('themeToggle', 'click', toggleTheme);
on('themeToggle', 'keydown', e=>{
  if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggleTheme(); }
});
if(sessionStorage.getItem('to_theme') === 'dark'){
  document.body.classList.add('dark');
  document.getElementById('themeToggle').setAttribute('aria-label','Switch to light mode');
}

// ---------- NAV ----------
document.querySelectorAll('.nav-link[data-section]').forEach(link=>{
  link.addEventListener('click', ()=>{
    document.querySelectorAll('.nav-link[data-section]').forEach(l=>l.classList.remove('active'));
    link.classList.add('active');
    document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
    document.getElementById('section-'+link.dataset.section).classList.add('active');
    document.getElementById('pageTitle').textContent = link.querySelector('.nav-text').textContent.trim();
  });
});

// ---------- TOAST ----------
function toast(msg, ok=true){
  const el = document.createElement('div');
  const icon = ok ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';
  el.className = `toast align-items-center text-bg-${ok?'success':'danger'} border-0 show`;
  el.setAttribute('role', ok ? 'status' : 'alert');
  el.innerHTML = `<div class="d-flex"><div class="toast-body"><i class="bi ${icon}" aria-hidden="true"></i> ${msg}</div></div>`;
  document.getElementById('toastHost').appendChild(el);
  setTimeout(()=>el.remove(), 3500);
}

// ---------- API HELPERS ----------
async function apiGet(path){
  if(DEMO_MODE){
    const costMatch = path.match(/^\/vehicles\/(\d+)\/cost$/);
    if(costMatch) return simulateWrite(path, 'PUT');
    return [];
  }
  const r = await fetch(API+path); return r.json();
}
async function apiPost(path, body){
  if(DEMO_MODE) return simulateWrite(path, 'POST', body);
  try{
    const r = await fetch(API+path, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
    const data = await r.json();
    if(!r.ok){ toast(data.error || 'Error', false); throw new Error(data.error); }
    return data;
  }catch(err){
    if(!DEMO_MODE){ DEMO_MODE = true; return simulateWrite(path, 'POST', body); }
    throw err;
  }
}
async function apiPut(path){
  if(DEMO_MODE) return simulateWrite(path, 'PUT');
  try{
    const r = await fetch(API+path, {method:'PUT'});
    const data = await r.json();
    if(!r.ok){ toast(data.error || 'Error', false); throw new Error(data.error); }
    return data;
  }catch(err){
    if(!DEMO_MODE){ DEMO_MODE = true; return simulateWrite(path, 'PUT'); }
    throw err;
  }
}

// Simulates the handful of writes app.js performs, purely in memory,
// so every button works end-to-end while running on demo data.
let DEMO_NEXT_ID = 1000;
function simulateWrite(path, method, body){
  if(method==='POST' && path==='/vehicles'){
    const v = {id: DEMO_NEXT_ID++, status:'Available', ...body};
    VEHICLES.push(v); return v;
  }
  if(method==='POST' && path==='/drivers'){
    const d = {id: DEMO_NEXT_ID++, status:'Available', safety_score:80, ...body};
    DRIVERS.push(d); return d;
  }
  if(method==='POST' && path==='/trips'){
    const t = {id: DEMO_NEXT_ID++, trip_status:'Dispatched', ...body};
    TRIPS.push(t);
    const v = VEHICLES.find(x=>x.id===t.vehicle_id); if(v) v.status='On Trip';
    const d = DRIVERS.find(x=>x.id===t.driver_id); if(d) d.status='On Trip';
    return t;
  }
  if(method==='POST' && path==='/maintenance'){
    const m = {id: DEMO_NEXT_ID++, status:'Active', ...body};
    MAINT.push(m);
    const v = VEHICLES.find(x=>x.id===m.vehicle_id); if(v) v.status='In Shop';
    return m;
  }
  if(method==='POST' && (path==='/fuel' || path==='/expenses')) return {ok:true};
  if(method==='PUT'){
    const retireMatch = path.match(/^\/vehicles\/(\d+)\/retire$/);
    if(retireMatch){ const v = VEHICLES.find(x=>x.id==retireMatch[1]); if(v) v.status='Retired'; return v; }
    const completeMatch = path.match(/^\/trips\/(\d+)\/complete$/);
    if(completeMatch){
      const t = TRIPS.find(x=>x.id==completeMatch[1]); if(t){ t.trip_status='Completed';
        const v=VEHICLES.find(x=>x.id===t.vehicle_id); if(v) v.status='Available';
        const d=DRIVERS.find(x=>x.id===t.driver_id); if(d) d.status='Available'; }
      return t;
    }
    const cancelMatch = path.match(/^\/trips\/(\d+)\/cancel$/);
    if(cancelMatch){
      const t = TRIPS.find(x=>x.id==cancelMatch[1]); if(t){ t.trip_status='Cancelled';
        const v=VEHICLES.find(x=>x.id===t.vehicle_id); if(v) v.status='Available';
        const d=DRIVERS.find(x=>x.id===t.driver_id); if(d) d.status='Available'; }
      return t;
    }
    const closeMatch = path.match(/^\/maintenance\/(\d+)\/close$/);
    if(closeMatch){
      const m = MAINT.find(x=>x.id==closeMatch[1]); if(m){ m.status='Closed';
        const v=VEHICLES.find(x=>x.id===m.vehicle_id); if(v && v.status!=='Retired') v.status='Available'; }
      return m;
    }
    const costMatch = path.match(/^\/vehicles\/(\d+)\/cost$/);
    if(costMatch){
      return {total_fuel_cost: 8000+Math.random()*4000, total_expense_cost: 2000+Math.random()*1500, total_operational_cost: 12000+Math.random()*4000};
    }
  }
  return {};
}

// ---------- SKELETONS ----------
// Vehicle table now has 9 cols (id, reg, model, type, region, odometer, load, status, actions)
function showSkeletons(){
  document.getElementById('vehicleTable').innerHTML = skeletonRows(9);
  document.getElementById('driverTable').innerHTML = skeletonRows(8); // id, name, license#, category, contact, expiry, safety, status
  document.getElementById('tripTable').innerHTML = skeletonRows(8); // + planned distance col
  document.getElementById('maintTable').innerHTML = skeletonRows(5);
  document.getElementById('reportsTable').innerHTML = skeletonRows(7);
}

// ---------- DEMO DATA FALLBACK ----------
// If the backend isn't reachable yet, the app falls back to realistic sample
// data instead of showing a blank dashboard. A banner makes it clear this is
// demo data, not live data, so nobody mistakes one for the other.
let DEMO_MODE = false;
function buildDemoData(){
  const today = new Date();
  const inDays = n => { const d = new Date(today); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };
  const vehicles = [
    {id:1, registration_number:'GJ-01-AB-1234', model:'Tata Ace', type:'Mini Truck', max_load_capacity:750, odometer:18200, region:'Ahmedabad', status:'Available', acquisition_cost:650000},
    {id:2, registration_number:'GJ-05-CD-5678', model:'Ashok Leyland Dost', type:'Van', max_load_capacity:1250, odometer:42500, region:'Surat', status:'On Trip', acquisition_cost:920000},
    {id:3, registration_number:'GJ-01-EF-9012', model:'Eicher Pro 2049', type:'Truck', max_load_capacity:4900, odometer:87650, region:'Ahmedabad', status:'In Shop', acquisition_cost:2150000},
    {id:4, registration_number:'GJ-27-GH-3456', model:'Mahindra Bolero Pickup', type:'Mini Truck', max_load_capacity:900, odometer:120400, region:'Vadodara', status:'Retired', acquisition_cost:580000},
    {id:5, registration_number:'GJ-01-IJ-7890', model:'Tata 407', type:'Van', max_load_capacity:2000, odometer:33100, region:'Ahmedabad', status:'Available', acquisition_cost:1150000},
  ];
  const drivers = [
    {id:1, name:'Alex Patel', license_number:'GJ0120230011', license_category:'Transport', contact_number:'98250 11223', license_expiry_date:inDays(400), safety_score:92, status:'Available'},
    {id:2, name:'Ravi Shah', license_number:'GJ0520190045', license_category:'HMV', contact_number:'99250 44556', license_expiry_date:inDays(12), safety_score:87, status:'On Trip'},
    {id:3, name:'Meera Joshi', license_number:'GJ0120210099', license_category:'LMV', contact_number:'97250 77889', license_expiry_date:inDays(-5), safety_score:78, status:'Suspended'},
    {id:4, name:'Karan Desai', license_number:'GJ2720220034', license_category:'Transport', contact_number:'98980 12121', license_expiry_date:inDays(200), safety_score:95, status:'Available'},
  ];
  const trips = [
    {id:1, source:'Ahmedabad', destination:'Surat', vehicle_id:2, driver_id:2, cargo_weight:1100, planned_distance:280, trip_status:'Dispatched'},
    {id:2, source:'Ahmedabad', destination:'Vadodara', vehicle_id:1, driver_id:1, cargo_weight:400, planned_distance:110, trip_status:'Draft'},
    {id:3, source:'Surat', destination:'Rajkot', vehicle_id:5, driver_id:4, cargo_weight:1800, planned_distance:340, trip_status:'Completed'},
    {id:4, source:'Ahmedabad', destination:'Bhavnagar', vehicle_id:3, driver_id:2, cargo_weight:2200, planned_distance:200, trip_status:'Cancelled'},
  ];
  const maint = [
    {id:1, vehicle_id:3, description:'Engine overhaul + brake pad replacement', status:'Active'},
    {id:2, vehicle_id:5, description:'Routine oil change', status:'Closed'},
  ];
  const reports = vehicles.filter(v=>v.status!=='Retired').map(v=>({
    vehicle_id:v.id, registration_number:v.registration_number, type:v.type, region:v.region, status:v.status,
    fuel_efficiency: 6 + Math.random()*6,
    total_operational_cost: 15000 + Math.random()*45000,
    roi: 8 + Math.random()*20
  }));
  return {vehicles, drivers, trips, maint, reports};
}
function showDemoBanner(){
  const el = document.getElementById('alertStrip');
  if(!el) return;
  const banner = document.createElement('div');
  banner.className = 'alert-strip demo-strip';
  banner.setAttribute('role','status');
  banner.innerHTML = `<i class="bi bi-info-circle-fill" aria-hidden="true"></i><div><div class="alert-item"><b>Demo data</b> — showing sample fleet data because the backend isn't connected yet. Connect the API to see live data.</div></div>`;
  el.prepend(banner);
}

// ---------- REFRESH ----------
async function refreshAll(){
  try{
    [VEHICLES, DRIVERS, TRIPS, MAINT] = await Promise.all([
      apiGet('/vehicles'), apiGet('/drivers'), apiGet('/trips').catch(()=>[]), apiGet('/maintenance').catch(()=>[])
    ]);
    REPORTS = await apiGet('/reports').catch(()=>[]);
    DEMO_MODE = false;
  }catch(err){
    const demo = buildDemoData();
    VEHICLES = demo.vehicles; DRIVERS = demo.drivers; TRIPS = demo.trips; MAINT = demo.maint; REPORTS = demo.reports;
    DEMO_MODE = true;
    toast('Backend not reachable — showing demo data', false);
  }
  renderVehicles(); renderDrivers(); renderTrips(); renderMaint(); renderDashboard(); renderReports(); fillDropdowns(); fillRegionFilter();
  if(DEMO_MODE) showDemoBanner();
}

function applyFilters(list){
  return list.filter(v=>
    (!ACTIVE_FILTERS.type || v.type === ACTIVE_FILTERS.type) &&
    (!ACTIVE_FILTERS.status || v.status === ACTIVE_FILTERS.status) &&
    (!ACTIVE_FILTERS.region || v.region === ACTIVE_FILTERS.region)
  );
}
function renderVehicles(){
  const el = document.getElementById('vehicleTable');
  const list = applyFilters(VEHICLES);
  if(!list.length){ el.innerHTML = emptyRow(9,'bi-truck-front','No vehicles match — add one above or reset filters.'); return; }
  el.innerHTML = list.map(v=>{
    const retireBtn = v.status !== 'Retired' && v.status !== 'On Trip'
      ? `<button class="btn btn-sm btn-outline-secondary" onclick="retireVehicle(${v.id})">Retire</button>` : '';
    return `<tr>${statusCell(v.id, v.status)}<td>${v.registration_number}</td><td>${v.model||'-'}</td><td>${v.type||'-'}</td>
    <td>${v.region||'-'}</td><td>${fmtNum(v.odometer,0)} km</td><td>${fmtNum(v.max_load_capacity,0)} kg</td><td>${statusBadge(v.status)}</td><td>${retireBtn}</td></tr>`;
  }).join('');
}
async function retireVehicle(id){
  if(!confirm('Retire this vehicle? It will be permanently removed from dispatch.')) return;
  await apiPut(`/vehicles/${id}/retire`); toast('Vehicle retired'); refreshAll();
}
function renderDrivers(){
  const el = document.getElementById('driverTable');
  if(!DRIVERS.length){ el.innerHTML = emptyRow(8,'bi-person-badge','No drivers yet — add one above.'); return; }
  const now = new Date();
  el.innerHTML = DRIVERS.map(d=>{
    let expiryCell = d.license_expiry_date||'-';
    if(d.license_expiry_date){
      const days = Math.ceil((new Date(d.license_expiry_date)-now)/86400000);
      if(days < 0) expiryCell = `${d.license_expiry_date} <i class="bi bi-exclamation-triangle-fill text-danger" title="Expired" aria-label="Expired"></i>`;
      else if(days <= 30) expiryCell = `${d.license_expiry_date} <i class="bi bi-exclamation-triangle-fill text-warning" title="Expires in ${days}d" aria-label="Expires in ${days} days"></i>`;
    }
    return `<tr>${statusCell(d.id, d.status)}<td>${d.name}</td><td>${d.license_number}</td><td>${d.license_category||'-'}</td>
    <td>${d.contact_number||'-'}</td><td>${expiryCell}</td>
    <td>${d.safety_score??'-'}</td><td>${statusBadge(d.status)}</td></tr>`;
  }).join('');
}
function renderTrips(){
  const el = document.getElementById('tripTable');
  if(!TRIPS.length){ el.innerHTML = emptyRow(8,'bi-signpost-split','No trips yet — dispatch one above.'); return; }
  el.innerHTML = TRIPS.map(t=>{
    const veh = VEHICLES.find(v=>v.id===t.vehicle_id);
    const drv = DRIVERS.find(d=>d.id===t.driver_id);
    let actions = '';
    if(t.trip_status === 'Dispatched'){
      actions = `<button class="btn btn-sm btn-outline-success me-1" onclick="completeTrip(${t.id})">Complete</button>
                 <button class="btn btn-sm btn-outline-danger" onclick="cancelTrip(${t.id})">Cancel</button>`;
    }
    return `<tr>${statusCell(t.id, t.trip_status)}<td>${t.source} → ${t.destination}</td><td>${veh?veh.registration_number:t.vehicle_id}</td>
      <td>${drv?drv.name:t.driver_id}</td><td>${fmtNum(t.cargo_weight,0)} kg</td><td>${fmtNum(t.planned_distance,0)} km</td><td>${statusBadge(t.trip_status)}</td><td>${actions}</td></tr>`;
  }).join('');
}
function renderMaint(){
  const el = document.getElementById('maintTable');
  if(!MAINT.length){ el.innerHTML = emptyRow(5,'bi-tools','No maintenance records yet.'); return; }
  el.innerHTML = MAINT.map(m=>{
    const veh = VEHICLES.find(v=>v.id===m.vehicle_id);
    const action = m.status==='Active' ? `<button class="btn btn-sm btn-outline-success" onclick="closeMaint(${m.id})">Close</button>` : '';
    return `<tr>${statusCell(m.id, m.status)}<td>${veh?veh.registration_number:m.vehicle_id}</td><td>${m.description}</td><td>${statusBadge(m.status)}</td><td>${action}</td></tr>`;
  }).join('');
}

function fillRegionFilter(){
  const regions = [...new Set(VEHICLES.map(v=>v.region).filter(Boolean))];
  const sel = document.getElementById('filter_region');
  const current = sel.value;
  sel.innerHTML = '<option value="">All Regions</option>' + regions.map(r=>`<option value="${r}">${r}</option>`).join('');
  sel.value = current;
}
['filter_type','filter_status','filter_region'].forEach(id=>{
  on(id, 'change', e=>{
    const key = id.replace('filter_','');
    ACTIVE_FILTERS[key] = e.target.value;
    renderVehicles(); renderDashboard();
  });
});
on('filterResetBtn', 'click', ()=>{
  ACTIVE_FILTERS = { type:'', status:'', region:'' };
  ['filter_type','filter_status','filter_region'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  renderVehicles(); renderDashboard();
});

function renderReports(){
  const el = document.getElementById('reportsTable');
  if(!REPORTS.length){ el.innerHTML = emptyRow(7,'bi-bar-chart-line','No report data yet — add vehicles, fuel logs, and expenses first.'); return; }
  el.innerHTML = REPORTS.map(r=>`
    <tr>${statusCell(r.vehicle_id, r.status)}<td>${r.type||'-'}</td><td>${r.region||'-'}</td><td>${statusBadge(r.status)}</td>
    <td>${fmtNum(r.fuel_efficiency)} km/L</td><td>${fmtCurrency(r.total_operational_cost)}</td><td>${fmtNum(r.roi)}%</td></tr>`).join('');
}
on('csvExportBtn', 'click', ()=>{
  if(!REPORTS.length){ toast('No report data to export', false); return; }
  const headers = ['Reg No','Type','Region','Status','Fuel Efficiency (km/L)','Operational Cost','ROI'];
  const rows = REPORTS.map(r=>[r.registration_number,r.type,r.region,r.status,r.fuel_efficiency,r.total_operational_cost,r.roi]);
  const csv = [headers, ...rows].map(row=>row.join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'transitops_fleet_report.csv';
  link.click();
  toast('CSV exported');
});

function fillDropdowns(){
  // PDF 4: Retired/In Shop vehicles never in dispatch pool; expired-license/Suspended drivers excluded; On Trip excluded either way
  const now = new Date();
  const availVeh = VEHICLES.filter(v=>v.status==='Available');
  const availDrv = DRIVERS.filter(d=>{
    if(d.status!=='Available') return false;
    if(d.license_expiry_date && new Date(d.license_expiry_date) < now) return false;
    return true;
  });
  const vehOpts = VEHICLES.map(v=>`<option value="${v.id}">${v.registration_number}</option>`).join('');
  document.getElementById('t_vehicle').innerHTML = '<option value="">Vehicle...</option>' + availVeh.map(v=>`<option value="${v.id}">${v.registration_number} (max ${v.max_load_capacity}kg)</option>`).join('');
  document.getElementById('t_driver').innerHTML = '<option value="">Driver...</option>' + availDrv.map(d=>`<option value="${d.id}">${d.name}</option>`).join('');
  ['m_vehicle','f_vehicle','e_vehicle','cost_vehicle'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.innerHTML = '<option value="">Vehicle...</option>' + vehOpts;
  });
}

// ---------- KPI count-up ----------
function animateValue(el, end, suffix=''){
  const isNumber = typeof end === 'number';
  if(!isNumber){ el.textContent = end; return; }
  let start = 0;
  const duration = 600;
  const startTime = performance.now();
  function tick(now){
    const progress = Math.min((now-startTime)/duration, 1);
    const val = Math.round(start + (end-start)*progress);
    el.textContent = val + suffix;
    if(progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function renderDashboard(){
  const active = VEHICLES.filter(v=>v.status!=='Retired').length;
  const available = VEHICLES.filter(v=>v.status==='Available').length;
  const inShop = VEHICLES.filter(v=>v.status==='In Shop').length;
  const onTrip = VEHICLES.filter(v=>v.status==='On Trip').length;
  const activeTrips = TRIPS.filter(t=>t.trip_status==='Dispatched').length;
  const pendingTrips = TRIPS.filter(t=>t.trip_status==='Draft').length;
  const driversOnDuty = DRIVERS.filter(d=>d.status==='On Trip').length;
  const util = active ? Math.round((onTrip/active)*100) : 0;

  // PDF 3.2: Active Vehicles, Available Vehicles, Vehicles in Maintenance, Active Trips,
  // Pending Trips, Drivers On Duty, Fleet Utilization (%)
  const kpis = [
    ['Active Vehicles', active, 'bi-truck-front', ''],
    ['Available', available, 'bi-check-circle', ''],
    ['In Maintenance', inShop, 'bi-tools', ''],
    ['Active Trips', activeTrips, 'bi-signpost-split', ''],
    ['Pending Trips', pendingTrips, 'bi-hourglass-split', ''],
    ['Drivers On Duty', driversOnDuty, 'bi-person-workspace', ''],
    ['Fleet Utilization', util, 'bi-graph-up', '%'],
  ];
  document.getElementById('kpiRow').innerHTML = kpis.map(([label,val,icon],i)=>`
    <div class="col"><div class="kpi-card card">
      <div class="d-flex justify-content-between"><div>
        <div class="kpi-value" id="kpi-${i}">0</div><div class="kpi-label">${label}</div>
      </div><i class="bi ${icon} fs-3" style="color:var(--odoo-purple); opacity:.6;" aria-hidden="true"></i></div>
    </div></div>`).join('');
  kpis.forEach(([label,val,icon,suffix],i)=> animateValue(document.getElementById('kpi-'+i), val, suffix));

  // Alert strip: expiring licenses + vehicles in shop
  const now = new Date();
  const expiring = DRIVERS.filter(d=>{
    if(!d.license_expiry_date) return false;
    const days = Math.ceil((new Date(d.license_expiry_date)-now)/86400000);
    return days <= 30;
  });
  const alertsEl = document.getElementById('alertStrip');
  if(expiring.length || inShop){
    let items = '';
    if(expiring.length) items += `<div class="alert-item">⚠ <b>${expiring.length}</b> driver license(s) expired or expiring within 30 days</div>`;
    if(inShop) items += `<div class="alert-item">🔧 <b>${inShop}</b> vehicle(s) currently in maintenance</div>`;
    alertsEl.innerHTML = `<div class="alert-strip" role="status"><i class="bi bi-bell-fill" aria-hidden="true"></i><div>${items}</div></div>`;
  } else {
    alertsEl.innerHTML = '';
  }

  drawChart('statusChart', 'doughnut', ['Available','On Trip','In Shop','Retired'],
    ['Available','On Trip','In Shop','Retired'].map(s=>VEHICLES.filter(v=>v.status===s).length),
    ['Available','On Trip','In Shop','Retired'].map(s=>STATUS_COLOR[s]),
    'Vehicle Status Breakdown');
  drawChart('tripChart', 'bar', ['Draft','Dispatched','Completed','Cancelled'],
    ['Draft','Dispatched','Completed','Cancelled'].map(s=>TRIPS.filter(t=>t.trip_status===s).length),
    ['Draft','Dispatched','Completed','Cancelled'].map(s=>STATUS_COLOR[s]),
    'Trips by Status');
}
let chartRefs = {};
function drawChart(id, type, labels, data, colors, title){
  if(chartRefs[id]) chartRefs[id].destroy();
  chartRefs[id] = new Chart(document.getElementById(id), {
    type, data:{labels, datasets:[{data, backgroundColor:colors}]},
    options:{plugins:{title:{display:true, text:title}}, responsive:true}
  });
}

// ---------- FORMS ----------
on('vehicleForm', 'submit', async e=>{
  e.preventDefault();
  await apiPost('/vehicles', {
    registration_number: v_reg.value, model: v_model.value, type: v_type.value,
    max_load_capacity: parseFloat(v_load.value),
    odometer: parseFloat(v_odometer.value) || 0,
    region: v_region.value || 'Unassigned',
    acquisition_cost: parseFloat(v_cost.value) || 0
  });
  toast('Vehicle added'); e.target.reset(); refreshAll();
});

on('driverForm', 'submit', async e=>{
  e.preventDefault();
  await apiPost('/drivers', {
    name: d_name.value, license_number: d_license.value,
    license_category: d_license_category.value,
    contact_number: d_contact.value,
    license_expiry_date: d_expiry.value
  });
  toast('Driver added'); e.target.reset(); refreshAll();
});

on('tripForm', 'submit', async e=>{
  e.preventDefault();
  // Guard rails per PDF 4 (server should also enforce these)
  const vehId = parseInt(t_vehicle.value);
  const drvId = parseInt(t_driver.value);
  const cargo = parseFloat(t_cargo.value);
  const veh = VEHICLES.find(v=>v.id===vehId);
  if(veh && cargo > veh.max_load_capacity){
    toast(`Cargo weight (${cargo}kg) exceeds vehicle max load (${veh.max_load_capacity}kg)`, false);
    return;
  }
  await apiPost('/trips', {
    source: t_source.value, destination: t_dest.value,
    vehicle_id: vehId, driver_id: drvId,
    cargo_weight: cargo,
    planned_distance: parseFloat(t_distance.value) || 0
  });
  toast('Trip dispatched'); e.target.reset(); refreshAll();
});
async function completeTrip(id){ await apiPut(`/trips/${id}/complete`); toast('Trip completed'); refreshAll(); }
async function cancelTrip(id){
  if(!confirm('Cancel this trip? The vehicle and driver will be freed up.')) return;
  await apiPut(`/trips/${id}/cancel`); toast('Trip cancelled'); refreshAll();
}

on('maintForm', 'submit', async e=>{
  e.preventDefault();
  await apiPost('/maintenance', { vehicle_id: parseInt(m_vehicle.value), description: m_desc.value });
  toast('Vehicle sent to shop'); e.target.reset(); refreshAll();
});
async function closeMaint(id){ await apiPut(`/maintenance/${id}/close`); toast('Maintenance closed'); refreshAll(); }

on('fuelForm', 'submit', async e=>{
  e.preventDefault();
  await apiPost('/fuel', { vehicle_id: parseInt(f_vehicle.value), liters: parseFloat(f_liters.value), cost: parseFloat(f_cost.value) });
  toast('Fuel log added'); e.target.reset();
});
on('expForm', 'submit', async e=>{
  e.preventDefault();
  await apiPost('/expenses', { vehicle_id: parseInt(e_vehicle.value), type: e_type.value, amount: parseFloat(e_amount.value) });
  toast('Expense added'); e.target.reset();
});
on('costLookupBtn', 'click', async ()=>{
  const id = cost_vehicle.value;
  if(!id){ toast('Pick a vehicle first', false); return; }
  const data = await apiGet(`/vehicles/${id}/cost`);
  document.getElementById('costResult').innerHTML =
    `Fuel: <b>${fmtCurrency(data.total_fuel_cost)}</b> &nbsp;|&nbsp; Expenses: <b>${fmtCurrency(data.total_expense_cost)}</b> &nbsp;|&nbsp; Total: <b>${fmtCurrency(data.total_operational_cost)}</b>`;
});
on('vehicleSearch', 'input', e=>{
  const q = e.target.value.toLowerCase();
  const filtered = VEHICLES.filter(v=>v.registration_number.toLowerCase().includes(q));
  const el = document.getElementById('vehicleTable');
  if(!filtered.length){ el.innerHTML = emptyRow(9,'bi-search','No matching vehicles.'); return; }
  el.innerHTML = filtered.map(v=>{
    const retireBtn = v.status !== 'Retired' && v.status !== 'On Trip'
      ? `<button class="btn btn-sm btn-outline-secondary" onclick="retireVehicle(${v.id})">Retire</button>` : '';
    return `<tr>${statusCell(v.id, v.status)}<td>${v.registration_number}</td><td>${v.model||'-'}</td><td>${v.type||'-'}</td>
    <td>${v.region||'-'}</td><td>${fmtNum(v.odometer,0)} km</td><td>${fmtNum(v.max_load_capacity,0)} kg</td><td>${statusBadge(v.status)}</td><td>${retireBtn}</td></tr>`;
  }).join('');
});

// auto-login if session exists
boot();