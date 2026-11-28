/**
 * CareWell Clinic - Receptionist Front Desk Engine (receptionist.js)
 */
(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

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

  let isRecLoggedIn = localStorage.getItem("carewell_receptionist_auth") === "true";

  function initReceptionist() {
    bindAuth();
    if (isRecLoggedIn) showWorkspace();
    else showLogin();
  }

  function bindAuth() {
    $("#form-rec-login")?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (window.CareWellSecurity && window.CareWellSecurity.isRateLimited("rec-login")) {
        showToast("Security Lockout: Too many failed PIN attempts. Wait 15 min.");
        return;
      }
      const user = ($("#rec-username")?.value || "").trim();
      const pin = ($("#rec-pin")?.value || "").trim();
      if (user !== "reception@carewell" || pin !== "1234") {
        if (window.CareWellSecurity) window.CareWellSecurity.recordFailedAttempt("rec-login");
        showToast("Invalid Receptionist credentials! Demo: reception@carewell / 1234");
        return;
      }
      if (window.CareWellSecurity) window.CareWellSecurity.resetRateLimit("rec-login");
      isRecLoggedIn = true;
      localStorage.removeItem("carewell_admin_auth");
      localStorage.removeItem("carewell_doctor_auth_id");
      localStorage.removeItem("carewell_patient_auth");
      localStorage.setItem("carewell_receptionist_auth", "true");
      localStorage.setItem("carewell_session_exp", String(Date.now() + 8 * 3600 * 1000));
      showWorkspace();
      showToast("Welcome to CareWell Front Desk!");
    });

    $("#btn-quick-rec-login")?.addEventListener("click", () => {
      isRecLoggedIn = true;
      localStorage.removeItem("carewell_admin_auth");
      localStorage.removeItem("carewell_doctor_auth_id");
      localStorage.removeItem("carewell_patient_auth");
      localStorage.setItem("carewell_receptionist_auth", "true");
      localStorage.setItem("carewell_session_exp", String(Date.now() + 8 * 3600 * 1000));
      showWorkspace();
      showToast("Logged in as Front Desk Receptionist!");
    });

    $("#btn-rec-logout")?.addEventListener("click", () => {
      isRecLoggedIn = false;
      localStorage.removeItem("carewell_receptionist_auth");
      showLogin();
      showToast("Logged out from Receptionist Desk.");
    });

    $("#rec-search")?.addEventListener("input", renderTable);

    $("#btn-rec-walkin")?.addEventListener("click", openWalkinModal);

    $("#btn-rec-emergency")?.addEventListener("click", () => {
      const name = window.prompt("Priority Patient Name (Emergency / Senior Citizen / Pregnant):");
      if (!name || name.trim().length < 2) return;
      const category = window.prompt("Priority Type (Emergency / Senior Citizen / Pregnant):", "Emergency") || "Emergency";
      const appts = readJson("carewell_appointments", []);
      const today = new Date().toISOString().split("T")[0];
      const bookingId = `CW-EMG-${String(100 + (Date.now() % 899))}`;
      appts.unshift({
        id: `cw-emg-${Date.now()}`,
        bookingId,
        tokenNo: "P1",
        token: bookingId,
        patientName: name.trim(),
        phone: "9876543210",
        doctorId: "ananya-rao",
        date: today,
        slot: "IMMEDIATE",
        visitType: category.trim(),
        isPriority: true,
        priorityLabel: category.trim().toUpperCase(),
        paymentMode: "Pay at Clinic",
        status: "checked-in",
        createdAt: new Date().toISOString()
      });
      writeJson("carewell_appointments", appts);
      renderWorkspaceData();
      showToast(`RED Priority Token (${category}) issued for ${name.trim()} — moved to top of queue!`);
    });

    $("#btn-rec-next-queue")?.addEventListener("click", () => {
      const qs = readJson("carewell_queue_state", { doctorId: "ananya-rao", current: 8, yourToken: 12, avgMinsPerPatient: 7.5 });
      qs.current += 1;
      writeJson("carewell_queue_state", qs);
      if ("speechSynthesis" in window) {
        try {
          const u = new SpeechSynthesisUtterance(`Token number ${qs.current}, Doctor ke room mein aaiye.`);
          u.lang = "hi-IN";
          window.speechSynthesis.speak(u);
        } catch (e) {}
      }
      showToast(`Live Queue advanced to Token #${qs.current} (Hindi Voice Announced)`);
      renderWorkspaceData();
    });
  }

  function showLogin() {
    $("#rec-login-view")?.classList.remove("hidden");
    $("#rec-workspace-view")?.classList.add("hidden");
    $("#btn-rec-logout")?.classList.add("hidden");
  }

  function showWorkspace() {
    $("#rec-login-view")?.classList.add("hidden");
    $("#rec-workspace-view")?.classList.remove("hidden");
    $("#btn-rec-logout")?.classList.remove("hidden");
    renderWorkspaceData();
  }

  function renderWorkspaceData() {
    const qs = readJson("carewell_queue_state", { current: 8 });
    const appts = readJson("carewell_appointments", []);
    const waiting = appts.filter((a) => a.status === "confirmed" || a.status === "booked").length;
    const checkedIn = appts.filter((a) => a.status === "checked-in").length;
    const done = appts.filter((a) => a.status === "done").length;
    const noshow = appts.filter((a) => a.status === "noshow").length;

    if ($("#rec-kpi-token")) $("#rec-kpi-token").textContent = `Token ${qs.current}`;
    if ($("#rec-kpi-waiting")) $("#rec-kpi-waiting").textContent = String(waiting);
    if ($("#rec-kpi-checkedin")) $("#rec-kpi-checkedin").textContent = String(checkedIn);
    if ($("#rec-kpi-done")) $("#rec-kpi-done").textContent = `${done} / ${noshow}`;

    renderTable();
  }

  function renderTable() {
    const wrap = $("#rec-table-wrap");
    if (!wrap) return;
    const query = ($("#rec-search")?.value || "").trim().toLowerCase();
    const appts = readJson("carewell_appointments", []).filter((a) => {
      if (!query) return true;
      return `${a.patientName} ${a.phone} ${a.bookingId} ${a.tokenNo}`.toLowerCase().includes(query);
    }).sort((a, b) => (b.isPriority ? 1 : 0) - (a.isPriority ? 1 : 0));

    if (!appts.length) {
      wrap.innerHTML = `<p class="text-xs text-slate-500 py-6 text-center">No matching appointments found.</p>`;
      return;
    }

    wrap.innerHTML = `
      <table class="w-full text-left text-xs">
        <thead class="bg-slate-50 text-slate-700 font-semibold border-b border-emerald-100">
          <tr>
            <th class="p-3">Token / ID</th>
            <th class="p-3">Patient</th>
            <th class="p-3">Doctor &amp; Slot</th>
            <th class="p-3">Triage Vitals</th>
            <th class="p-3">Status</th>
            <th class="p-3 text-right">Desk Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-emerald-50">
          ${appts.map((a) => {
            const doc = (CareWellData?.doctors || []).find((d) => d.id === a.doctorId);
            return `
              <tr class="hover:bg-mint/30 transition">
                <td class="p-3 font-mono font-bold ${a.isPriority ? "text-red-600" : "text-tealbrand"}">
                  #${escapeHtml(a.tokenNo || "—")} ${a.isPriority ? `<span class="ml-1 px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px]">${escapeHtml(a.priorityLabel || "PRIORITY")}</span>` : ""}<br>
                  <span class="text-[10px] font-normal text-slate-500">${escapeHtml(a.bookingId || a.token)}</span>
                </td>
                <td class="p-3">
                  <span class="font-semibold text-slate-900">${escapeHtml(a.patientName)}</span><br>
                  <span class="text-[11px] text-slate-500">+91 ${escapeHtml(a.phone)}</span>
                </td>
                <td class="p-3">
                  <span class="font-medium text-slate-800">${escapeHtml(doc ? doc.name : a.doctorId)}</span><br>
                  <span class="text-[11px] text-slate-500">${escapeHtml(a.date)} · ${escapeHtml(a.slot)}</span>
                </td>
                <td class="p-3 text-[11px] font-mono text-slate-600">
                  ${a.triageVitals ? escapeHtml(a.triageVitals) : "<span class='text-slate-400'>Not recorded</span>"}
                </td>
                <td class="p-3">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    a.status === "checked-in" ? "bg-tealbrand text-white" :
                    a.status === "confirmed" ? "bg-emerald-100 text-tealbrand" :
                    a.status === "done" ? "bg-blue-100 text-blue-700" :
                    a.status === "noshow" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-600"
                  }">${escapeHtml(a.status || "confirmed")}</span>
                </td>
                <td class="p-3 text-right space-x-1 whitespace-nowrap">
                  <button type="button" onclick="window.CareWellReception.checkIn('${escapeHtml(a.id)}')" class="px-2.5 py-1 rounded-lg bg-tealbrand text-white text-[11px] font-semibold hover:bg-teal-700">Check-in</button>
                  <button type="button" onclick="window.CareWellReception.openReceipt('${escapeHtml(a.id)}')" class="px-2.5 py-1 rounded-lg border border-emerald-200 bg-mint text-tealbrand text-[11px] font-semibold hover:bg-emerald-100">Token Slip / Receipt</button>
                  <button type="button" onclick="window.CareWellReception.markNoShow('${escapeHtml(a.id)}')" class="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-medium hover:bg-amber-100">No-Show</button>
                </td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>`;
  }

  function openWalkinModal() {
    const doctors = CareWellData?.doctors || [];
    const container = $("#rec-modal-container");
    if (!container) return;
    container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div class="bg-white rounded-3xl border border-emerald-100 shadow-2xl w-full max-w-md p-6">
          <div class="flex items-center justify-between border-b border-emerald-100 pb-3">
            <h3 class="font-display text-lg font-bold text-slate-900">Issue Walk-in Token</h3>
            <button type="button" onclick="document.querySelector('#rec-modal-container').innerHTML=''" class="text-slate-400 hover:text-slate-700">✕</button>
          </div>
          <form id="form-rec-walkin" class="mt-4 space-y-3 text-xs">
            <div>
              <label for="rec-wi-name" class="font-semibold text-slate-700 block mb-1">Patient Name</label>
              <input id="rec-wi-name" type="text" required placeholder="e.g. Rohan Deshmukh" class="h-10 w-full px-3 rounded-xl border border-emerald-200 outline-none">
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label for="rec-wi-phone" class="font-semibold text-slate-700 block mb-1">Mobile (10 Digits)</label>
                <input id="rec-wi-phone" type="tel" maxlength="10" required placeholder="98XXXXXXXX" class="h-10 w-full px-3 rounded-xl border border-emerald-200 outline-none font-mono">
              </div>
              <div>
                <label for="rec-wi-vitals" class="font-semibold text-slate-700 block mb-1">Triage BP / Temp</label>
                <input id="rec-wi-vitals" type="text" placeholder="120/80 · 98.6°F" value="120/80 · 98.6°F" class="h-10 w-full px-3 rounded-xl border border-emerald-200 outline-none font-mono">
              </div>
            </div>
            <div>
              <label for="rec-wi-doc" class="font-semibold text-slate-700 block mb-1">Doctor</label>
              <select id="rec-wi-doc" class="h-10 w-full px-3 rounded-xl border border-emerald-200 bg-white outline-none">
                ${doctors.map((d) => `<option value="${d.id}">${escapeHtml(d.name)} (${escapeHtml(d.specialty)} · ₹${d.fee})</option>`).join("")}
              </select>
            </div>
            <button type="submit" class="w-full h-11 rounded-xl bg-tealbrand text-white font-semibold hover:bg-teal-700">Generate Token &amp; Check-in</button>
          </form>
        </div>
      </div>`;

    $("#form-rec-walkin")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = ($("#rec-wi-name")?.value || "").trim();
      const phone = ($("#rec-wi-phone")?.value || "").replace(/\D/g, "").slice(0, 10);
      const vitals = ($("#rec-wi-vitals")?.value || "").trim();
      const doctorId = $("#rec-wi-doc")?.value || "ananya-rao";
      if (name.length < 2 || phone.length !== 10) {
        showToast("Enter valid patient name and 10-digit mobile.");
        return;
      }
      const today = new Date().toISOString().split("T")[0];
      const appts = readJson("carewell_appointments", []);
      const used = appts.filter((a) => a.doctorId === doctorId && a.date === today && a.status !== "cancelled").map((a) => Number(a.tokenNo) || 0);
      const tokenNo = Math.max(8, ...used, 0) + 1;
      const bookingId = `CW-${String(2000 + (Date.now() % 7000)).padStart(4, "0")}`;
      appts.push({
        id: `cw-wi-${Date.now()}`,
        bookingId,
        tokenNo,
        token: bookingId,
        patientName: name,
        phone,
        doctorId,
        date: today,
        slot: "Walk-in",
        visitType: "Walk-in",
        triageVitals: vitals,
        paymentMode: "Pay at Clinic",
        status: "checked-in",
        createdAt: new Date().toISOString()
      });
      writeJson("carewell_appointments", appts);
      container.innerHTML = "";
      renderWorkspaceData();
      showToast(`Walk-in Token #${tokenNo} (${bookingId}) checked in!`);
    });
  }

  window.CareWellReception = {
    checkIn(id) {
      const vitals = window.prompt("Record Triage Vitals (BP · Temp):", "120/80 mmHg · 98.6 °F");
      const appts = readJson("carewell_appointments", []);
      const row = appts.find((a) => a.id === id);
      if (row) {
        row.status = "checked-in";
        if (vitals) row.triageVitals = vitals.trim();
        writeJson("carewell_appointments", appts);
        renderWorkspaceData();
        showToast(`${row.patientName} checked in!`);
      }
    },
    markNoShow(id) {
      const appts = readJson("carewell_appointments", []);
      const row = appts.find((a) => a.id === id);
      if (row) {
        row.status = "noshow";
        writeJson("carewell_appointments", appts);
        renderWorkspaceData();
        showToast(`${row.patientName} marked No-Show.`);
      }
    },
    openReceipt(id) {
      const appts = readJson("carewell_appointments", []);
      const row = appts.find((a) => a.id === id);
      if (!row) return;
      const doc = (CareWellData?.doctors || []).find((d) => d.id === row.doctorId);
      const fee = doc ? doc.fee : 500;
      const container = $("#rec-modal-container");
      if (!container) return;
      container.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div id="printable-rx" class="bg-white rounded-3xl border border-emerald-100 shadow-2xl w-full max-w-md p-6">
            <div class="border-b-2 border-tealbrand pb-3 flex justify-between items-start">
              <div>
                <h3 class="font-display text-xl font-bold text-tealbrand">CareWell Clinic · Receipt</h3>
                <p class="text-[11px] text-slate-500">214, MG Road, Camp, Pune 411001</p>
              </div>
              <span class="font-mono text-xs font-bold text-slate-700">${escapeHtml(row.bookingId || row.token)}</span>
            </div>
            <div class="my-4 space-y-2 text-xs">
              <div class="flex justify-between"><span class="text-slate-500">Patient:</span><strong>${escapeHtml(row.patientName)}</strong></div>
              <div class="flex justify-between"><span class="text-slate-500">Doctor:</span><strong>${escapeHtml(doc ? doc.name : row.doctorId)}</strong></div>
              <div class="flex justify-between"><span class="text-slate-500">Token / Slot:</span><strong>#${escapeHtml(row.tokenNo || "—")} · ${escapeHtml(row.slot)}</strong></div>
              <div class="flex justify-between"><span class="text-slate-500">Payment Mode:</span><strong>${escapeHtml(row.paymentMode || "Pay at Clinic")}</strong></div>
              <div class="flex justify-between pt-2 border-t border-slate-100 text-sm"><span class="font-bold">Consultation Fee:</span><strong class="text-tealbrand">₹${fee}</strong></div>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" onclick="window.print()" class="px-4 py-2 rounded-xl bg-tealbrand text-white text-xs font-semibold hover:bg-teal-700">Print Receipt</button>
              <button type="button" onclick="document.querySelector('#rec-modal-container').innerHTML=''" class="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold">Close</button>
            </div>
          </div>
        </div>`;
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    initReceptionist();
    let idleTimer;
    const resetIdle = () => {
      clearTimeout(idleTimer);
      if (isRecLoggedIn) {
        idleTimer = setTimeout(() => {
          localStorage.removeItem("carewell_receptionist_auth");
          showToast("Front Desk auto-logged out after 5 min inactivity.");
          showLogin();
        }, 5 * 60 * 1000);
      }
    };
    ["mousemove", "keydown", "click"].forEach((ev) => document.addEventListener(ev, resetIdle));
    resetIdle();
  });
})();
