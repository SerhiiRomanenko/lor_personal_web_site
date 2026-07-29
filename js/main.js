document.addEventListener('DOMContentLoaded', () => {
/* ========== DOM elements ========== */
const header = document.getElementById('header');
const headerNav = document.getElementById('headerNav');
const mobileNav = document.querySelector('.header__mobile-nav');
const form = document.getElementById('appointmentForm');
const formConfirm = document.getElementById('formConfirm');

/* ========== Header status: "Приймає сьогодні" / "Не приймає сьогодні" ========== */
const headerStatus = document.querySelector('.header__status');
const statusText = document.querySelector('.header__status-text');
const statusDot = document.querySelector('.header__status-dot');
let schedulesData = null;

window.updateHeaderStatus = function(schedules) {
  schedulesData = schedules;
  const todayDow = new Date().getDay(); // 0=Нд, 1=Пн, ... 6=Сб
  let accepting = false;

  // Check all locations for today's schedule
  for (const locId in schedules) {
    const daySched = schedules[locId].find(s => s.day_of_week === todayDow);
    if (daySched && daySched.start_time && daySched.end_time) {
      accepting = true;
      break;
    }
  }

  if (accepting) {
    statusText.textContent = 'Приймає сьогодні';
    statusDot.style.background = '#22c55e';
  } else {
    statusText.textContent = 'Не приймає сьогодні';
    statusDot.style.background = '#ef4444';
  }
};

if (headerStatus) {
  headerStatus.style.cursor = 'pointer';
  headerStatus.addEventListener('click', () => {
    document.getElementById('contacts')?.scrollIntoView({ behavior: 'smooth' });
  });
}

/* ========== Dynamic content from API ========== */
loadDynamicContent();

/* ========== Testimonials Carousel ========== */
initTestimonialsCarousel();

/* ========== Dynamic years of experience (from 2014-05-30) ========== */
(function () {
  const el = document.getElementById('yearsExperience');
  if (!el) return;
  const start = new Date(2014, 4, 30); // May 30, 2014 (month is 0-indexed)
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  const m = now.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < start.getDate())) years--;
  el.textContent = Math.max(0, years) + '+';
})();

/* ========== Header: scroll effects + active nav links ========== */
const sections = document.querySelectorAll('section[id]');
const allNavLinks = [
  ...(headerNav ? headerNav.querySelectorAll('a') : []),
  ...(mobileNav ? mobileNav.querySelectorAll('.header__mobile-link') : [])
];

// Map mobile nav IDs to their section targets for active highlighting
const navIdMap = {
  'about': 'about',
  'services': 'services',
  'testimonials': 'testimonials',
  'contacts': 'contacts'
};

