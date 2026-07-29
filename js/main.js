document.addEventListener('DOMContentLoaded', () => {
/* ========== DOM elements ========== */
const header = document.getElementById('header');
const headerNav = document.getElementById('headerNav');
const mobileNav = document.querySelector('.header__mobile-nav');
const form = document.getElementById('appointmentForm');
const formConfirm = document.getElementById('formConfirm');

/* ========== Dynamic content from API ========== */
loadDynamicContent();

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
    buildClientTimeSlots(dateVal, serviceVal, parseInt(locationVal));
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
      location_id: locationSelect ? parseInt(locationSelect.value) || null : null,
    };

    try {
      const res = await fetch('/api/appointments', {
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
  '.stats__item, .service-card, .testimonial-card, .faq__item, .about__content, .about__image, .contacts__info, .contacts__map'
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
async function loadDynamicContent() {
  try {
    /* --- Services --- */
    const svcRes = await fetch('/api/services');
    if (svcRes.ok) {
      const services = await svcRes.json();
      renderServices(services);

      /* --- Update select in appointment form --- */
      const select = document.querySelector('#appointmentForm select[name="service"]');
      if (select) {
        select.innerHTML = '<option value="" disabled selected>Оберіть послугу</option>';
        services.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.name;
          opt.textContent = s.name;
          select.appendChild(opt);
        });
      }
    }

    /* --- FAQ --- */
    const faqRes = await fetch('/api/faq');
    if (faqRes.ok) {
      const faqs = await faqRes.json();
      renderFaq(faqs, true);
    }

    /* --- Contacts (phones, locations, schedules) --- */
    const contactsRes = await fetch('/api/contacts');
    if (contactsRes.ok) {
      const contactsData = await contactsRes.json();
      renderContacts(contactsData);

      /* --- Populate location dropdown --- */
      const locationSelect = document.getElementById('appointmentLocation');
      if (locationSelect && contactsData.locations.length > 0) {
        locationSelect.innerHTML = '<option value="" disabled selected>Оберіть адресу</option>';
        contactsData.locations.forEach(loc => {
          const addr = [loc.city, loc.street, loc.building].filter(Boolean).join(', ');
          const opt = document.createElement('option');
          opt.value = loc.id;
          opt.textContent = addr;
          locationSelect.appendChild(opt);
        });
      }
    }
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
        if (s.lunch_start && s.lunch_end) line += ` (обід ${s.lunch_start} — ${s.lunch_end})`;
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

async function buildClientTimeSlots(dateVal, serviceVal, locationId) {
  const select = document.getElementById('appointmentTime');
  if (!select) return;
  select.innerHTML = '<option value="">Оберіть час</option>';
  select.disabled = false;
  if (!dateVal || !serviceVal || !locationId) return;

  const selectedDay = new Date(dateVal).getDay();

  // Get location schedule
  let workStart = 9 * 60;
  let workEnd = 18 * 60;
  let lunchStart = null;
  let lunchEnd = null;
  let isClosed = false;

  try {
    const schedRes = await fetch('/api/locations/' + locationId + '/schedules');
    if (schedRes.ok) {
      const schedules = await schedRes.json();
      const daySched = schedules.find(s => s.day_of_week === selectedDay);
      if (!daySched || !daySched.start_time) {
        isClosed = true;
      } else {
        const [sh, sm] = daySched.start_time.split(':').map(Number);
        const [eh, em] = daySched.end_time.split(':').map(Number);
        workStart = sh * 60 + sm;
        workEnd = eh * 60 + em;
        if (daySched.lunch_start) {
          const [lsh, lsm] = daySched.lunch_start.split(':').map(Number);
          lunchStart = lsh * 60 + lsm;
        }
        if (daySched.lunch_end) {
          const [leh, lem] = daySched.lunch_end.split(':').map(Number);
          lunchEnd = leh * 60 + lem;
        }
      }
    }
  } catch(e) {}

  if (isClosed) {
    select.innerHTML = '<option value="">Цей день — вихідний</option>';
    select.disabled = true;
    return;
  }

  // Get service duration
  let services = [];
  try { services = await fetch('/api/services').then(r => r.json()); } catch(e) {}
  const svc = services.find(s => s.name === serviceVal);
  const duration = svc ? (svc.duration || 30) : 30;

  // Get existing appointments for this day at this location
  let existing = [];
  try { existing = await fetch('/api/appointments?token=public').then(r => r.json()); } catch(e) {}
  const dayAppts = existing.filter(a => a.preferred_date === dateVal && a.status !== 'cancelled' && (!a.location_id || a.location_id === locationId));

  // Generate slots
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
    opt.textContent = hh + ':' + mm;
    select.appendChild(opt);
    slotCount++;
  }

  if (slotCount === 0) {
    select.innerHTML = '<option value="">На цю дату вільних записів немає</option>';
    select.disabled = true;
  }
}

}); // end DOMContentLoaded
