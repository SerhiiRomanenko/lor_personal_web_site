/* ===================== STATE ===================== */
let adminToken = sessionStorage.getItem('adminToken') || '';
let appointmentsChart = null;
let servicesChart = null;
let statusChart = null;

const overlay = document.getElementById('loginOverlay');
const app = document.getElementById('app');
const sidebar = document.getElementById('sidebar');
const pageTitle = document.getElementById('pageTitle');

/* ===================== AUTH ===================== */
if (adminToken) verifyToken();

async function verifyToken() {
  try {
    const r = await fetch(API_BASE_URL + '/api/appointments?token=' + encodeURIComponent(adminToken));
    if (r.ok) showApp();
    else { sessionStorage.removeItem('adminToken'); adminToken = ''; }
  } catch(e) { /* ignore */ }
}

document.getElementById('loginForm').addEventListener('submit', e => {
  e.preventDefault();
  const pwd = document.getElementById('adminPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  fetch(API_BASE_URL + '/api/appointments?token=' + encodeURIComponent(pwd))
    .then(r => {
      if (r.ok) { adminToken = pwd; sessionStorage.setItem('adminToken', adminToken); showApp(); }
      else errEl.textContent = 'Невірний пароль';
    })
    .catch(() => { errEl.textContent = "Помилка з'єднання"; });
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  adminToken = '';
  sessionStorage.removeItem('adminToken');
  app.style.display = 'none';
  overlay.style.display = 'flex';
  document.getElementById('adminPassword').value = '';
});

function showApp() {
  overlay.style.display = 'none';
  app.style.display = 'flex';
  if (window.lucide) lucide.createIcons();
  navigateTo('dashboard');
}

/* ===================== NAV ===================== */
const pageTitles = {
  dashboard: 'Огляд',
  appointments: 'Записи',
  services: 'Послуги',
  faq: 'FAQ',
  contacts: 'Контакти',
  analytics: 'Аналітика',
};

function navigateTo(page) {
  // console.log('[NAV] navigating to:', page);
  try {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.sidebar-item').forEach(i =>
      i.classList.toggle('active', i.dataset.page === page)
    );
    const el = document.getElementById('page-' + page);
    if (el) el.style.display = 'block';
    pageTitle.textContent = pageTitles[page] || '';
    // console.log('[NAV] page element:', el ? 'found' : 'MISSING');

    const loaders = {
      dashboard: loadDashboard,
      appointments: loadAppointments,
      services: loadServices,
      faq: loadFaq,
      contacts: loadContacts,
      analytics: loadAnalytics,
    };
    const loader = loaders[page];
    if (loader) loader().catch(err => console.error('[NAV] load error:', page, err));
  } catch(e) { console.error('[NAV] error:', e); }
}

document.querySelectorAll('.sidebar-item[data-page]').forEach(item => {
  item.addEventListener('click', e => {
    // console.log('[CLICK] sidebar:', item.dataset.page);
    e.preventDefault();
    navigateTo(item.dataset.page);
    closeMobileSidebar();
  });
});
document.querySelectorAll('[data-nav]').forEach(link => {
  link.addEventListener('click', e => {
    console.log('[CLICK] nav:', link.dataset.nav);
    e.preventDefault();
    navigateTo(link.dataset.nav);
  });
});

document.getElementById('sidebarToggle').addEventListener('click', () =>
  sidebar.classList.toggle('collapsed')
);
document.getElementById('topbarMenu').addEventListener('click', () =>
  sidebar.classList.toggle('mobile-open')
);
function closeMobileSidebar() {
  if (window.innerWidth <= 768) sidebar.classList.remove('mobile-open');
}

document.getElementById('todayBtn').addEventListener('click', () => {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('dateFrom').value = today;
  document.getElementById('dateTo').value = today;
  navigateTo('appointments');
});

/* ===================== DASHBOARD ===================== */
async function loadDashboard() {
  const all = await fetchAll('/api/appointments');
  document.getElementById('totalCount').textContent = all.length;
  document.getElementById('pendingCount').textContent = all.filter(a => a.status === 'pending').length;
  document.getElementById('confirmedCount').textContent = all.filter(a => a.status === 'confirmed').length;
  document.getElementById('cancelledCount').textContent = all.filter(a => a.status === 'cancelled').length;
  renderRecent(all.slice(0, 5));
  loadChart('week');
}

function renderRecent(items) {
  const container = document.getElementById('recentList');
  if (!items.length) {
    container.innerHTML = '<p style="color:var(--g);font-size:14px;text-align:center;padding:20px">Заявок поки немає</p>';
    return;
  }
  container.innerHTML = items.map(a => `
    <div class="recent-item">
      <div class="recent-item-left">
        <span class="recent-name">${esc(a.name)}</span>
        <span class="recent-service">${esc(a.service)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="badge badge--${a.status}">${statusLabel(a.status)}</span>
        <span class="recent-date">${fmtDate(a.preferred_date)}</span>
      </div>
    </div>`).join('');
}