function onScroll() {
  header.classList.toggle('scrolled', scrollY > 10);

  let current = '';
  sections.forEach(sec => {
    const top = sec.offsetTop - 120;
    if (scrollY >= top) current = sec.id;
  });
  allNavLinks.forEach(l => {
    const href = l.getAttribute('href').replace('#', '');
    l.classList.toggle('active', href === current);
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ========== FAQ accordion ========== */
document.querySelectorAll('.faq__question').forEach(btn => {
  btn.addEventListener('click', () => {
    const answer = btn.nextElementSibling;
    const open = btn.classList.contains('active');

    document.querySelectorAll('.faq__question').forEach(q => {
      q.classList.remove('active');
      q.nextElementSibling.style.maxHeight = null;
    });

    if (!open) {
      btn.classList.add('active');
      answer.style.maxHeight = answer.scrollHeight + 'px';
    }
  });
});

/* ========== Phone mask (Ukrainian format: 0XX XXX XX XX) ========== */
const phoneInput = form?.querySelector('input[name="phone"]');
if (phoneInput) {
  phoneInput.setAttribute('placeholder', '068 864 67 40');

  phoneInput.addEventListener('input', e => {
    const input = e.target;
    const cursorPos = input.selectionStart;
    const oldValue = input.value;

    // Clear validation while typing
    phoneInput.setCustomValidity('');

    // Get digits only
    let digits = input.value.replace(/\D/g, '');
    if (digits.length > 10) digits = digits.slice(0, 10);

    // Format: 0XX XXX XX XX
    let formatted = '';
    if (digits.length > 0) formatted = digits.slice(0, 3);
    if (digits.length > 3) formatted += ' ' + digits.slice(3, 6);
    if (digits.length > 6) formatted += ' ' + digits.slice(6, 8);
    if (digits.length > 8) formatted += ' ' + digits.slice(8, 10);

    input.value = formatted;

    // Restore cursor after spaces
    const digitsBeforeCursor = oldValue.slice(0, cursorPos).replace(/\D/g, '').length;
    let spacesBefore = 0;
    if (digitsBeforeCursor > 3) spacesBefore++;
    if (digitsBeforeCursor > 6) spacesBefore++;
    if (digitsBeforeCursor > 8) spacesBefore++;
    input.selectionStart = input.selectionEnd = digitsBeforeCursor + spacesBefore;
  });

  phoneInput.addEventListener('blur', () => {
    const digits = phoneInput.value.replace(/\D/g, '');
    if (digits.length > 0 && digits.length < 10) {
      phoneInput.setCustomValidity('Введіть повний номер телефону (10 цифр)');
    } else {
      phoneInput.setCustomValidity('');
    }
  });
}

/* ========== Form submit + time slots ========== */
if (form) {
  const dateInput = form.querySelector('input[name="date"]');
  const serviceInput = form.querySelector('select[name="service"]');
  const locationSelect = document.getElementById('appointmentLocation');
  const timeSelect = document.getElementById('appointmentTime');

  // Build time slots when location, date or service changes
  if (locationSelect) locationSelect.addEventListener('change', () => refreshClientSlots());
  serviceInput.addEventListener('change', () => refreshClientSlots());
  dateInput.addEventListener('change', () => refreshClientSlots());

  async function refreshClientSlots() {
    const dateVal = dateInput.value;
    const serviceVal = serviceInput.value;
    const locationVal = locationSelect ? locationSelect.value : null;
    timeSelect.innerHTML = '<option value="">Оберіть час</option>';
    if (!locationVal) { timeSelect.innerHTML = '<option value="">Спочатку оберіть адресу</option>'; timeSelect.disabled = true; return; }
    if (!dateVal || !serviceVal) { timeSelect.disabled = false; return; }
    buildClientTimeSlots(dateVal, serviceVal, locationVal);
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    const origText = btn.textContent;
    btn.textContent = 'Надсилаю...';
    btn.disabled = true;

    const data = new FormData(form);
    const payload = {
      name: data.get('name'),
      phone: data.get('phone'),
      service: data.get('service'),
      preferred_date: data.get('date'),
      appt_time: timeSelect.value,
      location_id: locationSelect && locationSelect.value ? locationSelect.value : null,
    };

    try {
      const res = await fetchWithRetry(API_BASE_URL + '/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        form.style.display = 'none';
        formConfirm.style.display = 'block';
      } else {
        alert('Помилка відправки. Спробуйте зателефонувати нам.');
        btn.textContent = origText;
        btn.disabled = false;
      }
    } catch (err) {
      alert('Помилка інтернету. Спробуйте зателефонувати нам.');
      btn.textContent = origText;
      btn.disabled = false;
    }
  });
}

/* ========== Scroll reveal animations ========== */
const revealObserver = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('reveal-visible');
      obs.unobserve(entry.target);
    }
  });
}, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

document.querySelectorAll(
  '.stats__item, .service-card, .faq__item, .about__content, .about__image, .contacts__info, .contacts__map'
).forEach(el => {
  el.classList.add('reveal');
  revealObserver.observe(el);
});

