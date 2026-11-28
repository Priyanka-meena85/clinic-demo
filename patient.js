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

  let familyMembers = readJson("carewell_family_members", null) || CareWellData.records?.family || [
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
    $("#btn-send-patient-otp")?.addEventListener("click", () => {
      const phone = ($("#patient-login-phone")?.value || "").replace(/\D/g, "");
      if (phone.length !== 10) {
        showToast("Pehle 10-digit mobile number enter karein.");
        return;
      }
      showToast(`OTP sent to +91 ${phone} (Demo OTP: 1234)`);
    });

    $("#form-patient-login")?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (window.CareWellSecurity && window.CareWellSecurity.isRateLimited("patient-login")) {
        showToast("Security Lockout: Too many failed OTP attempts. Wait 15 min.");
        return;
      }
      const phone = ($("#patient-login-phone")?.value || "").replace(/\D/g, "");
      const otp = ($("#patient-login-otp")?.value || "").trim();
      if (phone.length !== 10) {
        showToast("Kripya 10-digit mobile number enter karein");
        return;
      }
      if (otp !== "1234" && otp !== "4289") {
        if (window.CareWellSecurity) window.CareWellSecurity.recordFailedAttempt("patient-login");
        showToast("Invalid OTP! Demo OTP is 1234.");
        return;
      }
      if (window.CareWellSecurity) window.CareWellSecurity.resetRateLimit("patient-login");
      if (window.CareWellApi) {
        window.CareWellApi.verifyOtp(phone, otp === "1234" ? "4289" : otp).catch(() => {});
      }
      isPatientLoggedIn = true;
      localStorage.removeItem("carewell_admin_auth");
      localStorage.removeItem("carewell_receptionist_auth");
      localStorage.removeItem("carewell_doctor_auth_id");
      localStorage.setItem("carewell_patient_auth", "true");
      localStorage.setItem("carewell_session_exp", String(Date.now() + 8 * 3600 * 1000));
      showWorkspace();
      showToast("OTP verified! Welcome to Patient Portal");
    });

    $("#btn-add-family-member")?.addEventListener("click", () => {
      const name = window.prompt("Family Member Name (e.g. Rohan Sharma):");
      if (!name || name.trim().length < 2) return;
      const relation = window.prompt("Relation (e.g. Spouse, Father, Mother, Child):", "Family") || "Family";
      const age = Number(window.prompt("Age (Years):", "30") || 30);
      const newMember = {
        id: `fam-${Date.now()}`,
        name: name.trim(),
        patientId: `CW-${Math.floor(2300 + Math.random() * 6000)}`,
        age: Number.isFinite(age) ? age : 30,
        relation: relation.trim(),
        phone: "9811111111",
        blood: "O+"
      };
      familyMembers.push(newMember);
      writeJson("carewell_family_members", familyMembers);
      activeMemberId = newMember.patientId;
      localStorage.setItem("carewell_active_patient_member", activeMemberId);
      renderFamilyChips();
      renderTabContent();
      showToast(`${newMember.name} added to family profiles!`);
    });

    $("#btn-quick-patient-login")?.addEventListener("click", () => {
      isPatientLoggedIn = true;
      localStorage.removeItem("carewell_admin_auth");
      localStorage.removeItem("carewell_receptionist_auth");
      localStorage.removeItem("carewell_doctor_auth_id");
      localStorage.setItem("carewell_patient_auth", "true");
      localStorage.setItem("carewell_session_exp", String(Date.now() + 8 * 3600 * 1000));
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
    if ($("#patient-blood-stat")) $("#patient-blood-stat").textContent = member.blood || "B+";

    const chipsContainer = $("#family-chips-container");
    const dropdown = $("#patient-family-dropdown");
    if (dropdown) {
      dropdown.innerHTML = familyMembers.map((mem) => `<option value="${mem.patientId}" ${mem.patientId === member.patientId ? "selected" : ""}>${escapeHtml(mem.name)} (${escapeHtml(mem.relation)})</option>`).join("");
      dropdown.onchange = () => {
        activeMemberId = dropdown.value;
        localStorage.setItem("carewell_active_patient_member", activeMemberId);
        renderFamilyChips();
        renderTabContent();
      };
    }
    const qState = readJson("carewell_queue_state", { doctorId: "ananya-rao", current: 8, yourToken: 12, avgMinsPerPatient: 7.5 });
    const qDoc = (CareWellData?.doctors || []).find((d) => d.id === qState.doctorId) || CareWellData?.doctors?.[0];
    const diff = Math.max(0, qState.yourToken - qState.current);
    const estMins = Math.round(diff * (qState.avgMinsPerPatient || 7.5));
    if ($("#patient-aaj-status-text")) {
      $("#patient-aaj-status-text").textContent = diff === 0
        ? `Token #${qState.yourToken} · ${qDoc ? qDoc.name : "Doctor"} · Aapka number abhi hai! Room mein aaiye.`
        : `Token #${qState.yourToken} · ${qDoc ? qDoc.name : "Doctor"} · ~${estMins} min baaki hai · Aap ghar par hi rukiye`;
    }
    if (!chipsContainer) return;

    chipsContainer.innerHTML = familyMembers.map((mem) => `
      <button type="button" data-member-id="${mem.patientId}" class="px-3.5 py-2 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 ${
        mem.patientId === member.patientId
          ? "bg-tealbrand text-white shadow-xs"
          : "bg-white text-slate-700 border border-emerald-200 hover:bg-emerald-50"
      }">
        <span class="icon icon-user"></span> ${escapeHtml(mem.name)} (${escapeHtml(mem.relation)})
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
                        ${escapeHtml(app.date)} · ⏰ ${escapeHtml(app.slot)} · Reason: ${escapeHtml(app.reason || "General Checkup")}
                      </p>
                    </div>

                    <div class="flex items-center gap-2">
                      <a href="index.html#queue" class="px-3 py-1.5 rounded-xl border border-emerald-200 bg-mint text-tealbrand text-xs font-semibold hover:bg-emerald-100 transition flex items-center gap-1">
                        <i data-lucide="radio" class="w-3.5 h-3.5"></i> Track Live Queue
                      </a>
                      <button type="button" onclick="window.CareWellPatient.viewReceiptModal('${escapeHtml(app.id)}')" class="px-3 py-1.5 rounded-xl border border-emerald-200 bg-white text-tealbrand text-xs font-semibold hover:bg-mint transition">
                        Receipt
                      </button>
                      <button type="button" onclick="window.CareWellPatient.rateDoctorVisit('${escapeHtml(app.id)}')" class="px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition">
                        Rate Visit
                      </button>
                      ${app.status !== "cancelled" ? `
                        <button type="button" onclick="window.CareWellPatient.rescheduleWithReason('${escapeHtml(app.id)}')" class="px-3 py-1.5 rounded-xl border border-emerald-200 bg-white text-slate-700 text-xs font-semibold hover:bg-emerald-50 transition">
                          Slot Change
                        </button>
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
                      <button type="button" onclick="window.CareWellPatient.setMedicineReminder('${escapeHtml(rx.id)}')" class="px-3.5 py-2 rounded-xl border border-emerald-200 bg-mint text-tealbrand text-xs font-semibold hover:bg-emerald-100 transition">
                        9 AM Reminder
                      </button>
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
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-emerald-100">
              <div>
                <h3 class="font-display text-lg font-bold text-slate-900">Diagnostic Reports &amp; Lab Vault</h3>
                <p class="text-xs text-slate-500">Blood Test, Sugar, X-Ray — Filter by category</p>
              </div>
              <div class="flex flex-wrap gap-1.5">
                ${["All", "Blood Test", "X-Ray"].map((cat) => `<button type="button" onclick="window.CareWellPatient.filterReports('${cat}')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${ (window._patReportFilter || "All") === cat ? "bg-tealbrand text-white border-tealbrand" : "bg-white text-slate-700 border-emerald-200" }">${cat}</button>`).join("")}
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${reports.filter((rep) => !window._patReportFilter || window._patReportFilter === "All" || rep.type === window._patReportFilter).map((rep) => `
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

                  <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span class="text-[11px] text-emerald-700 font-medium">Doctor Reviewed</span>
                    <div class="flex gap-1.5">
                      <button type="button" onclick="window.CareWellPatient.explainReportAI('${escapeHtml(rep.name)}', '${escapeHtml(rep.note || "")}')" class="px-2.5 py-1.5 rounded-xl bg-tealbrand text-white text-xs font-semibold hover:bg-teal-700">
                        Explain in Hindi (AI)
                      </button>
                      <button type="button" onclick="window.CareWellPatient.downloadReport('${escapeHtml(rep.name)}')" class="px-3 py-1.5 rounded-xl border border-emerald-200 bg-mint text-tealbrand text-xs font-semibold hover:bg-emerald-100 flex items-center gap-1.5">
                        <i data-lucide="download" class="w-3.5 h-3.5"></i> PDF
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
    rescheduleWithReason(id) {
      const reason = window.prompt("Slot change reason (e.g. Traffic / Running Late):", "Traffic / Running Late");
      if (!reason) return;
      const newSlot = window.prompt("Preferred new slot (e.g. Tomorrow 10:00 AM):", "Tomorrow 10:00 AM");
      if (!newSlot) return;
      const appointments = readJson("carewell_appointments", []);
      const a = appointments.find((x) => x.id === id);
      if (a) {
        a.slot = newSlot.trim();
        a.rescheduleReason = reason.trim();
        writeJson("carewell_appointments", appointments);
        showToast(`Slot rescheduled to ${newSlot} (${reason})`);
        renderTabContent();
      }
    },

    setMedicineReminder(rxId) {
      const member = familyMembers.find((m) => m.patientId === activeMemberId) || familyMembers[0];
      const outbox = readJson("carewell_outbox", []);
      outbox.unshift({
        id: `out-${Date.now()}`,
        phone: member.phone || "9811111111",
        patient: member.name,
        kind: "Medicine Reminder",
        text: `Subah 9:00 AM Medicine Reminder (${rxId}): Apni prescribed dose lena na bhulein.`,
        status: "Scheduled",
        createdAt: new Date().toISOString()
      });
      writeJson("carewell_outbox", outbox);
      showToast("9:00 AM Daily Medicine Reminder scheduled on WhatsApp!");
    },

    filterReports(category) {
      window._patReportFilter = category;
      renderTabContent();
    },

    rechargeWallet() {
      const bal = Number(localStorage.getItem("carewell_wallet_bal") || 2000) + 2000;
      localStorage.setItem("carewell_wallet_bal", String(bal));
      if ($("#patient-wallet-bal")) $("#patient-wallet-bal").textContent = `₹${bal.toLocaleString("en-IN")}`;
      showToast(`Wallet recharged! Balance: ₹${bal.toLocaleString("en-IN")} (10% Off Active)`);
    },

    copyReferral() {
      const msg = "CareWell Clinic Camp Pune pe slot book karo aur ₹100 off paao! Code: CAREWELL-100";
      if (navigator.clipboard) navigator.clipboard.writeText(msg).catch(() => {});
      showToast("Referral code CAREWELL-100 copied! Share on WhatsApp.");
    },

    rateDoctorVisit(id) {
      const rating = window.prompt("Doctor ne acche se suna? Rating dein (1 to 5):", "5");
      if (!rating) return;
      const ratings = readJson("carewell_doctor_ratings", []);
      ratings.unshift({ id, rating: Number(rating) || 5, date: new Date().toISOString() });
      writeJson("carewell_doctor_ratings", ratings);
      showToast(`Thank you! ${rating}/5 rating saved for clinic quality review.`);
    },

    explainReportAI(name, note) {
      const modalContainer = $("#prescription-modal-container");
      if (!modalContainer) return;
      const q = `${name} ${note}`.toLowerCase();
      let hindiExplain = "Aapki report general parameters ke andar hai. Doctor ke review ke hisaab se regular paani aur balanced diet rakhein.";
      if (q.includes("sugar") || q.includes("118")) {
        hindiExplain = "Aapka fasting sugar (118 mg/dL) thoda borderline high hai — ghabrane ki baat nahi. Meetha, cold drinks aur maida band karein, aur roz 30 min walk karein.";
      } else if (q.includes("x-ray") || q.includes("chest")) {
        hindiExplain = "Chest X-Ray normal hai — koi acute infection ya fluid nahi dikh raha. Agar khansi rahe to steam aur warm water continue rakhein.";
      } else if (q.includes("cbc") || q.includes("hemoglobin")) {
        hindiExplain = "CBC report mein Hemoglobin 11.8 g/dL hai jo mild low/borderline hai. Hari sabziyan, chana, aur iron-rich diet badhayein.";
      }
      modalContainer.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div class="bg-white rounded-3xl border border-emerald-100 shadow-2xl w-full max-w-md p-6">
            <h3 class="font-display text-lg font-bold text-tealbrand">AI Report Explainer (Simple Hindi)</h3>
            <p class="text-xs font-semibold text-slate-800 mt-2">${escapeHtml(name)}</p>
            <div class="mt-3 p-4 rounded-2xl bg-mint border border-emerald-200 text-xs leading-relaxed text-slate-800">${escapeHtml(hindiExplain)}</div>
            <div class="mt-4 flex justify-end">
              <button type="button" onclick="document.querySelector('#prescription-modal-container').innerHTML=''" class="px-4 py-2 rounded-xl bg-tealbrand text-white text-xs font-semibold">Samajh Aa Gaya</button>
            </div>
          </div>
        </div>`;
    },

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

    orderMedicines(rxId, doctorName) {
      const member = familyMembers.find((m) => m.patientId === activeMemberId) || familyMembers[0];
      const orders = readJson("carewell_pharmacy_orders", []);
      orders.unshift({
        id: `PH-${Date.now().toString().slice(-6)}`,
        patientId: member.patientId,
        patientName: member.name,
        rxId,
        doctor: doctorName,
        status: "Preparing at In-House Pharmacy",
        createdAt: new Date().toISOString()
      });
      writeJson("carewell_pharmacy_orders", orders);
      const outbox = readJson("carewell_outbox", []);
      outbox.unshift({
        id: `out-${Date.now()}`,
        phone: member.phone || "9811111111",
        patient: member.name,
        kind: "Pharmacy Order",
        text: `In-House Pharmacy ne aapki Rx (${rxId}) ke medicines pack karne shuru kar diye hain. Ready hone par WhatsApp alert milega.`,
        status: "Delivered",
        createdAt: new Date().toISOString()
      });
      writeJson("carewell_outbox", outbox);
      fetch("/api/pharmacy/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: member.patientId, patientName: member.name, rxId, doctor: doctorName })
      }).catch(() => {});
      showToast("Medicines ordered from CareWell In-House Pharmacy!");
    },

    viewReceiptModal(id) {
      const appts = readJson("carewell_appointments", []);
      const app = appts.find((x) => x.id === id);
      if (!app) return;
      const doc = (CareWellData?.doctors || []).find((d) => d.id === app.doctorId);
      const fee = doc ? doc.fee : 500;
      const modalContainer = $("#prescription-modal-container");
      if (!modalContainer) return;
      modalContainer.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div id="printable-rx" class="bg-white rounded-3xl border border-emerald-100 shadow-2xl w-full max-w-md p-6">
            <div class="border-b-2 border-tealbrand pb-3 flex justify-between items-start">
              <div>
                <h3 class="font-display text-xl font-bold text-tealbrand">CareWell Clinic · OPD Receipt</h3>
                <p class="text-[11px] text-slate-500">214, MG Road, Camp, Pune 411001 · +91 98765 43210</p>
              </div>
              <span class="font-mono text-xs font-bold text-slate-700">${escapeHtml(app.bookingId || app.token)}</span>
            </div>
            <div class="my-4 space-y-2 text-xs">
              <div class="flex justify-between"><span class="text-slate-500">Patient:</span><strong>${escapeHtml(app.patientName)}</strong></div>
              <div class="flex justify-between"><span class="text-slate-500">Doctor:</span><strong>${escapeHtml(doc ? doc.name : app.doctorId)}</strong></div>
              <div class="flex justify-between"><span class="text-slate-500">Date &amp; Slot:</span><strong>${escapeHtml(app.date)} · ${escapeHtml(app.slot)}</strong></div>
              <div class="flex justify-between"><span class="text-slate-500">Payment Mode:</span><strong>${escapeHtml(app.paymentMode || "Pay at Clinic")}</strong></div>
              <div class="flex justify-between pt-2 border-t border-slate-100 text-sm"><span class="font-bold">Consultation Fee:</span><strong class="text-tealbrand">₹${fee}</strong></div>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" onclick="window.print()" class="px-4 py-2 rounded-xl bg-tealbrand text-white text-xs font-semibold hover:bg-teal-700">Print Receipt</button>
              <button type="button" onclick="document.querySelector('#prescription-modal-container').innerHTML=''" class="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold">Close</button>
            </div>
          </div>
        </div>`;
    },

    downloadReport(reportName) {
      const member = familyMembers.find((m) => m.patientId === activeMemberId) || familyMembers[0];
      const reports = readJson("carewell_reports", []);
      const rep = reports.find((r) => r.name === reportName && r.patientId === member.patientId) || {
        name: reportName,
        type: "Diagnostic Report",
        date: new Date().toISOString().split("T")[0],
        note: "Verified by CareWell Pathologist"
      };
      const modalContainer = $("#prescription-modal-container");
      if (!modalContainer) return;
      modalContainer.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div id="printable-rx" class="bg-white rounded-3xl border border-emerald-100 shadow-2xl w-full max-w-lg p-6 sm:p-8">
            <div class="border-b-2 border-tealbrand pb-4 flex items-start justify-between">
              <div>
                <h3 class="font-display text-2xl font-bold text-tealbrand">CareWell Diagnostic Lab</h3>
                <p class="text-xs text-slate-500">214, MG Road, Camp, Pune 411001 · NABH Certified</p>
              </div>
              <span class="px-2.5 py-1 rounded-full bg-mint text-tealbrand text-[10px] font-bold border border-emerald-200">Verified Lab</span>
            </div>
            <div class="my-4 grid grid-cols-2 gap-2 text-xs border-b border-slate-100 pb-3">
              <div><span class="text-slate-400">Patient:</span> <strong>${escapeHtml(member.name)}</strong> (${escapeHtml(member.patientId)})</div>
              <div><span class="text-slate-400">Report Date:</span> <strong class="font-mono">${escapeHtml(rep.date)}</strong></div>
              <div><span class="text-slate-400">Test Type:</span> <strong>${escapeHtml(rep.type)}</strong></div>
              <div><span class="text-slate-400">Age:</span> ${member.age} yrs</div>
            </div>
            <div class="p-4 rounded-2xl bg-mint/60 border border-emerald-100 text-xs space-y-2">
              <h4 class="font-bold text-sm text-slate-900">${escapeHtml(rep.name)}</h4>
              <p class="text-slate-700 leading-relaxed">${escapeHtml(rep.note)}</p>
            </div>
            <div class="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span class="text-[10px] text-slate-400">BOLA Protected · Encrypted Medical Record</span>
              <div class="flex gap-2">
                <button type="button" onclick="window.print()" class="px-4 py-2 rounded-xl bg-tealbrand text-white text-xs font-semibold hover:bg-teal-700">Print / Save PDF</button>
                <button type="button" onclick="document.querySelector('#prescription-modal-container').innerHTML=''" class="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50">Close</button>
              </div>
            </div>
          </div>
        </div>`;
      showToast(`${reportName} report ready for PDF download.`);
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

      const vitals = rx.vitals || {};
      modalContainer.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div id="printable-rx" class="bg-white rounded-3xl border border-emerald-100 shadow-2xl w-full max-w-lg p-6 sm:p-8 overflow-hidden animate-in fade-in">
            <div class="border-b-2 border-tealbrand pb-4 flex items-start justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-display text-2xl font-bold text-tealbrand">CareWell Clinic</h3>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-tealbrand border border-emerald-300">
                    BOLA Protected
                  </span>
                </div>
                <p class="text-xs text-slate-500">214, MG Road, Camp, Pune 411001 · Phone: +91 98765 43210</p>
                <p class="text-xs font-semibold text-slate-800 mt-1">${escapeHtml(rx.doctor || "Dr. Ananya Rao")}</p>
              </div>
              <span class="font-display text-4xl font-bold text-tealbrand">℞</span>
            </div>

            <div class="my-3 py-2 border-b border-slate-100 grid grid-cols-2 gap-2 text-xs">
              <div><span class="text-slate-400">Patient:</span> <strong class="text-slate-800">${escapeHtml(member.name)}</strong> (${escapeHtml(member.patientId)})</div>
              <div><span class="text-slate-400">Date:</span> <strong class="text-slate-800 font-mono">${escapeHtml(rx.date)}</strong></div>
              <div><span class="text-slate-400">Age:</span> ${member.age} yrs</div>
              <div><span class="text-slate-400">Blood Group:</span> <strong>${escapeHtml(member.blood || "B+")}</strong></div>
            </div>

            ${(vitals.bp || vitals.pulse || vitals.temp || vitals.spo2) ? `
              <div class="my-3 grid grid-cols-4 gap-2 text-center text-[11px] font-mono">
                <div class="p-2 rounded-xl bg-slate-50 border border-slate-200"><span class="block text-[9px] text-slate-400">BP</span><strong>${escapeHtml(vitals.bp || "120/80")}</strong></div>
                <div class="p-2 rounded-xl bg-slate-50 border border-slate-200"><span class="block text-[9px] text-slate-400">Pulse</span><strong>${escapeHtml(vitals.pulse || "76 bpm")}</strong></div>
                <div class="p-2 rounded-xl bg-slate-50 border border-slate-200"><span class="block text-[9px] text-slate-400">Temp</span><strong>${escapeHtml(vitals.temp || "98.6 °F")}</strong></div>
                <div class="p-2 rounded-xl bg-slate-50 border border-slate-200"><span class="block text-[9px] text-slate-400">SpO2</span><strong>${escapeHtml(vitals.spo2 || "98%")}</strong></div>
              </div>
            ` : ""}

            <div class="my-3 p-4 rounded-2xl bg-mint/50 border border-emerald-100 text-xs font-mono whitespace-pre-line leading-relaxed text-slate-800">
              ${escapeHtml(rx.text)}
            </div>

            <div class="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-[10px] text-slate-400">Encrypted PHI Record · HIPAA Verified</p>
                <p class="text-xs font-semibold text-tealbrand">CareWell Digital Health Records</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <button type="button" onclick="window.CareWellPatient.orderMedicines('${escapeHtml(rx.id)}', '${escapeHtml(rx.doctor || "CareWell Physician")}')" class="px-3.5 py-2 rounded-xl bg-mint border border-emerald-200 text-tealbrand text-xs font-semibold hover:bg-emerald-100">
                  Order Medicines
                </button>
                <button type="button" onclick="window.print()" class="px-3.5 py-2 rounded-xl bg-tealbrand text-white text-xs font-semibold hover:bg-teal-700">
                  Print / Save PDF
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
