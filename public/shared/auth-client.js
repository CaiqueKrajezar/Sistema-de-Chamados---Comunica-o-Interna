"use strict";

window.AuthClient = (function () {
  async function getSession() {
    return window.Api.get("/auth/session");
  }

  async function logout() {
    const r = await window.Api.post("/auth/logout", {});
    window.location.href = (r && r.redirect) || "/analista/login.html";
  }

  return { getSession, logout };
})();