async function loadChart(range) {
  document.querySelectorAll('.chart-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.range === range)
  );
  const now = new Date();
  const to = iso(now);
  let from;
  if (range === 'week') from = iso(new Date(now.getTime() - 7 * 86400000));
  else if (range === 'month') from = iso(new Date(now.getTime() - 30 * 86400000));
  else if (range === 'today') from = iso(now);
  else from = '2020-01-01';

  const stats = await fetchAll('/api/appointments/stats?from=' + from + '&to=' + to);
  const dateMap = {};
  const dates = [];
  const d = new Date(from + 'T00:00:00');
  const nowD = new Date(to + 'T00:00:00');
  while (d <= nowD) {
    const key = iso(d);
    dates.push(key);
    dateMap[key] = { pending: 0, confirmed: 0, cancelled: 0 };
    d.setDate(d.getDate() + 1);
  }
  stats.forEach(s => { if (dateMap[s.date] !== undefined) dateMap[s.date][s.status] = s.count; });
  const labels = dates.map(dd => {
    const dt = new Date(dd + 'T00:00:00');
    return dt.getDate().toString().padStart(2, '0') + '.' + (dt.getMonth() + 1).toString().padStart(2, '0');
  });
  const datasets = [
    { label: 'Очікують', data: dates.map(dd => dateMap[dd].pending), backgroundColor: '#f59e0b' },
    { label: 'Підтверджено', data: dates.map(dd => dateMap[dd].confirmed), backgroundColor: '#22c55e' },
    { label: 'Скасовано', data: dates.map(dd => dateMap[dd].cancelled), backgroundColor: '#ef4444' },
  ];
  if (appointmentsChart) appointmentsChart.destroy();
  appointmentsChart = new Chart(document.getElementById('appointmentsChart'), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { font: { family: 'Inter' }, usePointStyle: true, pointStyle: 'circle' } } },
      scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } },
    },
  });
}

(function setupChartTabs() {
  document.querySelectorAll('.chart-tab').forEach(btn => {
    btn.addEventListener('click', () => loadChart(btn.dataset.range));
  });
})();

/* ===================== CALENDAR ===================== */
let calView = 'day';
let calDate = new Date();
let calAppointments = [];

const dayNames = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const dayNamesFull = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', "Четвер", "П'ятниця", 'Субота'];
const monthNames = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00 — 20:00

async function loadAppointments() {
  // console.log('[CAL] loading appointments');
  const all = await fetchAll('/api/appointments');
  calAppointments = all;

  // Seed mock data if empty
  if (all.length === 0) seedMockAppointments();

  renderCalendar();
  updateCurrentTimeLine();
  setInterval(updateCurrentTimeLine, 60000);
}

function seedMockAppointments() {
  const today = iso(new Date());
  const tomorrow = iso(new Date(Date.now() + 86400000));
  const d3 = iso(new Date(Date.now() + 2 * 86400000));
  const d4 = iso(new Date(Date.now() + 3 * 86400000));
  const mocks = [
    { preferred_date: today, appt_time: '09:00', name: 'Олена К.', service: 'Консультація ЛОР-лікаря', status: 'confirmed' },
    { preferred_date: today, appt_time: '10:00', name: 'Андрій М.', service: 'Лікування отиту', status: 'pending' },
    { preferred_date: today, appt_time: '11:30', name: 'Марія С.', service: 'Дитяча отоларингологія', status: 'confirmed' },
    { preferred_date: today, appt_time: '14:00', name: 'Тарас В.', service: 'Лікування синуситу', status: 'confirmed' },
    { preferred_date: today, appt_time: '15:30', name: 'Інна Л.', service: 'Алергічний риніт', status: 'pending' },
    { preferred_date: tomorrow, appt_time: '09:30', name: 'Олександр Р.', service: 'Аденотомія', status: 'confirmed' },
    { preferred_date: tomorrow, appt_time: '11:00', name: 'Наталія П.', service: 'Консультація ЛОР-лікаря', status: 'pending' },
    { preferred_date: d3, appt_time: '10:00', name: 'Віктор Д.', service: 'Парацентез', status: 'confirmed' },
    { preferred_date: d3, appt_time: '13:00', name: 'Софія Б.', service: 'Лікування отиту', status: 'pending' },
    { preferred_date: d4, appt_time: '09:00', name: 'Дмитро Ш.', service: 'Видалення поліпів', status: 'confirmed' },
    { preferred_date: today, appt_time: '16:00', name: 'Юлія Н.', service: 'Консультація ЛОР-лікаря', status: 'cancelled' },
  ];
  mocks.forEach(m => {
    calAppointments.push({ ...m, id: Math.random(), created_at: new Date().toISOString() });
  });
  renderCalendar();
}

function getApptsForDay(dateStr) {
  return calAppointments.filter(a => a.preferred_date === dateStr);
}

/* ---- Navigation ---- */
document.getElementById('calTodayBtn').addEventListener('click', () => {
  calDate = new Date();
  renderCalendar();
});
document.getElementById('calPrevBtn').addEventListener('click', () => {
  if (calView === 'week') calDate.setDate(calDate.getDate() - 7);
  else if (calView === 'day') calDate.setDate(calDate.getDate() - 1);
  else calDate.setMonth(calDate.getMonth() - 1);
  renderCalendar();
});
document.getElementById('calNextBtn').addEventListener('click', () => {
  if (calView === 'week') calDate.setDate(calDate.getDate() + 7);
  else if (calView === 'day') calDate.setDate(calDate.getDate() + 1);
  else calDate.setMonth(calDate.getMonth() + 1);
  renderCalendar();
});

document.querySelectorAll('.cal-view-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    calView = btn.dataset.view;
    document.querySelectorAll('.cal-view-tab').forEach(b => b.classList.toggle('active', b.dataset.view === calView));
    document.getElementById('calWeekView').style.display = calView === 'week' ? 'flex' : 'none';
    document.getElementById('calDayView').style.display = calView === 'day' ? 'flex' : 'none';
    document.getElementById('calMonthView').style.display = calView === 'month' ? 'flex' : 'none';
    renderCalendar();
  });
});

