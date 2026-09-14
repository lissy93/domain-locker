import { defineEventHandler, readBody } from 'h3';
import { verifyAuth } from '../utils/auth';

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);

/** Strips CR/LF so a crafted name cannot inject extra email headers */
const sanitiseHeader = (value: unknown): string =>
  String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 200);

export default defineEventHandler(async (event) => {
  const authResult = await verifyAuth(event);

  if (!authResult.success) {
    return { statusCode: 401, body: { error: authResult.error } };
  }

  const RESEND_API_KEY = import.meta.env['RESEND_KEY'];

  if (!RESEND_API_KEY) {
    return { error: 'Missing RESEND_KEY in environment variables.' };
  }

  try {
    // Read the request body
    const { name, email, queryType, body, meta } = await readBody(event);

    if (!name || !email || !queryType || !body) {
      return { error: 'Missing required fields: name, email, queryType, body' };
    }

    // Construct email content, escaping every user-supplied value
    const emailContent = `
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Query Type:</strong> ${escapeHtml(queryType)}</p>
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(body)}</p>
      ${meta ? `<p><strong>Additional Info:</strong> ${escapeHtml(JSON.stringify(meta, null, 2))}</p>` : ''}
    `;

    // Send email via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'noreply@domain-locker.com',
        to: ['support@as93.freshdesk.com'],
        reply_to: email,
        subject: `Support Request: ${sanitiseHeader(queryType)} from ${sanitiseHeader(name)}`,
        html: emailContent,
      }),
    });

    // Parse response
    const result = await response.json();

    if (!response.ok) {
      return { error: result.error || 'Failed to send email' };
    }

    return { info: 'Support request sent successfully.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Unexpected error: ${msg}` };
  }
});
