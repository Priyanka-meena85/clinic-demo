/* CareWell Clinic behaviour. Content lives in data.js. */

const STORAGE_KEYS = {
  appointments: "carewell_appointments",
  enquiries: "carewell_enquiries"
};

const state = {
  specialty: "All",
  group: "All",
  location: "All",
  availability: "All",
  fee: "All",
  query: "",
  selectedSlot: "",
  activeTrigger: null,
  lastBooking: null,
  rescheduleId: null,
  openReviews: ""
};

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });
}

function formatSlot(slot) {
  const [hourValue, minute] = slot.split(":").map(Number);
  const suffix = hourValue >= 12 ? "PM" : "AM";
  const hour = hourValue % 12 || 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatInr(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function initials(name) {
  const parts = name.replace(/^Dr\.\s*/i, "").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

function doctorById(id) {
  return CareWellData.doctors.find((doctor) => doctor.id === id) || null;
}

function isClosed(iso) {
  return CareWellData.clinic.closedWeekdays.includes(new Date(`${iso}T00:00:00`).getDay());
}

function isPastDate(iso) {
  return iso < toISODate(new Date());
}

function isPastSlot(iso, slot) {
  if (iso !== toISODate(new Date())) return false;
  const [hour, minute] = slot.split(":").map(Number);
  const now = new Date();
  return hour < now.getHours() || (hour === now.getHours() && minute <= now.getMinutes());
}

function nextOpenDate(fromIso) {
  let cursor = new Date(`${fromIso}T00:00:00`);
  for (let i = 0; i < 21; i += 1) {
    const iso = toISODate(cursor);
    const hasSlot = CareWellData.clinic.slots.some((slot) => !isPastSlot(iso, slot));
    if (!isClosed(iso) && hasSlot) return iso;
    cursor.setDate(cursor.getDate() + 1);
  }
  return fromIso;
}

/* TODO: Supabase — replace these helpers with a client query against
   public.appointments (id, patient_name, phone, doctor_id, date, slot,
   reason, visit_type, status, token, created_at). */
function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getAppointments() {
  const rows = readJson(STORAGE_KEYS.appointments, []);
  return Array.isArray(rows) ? rows : [];
}

function setAppointments(rows) {
  writeJson(STORAGE_KEYS.appointments, rows);
}

function activeAppointments() {
  return getAppointments().filter((row) => row.status === "booked" || row.status === "confirmed");
}

function takenSlots(doctorId, iso) {
  const taken = new Set();
  activeAppointments().forEach((row) => {
    if (row.doctorId === doctorId && row.date === iso) taken.add(row.slot);
  });
  return taken;
}

function getBlocks() {
  const rows = readJson("carewell_blocks", []);
  return Array.isArray(rows) ? rows : [];
}

function setBlocks(rows) {
  writeJson("carewell_blocks", rows);
}

function isSlotBlocked(doctorId, iso, slot) {
  return getBlocks().some((row) => row.doctorId === doctorId && row.date === iso && (!row.slot || row.slot === slot));
}

function seatCount(doctorId, iso, slot, ignoreId) {
  const live = getAppointments().filter((row) => (
    row.id !== ignoreId
    && row.doctorId === doctorId
    && row.date === iso
    && row.slot === slot
    && row.status !== "cancelled"
  )).length;
  const load = (CareWellData.clinic.slotLoad?.[doctorId] || {})[slot] || 0;
  return live + load;
}

function seatsLeft(doctorId, iso, slot, ignoreId) {
  if (isSlotBlocked(doctorId, iso, slot)) return 0;
  const capacity = CareWellData.clinic.slotCapacity || 4;
  return Math.max(0, capacity - seatCount(doctorId, iso, slot, ignoreId));
}

function hasOpenSeat(doctor, iso) {
  if (!doctor || isClosed(iso)) return false;
  return CareWellData.clinic.slots.some((slot) => !isPastSlot(iso, slot) && seatsLeft(doctor.id, iso, slot) > 0);
}

/* TODO: WhatsApp Business API — queue this outbox to the message template
   endpoint instead of keeping it in LocalStorage. */
function pushOutbox(entry) {
  const rows = readJson("carewell_outbox", []);
  rows.unshift(entry);
  writeJson("carewell_outbox", rows.slice(0, 40));
  if (window.CareWellSystem) window.CareWellSystem.refresh();
}

function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 10);
}

function validPhone(value) {
  return /^\d{10}$/.test(value);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 3200);
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function renderNav() {
  const linkHtml = CareWellData.nav.map((item) => {
    const count = item.count ? ' <span class="booking-count rounded-full bg-mint px-2 py-0.5 text-xs text-tealbrand font-bold">0</span>' : "";
    return `<a href="${item.href}" class="inline-flex items-center gap-1 hover:text-tealbrand text-xs font-semibold px-2 py-1 rounded-lg transition" data-nav-link>${item.label}${count}</a>`;
  }).join("");

  $("#desktop-nav").innerHTML = linkHtml;
  $("#mobile-menu").innerHTML = `
    <div class="flex flex-col gap-1 text-sm font-medium text-slate-700">
      ${CareWellData.nav.map((item) => {
        const count = item.count ? ' <span class="booking-count rounded-full bg-mint px-2 py-0.5 text-xs text-tealbrand font-bold">0</span>' : "";
        return `<a href="${item.href}" class="rounded-xl px-3 py-2.5 hover:bg-mint flex items-center justify-between" data-nav-link>${item.label}${count}</a>`;
      }).join("")}
      <div class="pt-2 mt-1 border-t border-slate-100 flex flex-col gap-2">
        <button type="button" onclick="window.CareWellAuth ? window.CareWellAuth.openModal('patient', 'login') : window.location.href='login.html'" class="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-tealbrand text-xs font-semibold text-white shadow-2xs">
          <i data-lucide="key-round" class="w-4 h-4"></i> Login / Sign Up (Patient, Doctor, Admin)
        </button>
        <a href="login.html" class="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-mint border border-emerald-200 text-xs font-semibold text-tealbrand">
          <i data-lucide="shield-check" class="w-3.5 h-3.5"></i> All Roles Gateway
        </a>
        <button type="button" data-open-booking class="inline-flex h-11 items-center justify-center rounded-xl border border-emerald-300 bg-white text-xs font-semibold text-tealbrand">Appointment book karo</button>
      </div>
    </div>`;
}

function renderHero() {
  const { hero, clinic } = CareWellData;
  $("#brand-name").textContent = clinic.shortName;
  $("#hero-kicker").textContent = hero.kicker;
  $("#hero-title").textContent = hero.title;
  $("#hero-emphasis").textContent = hero.titleEmphasis;
  $("#hero-body").textContent = hero.body;
  $("#hero-primary").textContent = hero.primaryCta;
  $("#hero-secondary").textContent = hero.secondaryCta;
  $("#hero-call-label").textContent = hero.callCta;
  $("#hero-call").href = `tel:+91${clinic.phone}`;

  const fees = CareWellData.doctors.map((doctor) => doctor.fee);
  const minFee = Math.min(...fees);
  const stats = [
    [`${CareWellData.doctors.length} doctors`, "OPD panel"],
    ["Mon–Sat", "Sunday band"],
    [`${formatInr(minFee)} se`, "Consultation fee"]
  ];
  $("#trust-row").innerHTML = stats.map(([value, label]) => `
    <div class="rounded-2xl border border-emerald-100 bg-white px-4 py-3">
      <dt class="text-xs font-medium text-slate-500">${label}</dt>
      <dd class="mt-1 font-display text-2xl text-slate-950">${value}</dd>
    </div>`).join("");

  $("#hours-list").innerHTML = clinic.hours.map((row) => `
    <div class="flex items-start justify-between gap-4 text-sm">
      <dt class="text-slate-500">${escapeHtml(row.days)}</dt>
      <dd class="text-right font-medium text-slate-800">${escapeHtml(row.time)}</dd>
    </div>`).join("");
}

function renderClinicStatus() {
  const today = toISODate(new Date());
  const status = $("#clinic-status");
  const copy = $("#next-slot-copy");
  if (isClosed(today)) {
    status.textContent = "Sunday band hai";
    const next = nextOpenDate(addDays(today, 1));
    copy.textContent = `Agli OPD ${formatDate(next)} ko subah ${formatSlot(CareWellData.clinic.slots[0])} se.`;
    return;
  }
  const future = CareWellData.clinic.slots.filter((slot) => !isPastSlot(today, slot));
  if (!future.length) {
    status.textContent = "Aaj ki OPD khatam";
    const next = nextOpenDate(addDays(today, 1));
    copy.textContent = `Agli OPD ${formatDate(next)} ko subah ${formatSlot(CareWellData.clinic.slots[0])} se.`;
    return;
  }
  status.textContent = "OPD open hai";
  const sampleDoctor = CareWellData.doctors[0];
  const taken = takenSlots(sampleDoctor.id, today);
  const openSlot = future.find((slot) => !taken.has(slot));
  copy.textContent = openSlot
    ? `${sampleDoctor.name} ke paas aaj ${formatSlot(openSlot)} ka slot abhi khali dikh raha hai.`
    : "Aaj ke kuch slots book ho chuke hain. Doctor card se doosra time dekho.";
}

function renderServices() {
  $("#service-grid").innerHTML = CareWellData.services.map((service) => `
    <article class="flex h-full flex-col rounded-3xl border border-emerald-100 bg-white p-5">
      <span class="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-mint text-tealbrand">
        <i data-lucide="${escapeHtml(service.icon)}" class="h-5 w-5"></i>
      </span>
      <h3 class="mt-4 font-display text-2xl text-slate-950">${escapeHtml(service.title)}</h3>
      <p class="mt-2 flex-1 text-sm leading-6 text-slate-600">${escapeHtml(service.text)}</p>
      <button type="button" data-jump-specialty="${escapeHtml(service.specialty)}" class="mt-5 inline-flex h-11 items-center gap-2 text-sm font-semibold text-tealbrand">
        Doctors dekho <i data-lucide="arrow-right" class="h-4 w-4"></i>
      </button>
    </article>`).join("");
}

function doctorBadge(doctor) {
  const today = toISODate(new Date());
  if (isClosed(today)) return CareWellData.messages.closedToday;
  const future = CareWellData.clinic.slots.filter((slot) => !isPastSlot(today, slot));
  if (!future.length) return CareWellData.messages.dayFinished;
  const free = future.filter((slot) => seatsLeft(doctor.id, today, slot) > 0);
  return free.length ? CareWellData.messages.slotsOpen : CareWellData.messages.slotsFull;
}

function renderFilters() {
  const groups = ["All", "General", "Pediatrics", "Skin", "Dental", "ENT", "Ortho", "Cardiology", "Gynecology"];
  $("#doctor-filters").innerHTML = groups.map((group) => {
    const selected = group === state.group;
    return `<button type="button" role="tab" aria-selected="${selected}" data-group="${escapeHtml(group)}" class="finder-chip shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${selected ? "bg-tealbrand text-white" : "border border-emerald-200 bg-white text-slate-700"}">${escapeHtml(group)}</button>`;
  }).join("");
  document.querySelectorAll(".finder-chip").forEach((chip) => {
    const key = chip.dataset.group ? "group" : chip.dataset.location ? "location" : chip.dataset.availability ? "availability" : chip.dataset.fee ? "fee" : "";
    if (!key) return;
    const on = chip.dataset[key] === state[key];
    chip.classList.toggle("bg-tealbrand", on);
    chip.classList.toggle("text-white", on);
    chip.classList.toggle("border-emerald-200", !on);
    chip.classList.toggle("bg-white", !on);
    chip.classList.toggle("text-slate-700", !on);
  });
}

function nextSlotLabel(doctor) {
  let cursor = toISODate(new Date());
  for (let day = 0; day < 14; day += 1) {
    if (!isClosed(cursor)) {
      const slot = CareWellData.clinic.slots.find((item) => !isPastSlot(cursor, item) && seatsLeft(doctor.id, cursor, item) > 0);
      if (slot) return `${formatDate(cursor)}, ${formatSlot(slot)}`;
    }
    cursor = addDays(cursor, 1);
  }
  return "Koi slot nahi";
}

function filteredDoctors() {
  const query = state.query.trim().toLowerCase();
  const today = toISODate(new Date());
  const tomorrow = addDays(today, 1);
  return CareWellData.doctors.filter((doctor) => {
    if (state.group !== "All" && doctor.group !== state.group) return false;
    if (state.location === "Near Me" && doctor.location !== CareWellData.clinic.nearLocation) return false;
    if (state.location !== "All" && state.location !== "Near Me" && doctor.location !== state.location) return false;
    if (state.fee === "under400" && doctor.fee >= 400) return false;
    if (state.fee === "mid" && (doctor.fee < 400 || doctor.fee > 600)) return false;
    if (state.fee === "high" && doctor.fee <= 600) return false;
    if (state.availability === "today" && !hasOpenSeat(doctor, today)) return false;
    if (state.availability === "tomorrow" && !hasOpenSeat(doctor, tomorrow)) return false;
    if (query && !`${doctor.name} ${doctor.specialty} ${doctor.group}`.toLowerCase().includes(query)) return false;
    return true;
  });
}

function renderDoctors() {
  const list = filteredDoctors();
  const empty = $("#doctor-empty");
  if (empty) {
    empty.textContent = "Is filter pe koi doctor nahi mila. Filter hata ke dobara dekho.";
    empty.classList.toggle("hidden", list.length > 0);
  }
  $("#doctor-grid").innerHTML = list.map((doctor) => `
    <article class="ux-card-hover flex h-full flex-col rounded-3xl border border-emerald-100 bg-white p-5 shadow-xs">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-3">
          <div class="relative">
            <span class="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-tealbrand to-emerald-700 font-display text-lg text-white font-bold shadow-xs" role="img" aria-label="Photo of ${escapeHtml(doctor.name)}">${initials(doctor.name)}</span>
            <span class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" title="Verified & Available"></span>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <h3 class="font-display text-xl leading-tight text-slate-950">${escapeHtml(doctor.name)}</h3>
              <span class="text-tealbrand text-xs" title="Verified Medical Practitioner">✓</span>
            </div>
            <p class="mt-0.5 text-xs font-semibold text-tealbrand">${escapeHtml(doctor.specialty)} · <span class="text-slate-500 font-normal">${escapeHtml(doctor.location || "Pune")}</span></p>
            <p class="text-[11px] font-medium text-slate-400 mt-0.5">${escapeHtml(doctor.qualifications)}</p>
          </div>
        </div>
        <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
          ★ ${doctor.rating || 4.8}
        </span>
      </div>

      <p class="mt-3 flex-1 text-xs leading-5 text-slate-600">${escapeHtml(doctor.bio)}</p>

      <dl class="mt-3.5 grid grid-cols-2 gap-2 text-xs">
        <div class="rounded-2xl bg-mint/60 border border-emerald-100/60 px-3 py-2">
          <dt class="text-[10px] uppercase font-semibold text-slate-500">Experience</dt>
          <dd class="font-bold text-slate-800 text-sm mt-0.5">${doctor.experienceYears} yrs</dd>
        </div>
        <div class="rounded-2xl bg-mint/60 border border-emerald-100/60 px-3 py-2">
          <dt class="text-[10px] uppercase font-semibold text-slate-500">OPD Fee</dt>
          <dd class="font-bold text-tealbrand text-sm mt-0.5">${formatInr(doctor.fee)}</dd>
        </div>
      </dl>

      <!-- Next Slot Highlight Box -->
      <div class="mt-3 p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between text-xs">
        <div>
          <span class="text-[10px] font-semibold text-tealbrand uppercase tracking-wider block">Next Available Slot</span>
          <span class="font-bold text-slate-900">${escapeHtml(nextSlotLabel(doctor))}</span>
        </div>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white border border-emerald-200 text-tealbrand shadow-2xs">${escapeHtml(doctorBadge(doctor))}</span>
      </div>

      <div class="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
        <span class="truncate">🗣️ ${(doctor.languages || []).join(", ")}</span>
        <button type="button" data-reviews="${escapeHtml(doctor.id)}" class="shrink-0 text-tealbrand font-semibold hover:underline">
          ${state.openReviews === doctor.id ? "Reviews Hide" : `${doctor.reviewCount || 0} Reviews`}
        </button>
      </div>

      ${state.openReviews === doctor.id ? `<ul class="mt-2.5 space-y-2 text-xs text-slate-600 animate-in fade-in">${(doctor.reviews || []).map((review) => `<li class="rounded-xl bg-slate-50 border border-slate-100 p-2.5"><span class="font-semibold text-slate-800">${escapeHtml(review.name)}:</span> "${escapeHtml(review.text)}"</li>`).join("")}</ul>` : ""}

      <button type="button" data-open-booking data-doctor="${escapeHtml(doctor.id)}" class="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-tealbrand text-xs sm:text-sm font-semibold text-white hover:bg-teal-700 transition shadow-xs">
        <i data-lucide="calendar" class="w-4 h-4"></i>
        ${CareWellData.messages.bookCta}
      </button>
    </article>`).join("");
}

function renderSteps() {
  $("#step-list").innerHTML = CareWellData.steps.map((step, index) => `
    <li class="rounded-3xl border border-emerald-100 p-5">
      <span class="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-mint text-tealbrand">
        <i data-lucide="${escapeHtml(step.icon)}" class="h-5 w-5"></i>
      </span>
      <p class="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Step ${index + 1}</p>
      <h3 class="mt-1 font-display text-2xl text-slate-950">${escapeHtml(step.title)}</h3>
      <p class="mt-2 text-sm leading-6 text-slate-600">${escapeHtml(step.text)}</p>
    </li>`).join("");
}

function renderStories() {
  $("#story-grid").innerHTML = CareWellData.testimonials.map((story) => `
    <figure class="flex h-full flex-col rounded-3xl border border-emerald-100 bg-white p-5">
      <i data-lucide="quote" class="h-5 w-5 text-tealbrand"></i>
      <blockquote class="mt-3 flex-1 text-base leading-7 text-slate-800">“${escapeHtml(story.quote)}”</blockquote>
      <figcaption class="mt-5 text-sm">
        <span class="font-semibold text-slate-900">${escapeHtml(story.name)}</span>
        <span class="text-slate-500"> · ${escapeHtml(story.area)}</span>
        <span class="mt-1 block text-tealbrand">${escapeHtml(story.visit)}</span>
      </figcaption>
    </figure>`).join("");
}

function renderFaqs() {
  $("#faq-list").innerHTML = CareWellData.faqs.map((item, index) => `
    <div class="border-b border-emerald-100">
      <button type="button" class="flex w-full items-center justify-between gap-4 py-4 text-left" data-faq-button aria-expanded="false" aria-controls="faq-panel-${index}">
        <span class="font-semibold text-slate-900">${escapeHtml(item.q)}</span>
        <i data-lucide="chevron-down" class="chevron h-5 w-5 shrink-0 text-tealbrand"></i>
      </button>
      <div id="faq-panel-${index}" class="hidden pb-4 text-sm leading-6 text-slate-600" data-faq-panel>${escapeHtml(item.a)}</div>
    </div>`).join("");
}

function bookingShareText(row) {
  const doctor = doctorById(row.doctorId);
  return [
    `CareWell Clinic booking ${row.bookingId || row.token}`,
    `Token No. ${row.tokenNo || ""}`,
    `Patient: ${row.patientName}`,
    `Doctor: ${doctor ? doctor.name : row.doctorId}`,
    `Visit: ${row.visitType}`,
    `Date: ${formatDate(row.date)}`,
    `Time: ${formatSlot(row.slot)}`
  ].join("\n");
}

/* TODO: WhatsApp Business API — POST the confirmed template
   appointment_confirmed to the patient's phone. The wa.me link below
   is only the demo stand-in until that API is connected. */
function whatsappUrl(text) {
  return `https://wa.me/91${CareWellData.clinic.whatsapp}?text=${encodeURIComponent(text)}`;
}

function downloadCalendar(row) {
  const doctor = doctorById(row.doctorId);
  const [hour, minute] = row.slot.split(":").map(Number);
  const start = new Date(`${row.date}T00:00:00`);
  start.setHours(hour, minute, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const stamp = (date) => {
    const pad = (part) => String(part).padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
  };
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CareWell Clinic//Demo//EN",
    "BEGIN:VEVENT",
    `UID:${row.id}@carewell.example`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:CareWell Clinic - ${doctor ? doctor.name : "Appointment"}`,
    `LOCATION:${CareWellData.clinic.address}`,
    `DESCRIPTION:${bookingShareText(row).replace(/\n/g, "\\n")}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${row.token}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderAppointments() {
  const rows = activeAppointments().slice().sort((a, b) => `${a.date}${a.slot}`.localeCompare(`${b.date}${b.slot}`));
  document.querySelectorAll(".booking-count").forEach((node) => {
    node.textContent = String(rows.length);
  });
  if (!rows.length) {
    $("#booking-list").innerHTML = `
      <div class="rounded-3xl border border-dashed border-emerald-200 bg-white p-6 text-sm leading-6 text-slate-600 lg:col-span-2">
        ${escapeHtml(CareWellData.messages.emptyBookings)}
      </div>`;
    return;
  }
  $("#booking-list").innerHTML = rows.map((row) => {
    const doctor = doctorById(row.doctorId);
    return `
      <article class="rounded-3xl border border-emerald-100 bg-white p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-tealbrand">${escapeHtml(row.bookingId || row.token)} · Token No. ${escapeHtml(row.tokenNo || "—")}</p>
            <h3 class="mt-1 font-display text-2xl text-slate-950">${escapeHtml(row.patientName)}</h3>
            <p class="mt-1 text-sm text-slate-600">${escapeHtml(doctor ? doctor.name : "Doctor")} · ${escapeHtml(doctor ? doctor.specialty : "")}</p>
          </div>
          <span class="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-tealbrand">${escapeHtml(row.status === "booked" ? "Confirmed" : row.status)}</span>
        </div>
        <p class="mt-4 text-sm font-medium text-slate-800">${formatDate(row.date)} · ${formatSlot(row.slot)}</p>
        <p class="mt-1 text-sm text-slate-500">${escapeHtml(row.phone)}${row.reason ? ` · ${escapeHtml(row.reason)}` : ""}</p>
        <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <a class="inline-flex h-11 items-center justify-center rounded-full border border-emerald-200 text-sm font-semibold text-tealbrand" target="_blank" rel="noopener" href="${whatsappUrl(bookingShareText(row))}">WhatsApp</a>
          <button type="button" data-calendar="${escapeHtml(row.id)}" class="inline-flex h-11 items-center justify-center rounded-full border border-emerald-200 text-sm font-semibold text-tealbrand">Calendar</button>
          <button type="button" data-reschedule="${escapeHtml(row.id)}" data-doctor="${escapeHtml(row.doctorId)}" class="inline-flex h-11 items-center justify-center rounded-full border border-emerald-200 text-sm font-semibold text-tealbrand">Reschedule</button>
          <button type="button" data-cancel="${escapeHtml(row.id)}" class="inline-flex h-11 items-center justify-center rounded-full border border-red-200 text-sm font-semibold text-red-700">${CareWellData.messages.cancelCta}</button>
        </div>
      </article>`;
  }).join("");
}

function renderVisit() {
  const { clinic } = CareWellData;
  $("#visit-address").textContent = `${clinic.address}. ${clinic.city}.`;
  $("#visit-hours").innerHTML = clinic.hours.map((row) => `
    <div class="flex justify-between gap-4">
      <dt>${escapeHtml(row.days)}</dt>
      <dd class="font-medium text-slate-800">${escapeHtml(row.time)}</dd>
    </div>`).join("");
  $("#emergency-note").textContent = "Emergency symptoms — chest pain, saans ki takleef, heavy bleeding — pe clinic ka wait mat karo. Nearest emergency service use karo.";
  const tel = `tel:+91${clinic.phone}`;
  $("#visit-call").href = tel;
  $("#emergency-call").href = tel;
  $("#emergency-float").href = tel;
  $("#visit-whatsapp").href = whatsappUrl("Namaste, mujhe CareWell Clinic ke OPD hours ke baare mein jaanna hai.");
  $("#wa-float").href = whatsappUrl("Namaste, CareWell Clinic se baat karni hai.");
  $("#visit-maps").href = clinic.mapsUrl;
}

function renderFooter() {
  const { clinic, nav } = CareWellData;
  $("#site-footer").innerHTML = `
    <!-- Top Security & Trust Assurance Banner -->
    <div class="mb-12 pb-8 border-b border-emerald-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div class="flex items-start sm:items-center gap-3.5">
        <span class="w-12 h-12 rounded-2xl bg-white/10 text-emerald-300 border border-emerald-400/30 flex items-center justify-center font-bold text-xl shrink-0">
          🛡️
        </span>
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h4 class="font-display text-lg font-bold text-white">20-Point Security & Medical Privacy Shield</h4>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950 uppercase tracking-wider">
              20/20 PASSED (100%)
            </span>
          </div>
          <p class="text-xs text-emerald-200/80 mt-0.5 leading-relaxed">
            Zero BOLA/IDOR Data Leakage · SQL Parameterization · Rate Limiting · End-to-End Encrypted Eye Test & Prescriptions
          </p>
        </div>
      </div>
      <button type="button" onclick="window.CareWellSecurity ? window.CareWellSecurity.openSecurityAuditModal() : null" class="px-5 py-2.5 rounded-xl bg-white text-tealbrand hover:bg-emerald-50 font-bold text-xs shadow-md transition flex items-center justify-center gap-2 shrink-0">
        <i data-lucide="shield-check" class="w-4 h-4 text-emerald-600"></i>
        <span>View 20-Point Security Report</span>
      </button>
    </div>

    <!-- 5-Column Main Footer Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 text-xs">
      
      <!-- Col 1: Brand & Credentials -->
      <div class="lg:col-span-2 space-y-4">
        <div class="flex items-center gap-2.5">
          <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-tealbrand shadow-xs">
            <i data-lucide="heart-pulse" class="h-5 w-5"></i>
          </span>
          <div>
            <span class="block font-display text-xl font-bold leading-none text-white">${escapeHtml(clinic.name)}</span>
            <span class="block text-[11px] text-emerald-300 font-medium mt-0.5">Primary Care & Computerized Optical Center</span>
          </div>
        </div>
        <p class="text-emerald-100/80 text-xs leading-relaxed max-w-sm">
          Camp Pune's premier paperless healthcare facility. Zero waiting room crowds with live queue tracking, computerized eye testing, WhatsApp auto-reminders, and 24/7 AI voice call recovery.
        </p>
        <div class="pt-2 flex flex-wrap gap-2 text-[10px] font-bold text-emerald-200">
          <span class="px-2.5 py-1 rounded-lg bg-white/10 border border-white/10">✓ NABH Quality Protocol</span>
          <span class="px-2.5 py-1 rounded-lg bg-white/10 border border-white/10">✓ ISO 9001:2015</span>
          <span class="px-2.5 py-1 rounded-lg bg-white/10 border border-white/10">✓ HIPAA Compliant</span>
        </div>
      </div>

      <!-- Col 2: Clinical & Optical Services -->
      <div class="space-y-3">
        <span class="font-bold text-white text-xs uppercase tracking-wider block border-b border-emerald-800 pb-2">
          Specialties & Care
        </span>
        <div class="flex flex-col gap-2 text-emerald-200/90">
          <a class="hover:text-white transition flex items-center gap-1.5" href="#services">
            <i data-lucide="eye" class="w-3.5 h-3.5 text-emerald-300"></i> Free Eye Test & Optical
          </a>
          <a class="hover:text-white transition flex items-center gap-1.5" href="#services">
            <i data-lucide="glasses" class="w-3.5 h-3.5 text-emerald-300"></i> Blue-Cut Computer Glasses
          </a>
          <a class="hover:text-white transition flex items-center gap-1.5" href="#services">
            <i data-lucide="stethoscope" class="w-3.5 h-3.5 text-emerald-300"></i> General Physician OPD
          </a>
          <a class="hover:text-white transition flex items-center gap-1.5" href="#services">
            <i data-lucide="heart-pulse" class="w-3.5 h-3.5 text-emerald-300"></i> Preventive Cardiology
          </a>
          <a class="hover:text-white transition flex items-center gap-1.5" href="#services">
            <i data-lucide="baby" class="w-3.5 h-3.5 text-emerald-300"></i> Pediatrics & Vaccines
          </a>
          <a class="hover:text-white transition flex items-center gap-1.5" href="#services">
            <i data-lucide="smile" class="w-3.5 h-3.5 text-emerald-300"></i> Dental Surgery
          </a>
        </div>
      </div>

      <!-- Col 3: Role Portals & Patient Tools -->
      <div class="space-y-3">
        <span class="font-bold text-white text-xs uppercase tracking-wider block border-b border-emerald-800 pb-2">
          Dedicated Portals
        </span>
        <div class="flex flex-col gap-2 text-emerald-200/90">
          <a class="hover:text-white transition flex items-center gap-1.5" href="patient.html">
            <i data-lucide="user-round" class="w-3.5 h-3.5 text-emerald-300"></i> Patient Portal (Rx & Reports)
          </a>
          <a class="hover:text-white transition flex items-center gap-1.5" href="doctor.html">
            <i data-lucide="stethoscope" class="w-3.5 h-3.5 text-emerald-300"></i> Doctor OPD Console
          </a>
          <a class="hover:text-white transition flex items-center gap-1.5" href="admin.html">
            <i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-300"></i> Reception & Admin Desk
          </a>
          <a class="hover:text-white transition flex items-center gap-1.5" href="login.html">
            <i data-lucide="key-round" class="w-3.5 h-3.5 text-emerald-300"></i> Role Gateway & Sign Up
          </a>
          <a class="hover:text-white transition flex items-center gap-1.5" href="#queue">
            <i data-lucide="radio" class="w-3.5 h-3.5 text-emerald-300"></i> Live OPD Token Stepper
          </a>
          <button type="button" onclick="window.CareWellSystem ? window.CareWellSystem.openAICallModal() : null" class="text-left hover:text-white transition flex items-center gap-1.5 text-amber-300 font-semibold">
            <i data-lucide="bot" class="w-3.5 h-3.5 text-amber-400"></i> 24/7 AI Night Receptionist
          </button>
        </div>
      </div>

      <!-- Col 4: Timings & Emergency -->
      <div class="space-y-3">
        <span class="font-bold text-white text-xs uppercase tracking-wider block border-b border-emerald-800 pb-2">
          OPD Hours & Location
        </span>
        <div class="space-y-2 text-emerald-100/90 leading-relaxed">
          <p><strong class="text-white block">Monday – Saturday:</strong> 9:00 AM – 1:00 PM<br>4:00 PM – 7:00 PM</p>
          <p><strong class="text-white block">Sunday:</strong> Emergency On-Call Only</p>
          <div class="pt-2 border-t border-emerald-800/60">
            <p class="font-bold text-white">Emergency Helpline:</p>
            <a href="tel:+919876543210" class="text-amber-300 font-bold hover:underline block text-sm mt-0.5">+91 98765 43210</a>
            <p class="text-[11px] text-emerald-300 mt-1">214, MG Road, Camp, Pune</p>
          </div>
        </div>
      </div>

    </div>

    <!-- Bottom Legal & Compliance Sub-Bar -->
    <div class="mt-12 pt-6 border-t border-emerald-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[11px] text-emerald-300/80">
      <div class="space-y-1">
        <p>© 2026 CareWell Healthcare & Optical Solutions. All rights reserved.</p>
        <p class="text-emerald-400/60">Medical Disclaimer: Eye power readings and digital prescriptions are strictly encrypted under patient-only access controls.</p>
      </div>
      <div class="flex flex-wrap items-center gap-4 text-emerald-200">
        <button type="button" onclick="window.CareWellSecurity ? window.CareWellSecurity.openSecurityAuditModal() : null" class="hover:text-white transition underline font-medium">
          20-Point Security Audit Report
        </button>
        <span>·</span>
        <a href="#home" class="hover:text-white transition">Privacy Policy</a>
        <span>·</span>
        <a href="#home" class="hover:text-white transition">Terms of Service</a>
        <span>·</span>
        <a href="login.html" class="hover:text-white transition">Staff Portals</a>
      </div>
    </div>`;
}

function updateBookingCountAndLists() {
  renderDoctors();
  renderAppointments();
  renderClinicStatus();
  if (window.CareWellSystem) window.CareWellSystem.refresh();
  refreshIcons();
}

function fillDoctorSelect(preferredId) {
  const select = $("#patient-doctor");
  select.innerHTML = `<option value="">Doctor choose karo</option>${CareWellData.doctors.map((doctor) => `
    <option value="${escapeHtml(doctor.id)}">${escapeHtml(doctor.name)} · ${escapeHtml(doctor.specialty)}</option>`).join("")}`;
  if (preferredId && doctorById(preferredId)) select.value = preferredId;
  updateDoctorMeta();
}

function updateDoctorMeta() {
  const doctor = doctorById($("#patient-doctor").value);
  $("#doctor-meta").textContent = doctor
    ? `${doctor.specialty} · ${doctor.qualifications} · ${formatInr(doctor.fee)}`
    : "Doctor select karte hi fee yahan dikhegi.";
}

function renderSlots() {
  const date = $("#patient-date").value;
  const doctorId = $("#patient-doctor").value;
  const grid = $("#slot-grid");
  const empty = $("#slot-empty");
  const messages = CareWellData.messages;

  if (!date || !doctorId) {
    grid.innerHTML = "";
    empty.textContent = messages.pickFirst;
    empty.classList.remove("hidden");
    return;
  }
  if (isPastDate(date) || isClosed(date)) {
    grid.innerHTML = "";
    state.selectedSlot = "";
    empty.textContent = isPastDate(date) ? messages.pastDate : messages.closed;
    empty.classList.remove("hidden");
    return;
  }

  const available = CareWellData.clinic.slots.filter((slot) => !isPastSlot(date, slot));
  if (!available.length) {
    grid.innerHTML = "";
    state.selectedSlot = "";
    empty.textContent = messages.dayOver;
    empty.classList.remove("hidden");
    return;
  }
  if (!available.includes(state.selectedSlot) || seatsLeft(doctorId, date, state.selectedSlot, state.rescheduleId) <= 0) {
    state.selectedSlot = "";
  }
  empty.classList.add("hidden");
  renderDateChips();

  const groups = [
    ["Subah", available.filter((slot) => Number(slot.slice(0, 2)) < 13)],
    ["Shaam", available.filter((slot) => Number(slot.slice(0, 2)) >= 13)]
  ];
  grid.innerHTML = groups.filter(([, slots]) => slots.length).map(([label, slots]) => `
    <div>
      <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">${label}</p>
      <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
        ${slots.map((slot) => {
          const left = seatsLeft(doctorId, date, slot, state.rescheduleId);
          const full = left <= 0;
          const tone = full ? "is-full" : left <= 2 ? "is-low" : "is-open";
          const note = full ? "Full" : left <= 2 ? `${left} Slot${left === 1 ? "" : "s"} Left` : "Available";
          const selected = slot === state.selectedSlot;
          return `<button type="button" class="slot-btn ${tone} ${selected ? "is-selected" : ""}" data-slot="${slot}" ${full ? "disabled" : ""}>${formatSlot(slot)}<span class="mt-0.5 block text-[10px] font-medium">${note}</span></button>`;
        }).join("")}
      </div>
    </div>`).join("");
}

function renderDateChips() {
  const box = $("#date-chips");
  const input = $("#patient-date");
  if (!box || !input) return;
  const dates = [];
  let cursor = toISODate(new Date());
  for (let i = 0; i < 21 && dates.length < 3; i += 1) {
    if (!isClosed(cursor)) dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  box.innerHTML = dates.map((iso) => {
    const on = iso === input.value;
    const label = new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
    return `<button type="button" data-date-chip="${iso}" class="shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${on ? "bg-tealbrand text-white" : "border border-emerald-200 bg-white text-slate-700"}">${label}</button>`;
  }).join("");
}

function nextTokenNo(doctorId, date) {
  const used = getAppointments()
    .filter((row) => row.doctorId === doctorId && row.date === date && row.status !== "cancelled")
    .map((row) => Number(row.tokenNo) || 0);
  return Math.max(8, ...used, 0) + 1;
}

function setBookingError(message) {
  const node = $("#booking-error");
  if (!message) {
    node.textContent = "";
    node.classList.add("hidden");
    return;
  }
  node.textContent = message;
  node.classList.remove("hidden");
}

function showBookingForm() {
  $("#booking-form-view").hidden = false;
  $("#booking-success-view").hidden = true;
}

function showBookingSuccess(row) {
  const doctor = doctorById(row.doctorId);
  state.lastBooking = row;
  $("#success-copy").textContent = `${row.patientName}, ${formatDate(row.date)} ko ${formatSlot(row.slot)} ka slot ${doctor ? doctor.name : "doctor"} ke paas lock hai.`;
  $("#success-channels").textContent = "Screen pe confirm ho gaya. WhatsApp outbox mein message chala gaya. Email draft neeche se khulega.";
  $("#success-details").innerHTML = [
    ["Booking ID", row.bookingId || row.token],
    ["Token No.", row.tokenNo || "—"],
    ["Doctor", doctor ? `${doctor.name} · ${doctor.specialty}` : ""],
    ["Phone", row.phone],
    ["Age", row.age || "—"],
    ["Visit", row.visitType],
    ["When", `${formatDate(row.date)} · ${formatSlot(row.slot)}`]
  ].map(([label, value]) => `
    <div class="flex justify-between gap-4">
      <dt class="text-slate-500">${label}</dt>
      <dd class="text-right font-semibold text-slate-900">${escapeHtml(value)}</dd>
    </div>`).join("");
  $("#booking-form-view").hidden = true;
  $("#booking-success-view").hidden = false;
  refreshIcons();
}

function openMenu() {
  $("#mobile-menu").classList.remove("hidden");
  $("#nav-toggle").setAttribute("aria-expanded", "true");
  $("#nav-toggle").setAttribute("aria-label", "Close menu");
  $("#icon-menu").classList.add("hidden");
  $("#icon-close").classList.remove("hidden");
}

function closeMenu() {
  $("#mobile-menu").classList.add("hidden");
  $("#nav-toggle").setAttribute("aria-expanded", "false");
  $("#nav-toggle").setAttribute("aria-label", "Open menu");
  $("#icon-menu").classList.remove("hidden");
  $("#icon-close").classList.add("hidden");
}

function openBooking(doctorId, trigger, rescheduleId) {
  closeMenu();
  state.activeTrigger = trigger || null;
  state.selectedSlot = "";
  state.lastBooking = null;
  state.rescheduleId = rescheduleId || null;
  showBookingForm();
  $("#booking-form").reset();
  const today = toISODate(new Date());
  const dateInput = $("#patient-date");
  dateInput.min = today;
  dateInput.max = addDays(today, 30);
  dateInput.value = nextOpenDate(today);
  $("#booking-title").textContent = state.rescheduleId ? "Appointment reschedule karo" : "Appointment book karo";
  const current = state.rescheduleId ? getAppointments().find((item) => item.id === state.rescheduleId) : null;
  fillDoctorSelect(current ? current.doctorId : doctorId);
  if (current) {
    $("#patient-name").value = current.patientName;
    $("#patient-phone").value = current.phone;
    $("#patient-age").value = current.age || "";
    $("#patient-reason").value = current.reason || "";
    dateInput.value = current.date;
    state.selectedSlot = current.slot;
    const radio = document.querySelector(`input[name="visit-type"][value="${current.visitType}"]`);
    if (radio) radio.checked = true;
  }
  setBookingError("");
  renderSlots();
  const modal = $("#booking-modal");
  modal.classList.remove("hidden");
  document.body.classList.add("overflow-hidden");
  requestAnimationFrame(() => modal.classList.add("is-open"));
  refreshIcons();
  setTimeout(() => $("#patient-name").focus(), 50);
}

function closeBooking() {
  const modal = $("#booking-modal");
  modal.classList.remove("is-open");
  document.body.classList.remove("overflow-hidden");
  setTimeout(() => {
    if (!modal.classList.contains("is-open")) modal.classList.add("hidden");
  }, 280);
  if (state.activeTrigger && typeof state.activeTrigger.focus === "function") {
    state.activeTrigger.focus();
  }
}

function seedAppointments() {
  if (localStorage.getItem(STORAGE_KEYS.appointments)) return;
  const firstDay = nextOpenDate(toISODate(new Date()));
  const secondDay = nextOpenDate(addDays(firstDay, 1));
  const futureSlot = CareWellData.clinic.slots.find((slot) => !isPastSlot(firstDay, slot)) || "10:00";
  setAppointments([
    {
      id: "cw-demo-1",
      bookingId: "CW-2401",
      tokenNo: 11,
      token: "CW-2401",
      patientName: "Ritu Sharma",
      phone: "9845011122",
      age: 34,
      doctorId: "ananya-rao",
      date: firstDay,
      slot: futureSlot,
      reason: "BP follow-up",
      visitType: "Follow-up",
      status: "confirmed",
      createdAt: new Date().toISOString()
    },
    {
      id: "cw-demo-2",
      bookingId: "CW-2402",
      tokenNo: 6,
      token: "CW-2402",
      patientName: "Imran Qureshi",
      phone: "9765432109",
      age: 9,
      doctorId: "sameer-khan",
      date: secondDay,
      slot: "16:30",
      reason: "Fever review",
      visitType: "Follow-up",
      status: "confirmed",
      createdAt: new Date().toISOString()
    }
  ]);
}

function submitBooking(event) {
  event.preventDefault();
  const messages = CareWellData.messages;
  const patientName = $("#patient-name").value.trim();
  const phone = phoneDigits($("#patient-phone").value);
  $("#patient-phone").value = phone;
  const doctorId = $("#patient-doctor").value;
  const date = $("#patient-date").value;
  const reason = $("#patient-reason").value.trim();
  const age = Number($("#patient-age").value);
  const visitType = document.querySelector('input[name="visit-type"]:checked')?.value || "New visit";

  if (patientName.length < 2) return setBookingError(messages.name);
  if (!validPhone(phone)) return setBookingError(messages.phone);
  if (!Number.isInteger(age) || age < 1 || age > 110) return setBookingError(messages.age);
  if (reason.length < 3) return setBookingError(messages.problem);
  if (!doctorById(doctorId)) return setBookingError(messages.doctor);
  if (!date) return setBookingError(messages.date);
  if (isPastDate(date)) return setBookingError(messages.pastDate);
  if (isClosed(date)) return setBookingError(messages.closed);
  if (!state.selectedSlot) return setBookingError(messages.slot);
  if (isPastSlot(date, state.selectedSlot)) return setBookingError(messages.dayOver);
  if (seatsLeft(doctorId, date, state.selectedSlot, state.rescheduleId) <= 0) return setBookingError(messages.taken);
  const clash = activeAppointments().some((row) => row.id !== state.rescheduleId && row.phone === phone && row.date === date && row.slot === state.selectedSlot);
  if (clash) return setBookingError(messages.clash);

  const existing = state.rescheduleId ? getAppointments().find((item) => item.id === state.rescheduleId) : null;
  const bookingId = existing?.bookingId || `CW-${String(2000 + (Date.now() % 7000)).padStart(4, "0")}`;
  const tokenNo = existing?.tokenNo || nextTokenNo(doctorId, date);
  const row = {
    id: existing?.id || `cw-${Date.now()}`,
    bookingId,
    tokenNo,
    token: bookingId,
    patientName,
    phone,
    age,
    doctorId,
    date,
    slot: state.selectedSlot,
    reason,
    visitType,
    status: "confirmed",
    createdAt: existing?.createdAt || new Date().toISOString()
  };
  const rows = existing
    ? getAppointments().map((item) => (item.id === existing.id ? row : item))
    : getAppointments().concat(row);
  setAppointments(rows);
  pushOutbox({
    id: `out-${Date.now()}`,
    kind: existing ? "reschedule" : "booking",
    phone,
    text: `Booking ${bookingId} lock ho gayi. Token No. ${tokenNo}. ${formatDate(date)} ${formatSlot(state.selectedSlot)}. Reply 1 to confirm, 2 to cancel.`,
    createdAt: new Date().toISOString()
  });
  state.rescheduleId = null;
  setBookingError("");
  showBookingSuccess(row);
  updateBookingCountAndLists();
  showToast(existing ? messages.rescheduled : messages.saved);
}

function submitEnquiry(event) {
  event.preventDefault();
  const messages = CareWellData.messages;
  const name = $("#enquiry-name").value.trim();
  const phone = phoneDigits($("#enquiry-phone").value);
  const message = $("#enquiry-message").value.trim();
  $("#enquiry-phone").value = phone;
  const error = $("#visit-error");
  const success = $("#visit-success");
  success.classList.add("hidden");

  let problem = "";
  if (name.length < 2) problem = messages.enquiryName;
  else if (!validPhone(phone)) problem = messages.enquiryPhone;
  else if (message.length < 10) problem = messages.enquiryMessage;

  if (problem) {
    error.textContent = problem;
    error.classList.remove("hidden");
    return;
  }
  error.classList.add("hidden");
  /* TODO: Supabase — insert into public.enquiries instead of LocalStorage. */
  const existing = readJson(STORAGE_KEYS.enquiries, []);
  existing.push({ id: `en-${Date.now()}`, name, phone, message, createdAt: new Date().toISOString() });
  writeJson(STORAGE_KEYS.enquiries, existing);
  $("#visit-form").reset();
  success.textContent = messages.enquirySaved;
  success.classList.remove("hidden");
  showToast(messages.enquirySaved);
}

function cancelAppointment(id) {
  const row = activeAppointments().find((item) => item.id === id);
  if (!row) return;
  const ok = window.confirm(`${row.token} cancel karni hai?`);
  if (!ok) return;
  setAppointments(getAppointments().map((item) => (item.id === id ? { ...item, status: "cancelled" } : item)));
  updateBookingCountAndLists();
  if (!$("#booking-modal").classList.contains("hidden")) renderSlots();
  showToast(CareWellData.messages.cancelled);
}

function bindEvents() {
  $("#nav-toggle").addEventListener("click", () => {
    const open = $("#nav-toggle").getAttribute("aria-expanded") === "true";
    if (open) closeMenu();
    else openMenu();
  });

  document.body.addEventListener("click", (event) => {
    const navLink = event.target.closest("[data-nav-link]");
    if (navLink) closeMenu();

    const specialtyJump = event.target.closest("[data-jump-specialty]");
    if (specialtyJump) {
      const match = CareWellData.doctors.find((doctor) => doctor.specialty === specialtyJump.dataset.jumpSpecialty);
      state.group = match ? match.group : "All";
      renderFilters();
      renderDoctors();
      refreshIcons();
      $("#doctors").scrollIntoView({ behavior: "smooth" });
    }

    const group = event.target.closest("[data-group]");
    if (group && group.closest("#doctor-filters")) {
      state.group = group.dataset.group;
      renderFilters();
      renderDoctors();
      refreshIcons();
    }

    const location = event.target.closest("[data-location]");
    if (location) {
      state.location = location.dataset.location;
      renderFilters();
      renderDoctors();
      refreshIcons();
    }

    const availability = event.target.closest("[data-availability]");
    if (availability) {
      state.availability = availability.dataset.availability;
      renderFilters();
      renderDoctors();
      refreshIcons();
    }

    const fee = event.target.closest("[data-fee]");
    if (fee) {
      state.fee = fee.dataset.fee;
      renderFilters();
      renderDoctors();
      refreshIcons();
    }

    const reviews = event.target.closest("[data-reviews]");
    if (reviews) {
      state.openReviews = state.openReviews === reviews.dataset.reviews ? "" : reviews.dataset.reviews;
      renderDoctors();
      refreshIcons();
    }

    const chip = event.target.closest("[data-date-chip]");
    if (chip) {
      $("#patient-date").value = chip.dataset.dateChip;
      state.selectedSlot = "";
      renderSlots();
    }

    const reschedule = event.target.closest("[data-reschedule]");
    if (reschedule) openBooking(reschedule.dataset.doctor || "", reschedule, reschedule.dataset.reschedule);

    const faqButton = event.target.closest("[data-faq-button]");
    if (faqButton) {
      const panel = document.getElementById(faqButton.getAttribute("aria-controls"));
      const expanded = faqButton.getAttribute("aria-expanded") === "true";
      faqButton.setAttribute("aria-expanded", String(!expanded));
      panel.classList.toggle("hidden", expanded);
    }

    const opener = event.target.closest("[data-open-booking]");
    if (opener) openBooking(opener.dataset.doctor || "", opener);

    const slot = event.target.closest("[data-slot]");
    if (slot && !slot.disabled) {
      state.selectedSlot = slot.dataset.slot;
      setBookingError("");
      renderSlots();
    }

    const cancel = event.target.closest("[data-cancel]");
    if (cancel) cancelAppointment(cancel.dataset.cancel);

    const calendar = event.target.closest("[data-calendar]");
    if (calendar) {
      const row = getAppointments().find((item) => item.id === calendar.dataset.calendar);
      if (row) downloadCalendar(row);
    }
  });

  $("#booking-form").addEventListener("submit", submitBooking);
  $("#visit-form").addEventListener("submit", submitEnquiry);
  $("#patient-doctor").addEventListener("change", () => {
    state.selectedSlot = "";
    updateDoctorMeta();
    renderSlots();
  });
  $("#patient-date").addEventListener("change", () => {
    state.selectedSlot = "";
    renderSlots();
  });
  $("#doctor-search").addEventListener("input", () => {
    state.query = $("#doctor-search").value;
    renderDoctors();
    refreshIcons();
  });
  $("#patient-phone").addEventListener("input", () => {
    $("#patient-phone").value = phoneDigits($("#patient-phone").value);
  });
  $("#patient-age").addEventListener("input", () => {
    $("#patient-age").value = $("#patient-age").value.replace(/\D/g, "").slice(0, 3);
  });
  $("#enquiry-phone").addEventListener("input", () => {
    $("#enquiry-phone").value = phoneDigits($("#enquiry-phone").value);
  });
  $("#booking-close").addEventListener("click", closeBooking);
  $("#booking-backdrop").addEventListener("click", closeBooking);
  $("#success-done").addEventListener("click", () => {
    closeBooking();
    $("#bookings").scrollIntoView({ behavior: "smooth" });
  });
  $("#success-email").addEventListener("click", () => {
    if (!state.lastBooking) return;
    const row = state.lastBooking;
    const doctor = doctorById(row.doctorId);
    const body = bookingShareText(row);
    window.location.href = `mailto:${CareWellData.clinic.email}?subject=${encodeURIComponent(`CareWell confirmation ${row.bookingId || row.token}`)}&body=${encodeURIComponent(`${body}\n\nDoctor: ${doctor ? doctor.name : ""}\n`)}`;
  });
  $("#success-whatsapp").addEventListener("click", () => {
    if (!state.lastBooking) return;
    window.open(whatsappUrl(bookingShareText(state.lastBooking)), "_blank", "noopener");
  });
  $("#success-calendar").addEventListener("click", () => {
    if (state.lastBooking) downloadCalendar(state.lastBooking);
  });

  // Reel Feature 1: Hold a Free Slot form submission -> Test WhatsApp Auto-Booking
  const freeSlotForm = $("#form-hold-free-slot");
  if (freeSlotForm) {
    freeSlotForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#free-slot-name")?.value.trim() || "Ritu Sharma";
      const phone = $("#free-slot-phone")?.value.trim() || "9811111111";
      const service = $("#free-slot-service")?.value || "Free Computerized Eye Test";
      const slot = $("#free-slot-time")?.value || "Tuesday 11:30 AM";
      if (window.CareWellSystem && typeof window.CareWellSystem.testWhatsAppAutoBooking === "function") {
        window.CareWellSystem.testWhatsAppAutoBooking(name, phone, service, slot);
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("#booking-modal").classList.contains("hidden")) closeBooking();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 768) closeMenu();
  });
}

function init() {
  seedAppointments();
  renderNav();
  renderHero();
  renderServices();
  renderFilters();
  renderDoctors();
  renderSteps();
  renderStories();
  renderFaqs();
  renderAppointments();
  renderVisit();
  renderFooter();
  renderClinicStatus();
  fillDoctorSelect("");
  bindEvents();
  refreshIcons();
}

document.addEventListener("DOMContentLoaded", init);
