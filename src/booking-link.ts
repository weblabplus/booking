// Στοιχεία ιδιοκτήτη του προσωπικού link (?ref=<token>)

export interface BookingLinkOwner {
  displayName: string;
}

export interface BookingLinkLookup {
  /** true όταν το link επαληθεύτηκε επιτυχώς */
  valid: boolean;
  owner?: BookingLinkOwner;
  /** true όταν δεν υπάρχει ρυθμισμένο Medisend API (δεν μπορούμε να ελέγξουμε) */
  skipped?: boolean;
  error?: string;
}

function apiUrl(): string {
  return (import.meta.env.VITE_MEDILAB_API_URL || '').trim().replace(/\/+$/, '');
}

/**
 * Ρωτά το Medisend ποιος χρήστης ανήκει το link.
 *
 * Το `ref` είναι υποχρεωτικό: χωρίς αυτό η εφαρμογή δεν ανοίγει (αλλιώς θα
 * δημιουργούνταν ραντεβού που δεν ανήκουν σε κανέναν χρήστη).
 * Αν λείπει το `VITE_MEDILAB_API_URL`, ο έλεγχος παραλείπεται (μόνο τοπικά).
 */
export async function fetchBookingLinkOwner(
  token: string | null
): Promise<BookingLinkLookup> {
  if (!token) {
    return {
      valid: false,
      error: 'Το link δεν περιέχει κωδικό πρόσκλησης (ref).',
    };
  }

  const base = apiUrl();
  if (!base) return { valid: true, skipped: true };

  try {
    const response = await fetch(
      `${base}/public/booking-link/${encodeURIComponent(token)}`
    );

    if (response.status === 404) {
      return { valid: false, error: 'Το link δεν είναι έγκυρο ή έχει ανακληθεί.' };
    }
    if (!response.ok) {
      return { valid: true, skipped: true };
    }

    const data = (await response.json()) as {
      valid?: boolean;
      owner?: BookingLinkOwner;
    };

    if (data?.valid === false) {
      return { valid: false, error: 'Το link δεν είναι έγκυρο ή έχει ανακληθεί.' };
    }

    return { valid: true, owner: data?.owner };
  } catch {
    // Δίκτυο/CORS — δεν μπλοκάρουμε την κράτηση
    return { valid: true, skipped: true };
  }
}
