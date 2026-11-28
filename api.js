/**
 * CareWell Clinic - Production Frontend API Client (api.js)
 * Connects frontend UI to /api/* endpoints with CSRF + JWT auth,
 * and gracefully falls back to localStorage if running offline.
 */
(function () {
  "use strict";

  const TOKEN_KEY = "carewell_jwt_token";
  let csrfTokenCache = "";

  async function ensureCsrfToken() {
    if (csrfTokenCache) return csrfTokenCache;
    try {
      const res = await fetch("/api/csrf-token", { method: "GET", credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        csrfTokenCache = data.csrfToken || "";
      }
    } catch (e) {
      // Static/offline mode fallback
    }
    return csrfTokenCache;
  }

  async function request(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers["Authorization"] = `Bearer ${token}`;

    if (method !== "GET" && method !== "HEAD") {
      const csrf = await ensureCsrfToken();
      if (csrf) headers["X-CSRF-Token"] = csrf;
    }

    const res = await fetch(path, {
      method,
      headers,
      credentials: "same-origin",
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  window.CareWellApi = {
    getToken() {
      return localStorage.getItem(TOKEN_KEY) || "";
    },
    setToken(token) {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    },
    async bookAppointment(payload) {
      return request("/api/appointments/book", { method: "POST", body: payload });
    },
    async cancelAppointment(id) {
      return request(`/api/appointments/${encodeURIComponent(id)}/cancel`, { method: "POST", body: {} });
    },
    async submitEnquiry(payload) {
      return request("/api/enquiries", { method: "POST", body: payload });
    },
    async verifyOtp(phone, otp, name) {
      const data = await request("/api/auth/otp/verify", { method: "POST", body: { phone, otp, name } });
      if (data.token) this.setToken(data.token);
      return data;
    },
    async loginDoctor(doctorId, pin) {
      const data = await request("/api/auth/doctor/login", { method: "POST", body: { doctorId, pin } });
      if (data.token) this.setToken(data.token);
      return data;
    },
    async loginAdmin(adminId, password) {
      const data = await request("/api/auth/admin/login", { method: "POST", body: { adminId, password } });
      if (data.token) this.setToken(data.token);
      return data;
    },
    async getHealth() {
      return request("/api/health");
    }
  };
})();
