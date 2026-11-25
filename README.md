# Medisend — Online Ραντεβού (Booking App)

Ανεξάρτητη εφαρμογή κράτησης ραντεβού για ασθενείς, χτισμένη πάνω στο επίσημο
[`@hapio/hapio-booking-flow-react`](https://github.com/Hapio-Booking-and-Scheduling-API/hapio-booking-flow-react).

Ο ασθενής βλέπει ένα απλό flow (Τοποθεσία → Υπηρεσία → Προσωπικό → Ημερομηνία →
Ώρα → Στοιχεία → Επιβεβαίωση) και συμπληρώνει μόνο τα στοιχεία του.

> Το project αυτό είναι **εντελώς ανεξάρτητο** από το frontend και το backend του
> Medisend. Δεν μοιράζεται κώδικα ούτε βάση δεδομένων — μόνο το Hapio API.

## Stack

- Vite + React 18 + TypeScript
- `@hapio/hapio-booking-flow-react` (client-side component)

## Απαιτούμενο Hapio token (ΣΗΜΑΝΤΙΚΟ)

Η εφαρμογή τρέχει στον browser του ασθενούς, άρα το token **εκτίθεται** στον
client. Χρησιμοποιήστε **ένα ξεχωριστό, περιορισμένο token** στο Hapio με ΜΟΝΟ
αυτά τα δικαιώματα:

- `booking:create`
- `location:view`
- `service:view`
- `resource:view`
- `resource_service:view`
- `bookable_slot:view`

Μη χρησιμοποιείτε το admin token `HAPIO_API_KEY` του backend.

## Setup

```bash
npm install
cp .env.example .env.local   # βάλτε το VITE_HAPIO_API_TOKEN
npm run dev                  # http://localhost:5173
```

Στο **Vercel**, ορίστε τις ίδιες τιμές ως Environment Variables
(`VITE_HAPIO_API_TOKEN`, προαιρετικά `VITE_HAPIO_BASE_URL`).

### Build / Preview

```bash
npm run build
npm run preview
```

## Σύνδεση με το Medisend

- Στο backend του Medisend, το κουμπί **«Ραντεβού ασθενή»** (NavBar) και η
  ενότητα **Hapio** στις Ρυθμίσεις δείχνουν σε αυτή την εφαρμογή μέσω της
  μεταβλητής `NEXT_PUBLIC_BOOKING_URL`.
- Τα bookings που δημιουργούνται εδώ αποθηκεύουν metadata
  `{ name, email, phone }`. Ο συγχρονισμός `POST /api/hapio/sync` τα εισάγει ως
  ραντεβού, αντιστοιχίζοντας τον ασθενή με email/τηλέφωνο/ονοματεπώνυμο (ή
  δημιουργώντας νέο ασθενή).

### Προσωπικά links (`?ref=`) — υποχρεωτικό

Κάθε χρήστης του Medisend έχει δικό του link:
`https://<booking-app>.vercel.app/?ref=<token>`

**Χωρίς `ref` η εφαρμογή δεν ανοίγει** (εμφανίζει «Απαιτείται σύνδεσμος») και το
`/api/notify` επιστρέφει `403`, ώστε να μη δημιουργούνται ραντεβού χωρίς ιδιοκτήτη.

Όταν το URL περιέχει `ref`, το booking app:
1. ελέγχει το token (`GET /api/public/booking-link/:token`) και δείχνει το όνομα
   του χρήστη («Ραντεβού με …»),
2. ενημερώνει το Medisend ποιος «έκλεισε» το ραντεβού
   (`POST /api/public/booking-attribution`), ώστε ο συγχρονισμός να το καταχωρεί
   στο δικό του ημερολόγιο (`doctorId`).

Απαιτείται:

```
VITE_MEDILAB_API_URL=https://medilab-api.onrender.com/api
```

και το origin του booking app στο `WEB_ORIGIN` του backend (CORS).
Αν λείπει το `VITE_MEDILAB_API_URL`, ο έλεγχος/attribution παραλείπεται (μόνο
τοπική χρήση) — το `ref` παραμένει υποχρεωτικό στο URL.

## Email & SMS επιβεβαίωσης (Brevo)

**Το Hapio δεν στέλνει email/SMS** — είναι headless API. Το «στάλθηκε email» είναι
στατικό κείμενο του component. Η αποστολή γίνεται από το serverless function
[`api/notify.ts`](./api/notify.ts) μέσω [Brevo](https://brevo.com):

1. Δημιουργήστε λογαριασμό Brevo (δωρεάν, 300 email/ημέρα).
2. **Senders** → προσθέστε και επαληθεύστε το email αποστολέα (π.χ. `weblabplus@gmail.com`).
3. **SMTP & API → API Keys** → δημιουργήστε key.
4. Ορίστε τα env vars (`.env.local` τοπικά / Vercel σε production):

```
BREVO_API_KEY=...
SENDER_EMAIL=weblabplus@gmail.com
SENDER_NAME=Medisend
CLINIC_EMAIL=...   # προαιρετικό, default = SENDER_EMAIL

SMS_SENDER=Medisend   # max 11 χαρακτήρες
SMS_ENABLED=true
CLINIC_PHONE=         # προαιρετικό, E.164 π.χ. +306900000000
```

Το function στέλνει:
- **email στον ασθενή**: επιβεβαίωση με ημερομηνία, ώρα, υπηρεσία, τοποθεσία, προσωπικό
- **email στην κλινική** (`CLINIC_EMAIL`): ειδοποίηση νέου online ραντεβού
- **SMS στον ασθενή**: σύντομο μήνυμα `Medisend: <όνομα>, ραντεβού 26/11 10:30. Επιβεβαιώθηκε.`

### SMS σημειώσεις

- Τα SMS χρεώνονται **ξεχωριστά** από τα email στο Brevo (credits). Αν δεν υπάρχουν
  credits, το email φεύγει κανονικά και το SMS αποτυγχάνει σιωπηλά (log).
- Το τηλέφωνο κανονικοποιείται σε **E.164**: `6944524820`, `00306944524820` και
  `+306944524820` γίνονται όλα `+306944524820`.
- Ελληνικοί χαρακτήρες = UCS-2, άρα ~70 χαρακτήρες ανά SMS· το μήνυμα κρατιέται
  σκόπιμα σύντομο για 1 τμήμα.
- Αν αποτύχουν **και** email **και** SMS → `502` (εμφανίζεται προειδοποίηση στον ασθενή).
- Rate limit: 5 αποστολές / 10 λεπτά ανά IP.

> Τοπικά το `vite dev` δεν εκτελεί Vercel Functions — το `vite.config.ts`
> σερβίρει το ίδιο handler στο `/api/notify`, οπότε δουλεύει και χωρίς `vercel dev`.

## Customization

Όλα τα κείμενα και τα πεδία φόρμας ορίζονται στο [`src/config.ts`](./src/config.ts).
Το theme χρησιμοποιεί το **προεπιλεγμένο (επίσημο) palette του Hapio** (σκοτεινό
φόντο, κίτρινο accent `#F6C800`) — δεν εφαρμόζονται τα χρώματα της εταιρικής
ταυτότητας του Medisend, γιατί είχαν κακή αντίθεση στην οθόνη.