/* ---- Title ---- */
function updateTitle() {
  const el = document.getElementById('calTitle');
  const d = calDate;
  const y = d.getFullYear();
  const m = monthNames[d.getMonth()];
  if (calView === 'week') {
    const weekStart = getWeekStart(d);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (weekStart.getMonth() === weekEnd.getMonth()) {
      el.textContent = `${weekStart.getDate()} — ${weekEnd.getDate()} ${monthNames[weekStart.getMonth()]} ${y}`;
    } else {
      el.textContent = `${weekStart.getDate()} ${monthNames[weekStart.getMonth()]} — ${weekEnd.getDate()} ${monthNames[weekEnd.getMonth()]} ${y}`;
    }
  } else if (calView === 'day') {
    el.textContent = `${d.getDate()} ${m} ${y}, ${dayNamesFull[d.getDay()]}`;
  } else {
    el.textContent = `${m.charAt(0).toUpperCase() + m.slice(1)} ${y}`;
  }
}

function getWeekStart(d) {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isToday(d) {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

/* ---- Render ---- */
function renderCalendar() {
  updateTitle();
  document.getElementById('calWeekView').style.display = calView === 'week' ? 'flex' : 'none';
  document.getElementById('calDayView').style.display = calView === 'day' ? 'flex' : 'none';
  document.getElementById('calMonthView').style.display = calView === 'month' ? 'flex' : 'none';

  if (calView === 'week') renderWeek();
  else if (calView === 'day') renderDay();
  else renderMonth();
}

function renderWeek() {
  const ws = getWeekStart(calDate);
  const header = document.getElementById('calWeekHeader');
  const body = document.getElementById('calWeekBody');

  // Header
  let hHtml = '<div class="cal-week-header-cell cal-week-header-corner"></div>';
  for (let i = 0; i < 7; i++) {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    const today = isToday(d) ? ' today' : '';
    hHtml += `<div class="cal-week-header-cell${today}">${dayNames[d.getDay()]}<span class="cal-week-header-num">${d.getDate()}</span></div>`;
  }
  header.innerHTML = hHtml;

  // Body
  let bHtml = '<div class="cal-week-grid">';
  bHtml += '<div class="cal-week-times">';
  HOURS.forEach(h => {
    bHtml += `<div class="cal-week-time-label">${String(h).padStart(2, '0')}:00</div>`;
  });
  bHtml += '</div>';

  for (let i = 0; i < 7; i++) {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    const ds = iso(d);
    const today = isToday(d) ? ' today-col' : '';
    const dayAppts = getApptsForDay(ds);

    // Calculate layout for overlapping
    const layout = computeLayout(dayAppts);

    bHtml += `<div class="cal-week-col${today}" data-date="${ds}">`;
    HOURS.forEach(h => {
      bHtml += `<div class="cal-slot-line" style="top:${(h - 7) * 60}px"></div>`;
      bHtml += `<div class="cal-slot-line cal-slot-line-half" style="top:${(h - 7) * 60 + 30}px"></div>`;
    });

    layout.forEach(a => {
      const pos = timeToTop(a.appt_time || '09:00');
      const height = 50;
      const totalCols = a._group.length;
      const leftPct = (a._colIndex / totalCols) * 100;
      const widthPct = (1 / totalCols) * 100 - 2;
      bHtml += `<div class="cal-appt cal-appt--${a.status}"
        data-id="${a.id}"
        style="top:${pos}px;height:${height}px;left:${leftPct}%;width:${widthPct}%"
        onclick="openApptDetail(${a.id})">
        <div class="cal-appt-time">${fmtTime(a.appt_time || '09:00')}</div>
        <div class="cal-appt-name">${esc(a.name)}</div>
        <div class="cal-appt-service">${esc(a.service)}</div>
      </div>`;
    });

    // Click on column to create
    bHtml += `<div style="position:absolute;inset:0;z-index:1" onclick="openApptCreate('${ds}')"></div>`;
    bHtml += '</div>';
  }
  bHtml += '</div>';
  body.innerHTML = bHtml;
}

function renderDay() {
  const d = calDate;
  const ds = iso(d);
  const header = document.getElementById('calDayHeader');
  header.innerHTML = `${dayNamesFull[d.getDay()]}<span>, ${d.getDate()} ${monthNames[d.getMonth()]}</span>`;

  const body = document.getElementById('calDayBody');
  const dayAppts = getApptsForDay(ds);
  const layout = computeLayout(dayAppts);
  const today = isToday(d) ? ' today-col' : '';

  let bHtml = '<div class="cal-week-times">';
  HOURS.forEach(h => { bHtml += `<div class="cal-week-time-label">${String(h).padStart(2, '0')}:00</div>`; });
  bHtml += '</div><div class="cal-day-timeline' + today + '">';

  HOURS.forEach(h => {
    bHtml += `<div class="cal-slot-line" style="top:${(h - 7) * 60}px"></div>`;
    bHtml += `<div class="cal-slot-line cal-slot-line-half" style="top:${(h - 7) * 60 + 30}px"></div>`;
  });

  layout.forEach(a => {
    const pos = timeToTop(a.appt_time || '09:00');
    const height = 55;
    bHtml += `<div class="cal-appt cal-appt--${a.status}"
      data-id="${a.id}"
      style="top:${pos}px;height:${height}px"
      onclick="openApptDetail(${a.id})">
      <div class="cal-appt-time">${fmtTime(a.appt_time || '09:00')}</div>
      <div class="cal-appt-name">${esc(a.name)}</div>
      <div class="cal-appt-service">${esc(a.service)}</div>
    </div>`;
  });

  bHtml += `<div style="position:absolute;inset:0;z-index:1" onclick="openApptCreate('${ds}')"></div></div>`;
  body.innerHTML = bHtml;
}

function renderMonth() {
  const d = calDate;
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDay = firstDay.getDay();
  startDay = startDay === 0 ? 6 : startDay - 1;

  const header = document.getElementById('calMonthHeader');
  header.innerHTML = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(dn =>
    `<div class="cal-month-header-cell">${dn}</div>`).join('');

  const grid = document.getElementById('calMonthGrid');
  let html = '';
  const totalCells = Math.ceil((startDay + lastDay.getDate()) / 7) * 7;

  for (let i = 0; i < totalCells; i++) {
    const cellDate = new Date(year, month, 1 - startDay + i);
    const ds = iso(cellDate);
    const isTodayCell = isToday(cellDate);
    const isOther = cellDate.getMonth() !== month;
    const cls = [isTodayCell ? 'today' : '', isOther ? 'other-month' : ''].filter(Boolean).join(' ');

    const dayAppts = getApptsForDay(ds);
    html += `<div class="cal-month-cell ${cls}" onclick="calDate=new Date('${ds}');calView='day';document.querySelectorAll('.cal-view-tab').forEach(b=>b.classList.toggle('active',b.dataset.view==='day'));document.getElementById('calWeekView').style.display='none';document.getElementById('calDayView').style.display='flex';document.getElementById('calMonthView').style.display='none';renderCalendar();">`;
    html += `<div class="cal-month-cell-num">${cellDate.getDate()}</div>`;
    dayAppts.slice(0, 3).forEach(a => {
      html += `<div class="cal-month-appt cal-month-appt--${a.status}" onclick="event.stopPropagation();openApptDetail(${a.id})">${fmtTime(a.appt_time || '09:00')} ${esc(a.name)}</div>`;
    });
    if (dayAppts.length > 3) html += `<div style="font-size:10px;color:var(--g)">+${dayAppts.length - 3} ще</div>`;
    html += '</div>';
  }
  grid.innerHTML = html;
}

/* ---- Helpers ---- */
function timeToTop(t) {
  const [h, m] = t.split(':').map(Number);
  return (h - 7) * 60 + m;
}

function fmtTime(t) {
  if (!t) return '';
  return t.substring(0, 5);
}

function computeLayout(appts) {
  const sorted = [...appts].sort((a, b) => (a.appt_time || '09:00').localeCompare(b.appt_time || '09:00'));
  const groups = [];
  let group = [sorted[0]];
  if (sorted.length === 0) return [];

  for (let i = 1; i < sorted.length; i++) {
    const lastEnd = getEndTime(group[group.length - 1]);
    const curStart = sorted[i].appt_time || '09:00';
    if (curStart < lastEnd) {
      group.push(sorted[i]);
    } else {
      groups.push(group);
      group = [sorted[i]];
    }
  }
  groups.push(group);

  const result = [];
  groups.forEach(g => g.forEach((a, idx) => {
    result.push({ ...a, _group: g, _colIndex: idx });
  }));
  return result;
}

function getEndTime(a) {
  const t = a.appt_time || '09:00';
  const [h, m] = t.split(':').map(Number);
  const duration = 60;
  const totalMin = h * 60 + m + duration;
  const eh = Math.floor(totalMin / 60);
  const em = totalMin % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

function updateCurrentTimeLine() {
  const now = new Date();
  const todayStr = iso(now);
  const minutes = (now.getHours() - 7) * 60 + now.getMinutes();
  if (minutes < 0 || minutes > 14 * 60) return;

  document.querySelectorAll('.cal-week-col.today-col, .cal-day-timeline.today-col').forEach(col => {
    let line = col.querySelector('.cal-current-line');
    if (!line) {
      line = document.createElement('div');
      line.className = 'cal-current-line';
      col.appendChild(line);
    }
    line.style.top = minutes + 'px';
  });
}

/* ---- Appointment CRUD ---- */
const apptModal = document.getElementById('appointmentModal');

document.getElementById('addBtn').addEventListener('click', () => {
  document.getElementById('appointmentModalTitle').textContent = 'Новий запис';
  document.getElementById('appointmentForm').reset();
  document.getElementById('editApptId').value = '';
  const today = iso(new Date());
  document.getElementById('formDate').value = today;
  document.getElementById('formTime').value = '09:00';
  apptModal.style.display = 'flex';
});

function closeApptModal() { apptModal.style.display = 'none'; }
document.getElementById('appointmentModalClose').addEventListener('click', closeApptModal);
document.getElementById('appointmentModalCancel').addEventListener('click', closeApptModal);
apptModal.querySelector('.modal-backdrop').addEventListener('click', closeApptModal);

window.openApptCreate = function(dateStr) {
  document.getElementById('appointmentModalTitle').textContent = 'Новий запис';
  document.getElementById('appointmentForm').reset();
  document.getElementById('editApptId').value = '';
  document.getElementById('formDate').value = dateStr || iso(new Date());
  document.getElementById('formTime').value = '09:00';
  apptModal.style.display = 'flex';
};

window.openApptDetail = async function(id) {
  if (!Number.isInteger(id)) return;
  const all = await fetchAll('/api/appointments');
  const a = all.find(x => x.id === id);
  if (!a) return;
  document.getElementById('appointmentModalTitle').textContent = 'Запис — ' + a.name;
  document.getElementById('editApptId').value = id;
  document.getElementById('formName').value = a.name;
  document.getElementById('formPhone').value = a.phone;
  document.getElementById('formService').value = a.service;
  document.getElementById('formDate').value = a.preferred_date;
  buildTimeSlots(a.preferred_date, a.service);
  document.getElementById('formTime').value = a.appt_time || '09:00';
  document.getElementById('formNotes').value = a.notes || '';
  apptModal.style.display = 'flex';
};

window.openApptEdit = openApptDetail;

/* Build time slots when date or service changes */
(function setupSlotListeners() {
  const form = document.getElementById('appointmentForm');
  const dateInput = document.getElementById('formDate');
  const serviceInput = document.getElementById('formService');

  dateInput.addEventListener('change', () => refreshSlots());
  serviceInput.addEventListener('change', () => refreshSlots());

  async function refreshSlots() {
    const dateVal = dateInput.value;
    const serviceVal = serviceInput.value;
    if (!dateVal || !serviceVal) return;
    buildTimeSlots(dateVal, serviceVal);
  }
})();

async function buildTimeSlots(dateVal, serviceVal) {
  const select = document.getElementById('formTime');
  select.innerHTML = '<option value="">Оберіть час</option>';
  if (!dateVal || !serviceVal) return;

  // Get services and find duration
  let services = [];
  try { services = await fetch(API_BASE_URL + '/api/services').then(r => r.json()); } catch(e) {}
  const svc = services.find(s => s.name === serviceVal);
  const duration = svc ? (svc.duration || 30) : 30;

  // Get settings for work hours (default 09:00-18:00)
  let workStart = 9, workEnd = 18;
  try {
    const settings = await fetch(API_BASE_URL + '/api/settings').then(r => r.json());
    const sched = settings.schedule || 'Пн-Пт: 09:00 — 18:00';
    const match = sched.match(/(\d{1,2}):\d{2}/);
    if (match) workStart = parseInt(match[0].split(':')[0]);
    const match2 = sched.match(/—\s*(\d{1,2}):\d{2}/);
    if (match2) workEnd = parseInt(match2[1].split(':')[0]);
  } catch(e) {}

  // Get existing appointments for this day
  const existing = calAppointments.filter(a => a.preferred_date === dateVal && a.status !== 'cancelled');
  const editId = document.getElementById('editApptId').value;

  // Generate slots (every 15 min)
  const slotMinutes = 15;
  const startMin = workStart * 60;
  const endMin = workEnd * 60;

  for (let m = startMin; m + duration <= endMin; m += slotMinutes) {
    // Check overlap with existing appointments
    let blocked = false;
    for (const a of existing) {
      if (editId && a.id === parseInt(editId)) continue;
      const at = a.appt_time;
      if (!at) continue;
      const [ah, am2] = at.split(':').map(Number);
      const aStart = ah * 60 + am2;
      // Get duration for this appointment's service
      const aSvc = services.find(s => s.name === a.service);
      const aDur = aSvc ? (aSvc.duration || 30) : 30;
      const aEnd = aStart + aDur;
      const slotEnd = m + duration;
      if (m < aEnd && slotEnd > aStart) { blocked = true; break; }
    }
    if (blocked) continue;

    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    const opt = document.createElement('option');
    opt.value = hh + ':' + mm;
    opt.textContent = hh + ':' + mm + ' (' + duration + ' хв)';
    select.appendChild(opt);
  }
}

document.getElementById('appointmentForm').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('editApptId').value;
  const payload = {
    name: document.getElementById('formName').value,
    phone: document.getElementById('formPhone').value,
    service: document.getElementById('formService').value,
    preferred_date: document.getElementById('formDate').value,
    appt_time: document.getElementById('formTime').value,
    notes: document.getElementById('formNotes').value,
  };
  if (id) {
    await api('/api/appointments/' + id, 'PATCH', payload);
  } else {
    await api('/api/appointments', 'POST', payload);
  }
  closeApptModal();
  loadAppointments();
});

/* ===================== SERVICES ===================== */
async function loadServices() {
  const services = await fetchAll('/api/services');
  const body = document.getElementById('servicesBody');
  const empty = document.getElementById('servicesEmpty');
  body.innerHTML = '';
  empty.style.display = services.length ? 'none' : 'flex';

  services.forEach(s => {
    const tr = document.createElement('tr');
    tr.draggable = true;
    tr.dataset.id = s.id;
    tr.innerHTML = `
      <td class="drag-handle" title="Перетягніть для зміни порядку"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="cursor:grab;color:var(--g)"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg></td>
      <td style="font-weight:500">${esc(s.name)}</td>
      <td style="max-width:240px;font-size:13px;color:var(--g)">${esc(s.description)}</td>
      <td style="font-weight:600">${esc(s.price)}</td>
      <td style="text-align:center;font-size:13px">${s.duration || 30} хв</td>
      <td><div class="action-btns">
        <button class="action-btn" data-action="editsvc" data-id="${s.id}" title="Редагувати">&#9998;</button>
        <button class="action-btn action-btn--danger" data-action="delsvc" data-id="${s.id}" title="Видалити">&#128465;</button>
      </div></td>`;
    body.appendChild(tr);
  });

  body.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.dataset.action === 'editsvc') openServiceEdit(parseInt(btn.dataset.id));
      if (btn.dataset.action === 'delsvc') {
        if (!confirm('Видалити цю послугу?')) return;
        await api('/api/services/' + btn.dataset.id, 'DELETE');
        loadServices();
      }
    });
  });

  initDragDrop(body, 'services');
}

