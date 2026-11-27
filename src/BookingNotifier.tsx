import { useEffect, useRef } from 'react';
import { attributeBookingToOwner, getBookingRef, sendBookingNotification } from './notify';
import { savePatientContact } from './patient-cookie';

interface BookingNotifierProps {
  /** Καλείται όταν ολοκληρωθεί η προσπάθεια αποστολής email. */
  onResult?: (sent: boolean) => void;
  /** Καλείται όταν η κράτηση αποτύχει (π.χ. όριο χρήσης Hapio). */
  onError?: (message: string) => void;
}

const STORE_KEY = 'hapio-booking-store';

// Module-level ώστε να αντέχει στο double-mount του React StrictMode.
const sentBookings = new Set<string>();

/**
 * Παρακολουθεί το αποτέλεσμα της κράτησης και, όταν ολοκληρωθεί επιτυχώς,
 * ζητά από το backend (/api/notify) να στείλει τα email επιβεβαίωσης.
 *
 * Το Hapio Booking Flow δεν στέλνει email από μόνο του — το μήνυμα
 * «στάλθηκε email» είναι στατικό κείμενο του component. Επίσης το package
 * εσωκλείει το δικό του state manager, οπότε διαβάζουμε το persisted state
 * (zustand persist) αντί να μοιραζόμαστε το store instance.
 */
export function BookingNotifier({ onResult, onError }: BookingNotifierProps) {
  const handled = useRef<string | null>(null);

  useEffect(() => {
    let lastRaw: string | null = null;

    const check = () => {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(STORE_KEY);
      } catch {
        return;
      }
      if (!raw || raw === lastRaw) return;
      lastRaw = raw;

      let booking: any;
      try {
        const parsed = JSON.parse(raw);
        booking = parsed?.state?.bookingResult ?? parsed?.bookingResult;
      } catch {
        return;
      }

      const id = booking?.id;
      if (!id) {
        // Αποτυχημένη κράτηση: { success: false, error }
        if (booking?.success === false) {
          const message = String(booking?.error || '');
          onError?.(
            /limit|quota|exceed|rate/i.test(message)
              ? 'Έχει συμπληρωθεί το όριο κρατήσεων της υπηρεσίας. Δοκιμάστε ξανά αργότερα ή επικοινωνήστε με την κλινική.'
              : message || 'Η κράτηση απέτυχε. Δοκιμάστε ξανά ή επικοινωνήστε με την κλινική.'
          );
        }
        return;
      }
      if (handled.current === id || sentBookings.has(id)) return;
      handled.current = id;
      sentBookings.add(id);

      const marker = `medilab-notified:${id}`;
      try {
        if (localStorage.getItem(marker)) return;
      } catch {
        // localStorage μη διαθέσιμο (private mode) — συνεχίζουμε χωρίς dedupe
      }

      const metadata: Record<string, string> = booking.metadata || {};

      // Αποθήκευση στοιχείων ώστε να μη τα ξαναπληκτρολογήσει την επόμενη φορά.
      savePatientContact({
        name: metadata.name,
        email: metadata.email,
        phone: metadata.phone,
      });

      // Προέλευση: αν το link έχει ?ref=<token>, το ραντεβού ανήκει σε εκείνον τον χρήστη.
      const ref = getBookingRef();
      void attributeBookingToOwner(ref, id);

      void sendBookingNotification({
        bookingId: id,
        ref: ref || undefined,
        name: metadata.name,
        email: metadata.email,
        phone: metadata.phone,
        startsAt: booking.starts_at,
        endsAt: booking.ends_at,
        service: booking.service?.name,
        location: booking.location?.name,
        resource: booking.resource?.name,
      }).then(sent => {
        if (sent) {
          try {
            localStorage.setItem(marker, new Date().toISOString());
          } catch {
            // αγνοούμε — το ref προστατεύει από διπλή αποστολή στη συνεδρία
          }
        }
        onResult?.(sent);
      });
    };

    check();
    const timer = window.setInterval(check, 1000);
    return () => window.clearInterval(timer);
  }, [onResult, onError]);

  return null;
}
