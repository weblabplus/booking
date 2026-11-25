// Vercel Serverless Function — POST /api/notify
//
// Στέλνει email επιβεβαίωσης στον ασθενή, ειδοποίηση στην κλινική και SMS,
// μέσω Brevo. Το Hapio είναι headless (δεν στέλνει email/SMS).
//
// Απαιτούμενα env vars (Vercel):
//   BREVO_API_KEY  — API key από https://app.brevo.com/settings/keys/api
//   SENDER_EMAIL   — επαληθευμένος αποστολέας στο Brevo
//   SENDER_NAME    — προαιρετικό (default: Medisend)
//   CLINIC_EMAIL   — προαιρετικό (default: SENDER_EMAIL)
//   SMS_SENDER     — προαιρετικό, όνομα αποστολέα SMS (max 11 χαρακτήρες)
//   SMS_ENABLED    — "false" για απενεργοποίηση SMS
//   CLINIC_PHONE   — προαιρετικό, SMS ειδοποίηση στην κλινική

const BREVO_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_SMS_URL = 'https://api.brevo.com/v3/transactionalSMS/sms';

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const hits = new Map<string, number[]>();

interface NotifyPayload {
  bookingId?: string;
  ref?: string;
  name?: string;
  email?: string;
  phone?: string;
  startsAt?: string;
  endsAt?: string;
  service?: string;
  location?: string;
  resource?: string;
}

function getClientIp(req: any): string {
  const forwarded = req?.headers?.['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (raw || '').split(',')[0].trim() || req?.socket?.remoteAddress || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const DATE_TIME = new Intl.DateTimeFormat('el-GR', {
  timeZone: 'Europe/Athens',
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const TIME_ONLY = new Intl.DateTimeFormat('el-GR', {
  timeZone: 'Europe/Athens',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatRange(startsAt?: string, endsAt?: string): string {
  if (!startsAt) return '';
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return '';
  const end = endsAt ? new Date(endsAt) : null;
  const endText =
    end && !Number.isNaN(end.getTime()) ? ` – ${TIME_ONLY.format(end)}` : '';
  return `${DATE_TIME.format(start)}${endText}`;
}

function rows(fields: Array<[string, string | undefined]>): string {
  return fields
    .filter(([, value]) => Boolean(value))
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#64748b;white-space:nowrap">${escapeHtml(
          label
        )}</td><td style="padding:6px 0;color:#0f172a;font-weight:600">${escapeHtml(
          value as string
        )}</td></tr>`
    )
    .join('');
}

function wrap(title: string, body: string): string {
  return `<!doctype html><html lang="el"><body style="margin:0;background:#f1f5f9;padding:24px;font-family:'Helvetica Neue',Arial,sans-serif">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden">
    <tr><td style="background:#0072ce;padding:20px 24px;color:#ffffff;font-size:18px;font-weight:700">Medisend</td></tr>
    <tr><td style="padding:24px">
      <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a">${escapeHtml(title)}</h1>
      ${body}
    </td></tr>
    <tr><td style="padding:16px 24px;background:#f8fafc;color:#94a3b8;font-size:12px">
      Αυτό το email στάλθηκε αυτόματα μετά την online κράτηση ραντεβού.
    </td></tr>
  </table>
</body></html>`;
}

async function sendViaBrevo(
  apiKey: string,
  sender: { email: string; name: string },
  to: { email: string; name?: string },
  subject: string,
  html: string
): Promise<void> {
  const response = await fetch(BREVO_EMAIL_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ sender, to: [to], subject, htmlContent: html }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Brevo ${response.status}: ${body.slice(0, 300)}`);
  }
}

/**
 * Κανονικοποιεί ελληνικό τηλέφωνο σε E.164 (π.χ. 6944524820 → +306944524820).
 * Επιστρέφει null αν δεν μοιάζει με έγκυρο αριθμό.
 */
function normalizePhone(raw: string): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;

  let digits = value.replace(/[^\d+]/g, '');
  if (!digits) return null;

  if (digits.startsWith('00')) digits = '+' + digits.slice(2);
  if (digits.startsWith('+')) {
    return /^\+\d{8,15}$/.test(digits) ? digits : null;
  }

  const d = digits.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) return `+30${d.slice(1)}`;
  if (d.length === 10) return `+30${d}`;
  if (d.length >= 8 && d.length <= 15) return `+${d}`;
  return null;
}

