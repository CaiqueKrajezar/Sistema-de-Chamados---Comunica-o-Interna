"use strict";

window.Fmt = (function () {
  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function initials(name) {
    return String(name ?? "")
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function fmtDateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function fmtData(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("pt-BR");
  }

  function fmtHoras(h) {
    if (h == null) return "—";
    if (h < 1) return Math.round(h * 60) + "min";
    if (h < 48) return Math.round(h * 10) / 10 + "h";
    return Math.round((h / 24) * 10) / 10 + "d";
  }

  function fmtSla(dias, contaDiasUteis) {
    return `${dias} dia${dias === 1 ? "" : "s"} ${contaDiasUteis ? "úteis" : "corridos"}`;
  }

  function fmtBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  const STATUS_LABEL = {
    aguardando_aprovacao: "Aguardando aprovação",
    novo: "Novo",
    em_andamento: "Em andamento",
    em_revisao: "Em revisão",
    aguardando_solicitante: "Aguardando solicitante",
    resolvido: "Resolvido",
    cancelado: "Cancelado"
  };

  return { escapeHtml, initials, fmtDateTime, fmtData, fmtHoras, fmtSla, fmtBytes, STATUS_LABEL };
})();
