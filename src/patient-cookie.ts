// Αποθήκευση στοιχείων ασθενή σε cookie, ώστε να μη τα ξαναπληκτρολογεί
// στην επόμενη κράτηση ραντεβού.

export interface PatientContact {
  name?: string;
  email?: string;
  phone?: string;
}

const COOKIE_NAME = 'medilab_patient';
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60; // 180 ημέρες

/** Ειδοποιεί το UI όταν αλλάζουν τα αποθηκευμένα στοιχεία. */
function notifyChange(): void {
  try {
    window.dispatchEvent(new CustomEvent('medilab-patient-change'));
  } catch {
    // αγνοούμε
  }
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Καθαρίζει και κρατά μόνο έγκυρα, μη κενά πεδία. */
function sanitize(input: PatientContact): PatientContact {
  const name = (input.name || '').trim().slice(0, 120);
  const email = (input.email || '').trim().slice(0, 160);
  const phone = (input.phone || '').trim().slice(0, 40);

  return {
    ...(name ? { name } : {}),
    ...(email && isEmail(email) ? { email } : {}),
    ...(phone ? { phone } : {}),
  };
}

export function readPatientContact(): PatientContact | null {
  try {
    const raw = document.cookie
      .split('; ')
      .find(part => part.startsWith(`${COOKIE_NAME}=`));

    if (!raw) return null;

    const json = decodeURIComponent(raw.slice(COOKIE_NAME.length + 1));
    const parsed = JSON.parse(json) as PatientContact;
    const clean = sanitize(parsed);

    return Object.keys(clean).length > 0 ? clean : null;
  } catch {
    return null;
  }
}

export function savePatientContact(contact: PatientContact): void {
  try {
    const clean = sanitize(contact);
    if (Object.keys(clean).length === 0) return;

    const value = encodeURIComponent(JSON.stringify(clean));
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie =
      `${COOKIE_NAME}=${value}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
    notifyChange();
  } catch {
    // Storage μη διαθέσιμο — η κράτηση συνεχίζει κανονικά
  }
}

export function clearPatientContact(): void {
  document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
  notifyChange();
}

export const PATIENT_COOKIE_CHANGE_EVENT = 'medilab-patient-change';
