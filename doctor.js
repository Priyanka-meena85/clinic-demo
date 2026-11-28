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
      const pin = ($("#doc-pin-input")?.value || "").trim();
      if (pin !== "1234") {
        showToast("Invalid Doctor PIN! Demo PIN is 1234.");
        return;
      }
      const sel = $("#doc-select-profile");
      activeDoctorId = sel ? sel.value : "ananya-rao";
      localStorage.setItem("carewell_doctor_auth_id", activeDoctorId);
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
      leaveBtn.textContent = isBlocked ? "✅ Leave Active (Mark Available)" : "⛔ Kal Main Nahi Hu (Mark Leave)";
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

    const fullRxText = `${diagnosis ? `Diagnosis: ${diagnosis}\n\n` : ""}Medicines:\n${medicines}\n\nAdvice: ${advice}`;

    const rxList = readJson("carewell_prescriptions", []);
    rxList.unshift({
      id: `rx-${Date.now()}`,
      patientId: "CW-2048",
      date: new Date().toISOString().split("T")[0],
      doctor: doctor.name,
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
      showToast(`Token ${qState.current} called into OPD Room!`);
      renderDoctorData();
    },

    markConsultDone() {
      showToast("Consultation marked completed.");
      window.CareWellDoctor.callNextPatient();
    },

    viewCurrentPatientHistory() {
      alert("Patient History (CW-2048):\n• 12 Nov: Fever Checkup (Dr. Ananya Rao)\n• 10 Nov: Chest X-Ray (Normal)\n• 05 Nov: Routine Checkup");
    },

    toggleLeave() {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const blocks = readJson("carewell_blocks", []);
      const idx = blocks.findIndex((b) => b.doctorId === activeDoctorId && b.date === tomorrow);
      if (idx >= 0) {
        blocks.splice(idx, 1);
        showToast("Leave cancelled. Tomorrow slots are now open!");
      } else {
        blocks.push({ doctorId: activeDoctorId, date: tomorrow, slot: "" });
        showToast("Leave marked: 'Kal main nahi hu' activated for tomorrow!");
      }
      writeJson("carewell_blocks", blocks);
      renderDoctorData();
    }
  };

  document.addEventListener("DOMContentLoaded", initDoctorApp);
})();
