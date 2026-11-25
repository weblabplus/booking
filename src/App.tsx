import { useCallback, useEffect, useState } from 'react';
import { Flow } from '@hapio/hapio-booking-flow-react';
import { buildConfig } from './config';
import { BookingNotifier } from './BookingNotifier';
import { fetchBookingLinkOwner } from './booking-link';
import { getBookingRef } from './notify';
import './styles.css';

const config = buildConfig();
const isConfigured = Boolean(config.hapioApiToken);

function App() {
  const [emailFailed, setEmailFailed] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [checkingLink, setCheckingLink] = useState(true);

  const handleNotifyResult = useCallback((sent: boolean) => {
    setEmailFailed(!sent);
  }, []);

  const handleBookingError = useCallback((message: string) => {
    setBookingError(message);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ref = getBookingRef();

    void fetchBookingLinkOwner(ref).then(result => {
      if (cancelled) return;
      if (!result.valid) {
        setLinkError(result.error || 'Το link δεν είναι έγκυρο.');
      } else if (result.owner?.displayName) {
        setOwnerName(result.owner.displayName);
      }
      setCheckingLink(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isConfigured) {
    return (
      <div className="app-shell">
        <div className="not-configured" role="alert">
          <h1>Online ραντεβού</h1>
          <p>Η εφαρμογή δεν έχει ρυθμιστεί ακόμα.</p>
          <p>
            Ορίστε το <code>VITE_HAPIO_API_TOKEN</code> στο <code>.env.local</code>{' '}
            (τοπικά) ή ως Environment Variable στο Vercel και κάντε redeploy.
          </p>
        </div>
      </div>
    );
  }

  if (checkingLink) {
    return (
      <div className="app-shell">
        <p className="booking-loading">Φόρτωση…</p>
      </div>
    );
  }

  if (linkError) {
    return (
      <div className="app-shell">
        <div className="not-configured" role="alert">
          <h1>Απαιτείται σύνδεσμος</h1>
          <p>{linkError}</p>
          <p>
            Ανοίξτε το link που σας έδωσε η κλινική (περιέχει <code>?ref=…</code>) ή ζητήστε
            ένα νέο σύνδεσμο για online ραντεβού.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <BookingNotifier onResult={handleNotifyResult} onError={handleBookingError} />
      {ownerName && (
        <div className="owner-badge">
          <span className="owner-badge__label">Ραντεβού με</span>
          <span className="owner-badge__name">{ownerName}</span>
        </div>
      )}
      {bookingError && (
        <p className="booking-error" role="alert">
          {bookingError}
        </p>
      )}
      <Flow config={config} />
      {emailFailed && (
        <p className="email-warning" role="status">
          Το ραντεβού καταχωρήθηκε, αλλά το email επιβεβαίωσης δεν στάλθηκε. Αν δεν το
          λάβετε, επικοινωνήστε με την κλινική.
        </p>
      )}
    </div>
  );
}

export default App;