/* ========== Stats counter animation ========== */
let statsCounted = false;
const statsSection = document.querySelector('.stats');
const statsObserver = new IntersectionObserver(
  entries => {
    if (entries[0].isIntersecting && !statsCounted) {
      statsCounted = true;
      document.querySelectorAll('.stats__number').forEach(el => {
        const text = el.textContent;
        const match = text.match(/([\d\s]+)/);
        if (!match) return;
        const target = parseInt(match[1].replace(/\s/g, ''));
        const suffix = text.replace(match[0], '');
        const prefix = text.substring(0, text.indexOf(match[0]));
        const duration = 1800;
        const start = performance.now();

        function tick(now) {
          const progress = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 3);
          const current = Math.floor(ease * target);
          const formatted = current.toLocaleString('uk-UA');
          el.textContent = prefix + formatted + suffix;
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    }
  },
  { threshold: 0.3 }
);
if (statsSection) statsObserver.observe(statsSection);

/* ========== Back to top button ========== */
const backBtn = document.createElement('button');
backBtn.type = 'button';
backBtn.className = 'back-to-top';
backBtn.innerHTML = '&#9650;';
backBtn.setAttribute('aria-label', 'Наверх');
backBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
document.body.appendChild(backBtn);

window.addEventListener('scroll', () => {
  backBtn.classList.toggle('show', scrollY > 600);
}, { passive: true });

/* ========== Date picker: disable past dates ========== */
const dateInput = form?.querySelector('input[name="date"]');
if (dateInput) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  dateInput.setAttribute('min', `${yyyy}-${mm}-${dd}`);
}

/* ========== Dynamic content ========== */
async function fetchWithRetry(url, opts) {
  for (var i = 0; i < 4; i++) {
    var res = await fetch(url, opts);
    if (res.ok) return res;
    if (i < 3) await new Promise(function(r) { setTimeout(r, 2000 * (i + 1)); });
  }
  return res;
}

async function loadDynamicContent() {
  try {
    /* --- Services --- */
    var svcRes = await fetchWithRetry(API_BASE_URL + '/api/services');
    if (svcRes.ok) {
      gServices = await svcRes.json();
      renderServices(gServices);

      /* --- Update select in appointment form --- */
      const select = document.querySelector('#appointmentForm select[name="service"]');
      if (select) {
        select.innerHTML = '<option value="" disabled selected>Оберіть послугу</option>';
        gServices.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.name;
          opt.textContent = s.name;
          select.appendChild(opt);
        });
      }
    }

    /* --- FAQ --- */
    var faqRes = await fetchWithRetry(API_BASE_URL + '/api/faq');
    if (faqRes.ok) {
      const faqs = await faqRes.json();
      renderFaq(faqs, true);
    }

    /* --- Contacts (phones, locations, schedules) --- */
    var contactsRes = await fetchWithRetry(API_BASE_URL + '/api/contacts');
    if (contactsRes.ok) {
      gContactsData = await contactsRes.json();
      renderContacts(gContactsData);
      updateHeaderStatus(gContactsData.schedules);

      /* --- Populate location dropdown --- */
      const locationSelect = document.getElementById('appointmentLocation');
      if (locationSelect && gContactsData.locations.length > 0) {
        locationSelect.innerHTML = '<option value="" disabled selected>Оберіть адресу</option>';
        gContactsData.locations.forEach(loc => {
          const addr = [loc.city, loc.street, loc.building].filter(Boolean).join(', ');
          const opt = document.createElement('option');
          opt.value = loc.id;
          opt.textContent = addr;
          locationSelect.appendChild(opt);
        });
      }
    }

      /* --- Load existing appointments for slot calculation --- */
    try {
      var apptRes = await fetchWithRetry(API_BASE_URL + '/api/appointments');
      if (apptRes.ok) gAppointments = await apptRes.json();
    } catch(e) {}
  } catch (e) {
    // API not available (static server) — keep static HTML
  }
}

let allServicesData = [];
let servicesSort = { field: null, asc: true };
let servicesPage = 1;
const SERVICES_PER_PAGE = 10;

function renderServices(services) {
  allServicesData = [...services];
  servicesPage = 1;
  const tbody = document.getElementById('servicesTableBody');
  if (!tbody) return;

  const search = document.getElementById('servicesSearch');
  if (search) {
    search.oninput = () => { servicesPage = 1; renderServicesTable(); };
  }

  document.querySelectorAll('.services__th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (servicesSort.field === field) servicesSort.asc = !servicesSort.asc;
      else { servicesSort.field = field; servicesSort.asc = true; }
      document.querySelectorAll('.services__sort-icon').forEach(i => i.textContent = '↕');
      th.querySelector('.services__sort-icon').textContent = servicesSort.asc ? '↑' : '↓';
      servicesPage = 1;
      renderServicesTable();
    });
  });

  renderServicesTable();
}