const svcModal = document.getElementById('serviceModal');
document.getElementById('addServiceBtn').addEventListener('click', () => {
  document.getElementById('serviceModalTitle').textContent = 'Додати послугу';
  document.getElementById('serviceForm').reset();
  document.getElementById('editServiceId').value = '';
  svcModal.style.display = 'flex';
});
function closeSvcModal() { svcModal.style.display = 'none'; }
document.getElementById('serviceModalClose').addEventListener('click', closeSvcModal);
document.getElementById('serviceModalCancel').addEventListener('click', closeSvcModal);
svcModal.querySelector('.modal-backdrop').addEventListener('click', closeSvcModal);

async function openServiceEdit(id) {
  const services = await fetchAll('/api/services');
  const s = services.find(x => x.id === id);
  if (!s) return;
  document.getElementById('serviceModalTitle').textContent = 'Редагувати послугу';
  document.getElementById('editServiceId').value = id;
  document.getElementById('svcName').value = s.name;
  document.getElementById('svcDesc').value = s.description;
  document.getElementById('svcPrice').value = s.price;
  document.getElementById('svcDuration').value = s.duration || 30;
  svcModal.style.display = 'flex';
}

document.getElementById('serviceForm').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('editServiceId').value;
  const payload = {
    name: document.getElementById('svcName').value,
    description: document.getElementById('svcDesc').value,
    price: document.getElementById('svcPrice').value,
    duration: parseInt(document.getElementById('svcDuration').value) || 30,
    icon: 'activity',
  };
  if (id) await api('/api/services/' + id, 'PATCH', payload);
  else await api('/api/services', 'POST', payload);
  closeSvcModal();
  loadServices();
});

