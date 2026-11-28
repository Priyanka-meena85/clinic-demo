/**
 * CareWell Clinic - Doctor OPD Workspace Engine (doctor.js)
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

  let activeDoctorId = localStorage.getItem("carewell_doctor_auth_id") || "";

  function initDoctorApp() {
    populateDoctorSelect();
    bindAuth();
    if (activeDoctorId) {
      showWorkspace();
    } else {
      showLogin();
    }
  }

  function populateDoctorSelect() {
    const select = $("#doc-select-profile");
    if (!select) return;
    select.innerHTML = CareWellData.doctors.map((d) => `
      <option value="${d.id}" ${d.id === "ananya-rao" ? "selected" : ""}>
        ${escapeHtml(d.name)} (${escapeHtml(d.specialty)} · ${escapeHtml(d.location || "Pune")})
      </option>
    `).join("");
  }

  function bindAuth() {
    $("#form-doc-login")?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (window.CareWellSecurity && window.CareWellSecurity.isRateLimited("doctor-login")) {
        showToast("Security Lockout: Too many failed PIN attempts. Wait 15 min.");
        return;
      }
      const pin = ($("#doc-pin-input")?.value || "").trim();
      if (pin !== "1234") {
        if (window.CareWellSecurity) window.CareWellSecurity.recordFailedAttempt("doctor-login");
        showToast("Invalid Doctor PIN! Demo PIN is 1234.");
        return;
      }
      if (window.CareWellSecurity) window.CareWellSecurity.resetRateLimit("doctor-login");
      const sel = $("#doc-select-profile");
      activeDoctorId = sel ? sel.value : "ananya-rao";
      localStorage.removeItem("carewell_admin_auth");
      localStorage.removeItem("carewell_receptionist_auth");
      localStorage.removeItem("carewell_patient_auth");
      localStorage.setItem("carewell_doctor_auth_id", activeDoctorId);
      localStorage.setItem("carewell_session_exp", String(Date.now() + 8 * 3600 * 1000));
      if (window.CareWellApi) {
        window.CareWellApi.loginDoctor(activeDoctorId, pin).catch(() => {});
      }
      showWorkspace();
      showToast("Logged in to Doctor OPD Workspace!");
    });

    $("#btn-quick-login-rao")?.addEventListener("click", () => {
      activeDoctorId = "ananya-rao";
      localStorage.setItem("carewell_doctor_auth_id", activeDoctorId);
      showWorkspace();
      showToast("Welcome Dr. Ananya Rao!");
    });

    $("#btn-quick-login-shah")?.addEventListener("click", () => {
      activeDoctorId = "vikram-shah";
      localStorage.setItem("carewell_doctor_auth_id", activeDoctorId);
      showWorkspace();
      showToast("Welcome Dr. Vikram Shah!");
    });

    $("#btn-doc-logout")?.addEventListener("click", () => {
      activeDoctorId = "";
      localStorage.removeItem("carewell_doctor_auth_id");
      showLogin();
      showToast("Doctor logged out.");
    });

    $("#form-doc-rx")?.addEventListener("submit", (e) => {
      e.preventDefault();
      handleSaveRx();
    });

    const rxTemplates = {
      fever: {
        diagnosis: "Acute Viral Fever",
        meds: "1. Tab Paracetamol 650mg SOS / TDS x 3 days\n2. Tab Pantocid 40mg OD before breakfast\n3. ORS Hydration 2L/day",
        advice: "Rest, plenty of warm fluids. Review after 3 days if fever persists."
      },
      acidity: {
        diagnosis: "Acute Gastritis / Acidity",
        meds: "1. Cap Pantoprazole + Domperidone OD empty stomach x 5 days\n2. Syp Sucralfate 10ml before meals\n3. Avoid spicy/oily food",
        advice: "Eat small light meals on time. Drink lukewarm water."
      },
      bp: {
        diagnosis: "Essential Hypertension Follow-up",
        meds: "1. Tab Telmisartan 40mg OD morning\n2. Low sodium diet (<5g salt/day)\n3. Daily 30-min brisk walk",
        advice: "Monitor BP twice weekly. Repeat Lipid Profile in 3 months."
      },
      skin: {
        diagnosis: "Allergic Contact Dermatitis",
        meds: "1. Tab Levocetirizine 5mg HS x 5 days\n2. Mometasone Furoate 0.1% Cream BD thin layer\n3. Gentle fragrance-free moisturizer",
        advice: "Avoid harsh soaps and direct sun exposure."
      },
      child: {
        diagnosis: "Pediatric Upper Respiratory Infection",
        meds: "1. Syp Paracetamol 250mg/5ml — 5ml SOS for fever\n2. Saline Nasal Drops 2 drops each nostril TDS\n3. Warm fluids & steam inhalation",
        advice: "Bring vaccination card on next follow-up."
      }
    };

    $$("[data-rx-tpl]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tpl = rxTemplates[btn.dataset.rxTpl];
        if (!tpl) return;
        if ($("#rx-doc-diagnosis")) $("#rx-doc-diagnosis").value = tpl.diagnosis;
        if ($("#rx-doc-medicines")) $("#rx-doc-medicines").value = tpl.meds;
        if ($("#rx-doc-advice")) $("#rx-doc-advice").value = tpl.advice;
        showToast("Prescription template loaded.");
      });
    });
  }

  function showLogin() {
    $("#doc-login-view")?.classList.remove("hidden");
    $("#doc-workspace-view")?.classList.add("hidden");
    $("#btn-doc-logout")?.classList.add("hidden");
    $("#doc-active-badge")?.classList.add("hidden");
    refreshIcons();
  }

  function showWorkspace() {
    $("#doc-login-view")?.classList.add("hidden");
    $("#doc-workspace-view")?.classList.remove("hidden");
    $("#btn-doc-logout")?.classList.remove("hidden");
    $("#doc-active-badge")?.classList.remove("hidden");
    renderDoctorData();
    refreshIcons();
  }

  function renderDoctorData() {
    const doctor = CareWellData.doctors.find((d) => d.id === activeDoctorId) || CareWellData.doctors[0];
    const initials = doctor.name.replace(/^Dr\.\s*/i, "").split(/\s+/).map((p) => p[0]).join("");

    $("#doc-initials").textContent = initials;
    $("#doc-welcome-name").textContent = doctor.name;
    $("#doc-specialty-sub").textContent = `${doctor.specialty} · ${doctor.qualifications || "MBBS, MD"} · Consultation Fee: ₹${doctor.fee}`;
    $("#doc-room-tag").textContent = activeDoctorId === "vikram-shah" ? "OPD Room 2" : "OPD Room 1";

    // Queue & Active Patient
    const qState = readJson("carewell_queue_state", { doctorId: activeDoctorId, current: 8, yourToken: 12 });
    $("#doc-current-token-num").textContent = qState.current;

    // Load upcoming waiting list for THIS doctor only
    const allAppointments = readJson("carewell_appointments", []);
    const doctorAppointments = allAppointments.filter((a) => a.doctorId === activeDoctorId && a.status !== "cancelled");
    const waitingList = $("#doc-waiting-list");
    if (waitingList) {
      if (doctorAppointments.length === 0) {
        waitingList.innerHTML = `
          <div class="p-3 rounded-xl bg-slate-50 text-slate-500 text-center">
            Abhi is doctor ke liye koi patient waiting me nahi hai.
          </div>
        `;
      } else {
        waitingList.innerHTML = doctorAppointments.slice(0, 4).map((a, i) => `
          <div class="p-2.5 rounded-xl ${i === 0 ? "bg-emerald-50/80 border border-emerald-200" : "bg-slate-50 border border-slate-200"} flex items-center justify-between text-xs">
            <div>
              <span class="font-bold text-slate-800">Token ${escapeHtml(a.tokenNo || (qState.current + i + 1))}: ${escapeHtml(a.patientName)}</span>
              <span class="text-[11px] text-slate-500 block">${escapeHtml(a.reason || "OPD Checkup")}</span>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] ${i === 0 ? "bg-emerald-600 text-white font-bold" : "text-slate-500 font-mono"}">
              ${i === 0 ? "Next" : escapeHtml(a.slot || "11:30 AM")}
            </span>
          </div>
        `).join("");
      }
    }

    // Set Active Patient In Room details
    const activePatient = doctorAppointments[0] || {
      patientName: "Ritu Sharma",
      bookingId: "CW-2048",
      age: 28,
      phone: "9811111111",
      reason: "Viral Fever, mild headache (3 days)"
    };
    $("#curr-pat-name").textContent = activePatient.patientName;
    $("#curr-pat-id").textContent = activePatient.bookingId || "CW-2048";
    $("#curr-pat-demographics").textContent = `${activePatient.age || 28} yrs · ${activePatient.phone ? `+91 ${activePatient.phone}` : ""}`;
    $("#curr-pat-phone").textContent = activePatient.phone ? `+91 ${activePatient.phone}` : "+91 98111 11111";
    $("#curr-pat-problem").textContent = activePatient.reason || "General OPD consultation";
    $("#rx-doc-patient-name").value = `${activePatient.patientName} (${activePatient.bookingId || "CW-2048"})`;

    // Calculate this doctor's own personal earnings today
    const seenCount = doctorAppointments.length || 8;
    const personalEarnings = seenCount * (doctor.fee || 500);
    const dayStatsBox = document.querySelector("#doc-workspace-view .bg-mint .space-y-2");
    if (dayStatsBox) {
      dayStatsBox.innerHTML = `
        <div class="flex justify-between py-1 border-b border-emerald-200/60 text-xs">
          <span class="text-slate-600">My Patients Seen Today:</span>
          <span class="font-bold text-slate-900">${seenCount} Patients</span>
        </div>
        <div class="flex justify-between py-1 border-b border-emerald-200/60 text-xs">
          <span class="text-slate-600">My Consultation Fee Earnings:</span>
          <span class="font-bold text-tealbrand">₹${personalEarnings.toLocaleString("en-IN")}</span>
        </div>
        <div class="flex justify-between py-1 text-xs">
          <span class="text-slate-600">My Average Consult Time:</span>
          <span class="font-medium text-slate-900">7.5 mins</span>
        </div>
      `;
    }

    // Check if doctor has blocked tomorrow
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    const blocks = readJson("carewell_blocks", []);
    const isBlocked = blocks.some((b) => b.doctorId === activeDoctorId && b.date === tomorrow);
    const leaveBtn = $("#btn-doc-leave-status");
    if (leaveBtn) {
      leaveBtn.textContent = isBlocked ? "Leave Active (Mark Available)" : "Kal Main Nahi Hu (Mark Leave)";
    }
  }

  function handleSaveRx() {
    const doctor = CareWellData.doctors.find((d) => d.id === activeDoctorId) || CareWellData.doctors[0];
    const medicines = $("#rx-doc-medicines").value.trim();
    const advice = $("#rx-doc-advice").value.trim();
    const diagnosis = $("#rx-doc-diagnosis").value.trim();

    if (!medicines) {
      showToast("Please enter prescribed medicines.");
      return;
    }

    const fullRxText = `${diagnosis ? `Diagnosis: ${diagnosis}\n\n` : ""}Medicines:\n${medicines}\n\nLab Tests: ${$("#rx-lab-tests")?.value || "None"}\nAdvice: ${advice}`;
    const vitals = {
      bp: $("#rx-vitals-bp")?.value.trim() || "120/80 mmHg",
      pulse: $("#rx-vitals-pulse")?.value.trim() || "76 bpm",
      temp: $("#rx-vitals-temp")?.value.trim() || "98.6 °F",
      spo2: $("#rx-vitals-spo2")?.value.trim() || "98%"
    };

    const rxList = readJson("carewell_prescriptions", []);
    rxList.unshift({
      id: `rx-${Date.now()}`,
      patientId: "CW-2048",
      date: new Date().toISOString().split("T")[0],
      doctor: doctor.name,
      vitals,
      text: fullRxText
    });
    writeJson("carewell_prescriptions", rxList);

    // Send automated WhatsApp alert
    const outbox = readJson("carewell_outbox", []);
    outbox.unshift({
      id: `out-${Date.now()}`,
      phone: "9811111111",
      patient: "Riya Sharma",
      kind: "Prescription",
      text: `${doctor.name} ne aapka digital prescription OPD portal me upload kar diya hai. Download karein: index.html#portal`,
      status: "Delivered",
      createdAt: new Date().toISOString()
    });
    writeJson("carewell_outbox", outbox);

    showToast("Prescription generated & sent to patient's WhatsApp & Portal!");
    $("#rx-doc-medicines").value = "";
  }

  // Public Doctor Actions
  window.CareWellDoctor = {
    callNextPatient() {
      const qState = readJson("carewell_queue_state", { doctorId: activeDoctorId, current: 8, yourToken: 12 });
      qState.current += 1;
      writeJson("carewell_queue_state", qState);
      const doc = CareWellData.doctors.find((d) => d.id === activeDoctorId) || CareWellData.doctors[0];
      if ("speechSynthesis" in window) {
        try {
          const u = new SpeechSynthesisUtterance(`Token number ${qState.current}, ${doc.name} ke paas aaiye.`);
          u.lang = "hi-IN";
          window.speechSynthesis.speak(u);
        } catch (e) {}
      }
      showToast(`Token ${qState.current} called into OPD Room!`);
      renderDoctorData();
    },

    markConsultDone() {
      const outbox = readJson("carewell_outbox", []);
      outbox.unshift({
        id: `out-${Date.now()}`,
        phone: "9811111111",
        patient: $("#curr-pat-name")?.textContent || "Patient",
        kind: "Google Review Auto-Ask",
        text: "CareWell Clinic visit kaisa raha? 5-star review dein: https://g.page/r/carewell-pune/review",
        status: "Queued (1 hr post-visit)",
        createdAt: new Date().toISOString()
      });
      writeJson("carewell_outbox", outbox);
      showToast("Consultation done! 1-hr Google Review auto-ask queued.");
      window.CareWellDoctor.callNextPatient();
    },

    viewCurrentPatientHistory() {
      const modal = $("#doctor-modal-container");
      if (!modal) return;
      const visits = readJson("carewell_visits", []).filter((v) => v.patientId === "CW-2048");
      const reports = readJson("carewell_reports", []).filter((r) => r.patientId === "CW-2048");
      modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div class="bg-white rounded-3xl border border-emerald-100 shadow-2xl w-full max-w-lg p-6 sm:p-7">
            <div class="flex items-center justify-between border-b border-emerald-100 pb-3">
              <div>
                <h3 class="font-display text-lg font-bold text-slate-900">Patient Clinical History (CW-2048)</h3>
                <p class="text-xs text-slate-500">Previous OPD visits and lab diagnostics</p>
              </div>
              <button type="button" onclick="document.querySelector('#doctor-modal-container').innerHTML=''" class="h-9 w-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100">×</button>
            </div>
            <div class="mt-4 space-y-4 text-xs max-h-[60vh] overflow-y-auto">
              <div>
                <h4 class="font-bold text-tealbrand uppercase tracking-wider text-[11px] mb-2">Recent Visits</h4>
                <div class="space-y-1.5">
                  ${visits.map((v) => `<div class="p-2.5 rounded-xl bg-mint/60 border border-emerald-100 flex justify-between"><span class="font-semibold text-slate-800">${escapeHtml(v.label)}</span><span class="font-mono text-slate-500">${escapeHtml(v.date)}</span></div>`).join("") || "<p class='text-slate-400'>No prior visits</p>"}
                </div>
              </div>
              <div>
                <h4 class="font-bold text-tealbrand uppercase tracking-wider text-[11px] mb-2">Lab &amp; Diagnostic Reports</h4>
                <div class="space-y-1.5">
                  ${reports.map((r) => `<div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200"><div class="flex justify-between font-semibold text-slate-900"><span>${escapeHtml(r.name)} (${escapeHtml(r.type)})</span><span class="font-mono text-slate-500">${escapeHtml(r.date)}</span></div><p class="text-slate-600 mt-0.5">${escapeHtml(r.note)}</p></div>`).join("") || "<p class='text-slate-400'>No lab reports</p>"}
                </div>
              </div>
            </div>
          </div>
        </div>`;
    },

    toggleLeave() {
      const dateInput = $("#doc-leave-date");
      const targetDate = (dateInput && dateInput.value) || new Date(Date.now() + 86400000).toISOString().split("T")[0];
      if (dateInput && !dateInput.value) dateInput.value = targetDate;
      const blocks = readJson("carewell_blocks", []);
      const idx = blocks.findIndex((b) => b.doctorId === activeDoctorId && b.date === targetDate);
      if (idx >= 0) {
        blocks.splice(idx, 1);
        showToast(`Leave cancelled for ${targetDate}. Slots open!`);
      } else {
        blocks.push({ doctorId: activeDoctorId, date: targetDate, slot: "" });
        const affected = readJson("carewell_appointments", []).filter((a) => a.doctorId === activeDoctorId && a.date === targetDate && a.status !== "cancelled");
        const outbox = readJson("carewell_outbox", []);
        affected.forEach((a) => {
          outbox.unshift({
            id: `out-${Date.now()}-${a.id}`,
            phone: a.phone,
            patient: a.patientName,
            kind: "Smart Leave Alert",
            text: `Doctor ${targetDate} ko unavailable hain. Kripya apna slot reschedule karein.`,
            status: "Delivered",
            createdAt: new Date().toISOString()
          });
        });
        writeJson("carewell_outbox", outbox);
        showToast(`Leave set for ${targetDate}! ${affected.length} patient(s) notified on WhatsApp.`);
      }
      writeJson("carewell_blocks", blocks);
      renderDoctorData();
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    initDoctorApp();
    let idleTimer;
    const resetIdle = () => {
      clearTimeout(idleTimer);
      if (activeDoctorId) {
        idleTimer = setTimeout(() => {
          localStorage.removeItem("carewell_doctor_auth_id");
          showToast("Auto-logged out after 5 min inactivity for patient privacy.");
          showLogin();
        }, 5 * 60 * 1000);
      }
    };
    ["mousemove", "keydown", "click"].forEach((ev) => document.addEventListener(ev, resetIdle));
    resetIdle();
  });
})();