function renderServicesTable() {
  const tbody = document.getElementById('servicesTableBody');
  const pagination = document.getElementById('servicesPagination');
  if (!tbody) return;
  const search = document.getElementById('servicesSearch')?.value.toLowerCase() || '';
  let items = allServicesData.filter(s =>
    s.name.toLowerCase().includes(search) || s.description.toLowerCase().includes(search)
  );

  if (servicesSort.field) {
    items.sort((a, b) => {
      let va = a[servicesSort.field], vb = b[servicesSort.field];
      if (servicesSort.field === 'price') {
        va = parseInt(va.replace(/\D/g, '')) || 0;
        vb = parseInt(vb.replace(/\D/g, '')) || 0;
      } else { va = (va || '').toLowerCase(); vb = (vb || '').toLowerCase(); }
      if (va < vb) return servicesSort.asc ? -1 : 1;
      if (va > vb) return servicesSort.asc ? 1 : -1;
      return 0;
    });
  }

  const totalPages = Math.ceil(items.length / SERVICES_PER_PAGE);
  const start = (servicesPage - 1) * SERVICES_PER_PAGE;
  const pageItems = items.slice(start, start + SERVICES_PER_PAGE);

  tbody.innerHTML = pageItems.map((s, i) => `
    <tr style="${i % 2 === 0 ? 'background:#fff' : 'background:#f8fafc'}">
      <td style="font-weight:600">${esc(s.name)}</td>
      <td class="services__desc" title="${esc(s.description)}">${esc(s.description)}</td>
      <td style="font-weight:700;white-space:nowrap">${esc(s.price)}</td>
    </tr>
  `).join('');

  // Pagination
  if (totalPages > 1 && pagination) {
    let pagHtml = '';
    pagHtml += `<button class="services__page-btn" ${servicesPage === 1 ? 'disabled' : ''} data-page="${servicesPage - 1}">&larr;</button>`;
    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 7 && Math.abs(p - servicesPage) > 2 && p !== 1 && p !== totalPages) {
        if (p === servicesPage - 2 || p === servicesPage + 2) pagHtml += '<span class="services__page-dots">…</span>';
        continue;
      }
      pagHtml += `<button class="services__page-btn ${p === servicesPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }
    pagHtml += `<button class="services__page-btn" ${servicesPage === totalPages ? 'disabled' : ''} data-page="${servicesPage + 1}">&rarr;</button>`;
    pagination.innerHTML = pagHtml;
    pagination.style.display = 'flex';
    pagination.querySelectorAll('.services__page-btn:not(:disabled)').forEach(btn => {
      btn.onclick = () => { servicesPage = parseInt(btn.dataset.page); renderServicesTable(); };
    });
  } else if (pagination) {
    pagination.innerHTML = '';
    pagination.style.display = 'none';
  }
}

let allFaqData = [];
let faqPage = 1;
const FAQ_PER_PAGE = 7;

function renderFaq(faqs, resetPage) {
  if (resetPage) { allFaqData = [...faqs]; faqPage = 1; }
  const list = document.querySelector('.faq__list');
  const pagination = document.getElementById('faqPagination');
  if (!list) return;

  const totalPages = Math.ceil(allFaqData.length / FAQ_PER_PAGE);
  const start = (faqPage - 1) * FAQ_PER_PAGE;
  const pageItems = allFaqData.slice(start, start + FAQ_PER_PAGE);

  list.innerHTML = pageItems.map(f => `
    <div class="faq__item">
      <button class="faq__question">${esc(f.question)} <svg class="faq__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
      <div class="faq__answer"><p>${esc(f.answer)}</p></div>
    </div>`).join('');

  // Re-bind FAQ accordion
  document.querySelectorAll('.faq__question').forEach(btn => {
    btn.addEventListener('click', () => {
      const answer = btn.nextElementSibling;
      const open = btn.classList.contains('active');
      document.querySelectorAll('.faq__question').forEach(q => {
        q.classList.remove('active');
        q.nextElementSibling.style.maxHeight = null;
      });
      if (!open) {
        btn.classList.add('active');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  // Pagination
  if (totalPages > 1 && pagination) {
    let pagHtml = '';
    pagHtml += `<button class="faq__page-btn" ${faqPage === 1 ? 'disabled' : ''} data-page="${faqPage - 1}">&larr;</button>`;
    for (let p = 1; p <= totalPages; p++) {
      pagHtml += `<button class="faq__page-btn ${p === faqPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }
    pagHtml += `<button class="faq__page-btn" ${faqPage === totalPages ? 'disabled' : ''} data-page="${faqPage + 1}">&rarr;</button>`;
    pagination.innerHTML = pagHtml;
    pagination.style.display = 'flex';
    pagination.querySelectorAll('.faq__page-btn:not(:disabled)').forEach(btn => {
      btn.onclick = () => { faqPage = parseInt(btn.dataset.page); renderFaq(allFaqData); };
    });
  } else if (pagination) {
    pagination.innerHTML = '';
    pagination.style.display = 'none';
  }
}