/* ===================== FAQ ===================== */
async function loadFaq() {
  const items = await fetchAll('/api/faq');
  const body = document.getElementById('faqBody');
  const empty = document.getElementById('faqEmpty');
  body.innerHTML = '';
  empty.style.display = items.length ? 'none' : 'flex';

  items.forEach(f => {
    const tr = document.createElement('tr');
    tr.draggable = true;
    tr.dataset.id = f.id;
    tr.innerHTML = `
      <td class="drag-handle" title="Перетягніть для зміни порядку"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="cursor:grab;color:var(--g)"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg></td>
      <td style="max-width:260px;font-weight:500">${esc(f.question)}</td>
      <td style="max-width:300px;font-size:13px;color:var(--g)">${esc(f.answer)}</td>
      <td><div class="action-btns">
        <button class="action-btn" data-action="editfaq" data-id="${f.id}" title="Редагувати">&#9998;</button>
        <button class="action-btn action-btn--danger" data-action="delfaq" data-id="${f.id}" title="Видалити">&#128465;</button>
      </div></td>`;
    body.appendChild(tr);
  });

  body.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.dataset.action === 'editfaq') openFaqEdit(parseInt(btn.dataset.id));
      if (btn.dataset.action === 'delfaq') {
        if (!confirm('Видалити це запитання?')) return;
        await api('/api/faq/' + btn.dataset.id, 'DELETE');
        loadFaq();
      }
    });
  });

  initDragDrop(body, 'faq');
}

