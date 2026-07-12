const API = 'http://127.0.0.1:5000';
let VEHICLES = [], DRIVERS = [], TRIPS = [], MAINT = [];

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

// ---------- AUTH ----------
document.getElementById('signInBtn').addEventListener('click', function(){
  try{
    const role = document.getElementById('loginRole').value;
    const email = document.getElementById('loginEmail').value || 'user@transitops.com';
    sessionStorage.setItem('to_user', JSON.stringify({email, role}));
    boot();
  }catch(err){
    const el = document.getElementById('loginError');
    el.style.display = 'block';
    el.textContent = 'Login error: ' + err.message;
    console.error(err);
  }
});
document.getElementById('logoutBtn').addEventListener('click', ()=>{
  sessionStorage.removeItem('to_user');
  location.reload();
});
function boot(){
  const user = JSON.parse(sessionStorage.getItem('to_user') || 'null');
  if(!user){ return; }
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('userChip').innerHTML = `<i class="bi bi-person-circle"></i> ${user.email} <span class="badge bg-secondary ms-1">${user.role}</span>`;
  showSkeletons();
  refreshAll();
}

// ---------- THEME ----------
document.getElementById('themeToggle').addEventListener('click', ()=>{
  document.body.classList.toggle('dark');
  const icon = document.querySelector('#themeToggle i');
  const isDark = document.body.classList.contains('dark');
  icon.className = isDark ? 'bi bi-sun' : 'bi bi-moon-stars';
  sessionStorage.setItem('to_theme', isDark ? 'dark' : 'light');
});
if(sessionStorage.getItem('to_theme') === 'dark'){
  document.body.classList.add('dark');
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
  el.className = `toast align-items-center text-bg-${ok?'success':'danger'} border-0 show`;
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div></div>`;
  document.getElementById('toastHost').appendChild(el);
  setTimeout(()=>el.remove(), 3500);
}

// ---------- API HELPERS ----------
async function apiGet(path){ const r = await fetch(API+path); return r.json(); }
async function apiPost(path, body){
  const r = await fetch(API+path, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
  const data = await r.json();
  if(!r.ok){ toast(data.error || 'Error', false); throw new Error(data.error); }
  return data;
}
async function apiPut(path){
  const r = await fetch(API+path, {method:'PUT'});
  const data = await r.json();
  if(!r.ok){ toast(data.error || 'Error', false); throw new Error(data.error); }
  return data;
}

// ---------- SKELETONS ----------
function showSkeletons(){
  document.getElementById('vehicleTable').innerHTML = skeletonRows(6);
  document.getElementById('driverTable').innerHTML = skeletonRows(6);
  document.getElementById('tripTable').innerHTML = skeletonRows(7);
  document.getElementById('maintTable').innerHTML = skeletonRows(5);
}

// ---------- REFRESH ----------
async function refreshAll(){
  try{
    [VEHICLES, DRIVERS, TRIPS, MAINT] = await Promise.all([
      apiGet('/vehicles'), apiGet('/drivers'), apiGet('/trips').catch(()=>[]), apiGet('/maintenance').catch(()=>[])
    ]);
  }catch(err){ toast('Cannot reach backend at '+API+' — is app.py running with CORS enabled?', false); return; }
  renderVehicles(); renderDrivers(); renderTrips(); renderMaint(); renderDashboard(); fillDropdowns();
}

function renderVehicles(){
  const el = document.getElementById('vehicleTable');
  if(!VEHICLES.length){ el.innerHTML = emptyRow(6,'bi-truck-front','No vehicles yet — add one above.'); return; }
  el.innerHTML = VEHICLES.map(v=>`
    <tr>${statusCell(v.id, v.status)}<td>${v.registration_number}</td><td>${v.model||'-'}</td><td>${v.type||'-'}</td>
    <td>${v.max_load_capacity||'-'} kg</td><td>${statusBadge(v.status)}</td></tr>`).join('');
}
function renderDrivers(){
  const el = document.getElementById('driverTable');
  if(!DRIVERS.length){ el.innerHTML = emptyRow(6,'bi-person-badge','No drivers yet — add one above.'); return; }
  const now = new Date();
  el.innerHTML = DRIVERS.map(d=>{
    let expiryCell = d.license_expiry_date||'-';
    if(d.license_expiry_date){
      const days = Math.ceil((new Date(d.license_expiry_date)-now)/86400000);
      if(days < 0) expiryCell = `${d.license_expiry_date} <i class="bi bi-exclamation-triangle-fill text-danger" title="Expired"></i>`;
      else if(days <= 30) expiryCell = `${d.license_expiry_date} <i class="bi bi-exclamation-triangle-fill text-warning" title="Expires in ${days}d"></i>`;
    }
    return `<tr>${statusCell(d.id, d.status)}<td>${d.name}</td><td>${d.license_number}</td><td>${expiryCell}</td>
    <td>${d.safety_score??'-'}</td><td>${statusBadge(d.status)}</td></tr>`;
  }).join('');
}
function renderTrips(){
  const el = document.getElementById('tripTable');
  if(!TRIPS.length){ el.innerHTML = emptyRow(7,'bi-signpost-split','No trips yet — dispatch one above.'); return; }
  el.innerHTML = TRIPS.map(t=>{
    const veh = VEHICLES.find(v=>v.id===t.vehicle_id);
    const drv = DRIVERS.find(d=>d.id===t.driver_id);
    let actions = '';
    if(t.trip_status === 'Dispatched'){
      actions = `<button class="btn btn-sm btn-outline-success me-1" onclick="completeTrip(${t.id})">Complete</button>
                 <button class="btn btn-sm btn-outline-danger" onclick="cancelTrip(${t.id})">Cancel</button>`;
    }
    return `<tr>${statusCell(t.id, t.trip_status)}<td>${t.source} → ${t.destination}</td><td>${veh?veh.registration_number:t.vehicle_id}</td>
      <td>${drv?drv.name:t.driver_id}</td><td>${t.cargo_weight} kg</td><td>${statusBadge(t.trip_status)}</td><td>${actions}</td></tr>`;
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

function fillDropdowns(){
  const availVeh = VEHICLES.filter(v=>v.status==='Available');
  const availDrv = DRIVERS.filter(d=>d.status==='Available');
  const vehOpts = VEHICLES.map(v=>`<option value="${v.id}">${v.registration_number}</option>`).join('');
  document.getElementById('t_vehicle').innerHTML = '<option value="">Vehicle...</option>' + availVeh.map(v=>`<option value="${v.id}">${v.registration_number} (max ${v.max_load_capacity}kg)</option>`).join('');
  document.getElementById('t_driver').innerHTML = '<option value="">Driver...</option>' + availDrv.map(d=>`<option value="${d.id}">${d.name}</option>`).join('');
  ['m_vehicle','f_vehicle','e_vehicle','cost_vehicle'].forEach(id=>{
    document.getElementById(id).innerHTML = '<option value="">Vehicle...</option>' + vehOpts;
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
  const util = active ? Math.round((onTrip/active)*100) : 0;

  const kpis = [
    ['Active Vehicles', active, 'bi-truck-front', ''],
    ['Available', available, 'bi-check-circle', ''],
    ['In Maintenance', inShop, 'bi-tools', ''],
    ['Active Trips', activeTrips, 'bi-signpost-split', ''],
    ['Fleet Utilization', util, 'bi-graph-up', '%'],
  ];
  document.getElementById('kpiRow').innerHTML = kpis.map(([label,val,icon],i)=>`
    <div class="col"><div class="kpi-card card">
      <div class="d-flex justify-content-between"><div>
        <div class="kpi-value" id="kpi-${i}">0</div><div class="kpi-label">${label}</div>
      </div><i class="bi ${icon} fs-3" style="color:var(--odoo-purple); opacity:.6;"></i></div>
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
    alertsEl.innerHTML = `<div class="alert-strip"><i class="bi bi-bell-fill"></i><div>${items}</div></div>`;
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
document.getElementById('vehicleForm').addEventListener('submit', async e=>{
  e.preventDefault();
  await apiPost('/vehicles', {
    registration_number: v_reg.value, model: v_model.value, type: v_type.value,
    max_load_capacity: parseFloat(v_load.value)
  });
  toast('Vehicle added'); e.target.reset(); refreshAll();
});

document.getElementById('driverForm').addEventListener('submit', async e=>{
  e.preventDefault();
  await apiPost('/drivers', {
    name: d_name.value, license_number: d_license.value, license_expiry_date: d_expiry.value
  });
  toast('Driver added'); e.target.reset(); refreshAll();
});

document.getElementById('tripForm').addEventListener('submit', async e=>{
  e.preventDefault();
  await apiPost('/trips', {
    source: t_source.value, destination: t_dest.value,
    vehicle_id: parseInt(t_vehicle.value), driver_id: parseInt(t_driver.value),
    cargo_weight: parseFloat(t_cargo.value)
  });
  toast('Trip dispatched'); e.target.reset(); refreshAll();
});
async function completeTrip(id){ await apiPut(`/trips/${id}/complete`); toast('Trip completed'); refreshAll(); }
async function cancelTrip(id){
  if(!confirm('Cancel this trip? The vehicle and driver will be freed up.')) return;
  await apiPut(`/trips/${id}/cancel`); toast('Trip cancelled'); refreshAll();
}

document.getElementById('maintForm').addEventListener('submit', async e=>{
  e.preventDefault();
  await apiPost('/maintenance', { vehicle_id: parseInt(m_vehicle.value), description: m_desc.value });
  toast('Vehicle sent to shop'); e.target.reset(); refreshAll();
});
async function closeMaint(id){ await apiPut(`/maintenance/${id}/close`); toast('Maintenance closed'); refreshAll(); }

document.getElementById('fuelForm').addEventListener('submit', async e=>{
  e.preventDefault();
  await apiPost('/fuel', { vehicle_id: parseInt(f_vehicle.value), liters: parseFloat(f_liters.value), cost: parseFloat(f_cost.value) });
  toast('Fuel log added'); e.target.reset();
});
document.getElementById('expForm').addEventListener('submit', async e=>{
  e.preventDefault();
  await apiPost('/expenses', { vehicle_id: parseInt(e_vehicle.value), type: e_type.value, amount: parseFloat(e_amount.value) });
  toast('Expense added'); e.target.reset();
});
document.getElementById('costLookupBtn').addEventListener('click', async ()=>{
  const id = cost_vehicle.value;
  if(!id){ toast('Pick a vehicle first', false); return; }
  const data = await apiGet(`/vehicles/${id}/cost`);
  document.getElementById('costResult').innerHTML =
    `Fuel: <b>${data.total_fuel_cost}</b> &nbsp;|&nbsp; Expenses: <b>${data.total_expense_cost}</b> &nbsp;|&nbsp; Total: <b>${data.total_operational_cost}</b>`;
});
document.getElementById('vehicleSearch').addEventListener('input', e=>{
  const q = e.target.value.toLowerCase();
  const filtered = VEHICLES.filter(v=>v.registration_number.toLowerCase().includes(q));
  const el = document.getElementById('vehicleTable');
  if(!filtered.length){ el.innerHTML = emptyRow(6,'bi-search','No matching vehicles.'); return; }
  el.innerHTML = filtered.map(v=>`<tr>${statusCell(v.id, v.status)}<td>${v.registration_number}</td><td>${v.model||'-'}</td><td>${v.type||'-'}</td>
    <td>${v.max_load_capacity||'-'} kg</td><td>${statusBadge(v.status)}</td></tr>`).join('');
});

// auto-login if session exists
boot();