function renderContacts(contactsData) {
  const { phones, locations, schedules } = contactsData;
  const container = document.getElementById('contactsDynamic');
  if (!container) return;

  const dayNameShort = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  let html = '<div class="contacts__cards">';

  // Phone cards
  (phones || []).forEach(phone => {
    const sanitized = phone.phone.replace(/\D/g, '');
    const telLink = '+38' + sanitized.substring(1);
    html += `<a href="tel:${telLink}" class="contacts__card">
      <div class="contacts__card-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
      </div>
      <div>
        <span class="contacts__card-label">Телефон</span>
        <span class="contacts__card-value">${esc(phone.phone)}</span>
      </div>
    </a>`;
  });

  // Combined address + schedule cards per location
  (locations || []).forEach(loc => {
    const addr = [loc.city, loc.street, loc.building].filter(Boolean).join(', ');
    const locSchedules = schedules[loc.id] || [];
    const activeDays = locSchedules.filter(s => s.start_time && s.end_time);

    let scheduleHtml = '';
    if (activeDays.length > 0) {
      const schedLines = activeDays.map(s => {
        let line = `${dayNameShort[s.day_of_week]}: ${s.start_time} — ${s.end_time}`;
        if (s.lunch_start && s.lunch_end) line += `<br><span class="contacts__lunch">(обід ${s.lunch_start} — ${s.lunch_end})</span>`;
        return line;
      }).join('<br>');
      scheduleHtml = `<div class="contacts__schedule">
        <span class="contacts__schedule-title">Графік роботи</span>
        <span class="contacts__schedule-value">${schedLines}</span>
      </div>`;
    }

    html += `<div class="contacts__card contacts__card--location">
      <div class="contacts__card-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
      <div>
        <span class="contacts__card-label">Адреса</span>
        <span class="contacts__card-value">${esc(addr)}</span>
        ${scheduleHtml}
      </div>
    </div>`;
  });

  html += '</div>';
  container.innerHTML = html;

  // Update header phone
  if (phones && phones.length > 0) {
    const sanitized = phones[0].phone.replace(/\D/g, '');
    const telLink = '+38' + sanitized.substring(1);
    const headerPhones = document.querySelectorAll('.header__phone');
    headerPhones.forEach(el => {
      el.href = 'tel:' + telLink;
      const span = el.querySelector('span');
      if (span) span.textContent = phones[0].phone;
    });
    // Footer phone
    const footerPhones = document.querySelectorAll('.footer__phone');
    footerPhones.forEach(el => {
      const svg = el.querySelector('svg');
      el.href = 'tel:' + telLink;
      if (svg) {
        el.innerHTML = svg.outerHTML + '  ' + esc(phones[0].phone);
      } else {
        el.textContent = phones[0].phone;
      }
    });
  }
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// Global cache for appointment system
let gServices = [];
let gContactsData = { phones: [], locations: [], schedules: {} };
let gAppointments = [];

// Check if a date (day of week) is a working day for the given location
function isWorkingDay(dateStr, locationId) {
  const dow = new Date(dateStr).getDay();
  const locSchedules = gContactsData.schedules[locationId] || [];
  return locSchedules.some(s => s.day_of_week === dow && s.start_time && s.end_time);
}

async function buildClientTimeSlots(dateVal, serviceVal, locationId) {
  const select = document.getElementById('appointmentTime');
  if (!select) return;
  select.innerHTML = '<option value="">Оберіть час</option>';
  select.disabled = false;
  if (!dateVal || !serviceVal || !locationId) return;

  const selectedDay = new Date(dateVal).getDay();

  // Get schedule for this location and day from cached data
  const locSchedules = gContactsData.schedules[locationId] || [];
  const daySched = locSchedules.find(s => s.day_of_week === selectedDay);

  if (!daySched || !daySched.start_time) {
    select.innerHTML = '<option value="">Цей день — вихідний</option>';
    select.disabled = true;
    return;
  }

  const [sh, sm] = daySched.start_time.split(':').map(Number);
  const [eh, em] = daySched.end_time.split(':').map(Number);
  let workStart = sh * 60 + sm;
  let workEnd = eh * 60 + em;
  let lunchStart = null, lunchEnd = null;

  if (daySched.lunch_start) {
    const [ls, lm] = daySched.lunch_start.split(':').map(Number);
    lunchStart = ls * 60 + lm;
  }
  if (daySched.lunch_end) {
    const [le, lm2] = daySched.lunch_end.split(':').map(Number);
    lunchEnd = le * 60 + lm2;
  }

  // Get service duration from cached services
  const svc = gServices.find(s => s.name === serviceVal);
  const duration = svc ? (svc.duration || 30) : 30;

  // Get existing appointments for this day at this location from cache
  const dayAppts = gAppointments.filter(a =>
    a.preferred_date === dateVal &&
    a.status !== 'cancelled' &&
    (!a.location_id || a.location_id === String(locationId))
  );

  // Generate available slots (every 15 min)
  const slotMinutes = 15;
  let slotCount = 0;

  for (let m = workStart; m + duration <= workEnd; m += slotMinutes) {
    // Block lunch break
    if (lunchStart !== null && lunchEnd !== null) {
      if (m < lunchEnd && (m + duration) > lunchStart) continue;
    }

    // Block existing appointments
    let blocked = false;
    for (const a of dayAppts) {
      const at = a.appt_time;
      if (!at) continue;
      const [ah, am2] = at.split(':').map(Number);
      const aStart = ah * 60 + am2;
      const aSvc = gServices.find(s => s.name === a.service);
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
    opt.textContent = hh + ':' + mm;
    select.appendChild(opt);
    slotCount++;
  }

  if (slotCount === 0) {
    select.innerHTML = '<option value="">На цю дату вільних записів немає</option>';
    select.disabled = true;
  }
}

/* ========== Testimonials Carousel ========== */
function initTestimonialsCarousel() {
  const track = document.getElementById('testimonialsTrack');
  const dotsWrap = document.getElementById('testimonialsDots');
  const prevBtn = document.getElementById('testPrev');
  const nextBtn = document.getElementById('testNext');
  const viewport = document.getElementById('testimonialsViewport');
  if (!track || !dotsWrap) return;

  const googleSvg = '<svg class="testimonial-card__google" width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>';

  const quoteSvg = '<svg class="testimonial-card__quote" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/></svg>';

  const testimonials = [
    { name: 'Яна', month: 'лютий 2026', letter: 'Я', text: 'Чудовий лікар і приємне ставлення до пацієнтів. Все пояснює доступно, без поспіху, уважно оглядає. Видно, що людина знає свою справу і дійсно хоче допомогти.' },
    { name: 'Ирина', month: 'грудень 2025', letter: 'И', text: 'Дуже вдячна лікарю. Довгий час лікувалася в різних спеціалістів - без результату. Тут з першого прийому все чітко пояснили, призначили правильне лікування, і нарешті стало значно краще. Лікаря рекомендую!' },
    { name: 'Alinochka', month: 'березень 2026', letter: 'A', text: 'Мучилася з хронічною проблемою роками, лікувалася в інших клініках — ефекту майже не було. Після звернення до цього лікаря стан покращився вже через кілька днів. Професійний, уважний і дуже компетентний спеціаліст.' },
    { name: 'Софія', month: 'вересень 2025', letter: 'С', text: 'Лікар дуже уважна, приділила увагу та гарно усе пояснила.' },
    { name: 'Ігор', month: 'квітень 2026', letter: 'І', text: 'Рекомендую цього ЛОР-лікаря. Чітка діагностика, ефективне лікування, приємне спілкування. Відчувається великий досвід і відповідальне ставлення до кожного пацієнта.' },
    { name: 'Igor', month: 'травень 2026', letter: 'I', text: 'Професійний лікар. Знайшла мою постійну причину хвороби, ходив до багатьох лікарів. Все просто і ясно пояснила. Рекомендую.' },
  ];

  track.innerHTML = testimonials.map(t => `
    <div class="testimonial-card">
      ${quoteSvg}
      <p class="testimonial-card__text">${t.text}</p>
      <div class="testimonial-card__footer">
        <div class="testimonial-card__author">
          <div class="testimonial-card__avatar">${t.letter}</div>
          <div>
            <strong>${t.name}</strong>
            <span>${t.month}</span>
          </div>
        </div>
        ${googleSvg}
      </div>
    </div>
  `).join('');

  const total = testimonials.length;
  let current = 0;
  let perPage = 3;
  let autoTimer = null;
  const AUTO_INTERVAL = 5000;

  function getPerPage() {
    if (window.innerWidth <= 768) return 1;
    if (window.innerWidth <= 900) return 2;
    return 3;
  }

  function getMaxIndex() {
    return Math.max(0, total - perPage);
  }

  function getCardWidth() {
    if (!viewport || !track.children.length) return 0;
    const card = track.children[0];
    const style = window.getComputedStyle(track);
    const gap = parseFloat(style.gap) || 20;
    return card.offsetWidth + gap;
  }

  function goTo(idx, resetAuto) {
    const maxIdx = getMaxIndex();
    current = Math.max(0, Math.min(idx, maxIdx));
    const cardW = getCardWidth();
    track.style.transform = `translateX(-${current * cardW}px)`;
    dotsWrap.querySelectorAll('.carousel-dot').forEach((d, i) =>
      d.classList.toggle('active', i === current)
    );
    if (resetAuto) startAuto();
  }

  function nextSlide() {
    const maxIdx = getMaxIndex();
    if (current >= maxIdx) goTo(0);
    else goTo(current + 1);
  }

  function startAuto() {
    stopAuto();
    autoTimer = setInterval(nextSlide, AUTO_INTERVAL);
  }

  function stopAuto() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  }

  dotsWrap.innerHTML = Array.from({ length: getMaxIndex() + 1 }, (_, i) =>
    `<button class="carousel-dot${i === 0 ? ' active' : ''}" data-idx="${i}" aria-label="Відгук ${i + 1}"></button>`
  ).join('');

  if (prevBtn) prevBtn.addEventListener('click', () => {
    if (current <= 0) goTo(getMaxIndex());
    else goTo(current - 1);
    startAuto();
  });
  if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); startAuto(); });
  dotsWrap.querySelectorAll('.carousel-dot').forEach(d => {
    d.addEventListener('click', () => { goTo(parseInt(d.dataset.idx)); startAuto(); });
  });

  // Touch/swipe support
  let touchStartX = 0;
  let touchDelta = 0;
  if (viewport) {
    viewport.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].clientX; touchDelta = 0; stopAuto(); }, { passive: true });
    viewport.addEventListener('touchmove', e => { touchDelta = e.changedTouches[0].clientX - touchStartX; }, { passive: true });
    viewport.addEventListener('touchend', () => {
      if (Math.abs(touchDelta) > 50) {
        if (touchDelta > 0) { if (current <= 0) goTo(getMaxIndex()); else goTo(current - 1); }
        else { nextSlide(); }
      }
      touchDelta = 0;
      startAuto();
    }, { passive: true });
  }

  // Pause on hover
  if (viewport) {
    viewport.addEventListener('mouseenter', stopAuto);
    viewport.addEventListener('mouseleave', startAuto);
  }

  // Recalculate on resize
  window.addEventListener('resize', () => {
    const newPer = getPerPage();
    if (newPer !== perPage) {
      perPage = newPer;
      dotsWrap.innerHTML = Array.from({ length: getMaxIndex() + 1 }, (_, i) =>
        `<button class="carousel-dot${i === 0 ? ' active' : ''}" data-idx="${i}" aria-label="Відгук ${i + 1}"></button>`
      ).join('');
      dotsWrap.querySelectorAll('.carousel-dot').forEach(d => {
        d.addEventListener('click', () => { goTo(parseInt(d.dataset.idx)); startAuto(); });
      });
    }
    goTo(Math.min(current, getMaxIndex()));
  });

  perPage = getPerPage();
  goTo(0);
  startAuto();
}

}); // end DOMContentLoaded
