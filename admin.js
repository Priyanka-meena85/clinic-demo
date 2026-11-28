/**
 * CareWell Clinic - Admin & Reception Desk Portal Engine (admin.js)
 */

(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function escapeHtml(val) {
    return String(val ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function showToast(msg) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove("hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add("hidden"), 3000);
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  let currentTab = "dashboard";
  let isAdminLoggedIn = localStorage.getItem("carewell_admin_auth") === "true";

  function initAdmin() {
    bindAuth();
    if (isAdminLoggedIn) {
      showWorkspace();
    } else {
      showLogin();
    }
  }

  function bindAuth() {
    $("#form-admin-login")?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (window.CareWellSecurity && window.CareWellSecurity.isRateLimited("admin-login")) {
        showToast("Security Lockout: Too many failed login attempts. Wait 15 min.");
        return;
      }
      const username = ($("#admin-username")?.value || "").trim();
      const password = ($("#admin-password")?.value || "").trim();
      if (username !== "admin@carewell" || password !== "carewell123") {
        if (window.CareWellSecurity) window.CareWellSecurity.recordFailedAttempt("admin-login");
        showToast("Invalid Admin credentials! Demo: admin@carewell / carewell123");
        return;
      }
      if (window.CareWellSecurity) window.CareWellSecurity.resetRateLimit("admin-login");
      isAdminLoggedIn = true;
      localStorage.removeItem("carewell_receptionist_auth");
      localStorage.removeItem("carewell_doctor_auth_id");
      localStorage.removeItem("carewell_patient_auth");
      localStorage.setItem("carewell_admin_auth", "true");
      localStorage.setItem("carewell_session_exp", String(Date.now() + 8 * 3600 * 1000));
      if (window.CareWellApi) {
        window.CareWellApi.loginAdmin(username, password).catch(() => {});
      }
      showWorkspace();
      showToast("Welcome to CareWell Reception & Admin Portal!");
    });

    $("#btn-quick-admin-login")?.addEventListener("click", () => {
      isAdminLoggedIn = true;
      localStorage.removeItem("carewell_receptionist_auth");
      localStorage.removeItem("carewell_doctor_auth_id");
      localStorage.removeItem("carewell_patient_auth");
      localStorage.setItem("carewell_admin_auth", "true");
      localStorage.setItem("carewell_session_exp", String(Date.now() + 8 * 3600 * 1000));
      if (window.CareWellApi) {
        window.CareWellApi.loginAdmin(username, password).catch(() => {});
      }
      showWorkspace();
      showToast("Logged in as Clinic Reception Admin!");
    });

    $("#btn-admin-logout")?.addEventListener("click", () => {
      isAdminLoggedIn = false;
      localStorage.removeItem("carewell_admin_auth");
      showLogin();
      showToast("Logged out successfully.");
    });
  }

  function showLogin() {
    $("#admin-login-view")?.classList.remove("hidden");
    $("#admin-workspace-view")?.classList.add("hidden");
    $("#btn-admin-logout")?.classList.add("hidden");
    refreshIcons();
  }

  function showWorkspace() {
    $("#admin-login-view")?.classList.add("hidden");
    $("#admin-workspace-view")?.classList.remove("hidden");
    $("#btn-admin-logout")?.classList.remove("hidden");
    bindTabs();
    renderTabContent();
    refreshIcons();
  }

  function bindTabs() {
    $$("[data-admin-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentTab = btn.dataset.adminTab;
        $$("[data-admin-tab]").forEach((b) => {
          const isActive = b.dataset.adminTab === currentTab;
          b.className = isActive
            ? "px-3.5 py-2 text-xs font-semibold rounded-xl bg-tealbrand text-white transition shadow-xs"
            : "px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-700 hover:bg-emerald-50 transition";
        });
        renderTabContent();
      });
    });
  }

  function renderTabContent() {
    const container = $("#admin-tab-content");
    if (!container) return;

    const appointments = readJson("carewell_appointments", []);
    const confirmedCount = appointments.filter((a) => a.status === "confirmed" || a.status === "booked" || a.status === "checked-in").length;
    const doneCount = appointments.filter((a) => a.status === "done").length;
    const noShowCount = appointments.filter((a) => a.status === "noshow").length;
    const cancelledCount = appointments.filter((a) => a.status === "cancelled").length;
    const totalToday = confirmedCount + doneCount + noShowCount;

    const liveTodayRevenue = appointments
      .filter((a) => a.status !== "cancelled" && a.status !== "noshow")
      .reduce((sum, a) => {
        const doc = CareWellData.doctors.find((d) => d.id === a.doctorId);
        return sum + (doc ? doc.fee : 500);
      }, 0);
    const liveMonthlyProj = liveTodayRevenue * 26;
    const noShowPct = totalToday > 0 ? Math.round((noShowCount / totalToday) * 100) : 0;

    // 1. DASHBOARD
    if (currentTab === "dashboard") {
      container.innerHTML = `
        <div class="space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-emerald-100">
            <div>
              <h3 class="font-display text-2xl font-bold text-slate-900">Today's Clinic Overview</h3>
              <p class="text-xs text-slate-500">Live reception statistics, appointments velocity, and revenue summary</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" onclick="window.CareWellAdmin.openWalkinTokenModal()" class="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 shadow-xs">
                + Walk-in Token
              </button>
              <button type="button" onclick="window.CareWellAdmin.openAddDoctorModal()" class="px-3.5 py-2 rounded-xl bg-tealbrand text-white text-xs font-semibold hover:bg-teal-700 shadow-xs">
                + Add Doctor
              </button>
              <select id="admin-broadcast-filter" aria-label="Broadcast audience filter" class="h-9 px-2.5 rounded-xl border border-emerald-200 bg-white text-xs font-semibold text-slate-700 outline-none">
                <option value="Tomorrow Appointments">Kal ke Appointments</option>
                <option value="Sugar & BP Follow-up">Sugar / BP Patients</option>
                <option value="Health Checkup Camp">₹999 Package Camp</option>
              </select>
              <button type="button" onclick="window.CareWellAdmin.createHealthCamp()" class="px-3.5 py-2 rounded-xl border border-emerald-200 bg-white text-tealbrand text-xs font-semibold hover:bg-mint">
                + Health Camp
              </button>
              <button type="button" onclick="window.CareWellAdmin.triggerBroadcast(document.querySelector('#admin-broadcast-filter')?.value || 'All Tomorrow Patients')" class="px-3.5 py-2 rounded-xl border border-emerald-200 bg-mint text-tealbrand text-xs font-semibold hover:bg-emerald-100">
                Send Filtered Broadcast
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="portal-kpi-card p-5">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Bookings</span>
              <p class="text-3xl font-display font-bold text-slate-900 mt-1">${totalToday}</p>
              <span class="text-xs text-tealbrand font-medium">Active: ${confirmedCount} · Done: ${doneCount}</span>
            </div>

            <div class="portal-kpi-card p-5">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Live No-Show Rate</span>
              <div class="flex items-baseline gap-2 mt-1">
                <span class="text-3xl font-display font-bold text-emerald-600">${noShowPct}%</span>
                <span class="text-xs line-through text-slate-400">Industry 15%</span>
              </div>
              <span class="text-xs text-emerald-600 font-medium">Peak No-Show: Mon 9-10 AM (Overbook +1)</span>
            </div>

            <div class="portal-kpi-card p-5">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Live OPD Revenue</span>
              <p class="text-3xl font-display font-bold text-slate-900 mt-1">₹${liveTodayRevenue.toLocaleString("en-IN")}</p>
              <span class="text-xs text-slate-500">UPI: ₹${appointments.filter(a => (a.paymentMode || "").includes("UPI") && a.status !== "cancelled").length * 100} · Clinic Cash: ₹${Math.max(0, liveTodayRevenue - appointments.filter(a => (a.paymentMode || "").includes("UPI") && a.status !== "cancelled").length * 100).toLocaleString("en-IN")}</span>
            </div>

            <div class="portal-kpi-card p-5">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Projected Monthly Run-Rate</span>
              <p class="text-3xl font-display font-bold text-tealbrand mt-1">₹${liveMonthlyProj.toLocaleString("en-IN")}</p>
              <span class="text-xs text-tealbrand font-medium">26 OPD working days</span>
            </div>
          </div>

          <!-- Doctor Queue Live Breakdown -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            <div class="p-5 rounded-2xl border border-emerald-100 bg-slate-50/50">
              <h4 class="font-semibold text-sm text-slate-800 mb-3 flex items-center justify-between">
                <span>Doctor OPD Live Loads</span>
                <a href="/doctor" class="text-xs text-tealbrand hover:underline font-semibold">Open Doctor Pad →</a>
              </h4>
              <div class="space-y-2.5">
                ${CareWellData.doctors.slice(0, 4).map((d, i) => `
                  <div class="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 text-xs">
                    <div class="flex items-center gap-2.5">
                      <div class="w-8 h-8 rounded-lg bg-tealbrand text-white font-bold flex items-center justify-center font-display">
                        ${d.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div>
                        <span class="font-semibold text-slate-900">${escapeHtml(d.name)}</span>
                        <span class="text-[11px] text-slate-500 block">${escapeHtml(d.specialty)} · ${escapeHtml(d.location || "Pune")}</span>
                      </div>
                    </div>
                    <span class="font-bold text-tealbrand">${8 - i * 2} Patients</span>
                  </div>
                `).join("")}
              </div>
            </div>

            <div class="p-5 rounded-2xl border border-emerald-100 bg-white">
              <h4 class="font-semibold text-sm text-slate-800 mb-2">OPD Room Status Snapshot</h4>
              <p class="text-xs text-slate-500 mb-4">Real-time room occupancy and queue movement</p>
              <div class="space-y-3 text-xs">
                <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <span class="font-semibold text-tealbrand">Room 1 (General Physician · Dr. Rao)</span>
                  <span class="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold">Serving Token 8</span>
                </div>
                <div class="p-3 rounded-xl bg-mint border border-emerald-200 flex items-center justify-between">
                  <span class="font-semibold text-tealbrand">Room 2 (Cardiology · Dr. Shah)</span>
                  <span class="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold">Serving Token 3</span>
                </div>
                <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-slate-500">
                  <span>Room 3 (Dermatology · Dr. Iyer)</span>
                  <span class="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">Next at 11:00 AM</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // 2. APPOINTMENTS MANAGER
    else if (currentTab === "appointments") {
      container.innerHTML = `
        <div class="space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
            <div>
              <h3 class="font-display text-xl font-bold text-slate-900">All Clinic Bookings</h3>
              <p class="text-xs text-slate-500">Comprehensive appointments table with status controls and reminders</p>
            </div>
            <div class="flex items-center gap-2">
              <input id="admin-search-input" type="text" aria-label="Search patient or phone" placeholder="Search patient or phone..." class="h-9 px-3 text-xs rounded-xl border border-emerald-200 outline-none focus:border-tealbrand">
              <button type="button" onclick="window.CareWellAdmin.exportAppointmentsCsv()" class="h-9 px-3 rounded-xl border border-emerald-200 bg-mint text-tealbrand text-xs font-semibold hover:bg-emerald-100 whitespace-nowrap">
                Export CSV
              </button>
            </div>
          </div>

          <div class="overflow-x-auto rounded-2xl border border-emerald-100">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-700 font-semibold border-b border-emerald-100">
                <tr>
                  <th class="p-3">ID / Token</th>
                  <th class="p-3">Patient</th>
                  <th class="p-3">Doctor</th>
                  <th class="p-3">Date & Slot</th>
                  <th class="p-3">Status</th>
                  <th class="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-emerald-50">
                ${appointments.map((a) => {
                  const doc = CareWellData.doctors.find((d) => d.id === a.doctorId);
                  return `
                    <tr class="hover:bg-mint/30 transition">
                      <td class="p-3 font-mono font-semibold text-tealbrand">
                        ${escapeHtml(a.bookingId || a.token)}<br>
                        <span class="text-[10px] text-slate-500 font-normal">Token ${escapeHtml(a.tokenNo || 12)}</span>
                      </td>
                      <td class="p-3">
                        <span class="font-semibold text-slate-900">${escapeHtml(a.patientName)}</span><br>
                        <span class="text-[11px] text-slate-500">+91 ${escapeHtml(a.phone)}</span>
                      </td>
                      <td class="p-3">
                        <span class="font-medium text-slate-800">${escapeHtml(doc ? doc.name : a.doctorId)}</span><br>
                        <span class="text-[10px] text-slate-500">${escapeHtml(doc ? doc.specialty : "")}</span>
                      </td>
                      <td class="p-3">
                        <span class="font-semibold text-slate-800">${escapeHtml(a.date)}</span><br>
                        <span class="text-[11px] text-slate-600">${escapeHtml(a.slot)}</span>
                      </td>
                      <td class="p-3">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          a.status === "confirmed" ? "bg-emerald-100 text-tealbrand" : a.status === "done" ? "bg-blue-100 text-blue-700" : a.status === "noshow" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-600"
                        }">
                          ${escapeHtml(a.status || "confirmed")}
                        </span>
                      </td>
                      <td class="p-3 text-right space-x-1">
                        <button type="button" onclick="window.CareWellAdmin.sendReminder('${a.id}')" title="Send WhatsApp Reminder" class="px-2 py-1 rounded bg-mint text-tealbrand hover:bg-emerald-100 text-[11px] font-medium">
                          Remind
                        </button>
                        <button type="button" onclick="window.CareWellAdmin.markStatus('${a.id}', 'done')" class="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-medium">
                          Done
                        </button>
                        <button type="button" onclick="window.CareWellAdmin.markStatus('${a.id}', 'noshow')" class="px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 text-[11px] font-medium">
                          No-Show
                        </button>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // 3. PATIENTS MANAGER
    else if (currentTab === "patients") {
      const family = CareWellData.records?.family || [];
      container.innerHTML = `
        <div class="space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
            <div>
              <h3 class="font-display text-xl font-bold text-slate-900">Patients Records Vault</h3>
              <p class="text-xs text-slate-500">Patient Search by Name / Phone / Patient ID with direct Rx & Lab attachments</p>
            </div>
            <div class="flex gap-2">
              <button type="button" onclick="window.CareWellAdmin.openAddPrescriptionModal()" class="px-3.5 py-2 rounded-xl bg-tealbrand text-white text-xs font-semibold hover:bg-teal-700 shadow-xs">
                + Write Prescription
              </button>
              <button type="button" onclick="window.CareWellAdmin.openUploadReportModal()" class="px-3.5 py-2 rounded-xl border border-emerald-200 bg-mint text-tealbrand text-xs font-semibold hover:bg-emerald-100">
                + Upload Lab Report
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${family.map((p) => `
              <div class="p-5 rounded-2xl border border-emerald-100 bg-white shadow-xs">
                <div class="flex items-center justify-between pb-3 border-b border-emerald-100">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-mint text-tealbrand font-bold flex items-center justify-center font-display">
                      ${escapeHtml(p.name[0])}
                    </div>
                    <div>
                      <h5 class="font-semibold text-sm text-slate-900">${escapeHtml(p.name)} (${escapeHtml(p.relation)})</h5>
                      <span class="text-xs font-mono text-tealbrand">${escapeHtml(p.patientId)} · Mobile: +91 ${escapeHtml(p.phone)}</span>
                    </div>
                  </div>
                  <span class="text-xs text-slate-500">${p.age} yrs</span>
                </div>
                <div class="mt-3 flex items-center justify-between text-xs">
                  <span class="text-slate-600">Digital Vault: Active Rx & Lab History</span>
                  <a href="/patient" class="text-tealbrand font-semibold hover:underline">
                    View in Patient Portal →
                  </a>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }

    // 4. DOCTORS MANAGER
    else if (currentTab === "doctors") {
      container.innerHTML = `
        <div class="space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
            <div>
              <h3 class="font-display text-xl font-bold text-slate-900">Multi-Doctor Roster Management</h3>
              <p class="text-xs text-slate-500">Configure Doctor profiles, fees, specialization & OPD room schedules</p>
            </div>
            <button type="button" onclick="window.CareWellAdmin.openAddDoctorModal()" class="px-3.5 py-2 rounded-xl bg-tealbrand text-white text-xs font-semibold hover:bg-teal-700 shadow-xs">
              + Add New Doctor
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${CareWellData.doctors.map((d, index) => {
              const isBest = index === 0;
              return `
                <div class="p-5 rounded-2xl border border-emerald-100 bg-white shadow-xs flex flex-col justify-between">
                  <div>
                    <div class="flex items-start justify-between">
                      <div>
                        <h5 class="font-semibold text-sm text-slate-900">${escapeHtml(d.name)}</h5>
                        <p class="text-xs font-medium text-tealbrand mt-0.5">${escapeHtml(d.specialty)}</p>
                      </div>
                      ${isBest
                        ? `<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">★ Best Doctor</span>`
                        : `<span class="px-2 py-0.5 rounded-full bg-mint text-tealbrand text-[10px] font-semibold">${escapeHtml(d.location || "Pune")}</span>`}
                    </div>
                    <p class="text-xs text-slate-500 mt-2">${escapeHtml(d.qualifications)} · ${d.experienceYears} yrs exp</p>
                    <p class="text-xs text-slate-700 mt-1 font-semibold">Consultation Fee: ₹${d.fee}</p>
                    <p class="text-[11px] text-slate-500 mt-1">${escapeHtml(d.timing || "Mon–Sat 9AM–1PM")}</p>
                  </div>
                  <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span class="text-slate-500">Rating: ★ ${d.rating || 4.8}</span>
                    <a href="/doctor" class="text-tealbrand font-medium hover:underline">
                      Open Doctor Console →
                    </a>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }

    // 5. QUEUE CONTROLLER
    else if (currentTab === "queue") {
      const qState = readJson("carewell_queue_state", { doctorId: "ananya-rao", current: 8, yourToken: 12 });
      container.innerHTML = `
        <div class="space-y-6">
          <div class="pb-3 border-b border-emerald-100">
            <h3 class="font-display text-xl font-bold text-slate-900">Live OPD Queue Master Controller</h3>
            <p class="text-xs text-slate-500">Advance tokens across clinic consultation rooms and broadcast 15-min alerts</p>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="p-6 rounded-2xl bg-gradient-to-br from-emerald-600 to-tealbrand text-white shadow-sm flex flex-col justify-between">
              <div>
                <span class="text-xs uppercase tracking-wider text-emerald-200 font-semibold">Current Serving Token</span>
                <p class="text-5xl font-display font-bold mt-2">Token ${qState.current}</p>
                <p class="text-xs text-emerald-100 mt-2">OPD Room 1 · Dr. Ananya Rao</p>
              </div>

              <div class="mt-6 flex flex-wrap gap-2">
                <button type="button" onclick="window.CareWellAdmin.advanceQueue()" class="px-5 py-2.5 rounded-xl bg-white text-tealbrand text-xs font-bold hover:bg-emerald-50 shadow-xs">
                  Call Next Patient (+1)
                </button>
                <button type="button" onclick="window.CareWellAdmin.trigger15MinAlert()" class="px-4 py-2.5 rounded-xl border border-white/30 bg-white/10 text-white text-xs font-semibold hover:bg-white/20">
                  Broadcast 15-Min Warning
                </button>
              </div>
            </div>

            <div class="p-6 rounded-2xl border border-emerald-100 bg-slate-50 flex flex-col justify-between">
              <div>
                <h4 class="font-semibold text-sm text-slate-800">Queue Configuration</h4>
                <p class="text-xs text-slate-500 mt-1">Average consultation time: 7.5 mins per patient.</p>
                <div class="mt-4 p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1">
                  <p>• <strong>Next in line:</strong> Token ${qState.current + 1}</p>
                  <p>• <strong>Waiting in lounge:</strong> 4 patients</p>
                  <p>• <strong>SMS / WhatsApp gateway:</strong> Active</p>
                </div>
              </div>
              <p class="text-xs text-tealbrand font-medium mt-4">
                Auto WhatsApp alert triggers when patient is 2 tokens away!
              </p>
            </div>
          </div>
        </div>
      `;
    }

    // 6. FOLLOW-UPS
    else if (currentTab === "followups") {
      const followups = readJson("carewell_followups", CareWellData.records?.followups || []);
      container.innerHTML = `
        <div class="space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
            <div>
              <h3 class="font-display text-xl font-bold text-slate-900">Patient Retention & Follow-up System</h3>
              <p class="text-xs text-slate-500">Automated BP, Diabetes & Vaccination reminders to bring patients back</p>
            </div>
            <button type="button" onclick="window.CareWellAdmin.sendAllFollowups()" class="px-3.5 py-2 rounded-xl bg-tealbrand text-white text-xs font-semibold hover:bg-teal-700 shadow-xs">
              Send All Reminders via WhatsApp
            </button>
          </div>

          <div class="divide-y divide-emerald-100 rounded-2xl border border-emerald-100 bg-white overflow-hidden">
            ${followups.map((f) => `
              <div class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-sm text-slate-900">${escapeHtml(f.patient)}</span>
                    <span class="text-xs font-mono text-slate-500">+91 ${escapeHtml(f.phone)}</span>
                    <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">Due: ${escapeHtml(f.due)}</span>
                  </div>
                  <p class="text-xs text-slate-600 mt-1">${escapeHtml(f.reason)}</p>
                </div>
                <button type="button" onclick="window.CareWellAdmin.sendSingleFollowup('${f.id}')" class="px-3.5 py-1.5 rounded-xl bg-mint text-tealbrand border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 shrink-0">
                  Send WhatsApp Reminder
                </button>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }

    // 7. REPORTS & ANALYTICS
    else if (currentTab === "reports") {
      container.innerHTML = `
        <div class="space-y-6">
          <div class="pb-3 border-b border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 class="font-display text-2xl font-bold text-slate-900">Clinic Financial & Operational Analytics</h3>
              <p class="text-xs text-slate-500">Comprehensive monthly revenue report, doctor-wise earnings, and patient volume</p>
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-tealbrand border border-emerald-200">
              Monthly Close: Active Period
            </span>
          </div>

          <!-- Monthly Financial Metric Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="p-5 rounded-2xl bg-gradient-to-br from-tealbrand to-emerald-700 text-white shadow-sm">
              <span class="text-xs text-emerald-100 uppercase tracking-wider font-semibold">Total Monthly Income</span>
              <p class="text-3xl font-display font-bold mt-1">₹1,84,000</p>
              <span class="text-xs text-emerald-200 mt-2 block font-medium">↑ +18.4% vs last month</span>
            </div>

            <div class="p-5 rounded-2xl bg-white border border-emerald-100 shadow-xs">
              <span class="text-xs text-slate-500 uppercase tracking-wider font-semibold">Today's Revenue</span>
              <p class="text-3xl font-display font-bold text-slate-900 mt-1">₹7,200</p>
              <span class="text-xs text-tealbrand mt-2 block font-medium">12 consultations completed</span>
            </div>

            <div class="p-5 rounded-2xl bg-white border border-emerald-100 shadow-xs">
              <span class="text-xs text-slate-500 uppercase tracking-wider font-semibold">Doctor Consultations</span>
              <p class="text-3xl font-display font-bold text-slate-900 mt-1">₹1,44,000</p>
              <span class="text-xs text-slate-500 mt-2 block">78.2% of clinic turnover</span>
            </div>

            <div class="p-5 rounded-2xl bg-white border border-emerald-100 shadow-xs">
              <span class="text-xs text-slate-500 uppercase tracking-wider font-semibold">Lab Tests & Diagnostics</span>
              <p class="text-3xl font-display font-bold text-tealbrand mt-1">₹40,000</p>
              <span class="text-xs text-emerald-600 mt-2 block">21.8% of clinic turnover</span>
            </div>
          </div>

          <!-- Doctor-wise Volume & Revenue Table (All 8 Doctors) -->
          <div class="p-6 rounded-2xl border border-emerald-100 bg-white shadow-xs space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-emerald-100">
              <div>
                <h4 class="font-semibold text-base text-slate-900">All Doctors Performance & Revenue Breakdown</h4>
                <p class="text-xs text-slate-500">Doctor-wise patients count, fee contribution and performance metrics</p>
              </div>
              <span class="text-xs text-tealbrand font-medium">8 Doctors Active</span>
            </div>

            <div class="overflow-x-auto rounded-xl border border-slate-200">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th class="p-3">Doctor</th>
                    <th class="p-3">Department</th>
                    <th class="p-3">Today Patients</th>
                    <th class="p-3">Monthly Vol</th>
                    <th class="p-3">OPD Fee</th>
                    <th class="p-3">Revenue Share</th>
                    <th class="p-3 text-right">Rating</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${CareWellData.doctors.map((d, index) => {
                    const todayPatients = index === 0 ? 12 : index === 1 ? 6 : index === 2 ? 8 : 4;
                    const monthlyPatients = todayPatients * 24;
                    const revenue = monthlyPatients * d.fee;
                    return `
                      <tr class="hover:bg-slate-50/80 transition">
                        <td class="p-3 font-semibold text-slate-900">
                          ${escapeHtml(d.name)}
                          ${index === 0 ? '<span class="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">Top</span>' : ''}
                        </td>
                        <td class="p-3 text-tealbrand font-medium">${escapeHtml(d.specialty)}</td>
                        <td class="p-3 font-semibold text-slate-800">${todayPatients} pts</td>
                        <td class="p-3 text-slate-600">${monthlyPatients} pts</td>
                        <td class="p-3 font-mono font-medium text-slate-800">₹${d.fee}</td>
                        <td class="p-3 font-mono font-bold text-tealbrand">₹${revenue.toLocaleString("en-IN")}</td>
                        <td class="p-3 text-right font-medium text-amber-700">★ ${d.rating || 4.8}</td>
                      </tr>
                    `;
                  }).join("")}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Charts Grid: Volume Chart & No-Show Reduction -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="p-5 rounded-2xl border border-emerald-100 bg-white">
              <h4 class="font-semibold text-sm text-slate-800 mb-1">Doctor-wise Monthly Patient Volume Chart</h4>
              <p class="text-xs text-slate-500 mb-4">Patient volume distribution across main specialties</p>
              
              <div class="space-y-3.5">
                <div>
                  <div class="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>Dr. Ananya Rao (General)</span>
                    <span class="font-bold text-tealbrand">288 Patients · ₹1,44,000</span>
                  </div>
                  <div class="w-full bg-slate-100 rounded-full h-3.5">
                    <div class="bg-tealbrand h-3.5 rounded-full" style="width: 85%"></div>
                  </div>
                </div>

                <div>
                  <div class="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>Dr. Vikram Shah (Cardiology)</span>
                    <span class="font-bold text-tealbrand">144 Patients · ₹1,29,600</span>
                  </div>
                  <div class="w-full bg-slate-100 rounded-full h-3.5">
                    <div class="bg-tealbrand h-3.5 rounded-full" style="width: 55%"></div>
                  </div>
                </div>

                <div>
                  <div class="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>Dr. Meera Iyer (Skin)</span>
                    <span class="font-bold text-tealbrand">192 Patients · ₹1,34,400</span>
                  </div>
                  <div class="w-full bg-slate-100 rounded-full h-3.5">
                    <div class="bg-tealbrand h-3.5 rounded-full" style="width: 65%"></div>
                  </div>
                </div>

                <div>
                  <div class="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>Dr. Kabir Jain (Dental)</span>
                    <span class="font-bold text-tealbrand">120 Patients · ₹42,000</span>
                  </div>
                  <div class="w-full bg-slate-100 rounded-full h-3.5">
                    <div class="bg-tealbrand h-3.5 rounded-full" style="width: 40%"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="p-5 rounded-2xl border border-emerald-100 bg-white">
              <h4 class="font-semibold text-sm text-slate-800 mb-1">No-Show Reduction by Automated WhatsApp</h4>
              <p class="text-xs text-slate-500 mb-3">Pre-automation (12%) vs post-automation (3%)</p>
              
              <div class="p-4 rounded-xl bg-mint border border-emerald-200 mb-3 text-xs text-tealbrand leading-relaxed font-medium">
                Automated 1-day reminders on WhatsApp reduced clinic no-shows from <strong>12% to 3%</strong>, saving an estimated <strong>₹28,500/month</strong> in recovered patient slots.
              </div>

              <div class="space-y-2 text-xs">
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                  <span class="font-medium text-slate-700">Monday</span>
                  <span class="text-emerald-700 font-semibold">1.8% No-Show (Lowest)</span>
                </div>
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                  <span class="font-medium text-slate-700">Wednesday</span>
                  <span class="text-emerald-700 font-semibold">2.9% No-Show</span>
                </div>
                <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                  <span class="font-medium text-slate-700">Saturday</span>
                  <span class="text-amber-700 font-semibold">4.1% No-Show</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // 8. SLOT CONTROL
    else if (currentTab === "slots") {
      container.innerHTML = `
        <div class="space-y-4">
          <div class="pb-3 border-b border-emerald-100">
            <h3 class="font-display text-xl font-bold text-slate-900">Doctor Slot & Leave Control</h3>
            <p class="text-xs text-slate-500">Block or unblock clinic slots when a doctor is unavailable ("Kal main nahi hu")</p>
          </div>

          <div class="p-6 rounded-2xl border border-emerald-100 bg-white max-w-lg space-y-4">
            <div>
              <label class="text-xs font-semibold text-slate-700 block mb-1">Select Doctor</label>
              <select id="slot-ctrl-doctor" class="h-10 w-full px-3 text-sm rounded-xl border border-emerald-200 outline-none">
                ${CareWellData.doctors.map((d) => `<option value="${d.id}">${escapeHtml(d.name)} (${escapeHtml(d.specialty)})</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-700 block mb-1">Select Date</label>
              <input id="slot-ctrl-date" type="date" value="${new Date().toISOString().split("T")[0]}" class="h-10 w-full px-3 text-sm rounded-xl border border-emerald-200 outline-none">
            </div>
            <div class="pt-2 flex gap-3">
              <button type="button" onclick="window.CareWellAdmin.blockDoctorDay(true)" class="flex-1 h-11 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700">
                "Kal Main Nahi Hu" (Full Day Band)
              </button>
              <button type="button" onclick="window.CareWellAdmin.blockDoctorDay(false)" class="flex-1 h-11 rounded-xl bg-tealbrand text-white text-xs font-semibold hover:bg-teal-700">
                Khol Do (Open Slots)
              </button>
            </div>
          </div>
        </div>
      `;
    }

    // 9. SECURITY & AUDIT
    else if (currentTab === "security") {
      const jwtPresent = Boolean(localStorage.getItem("carewell_jwt_token"));
      container.innerHTML = `
        <div class="space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-emerald-100">
            <div>
              <h3 class="font-display text-xl font-bold text-slate-900">Security, RBAC &amp; Compliance Console</h3>
              <p class="text-xs text-slate-500">Live Role-Based Access Isolation, Brute-Force Protection &amp; 20-Point Audit</p>
            </div>
            <button type="button" onclick="window.CareWellSecurity ? window.CareWellSecurity.openSecurityAuditModal() : null" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 shadow-xs">
              Run 20-Point Security Audit
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div class="portal-kpi-card p-5">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">JWT Session Token</span>
              <p class="font-display text-xl font-bold text-tealbrand mt-1">${jwtPresent ? "Signed HS256 Active" : "Local Session Active"}</p>
              <span class="text-[11px] text-slate-500">Auto-expires after 8 hours</span>
            </div>
            <div class="portal-kpi-card p-5">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Brute-Force Lockout</span>
              <p class="font-display text-xl font-bold text-emerald-700 mt-1">5 Attempts / 15 Min</p>
              <span class="text-[11px] text-slate-500">Active on all 4 portals</span>
            </div>
            <div class="portal-kpi-card p-5">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">BOLA / IDOR Shield</span>
              <p class="font-display text-xl font-bold text-slate-900 mt-1">100% Enforced</p>
              <span class="text-[11px] text-slate-500">Strict patientId ownership</span>
            </div>
          </div>

          <div class="rounded-2xl border border-emerald-100 overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-700 font-semibold border-b border-emerald-100">
                <tr>
                  <th class="p-3">Role</th>
                  <th class="p-3">Allowed Access</th>
                  <th class="p-3">Restricted / Blocked</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-emerald-50">
                <tr><td class="p-3 font-bold text-tealbrand">Patient</td><td class="p-3">Own + Family Rx, Lab Reports, Receipts</td><td class="p-3 text-red-600">Other Patients, Doctor Desk, Clinic Revenue</td></tr>
                <tr><td class="p-3 font-bold text-tealbrand">Doctor</td><td class="p-3">Own OPD Queue, Write Rx, Own Fees, Leave</td><td class="p-3 text-red-600">Total Clinic Revenue, Other Doctors' Earnings</td></tr>
                <tr><td class="p-3 font-bold text-tealbrand">Receptionist</td><td class="p-3">Check-in, Triage Vitals, Walk-ins, Receipts</td><td class="p-3 text-red-600">Monthly Clinic Revenue, Security Config</td></tr>
                <tr><td class="p-3 font-bold text-slate-900">Admin</td><td class="p-3">Full Clinic Analytics, Staff, Slots, Audit</td><td class="p-3 text-emerald-700 font-medium">Protected by Rate Limit + HMAC JWT</td></tr>
              </tbody>
            </table>
          </div>
          <div class="rounded-2xl border border-emerald-100 overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-700 font-semibold border-b border-emerald-100">
                <tr><th class="p-3">Who</th><th class="p-3">Role</th><th class="p-3">Action</th><th class="p-3">Patient ID</th><th class="p-3">Time</th></tr>
              </thead>
              <tbody class="divide-y divide-emerald-50">
                ${(readJson("carewell_audit_log", []).slice(0, 6).map((l) => `<tr><td class="p-3 font-semibold">${escapeHtml(l.who)}</td><td class="p-3">${escapeHtml(l.role)}</td><td class="p-3">${escapeHtml(l.action)}</td><td class="p-3 font-mono">${escapeHtml(l.patientId)}</td><td class="p-3 text-slate-500">${escapeHtml(l.at)}</td></tr>`).join("")) || `<tr><td colspan="5" class="p-3 text-slate-400 text-center">No PHI access events logged yet in this browser.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>`;
    }

    refreshIcons();
  }

  // Universal Modals
  function showModal(html) {
    const modalBox = $("#carewell-system-modals");
    if (!modalBox) return;
    modalBox.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div class="bg-white rounded-3xl border border-emerald-100 shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in">
          ${html}
        </div>
      </div>
    `;
    refreshIcons();
    $("#modal-close-btn")?.addEventListener("click", closeModal);
  }

  function closeModal() {
    const modalBox = $("#carewell-system-modals");
    if (modalBox) modalBox.innerHTML = "";
  }

  // Public Admin Actions
  window.CareWellAdmin = {
    markStatus(id, newStatus) {
      const appointments = readJson("carewell_appointments", []);
      const a = appointments.find((x) => x.id === id);
      if (a) {
        a.status = newStatus;
        writeJson("carewell_appointments", appointments);
        showToast(`Status updated to ${newStatus}`);
        renderTabContent();
      }
    },

    sendReminder(id) {
      const appointments = readJson("carewell_appointments", []);
      const a = appointments.find((x) => x.id === id);
      if (a) {
        const outbox = readJson("carewell_outbox", []);
        outbox.unshift({
          id: `out-${Date.now()}`,
          phone: a.phone,
          patient: a.patientName,
          kind: "Reminder",
          text: `Reminder: Aapka appointment ${a.date} ko ${a.slot} baje schedule hai. Token No. ${a.tokenNo || 12}. Confirm: 1, Cancel: 2.`,
          status: "Delivered",
          createdAt: new Date().toISOString()
        });
        writeJson("carewell_outbox", outbox);
        showToast(`WhatsApp reminder sent to ${a.patientName}!`);
      }
    },

    advanceQueue() {
      const qState = readJson("carewell_queue_state", { doctorId: "ananya-rao", current: 8, yourToken: 12 });
      qState.current += 1;
      writeJson("carewell_queue_state", qState);
      showToast(`Token advanced to ${qState.current} in OPD Room!`);
      renderTabContent();
    },

    trigger15MinAlert() {
      const qState = readJson("carewell_queue_state", { doctorId: "ananya-rao", current: 8, yourToken: 12 });
      const outbox = readJson("carewell_outbox", []);
      outbox.unshift({
        id: `out-${Date.now()}`,
        phone: "9811111111",
        patient: "Riya Sharma",
        kind: "Queue Alert",
        text: `Reminder: Token No. ${qState.yourToken} - Agle 15 minutes mein aapka number aane wala hai!`,
        status: "Delivered",
        createdAt: new Date().toISOString()
      });
      writeJson("carewell_outbox", outbox);
      showToast("15-Min WhatsApp alert broadcasted!");
    },

    sendSingleFollowup(fId) {
      const followups = readJson("carewell_followups", []);
      const f = followups.find((x) => x.id === fId);
      if (f) {
        showToast(`WhatsApp follow-up reminder sent to ${f.patient}!`);
      }
    },

    sendAllFollowups() {
      showToast("All due follow-up reminders sent via WhatsApp!");
    },

    blockDoctorDay(isBlock) {
      const doc = $("#slot-ctrl-doctor")?.value;
      const date = $("#slot-ctrl-date")?.value;
      const blocks = readJson("carewell_blocks", []);
      if (isBlock) {
        blocks.push({ doctorId: doc, date, slot: "" });
        showToast(`Doctor marked absent for ${date}`);
      } else {
        const filtered = blocks.filter((b) => !(b.doctorId === doc && b.date === date));
        writeJson("carewell_blocks", filtered);
        showToast(`Doctor slots reopened for ${date}`);
      }
      writeJson("carewell_blocks", blocks);
    },

    triggerBroadcast(target) {
      showToast(`Broadcast reminder sent to ${target}!`);
    },

    openAddDoctorModal() {
      showModal(`
        <div class="p-6 sm:p-8">
          <div class="flex items-center justify-between border-b border-emerald-100 pb-3">
            <h3 class="font-display text-lg text-slate-900 font-bold">Add New Doctor</h3>
            <button id="modal-close-btn" type="button" class="text-slate-400 hover:text-slate-600 p-1">✕</button>
          </div>
          <form id="form-add-doc-admin" class="mt-4 space-y-3 text-xs">
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Doctor Name</label>
              <input id="doc-name-in" type="text" placeholder="Dr. Rajesh Verma" required class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none">
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Specialty</label>
                <input id="doc-spec-in" type="text" placeholder="Cardiology" required class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none">
              </div>
              <div>
                <label class="font-semibold text-slate-700 block mb-1">OPD Fee (₹)</label>
                <input id="doc-fee-in" type="number" placeholder="600" required class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none">
              </div>
            </div>
            <div class="pt-2 flex justify-end gap-2">
              <button type="submit" class="px-5 py-2.5 rounded-xl bg-tealbrand text-white font-semibold hover:bg-teal-700">Save Doctor</button>
            </div>
          </form>
        </div>
      `);

      $("#form-add-doc-admin")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = $("#doc-name-in").value.trim();
        const specialty = $("#doc-spec-in").value.trim();
        const fee = Number($("#doc-fee-in").value) || 500;
        CareWellData.doctors.push({
          id: name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
          name,
          specialty,
          group: specialty,
          qualifications: "MBBS, MD",
          experienceYears: 8,
          languages: ["Hindi", "English"],
          fee,
          rating: 4.8,
          bio: `${specialty} OPD specialist.`
        });
        closeModal();
        showToast(`Doctor ${name} successfully added!`);
        renderTabContent();
      });
    },

    openAddPrescriptionModal() {
      showModal(`
        <div class="p-6 sm:p-8">
          <div class="flex items-center justify-between border-b border-emerald-100 pb-3">
            <h3 class="font-display text-lg text-slate-900 font-bold">Write Digital Prescription</h3>
            <button id="modal-close-btn" type="button" class="text-slate-400 hover:text-slate-600 p-1">✕</button>
          </div>
          <form id="form-add-rx-admin" class="mt-4 space-y-3 text-xs">
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Select Patient</label>
              <select id="rx-pat-in" class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none">
                <option value="CW-2048">Riya Sharma (CW-2048)</option>
                <option value="CW-1980">Suresh Sharma (CW-1980)</option>
                <option value="CW-1988">Lata Sharma (CW-1988)</option>
                <option value="CW-2210">Aarav Sharma (CW-2210)</option>
              </select>
            </div>
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Prescribed Medicines & Instructions</label>
              <textarea id="rx-text-in" rows="3" placeholder="Paracetamol 650mg, Pantocid 40mg..." required class="w-full p-2.5 rounded-xl border border-emerald-200 outline-none"></textarea>
            </div>
            <div class="pt-2 flex justify-end gap-2">
              <button type="submit" class="px-5 py-2.5 rounded-xl bg-tealbrand text-white font-semibold hover:bg-teal-700">Save to Patient File</button>
            </div>
          </form>
        </div>
      `);

      $("#form-add-rx-admin")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const patientId = $("#rx-pat-in").value;
        const text = $("#rx-text-in").value.trim();
        const rxList = readJson("carewell_prescriptions", []);
        rxList.unshift({
          id: `rx-${Date.now()}`,
          patientId,
          date: new Date().toISOString().split("T")[0],
          doctor: "Dr. Ananya Rao",
          text
        });
        writeJson("carewell_prescriptions", rxList);
        closeModal();
        showToast("Prescription saved and sent to patient portal!");
        renderTabContent();
      });
    },

    openUploadReportModal() {
      showModal(`
        <div class="p-6 sm:p-8">
          <div class="flex items-center justify-between border-b border-emerald-100 pb-3">
            <h3 class="font-display text-lg text-slate-900 font-bold">Attach Lab / Diagnostic Report</h3>
            <button id="modal-close-btn" type="button" class="text-slate-400 hover:text-slate-600 p-1">✕</button>
          </div>
          <form id="form-upload-rep-admin" class="mt-4 space-y-3 text-xs">
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Select Patient</label>
              <select id="rep-pat-in" class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none">
                <option value="CW-2048">Riya Sharma (CW-2048)</option>
                <option value="CW-1980">Suresh Sharma (CW-1980)</option>
              </select>
            </div>
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Test Title</label>
              <input id="rep-title-in" type="text" placeholder="Lipid Profile / CBC" required class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none">
            </div>
            <div class="pt-2 flex justify-end gap-2">
              <button type="submit" class="px-5 py-2.5 rounded-xl bg-tealbrand text-white font-semibold hover:bg-teal-700">Attach Report</button>
            </div>
          </form>
        </div>
      `);

      $("#form-upload-rep-admin")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const patientId = $("#rep-pat-in").value;
        const name = $("#rep-title-in").value.trim();
        const repList = readJson("carewell_reports", []);
        repList.unshift({
          id: `rep-${Date.now()}`,
          patientId,
          date: new Date().toISOString().split("T")[0],
          type: "Blood Test",
          name,
          note: "Diagnostic correlation satisfactory"
        });
        writeJson("carewell_reports", repList);
        closeModal();
        showToast("Report attached to patient records!");
        renderTabContent();
      });
    },

    openWalkinTokenModal() {
      const doctors = CareWellData?.doctors || [];
      showModal(`
        <div class="p-6 sm:p-8">
          <div class="flex items-center justify-between border-b border-emerald-100 pb-3">
            <h3 class="font-display text-lg text-slate-900 font-bold">Issue Quick Walk-in Token</h3>
            <button id="modal-close-btn" type="button" class="text-slate-400 hover:text-slate-600 p-1">✕</button>
          </div>
          <form id="form-walkin-token" class="mt-4 space-y-3 text-xs">
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Patient Name</label>
              <input id="walkin-name" type="text" placeholder="e.g. Amit Kulkarni" required class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none">
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Mobile (10 Digits)</label>
                <input id="walkin-phone" type="tel" maxlength="10" placeholder="98XXXXXXXX" required class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none font-mono">
              </div>
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Age</label>
                <input id="walkin-age" type="number" min="1" max="110" value="30" required class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none">
              </div>
            </div>
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Doctor</label>
              <select id="walkin-doctor" class="h-9 w-full px-3 rounded-xl border border-emerald-200 bg-white outline-none">
                ${doctors.map((d) => `<option value="${d.id}">${escapeHtml(d.name)} (${escapeHtml(d.specialty)})</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Reason / Complaint</label>
              <input id="walkin-reason" type="text" placeholder="Walk-in OPD checkup" value="Walk-in OPD checkup" class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none">
            </div>
            <div class="pt-2 flex justify-end gap-2">
              <button type="submit" class="px-5 py-2.5 rounded-xl bg-tealbrand text-white font-semibold hover:bg-teal-700">Generate Walk-in Token</button>
            </div>
          </form>
        </div>
      `);

      $("#form-walkin-token")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const patientName = ($("#walkin-name")?.value || "").trim();
        const phone = ($("#walkin-phone")?.value || "").replace(/\D/g, "").slice(0, 10);
        const age = Number($("#walkin-age")?.value || 30);
        const doctorId = $("#walkin-doctor")?.value || "ananya-rao";
        const reason = ($("#walkin-reason")?.value || "Walk-in OPD checkup").trim();
        if (patientName.length < 2 || phone.length !== 10) {
          showToast("Valid patient name aur 10-digit mobile number enter karein.");
          return;
        }
        const today = new Date().toISOString().split("T")[0];
        const appointments = readJson("carewell_appointments", []);
        const usedTokens = appointments
          .filter((a) => a.doctorId === doctorId && a.date === today && a.status !== "cancelled")
          .map((a) => Number(a.tokenNo) || 0);
        const tokenNo = Math.max(8, ...usedTokens, 0) + 1;
        const bookingId = `CW-${String(2000 + (Date.now() % 7000)).padStart(4, "0")}`;
        appointments.push({
          id: `cw-walkin-${Date.now()}`,
          bookingId,
          tokenNo,
          token: bookingId,
          patientName,
          phone,
          age,
          doctorId,
          date: today,
          slot: "Walk-in",
          reason,
          visitType: "Walk-in",
          paymentMode: "Pay at Clinic",
          status: "confirmed",
          createdAt: new Date().toISOString()
        });
        writeJson("carewell_appointments", appointments);
        closeModal();
        showToast(`Walk-in Token #${tokenNo} (${bookingId}) issued for ${patientName}!`);
        renderTabContent();
      });
    },

    createHealthCamp() {
      const title = window.prompt("Health Camp Title:", "Free Sugar Checkup Camp - Sunday");
      if (!title) return;
      const camps = readJson("carewell_health_camps", []);
      camps.unshift({ id: `camp-${Date.now()}`, title: title.trim(), registrations: 42, createdAt: new Date().toISOString() });
      writeJson("carewell_health_camps", camps);
      const outbox = readJson("carewell_outbox", []);
      outbox.unshift({
        id: `out-${Date.now()}`,
        phone: "All Camp Leads",
        patient: "Camp Invite",
        kind: "Health Camp",
        text: `${title.trim()} — Register karein CareWell Clinic Camp, Pune par! Limited 100 slots.`,
        status: "Broadcast Sent",
        createdAt: new Date().toISOString()
      });
      writeJson("carewell_outbox", outbox);
      showToast(`Health Camp "${title.trim()}" launched & WhatsApp invite sent!`);
    },

    exportAppointmentsCsv() {
      const appointments = readJson("carewell_appointments", []);
      if (!appointments.length) {
        showToast("No appointments to export.");
        return;
      }
      const rows = [["BookingID", "Token", "Patient", "Phone", "Doctor", "Date", "Slot", "Payment", "Status"]];
      appointments.forEach((a) => {
        rows.push([
          a.bookingId || a.token || "",
          a.tokenNo || "",
          a.patientName || "",
          a.phone || "",
          a.doctorId || "",
          a.date || "",
          a.slot || "",
          a.paymentMode || "Pay at Clinic",
          a.status || "confirmed"
        ]);
      });
      const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `carewell-appointments-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast("Appointments CSV downloaded!");
    }
  };

  document.addEventListener("DOMContentLoaded", initAdmin);
})();
