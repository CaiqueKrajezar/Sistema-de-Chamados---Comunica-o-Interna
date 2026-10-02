"use strict";

const { env } = require("../config/env");
const logger = require("../config/logger");

let transporterPromise = null;

function getTransporter() {
  if (transporterPromise) return transporterPromise;
  transporterPromise = (async () => {
    if (env.MAIL_MODE === "console") return null;
    const nodemailer = require("nodemailer");
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
    });
  })();
  return transporterPromise;
}

async function enviar({ destinatarioEmail, assunto, corpo }) {
  if (env.MAIL_MODE === "console") {
    logger.info(`[MAIL_MODE=console] e-mail "enviado" para ${destinatarioEmail}: ${assunto}`);
    return;
  }
  const transporter = await getTransporter();
  await transporter.sendMail({
    from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
    to: destinatarioEmail,
    subject: assunto,
    text: corpo
  });
}

module.exports = { enviar };
