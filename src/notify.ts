export interface BookingNotification {
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

/** Το `ref` του URL — το προσωπικό link του χρήστη στο Medisend. */
export function getBookingRef(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = (params.get('ref') || '').trim();
    return ref || null;
  } catch {
    return null;
  }
}

/**
 * Ζητά από το serverless function (/api/notify) να στείλει τα email
 * επιβεβαίωσης. Δεν πετάει ποτέ — μια αποτυχία email δεν πρέπει να
 * χαλάσει την ολοκληρωμένη κράτηση.
 */
export async function sendBookingNotification(
  payload: BookingNotification
): Promise<boolean> {
  try {
    const response = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.warn('[notify] αποστολή απέτυχε:', response.status, text.slice(0, 300));
      return false;
    }

    // Το email μπορεί να στάλθηκε αλλά το SMS να απέτυχε (π.χ. χωρίς SMS credits).
    const data = (await response.json().catch(() => null)) as
      | { emailSent?: boolean; smsSent?: boolean; smsError?: string }
      | null;
    if (data && data.smsSent === false) {
      console.warn('[notify] SMS δεν στάλθηκε:', data.smsError || 'άγνωστο σφάλμα');
    }

    return true;
  } catch (error) {
    console.warn('[notify] σφάλμα δικτύου:', error);
    return false;
  }
}

/**
 * Καταγράφει στο Medisend ότι η κράτηση προήλθε από το link του χρήστη,
 * ώστε ο συγχρονισμός να τη βάλει στο δικό του ημερολόγιο.
 * Best-effort: αν αποτύχει, η κράτηση παραμένει έγκυρη.
 */
export async function attributeBookingToOwner(
  token: string | null,
  bookingId: string
): Promise<boolean> {
  const apiUrl = (import.meta.env.VITE_MEDILAB_API_URL || '').trim().replace(/\/+$/, '');
  if (!token || !bookingId || !apiUrl) return false;

  try {
    const response = await fetch(`${apiUrl}/public/booking-attribution`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, bookingId }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.warn('[attribution] απέτυχε:', response.status, text.slice(0, 200));
      return false;
    }

    return true;
  } catch (error) {
    console.warn('[attribution] σφάλμα δικτύου:', error);
    return false;
  }
}