const faqModal = document.getElementById('faqModal');
document.getElementById('addFaqBtn').addEventListener('click', () => {
  document.getElementById('faqModalTitle').textContent = 'Додати запитання';
  document.getElementById('faqForm').reset();
  document.getElementById('editFaqId').value = '';
  faqModal.style.display = 'flex';
});
function closeFaqModal() { faqModal.style.display = 'none'; }
document.getElementById('faqModalClose').addEventListener('click', closeFaqModal);
document.getElementById('faqModalCancel').addEventListener('click', closeFaqModal);
faqModal.querySelector('.modal-backdrop').addEventListener('click', closeFaqModal);

async function openFaqEdit(id) {
  const items = await fetchAll('/api/faq');
  const f = items.find(x => x.id === id);
  if (!f) return;
  document.getElementById('faqModalTitle').textContent = 'Редагувати запитання';
  document.getElementById('editFaqId').value = id;
  document.getElementById('faqQuestion').value = f.question;
  document.getElementById('faqAnswer').value = f.answer;
  document.getElementById('faqOrder').value = f.sort_order;
  faqModal.style.display = 'flex';
}

document.getElementById('faqForm').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('editFaqId').value;
  const payload = {
    question: document.getElementById('faqQuestion').value,
    answer: document.getElementById('faqAnswer').value,
    sort_order: parseInt(document.getElementById('faqOrder').value) || 0,
  };
  if (id) await api('/api/faq/' + id, 'PATCH', payload);
  else await api('/api/faq', 'POST', payload);
  closeFaqModal();
  loadFaq();
});

/* ===================== CONTACTS (SETTINGS) ===================== */
const dayLabels = [
  { dow: 1, label: 'Пн' }, { dow: 2, label: 'Вт' }, { dow: 3, label: 'Ср' },
  { dow: 4, label: 'Чт' }, { dow: 5, label: 'Пт' }, { dow: 6, label: 'Сб' },
  { dow: 0, label: 'Нд' }
];

