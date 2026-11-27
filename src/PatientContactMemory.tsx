import { useEffect } from 'react';
import { readPatientContact, savePatientContact, type PatientContact } from './patient-cookie';

type FieldKey = 'name' | 'email' | 'phone';

const FIELDS: FieldKey[] = ['name', 'email', 'phone'];

/**
 * Το React ελέγχει το `value` των inputs, οπότε ένα σκέτο `input.value = x`
 * δεν ενημερώνει το state του component. Χρησιμοποιούμε τον native setter και
 * στέλνουμε `input` event ώστε να τρέξει το onChange του React.
 */
function setNativeValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function findField(key: FieldKey): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>(`input[name="${key}"]`);
}

/** Διαβάζει τα τρέχοντα πεδία της φόρμας (όσα υπάρχουν στο DOM). */
function readFormValues(): PatientContact {
  const values: PatientContact = {};
  for (const key of FIELDS) {
    const input = findField(key);
    if (input) values[key] = input.value;
  }
  return values;
}

/**
 * Συμπληρώνει αυτόματα τα στοιχεία του ασθενή από το cookie και αποθηκεύει
 * ό,τι πληκτρολογεί, ώστε να μη χρειάζεται να τα ξαναγράψει στην επόμενη
 * κράτηση.
 */
export function PatientContactMemory() {
  useEffect(() => {
    const saved = readPatientContact();
    let timer: number | undefined;

    // ── 1) Prefill όταν εμφανιστεί η φόρμα στοιχείων ──
    if (saved) {
      const attempted = new WeakSet<HTMLInputElement>();

      const apply = () => {
        const pending = FIELDS.filter(key => Boolean(saved[key]));
        let filled = 0;

        for (const key of pending) {
          const input = findField(key);
          if (!input) continue; // η φόρμα δεν έχει εμφανιστεί ακόμα

          if (!attempted.has(input)) {
            attempted.add(input);
            // Δεν πατάμε πάνω σε ό,τι έχει ήδη πληκτρολογήσει ο ασθενής.
            if (!input.value) setNativeValue(input, saved[key] as string);
          }
          filled += 1;
        }

        if (pending.length === 0 || filled === pending.length) {
          if (timer) window.clearInterval(timer);
          timer = undefined;
        }
      };

      apply();
      timer = window.setInterval(apply, 600);
    }

    // ── 2) Αποθήκευση όταν συμπληρωθούν και τα τρία πεδία ──
    let debounce: number | undefined;

    const handleInput = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (!target || !FIELDS.includes(target.name as FieldKey)) return;

      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        const values = readFormValues();
        // Αποθηκεύουμε μόνο πλήρες σετ, ώστε να μη σβήνουμε παλιά στοιχεία
        // όσο ο ασθενής πληκτρολογεί.
        if (values.name && values.email && values.phone) {
          savePatientContact(values);
        }
      }, 700);
    };

    document.addEventListener('input', handleInput, true);

    return () => {
      document.removeEventListener('input', handleInput, true);
      window.clearTimeout(debounce);
      if (timer) window.clearInterval(timer);
    };
  }, []);

  return null;
}