async function sendSmsViaBrevo(
  apiKey: string,
  sender: string,
  recipient: string,
  content: string
): Promise<void> {
  const response = await fetch(BREVO_SMS_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender,
      recipient,
      content,
      type: 'transactional',
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Brevo SMS ${response.status}: ${body.slice(0, 300)}`);
  }
}

/** Σύντομο μήνυμα SMS (κρατάμε ≤ 70 χαρακτήρες για 1 τμήμα). */
function buildSmsText(name: string, startsAt?: string): string {
  const start = startsAt ? new Date(startsAt) : null;
  const when =
    start && !Number.isNaN(start.getTime())
      ? new Intl.DateTimeFormat('el-GR', {
          timeZone: 'Europe/Athens',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(start)
      : '';

  const first = name.split(/\s+/)[0] || '';
  return `Medisend: ${first ? first + ', ' : ''}ραντεβού ${when}. Επιβεβαιώθηκε.`.slice(0, 160);
}

async function readBody(req: any): Promise<NotifyPayload> {
  if (req?.body && typeof req.body === 'object') return req.body as NotifyPayload;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as NotifyPayload;
  } catch {
    return {};
  }
}

function reply(res: any, status: number, body: unknown): void {
  res.statusCode = status;
  if (typeof res.setHeader === 'function') {
    res.setHeader('content-type', 'application/json; charset=utf-8');
  }
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(status).json(body);
    return;
  }
  res.end(JSON.stringify(body));
}

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    reply(res, 405, { error: 'Method not allowed' });
    return;
  }

  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  const senderEmail = (process.env.SENDER_EMAIL || '').trim();
  const senderName = (process.env.SENDER_NAME || 'Medisend').trim();
  const clinicEmail = (process.env.CLINIC_EMAIL || senderEmail).trim();
  const smsSender = (process.env.SMS_SENDER || 'Medisend').trim().slice(0, 11);
  const smsEnabled = (process.env.SMS_ENABLED || '').trim().toLowerCase() !== 'false';
  const clinicPhone = (process.env.CLINIC_PHONE || '').trim();

  if (!apiKey || !senderEmail) {
    reply(res, 503, {
      error:
        'Η αποστολή email δεν έχει ρυθμιστεί (λείπουν BREVO_API_KEY / SENDER_EMAIL).',
    });
    return;
  }

  if (isRateLimited(getClientIp(req))) {
    reply(res, 429, { error: 'Πολλές αιτήσεις. Δοκιμάστε ξανά σε λίγα λεπτά.' });
    return;
  }

  const payload = await readBody(req);
  const ref = (payload.ref || '').trim();
  const name = (payload.name || '').trim();
  const email = (payload.email || '').trim();
  const phone = (payload.phone || '').trim();

  // Χωρίς link προέλευσης δεν εξυπηρετούμε (δεν υπάρχει χρήστης για το ραντεβού).
  if (!ref) {
    reply(res, 403, { error: 'Απαιτείται έγκυρο link πρόσκλησης (ref).' });
    return;
  }

  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    reply(res, 400, { error: 'Απαιτούνται έγκυρο ονοματεπώνυμο και email.' });
    return;
  }

  const when = formatRange(payload.startsAt, payload.endsAt);
  const details = rows([
    ['Ονοματεπώνυμο', name],
    ['Email', email],
    ['Τηλέφωνο', phone],
    ['Υπηρεσία', payload.service],
    ['Τοποθεσία', payload.location],
    ['Προσωπικό', payload.resource],
    ['Ημερομηνία & ώρα', when],
  ]);

  const patientHtml = wrap(
    'Το ραντεβού σας επιβεβαιώθηκε',
    `<p style="margin:0 0 16px;color:#334155;line-height:1.6">Γεια σας ${escapeHtml(
      name
    )}, το ραντεβού σας καταχωρήθηκε. Παρακαλούμε να είστε εκεί 5 λεπτά νωρίτερα.</p>
     <table role="presentation" style="font-size:14px">${details}</table>
     <p style="margin:16px 0 0;color:#64748b;font-size:13px">Αν χρειαστεί αλλαγή ή ακύρωση, επικοινωνήστε μαζί μας.</p>`
  );

  const clinicHtml = wrap(
    'Νέο online ραντεβού',
    `<p style="margin:0 0 16px;color:#334155;line-height:1.6">Καταχωρήθηκε νέο ραντεβού από τη φόρμα online κράτησης.</p>
     <table role="presentation" style="font-size:14px">${details}</table>`
  );

  let emailSent = false;
  let emailError: string | undefined;
  try {
    await sendViaBrevo(
      apiKey,
      { email: senderEmail, name: senderName },
      { email, name },
      `Το ραντεβού σας επιβεβαιώθηκε${when ? ` — ${when}` : ''}`,
      patientHtml
    );
    emailSent = true;
  } catch (error: any) {
    emailError = error?.message || 'Αποτυχία αποστολής email';
    console.warn('[notify] patient email failed:', emailError);
  }

  let clinicError: string | undefined;
  if (clinicEmail && clinicEmail.toLowerCase() !== email.toLowerCase()) {
    try {
      await sendViaBrevo(
        apiKey,
        { email: senderEmail, name: senderName },
        { email: clinicEmail, name: 'Medisend' },
        `Νέο online ραντεβού: ${name}${when ? ` — ${when}` : ''}`,
        clinicHtml
      );
    } catch (error: any) {
      clinicError = error?.message || 'Αποτυχία ειδοποίησης κλινικής';
      console.warn('[notify] clinic notification failed:', clinicError);
    }
  }

  // ── SMS (Brevo transactional SMS) ──
  let smsSent = false;
  let smsError: string | undefined;

  if (smsEnabled) {
    const patientPhone = normalizePhone(phone);
    if (patientPhone) {
      try {
        await sendSmsViaBrevo(
          apiKey,
          smsSender,
          patientPhone,
          buildSmsText(name, payload.startsAt)
        );
        smsSent = true;
      } catch (error: any) {
        smsError = error?.message || 'Αποτυχία αποστολής SMS';
        console.warn('[notify] patient SMS failed:', smsError);
      }
    }

    const clinicNumber = normalizePhone(clinicPhone);
    if (clinicNumber) {
      try {
        await sendSmsViaBrevo(
          apiKey,
          smsSender,
          clinicNumber,
          `Medisend: νέο ραντεβού ${name}${when ? ` ${when}` : ''}`.slice(0, 160)
        );
      } catch (error: any) {
        console.warn('[notify] clinic SMS failed:', error?.message || error);
      }
    }
  }

  // Αν απέτυχαν και email και SMS, ενημερώνουμε για αποτυχία.
  if (!emailSent && !smsSent) {
    reply(res, 502, {
      error: emailError || smsError || 'Αποτυχία αποστολής ειδοποίησης',
      emailError,
      smsError,
    });
    return;
  }

  reply(res, 200, {
    ok: true,
    emailSent,
    smsSent,
    ...(emailError ? { emailError } : {}),
    ...(clinicError ? { clinicError } : {}),
    ...(smsError ? { smsError } : {}),
  });
}