async function loadContacts() {
  const data = await fetchAll('/api/contacts');

  // Phones
  const phoneList = document.getElementById('phoneList');
  phoneList.innerHTML = '';
  (data.phones || []).forEach(p => addPhoneRow(p.phone));
  if (!data.phones || !data.phones.length) addPhoneRow('');

  // Locations with per-day schedules
  const addrList = document.getElementById('addressList');
  addrList.innerHTML = '';
  (data.locations || []).forEach(loc => {
    addLocationCardV2(loc, data.schedules[loc.id] || []);
  });
  if (!data.locations || !data.locations.length) addLocationCardV2(null, []);
}

function addPhoneRow(value) {
  const container = document.getElementById('phoneList');
  const div = document.createElement('div');
  div.className = 'contacts-admin-item';
  div.innerHTML = `<input type="text" class="phone-input" placeholder="068 864 67 40" value="${value ? esc(value) : ''}">
    <button class="remove-btn" title="Видалити"><i data-lucide="x"></i></button>`;
  div.querySelector('.remove-btn').addEventListener('click', () => div.remove());
  container.appendChild(div);
  if (window.lucide) lucide.createIcons(div);
}

function addLocationCardV2(loc, schedules) {
  loc = loc || { city: '', street: '', building: '' };
  const schedMap = {};
  (schedules || []).forEach(s => schedMap[s.day_of_week] = s);

  const container = document.getElementById('addressList');
  const card = document.createElement('div');
  card.className = 'location-card-v2';
  if (loc.id) card.dataset.locationId = loc.id;

  // Build schedule rows
  const schedRows = dayLabels.map(d => {
    const s = schedMap[d.dow];
    const checked = s ? 'checked' : '';
    const disabled = s ? '' : 'disabled';
    return `<tr data-day="${d.dow}">
      <td>${d.label}</td>
      <td><input type="checkbox" class="sched-active" ${checked}></td>
      <td><input type="time" class="sched-start" value="${s ? s.start_time : '09:00'}" ${disabled}></td>
      <td><input type="time" class="sched-end" value="${s ? s.end_time : '18:00'}" ${disabled}></td>
      <td><input type="time" class="sched-lunch-start" value="${s && s.lunch_start ? s.lunch_start : ''}" ${disabled}></td>
      <td><input type="time" class="sched-lunch-end" value="${s && s.lunch_end ? s.lunch_end : ''}" ${disabled}></td>
    </tr>`;
  }).join('');

  card.innerHTML = `
    <div class="location-card-header">
      <span><i data-lucide="map-pin"></i> Адреса</span>
      <button class="location-remove-btn" title="Видалити адресу"><i data-lucide="trash-2"></i></button>
    </div>
    <div class="address-fields">
      <div class="form-group"><label>Місто</label><input type="text" class="loc-city" placeholder="м. Буча" value="${esc(loc.city)}"></div>
      <div class="form-group"><label>Вулиця</label><input type="text" class="loc-street" placeholder="вул. Бориса Гмирі" value="${esc(loc.street)}"></div>
      <div class="form-group"><label>Будинок</label><input type="text" class="loc-building" placeholder="7" value="${esc(loc.building)}"></div>
    </div>
    <table class="schedule-table">
      <thead>
        <tr>
          <th>День</th>
          <th class="schedule-chk-col">Акт.</th>
          <th>Початок</th>
          <th>Кінець</th>
          <th>Обід поч.</th>
          <th>Обід кін.</th>
        </tr>
      </thead>
      <tbody>${schedRows}</tbody>
    </table>`;

  // Toggle time inputs on checkbox change
  card.querySelectorAll('.sched-active').forEach(chk => {
    chk.addEventListener('change', () => {
      const row = chk.closest('tr');
      const inputs = row.querySelectorAll('.sched-start, .sched-end, .sched-lunch-start, .sched-lunch-end');
      inputs.forEach(inp => inp.disabled = !chk.checked);
    });
  });

  card.querySelector('.location-remove-btn').addEventListener('click', () => card.remove());
  container.appendChild(card);
  if (window.lucide) lucide.createIcons(card);
}

document.getElementById('addPhoneBtn').addEventListener('click', () => addPhoneRow(''));
document.getElementById('addAddressBtn').addEventListener('click', () => addLocationCardV2(null, []));

document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  const btn = document.getElementById('saveSettingsBtn');
  const msg = document.getElementById('settingsMsg');
  btn.disabled = true;
  btn.textContent = 'Зберігаю...';
  msg.textContent = '';
  const phones = [...document.querySelectorAll('.phone-input')]
    .map((inp, i) => ({ phone: inp.value.trim(), sort_order: i }))
    .filter(p => p.phone);

  const locations = [];
  document.querySelectorAll('.location-card-v2').forEach(card => {
    const locId = card.dataset.locationId || null;
    const city = card.querySelector('.loc-city').value.trim();
    const street = card.querySelector('.loc-street').value.trim();
    const building = card.querySelector('.loc-building').value.trim();

    if (!city && !street) return; // skip empty cards

    const schedules = [];
    card.querySelectorAll('.schedule-table tbody tr').forEach(row => {
      const chk = row.querySelector('.sched-active');
      if (chk.checked) {
        schedules.push({
          day_of_week: parseInt(row.dataset.day),
          start_time: row.querySelector('.sched-start').value || '09:00',
          end_time: row.querySelector('.sched-end').value || '18:00',
          lunch_start: row.querySelector('.sched-lunch-start').value || null,
          lunch_end: row.querySelector('.sched-lunch-end').value || null,
        });
      }
    });

    locations.push({ id: locId, city, street, building, schedules });
  });

  await api('/api/contacts/bulk', 'POST', { phones, locations });

  msg.textContent = '✓ Збережено!';
  setTimeout(() => { msg.textContent = ''; }, 2500);
  btn.disabled = false;
  btn.textContent = '\u{f0c7} Зберегти все';
});

