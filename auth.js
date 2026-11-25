/**
 * CareWell Clinic - Unified Role-Based Auth Engine (auth.js)
 * Supports Patient, Doctor, and Admin Login & Sign Up
 */

(function () {
  "use strict";

  const $ = (sel, parent = document) => parent.querySelector(sel);
  const $$ = (sel, parent = document) => parent.querySelectorAll(sel);

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
    let toast = $("#toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      toast.className = "fixed left-4 right-4 top-20 z-[70] hidden rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg sm:left-auto sm:right-6 sm:w-80";
      document.body.appendChild(toast);
    }
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

  // Pre-seed local databases if not present
  function initDatabases() {
    if (!localStorage.getItem("carewell_patients_db")) {
      const defaultPatients = CareWellData?.records?.family || [
        { id: "p-1", name: "Riya Sharma", phone: "9811111111", patientId: "CW-2048", age: 28, gender: "Female", city: "Pune", password: "1234" },
        { id: "p-2", name: "Suresh Sharma", phone: "9811111111", patientId: "CW-1980", age: 58, gender: "Male", city: "Pune", password: "1234" },
        { id: "p-3", name: "Lata Sharma", phone: "9811111111", patientId: "CW-1988", age: 54, gender: "Female", city: "Pune", password: "1234" },
        { id: "p-4", name: "Aarav Sharma", phone: "9811111111", patientId: "CW-2210", age: 6, gender: "Male", city: "Pune", password: "1234" }
      ];
      writeJson("carewell_patients_db", defaultPatients);
    }

    if (!localStorage.getItem("carewell_doctors_db")) {
      const defaultDoctors = CareWellData?.doctors || [];
      writeJson("carewell_doctors_db", defaultDoctors);
    }
  }

  initDatabases();

  // Authentication State Getters & Setters
  const AuthState = {
    getActiveRole() {
      if (localStorage.getItem("carewell_admin_auth") === "true") return "admin";
      if (localStorage.getItem("carewell_doctor_auth_id")) return "doctor";
      if (localStorage.getItem("carewell_patient_auth") === "true") return "patient";
      return null;
    },

    getActiveUser() {
      const role = this.getActiveRole();
      if (role === "admin") {
        return { role: "admin", name: "Clinic Admin", id: "admin@carewell" };
      }
      if (role === "doctor") {
        const docId = localStorage.getItem("carewell_doctor_auth_id");
        const doctors = readJson("carewell_doctors_db", CareWellData?.doctors || []);
        const doc = doctors.find((d) => d.id === docId) || { name: "Doctor" };
        return { role: "doctor", name: doc.name, id: docId, specialty: doc.specialty };
      }
      if (role === "patient") {
        const patientUser = readJson("carewell_active_patient_user", null);
        if (patientUser) return { role: "patient", ...patientUser };
        return { role: "patient", name: "Riya Sharma", patientId: "CW-2048", phone: "9811111111" };
      }
      return null;
    },

    logout() {
      localStorage.removeItem("carewell_admin_auth");
      localStorage.removeItem("carewell_doctor_auth_id");
      localStorage.removeItem("carewell_patient_auth");
      localStorage.removeItem("carewell_active_patient_user");
      showToast("Aap successfully logout ho chuke hain.");
      window.CareWellAuth.renderHeaderAuth();
      if (window.location.pathname.includes("patient.html") || 
          window.location.pathname.includes("doctor.html") || 
          window.location.pathname.includes("admin.html")) {
        window.location.href = "index.html";
      }
    }
  };

  // Auth Modal & Form Renderer Component
  let currentAuthRole = "patient"; // 'patient' | 'doctor' | 'admin'
  let currentAuthTab = "login";    // 'login' | 'signup'

  function getAuthFormHtml(role = currentAuthRole, tab = currentAuthTab) {
    const doctors = readJson("carewell_doctors_db", CareWellData?.doctors || []);

    return `
      <div class="auth-box bg-white rounded-3xl border border-emerald-100 shadow-2xl overflow-hidden max-w-lg w-full mx-auto">
        <!-- Modal Top Bar -->
        <div class="bg-slate-50 border-b border-emerald-100 p-4 sm:p-5 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-tealbrand text-white shadow-xs">
              <span class="icon icon-shield text-white"></span>
            </span>
            <div>
              <h3 class="font-display text-lg font-bold text-slate-900 leading-tight">CareWell Portals Access</h3>
              <p class="text-[11px] text-slate-500">Select Role & Login or Create an Account</p>
            </div>
          </div>
          <button type="button" id="auth-modal-close" class="h-9 w-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 flex items-center justify-center transition" aria-label="Close">
            <span class="icon icon-close text-slate-500"></span>
          </button>
        </div>

        <div class="p-6 sm:p-8 space-y-5">
          <!-- 1. Role Selection Pills -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">Aapka Role Choose Karein:</label>
            <div class="grid grid-cols-3 gap-2">
              <button type="button" data-role-btn="patient" class="py-2.5 px-3 rounded-2xl text-xs font-bold transition flex flex-col items-center gap-1 border ${
                role === "patient"
                  ? "bg-tealbrand text-white border-tealbrand shadow-xs"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50"
              }">
                <span class="icon icon-user ${role === "patient" ? "text-white" : "text-slate-700"}"></span>
                <span>Patient</span>
              </button>
              <button type="button" data-role-btn="doctor" class="py-2.5 px-3 rounded-2xl text-xs font-bold transition flex flex-col items-center gap-1 border ${
                role === "doctor"
                  ? "bg-tealbrand text-white border-tealbrand shadow-xs"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50"
              }">
                <span class="icon icon-stethoscope ${role === "doctor" ? "text-white" : "text-slate-700"}"></span>
                <span>Doctor</span>
              </button>
              <button type="button" data-role-btn="admin" class="py-2.5 px-3 rounded-2xl text-xs font-bold transition flex flex-col items-center gap-1 border ${
                role === "admin"
                  ? "bg-tealbrand text-white border-tealbrand shadow-xs"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50"
              }">
                <span class="icon icon-shield ${role === "admin" ? "text-white" : "text-slate-700"}"></span>
                <span>Admin / Staff</span>
              </button>
            </div>
          </div>

          <!-- 2. Login vs Sign Up Tab Switcher -->
          <div class="flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
            <button type="button" data-tab-btn="login" class="flex-1 py-2 text-xs font-bold rounded-lg transition inline-flex items-center justify-center gap-1.5 ${
              tab === "login" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
            }">
              <span class="icon icon-key"></span> Login Karo
            </button>
            <button type="button" data-tab-btn="signup" class="flex-1 py-2 text-xs font-bold rounded-lg transition inline-flex items-center justify-center gap-1.5 ${
              tab === "signup" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
            }">
              <span class="icon icon-file-text"></span> Naya Sign Up
            </button>
          </div>

          <!-- Dynamic Form Bodies based on Role & Tab -->
          ${renderRoleForm(role, tab, doctors)}
        </div>
      </div>
    `;
  }

  function renderRoleForm(role, tab, doctors) {
    // ---------------------------------------------
    // A. PATIENT ROLE
    // ---------------------------------------------
    if (role === "patient") {
      if (tab === "login") {
        return `
          <form id="form-auth-patient-login" class="space-y-4 text-xs">
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Mobile Number (10 Digits)</label>
              <input id="in-pat-phone" type="tel" maxlength="10" placeholder="Jaise 9811111111" value="9811111111" required class="h-11 w-full px-3.5 text-sm rounded-xl border border-emerald-200 outline-none focus:border-tealbrand">
            </div>
            <div>
              <label class="font-semibold text-slate-700 block mb-1">OTP Code / Password (Demo: 1234)</label>
              <input id="in-pat-otp" type="password" maxlength="6" value="1234" required class="h-11 w-full px-3.5 text-sm rounded-xl border border-emerald-200 outline-none focus:border-tealbrand">
            </div>
            <button type="submit" class="w-full h-11 rounded-xl bg-tealbrand text-white text-sm font-semibold hover:bg-teal-700 transition shadow-xs flex items-center justify-center gap-1.5">
              <span>Patient Portal Login</span>
              <span class="icon icon-arrow-right"></span>
            </button>
            <button id="btn-quick-demo-patient" type="button" class="w-full h-10 rounded-xl bg-mint text-tealbrand border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition flex items-center justify-center gap-1.5">
              <span class="icon icon-user"></span> 1-Click Demo Login as Riya Sharma (CW-2048)
            </button>
          </form>
        `;
      } else {
        // Patient Sign Up
        return `
          <form id="form-auth-patient-signup" class="space-y-3 text-xs">
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Poora Naam (Full Name)</label>
              <input id="up-pat-name" type="text" placeholder="Jaise Priya Verma" required class="h-10 w-full px-3 text-sm rounded-xl border border-emerald-200 outline-none focus:border-tealbrand">
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Mobile (10 Digits)</label>
                <input id="up-pat-phone" type="tel" maxlength="10" placeholder="98XXXXXXXX" required class="h-10 w-full px-3 text-sm rounded-xl border border-emerald-200 outline-none focus:border-tealbrand">
              </div>
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Age (Years)</label>
                <input id="up-pat-age" type="number" min="1" max="110" placeholder="28" required class="h-10 w-full px-3 text-sm rounded-xl border border-emerald-200 outline-none focus:border-tealbrand">
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Gender</label>
                <select id="up-pat-gender" class="h-10 w-full px-3 text-sm rounded-xl border border-emerald-200 bg-white outline-none">
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Password / PIN</label>
                <input id="up-pat-pwd" type="password" value="1234" required class="h-10 w-full px-3 text-sm rounded-xl border border-emerald-200 outline-none focus:border-tealbrand">
              </div>
            </div>
            <p class="text-[11px] text-slate-500">Naya Digital Health ID (CW-XXXX) turant generate hoga.</p>
            <button type="submit" class="w-full h-11 rounded-xl bg-tealbrand text-white text-sm font-semibold hover:bg-teal-700 transition shadow-xs flex items-center justify-center gap-1.5 mt-2">
              <span>Sign Up & Patient Portal Kholein</span>
              <span class="icon icon-check"></span>
            </button>
          </form>
        `;
      }
    }

    // ---------------------------------------------
    // B. DOCTOR ROLE
    // ---------------------------------------------
    else if (role === "doctor") {
      if (tab === "login") {
        return `
          <form id="form-auth-doc-login" class="space-y-4 text-xs">
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Select Doctor Profile</label>
              <select id="in-doc-select" class="h-11 w-full px-3.5 text-sm rounded-xl border border-emerald-200 bg-white outline-none focus:border-tealbrand">
                ${doctors.map((d) => `<option value="${d.id}">${escapeHtml(d.name)} (${escapeHtml(d.specialty)})</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Doctor Security PIN (Demo: 1234)</label>
              <input id="in-doc-pin" type="password" maxlength="6" value="1234" required class="h-11 w-full px-3.5 text-sm rounded-xl border border-emerald-200 outline-none focus:border-tealbrand">
            </div>
            <button type="submit" class="w-full h-11 rounded-xl bg-tealbrand text-white text-sm font-semibold hover:bg-teal-700 transition shadow-xs flex items-center justify-center gap-1.5">
              <span>Doctor OPD Room Kholein</span>
              <span class="icon icon-arrow-right"></span>
            </button>
            <button id="btn-quick-demo-doctor" type="button" class="w-full h-10 rounded-xl bg-mint text-tealbrand border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition flex items-center justify-center gap-1.5">
              <span class="icon icon-stethoscope"></span> 1-Click Demo Login as Dr. Ananya Rao
            </button>
          </form>
        `;
      } else {
        // Doctor Sign Up
        return `
          <form id="form-auth-doc-signup" class="space-y-3 text-xs">
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Doctor Name (With Dr. prefix)</label>
              <input id="up-doc-name" type="text" placeholder="Dr. Rajesh Mehra" required class="h-10 w-full px-3 text-sm rounded-xl border border-emerald-200 outline-none focus:border-tealbrand">
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Specialization</label>
                <select id="up-doc-specialty" class="h-10 w-full px-3 text-sm rounded-xl border border-emerald-200 bg-white outline-none">
                  <option value="General Physician">General Physician</option>
                  <option value="Cardiologist">Cardiologist</option>
                  <option value="Dermatologist">Dermatologist</option>
                  <option value="Pediatrician">Pediatrician</option>
                  <option value="Orthopedic Surgeon">Orthopedic Surgeon</option>
                  <option value="Dentist">Dentist</option>
                  <option value="ENT Specialist">ENT Specialist</option>
                </select>
              </div>
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Consultation Fee (₹)</label>
                <input id="up-doc-fee" type="number" value="500" required class="h-10 w-full px-3 text-sm rounded-xl border border-emerald-200 outline-none focus:border-tealbrand">
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Degree / Qualification</label>
                <input id="up-doc-degrees" type="text" placeholder="MBBS, MD" value="MBBS, MD" required class="h-10 w-full px-3 text-sm rounded-xl border border-emerald-200 outline-none focus:border-tealbrand">
              </div>
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Secret PIN (4-6 digits)</label>
                <input id="up-doc-pin" type="password" value="1234" required class="h-10 w-full px-3 text-sm rounded-xl border border-emerald-200 outline-none focus:border-tealbrand">
              </div>
            </div>
            <p class="text-[11px] text-slate-500">Doctor OPD room register ho jayegi aur calendar mein jud jayegi.</p>
            <button type="submit" class="w-full h-11 rounded-xl bg-tealbrand text-white text-sm font-semibold hover:bg-teal-700 transition shadow-xs flex items-center justify-center gap-1.5 mt-2">
              <span>Register Doctor & Open Workspace</span>
              <span class="icon icon-check"></span>
            </button>
          </form>
        `;
      }
    }

    // ---------------------------------------------
    // C. ADMIN ROLE
    // ---------------------------------------------
    else {
      if (tab === "login") {
        return `
          <form id="form-auth-admin-login" class="space-y-4 text-xs">
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Admin Username / Email</label>
              <input id="in-admin-user" type="text" value="admin@carewell" required class="h-11 w-full px-3.5 text-sm rounded-xl border border-emerald-200 outline-none focus:border-tealbrand">
            </div>
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Admin Password (Demo: carewell123)</label>
              <input id="in-admin-pwd" type="password" value="carewell123" required class="h-11 w-full px-3.5 text-sm rounded-xl border border-emerald-200 outline-none focus:border-tealbrand">
            </div>
            <button type="submit" class="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition shadow-xs flex items-center justify-center gap-1.5">
              <span>Admin Portal Login</span>
              <span class="icon icon-arrow-right"></span>
            </button>
            <button id="btn-quick-demo-admin" type="button" class="w-full h-10 rounded-xl bg-mint text-tealbrand border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition flex items-center justify-center gap-1.5">
              <span class="icon icon-shield"></span> 1-Click Demo Login as Clinic Admin
            </button>
          </form>
        `;
      } else {
        // Admin Sign Up / Staff Registration
        return `
          <form id="form-auth-admin-signup" class="space-y-3 text-xs">
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Staff Member Name</label>
              <input id="up-adm-name" type="text" placeholder="Jaise Pooja Deshmukh" required class="h-10 w-full px-3 text-sm rounded-xl border border-emerald-200 outline-none focus:border-tealbrand">
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Clinic Role</label>
                <select id="up-adm-role" class="h-10 w-full px-3 text-sm rounded-xl border border-emerald-200 bg-white outline-none">
                  <option value="Receptionist">Receptionist</option>
                  <option value="Billing Executive">Billing Executive</option>
                  <option value="Clinic Manager">Clinic Manager</option>
                </select>
              </div>
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Create Password</label>
                <input id="up-adm-pwd" type="password" value="carewell123" required class="h-10 w-full px-3 text-sm rounded-xl border border-emerald-200 outline-none focus:border-tealbrand">
              </div>
            </div>
            <div>
              <label class="font-semibold text-slate-700 block mb-1">Clinic Security Key (Passcode: CAREWELL2026)</label>
              <input id="up-adm-key" type="text" value="CAREWELL2026" required class="h-10 w-full px-3 text-sm rounded-xl border border-emerald-200 outline-none focus:border-tealbrand font-mono">
            </div>
            <button type="submit" class="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition shadow-xs flex items-center justify-center gap-1.5 mt-2">
              <span>Register Staff & Open Admin Desk</span>
              <span class="icon icon-check"></span>
            </button>
          </form>
        `;
      }
    }
  }

  // Bind Actions inside the rendered form
  function bindAuthFormEvents(container) {
    // Role switcher pills
    $$("[data-role-btn]", container).forEach((btn) => {
      btn.addEventListener("click", () => {
        currentAuthRole = btn.dataset.roleBtn;
        reRenderContainer(container);
      });
    });

    // Login vs Signup tab
    $$("[data-tab-btn]", container).forEach((btn) => {
      btn.addEventListener("click", () => {
        currentAuthTab = btn.dataset.tabBtn;
        reRenderContainer(container);
      });
    });

    // Close button
    $("#auth-modal-close", container)?.addEventListener("click", () => {
      window.CareWellAuth.closeModal();
    });

    // 1. Patient Login Submit
    $("#form-auth-patient-login", container)?.addEventListener("submit", (e) => {
      e.preventDefault();
      const phone = $("#in-pat-phone", container)?.value.trim();
      const patients = readJson("carewell_patients_db", []);
      const patient = patients.find((p) => p.phone === phone) || {
        name: "Riya Sharma",
        patientId: "CW-2048",
        phone: phone || "9811111111"
      };

      localStorage.setItem("carewell_patient_auth", "true");
      localStorage.setItem("carewell_active_patient_member", patient.patientId || "CW-2048");
      writeJson("carewell_active_patient_user", patient);
      showToast(`Welcome ${patient.name}! Redirecting to Patient Portal...`);
      setTimeout(() => (window.location.href = "patient.html"), 600);
    });

    // Quick Patient Demo
    $("#btn-quick-demo-patient", container)?.addEventListener("click", () => {
      localStorage.setItem("carewell_patient_auth", "true");
      localStorage.setItem("carewell_active_patient_member", "CW-2048");
      writeJson("carewell_active_patient_user", {
        name: "Riya Sharma",
        patientId: "CW-2048",
        phone: "9811111111",
        age: 28
      });
      showToast("Logged in as Riya Sharma (CW-2048)!");
      setTimeout(() => (window.location.href = "patient.html"), 600);
    });

    // 2. Patient Sign Up Submit
    $("#form-auth-patient-signup", container)?.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#up-pat-name", container)?.value.trim();
      const phone = $("#up-pat-phone", container)?.value.trim();
      const age = parseInt($("#up-pat-age", container)?.value || "25", 10);
      const gender = $("#up-pat-gender", container)?.value;
      const pwd = $("#up-pat-pwd", container)?.value;

      if (!name || !phone || phone.length !== 10) {
        showToast("Kripya valid naam aur 10-digit mobile number daalein.");
        return;
      }

      const randomNum = Math.floor(2050 + Math.random() * 8000);
      const newPatientId = `CW-${randomNum}`;

      const newPatient = {
        id: `p-${Date.now()}`,
        name,
        phone,
        patientId: newPatientId,
        age,
        gender,
        password: pwd
      };

      const patients = readJson("carewell_patients_db", []);
      patients.unshift(newPatient);
      writeJson("carewell_patients_db", patients);

      // Add to family records
      const family = readJson("carewell_family", CareWellData?.records?.family || []);
      family.unshift({
        id: newPatient.id,
        name: newPatient.name,
        patientId: newPatient.patientId,
        age: newPatient.age,
        relation: "Self",
        phone: newPatient.phone
      });
      writeJson("carewell_family", family);

      localStorage.setItem("carewell_patient_auth", "true");
      localStorage.setItem("carewell_active_patient_member", newPatientId);
      writeJson("carewell_active_patient_user", newPatient);

      showToast(`Account Created! Patient ID: ${newPatientId}`);
      setTimeout(() => (window.location.href = "patient.html"), 700);
    });

    // 3. Doctor Login Submit
    $("#form-auth-doc-login", container)?.addEventListener("submit", (e) => {
      e.preventDefault();
      const docId = $("#in-doc-select", container)?.value;
      localStorage.setItem("carewell_doctor_auth_id", docId);
      showToast("Doctor Verified! Opening OPD Workspace...");
      setTimeout(() => (window.location.href = "doctor.html"), 600);
    });

    // Quick Doctor Demo
    $("#btn-quick-demo-doctor", container)?.addEventListener("click", () => {
      localStorage.setItem("carewell_doctor_auth_id", "ananya-rao");
      showToast("Logged in as Dr. Ananya Rao!");
      setTimeout(() => (window.location.href = "doctor.html"), 600);
    });

    // 4. Doctor Sign Up Submit
    $("#form-auth-doc-signup", container)?.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#up-doc-name", container)?.value.trim();
      const specialty = $("#up-doc-specialty", container)?.value;
      const fee = parseInt($("#up-doc-fee", container)?.value || "500", 10);
      const qualifications = $("#up-doc-degrees", container)?.value;
      const pin = $("#up-doc-pin", container)?.value;

      if (!name) {
        showToast("Doctor ka naam enter karein.");
        return;
      }

      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
      const newDoc = {
        id: slug,
        name,
        specialty,
        fee,
        qualifications,
        timing: "Mon–Sat, 10:00 AM – 2:00 PM",
        rating: 5.0,
        reviewCount: 1,
        pin
      };

      const docs = readJson("carewell_doctors_db", CareWellData?.doctors || []);
      docs.unshift(newDoc);
      writeJson("carewell_doctors_db", docs);

      localStorage.setItem("carewell_doctor_auth_id", slug);
      showToast(`Dr. ${name} registered successfully!`);
      setTimeout(() => (window.location.href = "doctor.html"), 700);
    });

    // 5. Admin Login Submit
    $("#form-auth-admin-login", container)?.addEventListener("submit", (e) => {
      e.preventDefault();
      localStorage.setItem("carewell_admin_auth", "true");
      showToast("Admin credentials verified! Opening desk...");
      setTimeout(() => (window.location.href = "admin.html"), 600);
    });

    // Quick Admin Demo
    $("#btn-quick-demo-admin", container)?.addEventListener("click", () => {
      localStorage.setItem("carewell_admin_auth", "true");
      showToast("Logged in as Reception Admin!");
      setTimeout(() => (window.location.href = "admin.html"), 600);
    });

    // 6. Admin Sign Up / Staff Registration
    $("#form-auth-admin-signup", container)?.addEventListener("submit", (e) => {
      e.preventDefault();
      const key = $("#up-adm-key", container)?.value.trim();
      if (key !== "CAREWELL2026") {
        showToast("Security Passcode galat hai! Use: CAREWELL2026");
        return;
      }
      localStorage.setItem("carewell_admin_auth", "true");
      showToast("Clinic Staff verified & registered!");
      setTimeout(() => (window.location.href = "admin.html"), 600);
    });
  }

  function reRenderContainer(container) {
    container.innerHTML = getAuthFormHtml(currentAuthRole, currentAuthTab);
    bindAuthFormEvents(container);
    refreshIcons();
  }

  // Public Interface
  window.CareWellAuth = {
    openModal(role = "patient", tab = "login") {
      currentAuthRole = role;
      currentAuthTab = tab;

      let modalBox = $("#carewell-auth-modal-root");
      if (!modalBox) {
        modalBox = document.createElement("div");
        modalBox.id = "carewell-auth-modal-root";
        modalBox.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in";
        document.body.appendChild(modalBox);
      }

      modalBox.innerHTML = `
        <div class="relative w-full max-w-lg">
          <div id="auth-modal-content-slot">
            ${getAuthFormHtml(currentAuthRole, currentAuthTab)}
          </div>
        </div>
      `;

      modalBox.classList.remove("hidden");
      bindAuthFormEvents($("#auth-modal-content-slot", modalBox));
      refreshIcons();
    },

    closeModal() {
      const modalBox = $("#carewell-auth-modal-root");
      if (modalBox) modalBox.remove();
    },

    mountPageAuth(containerSelector, initialRole = "patient", initialTab = "login") {
      const container = $(containerSelector);
      if (!container) return;
      currentAuthRole = initialRole;
      currentAuthTab = initialTab;
      container.innerHTML = getAuthFormHtml(currentAuthRole, currentAuthTab);
      bindAuthFormEvents(container);
      refreshIcons();
    },

    renderHeaderAuth() {
      const authSlot = $("#navbar-auth-slot");
      if (!authSlot) return;

      const user = AuthState.getActiveUser();

      if (!user) {
        // Not logged in: Show single clean high-end "Portals" button with pure CSS icon
        authSlot.innerHTML = `
          <button type="button" onclick="window.CareWellAuth.openModal('patient', 'login')" class="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition shadow-2xs" title="Portals Login (Patient, Doctor, Admin)">
            <span class="icon icon-user text-slate-600"></span>
            <span class="hidden sm:inline">Portals</span>
          </button>
        `;
      } else {
        // Logged in: Show active user role pill + Portal link + Logout
        let portalUrl = "patient.html";
        let iconClass = "icon-user";
        let roleBadge = "Patient";

        if (user.role === "doctor") {
          portalUrl = "doctor.html";
          iconClass = "icon-stethoscope";
          roleBadge = "Doctor";
        } else if (user.role === "admin") {
          portalUrl = "admin.html";
          iconClass = "icon-shield";
          roleBadge = "Admin";
        }

        authSlot.innerHTML = `
          <div class="flex items-center gap-1.5">
            <a href="${portalUrl}" class="inline-flex items-center gap-1.5 h-10 px-3 rounded-full border border-emerald-200 bg-mint text-tealbrand text-xs font-bold hover:bg-emerald-100 transition shadow-2xs" title="Open Your ${roleBadge} Workspace">
              <span class="icon ${iconClass} text-tealbrand"></span>
              <span>${escapeHtml(user.name.split(" ")[0])} (${roleBadge})</span>
            </a>
            <button type="button" onclick="window.CareWellAuth.logout()" class="h-10 px-2 rounded-full text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition" title="Logout">
              <span class="icon icon-close text-slate-500"></span>
            </button>
          </div>
        `;
      }
      refreshIcons();
    },

    logout() {
      AuthState.logout();
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    window.CareWellAuth.renderHeaderAuth();
  });
})();
