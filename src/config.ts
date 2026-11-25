// Ρύθμιση του Hapio Booking Flow για το Medisend.
// Οι τιμές έρχονται από environment variables (VITE_*) ώστε το ίδιο build
// να δουλεύει τοπικά και στο Vercel.

const DEFAULT_BASE_URL = 'https://eu-central-1.hapio.net/v1';

export function buildConfig() {
  const hapioApiToken = (import.meta.env.VITE_HAPIO_API_TOKEN || '').trim();
  const hapioBaseURL = (
    import.meta.env.VITE_HAPIO_BASE_URL || DEFAULT_BASE_URL
  ).trim();

  return {
    hapioApiToken,
    hapioBaseURL,
    settings: {
      // date-fns locale για ελληνικά
      locale: 'el',
      // Ώρα Ελλάδας (IANA tz database name)
      timezone: 'Europe/Athens',
      storeExpireTime: 84000000,
      afterBookingExipreTime: 300000,
      metaDataFields: {
        name: {
          required: true,
          type: 'text',
          size: 'full',
          label: 'Ονοματεπώνυμο',
          placeholder: 'Ονοματεπώνυμο',
        },
        email: {
          required: true,
          type: 'email',
          size: 'half',
          label: 'Email',
          placeholder: 'Email',
        },
        phone: {
          required: true,
          type: 'tel',
          size: 'half',
          label: 'Τηλέφωνο',
          placeholder: 'Τηλέφωνο',
        },
      },
    },
    theme: {
      palette: {
        // Προεπιλεγμένο (επίσημο) theme του Hapio Booking Flow
        primary: '#F6C800',
        secondary: '#B1BCFD',
        title: '#F5EAFF',
        data: '#B1BCFD',
        text: '#F5EAFF',
        input: '#F5EAFF',
        confirm: '#0F042E',
        dark: '#28213D',
        light: '#6B7280',
        disabled: '#374151',
        background: '#0F042E',
        background2: '#28213D',
        error: '#F6C800',
      },
      fonts: {
        families: {
          primary: "'Space Grotesk', sans-serif",
          secondary: "'Helvetica Neue', sans-serif",
        },
        sizes: {
          h2: '1.5rem',
          h3: '1.25rem',
          h4: '1rem',
          h5: '0.875rem',
          h6: '0.875rem',
          body1: '1rem',
          body2: '0.875rem',
        },
      },
    },
    content: {
      backButton: 'Πίσω',
      stepText: 'Βήμα',
      locationTitle: 'Τοποθεσία',
      serviceTitle: 'Υπηρεσία',
      resourceTitle: 'Προσωπικό',
      dateTitle: 'Ημερομηνία',
      timeSlotTitle: 'Ώρα',
      timeSlotErrorTextMissingData:
        'Επιλέξτε υπηρεσία, τοποθεσία, ημερομηνία και προσωπικό.',
      timeSlotErrorTextNoResults:
        'Δεν υπάρχουν διαθέσιμες ώρες για την επιλεγμένη ημερομηνία ή το προσωπικό.',
      metaDataFormTitle: 'Τα στοιχεία σας',
      metaDataLocationLabel: 'Τοποθεσία',
      metaDataServiceLabel: 'Υπηρεσία',
      metaDataResourceLabel: 'Προσωπικό',
      metaDataDateLabel: 'Ημερομηνία',
      metaDataTimeLabel: 'Ώρα',
      metaDataFieldsLabel: 'Τα στοιχεία σας',
      metaDataSubmitButton: 'Επιβεβαίωση ραντεβού',
      completedTitle: 'Το ραντεβού επιβεβαιώθηκε',
      completedMessage:
        'Σας ευχαριστούμε! Ένα email επιβεβαίωσης με όλες τις λεπτομέρειες στάλθηκε στο inbox σας.',
    },
  };
}