/* ===================== ANALYTICS ===================== */
async function loadAnalytics() {
  const all = await fetchAll('/api/appointments');

  // Services bar chart
  const svcMap = {};
  all.forEach(a => { svcMap[a.service] = (svcMap[a.service] || 0) + 1; });
  const svcLabels = Object.keys(svcMap).sort((a, b) => svcMap[b] - svcMap[a]);
  const svcData = svcLabels.map(s => svcMap[s]);
  const svcColors = ['#0e7495', '#06b6d4', '#22d3ee', '#67e8f9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (servicesChart) servicesChart.destroy();
  servicesChart = new Chart(document.getElementById('servicesChart'), {
    type: 'bar',
    data: {
      labels: svcLabels,
      datasets: [{ data: svcData, backgroundColor: svcColors.slice(0, svcLabels.length), borderRadius: 6 }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, grid: { color: '#f1f5f9' } },
        y: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 12 } } },
      },
    },
  });

  // Status doughnut
  const st = { pending: 0, confirmed: 0, cancelled: 0 };
  all.forEach(a => { if (st[a.status] !== undefined) st[a.status]++; });
  if (statusChart) statusChart.destroy();
  statusChart = new Chart(document.getElementById('statusChart'), {
    type: 'doughnut',
    data: {
      labels: ['Очікують', 'Підтверджено', 'Скасовано'],
      datasets: [{ data: [st.pending, st.confirmed, st.cancelled], backgroundColor: ['#f59e0b', '#22c55e', '#ef4444'], borderWidth: 0 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: { legend: { position: 'bottom', labels: { font: { family: 'Inter' }, usePointStyle: true, pointStyle: 'circle', padding: 16 } } },
    },
  });
}

/* ===================== DRAG & DROP ===================== */
function initDragDrop(tbody, endpoint) {
  let draggedRow = null;
  tbody.addEventListener('dragstart', e => {
    draggedRow = e.target.closest('tr');
    if (!draggedRow) return;
    draggedRow.style.opacity = '0.4';
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  });
  tbody.addEventListener('dragend', e => {
    if (draggedRow) draggedRow.style.opacity = '1';
    draggedRow = null;
    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-top', 'drag-over-bottom'));
  });
  tbody.addEventListener('dragover', e => {
    e.preventDefault();
    if (!draggedRow) return;
    const target = e.target.closest('tr');
    if (!target || target === draggedRow) return;
    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-top', 'drag-over-bottom'));
    target.classList.add(e.clientY < midY ? 'drag-over-top' : 'drag-over-bottom');
  });
  tbody.addEventListener('dragleave', e => {
    const target = e.target.closest('tr');
    if (target) target.classList.remove('drag-over-top', 'drag-over-bottom');
  });
  tbody.addEventListener('drop', async e => {
    e.preventDefault();
    if (!draggedRow) return;
    const target = e.target.closest('tr');
    if (!target || target === draggedRow) return;
    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const allRows = [...tbody.querySelectorAll('tr')];
    const fromIdx = allRows.indexOf(draggedRow);
    const toIdx = allRows.indexOf(target);
    const insertedBefore = e.clientY < midY;
    // Remove draggedRow from list
    const movedRow = allRows.splice(fromIdx, 1)[0];
    const newIdx = insertedBefore ? toIdx : toIdx + 1;
    const adjustedIdx = fromIdx < newIdx ? newIdx - 1 : newIdx;
    allRows.splice(adjustedIdx, 0, movedRow);
    // Reorder in DOM
    allRows.forEach(r => tbody.appendChild(r));
    // Update sort_order in API
    const ids = allRows.map(r => parseInt(r.dataset.id));
    for (let i = 0; i < ids.length; i++) {
      try { await api('/api/' + endpoint + '/' + ids[i], 'PATCH', { sort_order: i }); } catch(_e) {}
    }
    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-top', 'drag-over-bottom'));
  });
}

/* ===================== HELPERS ===================== */
async function fetchAll(url) {
  const sep = url.includes('?') ? '&' : '?';
  const fullUrl = API_BASE_URL + url + sep + 'token=' + encodeURIComponent(adminToken);
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(fullUrl);
    if (res.ok) return res.json();
    if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
  }
  throw new Error('HTTP ' + (await httpStatus(fullUrl)) + ' on ' + url);
}

async function httpStatus(url) {
  try { await fetch(url); return 200; } catch(e) { return 0; }
}

async function api(url, method, body) {
  const sep = url.includes('?') ? '&' : '?';
  const fullUrl = API_BASE_URL + url + sep + 'token=' + encodeURIComponent(adminToken);
  for (let attempt = 0; attempt < 4; attempt++) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(fullUrl, opts);
    if (res.ok) return res.json();
    if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
  }
  throw new Error('HTTP failed on ' + url);
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function iso(d) {
  return d.getFullYear() + '-' + (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0');
}

function statusLabel(s) {
  return { pending: 'Очікує', confirmed: 'Підтверджено', cancelled: 'Скасовано' }[s] || s;
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function iconSvg(name) {
  const map = {
    'info': '&#9881;', 'shield': '&#9872;', 'activity': '&#9889;',
    'upload': '&#9650;', 'droplet': '&#9829;', 'settings': '&#9881;',
    'coffee': '&#9749;', 'users': '&#128101;', 'default': '&#9899;'
  };
  return map[name] || map['default'];
}
