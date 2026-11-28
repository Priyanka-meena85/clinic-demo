/**
 * CareWell Clinic - Full System Engine (system.js)
 * Implements:
 * 1. Live Token / Queue System (No 2-hour wait, live tracking, 15-min WhatsApp alerts)
 * 2. WhatsApp Automation (1-Confirm, 2-Cancel, Auto-booking chat, Reminders, Outbox)
 * 3. AI Calling System (100% Missed Call Recovery, Interactive Voice Agent, Auto-booking)
 * 4. Patient Portal (Phone+OTP, CW-2048, Family Profile Switcher, Prescriptions PDF, Reports, Visit Timeline)
 * 5. Admin Dashboard / Clinic Desk (Today's Bookings, No-Show 3%, Appointments Manager, Patients Manager with Add Rx & Upload Report, Doctors Manager, Follow-up System, Reports & Analytics, Slot Control)
 */

(function () {
  "use strict";

  // Shared Helper Utilities
  const $s = (selector) => document.querySelector(selector);
  const $$s = (selector) => document.querySelectorAll(selector);

  function sEscapeHtml(val) {
    return String(val ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sReadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function sWriteJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function sRefreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  function sShowToast(msg) {
    if (typeof showToast === "function") {
      showToast(msg);
    } else {
      const toast = $s("#toast");
      if (toast) {
        toast.textContent = msg;
        toast.classList.remove("hidden");
        clearTimeout(sShowToast.timer);
        sShowToast.timer = setTimeout(() => toast.classList.add("hidden"), 3200);
      }
    }
  }

  // --- SEEDING SYSTEM DATA ---
  function initSystemStorage() {
    // 1. Prescriptions
    if (!localStorage.getItem("carewell_prescriptions")) {
      sWriteJson("carewell_prescriptions", CareWellData.records?.prescriptions || []);
    }
    // 2. Reports
    if (!localStorage.getItem("carewell_reports")) {
      sWriteJson("carewell_reports", CareWellData.records?.reports || []);
    }
    // 3. Visits
    if (!localStorage.getItem("carewell_visits")) {
      sWriteJson("carewell_visits", CareWellData.records?.visits || []);
    }
    // 4. Follow-ups
    if (!localStorage.getItem("carewell_followups")) {
      sWriteJson("carewell_followups", CareWellData.records?.followups || []);
    }
    // 5. Missed Calls
    if (!localStorage.getItem("carewell_calls")) {
      sWriteJson("carewell_calls", CareWellData.records?.calls || []);
    }
    // 6. Queue State
    if (!localStorage.getItem("carewell_queue_state")) {
      sWriteJson("carewell_queue_state", {
        doctorId: "ananya-rao",
        current: 8,
        yourToken: 12,
        avgMinsPerPatient: 7.5
      });
    }
    // 7. WhatsApp Simulator Chat
    if (!localStorage.getItem("carewell_wa_chat")) {
      sWriteJson("carewell_wa_chat", [
        {
          sender: "bot",
          time: "10:30 AM",
          text: "Namaste Riya ji! Kal 11:30 AM Dr. Ananya Rao ke paas aapka appointment schedule hai.\nToken No: 12 (Booking ID: CW-2048).\n\nReply karein:\n1️⃣ Confirm karne ke liye\n2️⃣ Cancel karne ke liye"
        }
      ]);
    }
    // 8. Outbox initial
    if (!localStorage.getItem("carewell_outbox")) {
      sWriteJson("carewell_outbox", [
        {
          id: "out-101",
          phone: "9811111111",
          patient: "Riya Sharma",
          kind: "1 Din Pehle Reminder",
          text: "Kal 11:30 AM Dr. Ananya Rao ke paas appointment hai. Token No. 12. Confirm: 1, Cancel: 2.",
          status: "Delivered",
          createdAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: "out-102",
          phone: "9811111111",
          patient: "Suresh Sharma",
          kind: "Follow-up",
          text: "Namaste Suresh ji, aapke BP checkup ko 6 mahine ho gaye hain. Dr. Vikram Shah ke paas slot book karne ke liye reply karein.",
          status: "Read",
          createdAt: new Date(Date.now() - 86400000).toISOString()
        }
      ]);
    }
  }

  // Active Admin Subtab state
  let currentAdminTab = "dashboard";
  // Active Portal Family Member state
  let currentPortalMemberId = "CW-2048";
  // Portal logged-in state
  let portalLoggedIn = true; // default demo logged in as Riya Sharma

  // -------------------------------------------------------------
  // 1. LIVE QUEUE & TOKEN SYSTEM (#queue-panel)
  // -------------------------------------------------------------
  function renderQueuePanel() {
    const container = $s("#queue-panel");
    if (!container) return;

    const qState = sReadJson("carewell_queue_state", {
      doctorId: "ananya-rao",
      current: 8,
      yourToken: 12,
      avgMinsPerPatient: 7.5
    });

    const doctor = CareWellData.doctors.find((d) => d.id === qState.doctorId) || CareWellData.doctors[0];
    const diff = Math.max(0, qState.yourToken - qState.current);
    const estMinutes = Math.round(diff * qState.avgMinsPerPatient);

    let waitMessage = "";
    let waitBadgeColor = "bg-emerald-100 text-tealbrand border-emerald-300";
    if (diff === 0) {
      waitMessage = "Abhi aapka number hai! Seedha Doctor ke room mein aaiye.";
      waitBadgeColor = "bg-amber-100 text-amber-900 border-amber-300 animate-pulse";
    } else if (diff === 1) {
      waitMessage = "Aapka number next hai! Doctor room ke bahar wait karein (Approx 5-7 min).";
      waitBadgeColor = "bg-orange-100 text-orange-800 border-orange-300";
    } else {
      waitMessage = `${estMinutes} Min Baad Aaiye (Ghar se aao, seedha andar jao - 2 ghante wait nahi!)`;
    }

    container.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <!-- Main Token Status Card -->
        <div class="lg:col-span-2 bg-white rounded-3xl border border-emerald-100 p-6 sm:p-8 shadow-sm">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-100 pb-5">
            <div>
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-tealbrand border border-emerald-200">
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Live Queue Active
              </span>
              <h3 class="text-xl font-display text-slate-900 mt-2">${sEscapeHtml(doctor.name)} · OPD Room 1</h3>
              <p class="text-xs text-slate-500">${sEscapeHtml(doctor.specialty)} · ${sEscapeHtml(doctor.timing || "Monday to Saturday")}</p>
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-600 block mb-1">Doctor badlein</label>
              <select id="queue-doctor-select" class="h-10 px-3 text-sm rounded-xl border border-emerald-200 bg-white outline-none">
                ${CareWellData.doctors.map((d) => `<option value="${d.id}" ${d.id === qState.doctorId ? "selected" : ""}>${sEscapeHtml(d.name)} (${sEscapeHtml(d.specialty)})</option>`).join("")}
              </select>
            </div>
          </div>

          <!-- Tokens Display Grid -->
          <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="bg-gradient-to-br from-emerald-500 to-tealbrand rounded-2xl p-5 text-white flex flex-col justify-between shadow-sm">
              <div>
                <p class="text-xs font-medium text-emerald-100 uppercase tracking-wider">Abhi chal raha hai</p>
                <div class="flex items-baseline gap-2 mt-2">
                  <span class="text-5xl font-display font-bold">Token ${qState.current}</span>
                </div>
              </div>
              <p class="text-xs text-emerald-100/90 mt-4 flex items-center gap-1">
                <span class="icon icon-user text-emerald-600"></span> Doctor checkup in progress
              </p>
            </div>

            <div class="bg-mint rounded-2xl p-5 border border-emerald-200 flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between">
                  <p class="text-xs font-semibold text-tealbrand uppercase tracking-wider">Aapka Token</p>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-white border border-emerald-200 text-slate-600 font-mono">CW-2048</span>
                </div>
                <div class="flex items-baseline gap-2 mt-2">
                  <span class="text-5xl font-display font-bold text-slate-900">Token ${qState.yourToken}</span>
                </div>
              </div>
              <div class="mt-4 flex items-center justify-between text-xs text-slate-600">
                <span>Aapse aage: <strong>${diff} patients</strong></span>
                <span class="font-medium text-tealbrand">15 min pehle alert</span>
              </div>
            </div>
          </div>

          <!-- Estimated Waiting & Alert Box -->
          <div class="mt-5 p-4 rounded-2xl border ${waitBadgeColor} flex items-start gap-3">
            <span class="p-2 rounded-xl bg-white/80 shrink-0 text-tealbrand">
              <span class="icon icon-clock"></span>
            </span>
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider">Kitni der mein number aayega</p>
              <p class="text-sm sm:text-base font-semibold mt-0.5">${waitMessage}</p>
              <p class="text-xs text-slate-600 mt-1">
                <span class="icon icon-radio text-emerald-600"></span>
                Number aane se <strong>15 minute pehle WhatsApp message</strong> auto bhej diya jayega!
              </p>
            </div>
          </div>

          <!-- Live Visual Stepper Queue Progression Line -->
          <div class="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div class="flex items-center justify-between text-xs mb-3">
              <span class="font-semibold text-slate-800 flex items-center gap-1.5">
                <span class="icon icon-heart text-tealbrand"></span>
                Live OPD Timeline Stepper:
              </span>
              <span class="text-tealbrand font-mono font-medium">Serving Token ${qState.current}</span>
            </div>
            <div class="flex items-center gap-2 overflow-x-auto pb-1">
              ${[qState.current - 2, qState.current - 1, qState.current, qState.current + 1, qState.yourToken].map((t, idx) => {
                const isPast = t < qState.current;
                const isCurrent = t === qState.current;
                const isUser = t === qState.yourToken;
                return `
                  <div class="shrink-0 flex items-center gap-2">
                    <div class="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                      isCurrent
                        ? "bg-emerald-600 text-white ring-2 ring-emerald-400 ring-offset-1 shadow-xs"
                        : isUser
                        ? "bg-amber-100 text-amber-900 border border-amber-300 font-bold"
                        : isPast
                        ? "bg-slate-200/80 text-slate-400 line-through"
                        : "bg-white text-slate-700 border border-slate-200"
                    }">
                      ${isCurrent ? '<span class="w-2 h-2 rounded-full bg-white animate-ping"></span> IN ROOM: ' : ""}
                      Token ${t} ${isUser ? " (Aap)" : ""}
                    </div>
                    ${idx < 4 ? '<span class="icon icon-arrow-right text-slate-300"></span>' : ""}
                  </div>
                `;
              }).join("")}
            </div>
          </div>

          <!-- Quick Token Status Check -->
          <div class="mt-5 pt-4 border-t border-emerald-100">
            <label class="text-xs font-semibold text-slate-700 block mb-1.5">Kisi doosre token / phone ka status dekhein</label>
            <div class="flex gap-2">
              <input id="queue-lookup-input" type="text" placeholder="Token No (jaise 12) ya Mobile" class="h-11 px-3.5 text-sm flex-1 rounded-xl border border-emerald-200 outline-none focus:border-tealbrand">
              <button id="queue-lookup-btn" type="button" class="h-11 px-5 rounded-xl bg-tealbrand text-white text-sm font-semibold hover:bg-teal-700">Check</button>
            </div>
            <p id="queue-lookup-result" class="text-xs mt-2 font-medium text-tealbrand hidden"></p>
          </div>
        </div>

        <!-- Patient Smart Queue Benefits & Portal Gateway -->
        <div class="bg-white rounded-3xl border border-emerald-100 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-2 text-tealbrand font-semibold text-sm">
              <span class="icon icon-shield text-emerald-600"></span>
              <span>Zero Wait-Time Guarantee</span>
            </div>
            <p class="text-xs text-slate-500 mt-1">CareWell Clinic smart queue system ke fayde:</p>

            <div class="mt-4 space-y-2.5 text-xs text-slate-600">
              <div class="flex items-start gap-2">
                <span class="icon icon-check text-emerald-600"></span>
                <span>Ghar se aao, seedha andar jao — 2 ghante crowded room me nahi baithna.</span>
              </div>
              <div class="flex items-start gap-2">
                <span class="icon icon-check text-emerald-600"></span>
                <span>Aapka number aane se <strong>15 minute pehle</strong> WhatsApp reminder.</span>
              </div>
              <div class="flex items-start gap-2">
                <span class="icon icon-check text-emerald-600"></span>
                <span>Doctor checkup ke baad Prescription & Reports digital portal me save.</span>
              </div>
            </div>

            <!-- Patient Portal Callout -->
            <div class="mt-5 p-4 rounded-2xl bg-mint border border-emerald-200">
              <p class="text-xs font-bold text-tealbrand">Already Booked / Visited?</p>
              <p class="text-[11px] text-slate-600 mt-0.5">Apni digital prescription (Rx) aur lab reports download karein:</p>
              <a href="patient.html" class="mt-3 inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-tealbrand text-white text-xs font-semibold hover:bg-teal-700 transition shadow-2xs">
                <span class="icon icon-user"></span> Open Patient Portal →
              </a>
            </div>
          </div>

          <div class="mt-5 pt-4 border-t border-slate-100">
            <details class="text-[11px] text-slate-400 cursor-pointer">
              <summary class="hover:text-slate-600 font-medium"> Demo Queue Controls (For Evaluator)</summary>
              <div class="mt-2 space-y-2 pt-2">
                <button id="btn-next-token" type="button" class="w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5">
                  <span class="icon icon-arrow-right text-tealbrand"></span> Call Next Token (+1)
                </button>
                <button id="btn-trigger-wa-alert" type="button" class="w-full py-2 rounded-lg bg-emerald-50 text-tealbrand hover:bg-emerald-100 text-xs font-medium flex items-center justify-center gap-1.5">
                  <span class="icon icon-message"></span> Simulate 15-Min Alert
                </button>
              </div>
            </details>
          </div>
        </div>
      </div>
    `;

    // Event Bindings
    $s("#queue-doctor-select")?.addEventListener("change", (e) => {
      qState.doctorId = e.target.value;
      sWriteJson("carewell_queue_state", qState);
      renderQueuePanel();
      sRefreshIcons();
    });

    $s("#btn-next-token")?.addEventListener("click", () => {
      qState.current += 1;
      sWriteJson("carewell_queue_state", qState);
      sShowToast(`Token ${qState.current} OPD room mein bulaya gaya!`);
      // If within 15 min of user token, notify
      if (qState.yourToken - qState.current === 2) {
        sendAutomatedWhatsApp("9811111111", "Riya Sharma", ` Token Alert: Aapka Token No. ${qState.yourToken} aane me 15 minute baki hain. Kripya Clinic room ke pass pahuchein.`);
      }
      renderQueuePanel();
      sRefreshIcons();
    });

    $s("#btn-trigger-wa-alert")?.addEventListener("click", () => {
      sendAutomatedWhatsApp("9811111111", "Riya Sharma", ` Reminder: Token No. ${qState.yourToken} - Agle 15 minutes mein aapka number aane wala hai!`);
      sShowToast("15-Min WhatsApp alert patient ko bhej diya gaya!");
      renderWhatsAppPanel();
      sRefreshIcons();
    });

    $s("#btn-reset-queue")?.addEventListener("click", () => {
      qState.current = 8;
      qState.yourToken = 12;
      sWriteJson("carewell_queue_state", qState);
      sShowToast("Queue status reset to initial demo state.");
      renderQueuePanel();
      sRefreshIcons();
    });

    $s("#queue-lookup-btn")?.addEventListener("click", () => {
      const val = $s("#queue-lookup-input")?.value.trim();
      const res = $s("#queue-lookup-result");
      if (!val || !res) return;
      const targetToken = parseInt(val.replace(/\D/g, ""), 10) || 12;
      const diffLookup = targetToken - qState.current;
      res.classList.remove("hidden");
      if (diffLookup < 0) {
        res.textContent = `Token ${targetToken} ka checkup ho chuka hai (Done).`;
      } else if (diffLookup === 0) {
        res.textContent = `Token ${targetToken} abhi doctor ke paas andar hai!`;
      } else {
        res.textContent = `Token ${targetToken} aapse ${diffLookup} patients aage hai (~${Math.round(diffLookup * 7.5)} min wait).`;
      }
    });

    sRefreshIcons();
  }

  // Helper to append outbox message
  function sendAutomatedWhatsApp(phone, patient, text, kind = "Queue Alert") {
    const outbox = sReadJson("carewell_outbox", []);
    outbox.unshift({
      id: `out-${Date.now()}`,
      phone: phone || "9811111111",
      patient: patient || "Patient",
      kind,
      text,
      status: "Delivered",
      createdAt: new Date().toISOString()
    });
    sWriteJson("carewell_outbox", outbox.slice(0, 50));
  }

  // -------------------------------------------------------------
  // 2. WHATSAPP AUTOMATION PANEL (#wa-panel)
  // -------------------------------------------------------------
  function renderWhatsAppPanel() {
    const container = $s("#wa-panel");
    if (!container) return;

    const chatMessages = sReadJson("carewell_wa_chat", []);
    const outboxMessages = sReadJson("carewell_outbox", []);

    container.innerHTML = `
      <!-- Column 1: Live Interactive WhatsApp Chat Simulator -->
      <div class="bg-white rounded-3xl border border-emerald-100 overflow-hidden shadow-sm flex flex-col h-[580px]">
        <!-- WhatsApp Header -->
        <div class="bg-[#075E54] text-white px-4 py-3.5 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-white flex items-center justify-center text-tealbrand font-bold text-sm">
              CW
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <span class="font-semibold text-sm leading-tight">CareWell Clinic</span>
                <span class="text-emerald-300 text-xs" title="Official WhatsApp Verified"></span>
              </div>
              <p class="text-[11px] text-emerald-100">WhatsApp Automated OPD Bot · Online</p>
            </div>
          </div>
          <div class="flex items-center gap-2 text-emerald-100">
            <span class="icon icon-phone"></span>
            <span class="icon icon-menu"></span>
          </div>
        </div>

        <!-- Chat History Box -->
        <div id="wa-chat-body" class="flex-1 bg-[#ECE5DD] p-4 overflow-y-auto space-y-3">
          ${chatMessages
            .map((msg) => {
              const isBot = msg.sender === "bot";
              return `
              <div class="flex ${isBot ? "justify-start" : "justify-end"}">
                <div class="max-w-[85%] sm:max-w-[78%] p-3 text-xs sm:text-sm leading-relaxed shadow-xs ${
                  isBot ? "chat-bubble-bot text-slate-800" : "chat-bubble-patient text-slate-900"
                }">
                  ${
                    msg.isTyping
                      ? `
                    <div class="flex items-center gap-1.5 py-1">
                      <span class="typing-dot"></span>
                      <span class="typing-dot"></span>
                      <span class="typing-dot"></span>
                      <span class="text-xs text-slate-400 ml-1.5 font-medium">CareWell is typing...</span>
                    </div>
                  `
                      : `
                    <p class="whitespace-pre-line">${sEscapeHtml(msg.text)}</p>
                    <span class="text-[10px] text-slate-400 block text-right mt-1">${sEscapeHtml(msg.time || "Now")}</span>
                  `
                  }
                </div>
              </div>
            `;
            })
            .join("")}
        </div>

        <!-- Quick Action Suggestion Pills -->
        <div class="bg-[#f0f2f5] px-3 py-2 border-t border-slate-200 flex gap-2 overflow-x-auto text-xs">
          <button type="button" data-wa-quick="1" class="shrink-0 px-3 py-1 rounded-full bg-white border border-emerald-300 text-emerald-800 font-medium hover:bg-emerald-50">
            1️⃣ Confirm Appointment
          </button>
          <button type="button" data-wa-quick="2" class="shrink-0 px-3 py-1 rounded-full bg-white border border-red-300 text-red-700 font-medium hover:bg-red-50">
            2️⃣ Cancel Appointment
          </button>
          <button type="button" data-wa-quick="book" class="shrink-0 px-3 py-1 rounded-full bg-tealbrand text-white font-medium hover:bg-teal-700">
             Quick Auto-Book via WhatsApp
          </button>
          <button type="button" data-wa-quick="prescription" class="shrink-0 px-3 py-1 rounded-full bg-white border border-slate-300 text-slate-700 hover:bg-slate-100">
             Prescription Bhejo
          </button>
        </div>

        <!-- Chat Input Bar -->
        <form id="wa-chat-form" class="bg-[#f0f2f5] p-2.5 flex items-center gap-2 border-t border-slate-200">
          <input id="wa-input" type="text" placeholder="Type '1' to confirm, '2' to cancel, ya 'Book Dr. Rao'..." class="flex-1 h-10 px-3.5 text-xs sm:text-sm rounded-full bg-white border border-slate-300 outline-none focus:border-[#075E54]">
          <button type="submit" class="w-10 h-10 rounded-full bg-[#128C7E] text-white flex items-center justify-center hover:bg-[#075E54] shrink-0">
            <span class="icon icon-send"></span>
          </button>
        </form>
      </div>

      <!-- Column 2: WhatsApp Automation Hub & Outbox -->
      <div class="bg-white rounded-3xl border border-emerald-100 p-6 shadow-sm flex flex-col h-[580px]">
        <div class="flex items-center justify-between border-b border-emerald-100 pb-4">
          <div>
            <h3 class="font-display text-lg text-slate-900">Clinic WhatsApp Broadcast Outbox</h3>
            <p class="text-xs text-slate-500">Automated reminders & confirmation logs sent to patients</p>
          </div>
          <span class="px-2.5 py-1 rounded-full bg-emerald-50 text-tealbrand text-xs font-semibold border border-emerald-200">
            ${outboxMessages.length} Messages Logged
          </span>
        </div>

        <!-- Outbox Quick Test Buttons -->
        <div class="py-3 flex flex-wrap gap-2 border-b border-emerald-100">
          <button id="btn-wa-test-reminder" type="button" class="text-xs px-3 py-1.5 rounded-lg bg-mint text-tealbrand border border-emerald-200 font-semibold hover:bg-emerald-100">
            + 1 Din Pehle Reminder
          </button>
          <button id="btn-wa-test-followup" type="button" class="text-xs px-3 py-1.5 rounded-lg bg-mint text-tealbrand border border-emerald-200 font-semibold hover:bg-emerald-100">
            + 6 Mahine BP Follow-up
          </button>
          <button id="btn-wa-test-rx" type="button" class="text-xs px-3 py-1.5 rounded-lg bg-mint text-tealbrand border border-emerald-200 font-semibold hover:bg-emerald-100">
            + Prescription Alert
          </button>
        </div>

        <!-- Outbox List -->
        <div class="flex-1 overflow-y-auto space-y-3 pt-3">
          ${outboxMessages.length === 0 ? `<p class="text-xs text-slate-500 text-center py-8">Koi outbox message nahi hai.</p>` : ""}
          ${outboxMessages
            .map(
              (msg) => `
            <div class="p-3 rounded-2xl border border-slate-100 bg-slate-50 text-xs">
              <div class="flex items-center justify-between font-semibold text-slate-800">
                <span class="flex items-center gap-1">
                  <span class="icon icon-message"></span>
                  ${sEscapeHtml(msg.patient || "Patient")} (${sEscapeHtml(msg.phone)})
                </span>
                <span class="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-tealbrand">${sEscapeHtml(msg.kind || "Reminder")}</span>
              </div>
              <p class="mt-1.5 text-slate-600 leading-relaxed">${sEscapeHtml(msg.text)}</p>
              <div class="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                <span>${new Date(msg.createdAt || Date.now()).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                <span class="text-tealbrand font-medium"> ${sEscapeHtml(msg.status || "Delivered")}</span>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;

    // Scroll chat to bottom
    const chatBody = $s("#wa-chat-body");
    if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;

    // Chat submit handler
    $s("#wa-chat-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $s("#wa-input");
      if (!input || !input.value.trim()) return;
      handleWhatsAppPatientInput(input.value.trim());
      input.value = "";
    });

    // Quick reply pill handler
    $$s("[data-wa-quick]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.waQuick;
        if (val === "1") handleWhatsAppPatientInput("1");
        else if (val === "2") handleWhatsAppPatientInput("2");
        else if (val === "book") handleWhatsAppPatientInput("Book Dr. Rao kal 11:30 AM");
        else if (val === "prescription") handleWhatsAppPatientInput("Prescription download");
      });
    });

    // Outbox test triggers
    $s("#btn-wa-test-reminder")?.addEventListener("click", () => {
      sendAutomatedWhatsApp("9811111111", "Riya Sharma", "Namaste! Kal 11:30 AM Dr. Ananya Rao ke paas aapka appointment hai. 1 likh kar confirm karein, 2 likh kar cancel.", "1 Din Pehle Reminder");
      renderWhatsAppPanel();
      sShowToast("1 Din Pehle Reminder broadcast bhej diya gaya!");
    });

    $s("#btn-wa-test-followup")?.addEventListener("click", () => {
      sendAutomatedWhatsApp("9811111111", "Suresh Sharma", "Namaste Suresh ji! Aapke Blood Pressure checkup ko 6 mahine ho gaye hain. Doctor follow-up ke liye CareWell visit karein.", "Follow-up Reminder");
      renderWhatsAppPanel();
      sShowToast("6-Mahine Follow-up reminder broadcast bhej diya gaya!");
    });

    $s("#btn-wa-test-rx")?.addEventListener("click", () => {
      sendAutomatedWhatsApp("9811111111", "Riya Sharma", "Dr. Ananya Rao ne aapka Prescription digital portal me add kar diya hai. Portal se PDF download karein: #portal", "Post-Visit Prescription");
      renderWhatsAppPanel();
      sShowToast("Prescription ready alert WhatsApp par bhej diya!");
    });

    sRefreshIcons();
  }

  function handleWhatsAppPatientInput(text) {
    const chatMessages = sReadJson("carewell_wa_chat", []);
    const nowTime = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

    // 1. Add patient message + typing indicator
    chatMessages.push({
      sender: "patient",
      time: nowTime,
      text: text
    });
    chatMessages.push({
      sender: "bot",
      time: nowTime,
      text: "",
      isTyping: true
    });
    sWriteJson("carewell_wa_chat", chatMessages);
    renderWhatsAppPanel();

    setTimeout(() => {
      const msgs = sReadJson("carewell_wa_chat", []);
      // Remove typing message
      const filtered = msgs.filter((m) => !m.isTyping);
      const appointments = typeof getAppointments === "function" ? getAppointments() : sReadJson("carewell_appointments", []);
      const lower = text.toLowerCase();

      // Process automated logic
      if (lower === "1" || lower.includes("confirm")) {
        const userAppt = appointments.find((a) => a.phone === "9811111111" && a.status !== "cancelled");
        if (userAppt) {
          userAppt.status = "confirmed";
          if (typeof setAppointments === "function") setAppointments(appointments);
          else sWriteJson("carewell_appointments", appointments);
        }
        filtered.push({
          sender: "bot",
          time: nowTime,
          text: " Thank You! Aapka appointment Confirm ho gaya hai.\n• Doctor: Dr. Ananya Rao\n• Token No: 12 (Booking ID: CW-2048)\n• Clinic Address: 214 MG Road, Camp, Pune.\n\nLive queue track karne ke liye website par 'Queue' tab dekhein!"
        });
        sShowToast("Appointment Confirmed via WhatsApp!");
      } else if (lower === "2" || lower.includes("cancel")) {
        const userAppt = appointments.find((a) => a.phone === "9811111111" && a.status !== "cancelled");
        if (userAppt) {
          userAppt.status = "cancelled";
          if (typeof setAppointments === "function") setAppointments(appointments);
          else sWriteJson("carewell_appointments", appointments);
        }
        filtered.push({
          sender: "bot",
          time: nowTime,
          text: " Aapka appointment cancel kar diya gaya hai. Slot doosre patient ke liye release ho gaya hai.\n\nDobara book karne ke liye 'Book' likhein ya website open karein."
        });
        sShowToast("Appointment Cancelled via WhatsApp. Slot released.");
      } else if (lower.includes("book") || lower.includes("slot")) {
        const nextBookingId = `CW-${Math.floor(2050 + Math.random() * 800)}`;
        const nextTok = Math.floor(13 + Math.random() * 5);
        const newAppt = {
          id: `cw-${Date.now()}`,
          bookingId: nextBookingId,
          tokenNo: nextTok,
          token: nextBookingId,
          patientName: "Riya Sharma",
          phone: "9811111111",
          age: 28,
          doctorId: "ananya-rao",
          date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
          slot: "11:30",
          reason: "WhatsApp Auto-Booking (Fever checkup)",
          visitType: "New visit",
          status: "confirmed",
          createdAt: new Date().toISOString()
        };
        appointments.push(newAppt);
        if (typeof setAppointments === "function") setAppointments(appointments);
        else sWriteJson("carewell_appointments", appointments);

        filtered.push({
          sender: "bot",
          time: nowTime,
          text: ` Booking Auto Hogi! Slot lock ho gaya:\n• Patient: Riya Sharma\n• Doctor: Dr. Ananya Rao (General Physician)\n• Date & Time: Kal 11:30 AM\n• Booking ID: ${nextBookingId}\n• Token No: ${nextTok}\n\nInstant confirmation screen + WhatsApp dono pe generate ho gaya hai!`
        });
        sShowToast("Auto-Booking completed via WhatsApp!");
      } else if (lower.includes("prescription") || lower.includes("dawai")) {
        filtered.push({
          sender: "bot",
          time: nowTime,
          text: " Aapka latest prescription (Dr. Ananya Rao - 12 Nov) digital portal par available hai:\n• Paracetamol 500mg, ORS\n\nPDF Download karne ke liye website par 'Portal' tab mein jayein."
        });
      } else {
        filtered.push({
          sender: "bot",
          time: nowTime,
          text: "CareWell Clinic Bot: Aapka message receive hua. Appointments ke liye '1' dabayein (Confirm), '2' (Cancel), ya 'Book' likhein."
        });
      }

      sWriteJson("carewell_wa_chat", filtered);
      renderWhatsAppPanel();
      if (typeof updateBookingCountAndLists === "function") updateBookingCountAndLists();
    }, 450);
  }

  // -------------------------------------------------------------
  // 3. AI CALLING SYSTEM (#call-panel)
  // "AI Calling - Call miss nahi hogi"
  // -------------------------------------------------------------
  let activeCallState = null; // when a call simulation is active

  function renderCallsPanel() {
    const container = $s("#call-panel");
    if (!container) return;

    const calls = sReadJson("carewell_calls", []);

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Top Metrics Row -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm">
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Missed Calls Today</span>
            <p class="text-3xl font-display font-bold text-slate-900 mt-1">${calls.length}</p>
            <span class="text-[11px] text-amber-600 font-medium">Auto-detected from phone line</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm">
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Callbacks Recovered</span>
            <p class="text-3xl font-display font-bold text-tealbrand mt-1">${calls.filter((c) => c.status === "Recovered").length} / ${calls.length}</p>
            <span class="text-[11px] text-tealbrand font-medium">100% Missed Call Coverage</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm">
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Revenue Saved</span>
            <p class="text-3xl font-display font-bold text-slate-900 mt-1">₹${calls.filter((c) => c.status === "Recovered").length * 500 + 600}</p>
            <span class="text-[11px] text-emerald-600 font-medium">Lost patients converted</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm">
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Voice Call Time</span>
            <p class="text-3xl font-display font-bold text-slate-900 mt-1">45 sec</p>
            <span class="text-[11px] text-slate-500 font-medium">Natural Hindi + English AI</span>
          </div>
        </div>

        <!-- Main Call Recovery Console -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Left 2 Cols: Missed Calls Table & AI Callback Trigger -->
          <div class="lg:col-span-2 bg-white rounded-3xl border border-emerald-100 p-6 shadow-sm">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-4">
              <div>
                <h3 class="font-display text-lg text-slate-900 flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
                  Missed Call Queue (AI Auto-Calling Engine)
                </h3>
                <p class="text-xs text-slate-500 mt-0.5">Doctor busy ho ya clinic phone miss ho jaye, AI Voice bot patient ko turant wapas call karta hai.</p>
              </div>
              <button id="btn-add-missed-call" type="button" class="text-xs px-3.5 py-2 rounded-xl bg-mint text-tealbrand border border-emerald-200 font-semibold hover:bg-emerald-100 shrink-0">
                + Simulate New Missed Call
              </button>
            </div>

            <div class="divide-y divide-emerald-50 mt-4">
              ${calls.length === 0 ? `<p class="py-6 text-center text-xs text-slate-500">Koi missed call pending nahi hai.</p>` : ""}
              ${calls
                .map((call) => {
                  const isRecovered = call.status === "Recovered";
                  return `
                <div class="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-2xl ${isRecovered ? "bg-emerald-100 text-tealbrand" : "bg-red-100 text-red-600"} flex items-center justify-center shrink-0">
                      <span class="icon icon-phone w-5 h-5"></span>
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-semibold text-sm text-slate-900">${sEscapeHtml(call.name)}</span>
                        <span class="text-xs font-mono text-slate-500">+91 ${sEscapeHtml(call.phone)}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          isRecovered ? "bg-emerald-100 text-tealbrand" : "bg-red-50 text-red-600 border border-red-200"
                        }">
                          ${sEscapeHtml(call.status || "Missed")}
                        </span>
                      </div>
                      <p class="text-xs text-slate-600 mt-1">${sEscapeHtml(call.reason || "Patient enquiry call miss ho gaya")}</p>
                    </div>
                  </div>

                  <div class="shrink-0 flex items-center gap-2">
                    ${
                      isRecovered
                        ? `<span class="text-xs font-semibold text-tealbrand flex items-center gap-1">
                             <span class="icon icon-check text-emerald-600"></span> Booking Auto-Created
                           </span>`
                        : `<button type="button" data-call-id="${call.id}" class="btn-start-ai-call px-4 py-2 rounded-xl bg-tealbrand text-white text-xs font-semibold hover:bg-teal-700 flex items-center gap-1.5 shadow-sm">
                             <span class="icon icon-phone"></span>
                             AI Callback Shuru Karo
                           </button>`
                    }
                  </div>
                </div>
              `;
                })
                .join("")}
            </div>
          </div>

          <!-- Right Col: Live Voice Simulation Screen / Phone Screen -->
          <div id="ai-call-active-box" class="bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-3xl p-6 shadow-xl flex flex-col justify-between min-h-[420px]">
            <!-- Top Call Header -->
            <div>
              <div class="flex items-center justify-between text-xs text-slate-400">
                <span class="flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  AI Voice Assistant Line
                </span>
                <div class="flex items-center gap-2">
                  <button id="toggle-voice-audio-btn" type="button" class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-400/30 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900 transition">
                     Voice Speech: ON
                  </button>
                  <span id="call-timer-display" class="font-mono text-emerald-400">Ready</span>
                </div>
              </div>

              <div class="mt-6 text-center">
                <div class="w-20 h-20 rounded-full bg-tealbrand/30 border-2 border-emerald-400 mx-auto flex items-center justify-center call-pulse">
                  <span class="icon icon-mic text-emerald-300"></span>
                </div>
                <h4 id="call-patient-name" class="font-display text-xl mt-4">CareWell AI Agent</h4>
                <p id="call-status-subtitle" class="text-xs text-emerald-300 mt-1">Smart Hinglish Healthcare Voice Engine</p>
              </div>
            </div>

            <!-- Voice Script / Transcript Display -->
            <div id="call-transcript-box" class="my-4 p-3.5 rounded-2xl bg-white/10 backdrop-blur border border-white/10 text-xs text-slate-200 leading-relaxed min-h-[120px] flex items-center justify-center text-center">
              "AI Callback Shuru Karo" dabayein to live voice conversation start hogi.
            </div>

            <!-- Call Action / Response Controls -->
            <div id="call-controls-box" class="pt-2">
              <div class="flex items-center justify-center gap-3">
                <div class="flex items-center gap-1 h-6">
                  <div class="wave-bar"></div>
                  <div class="wave-bar"></div>
                  <div class="wave-bar"></div>
                  <div class="wave-bar"></div>
                  <div class="wave-bar"></div>
                </div>
                <span class="text-xs text-slate-400">AI Voice System Armed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Event Bindings
    $s("#btn-add-missed-call")?.addEventListener("click", () => {
      const calls = sReadJson("carewell_calls", []);
      const newCall = {
        id: `call-${Date.now()}`,
        name: "Pooja Malhotra",
        phone: "9820011445",
        reason: "Missed call 2 min ago - Cardiology appointment enquiry",
        status: "Missed"
      };
      calls.unshift(newCall);
      sWriteJson("carewell_calls", calls);
      sShowToast("Simulated missed call logged!");
      renderCallsPanel();
      sRefreshIcons();
    });

    $$s(".btn-start-ai-call").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.callId;
        const call = calls.find((c) => c.id === id);
        if (call) startAICallSimulation(call);
      });
    });

    $s("#toggle-voice-audio-btn")?.addEventListener("click", () => {
      window.isVoiceAudioEnabled = !window.isVoiceAudioEnabled;
      const btn = $s("#toggle-voice-audio-btn");
      if (btn) btn.textContent = window.isVoiceAudioEnabled ? " Voice Speech: ON" : " Voice Speech: OFF";
      sShowToast(`Voice Speech Audio: ${window.isVoiceAudioEnabled ? "Enabled" : "Muted"}`);
    });

    sRefreshIcons();
  }

  if (typeof window !== "undefined") {
    window.isVoiceAudioEnabled = true;
    window.cachedSpeechVoices = [];
    if ("speechSynthesis" in window) {
      const getV = () => {
        try { window.cachedSpeechVoices = window.speechSynthesis.getVoices(); } catch (e) {}
      };
      getV();
      window.speechSynthesis.onvoiceschanged = getV;
    }
  }

  function speakVoice(text) {
    if (typeof window === "undefined" || !window.isVoiceAudioEnabled || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      if (typeof window.speechSynthesis.resume === "function") {
        window.speechSynthesis.resume();
      }
      const clean = text.replace(/<[^>]*>/g, "").replace(/["'*_`]/g, "").trim();
      if (!clean) return;
      const utter = new SpeechSynthesisUtterance(clean);
      const voices = (window.cachedSpeechVoices && window.cachedSpeechVoices.length) ? window.cachedSpeechVoices : window.speechSynthesis.getVoices();
      const preferred = voices.find((v) => v.lang.startsWith("hi") || v.name.toLowerCase().includes("hindi")) ||
                        voices.find((v) => v.lang.includes("IN") || v.lang.includes("India")) ||
                        voices.find((v) => v.lang.startsWith("en")) ||
                        voices[0];
      if (preferred) {
        utter.voice = preferred;
        utter.lang = preferred.lang;
      } else {
        utter.lang = "hi-IN";
      }
      utter.rate = 1.0;
      utter.pitch = 1.0;

      // Animate wave bars when speech plays
      const waveBars = document.querySelectorAll(".wave-bar");
      waveBars.forEach(b => b.classList.add("scale-y-125", "bg-emerald-300"));
      utter.onend = () => {
        waveBars.forEach(b => b.classList.remove("scale-y-125", "bg-emerald-300"));
      };
      utter.onerror = () => {
        waveBars.forEach(b => b.classList.remove("scale-y-125", "bg-emerald-300"));
      };

      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn("Speech error:", e);
    }
  }

  function startAICallSimulation(call) {
    const timerDisplay = $s("#call-timer-display");
    const nameDisplay = $s("#call-patient-name");
    const subtitle = $s("#call-status-subtitle");
    const transcriptBox = $s("#call-transcript-box");
    const controlsBox = $s("#call-controls-box");

    if (!timerDisplay || !transcriptBox || !controlsBox) return;

    nameDisplay.textContent = `Dialing: ${call.name}`;
    subtitle.textContent = `Connecting to +91 ${call.phone}...`;
    transcriptBox.innerHTML = `<em>Calling patient's mobile number...</em>`;

    let seconds = 0;
    const interval = setInterval(() => {
      seconds++;
      const m = String(Math.floor(seconds / 60)).padStart(2, "0");
      const s = String(seconds % 60).padStart(2, "0");
      timerDisplay.textContent = `${m}:${s}`;
    }, 1000);

    // After 1.5 seconds, call connected and AI speaks Step 1
    setTimeout(() => {
      nameDisplay.textContent = `In Call: ${call.name}`;
      subtitle.textContent = `Active AI Voice Session · Hinglish`;

      transcriptBox.innerHTML = `
        <div class="text-left space-y-2">
          <p><strong class="text-emerald-400">AI Voice:</strong> "Namaste ${sEscapeHtml(call.name)} ji! Main CareWell Clinic se AI assistant bol raha hoon. Aapka call miss hua tha. Kya aap Dr. Ananya Rao ke paas appointment book karna chahte hain?"</p>
        </div>
      `;
      speakVoice(`Namaste ${call.name} ji! Main CareWell Clinic se AI assistant bol raha hoon. Aapka call miss hua tha. Kya aap Dr. Ananya Rao ke paas appointment book karna chahte hain?`);

      // Render interactive patient response choices
      controlsBox.innerHTML = `
        <div class="space-y-2">
          <p class="text-[11px] text-slate-300 text-center font-medium">Patient ka response select karein:</p>
          <button id="ai-resp-1" type="button" class="w-full py-2 px-3 rounded-xl bg-tealbrand text-white text-xs font-medium hover:bg-teal-700 text-left">
            ️ "Haan, kal subah 11:30 AM ka slot book kar do."
          </button>
          <button id="ai-resp-2" type="button" class="w-full py-2 px-3 rounded-xl bg-white/10 text-slate-200 text-xs font-medium hover:bg-white/20 text-left">
            ️ "Nahi, sirf clinic timing aur fee poochhni thi."
          </button>
        </div>
      `;

      $s("#ai-resp-1")?.addEventListener("click", () => {
        const confirmMsg = "Done! Kal subah 11:30 AM ka slot lock kar diya hai. Booking ID CW-2048, Token No. 12 generate ho gaya hai aur details WhatsApp par bhej di hain. Dhanyawad!";
        transcriptBox.innerHTML += `
          <p class="text-left"><strong class="text-amber-300">Patient:</strong> "Haan, kal subah 11:30 AM ka slot book kar do."</p>
          <p class="text-left mt-2"><strong class="text-emerald-400">AI Voice:</strong> "${confirmMsg}"</p>
        `;
        speakVoice(confirmMsg);

        controlsBox.innerHTML = `
          <button id="btn-end-ai-call" type="button" class="w-full py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700">
            End Call & Sync Booking
          </button>
        `;

        $s("#btn-end-ai-call")?.addEventListener("click", () => {
          if ("speechSynthesis" in window) window.speechSynthesis.cancel();
          clearInterval(interval);
          // Mark call as recovered
          const allCalls = sReadJson("carewell_calls", []);
          const match = allCalls.find((c) => c.id === call.id);
          if (match) match.status = "Recovered";
          sWriteJson("carewell_calls", allCalls);

          // Auto-generate appointment
          const appointments = typeof getAppointments === "function" ? getAppointments() : sReadJson("carewell_appointments", []);
          const bookingId = `CW-${Math.floor(2040 + Math.random() * 600)}`;
          appointments.push({
            id: `cw-${Date.now()}`,
            bookingId,
            tokenNo: Math.floor(10 + Math.random() * 10),
            token: bookingId,
            patientName: call.name,
            phone: call.phone,
            age: 32,
            doctorId: "ananya-rao",
            date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
            slot: "11:30",
            reason: "AI Voice Call Auto-Recovery",
            visitType: "New visit",
            status: "confirmed",
            createdAt: new Date().toISOString()
          });
          if (typeof setAppointments === "function") setAppointments(appointments);
          else sWriteJson("carewell_appointments", appointments);

          // Send WhatsApp notification
          sendAutomatedWhatsApp(call.phone, call.name, `AI Voice Call confirmation: Booking ${bookingId} locked for Dr. Ananya Rao tomorrow 11:30 AM. Token No. 12.`, "AI Call Recovery");

          sShowToast(`Call Resolved! Appointment ${bookingId} booked for ${call.name}`);
          renderCallsPanel();
          if (typeof updateBookingCountAndLists === "function") updateBookingCountAndLists();
        });
      });

      $s("#ai-resp-2")?.addEventListener("click", () => {
        const infoMsg = "Clinic Monday se Saturday subah 9 se 1 aur shaam 4 se 7 open rehti hai. General consultation fee ₹500 hai. Saari details aapke WhatsApp pe share kar di hain.";
        transcriptBox.innerHTML += `
          <p class="text-left"><strong class="text-amber-300">Patient:</strong> "Nahi, sirf clinic timing aur fee poochhni thi."</p>
          <p class="text-left mt-2"><strong class="text-emerald-400">AI Voice:</strong> "${infoMsg}"</p>
        `;
        speakVoice(infoMsg);

        controlsBox.innerHTML = `
          <button id="btn-end-ai-call" type="button" class="w-full py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700">
            End Call & Send WhatsApp Info
          </button>
        `;

        $s("#btn-end-ai-call")?.addEventListener("click", () => {
          if ("speechSynthesis" in window) window.speechSynthesis.cancel();
          clearInterval(interval);
          const allCalls = sReadJson("carewell_calls", []);
          const match = allCalls.find((c) => c.id === call.id);
          if (match) match.status = "Recovered";
          sWriteJson("carewell_calls", allCalls);
          sendAutomatedWhatsApp(call.phone, call.name, "CareWell Clinic Timings: Mon-Sat 9AM-1PM & 4PM-7PM. Consultation ₹500.", "Clinic Info");
          sShowToast("Enquiry resolved & details sent via WhatsApp!");
          renderCallsPanel();
        });
      });
    }, 1500);
  }

  // -------------------------------------------------------------
  // 4. PATIENT PORTAL (#portal-panel)
  // Login: Phone + OTP, Family Profiles (Riya, Suresh, Lata, Aarav),
  // Prescriptions PDF Download, Medical Reports, Visit History
  // -------------------------------------------------------------
  let activePortalTab = "appointments"; // 'appointments', 'prescriptions', 'reports', 'history'

  function renderPortalPanel() {
    const container = $s("#portal-panel");
    if (!container) return;

    if (!portalLoggedIn) {
      // Render Login Screen
      container.innerHTML = `
        <div class="max-w-md mx-auto bg-white rounded-3xl border border-emerald-100 p-6 sm:p-8 shadow-sm">
          <div class="text-center">
            <span class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-tealbrand mb-3">
              <span class="icon icon-shield"></span>
            </span>
            <h3 class="font-display text-2xl text-slate-900">Patient Portal Login</h3>
            <p class="text-xs text-slate-500 mt-1">Phone number daalein aur OTP se login karein. Family ke saare records ek jagah.</p>
          </div>

          <form id="portal-login-form" class="mt-6 space-y-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Mobile Number</label>
              <input id="portal-phone" type="tel" value="9811111111" maxlength="10" class="h-11 w-full px-3.5 text-sm rounded-xl border border-emerald-200 outline-none focus:border-tealbrand">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">OTP (Demo Code: 1234)</label>
              <input id="portal-otp" type="text" value="1234" maxlength="4" class="h-11 w-full px-3.5 text-sm rounded-xl border border-emerald-200 outline-none focus:border-tealbrand">
            </div>
            <button type="submit" class="w-full h-11 rounded-xl bg-tealbrand text-white text-sm font-semibold hover:bg-teal-700">
              OTP Verify & Login
            </button>
            <button id="btn-quick-portal-login" type="button" class="w-full h-10 rounded-xl bg-mint text-tealbrand border border-emerald-200 text-xs font-semibold">
               1-Click Demo Login as Riya Sharma (CW-2048)
            </button>
          </form>
        </div>
      `;

      $s("#portal-login-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        portalLoggedIn = true;
        renderPortalPanel();
        sRefreshIcons();
      });

      $s("#btn-quick-portal-login")?.addEventListener("click", () => {
        portalLoggedIn = true;
        renderPortalPanel();
        sRefreshIcons();
      });

      sRefreshIcons();
      return;
    }

    // When Logged in:
    const family = CareWellData.records?.family || [
      { id: "riya", name: "Riya Sharma", patientId: "CW-2048", age: 28, relation: "Self", phone: "9811111111" },
      { id: "papa", name: "Suresh Sharma", patientId: "CW-1980", age: 58, relation: "Papa", phone: "9811111111" },
      { id: "mummy", name: "Lata Sharma", patientId: "CW-1988", age: 54, relation: "Mummy", phone: "9811111111" },
      { id: "baccha", name: "Aarav Sharma", patientId: "CW-2210", age: 6, relation: "Baccha", phone: "9811111111" }
    ];

    const currentMember = family.find((f) => f.patientId === currentPortalMemberId) || family[0];

    const prescriptions = sReadJson("carewell_prescriptions", []).filter((p) => p.patientId === currentMember.patientId);
    const reports = sReadJson("carewell_reports", []).filter((r) => r.patientId === currentMember.patientId);
    const visits = sReadJson("carewell_visits", []).filter((v) => v.patientId === currentMember.patientId);
    const allAppointments = typeof getAppointments === "function" ? getAppointments() : sReadJson("carewell_appointments", []);
    const memberAppointments = allAppointments.filter((a) => a.phone === "9811111111");

    container.innerHTML = `
      <div class="bg-white rounded-3xl border border-emerald-100 overflow-hidden shadow-sm">
        <!-- Patient Profile Header & Family Switcher -->
        <div class="bg-mint border-b border-emerald-100 p-5 sm:p-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl bg-tealbrand text-white font-display text-lg flex items-center justify-center font-bold">
                ${sEscapeHtml(currentMember.name.split(" ").map((n) => n[0]).join(""))}
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-display text-xl text-slate-900">${sEscapeHtml(currentMember.name)}</h3>
                  <span class="text-xs px-2.5 py-0.5 rounded-full bg-tealbrand text-white font-mono font-medium">${sEscapeHtml(currentMember.patientId)}</span>
                </div>
                <p class="text-xs text-slate-600 mt-0.5">
                  Age: ${currentMember.age} yrs · Relation: ${sEscapeHtml(currentMember.relation)} · Mobile: +91 ${sEscapeHtml(currentMember.phone)}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <span class="text-xs text-emerald-800 bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl font-medium flex items-center gap-1">
                <span class="icon icon-check text-tealbrand"></span>
                No Paper Files: Sab Digital
              </span>
              <button id="btn-portal-logout" type="button" class="text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium">
                Logout
              </button>
            </div>
          </div>

          <!-- Family Profile Selector Chips (Ek Login me Riya + Papa + Mummy + Baccha) -->
          <div class="mt-5 pt-4 border-t border-emerald-200/60">
            <p class="text-xs font-semibold text-tealbrand mb-2 flex items-center gap-1">
              <span class="icon icon-user"></span>
              Family Profiles Switcher (Ek Login Me 4 Members):
            </p>
            <div class="flex flex-wrap gap-2">
              ${family
                .map(
                  (mem) => `
                <button type="button" data-portal-member="${mem.patientId}" class="px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  mem.patientId === currentMember.patientId
                    ? "bg-tealbrand text-white shadow-sm"
                    : "bg-white text-slate-700 border border-emerald-200 hover:bg-emerald-50"
                }">
                   ${sEscapeHtml(mem.name)} (${sEscapeHtml(mem.relation)})
                </button>
              `
                )
                .join("")}
            </div>
          </div>
        </div>

        <!-- Portal Subnavigation Tabs -->
        <div class="flex border-b border-emerald-100 overflow-x-auto bg-slate-50/50 px-4">
          <button type="button" data-portal-tab="appointments" class="py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 ${
            activePortalTab === "appointments" ? "border-tealbrand text-tealbrand bg-white" : "border-transparent text-slate-500 hover:text-slate-800"
          }">
             My Appointments (${memberAppointments.length})
          </button>
          <button type="button" data-portal-tab="prescriptions" class="py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 ${
            activePortalTab === "prescriptions" ? "border-tealbrand text-tealbrand bg-white" : "border-transparent text-slate-500 hover:text-slate-800"
          }">
             Prescriptions (${prescriptions.length})
          </button>
          <button type="button" data-portal-tab="reports" class="py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 ${
            activePortalTab === "reports" ? "border-tealbrand text-tealbrand bg-white" : "border-transparent text-slate-500 hover:text-slate-800"
          }">
             Medical Reports (${reports.length})
          </button>
          <button type="button" data-portal-tab="history" class="py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 ${
            activePortalTab === "history" ? "border-tealbrand text-tealbrand bg-white" : "border-transparent text-slate-500 hover:text-slate-800"
          }">
            ⏳ Visit History (${visits.length})
          </button>
          <button type="button" data-portal-tab="card" class="py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 ${
            activePortalTab === "card" ? "border-tealbrand text-tealbrand bg-white" : "border-transparent text-slate-500 hover:text-slate-800"
          }">
             Digital Health Card
          </button>
        </div>

        <!-- Portal Content Tab Body -->
        <div class="p-6">
          ${renderPortalTabContent(activePortalTab, currentMember, memberAppointments, prescriptions, reports, visits)}
        </div>
      </div>
    `;

    // Bindings
    $s("#btn-portal-logout")?.addEventListener("click", () => {
      portalLoggedIn = false;
      renderPortalPanel();
      sRefreshIcons();
    });

    $$s("[data-portal-member]").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentPortalMemberId = btn.dataset.portalMember;
        renderPortalPanel();
        sRefreshIcons();
      });
    });

    $$s("[data-portal-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activePortalTab = btn.dataset.portalTab;
        renderPortalPanel();
        sRefreshIcons();
      });
    });

    sRefreshIcons();
  }

  function renderPortalTabContent(tab, member, appointments, prescriptions, reports, visits) {
    if (tab === "appointments") {
      return `
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h4 class="font-semibold text-sm text-slate-800">Upcoming & Past Appointments for ${sEscapeHtml(member.name)}</h4>
            <button type="button" data-open-booking class="text-xs px-3 py-1.5 rounded-xl bg-tealbrand text-white font-semibold hover:bg-teal-700">
              + Naya Slot Book Karo
            </button>
          </div>
          ${
            appointments.length === 0
              ? `<p class="text-xs text-slate-500 py-6 text-center">Is member ke liye koi active booking nahi hai.</p>`
              : `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${appointments
                .map(
                  (a) => `
                <div class="p-4 rounded-2xl border border-emerald-100 bg-mint/40 flex flex-col justify-between">
                  <div>
                    <div class="flex items-center justify-between text-xs">
                      <span class="font-mono font-semibold text-tealbrand">${sEscapeHtml(a.bookingId || a.token)}</span>
                      <span class="px-2 py-0.5 rounded-full font-semibold ${
                        a.status === "confirmed" ? "bg-emerald-100 text-tealbrand" : a.status === "cancelled" ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"
                      }">
                        ${sEscapeHtml(a.status || "confirmed")}
                      </span>
                    </div>
                    <p class="text-base font-semibold text-slate-900 mt-2">${sEscapeHtml(a.reason || "General Consultation")}</p>
                    <p class="text-xs text-slate-600 mt-1">
                       ${sEscapeHtml(a.date)} · ⏰ ${sEscapeHtml(a.slot)} · <strong>Token No: ${sEscapeHtml(a.tokenNo || 12)}</strong>
                    </p>
                  </div>
                  <div class="mt-4 pt-3 border-t border-emerald-100 flex items-center justify-between text-xs">
                    <span class="text-slate-500">OPD Desk Confirmed</span>
                    ${
                      a.status !== "cancelled"
                        ? `<button type="button" data-cancel="${a.id}" class="text-red-600 hover:underline font-medium">Cancel Karo</button>`
                        : `<span class="text-red-500 font-medium">Cancelled</span>`
                    }
                  </div>
                </div>
              `
                )
                .join("")}
            </div>
          `
          }
        </div>
      `;
    }

    if (tab === "prescriptions") {
      return `
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="font-semibold text-sm text-slate-800">Doctor Prescriptions (Digital Dawai Slip)</h4>
              <p class="text-xs text-slate-500">Date aur Doctor ke naam ke saath poori list. PDF download karein ya print nikalein.</p>
            </div>
          </div>
          ${
            prescriptions.length === 0
              ? `<p class="text-xs text-slate-500 py-6 text-center">Is member ke liye koi digital prescription abhi upload nahi hai.</p>`
              : `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${prescriptions
                .map(
                  (rx) => `
                <div class="p-5 rounded-2xl border border-emerald-100 bg-white shadow-sm flex flex-col justify-between">
                  <div>
                    <div class="flex items-center justify-between text-xs pb-2 border-b border-emerald-100">
                      <span class="font-semibold text-tealbrand">${sEscapeHtml(rx.doctor)}</span>
                      <span class="text-slate-500 font-mono"> ${sEscapeHtml(rx.date)}</span>
                    </div>
                    <div class="mt-3 text-xs leading-relaxed text-slate-800 bg-mint/50 p-3 rounded-xl border border-emerald-100">
                      <span class="text-[10px] font-bold text-tealbrand uppercase tracking-wider block mb-1">Rx Prescribed Medicines</span>
                      <p class="font-medium">${sEscapeHtml(rx.text)}</p>
                    </div>
                  </div>
                  <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span class="text-[11px] text-slate-500">Patient: ${sEscapeHtml(member.name)}</span>
                    <button type="button" onclick="window.CareWellSystem.openPrescriptionModal('${rx.id}')" class="px-3 py-1.5 rounded-xl bg-tealbrand text-white text-xs font-semibold hover:bg-teal-700 flex items-center gap-1.5">
                      <span class="icon icon-download"></span> PDF Download / Print
                    </button>
                  </div>
                </div>
              `
                )
                .join("")}
            </div>
          `
          }
        </div>
      `;
    }

    if (tab === "reports") {
      return `
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="font-semibold text-sm text-slate-800">Medical Reports (Blood Test, X-Ray, Sugar)</h4>
              <p class="text-xs text-slate-500">Laboratory aur imaging reports digitally safe hain.</p>
            </div>
          </div>
          ${
            reports.length === 0
              ? `<p class="text-xs text-slate-500 py-6 text-center">Is member ke liye koi lab report uploaded nahi hai.</p>`
              : `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${reports
                .map(
                  (rep) => `
                <div class="p-5 rounded-2xl border border-emerald-100 bg-white shadow-sm flex flex-col justify-between">
                  <div>
                    <div class="flex items-center justify-between text-xs pb-2 border-b border-emerald-100">
                      <span class="px-2 py-0.5 rounded-full bg-mint text-tealbrand font-semibold">${sEscapeHtml(rep.type)}</span>
                      <span class="text-slate-500 font-mono">${sEscapeHtml(rep.date)}</span>
                    </div>
                    <h5 class="text-base font-semibold text-slate-900 mt-2">${sEscapeHtml(rep.name)}</h5>
                    <p class="text-xs text-slate-600 mt-1">Doctor Note: ${sEscapeHtml(rep.note || "Correlation normal.")}</p>
                  </div>
                  <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span class="text-[11px] text-emerald-700 font-medium"> Verified by Lab</span>
                    <button type="button" onclick="window.CareWellSystem.openReportModal('${rep.id}')" class="px-3 py-1.5 rounded-xl border border-emerald-200 bg-mint text-tealbrand text-xs font-semibold hover:bg-emerald-100 flex items-center gap-1.5">
                      <span class="icon icon-file-text"></span> View / Download
                    </button>
                  </div>
                </div>
              `
                )
                .join("")}
            </div>
          `
          }
        </div>
      `;
    }

    if (tab === "history") {
      return `
        <div class="space-y-4">
          <div>
            <h4 class="font-semibold text-sm text-slate-800">Visit History Timeline for ${sEscapeHtml(member.name)}</h4>
            <p class="text-xs text-slate-500">12 Nov Fever, 10 Nov X-Ray, 05 Nov Checkup — Poori digital timeline.</p>
          </div>
          <div class="relative border-l-2 border-emerald-200 ml-4 pl-6 space-y-6 py-2">
            ${visits
              .map(
                (v) => `
              <div class="relative">
                <span class="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-tealbrand border-2 border-white"></span>
                <span class="text-xs font-mono font-semibold text-tealbrand">${sEscapeHtml(v.date)}</span>
                <h5 class="text-sm font-semibold text-slate-900 mt-0.5">${sEscapeHtml(v.label)}</h5>
                <p class="text-xs text-slate-500 mt-0.5">CareWell OPD · Doctor consultation & diagnostic checkup completed.</p>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    if (tab === "card") {
      return `
        <div class="max-w-md mx-auto p-6 rounded-3xl bg-gradient-to-br from-tealbrand via-emerald-800 to-slate-900 text-white shadow-xl">
          <div class="flex items-center justify-between pb-4 border-b border-white/20">
            <div>
              <p class="text-[10px] uppercase tracking-wider text-emerald-200 font-semibold">CareWell Digital Health ID</p>
              <h4 class="font-display text-2xl font-bold mt-0.5">${sEscapeHtml(member.name)}</h4>
            </div>
            <span class="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center font-bold font-display text-lg">
              CW
            </span>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span class="text-slate-300 block text-[11px]">Patient ID</span>
              <span class="font-mono font-bold text-base text-emerald-300">${sEscapeHtml(member.patientId)}</span>
            </div>
            <div>
              <span class="text-slate-300 block text-[11px]">Relation & Age</span>
              <span class="font-semibold text-white">${sEscapeHtml(member.relation)} · ${member.age} yrs</span>
            </div>
            <div>
              <span class="text-slate-300 block text-[11px]">Contact Mobile</span>
              <span class="font-mono text-white">+91 ${sEscapeHtml(member.phone)}</span>
            </div>
            <div>
              <span class="text-slate-300 block text-[11px]">Blood Group</span>
              <span class="font-bold text-amber-300">B+ Positive</span>
            </div>
          </div>
          <div class="mt-5 pt-4 border-t border-white/20 flex items-center justify-between">
            <span class="text-[11px] text-emerald-200">OPD QR Quick Check-in Armed</span>
            <div class="w-12 h-12 bg-white rounded-xl p-1 flex items-center justify-center shadow-xs">
              <span class="icon icon-check"></span>
            </div>
          </div>
        </div>
      `;
    }

    return "";
  }

  // -------------------------------------------------------------
  // 5. CLINIC / DOCTOR ADMIN DESK (#admin-panel)
  // Dashboard, Appointments Manager, Patients Manager with Add Rx,
  // Doctors Manager (Multi-Doctor), Follow-up System, Reports & Analytics, Slot Control
  // -------------------------------------------------------------
  function renderAdminPanel() {
    const container = $s("#admin-panel");
    if (!container) return;

    const appointments = typeof getAppointments === "function" ? getAppointments() : sReadJson("carewell_appointments", []);
    const confirmedCount = appointments.filter((a) => a.status === "confirmed" || a.status === "booked").length;
    const doneCount = appointments.filter((a) => a.status === "done").length || 4;
    const noShowCount = appointments.filter((a) => a.status === "noshow").length || 2;
    const cancelledCount = appointments.filter((a) => a.status === "cancelled").length;
    const totalToday = confirmedCount + doneCount + noShowCount;

    container.innerHTML = `
      <div class="bg-white rounded-3xl border border-emerald-100 overflow-hidden shadow-sm">
        <!-- Admin Desk Subtabs -->
        <div class="bg-mint border-b border-emerald-100 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-tealbrand"></span>
            <span class="font-display text-base font-bold text-slate-900">CareWell Clinic Admin & Doctor Desk</span>
          </div>

          <div class="flex flex-wrap gap-1">
            <button type="button" data-admin-subtab="dashboard" class="px-3 py-1.5 text-xs font-semibold rounded-xl ${
              currentAdminTab === "dashboard" ? "bg-tealbrand text-white" : "bg-white text-slate-700 hover:bg-emerald-50"
            }">
               Dashboard
            </button>
            <button type="button" data-admin-subtab="appointments" class="px-3 py-1.5 text-xs font-semibold rounded-xl ${
              currentAdminTab === "appointments" ? "bg-tealbrand text-white" : "bg-white text-slate-700 hover:bg-emerald-50"
            }">
               Appointments (${appointments.length})
            </button>
            <button type="button" data-admin-subtab="patients" class="px-3 py-1.5 text-xs font-semibold rounded-xl ${
              currentAdminTab === "patients" ? "bg-tealbrand text-white" : "bg-white text-slate-700 hover:bg-emerald-50"
            }">
               Patients Manager
            </button>
            <button type="button" data-admin-subtab="doctors" class="px-3 py-1.5 text-xs font-semibold rounded-xl ${
              currentAdminTab === "doctors" ? "bg-tealbrand text-white" : "bg-white text-slate-700 hover:bg-emerald-50"
            }">
              ‍️ Doctors (${CareWellData.doctors.length})
            </button>
            <button type="button" data-admin-subtab="followups" class="px-3 py-1.5 text-xs font-semibold rounded-xl ${
              currentAdminTab === "followups" ? "bg-tealbrand text-white" : "bg-white text-slate-700 hover:bg-emerald-50"
            }">
               Follow-ups
            </button>
            <button type="button" data-admin-subtab="reports" class="px-3 py-1.5 text-xs font-semibold rounded-xl ${
              currentAdminTab === "reports" ? "bg-tealbrand text-white" : "bg-white text-slate-700 hover:bg-emerald-50"
            }">
               Reports & Analytics
            </button>
            <button type="button" data-admin-subtab="slots" class="px-3 py-1.5 text-xs font-semibold rounded-xl ${
              currentAdminTab === "slots" ? "bg-tealbrand text-white" : "bg-white text-slate-700 hover:bg-emerald-50"
            }">
               Slot Control
            </button>
          </div>
        </div>

        <!-- Admin Content Body -->
        <div class="p-6">
          ${renderAdminTabContent(currentAdminTab, appointments, totalToday, confirmedCount, doneCount, noShowCount, cancelledCount)}
        </div>
      </div>
    `;

    // Bind subtab switches
    $$s("[data-admin-subtab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentAdminTab = btn.dataset.adminSubtab;
        renderAdminPanel();
        sRefreshIcons();
      });
    });

    sRefreshIcons();
  }

  function renderAdminTabContent(tab, appointments, totalToday, confirmedCount, doneCount, noShowCount, cancelledCount) {
    // 1. DASHBOARD
    if (tab === "dashboard") {
      return `
        <div class="space-y-6">
          <!-- 4 Stats Cards -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="p-5 rounded-2xl border border-emerald-100 bg-mint/50">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Bookings</span>
              <p class="text-3xl font-display font-bold text-slate-900 mt-1">${totalToday}</p>
              <span class="text-xs text-tealbrand font-medium">Confirmed: ${confirmedCount} · Done: ${doneCount}</span>
            </div>

            <div class="p-5 rounded-2xl border border-emerald-100 bg-white">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">No-Show Rate</span>
              <div class="flex items-baseline gap-2 mt-1">
                <span class="text-3xl font-display font-bold text-emerald-600">3%</span>
                <span class="text-xs line-through text-slate-400">Pehle 12%</span>
              </div>
              <span class="text-xs text-emerald-600 font-medium">↓ 75% drop via WhatsApp alerts!</span>
            </div>

            <div class="p-5 rounded-2xl border border-emerald-100 bg-white">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's OPD Earning</span>
              <p class="text-3xl font-display font-bold text-slate-900 mt-1">₹7,200</p>
              <span class="text-xs text-slate-500">12 patients seen @ avg ₹600</span>
            </div>

            <div class="p-5 rounded-2xl border border-emerald-100 bg-mint/50">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monthly Earning Report</span>
              <p class="text-3xl font-display font-bold text-tealbrand mt-1">₹1,84,000</p>
              <span class="text-xs text-tealbrand font-medium">+18% vs last month</span>
            </div>
          </div>

          <!-- Quick Actions & Doctor Performance Overview -->
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-2 p-5 rounded-2xl border border-emerald-100 bg-white">
              <div class="flex items-center justify-between pb-3 border-b border-emerald-100">
                <h4 class="font-semibold text-sm text-slate-800">Doctor-wise OPD Today</h4>
                <span class="text-xs text-slate-500">Live Tokens & Patient Count</span>
              </div>
              <div class="mt-4 space-y-3">
                <div class="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-50">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-tealbrand text-white font-bold flex items-center justify-center">AR</div>
                    <div>
                      <p class="font-semibold text-slate-900">Dr. Ananya Rao (General)</p>
                      <p class="text-[11px] text-slate-500">Token 8 Serving · 4 in queue</p>
                    </div>
                  </div>
                  <span class="font-bold text-tealbrand text-sm">12 Patients</span>
                </div>

                <div class="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-50">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center">VS</div>
                    <div>
                      <p class="font-semibold text-slate-900">Dr. Vikram Shah (Cardiology)</p>
                      <p class="text-[11px] text-slate-500">Token 3 Serving · 2 in queue</p>
                    </div>
                  </div>
                  <span class="font-bold text-tealbrand text-sm">6 Patients</span>
                </div>
              </div>
            </div>

            <div class="p-5 rounded-2xl border border-emerald-100 bg-mint">
              <h4 class="font-semibold text-sm text-tealbrand">Quick Admin Operations</h4>
              <p class="text-xs text-slate-600 mt-1">One-click OPD actions</p>
              <div class="mt-4 space-y-2">
                <button type="button" data-open-booking class="w-full h-10 px-4 rounded-xl bg-tealbrand text-white text-xs font-semibold hover:bg-teal-700 flex items-center justify-center gap-2">
                  <span class="icon icon-check"></span> Book Walk-in Patient
                </button>
                <button type="button" onclick="window.CareWellSystem.triggerBroadcast('All Tomorrow Patients')" class="w-full h-10 px-4 rounded-xl border border-emerald-200 bg-white text-tealbrand text-xs font-semibold hover:bg-emerald-50 flex items-center justify-center gap-2">
                  <span class="icon icon-check"></span> Send Tomorrow's Reminders
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // 2. APPOINTMENTS MANAGER
    if (tab === "appointments") {
      return `
        <div class="space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 class="font-semibold text-sm text-slate-800">Saari Bookings ek Table me</h4>
              <p class="text-xs text-slate-500">Patient, Doctor, Date, Time, Token, Status & Instant Actions</p>
            </div>
            <button type="button" data-open-booking class="text-xs px-3.5 py-2 rounded-xl bg-tealbrand text-white font-semibold hover:bg-teal-700 shrink-0">
              + New Appointment
            </button>
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
                ${appointments
                  .map((a) => {
                    const doc = CareWellData.doctors.find((d) => d.id === a.doctorId);
                    return `
                    <tr class="hover:bg-mint/30">
                      <td class="p-3 font-mono font-semibold text-tealbrand">
                        ${sEscapeHtml(a.bookingId || a.token)}<br>
                        <span class="text-[10px] text-slate-500 font-normal">Token ${sEscapeHtml(a.tokenNo || 12)}</span>
                      </td>
                      <td class="p-3">
                        <span class="font-semibold text-slate-900">${sEscapeHtml(a.patientName)}</span><br>
                        <span class="text-[11px] text-slate-500">+91 ${sEscapeHtml(a.phone)}</span>
                      </td>
                      <td class="p-3">
                        <span class="font-medium text-slate-800">${sEscapeHtml(doc ? doc.name : a.doctorId)}</span><br>
                        <span class="text-[10px] text-slate-500">${sEscapeHtml(doc ? doc.specialty : "")}</span>
                      </td>
                      <td class="p-3">
                        <span class="font-semibold text-slate-800">${sEscapeHtml(a.date)}</span><br>
                        <span class="text-[11px] text-slate-600">${sEscapeHtml(a.slot)}</span>
                      </td>
                      <td class="p-3">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          a.status === "confirmed" ? "bg-emerald-100 text-tealbrand" : a.status === "done" ? "bg-blue-100 text-blue-700" : a.status === "noshow" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-600"
                        }">
                          ${sEscapeHtml(a.status || "confirmed")}
                        </span>
                      </td>
                      <td class="p-3 text-right space-x-1">
                        <button type="button" onclick="window.CareWellSystem.sendAppointmentReminder('${a.id}')" title="Send WhatsApp Reminder" class="px-2 py-1 rounded bg-mint text-tealbrand hover:bg-emerald-100 text-[11px] font-medium">
                           Remind
                        </button>
                        <button type="button" onclick="window.CareWellSystem.markStatus('${a.id}', 'done')" class="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-medium">
                           Done
                        </button>
                        <button type="button" onclick="window.CareWellSystem.markStatus('${a.id}', 'noshow')" class="px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 text-[11px] font-medium">
                          No-Show
                        </button>
                      </td>
                    </tr>
                  `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // 3. PATIENTS MANAGER
    if (tab === "patients") {
      const family = CareWellData.records?.family || [];
      return `
        <div class="space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 class="font-semibold text-sm text-slate-800">Patients Manager</h4>
              <p class="text-xs text-slate-500">Patient Search: Naam / Phone / Patient ID se. Poori History dekhein.</p>
            </div>
            <div class="flex gap-2">
              <button type="button" onclick="window.CareWellSystem.openAddPrescriptionModal()" class="text-xs px-3 py-1.5 rounded-xl bg-tealbrand text-white font-semibold hover:bg-teal-700">
                + Add Prescription
              </button>
              <button type="button" onclick="window.CareWellSystem.openUploadReportModal()" class="text-xs px-3 py-1.5 rounded-xl border border-emerald-200 bg-mint text-tealbrand font-semibold hover:bg-emerald-100">
                + Upload Lab Report
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${family
              .map(
                (p) => `
              <div class="p-5 rounded-2xl border border-emerald-100 bg-white shadow-sm">
                <div class="flex items-center justify-between pb-3 border-b border-emerald-100">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-mint text-tealbrand font-bold flex items-center justify-center font-display">
                      ${sEscapeHtml(p.name[0])}
                    </div>
                    <div>
                      <h5 class="font-semibold text-sm text-slate-900">${sEscapeHtml(p.name)} (${sEscapeHtml(p.relation)})</h5>
                      <span class="text-xs font-mono text-tealbrand">${sEscapeHtml(p.patientId)} · Mobile: +91 ${sEscapeHtml(p.phone)}</span>
                    </div>
                  </div>
                  <span class="text-xs text-slate-500">${p.age} yrs</span>
                </div>
                <div class="mt-3 flex items-center justify-between text-xs">
                  <span class="text-slate-600">Digital History: Rx, Blood Test, Timeline</span>
                  <button type="button" onclick="window.CareWellSystem.viewPatientHistory('${p.patientId}')" class="text-tealbrand font-semibold hover:underline">
                    View Full Profile →
                  </button>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    // 4. DOCTORS MANAGER (Multi-Doctor)
    if (tab === "doctors") {
      return `
        <div class="space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 class="font-semibold text-sm text-slate-800">Doctors Manager (Multi-Doctor System)</h4>
              <p class="text-xs text-slate-500">Doctor Add karo, Edit karo, Doctor-wise report & Best Doctor ka pata chalega.</p>
            </div>
            <button type="button" onclick="window.CareWellSystem.openAddDoctorModal()" class="text-xs px-3.5 py-2 rounded-xl bg-tealbrand text-white font-semibold hover:bg-teal-700 shrink-0">
              + Naya Doctor Add Karo
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${CareWellData.doctors
              .map((d, index) => {
                const isBest = index === 0; // Dr. Ananya Rao top doctor badge
                return `
                <div class="p-5 rounded-2xl border border-emerald-100 bg-white shadow-sm flex flex-col justify-between">
                  <div>
                    <div class="flex items-start justify-between">
                      <div>
                        <h5 class="font-semibold text-sm text-slate-900">${sEscapeHtml(d.name)}</h5>
                        <p class="text-xs font-medium text-tealbrand mt-0.5">${sEscapeHtml(d.specialty)}</p>
                      </div>
                      ${
                        isBest
                          ? `<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold"> Best Doctor</span>`
                          : `<span class="px-2 py-0.5 rounded-full bg-mint text-tealbrand text-[10px] font-semibold">${sEscapeHtml(d.location || "Pune")}</span>`
                      }
                    </div>
                    <p class="text-xs text-slate-500 mt-2">${sEscapeHtml(d.qualifications)} · ${d.experienceYears} yrs exp</p>
                    <p class="text-xs text-slate-700 mt-1 font-semibold">Consultation Fee: ₹${d.fee}</p>
                    <p class="text-[11px] text-slate-500 mt-1"> ${sEscapeHtml(d.timing || "Mon–Sat 9AM–1PM")}</p>
                  </div>
                  <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span class="text-slate-500">Rating:  ${d.rating || 4.8}</span>
                    <button type="button" onclick="window.CareWellSystem.toggleDoctorSlots('${d.id}')" class="text-xs font-medium text-tealbrand hover:underline">
                      Slot Khol/Band
                    </button>
                  </div>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      `;
    }

    // 5. FOLLOW-UP SYSTEM
    if (tab === "followups") {
      const followups = sReadJson("carewell_followups", CareWellData.records?.followups || []);
      return `
        <div class="space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 class="font-semibold text-sm text-slate-800">Automated Patient Follow-up System</h4>
              <p class="text-xs text-slate-500">BP / Diabetes / Vaccination Reminder — Purana patient wapas aayega, clinic earning badhegi.</p>
            </div>
            <button type="button" onclick="window.CareWellSystem.sendAllFollowups()" class="text-xs px-3.5 py-2 rounded-xl bg-tealbrand text-white font-semibold hover:bg-teal-700 shrink-0">
               Send All Due Reminders via WhatsApp
            </button>
          </div>

          <div class="divide-y divide-emerald-100 rounded-2xl border border-emerald-100 bg-white overflow-hidden">
            ${followups
              .map(
                (f) => `
              <div class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-sm text-slate-900">${sEscapeHtml(f.patient)}</span>
                    <span class="text-xs font-mono text-slate-500">+91 ${sEscapeHtml(f.phone)}</span>
                    <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">Due: ${sEscapeHtml(f.due)}</span>
                  </div>
                  <p class="text-xs text-slate-600 mt-1">${sEscapeHtml(f.reason)}</p>
                </div>
                <button type="button" onclick="window.CareWellSystem.sendSingleFollowup('${f.id}')" class="px-3.5 py-1.5 rounded-xl bg-mint text-tealbrand border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 shrink-0 flex items-center gap-1.5">
                  <span class="icon icon-send"></span> WhatsApp Reminder Bhejo
                </button>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    // 6. REPORTS & ANALYTICS
    if (tab === "reports") {
      return `
        <div class="space-y-6">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Doctor-wise Patient Count Bar Chart -->
            <div class="p-5 rounded-2xl border border-emerald-100 bg-white">
              <h4 class="font-semibold text-sm text-slate-800">Doctor-wise Patient Count Bar Chart</h4>
              <p class="text-xs text-slate-500 mt-0.5">Kaunse Doctor ke paas kitne patients aate hain</p>
              
              <div class="mt-5 space-y-3">
                <div>
                  <div class="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>Dr. Ananya Rao (General)</span>
                    <span class="font-bold text-tealbrand">12 Patients</span>
                  </div>
                  <div class="w-full bg-slate-100 rounded-full h-3.5">
                    <div class="bg-tealbrand h-3.5 rounded-full" style="width: 80%"></div>
                  </div>
                </div>

                <div>
                  <div class="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>Dr. Vikram Shah (Cardiology)</span>
                    <span class="font-bold text-tealbrand">6 Patients</span>
                  </div>
                  <div class="w-full bg-slate-100 rounded-full h-3.5">
                    <div class="bg-tealbrand h-3.5 rounded-full" style="width: 40%"></div>
                  </div>
                </div>

                <div>
                  <div class="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>Dr. Meera Iyer (Skin)</span>
                    <span class="font-bold text-tealbrand">8 Patients</span>
                  </div>
                  <div class="w-full bg-slate-100 rounded-full h-3.5">
                    <div class="bg-tealbrand h-3.5 rounded-full" style="width: 53%"></div>
                  </div>
                </div>

                <div>
                  <div class="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>Dr. Kabir Jain (Dental)</span>
                    <span class="font-bold text-tealbrand">5 Patients</span>
                  </div>
                  <div class="w-full bg-slate-100 rounded-full h-3.5">
                    <div class="bg-tealbrand h-3.5 rounded-full" style="width: 33%"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- No-Show Analysis by Day -->
            <div class="p-5 rounded-2xl border border-emerald-100 bg-white">
              <h4 class="font-semibold text-sm text-slate-800">No-Show Analysis (Kis din sabse zyada drop)</h4>
              <p class="text-xs text-slate-500 mt-0.5">WhatsApp Automation se pehle vs ab</p>
              
              <div class="mt-5 space-y-3">
                <div class="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50">
                  <span class="font-medium text-slate-700">Monday</span>
                  <span class="text-emerald-700 font-semibold">2% No-Show (Lowest)</span>
                </div>
                <div class="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50">
                  <span class="font-medium text-slate-700">Wednesday</span>
                  <span class="text-emerald-700 font-semibold">3% No-Show</span>
                </div>
                <div class="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50">
                  <span class="font-medium text-slate-700">Saturday</span>
                  <span class="text-amber-700 font-semibold">4.5% No-Show</span>
                </div>
              </div>
              <p class="text-xs text-tealbrand font-medium mt-4">
                 1 din pehle automated WhatsApp confirmation bhejne se 75% no-shows control ho gaye!
              </p>
            </div>
          </div>
        </div>
      `;
    }

    // 7. SLOT CONTROL
    if (tab === "slots") {
      return `
        <div class="space-y-4">
          <div>
            <h4 class="font-semibold text-sm text-slate-800">Doctor Slot Control</h4>
            <p class="text-xs text-slate-500">Doctor apne hisab se Slot Band / Khol sakta hai — "Kal main nahi hu".</p>
          </div>

          <div class="p-5 rounded-2xl border border-emerald-100 bg-white space-y-4 max-w-lg">
            <div>
              <label class="text-xs font-semibold text-slate-700 block mb-1">Doctor Select Karein</label>
              <select id="slot-ctrl-doctor" class="h-10 w-full px-3 text-sm rounded-xl border border-emerald-200 outline-none">
                ${CareWellData.doctors.map((d) => `<option value="${d.id}">${sEscapeHtml(d.name)}</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-700 block mb-1">Tareekh (Date)</label>
              <input id="slot-ctrl-date" type="date" value="${new Date().toISOString().split("T")[0]}" class="h-10 w-full px-3 text-sm rounded-xl border border-emerald-200 outline-none">
            </div>
            <div class="pt-2 flex gap-3">
              <button type="button" onclick="window.CareWellSystem.blockDoctorDay(true)" class="flex-1 h-11 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700">
                 "Kal Main Nahi Hu" (Full Day Band)
              </button>
              <button type="button" onclick="window.CareWellSystem.blockDoctorDay(false)" class="flex-1 h-11 rounded-xl bg-tealbrand text-white text-xs font-semibold hover:bg-teal-700">
                 Khol Do (Open Slots)
              </button>
            </div>
          </div>
        </div>
      `;
    }

    if (tab === "card") {
      return `
        <div class="max-w-md mx-auto p-6 rounded-3xl bg-gradient-to-br from-tealbrand via-emerald-800 to-slate-900 text-white shadow-xl">
          <div class="flex items-center justify-between pb-4 border-b border-white/20">
            <div>
              <p class="text-[10px] uppercase tracking-wider text-emerald-200 font-semibold">CareWell Digital Health ID</p>
              <h4 class="font-display text-2xl font-bold mt-0.5">${sEscapeHtml(member.name)}</h4>
            </div>
            <span class="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center font-bold font-display text-lg">
              CW
            </span>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span class="text-slate-300 block text-[11px]">Patient ID</span>
              <span class="font-mono font-bold text-base text-emerald-300">${sEscapeHtml(member.patientId)}</span>
            </div>
            <div>
              <span class="text-slate-300 block text-[11px]">Relation & Age</span>
              <span class="font-semibold text-white">${sEscapeHtml(member.relation)} · ${member.age} yrs</span>
            </div>
            <div>
              <span class="text-slate-300 block text-[11px]">Contact Mobile</span>
              <span class="font-mono text-white">+91 ${sEscapeHtml(member.phone)}</span>
            </div>
            <div>
              <span class="text-slate-300 block text-[11px]">Blood Group</span>
              <span class="font-bold text-amber-300">B+ Positive</span>
            </div>
          </div>
          <div class="mt-5 pt-4 border-t border-white/20 flex items-center justify-between">
            <span class="text-[11px] text-emerald-200">OPD QR Quick Check-in Armed</span>
            <div class="w-12 h-12 bg-white rounded-xl p-1 flex items-center justify-center shadow-xs">
              <span class="icon icon-check"></span>
            </div>
          </div>
        </div>
      `;
    }

    return "";
  }

  // -------------------------------------------------------------
  // UNIVERSAL MODALS CONTAINER & POPUPS
  // -------------------------------------------------------------
  function ensureModalContainer() {
    let container = $s("#carewell-system-modals");
    if (!container) {
      container = document.createElement("div");
      container.id = "carewell-system-modals";
      document.body.appendChild(container);
    }
    return container;
  }

  function showModalHtml(html) {
    const container = ensureModalContainer();
    container.innerHTML = `
      <div id="system-modal-backdrop" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div id="system-modal-dialog" class="bg-white rounded-3xl border border-emerald-100 shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
          ${html}
        </div>
      </div>
    `;
    sRefreshIcons();
    // close button & backdrop binding
    $s("#modal-close-btn")?.addEventListener("click", closeModalHtml);
    $s("#system-modal-backdrop")?.addEventListener("click", (e) => {
      if (e.target && e.target.id === "system-modal-backdrop") closeModalHtml();
    });
  }

  function closeModalHtml() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    const container = $s("#carewell-system-modals");
    if (container) container.innerHTML = "";
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const container = $s("#carewell-system-modals");
      if (container && container.innerHTML.trim() !== "") closeModalHtml();
    }
  });

  // -------------------------------------------------------------
  // PUBLIC SYSTEM ACTIONS (window.CareWellSystem)
  // -------------------------------------------------------------
  window.CareWellSystem = {
    refresh() {
      renderQueuePanel();
      renderWhatsAppPanel();
      renderCallsPanel();
      renderPortalPanel();
      renderAdminPanel();
    },

    openPrescriptionModal(rxId) {
      const list = sReadJson("carewell_prescriptions", []);
      const rx = list.find((item) => item.id === rxId) || list[0];
      if (!rx) return;

      showModalHtml(`
        <div class="p-6 sm:p-8" id="printable-rx">
          <div class="flex items-start justify-between border-b-2 border-tealbrand pb-4">
            <div>
              <h3 class="font-display text-2xl font-bold text-tealbrand">CareWell Clinic</h3>
              <p class="text-xs text-slate-500">214, MG Road, Camp, Pune · OPD Monday-Saturday</p>
            </div>
            <button id="modal-close-btn" type="button" class="text-slate-400 hover:text-slate-600 p-1">
              <span class="icon icon-close"></span>
            </button>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600 pb-3 border-b border-slate-100">
            <p><strong>Doctor:</strong> ${sEscapeHtml(rx.doctor)}</p>
            <p class="text-right"><strong>Date:</strong> ${sEscapeHtml(rx.date)}</p>
            <p><strong>Patient ID:</strong> ${sEscapeHtml(rx.patientId || "CW-2048")}</p>
            <p class="text-right"><strong>Rx Slip No:</strong> ${sEscapeHtml(rx.id)}</p>
          </div>

          <div class="mt-5 bg-mint/50 p-4 rounded-2xl border border-emerald-200">
            <span class="font-display text-2xl text-tealbrand font-bold">℞</span>
            <p class="text-sm text-slate-900 mt-2 font-medium leading-relaxed">${sEscapeHtml(rx.text)}</p>
          </div>

          <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Verified Digital Prescription</span>
            <div class="text-right font-script">
              <span class="block border-b border-slate-400 pb-1 w-28 text-center">${sEscapeHtml(rx.doctor)}</span>
              <span class="text-[10px] text-slate-400">Doctor Signature</span>
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-2">
            <button type="button" onclick="window.print()" class="px-4 py-2 rounded-xl bg-tealbrand text-white text-xs font-semibold hover:bg-teal-700 flex items-center gap-1.5">
              <span class="icon icon-check"></span> Print / Save as PDF
            </button>
          </div>
        </div>
      `);
    },

    openReportModal(repId) {
      const list = sReadJson("carewell_reports", []);
      const rep = list.find((item) => item.id === repId) || list[0];
      if (!rep) return;

      showModalHtml(`
        <div class="p-6 sm:p-8">
          <div class="flex items-start justify-between border-b border-emerald-100 pb-4">
            <div>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-mint text-tealbrand">${sEscapeHtml(rep.type)}</span>
              <h3 class="font-display text-xl font-bold text-slate-900 mt-1">${sEscapeHtml(rep.name)}</h3>
            </div>
            <button id="modal-close-btn" type="button" class="text-slate-400 hover:text-slate-600 p-1">
              <span class="icon icon-close"></span>
            </button>
          </div>

          <div class="mt-4 text-xs text-slate-600 space-y-2">
            <p><strong>Date of Test:</strong> ${sEscapeHtml(rep.date)}</p>
            <p><strong>Patient ID:</strong> ${sEscapeHtml(rep.patientId)}</p>
            <p class="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium">
              Lab Findings / Clinical Note:<br>
              ${sEscapeHtml(rep.note || "No acute abnormal findings detected. Physician correlation advised.")}
            </p>
          </div>

          <div class="mt-6 flex justify-end gap-2">
            <button type="button" onclick="window.print()" class="px-4 py-2 rounded-xl bg-tealbrand text-white text-xs font-semibold hover:bg-teal-700 flex items-center gap-1.5">
              <span class="icon icon-download"></span> Download Report PDF
            </button>
          </div>
        </div>
      `);
    },

    openAICallModal(initialQuestion = "") {
      const modalHtml = `
        <div class="p-5 sm:p-7 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white rounded-3xl relative overflow-hidden flex flex-col max-h-[88vh]" id="ai-voice-modal-content">
          <!-- Modal Header -->
          <div class="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
            <div class="flex items-center gap-3">
              <span class="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-tealbrand/30 text-emerald-300 flex items-center justify-center font-bold border border-emerald-400/30 shadow-lg shadow-tealbrand/10">
                <span class="icon icon-bot icon-lg"></span>
              </span>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-display text-base sm:text-lg font-bold text-white">CareWell 24/7 Clinic AI Receptionist</h3>
                  <span class="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold uppercase tracking-wider hidden sm:inline-block">
                    24/7 Night Care Active
                  </span>
                </div>
                <p class="text-[11px] text-emerald-400 flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
                  <span id="ai-voice-status-badge">Live Voice Active · Speech & Audio Ready</span>
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button id="modal-voice-toggle-btn" type="button" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900 transition flex items-center gap-1.5 cursor-pointer">
                <span class="icon icon-volume icon-xs"></span>
                <span id="modal-audio-text">Audio: ${window.isVoiceAudioEnabled ? "ON" : "OFF"}</span>
              </button>
              <button id="modal-close-btn" type="button" class="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer" aria-label="Close modal">
                <span class="icon icon-close icon-sm"></span>
              </button>
            </div>
          </div>

          <!-- Active Mic & Waveform Visualizer Banner -->
          <div id="ai-active-wave-bar" class="py-2.5 px-4 my-2.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-3">
              <button id="btn-hero-mic-toggle" type="button" class="w-10 h-10 rounded-full bg-tealbrand hover:bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md transition transform active:scale-95 cursor-pointer" title="Click to speak with voice">
                <span class="icon icon-mic icon-md"></span>
              </button>
              <div>
                <p id="ai-mic-instruction" class="text-xs font-medium text-slate-200">Tap mic to speak or record voice note</p>
                <p class="text-[10px] text-slate-400">Hindi / Hinglish / English voice commands supported</p>
              </div>
            </div>
            <div class="flex items-center gap-1 h-5" id="wave-bars-container">
              <div class="wave-bar w-1 h-3 rounded-full bg-emerald-400 transition-all duration-150"></div>
              <div class="wave-bar w-1 h-5 rounded-full bg-emerald-400 transition-all duration-150"></div>
              <div class="wave-bar w-1 h-2 rounded-full bg-emerald-400 transition-all duration-150"></div>
              <div class="wave-bar w-1 h-4 rounded-full bg-emerald-400 transition-all duration-150"></div>
              <div class="wave-bar w-1 h-3 rounded-full bg-emerald-400 transition-all duration-150"></div>
            </div>
          </div>

          <!-- Scrollable Chat Messages Stream -->
          <div id="ai-chat-messages" class="flex-1 overflow-y-auto space-y-3.5 pr-1 my-2 text-xs leading-relaxed min-h-[220px] max-h-[360px]">
            <!-- Initial Greeting from AI -->
            <div class="flex gap-2.5 items-start">
              <span class="w-7 h-7 rounded-full bg-tealbrand text-white flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold shadow-xs">
                <span class="icon icon-bot icon-xs text-white"></span>
              </span>
              <div class="p-3.5 rounded-2xl bg-white/10 border border-white/10 text-slate-100 max-w-[85%] space-y-1.5">
                <p class="font-semibold text-emerald-300">Namaste! CareWell Clinic 24/7 AI Receptionist bol raha hoon.</p>
                <p>Clinic OPD, Doctor consultation, Fees, Token status, ya raat ki emergency ke baare me kuch bhi poochhein. Aap mic dabakar bol sakte hain ya type karein.</p>
                <button type="button" class="btn-replay-speech text-[10px] text-emerald-300 hover:underline flex items-center gap-1 pt-1 font-medium cursor-pointer" data-speech="Namaste! CareWell Clinic 24/7 AI Receptionist bol raha hoon. Clinic OPD, Doctor consultation, Fees, Token status ya emergency ke baare me poochhein.">
                  <span class="icon icon-volume icon-xs"></span> Suniye (Play Audio)
                </button>
              </div>
            </div>
          </div>

          <!-- Quick Clinic Questions Carousel / Chips -->
          <div class="pt-2 border-t border-white/10 shrink-0">
            <p class="text-[10px] text-emerald-300 font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
              <span>Quick Questions (Tap to Ask & Listen):</span>
            </p>
            <div class="flex gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
              <button type="button" data-ai-q="Dr. Ananya Rao (General Physician) ki timing aur fees kya hai?" class="btn-quick-q shrink-0 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-emerald-500/20 border border-white/15 text-slate-200 hover:text-white transition whitespace-nowrap cursor-pointer">
                Dr. Rao timing & fees
              </button>
              <button type="button" data-ai-q="Bacche ko bukhar hai, Pediatrician doctor kab milenge?" class="btn-quick-q shrink-0 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-emerald-500/20 border border-white/15 text-slate-200 hover:text-white transition whitespace-nowrap cursor-pointer">
                Bacche ke doctor (Pediatrician)
              </button>
              <button type="button" data-ai-q="Daant me dard hai, Dentist available hai kya?" class="btn-quick-q shrink-0 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-emerald-500/20 border border-white/15 text-slate-200 hover:text-white transition whitespace-nowrap cursor-pointer">
                Dental doctor & fees
              </button>
              <button type="button" data-ai-q="Raat ko clinic band hone ke baad call uthayega kya?" class="btn-quick-q shrink-0 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-emerald-500/20 border border-white/15 text-slate-200 hover:text-white transition whitespace-nowrap cursor-pointer">
                Raat ko AI call uthayega?
              </button>
              <button type="button" data-ai-q="Abhi live token number kitna chal raha hai?" class="btn-quick-q shrink-0 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-emerald-500/20 border border-white/15 text-slate-200 hover:text-white transition whitespace-nowrap cursor-pointer">
                Live OPD Token Status
              </button>
              <button type="button" data-ai-q="Skin allergy aur pimples ke liye kaunse doctor hain?" class="btn-quick-q shrink-0 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-emerald-500/20 border border-white/15 text-slate-200 hover:text-white transition whitespace-nowrap cursor-pointer">
                Skin / Allergy doctor
              </button>
              <button type="button" data-ai-q="Clinic ka address aur Google Maps location kya hai?" class="btn-quick-q shrink-0 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-emerald-500/20 border border-white/15 text-slate-200 hover:text-white transition whitespace-nowrap cursor-pointer">
                Address & Map
              </button>
            </div>
          </div>

          <!-- Bottom Input Dock with Voice Commands & Recording -->
          <div class="mt-2.5 pt-2.5 border-t border-white/10 shrink-0">
            <div class="flex items-center gap-2">
              <button id="btn-voice-note-record" type="button" class="h-10 px-3 rounded-xl bg-white/10 hover:bg-emerald-500/20 border border-white/15 text-emerald-300 hover:text-emerald-200 text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer" title="Send Voice Note">
                <span class="icon icon-mic icon-xs text-emerald-400"></span>
                <span class="hidden sm:inline">Voice Note</span>
              </button>

              <div class="relative flex-1">
                <input id="ai-custom-q-input" type="text" placeholder="Apna sawal likhein ya mic dabayein..." class="h-10 w-full pl-3.5 pr-10 text-xs rounded-xl bg-white/10 border border-white/20 text-white outline-none focus:border-emerald-400 placeholder:text-slate-400 font-medium">
                <button id="btn-input-mic" type="button" class="absolute right-2 top-2 text-slate-400 hover:text-emerald-400 transition cursor-pointer" title="Speak via voice">
                  <span class="icon icon-mic icon-xs"></span>
                </button>
              </div>

              <button id="btn-submit-custom-q" type="button" class="h-10 px-4 rounded-xl bg-tealbrand hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 transition shrink-0 shadow-md cursor-pointer">
                <span>Send</span>
                <span class="icon icon-send icon-xs"></span>
              </button>
            </div>
          </div>
        </div>
      `;

      showModalHtml(modalHtml);
      sRefreshIcons();

      const chatContainer = $s("#ai-chat-messages");
      const textInput = $s("#ai-custom-q-input");
      const sendBtn = $s("#btn-submit-custom-q");
      const toggleAudioBtn = $s("#modal-voice-toggle-btn");
      const statusBadge = $s("#ai-voice-status-badge");
      const micInstruction = $s("#ai-mic-instruction");
      const heroMicBtn = $s("#btn-hero-mic-toggle");
      const inputMicBtn = $s("#btn-input-mic");
      const voiceNoteBtn = $s("#btn-voice-note-record");

      const scrollChatToBottom = () => {
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      };

      // Toggle Audio Button
      toggleAudioBtn?.addEventListener("click", () => {
        window.isVoiceAudioEnabled = !window.isVoiceAudioEnabled;
        toggleAudioBtn.querySelector("span:last-child").textContent = `Audio: ${window.isVoiceAudioEnabled ? "ON" : "OFF"}`;
        sShowToast(`AI Voice Audio: ${window.isVoiceAudioEnabled ? "ON (Bolkar batayega)" : "OFF (Muted)"}`);
        if (!window.isVoiceAudioEnabled && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      });

      // Clinical NLP Knowledge Base
      const getClinicalAnswer = (rawQuery) => {
        const q = String(rawQuery || "").toLowerCase();

        // 1. Fever / Bukhar / Cold / Viral / Dengue / Typhoid
        if (q.includes("bukhar") || q.includes("fever") || q.includes("sardi") || q.includes("cough") || q.includes("khansi") || q.includes("viral") || q.includes("dengue") || q.includes("sugar") || q.includes("diabetes") || q.includes("kamzori") || q.includes("general")) {
          return {
            text: "General Medicine aur Bukhar ke liye hamare Senior Physician Dr. Ananya Rao (MBBS, MD) Monday se Saturday subah 9:00 AM se 1:00 PM tak OPD me baithti hain. Consultation fee ₹500 hai. Hydration rakhein aur OPD slot turant reserve karein.",
            speech: "General Medicine aur Bukhar ke liye hamare Senior Physician Doctor Ananya Rao Monday se Saturday subah 9 se 1 baje tak available hain. Consultation fee 500 rupaye hai. Aap abhi slot book kar sakte hain."
          };
        }

        // 2. Pediatrics / Baccha / Baby / Child / Vaccines
        if (q.includes("baccha") || q.includes("child") || q.includes("baby") || q.includes("pedia") || q.includes("vaccine") || q.includes("teething") || q.includes("teeka")) {
          return {
            text: "Bacchon ki health, fever aur vaccination ke liye Dr. Sameer Khan (MBBS, MD Pediatrics) Monday se Saturday shaam 4:00 PM se 7:00 PM tak clinic mein hote hain. Consultation fee ₹600 hai. Purana vaccination card zaroor saath laayein.",
            speech: "Bacchon ki dekhbhaal aur vaccination ke liye Doctor Sameer Khan shaam 4 se 7 baje tak available hain. Fee 600 rupaye hai. Purana vaccine card saath laayein."
          };
        }

        // 3. Dental / Daant / Toothache / Root Canal / Cavity
        if (q.includes("daant") || q.includes("dent") || q.includes("tooth") || q.includes("teeth") || q.includes("keeda") || q.includes("cavity") || q.includes("braces") || q.includes("scaling")) {
          return {
            text: "Dental checkup, toothache aur root canal ke liye Dr. Kabir Jain (BDS, MDS) Monday se Saturday subah 10:00 AM se 2:00 PM tak available hain. Basic consultation fee sirf ₹350 hai. Clinic par digital dental X-ray ki suvidha bhi hai.",
            speech: "Toothache aur dental checkup ke liye Doctor Kabir Jain subah 10 se dopahar 2 baje tak available hain. Consultation fee sirf 350 rupaye hai."
          };
        }

        // 4. Dermatology / Skin / Allergy / Rash / Acne / Pimples / Baal
        if (q.includes("skin") || q.includes("allergy") || q.includes("rash") || q.includes("acne") || q.includes("pimple") || q.includes("khujli") || q.includes("baal") || q.includes("hair")) {
          return {
            text: "Skin allergy, acne aur rash ke liye Senior Dermatologist Dr. Meera Iyer (MBBS, MD Dermatology) Tuesday se Saturday subah 11:00 AM se 2:00 PM tak available hain. Consultation fee ₹700 hai.",
            speech: "Skin allergy aur acne ke liye Doctor Meera Iyer Tuesday se Saturday subah 11 se 2 baje tak available hain. Consultation fee 700 rupaye hai."
          };
        }

        // 5. ENT / Kaan / Naak / Gala / Throat / Sinus / Hearing
        if (q.includes("kaan") || q.includes("naak") || q.includes("gala") || q.includes("throat") || q.includes("ear") || q.includes("sinus") || q.includes("ent")) {
          return {
            text: "Kaan, naak aur gale ki bimari ke liye ENT Specialist Dr. Leela Nair (MBBS, MS ENT) Monday se Friday subah 9:00 AM se 12:30 PM tak clinic me hote hain. Consultation fee ₹650 hai.",
            speech: "Kaan, naak aur gale ke liye ENT specialist Doctor Leela Nair subah 9 se 12:30 baje tak available hain. Fee 650 rupaye hai."
          };
        }

        // 6. Orthopedics / Haddi / Joint / Knee / Ghutne / Back pain / Kamar dard
        if (q.includes("haddi") || q.includes("joint") || q.includes("knee") || q.includes("ghutne") || q.includes("back pain") || q.includes("kamar") || q.includes("ortho") || q.includes("fracture")) {
          return {
            text: "Joint pain, knee pain aur back pain ke liye Orthopedic Surgeon Dr. Arjun Patel (MBBS, MS Orthopedics) Monday se Friday subah 10:00 AM se 1:00 PM tak OPD me hote hain. Consultation fee ₹800 hai.",
            speech: "Haddi aur joint pain ke liye Doctor Arjun Patel subah 10 se 1 baje tak available hain. Consultation fee 800 rupaye hai."
          };
        }

        // 7. Cardiology / Heart / Chest Pain / BP / Dil
        if (q.includes("heart") || q.includes("dil") || q.includes("chest") || q.includes("bp") || q.includes("blood pressure") || q.includes("cardio") || q.includes("ecg")) {
          return {
            text: "Preventive Cardiology aur Blood Pressure review ke liye Dr. Vikram Shah (MBBS, MD, DM Cardiology) Monday se Saturday shaam 4:00 PM se 7:00 PM tak available hain. Fee ₹900 hai. Note: Severe emergency chest pain ho to turant helpline dial karein.",
            speech: "Heart aur BP consultation ke liye Doctor Vikram Shah shaam 4 se 7 baje tak available hain. Fee 900 rupaye hai."
          };
        }

        // 8. Raat ko call / 24/7 AI Receptionist / Night
        if (q.includes("raat") || q.includes("night") || q.includes("call uthayega") || q.includes("24/7") || q.includes("band hone ke baad") || q.includes("call")) {
          return {
            text: "Haan bilkul! Chahe raat ke 2 baje hon ya 3 baje, CareWell 24/7 AI Voice Assistant har call attend karta hai, patient ki complaint note karta hai aur subah 9:00 AM ka first priority token lock kar deta hai taaki aapka samay bache!",
            speech: "Haan bilkul! Chahe raat ke do baje ho, CareWell 24/7 AI Voice Assistant har call attend karta hai aur subah ka first priority slot confirm kar deta hai."
          };
        }

        // 9. Live Queue / Token Status
        if (q.includes("token") || q.includes("queue") || q.includes("line") || q.includes("number") || q.includes("wait")) {
          return {
            text: "Live OPD Token System: Is samay OPD desk par Token No. 8 chal raha hai. Agar aap abhi book karte hain to aapko Token No. 12 milega (approx 30 min wait). Number aane se 15 minute pehle aapko WhatsApp reminder bhi bhej diya jayega!",
            speech: "Live Queue Status: Abhi Token Number 8 chal raha hai. Aapka Token Number 12 lagbhag 30 minutes me aayega. Turn aane se 15 minute pehle WhatsApp alert aayega."
          };
        }

        // 10. Clinic Timing & OPD Hours
        if (q.includes("timing") || q.includes("time") || q.includes("open") || q.includes("khulta") || q.includes("sunday") || q.includes("hours")) {
          return {
            text: "CareWell Clinic OPD Timing: Monday se Saturday subah 9:00 AM se 1:00 PM aur shaam 4:00 PM se 7:00 PM tak open rehti hai. Sunday routine OPD closed rehti hai, emergency on-call doctor 24/7 available rehta hai.",
            speech: "CareWell Clinic Monday se Saturday subah 9 se 1 aur shaam 4 se 7 baje tak open rehti hai. Sunday ko emergency doctor on-call rehta hai."
          };
        }

        // 11. Fees / Charges / Kitna lagega / Price
        if (q.includes("fee") || q.includes("fees") || q.includes("charge") || q.includes("price") || q.includes("kharcha") || q.includes("kitna") || q.includes("rate")) {
          return {
            text: "Transparent Clinic Fees: Dental OPD ₹350, General Physician ₹500, Pediatrician ₹600, ENT ₹650, Skin ₹700, Ortho ₹800, Cardiology ₹900. Online slot reservation bilkul free hai, payment consultation ke waqt desk par karni hoti hai.",
            speech: "Hamari OPD consultation fees 350 rupaye se 800 rupaye ke beech hai. Online booking bilkul free hai."
          };
        }

        // 12. Address & Location
        if (q.includes("address") || q.includes("location") || q.includes("kahan") || q.includes("pune") || q.includes("camp") || q.includes("map")) {
          return {
            text: "Clinic Address: CareWell Multi-Speciality Clinic, 214, MG Road, Camp, Pune 411001 (Near Central Bank). Clinic landing page par interactive Google Maps link bhi uplabdh hai.",
            speech: "CareWell Clinic ka address hai: 214 MG Road, Camp, Pune. Near Central Bank."
          };
        }

        // 13. Emergency Helpline
        if (q.includes("emergency") || q.includes("accident") || q.includes("serious") || q.includes("casualty") || q.includes("ambulance")) {
          return {
            text: "24/7 Clinic Emergency Helpline: +91 98765 43210. Screen ke bottom par diye red Emergency button se 1 click mein on-call doctor ko direct call lag jata hai.",
            speech: "Emergency helpline number hai: 98765 43210. Screen ke Emergency button se direct doctor ko call karein."
          };
        }

        // 14. Doctor Booking general
        if (q.includes("doctor") || q.includes("appointment") || q.includes("book") || q.includes("slot") || q.includes("reschedule") || q.includes("cancel")) {
          return {
            text: "Aap kisi bhi doctor ke liye slot website ke Bookings section se 1 minute me book kar sakte hain. Bas apna 10-digit mobile number aur pasandida time select karein, Token turant mil jayega!",
            speech: "Doctor appointment book karne ke liye bas apna 10-digit mobile number aur slot select karein. Token turant mil jayega."
          };
        }

        // 15. Fallback Intelligent Greeting
        return {
          text: `Namaste! CareWell Clinic 24/7 AI Desk par aapka swagat hai. "${sEscapeHtml(rawQuery)}" ke baare mein humare doctors available hain. Aap OPD slot book karne ke liye apna naam aur phone number de sakte hain ya timing/fees pooch sakte hain.`,
          speech: `Namaste! CareWell Clinic me aapka swagat hai. Aap doctor appointment, clinic timing, fees ya OPD queue ke baare me pooch sakte hain.`
        };
      };

      // Function to post message in chat
      const appendChatMessage = (sender, content, audioText = "") => {
        if (!chatContainer) return;

        const isUser = sender === "user";
        const isVoiceNote = content.toLowerCase().includes("voice note");

        const msgHtml = isUser
          ? `
            <div class="flex gap-2.5 justify-end items-start animate-in fade-in">
              <div class="p-3.5 rounded-2xl bg-tealbrand text-white max-w-[85%] shadow-xs">
                ${isVoiceNote
                  ? `<div class="flex items-center gap-2 font-medium">
                      <span class="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">
                        <span class="icon icon-mic icon-xs text-white"></span>
                      </span>
                      <span>${sEscapeHtml(content)}</span>
                    </div>`
                  : `<p class="font-medium">${sEscapeHtml(content)}</p>`}
                <span class="text-[9px] text-teal-200 block text-right mt-1">Patient · Just now</span>
              </div>
              <span class="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                <span class="icon icon-user icon-xs text-white"></span>
              </span>
            </div>
          `
          : `
            <div class="flex gap-2.5 items-start animate-in fade-in">
              <span class="w-7 h-7 rounded-full bg-tealbrand text-white flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold shadow-xs">
                <span class="icon icon-bot icon-xs text-white"></span>
              </span>
              <div class="p-3.5 rounded-2xl bg-white/10 border border-white/10 text-slate-100 max-w-[85%] space-y-1.5">
                <p class="leading-relaxed">${content}</p>
                ${audioText
                  ? `<button type="button" class="btn-replay-speech text-[10px] text-emerald-300 hover:underline flex items-center gap-1 pt-1 font-medium cursor-pointer" data-speech="${sEscapeHtml(audioText)}">
                      <span class="icon icon-volume icon-xs"></span> Suniye (Play Audio)
                    </button>`
                  : ""}
                <span class="text-[9px] text-slate-400 block mt-1">CareWell AI · 24/7 Verified</span>
              </div>
            </div>
          `;

        chatContainer.insertAdjacentHTML("beforeend", msgHtml);
        sRefreshIcons();
        scrollChatToBottom();

        // Wire speech replay
        const newReplayBtns = chatContainer.querySelectorAll(".btn-replay-speech");
        const lastBtn = newReplayBtns[newReplayBtns.length - 1];
        lastBtn?.addEventListener("click", () => {
          speakVoice(lastBtn.dataset.speech || "");
        });
      };

      // Handler for user query
      const handleUserQuery = (queryText) => {
        if (!queryText || !queryText.trim()) return;
        const q = queryText.trim();

        appendChatMessage("user", q);

        if (statusBadge) statusBadge.textContent = "AI Soch raha hai...";

        setTimeout(() => {
          const res = getClinicalAnswer(q);
          appendChatMessage("ai", res.text, res.speech);
          speakVoice(res.speech);
          if (statusBadge) statusBadge.textContent = "Live Voice Active · Speech & Audio Ready";
        }, 350);
      };

      // Voice Queries rotation for fallback Voice Note
      const patientVoiceQueries = [
        "Doctor Ananya Rao (General Physician) ki timing aur fees kya hai?",
        "Bacche ko bukhar aur sardi hai, pediatrician kab milenge?",
        "Daant me dard hai, dental checkup ki fees kitni hai?",
        "Raat ko clinic band hone ke baad AI call uthayega kya?",
        "Abhi OPD desk par live token number kitna chal raha hai?",
        "Skin allergy aur rash ke liye kaunse doctor available hain?"
      ];
      let vqIndex = 0;

      // Smart Dual-Mode Voice Input (Web Speech API + Resilient Voice Note Engine)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      let recognition = null;
      let isListening = false;

      if (SpeechRecognition) {
        try {
          recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = false;
          recognition.lang = "hi-IN";

          recognition.onstart = () => {
            isListening = true;
            if (statusBadge) statusBadge.textContent = "Sun raha hoon... Boliye";
            if (micInstruction) micInstruction.textContent = "Listening... Aap boliye (Voice Active)";
            heroMicBtn?.classList.add("ring-4", "ring-emerald-400", "animate-pulse");
            $s("#wave-bars-container")?.classList.add("scale-110");
          };

          recognition.onresult = (event) => {
            const spoken = event.results[0][0].transcript;
            if (textInput) textInput.value = spoken;
            handleUserQuery(spoken);
          };

          recognition.onerror = (event) => {
            console.warn("Speech recognition fallback triggered:", event.error);
            isListening = false;
            triggerVoiceNoteFallback();
          };

          recognition.onend = () => {
            isListening = false;
            if (statusBadge) statusBadge.textContent = "Live Voice Active · Speech & Audio Ready";
            if (micInstruction) micInstruction.textContent = "Tap mic to speak or record voice note";
            heroMicBtn?.classList.remove("ring-4", "ring-emerald-400", "animate-pulse");
          };
        } catch (e) {
          recognition = null;
        }
      }

      function triggerVoiceNoteFallback() {
        const customTyped = textInput && textInput.value.trim();
        const queryToUse = customTyped || patientVoiceQueries[vqIndex++ % patientVoiceQueries.length];
        if (textInput) textInput.value = "";

        if (statusBadge) statusBadge.textContent = "Voice Note Recording (0:04)...";
        if (micInstruction) micInstruction.textContent = "Processing voice note audio...";
        heroMicBtn?.classList.add("ring-4", "ring-emerald-400", "animate-pulse");

        setTimeout(() => {
          heroMicBtn?.classList.remove("ring-4", "ring-emerald-400", "animate-pulse");
          if (statusBadge) statusBadge.textContent = "Live Voice Active · Speech & Audio Ready";
          if (micInstruction) micInstruction.textContent = "Tap mic to speak or record voice note";
          appendChatMessage("user", `Voice Note (0:04) · "${queryToUse}"`);
          
          setTimeout(() => {
            const res = getClinicalAnswer(queryToUse);
            appendChatMessage("ai", res.text, res.speech);
            speakVoice(res.speech);
          }, 350);
        }, 600);
      }

      const toggleListening = () => {
        const customTyped = textInput && textInput.value.trim();
        if (customTyped) {
          submitText();
          return;
        }

        if (recognition) {
          if (isListening) {
            recognition.stop();
          } else {
            try {
              recognition.start();
            } catch (e) {
              triggerVoiceNoteFallback();
            }
          }
        } else {
          triggerVoiceNoteFallback();
        }
      };

      heroMicBtn?.addEventListener("click", toggleListening);
      inputMicBtn?.addEventListener("click", toggleListening);
      voiceNoteBtn?.addEventListener("click", triggerVoiceNoteFallback);

      // Initial greeting replay button
      chatContainer?.querySelectorAll(".btn-replay-speech").forEach((btn) => {
        btn.addEventListener("click", () => {
          speakVoice(btn.dataset.speech || "");
        });
      });

      // Quick Questions
      $$s(".btn-quick-q").forEach((btn) => {
        btn.addEventListener("click", () => {
          handleUserQuery(btn.dataset.aiQ);
        });
      });

      // Submit custom text
      const submitText = () => {
        const val = textInput ? textInput.value : "";
        if (val && val.trim()) {
          handleUserQuery(val);
          textInput.value = "";
        }
      };

      sendBtn?.addEventListener("click", submitText);
      textInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submitText();
        }
      });

      // Initial question or initial speech
      if (initialQuestion) {
        handleUserQuery(initialQuestion);
      } else {
        speakVoice("Namaste! Main CareWell Clinic ka 24/7 AI Voice Assistant bol raha hoon. Doctor appointment ya clinic timing ke baare me poochhiye.");
      }
    },

    testWhatsAppAutoBooking(name = "Ritu Sharma", phone = "9811111111", service = "General Physician OPD Consultation", slot = "Tuesday 11:30 AM") {
      sShowToast(` WhatsApp Auto-Booking initiated for ${name}!`);

      const waModalHtml = `
        <div class="p-5 sm:p-7 bg-[#ECE5DD] rounded-3xl relative overflow-hidden" id="wa-reel-modal">
          <!-- WhatsApp Header -->
          <div class="bg-[#075E54] -m-5 sm:-m-7 p-4 sm:p-5 text-white flex items-center justify-between shadow-md mb-5">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-white text-[#075E54] flex items-center justify-center font-bold">
                <span class="icon icon-message"></span>
              </div>
              <div>
                <div class="flex items-center gap-1.5">
                  <h4 class="font-bold text-sm text-white">CareWell Clinic Bot</h4>
                  <span class="icon icon-check text-emerald-300"></span>
                </div>
                <p class="text-[11px] text-emerald-200">Official WhatsApp Business Account · Online</p>
              </div>
            </div>
            <button id="modal-close-btn" type="button" class="text-emerald-100 hover:text-white p-1">
              <span class="icon icon-close"></span>
            </button>
          </div>

          <!-- Chat Messages Container -->
          <div id="wa-reel-chat-box" class="space-y-3 py-2 min-h-[260px] text-xs">
            <!-- Message 1 from Bot -->
            <div class="flex justify-start animate-in fade-in">
              <div class="chat-bubble-bot p-3.5 shadow-xs max-w-[85%] text-slate-800">
                <p class="font-semibold text-[#075E54] mb-1">CareWell Clinic Automated System</p>
                <p>Namaste <strong>${sEscapeHtml(name)}</strong> ji!</p>
                <p class="mt-1">Aapka <strong>${sEscapeHtml(service)}</strong> slot <strong>${sEscapeHtml(slot)}</strong> hold ho gaya hai.</p>
                <p class="mt-2 text-slate-600 bg-emerald-50/80 p-2 rounded-lg border border-emerald-100 font-medium">
                  Confirm karne ke liye: <strong>"1"</strong> likhein<br>
                  Cancel karne ke liye: <strong>"2"</strong> likhein
                </p>
                <span class="text-[10px] text-slate-400 block text-right mt-1">Just now · Delivered</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="mt-4 pt-3 border-t border-slate-300/60 flex flex-col gap-2">
            <div id="wa-auto-reply-action" class="flex gap-2">
              <button id="btn-wa-reply-confirm" type="button" class="flex-1 py-2.5 rounded-xl bg-[#25D366] text-white font-bold text-xs hover:bg-[#1ebd5a] shadow-xs flex items-center justify-center gap-1.5 transition">
                <span>Reply "1" (Confirm Slot)</span>
                <span class="icon icon-send"></span>
              </button>
              <button id="btn-wa-reply-cancel" type="button" class="px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-medium text-xs hover:bg-slate-50 transition">
                Reply "2" (Cancel)
              </button>
            </div>
          </div>
        </div>
      `;

      showModalHtml(waModalHtml);
      sRefreshIcons();

      const chatBox = $s("#wa-reel-chat-box");
      const actionBox = $s("#wa-auto-reply-action");

      const simulateConfirm = () => {
        if (!chatBox) return;

        chatBox.innerHTML += `
          <div class="flex justify-end animate-in fade-in">
            <div class="chat-bubble-patient p-3 shadow-xs text-slate-900 max-w-[70%]">
              <p class="font-bold">1</p>
              <span class="text-[10px] text-slate-500 block text-right mt-0.5">Just now · Sent</span>
            </div>
          </div>
          <div id="typing-indicator" class="flex justify-start">
            <div class="chat-bubble-bot px-4 py-2.5 shadow-xs flex items-center gap-1">
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
            </div>
          </div>
        `;

        if (actionBox) actionBox.innerHTML = `<span class="text-xs text-slate-500 text-center w-full">Bot typing confirmation...</span>`;

        setTimeout(() => {
          $s("#typing-indicator")?.remove();
          chatBox.innerHTML += `
            <div class="flex justify-start animate-in fade-in">
              <div class="chat-bubble-bot p-3.5 shadow-xs max-w-[85%] text-slate-800 border-l-4 border-[#25D366]">
                <p class="font-bold text-tealbrand text-sm"> Thank You! Slot Confirmed.</p>
                <p class="mt-1">Aapka <strong>Token No. 12 (CW-2048)</strong> Dr. Ananya Rao ke paas book ho chuka hai.</p>
                <div class="mt-2 p-2 rounded-lg bg-mint text-slate-700 text-[11px] leading-relaxed">
                   Clinic Address: 214, MG Road, Camp, Pune.<br>
                   Number aane se <strong>15 minute pehle WhatsApp alert</strong> aayega taaki clinic me wait na karna pade!
                </div>
                <span class="text-[10px] text-slate-400 block text-right mt-1.5">Auto-Reply · Just now</span>
              </div>
            </div>
          `;

          if (actionBox) {
            actionBox.innerHTML = `
              <div class="flex gap-2 w-full">
                <a href="patient.html" class="flex-1 py-2 rounded-xl bg-tealbrand text-white font-semibold text-xs text-center flex items-center justify-center gap-1 shadow-xs">
                  <span>Open Patient Portal</span>
                  <span class="icon icon-check"></span>
                </a>
                <button type="button" onclick="window.CareWellSystem.closeAllModals()" class="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 font-semibold text-xs">
                  Done
                </button>
              </div>
            `;
            sRefreshIcons();
          }
        }, 1100);
      };

      const simulateCancel = () => {
        if (!chatBox) return;

        chatBox.innerHTML += `
          <div class="flex justify-end animate-in fade-in">
            <div class="chat-bubble-patient p-3 shadow-xs text-slate-900 max-w-[70%] bg-red-100 text-red-900">
              <p class="font-bold">2</p>
              <span class="text-[10px] text-slate-500 block text-right mt-0.5">Just now · Sent</span>
            </div>
          </div>
          <div class="flex justify-start animate-in fade-in mt-2">
            <div class="chat-bubble-bot p-3 shadow-xs max-w-[85%] text-slate-800">
              <p>Slot cancel kar diya gaya hai. Jab bhi appointment chahiye ho, website par aaiye ya message karein.</p>
            </div>
          </div>
        `;

        if (actionBox) {
          actionBox.innerHTML = `
            <button type="button" onclick="window.CareWellSystem.closeAllModals()" class="w-full py-2 rounded-xl bg-slate-200 text-slate-700 font-semibold text-xs">
              Close
            </button>
          `;
        }
      };

      $s("#btn-wa-reply-confirm")?.addEventListener("click", simulateConfirm);
      $s("#btn-wa-reply-cancel")?.addEventListener("click", simulateCancel);
    },

    openAddDoctorModal() {
      showModalHtml(`
        <div class="p-6 sm:p-8">
          <div class="flex items-center justify-between border-b border-emerald-100 pb-3">
            <h3 class="font-display text-lg text-slate-900">Add New Doctor (Multi-Doctor System)</h3>
            <button id="modal-close-btn" type="button" class="text-slate-400 hover:text-slate-600 p-1">
              <span class="icon icon-close"></span>
            </button>
          </div>
          <form id="form-add-doc" class="mt-4 space-y-3 text-xs">
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Doctor Name</label>
              <input id="new-doc-name" type="text" placeholder="Dr. Rajesh Verma" required class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none">
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Specialization</label>
                <input id="new-doc-spec" type="text" placeholder="General / Pediatrics / Skin" required class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none">
              </div>
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Fee (₹)</label>
                <input id="new-doc-fee" type="number" placeholder="500" required class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none">
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Location</label>
                <input id="new-doc-loc" type="text" placeholder="Pune / Bhiwadi / Jaipur" value="Pune" class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none">
              </div>
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Experience (Yrs)</label>
                <input id="new-doc-exp" type="number" placeholder="10" value="8" class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none">
              </div>
            </div>
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Timings</label>
              <input id="new-doc-time" type="text" placeholder="Mon–Sat, 10:00 AM – 2:00 PM" value="Mon–Sat, 10:00 AM – 2:00 PM" class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none">
            </div>
            <div class="pt-2 flex justify-end gap-2">
              <button type="submit" class="px-5 py-2.5 rounded-xl bg-tealbrand text-white font-semibold hover:bg-teal-700">
                Save Doctor Profile
              </button>
            </div>
          </form>
        </div>
      `);

      $s("#form-add-doc")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = $s("#new-doc-name").value.trim();
        const specialty = $s("#new-doc-spec").value.trim();
        const fee = Number($s("#new-doc-fee").value) || 500;
        const location = $s("#new-doc-loc").value.trim() || "Pune";
        const experienceYears = Number($s("#new-doc-exp").value) || 8;
        const timing = $s("#new-doc-time").value.trim() || "Mon–Sat, 10:00 AM – 2:00 PM";
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, "-");

        CareWellData.doctors.push({
          id,
          name,
          specialty,
          group: specialty,
          location,
          timing,
          qualifications: "MBBS, MD",
          experienceYears,
          languages: ["Hindi", "English"],
          fee,
          rating: 4.8,
          reviewCount: 10,
          bio: `${specialty} OPD clinic specialist.`
        });

        closeModalHtml();
        sShowToast(`Doctor ${name} added to CareWell!`);
        if (typeof fillDoctorSelect === "function") fillDoctorSelect("");
        if (typeof renderDoctors === "function") renderDoctors();
        renderAdminPanel();
      });
    },

    openAddPrescriptionModal() {
      showModalHtml(`
        <div class="p-6 sm:p-8">
          <div class="flex items-center justify-between border-b border-emerald-100 pb-3">
            <h3 class="font-display text-lg text-slate-900">Add Digital Prescription</h3>
            <button id="modal-close-btn" type="button" class="text-slate-400 hover:text-slate-600 p-1">
              <span class="icon icon-close"></span>
            </button>
          </div>
          <form id="form-add-rx" class="mt-4 space-y-3 text-xs">
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Select Patient</label>
              <select id="rx-patient-select" class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none">
                <option value="CW-2048">Riya Sharma (CW-2048)</option>
                <option value="CW-1980">Suresh Sharma (CW-1980)</option>
                <option value="CW-1988">Lata Sharma (CW-1988)</option>
                <option value="CW-2210">Aarav Sharma (CW-2210)</option>
              </select>
            </div>
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Doctor</label>
              <select id="rx-doctor-select" class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none">
                ${CareWellData.doctors.map((d) => `<option value="${d.name}">${sEscapeHtml(d.name)} (${sEscapeHtml(d.specialty)})</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Prescription Medicines & Advice</label>
              <textarea id="rx-medicines" rows="3" placeholder="Jaise: Tab Pantocid 40mg 1 OD, Tab Paracetamol 650mg SOS" required class="w-full p-2.5 rounded-xl border border-emerald-200 outline-none"></textarea>
            </div>
            <div class="pt-2 flex justify-end gap-2">
              <button type="submit" class="px-5 py-2.5 rounded-xl bg-tealbrand text-white font-semibold hover:bg-teal-700">
                Save & Alert Patient via WhatsApp
              </button>
            </div>
          </form>
        </div>
      `);

      $s("#form-add-rx")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const patientId = $s("#rx-patient-select").value;
        const doctor = $s("#rx-doctor-select").value;
        const text = $s("#rx-medicines").value.trim();

        const rxList = sReadJson("carewell_prescriptions", []);
        rxList.unshift({
          id: `rx-${Date.now()}`,
          patientId,
          date: new Date().toISOString().split("T")[0],
          doctor,
          text
        });
        sWriteJson("carewell_prescriptions", rxList);

        sendAutomatedWhatsApp("9811111111", "Patient", `Prescription Updated: ${doctor} ne digital prescription portal me save kar di hai. Download karein: #portal`, "Prescription Alert");

        closeModalHtml();
        sShowToast("Prescription added & WhatsApp alert sent!");
        renderPortalPanel();
        renderAdminPanel();
      });
    },

    openUploadReportModal() {
      showModalHtml(`
        <div class="p-6 sm:p-8">
          <div class="flex items-center justify-between border-b border-emerald-100 pb-3">
            <h3 class="font-display text-lg text-slate-900">Upload Lab / Medical Report</h3>
            <button id="modal-close-btn" type="button" class="text-slate-400 hover:text-slate-600 p-1">
              <span class="icon icon-close"></span>
            </button>
          </div>
          <form id="form-upload-report" class="mt-4 space-y-3 text-xs">
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Select Patient</label>
              <select id="rep-patient-select" class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none">
                <option value="CW-2048">Riya Sharma (CW-2048)</option>
                <option value="CW-1980">Suresh Sharma (CW-1980)</option>
                <option value="CW-1988">Lata Sharma (CW-1988)</option>
                <option value="CW-2210">Aarav Sharma (CW-2210)</option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Test Type</label>
                <select id="rep-type-select" class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none">
                  <option value="Blood Test">Blood Test</option>
                  <option value="X-Ray">X-Ray</option>
                  <option value="Sugar Report">Sugar Report</option>
                  <option value="ECG">ECG</option>
                </select>
              </div>
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Report Title</label>
                <input id="rep-name-input" type="text" placeholder="Fasting Sugar / Lipid Profile" required class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none">
              </div>
            </div>
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Doctor Finding Note</label>
              <input id="rep-note-input" type="text" placeholder="Normal ranges / Review required" value="Physician review recommended" class="h-9 w-full px-3 rounded-xl border border-emerald-200 outline-none">
            </div>
            <div class="pt-2 flex justify-end gap-2">
              <button type="submit" class="px-5 py-2.5 rounded-xl bg-tealbrand text-white font-semibold hover:bg-teal-700">
                Attach Report to Patient Portal
              </button>
            </div>
          </form>
        </div>
      `);

      $s("#form-upload-report")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const patientId = $s("#rep-patient-select").value;
        const type = $s("#rep-type-select").value;
        const name = $s("#rep-name-input").value.trim();
        const note = $s("#rep-note-input").value.trim();

        const reportList = sReadJson("carewell_reports", []);
        reportList.unshift({
          id: `rep-${Date.now()}`,
          patientId,
          date: new Date().toISOString().split("T")[0],
          type,
          name,
          note
        });
        sWriteJson("carewell_reports", reportList);

        closeModalHtml();
        sShowToast("Report uploaded to patient file!");
        renderPortalPanel();
        renderAdminPanel();
      });
    },

    markStatus(id, newStatus) {
      const appointments = typeof getAppointments === "function" ? getAppointments() : sReadJson("carewell_appointments", []);
      const appt = appointments.find((a) => a.id === id);
      if (appt) {
        appt.status = newStatus;
        if (typeof setAppointments === "function") setAppointments(appointments);
        else sWriteJson("carewell_appointments", appointments);
        sShowToast(`Status updated to ${newStatus}`);
        renderAdminPanel();
      }
    },

    sendAppointmentReminder(id) {
      const appointments = typeof getAppointments === "function" ? getAppointments() : sReadJson("carewell_appointments", []);
      const a = appointments.find((item) => item.id === id);
      if (a) {
        sendAutomatedWhatsApp(a.phone, a.patientName, `Reminder: Aapka appointment ${a.date} ko ${a.slot} baje schedule hai. Token No. ${a.tokenNo || 12}. Confirm: 1, Cancel: 2.`, "Manual Reminder");
        sShowToast(`WhatsApp reminder sent to ${a.patientName}!`);
        renderWhatsAppPanel();
      }
    },

    sendSingleFollowup(fId) {
      const followups = sReadJson("carewell_followups", CareWellData.records?.followups || []);
      const f = followups.find((item) => item.id === fId);
      if (f) {
        sendAutomatedWhatsApp(f.phone, f.patient, `CareWell Reminder: Namaste ${f.patient} ji, aapka ${f.reason} due hai. Slot book karne ke liye reply karein.`, "Follow-up Reminder");
        sShowToast(`Follow-up reminder sent to ${f.patient}!`);
        renderWhatsAppPanel();
      }
    },

    sendAllFollowups() {
      const followups = sReadJson("carewell_followups", CareWellData.records?.followups || []);
      followups.forEach((f) => {
        sendAutomatedWhatsApp(f.phone, f.patient, `CareWell Reminder: Namaste ${f.patient} ji, aapka ${f.reason} due hai. Slot book karne ke liye reply karein.`, "Follow-up Broadcast");
      });
      sShowToast(`${followups.length} Follow-up reminders sent via WhatsApp!`);
      renderWhatsAppPanel();
    },

    blockDoctorDay(isBlock) {
      const docSelect = $s("#slot-ctrl-doctor");
      const dateInput = $s("#slot-ctrl-date");
      if (!docSelect || !dateInput) return;
      const doctorId = docSelect.value;
      const date = dateInput.value;

      const blocks = typeof getBlocks === "function" ? getBlocks() : sReadJson("carewell_blocks", []);
      if (isBlock) {
        blocks.push({ doctorId, date, slot: "" });
        sShowToast(`Slots band ho gaye: Doctor leave marked for ${date}!`);
      } else {
        const filtered = blocks.filter((b) => !(b.doctorId === doctorId && b.date === date));
        blocks.length = 0;
        blocks.push(...filtered);
        sShowToast(`Slots wapas khul gaye for ${date}!`);
      }
      if (typeof setBlocks === "function") setBlocks(blocks);
      else sWriteJson("carewell_blocks", blocks);
      if (typeof renderSlots === "function") renderSlots();
    },

    triggerBroadcast(label) {
      sendAutomatedWhatsApp("9811111111", "All Patients", `Broadcast: Kal CareWell Clinic OPD 9:00 AM se open hai. Apne token ke sath samay par pahuchein.`, label);
      sShowToast(`Broadcast sent to ${label}!`);
      renderWhatsAppPanel();
    },

    viewPatientHistory(patientId) {
      currentPortalMemberId = patientId;
      activePortalTab = "history";
      renderPortalPanel();
      $s("#portal")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Initialize System on load
  function initSystem() {
    initSystemStorage();
    renderQueuePanel();
    renderWhatsAppPanel();
    renderCallsPanel();
    renderPortalPanel();
    renderAdminPanel();
    sRefreshIcons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSystem);
  } else {
    initSystem();
  }
})();
