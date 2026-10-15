import { isProduction } from '../config.js';
import { logger } from './logger.js';

export type Email = { to: string; subject: string; text: string };

/**
 * No email provider is wired up in this prototype. Outside production the message
 * is written to the server log so the link can be copied from there. A real
 * deployment would hand it to Postmark, Resend or SES here.
 */
export async function sendEmail(email: Email): Promise<void> {
  if (isProduction) {
    logger.warn({ to: email.to, subject: email.subject }, 'Email not sent: no provider configured');
    return;
  }
  logger.info({ to: email.to, subject: email.subject }, `Email (not sent, dev only)\n\n${email.text}\n`);
}
