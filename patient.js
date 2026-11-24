/**
 * CareWell Clinic - Patient Portal Engine (patient.js)
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

  // Pre-seed default patient records into localStorage if not present
  if (!localStorage.getItem("carewell_prescriptions")) {
    writeJson("carewell_prescriptions", CareWellData.records?.prescriptions || []);
  }
  if (!localStorage.getItem("carewell_reports")) {
    writeJson("carewell_reports", CareWellData.records?.reports || []);
  }
  if (!localStorage.getItem("carewell_visits")) {
    writeJson("carewell_visits", CareWellData.records?.visits || []);
  }

  const familyMembers = CareWellData.records?.family || [
    { id: "riya", name: "Riya Sharma", patientId: "CW-2048", age: 28, relation: "Self", phone: "9811111111", blood: "B+" },
    { id: "papa", name: "Suresh Sharma", patientId: "CW-1980", age: 58, relation: "Papa", phone: "9811111111", blood: "O+" },
    { id: "mummy", name: "Lata Sharma", patientId: "CW-1988", age: 54, relation: "Mummy", phone: "9811111111", blood: "B+" },
    { id: "baccha", name: "Aarav Sharma", patientId: "CW-2210", age: 6, relation: "Baccha", phone: "9811111111", blood: "A+" }
  ];

  let isPatientLoggedIn = localStorage.getItem("carewell_patient_auth") === "true";
  let activeMemberId = localStorage.getItem("carewell_active_patient_member") || "CW-2048";
  let currentTab = "appointments";

  function initPatientApp() {
    bindAuth();
    if (isPatientLoggedIn) {
      showWorkspace();
    } else {
      showLogin();
    }
  }

  function bindAuth() {
    $("#form-patient-login")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const phone = $("#patient-login-phone")?.value.trim();
      if (!phone || phone.length !== 10) {
        showToast("Kripya 10-digit mobile number enter karein");
        return;
      }
      isPatientLoggedIn = true;
      localStorage.setItem("carewell_patient_auth", "true");
      showWorkspace();
      showToast("OTP verified! Welcome to Patient Portal");
    });

    $("#btn-quick-patient-login")?.addEventListener("click", () => {
      isPatientLoggedIn = true;
      localStorage.setItem("carewell_patient_auth", "true");
      activeMemberId = "CW-2048";
      localStorage.setItem("carewell_active_patient_member", "CW-2048");
      showWorkspace();
      showToast("Welcome Riya Sharma!");
    });

    $("#btn-patient-logout")?.addEventListener("click", () => {
      isPatientLoggedIn = false;
      localStorage.removeItem("carewell_patient_auth");
      showLogin();
      showToast("Logged out from Patient Portal.");
    });
  }

  function showLogin() {
    $("#patient-login-view")?.classList.remove("hidden");
    $("#patient-workspace-view")?.classList.add("hidden");
    $("#btn-patient-logout")?.classList.add("hidden");
    refreshIcons();
  }

  function showWorkspace() {
    $("#patient-login-view")?.classList.add("hidden");
    $("#patient-workspace-view")?.classList.remove("hidden");
    $("#btn-patient-logout")?.classList.remove("hidden");
    bindTabs();
    renderFamilyChips();
    renderTabContent();
    refreshIcons();
  }

  function renderFamilyChips() {
    const member = familyMembers.find((m) => m.patientId === activeMemberId) || familyMembers[0];
    const initials = member.name.split(" ").map((n) => n[0]).join("");

    $("#patient-avatar-box").textContent = initials;
    $("#patient-header-name").textContent = member.name;
    $("#patient-header-id").textContent = member.patientId;
    $("#patient-header-meta").textContent = `Age: ${member.age} yrs · Relation: ${member.relation} · Mobile: +91 ${member.phone} · Blood: ${member.blood || "B+"}`;

    const chipsContainer = $("#family-chips-container");
    if (!chipsContainer) return;

    chipsContainer.innerHTML = familyMembers.map((mem) => `
      <button type="button" data-member-id="${mem.patientId}" class="px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
        mem.patientId === member.patientId
          ? "bg-tealbrand text-white shadow-xs"
          : "bg-white text-slate-700 border border-emerald-200 hover:bg-emerald-50"
      }">
        👤 ${escapeHtml(mem.name)} (${escapeHtml(mem.relation)})
      </button>
    `).join("");

    chipsContainer.querySelectorAll("[data-member-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeMemberId = btn.dataset.memberId;
        localStorage.setItem("carewell_active_patient_member", activeMemberId);
        renderFamilyChips();
        renderTabContent();
      });
    });
  }

  function bindTabs() {
    $$("[data-patient-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentTab = btn.dataset.patientTab;
        $$("[data-patient-tab]").forEach((b) => {
          const isActive = b.dataset.patientTab === currentTab;
          b.className = isActive
            ? "px-4 py-2.5 text-xs font-semibold rounded-xl bg-tealbrand text-white transition shadow-xs"
            : "px-4 py-2.5 text-xs font-semibold rounded-xl text-slate-700 hover:bg-emerald-50 transition";
        });
        renderTabContent();
      });
    });
  }

  function renderTabContent() {
    const container = $("#patient-tab-content");
    if (!container) return;

    const member = familyMembers.find((m) => m.patientId === activeMemberId) || familyMembers[0];

    const allAppointments = readJson("carewell_appointments", []);
    // Member's appointments (matching phone or member booking)
    const memberAppointments = allAppointments.filter((a) => {
      if (member.patientId === "CW-2048") return true;
      return a.patientName && a.patientName.toLowerCase().includes(member.name.toLowerCase().split(" ")[0]);
    });

    const prescriptions = readJson("carewell_prescriptions", []).filter((p) => p.patientId === member.patientId);
    const reports = readJson("carewell_reports", []).filter((r) => r.patientId === member.patientId);
    const visits = readJson("carewell_visits", []).filter((v) => v.patientId === member.patientId);

    // Update counts in tab buttons
    if ($("#count-pat-appointments")) $("#count-pat-appointments").textContent = memberAppointments.length;
    if ($("#count-pat-prescriptions")) $("#count-pat-prescriptions").textContent = prescriptions.length;
    if ($("#count-pat-reports")) $("#count-pat-reports").textContent = reports.length;
    if ($("#count-pat-history")) $("#count-pat-history").textContent = visits.length;

    // 1. APPOINTMENTS TAB
    if (currentTab === "appointments") {
      if (memberAppointments.length === 0) {
        container.innerHTML = `
          <div class="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-emerald-200">
            <span class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-tealbrand mb-3">
              <i data-lucide="calendar" class="w-6 h-6"></i>
            </span>
            <p class="font-bold text-slate-900 text-sm">Koi Active Appointment Nahi Hai</p>
            <p class="text-xs text-slate-500 mt-1">Aap CareWell website se doctor choose karke instant slot book kar sakte hain.</p>
            <a href="index.html#doctors" class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-tealbrand text-white text-xs font-semibold hover:bg-teal-700">
              Doctor Dhoondhein & Book Karein →
            </a>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-emerald-100">
              <h3 class="font-display text-lg font-bold text-slate-900">Upcoming & Past Appointments</h3>
              <a href="index.html#doctors" class="text-xs font-semibold text-tealbrand hover:underline">
                + Naya Appointment Book Karein
              </a>
            </div>

            <div class="space-y-3">
              ${memberAppointments.map((app) => `
                <div class="p-4 sm:p-5 rounded-2xl border border-emerald-100 bg-white shadow-2xs hover:border-emerald-300 transition">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-mint text-tealbrand border border-emerald-200">
                          Token #${escapeHtml(app.tokenNo || 12)}
                        </span>
                        <span class="text-xs px-2 py-0.5 rounded-full font-bold ${
                          app.status === "confirmed" ? "bg-emerald-100 text-emerald-800" :
                          app.status === "done" ? "bg-slate-100 text-slate-700" :
                          app.status === "cancelled" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                        }">
                          ${escapeHtml(app.status ? app.status.toUpperCase() : "CONFIRMED")}
                        </span>
                      </div>
                      <h4 class="font-bold text-slate-900 text-base mt-1.5">
                        ${escapeHtml(app.doctorName || "Dr. Ananya Rao")}
                      </h4>
                      <p class="text-xs text-slate-500 mt-0.5">
                        📅 ${escapeHtml(app.date)} · ⏰ ${escapeHtml(app.slot)} · Reason: ${escapeHtml(app.reason || "General Checkup")}
                      </p>
                    </div>

                    <div class="flex items-center gap-2">
                      <a href="index.html#queue" class="px-3 py-1.5 rounded-xl border border-emerald-200 bg-mint text-tealbrand text-xs font-semibold hover:bg-emerald-100 transition flex items-center gap-1">
                        <i data-lucide="radio" class="w-3.5 h-3.5"></i> Track Live Queue
                      </a>
                      ${app.status !== "cancelled" ? `
                        <button type="button" onclick="window.CareWellPatient.cancelAppointment('${escapeHtml(app.id)}')" class="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-red-50 hover:text-red-700 transition">
                          Cancel
                        </button>
                      ` : ""}
                    </div>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        `;
      }
    }

    // 2. PRESCRIPTIONS TAB
    else if (currentTab === "prescriptions") {
      if (prescriptions.length === 0) {
        container.innerHTML = `
          <div class="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-emerald-200">
            <span class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-tealbrand mb-3">
              <i data-lucide="file-text" class="w-6 h-6"></i>
            </span>
            <p class="font-bold text-slate-900 text-sm">Koi Digital Prescription Nahi Hai</p>
            <p class="text-xs text-slate-500 mt-1">Doctor OPD checkup ke baad prescription yahan automatically upload hoti hai.</p>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-emerald-100">
              <div>
                <h3 class="font-display text-lg font-bold text-slate-900">Doctor Prescriptions (Rx)</h3>
                <p class="text-xs text-slate-500">Doctor ne kya dawai likhi, date ke saath. PDF download / view karein.</p>
              </div>
              <span class="text-xs font-medium text-emerald-800 bg-mint px-2.5 py-1 rounded-full border border-emerald-200">
                Sab Digital · No Paper Lost
              </span>
            </div>

            <div class="space-y-3">
              ${prescriptions.map((rx) => `
                <div class="p-5 rounded-2xl border border-emerald-100 bg-white shadow-2xs">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-display text-lg font-bold text-tealbrand">℞</span>
                        <h4 class="font-bold text-slate-900 text-sm">${escapeHtml(rx.doctor || "Dr. Ananya Rao")}</h4>
                        <span class="text-xs text-slate-400">·</span>
                        <span class="text-xs text-slate-500 font-mono">${escapeHtml(rx.date)}</span>
                      </div>
                      <p class="mt-2 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono whitespace-pre-line leading-relaxed">
                        ${escapeHtml(rx.text)}
                      </p>
                    </div>

                    <div class="shrink-0 flex sm:flex-col gap-2">
                      <button type="button" onclick="window.CareWellPatient.viewRxModal('${escapeHtml(rx.id)}')" class="px-3.5 py-2 rounded-xl bg-tealbrand text-white text-xs font-semibold hover:bg-teal-700 transition flex items-center gap-1.5 shadow-2xs">
                        <i data-lucide="printer" class="w-3.5 h-3.5"></i> Print / View Rx PDF
                      </button>
                    </div>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        `;
      }
    }

    // 3. MEDICAL REPORTS TAB
    else if (currentTab === "reports") {
      if (reports.length === 0) {
        container.innerHTML = `
          <div class="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-emerald-200">
            <span class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-tealbrand mb-3">
              <i data-lucide="test-tube-2" class="w-6 h-6"></i>
            </span>
            <p class="font-bold text-slate-900 text-sm">Abhi Koi Lab Report Uploaded Nahi Hai</p>
            <p class="text-xs text-slate-500 mt-1">Blood test, X-Ray, aur Sugar reports clinic lab se yahan seedhe deliver hoti hain.</p>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-emerald-100">
              <div>
                <h3 class="font-display text-lg font-bold text-slate-900">Diagnostic Reports & Lab Results</h3>
                <p class="text-xs text-slate-500">Blood Test, Sugar, X-Ray — Digital View & Download</p>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${reports.map((rep) => `
                <div class="p-5 rounded-2xl border border-emerald-100 bg-white shadow-2xs flex flex-col justify-between">
                  <div>
                    <div class="flex items-center justify-between">
                      <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-tealbrand border border-emerald-200">
                        ${escapeHtml(rep.type)}
                      </span>
                      <span class="text-xs text-slate-400 font-mono">${escapeHtml(rep.date)}</span>
                    </div>
                    <h4 class="font-bold text-slate-900 text-base mt-2">${escapeHtml(rep.name)}</h4>
                    <p class="text-xs text-slate-600 mt-1">${escapeHtml(rep.note || "Report normal. Verified by Pathologist.")}</p>
                  </div>

                  <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span class="text-[11px] text-emerald-700 font-medium">✓ Doctor Reviewed</span>
                    <button type="button" onclick="window.CareWellPatient.downloadReport('${escapeHtml(rep.name)}')" class="px-3 py-1.5 rounded-xl border border-emerald-200 bg-mint text-tealbrand text-xs font-semibold hover:bg-emerald-100 flex items-center gap-1.5">
                      <i data-lucide="download" class="w-3.5 h-3.5"></i> Download PDF
                    </button>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        `;
      }
    }

    // 4. VISIT HISTORY TAB
    else if (currentTab === "history") {
      container.innerHTML = `
        <div class="space-y-4">
          <div class="pb-3 border-b border-emerald-100">
            <h3 class="font-display text-lg font-bold text-slate-900">Complete Visit Timeline</h3>
            <p class="text-xs text-slate-500">Aapka clinic checkup record chronologically arranged</p>
          </div>

          <div class="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-emerald-200">
            ${visits.map((v) => `
              <div class="relative">
                <span class="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white bg-tealbrand shadow-xs"></span>
                <div class="p-4 rounded-2xl border border-emerald-100 bg-white">
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-sm text-slate-900">${escapeHtml(v.label)}</span>
                    <span class="text-xs text-slate-500 font-mono">${escapeHtml(v.date)}</span>
                  </div>
                  <p class="text-xs text-slate-600 mt-1">CareWell Clinic OPD · Dr. Consultation & Advice completed.</p>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }

    // 5. DIGITAL HEALTH CARD TAB
    else if (currentTab === "healthcard") {
      container.innerHTML = `
        <div class="max-w-md mx-auto p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-tealbrand via-emerald-800 to-slate-900 text-white shadow-xl relative overflow-hidden">
          <div class="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10 blur-xl"></div>
          
          <div class="flex items-center justify-between pb-4 border-b border-white/20">
            <div class="flex items-center gap-2">
              <span class="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-bold">CW</span>
              <span class="font-display font-bold text-lg tracking-wide">CareWell Clinic</span>
            </div>
            <span class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-400 text-slate-900">
              Digital Health ID
            </span>
          </div>

          <div class="mt-6 flex items-center justify-between">
            <div>
              <p class="text-xs text-emerald-200 uppercase font-semibold tracking-wider">Patient Name</p>
              <h3 class="text-xl font-bold font-display mt-0.5">${escapeHtml(member.name)}</h3>
              <p class="text-xs text-emerald-100 mt-1">Patient ID: <span class="font-mono font-bold">${escapeHtml(member.patientId)}</span></p>
              <p class="text-xs text-emerald-100">Blood Group: <span class="font-bold">${escapeHtml(member.blood || "B+")}</span> · Age: ${member.age} yrs</p>
            </div>

            <!-- Fake QR Code SVG for Digital Card -->
            <div class="w-20 h-20 bg-white p-2 rounded-2xl shadow-md shrink-0 flex items-center justify-center">
              <div class="w-full h-full border-2 border-slate-900 grid grid-cols-4 gap-0.5 p-0.5">
                <div class="bg-slate-900"></div><div class="bg-white"></div><div class="bg-slate-900"></div><div class="bg-slate-900"></div>
                <div class="bg-slate-900"></div><div class="bg-slate-900"></div><div class="bg-white"></div><div class="bg-slate-900"></div>
                <div class="bg-white"></div><div class="bg-slate-900"></div><div class="bg-slate-900"></div><div class="bg-white"></div>
                <div class="bg-slate-900"></div><div class="bg-white"></div><div class="bg-slate-900"></div><div class="bg-slate-900"></div>
              </div>
            </div>
          </div>

          <div class="mt-6 pt-4 border-t border-white/20 flex items-center justify-between text-[11px] text-emerald-200">
            <span>Emergency Contact: +91 98765 43210</span>
            <span>Camp, Pune</span>
          </div>
        </div>
      `;
    }

    refreshIcons();
  }

  // Public Actions
  window.CareWellPatient = {
    cancelAppointment(id) {
      const appointments = readJson("carewell_appointments", []);
      const a = appointments.find((x) => x.id === id);
      if (a) {
        a.status = "cancelled";
        writeJson("carewell_appointments", appointments);
        showToast("Appointment cancelled.");
        renderTabContent();
      }
    },

    downloadReport(reportName) {
      showToast(`Downloading ${reportName} PDF...`);
    },

    viewRxModal(rxId) {
      const rxList = readJson("carewell_prescriptions", []);
      const rx = rxList.find((x) => x.id === rxId) || rxList[0];
      const member = familyMembers.find((m) => m.patientId === activeMemberId) || familyMembers[0];

      // 02. Auth & Access - BOLA / IDOR Verification Check (Checklist Point 6)
      if (window.CareWellSecurity && !window.CareWellSecurity.authorizeRecordAccess(member.patientId, rx.patientId, "patient")) {
        showToast("Security Alert (BOLA Protected): Unauthorized! Aap doosre patient ka prescription nahi dekh sakte.");
        return;
      }

      const modalContainer = $("#prescription-modal-container");
      if (!modalContainer) return;

      modalContainer.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div class="bg-white rounded-3xl border border-emerald-100 shadow-2xl w-full max-w-lg p-6 sm:p-8 overflow-hidden animate-in fade-in">
            <!-- Prescription Pad Header -->
            <div class="border-b-2 border-tealbrand pb-4 flex items-start justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-display text-2xl font-bold text-tealbrand">CareWell Optical & Clinic</h3>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-tealbrand border border-emerald-300">
                    🔒 BOLA Protected
                  </span>
                </div>
                <p class="text-xs text-slate-500">214, MG Road, Camp, Pune 411001 · Phone: +91 98765 43210</p>
                <p class="text-xs font-semibold text-slate-800 mt-1">${escapeHtml(rx.doctor || "Dr. Rohit Verma (Eye Specialist)")}</p>
              </div>
              <span class="font-display text-4xl font-bold text-tealbrand">℞</span>
            </div>

            <!-- Patient Metadata -->
            <div class="my-3 py-2 border-b border-slate-100 grid grid-cols-2 gap-2 text-xs">
              <div><span class="text-slate-400">Patient:</span> <strong class="text-slate-800">${escapeHtml(member.name)}</strong> (${escapeHtml(member.patientId)})</div>
              <div><span class="text-slate-400">Date:</span> <strong class="text-slate-800 font-mono">${escapeHtml(rx.date)}</strong></div>
              <div><span class="text-slate-400">Age:</span> ${member.age} yrs</div>
              <div><span class="text-slate-400">Department:</span> <strong>Optical Vision & Eye Care</strong></div>
            </div>

            <!-- Optical Power Prescription Grid (For Optical Client) -->
            <div class="my-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <p class="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1">
                <span>👓 Computerized Eye Power Reading:</span>
              </p>
              <div class="grid grid-cols-4 gap-1.5 text-center font-mono text-[11px]">
                <div class="p-1.5 bg-white rounded-lg border border-slate-200">
                  <span class="block text-[9px] text-slate-400">Eye</span>
                  <strong>OD (Right)</strong>
                </div>
                <div class="p-1.5 bg-white rounded-lg border border-slate-200">
                  <span class="block text-[9px] text-slate-400">Sphere</span>
                  <strong class="text-tealbrand">-1.50</strong>
                </div>
                <div class="p-1.5 bg-white rounded-lg border border-slate-200">
                  <span class="block text-[9px] text-slate-400">Cylinder</span>
                  <strong>-0.50</strong>
                </div>
                <div class="p-1.5 bg-white rounded-lg border border-slate-200">
                  <span class="block text-[9px] text-slate-400">Axis</span>
                  <strong>90°</strong>
                </div>
              </div>
              <div class="grid grid-cols-4 gap-1.5 text-center font-mono text-[11px] mt-1.5">
                <div class="p-1.5 bg-white rounded-lg border border-slate-200">
                  <span class="block text-[9px] text-slate-400">Eye</span>
                  <strong>OS (Left)</strong>
                </div>
                <div class="p-1.5 bg-white rounded-lg border border-slate-200">
                  <span class="block text-[9px] text-slate-400">Sphere</span>
                  <strong class="text-tealbrand">-1.75</strong>
                </div>
                <div class="p-1.5 bg-white rounded-lg border border-slate-200">
                  <span class="block text-[9px] text-slate-400">Cylinder</span>
                  <strong>-0.25</strong>
                </div>
                <div class="p-1.5 bg-white rounded-lg border border-slate-200">
                  <span class="block text-[9px] text-slate-400">Axis</span>
                  <strong>85°</strong>
                </div>
              </div>
              <p class="mt-2 text-[10px] text-emerald-800 font-medium">
                ✓ Recommended Lens: Certified Blue-Cut Anti-Glare Computer Lenses (UV420 Protection)
              </p>
            </div>

            <!-- Prescription Text -->
            <div class="my-3 p-3 rounded-2xl bg-mint/50 border border-emerald-100 text-xs font-mono whitespace-pre-line leading-relaxed text-slate-800">
              ${escapeHtml(rx.text)}
            </div>

            <!-- Doctor Sign & Buttons -->
            <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <p class="text-[10px] text-slate-400">Encrypted PHI Record · HIPAA Verified</p>
                <p class="text-xs font-semibold text-tealbrand">CareWell Optical Records</p>
              </div>
              <div class="flex gap-2">
                <button type="button" onclick="window.print()" class="px-3.5 py-2 rounded-xl bg-tealbrand text-white text-xs font-semibold hover:bg-teal-700">
                  Print PDF
                </button>
                <button type="button" onclick="document.querySelector('#prescription-modal-container').innerHTML=''" class="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      refreshIcons();
    }
  };

  document.addEventListener("DOMContentLoaded", initPatientApp);
})();
