import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../config/env.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Send an email via the configured SMTP transport (Mailhog in dev). */
export async function sendMail(message: MailMessage): Promise<void> {
  await getTransporter().sendMail({
    from: env.MAIL_FROM,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}

/** Localized email builders. `lang` comes from the user's Accept-Language. */
export const emailTemplates = {
  verifyEmail(lang: 'en' | 'fr', link: string): { subject: string; html: string; text: string } {
    if (lang === 'fr') {
      return {
        subject: 'Vérifiez votre adresse e-mail — StudyShare',
        text: `Bienvenue sur StudyShare ! Vérifiez votre e-mail : ${link}`,
        html: `<p>Bienvenue sur StudyShare !</p><p><a href="${link}">Vérifier mon adresse e-mail</a></p><p>Ce lien expire dans 24 heures.</p>`,
      };
    }
    return {
      subject: 'Verify your email — StudyShare',
      text: `Welcome to StudyShare! Verify your email: ${link}`,
      html: `<p>Welcome to StudyShare!</p><p><a href="${link}">Verify my email</a></p><p>This link expires in 24 hours.</p>`,
    };
  },
  resetPassword(
    lang: 'en' | 'fr',
    link: string,
  ): { subject: string; html: string; text: string } {
    if (lang === 'fr') {
      return {
        subject: 'Réinitialisation du mot de passe — StudyShare',
        text: `Réinitialisez votre mot de passe : ${link} (expire dans 30 minutes)`,
        html: `<p>Vous avez demandé une réinitialisation.</p><p><a href="${link}">Réinitialiser mon mot de passe</a></p><p>Ce lien expire dans 30 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>`,
      };
    }
    return {
      subject: 'Reset your password — StudyShare',
      text: `Reset your password: ${link} (expires in 30 minutes)`,
      html: `<p>You requested a password reset.</p><p><a href="${link}">Reset my password</a></p><p>This link expires in 30 minutes. If you didn't request this, ignore this email.</p>`,
    };
  },
};
