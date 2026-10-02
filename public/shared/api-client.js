"use strict";

window.Api = (function () {
  async function request(path, options = {}) {
    const isForm = options.body instanceof FormData;
    const resp = await fetch(path, {
      credentials: "include",
      method: options.method || "GET",
      headers: isForm ? undefined : { "Content-Type": "application/json" },
      body: isForm ? options.body : options.body !== undefined ? JSON.stringify(options.body) : undefined
    });

    let data = null;
    const text = await resp.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (!resp.ok) {
      const err = new Error((data && data.erro) || `Erro ${resp.status}`);
      err.status = resp.status;
      err.detalhes = data && data.detalhes;
      throw err;
    }
    return data;
  }

  return {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: "POST", body }),
    patch: (path, body) => request(path, { method: "PATCH", body }),
    put: (path, body) => request(path, { method: "PUT", body }),
    del: (path) => request(path, { method: "DELETE" }),
    upload: (path, formData) => request(path, { method: "POST", body: formData })
  };
})();
