import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  clearPatientContact,
  PATIENT_COOKIE_CHANGE_EVENT,
  readPatientContact,
} from './patient-cookie';

const FIELDS = ['name', 'email', 'phone'] as const;

/**
 * Βρίσκει το container της φόρμας «Τα στοιχεία σας» (του Hapio Flow): ο
 * κοντινότερος πρόγονος που περιέχει και τα τρία πεδία.
 */
function findFieldsContainer(): HTMLElement | null {
  const phone = document.querySelector<HTMLInputElement>('input[name="phone"]');
  if (!phone) return null;

  const form = phone.closest('form');
  let el: HTMLElement | null = phone.parentElement;

  while (el && el !== form) {
    const hasAll = FIELDS.every(key => el!.querySelector(`input[name="${key}"]`));
    if (hasAll) return el;
    el = el.parentElement;
  }

  return form;
}

/** Αδειάζει τα πεδία της φόρμας (React-controlled inputs). */
function clearFormFields(): void {
  for (const key of FIELDS) {
    const input = document.querySelector<HTMLInputElement>(`input[name="${key}"]`);
    if (!input || !input.value) continue;

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(input, '');
    else input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/**
 * Κουμπί «Διαγραφή αποθηκευμένων στοιχείων», τοποθετημένο μέσα στη φόρμα
 * στοιχείων του Hapio Flow — ακριβώς κάτω από τα πεδία.
 */
export function PatientDataControls() {
  const [hasSaved, setHasSaved] = useState(false);
  const [justCleared, setJustCleared] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  const refresh = useCallback(() => {
    setHasSaved(Boolean(readPatientContact()));
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(PATIENT_COOKIE_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(PATIENT_COOKIE_CHANGE_EVENT, refresh);
  }, [refresh]);

  // Η φόρμα στοιχείων εμφανίζεται μόνο στο τελευταίο βήμα — την εντοπίζουμε
  // δυναμικά και προσαρμόζουμε το portal όταν αλλάζει βήμα.
  useEffect(() => {
    const sync = () => {
      const next = findFieldsContainer();
      setContainer(prev => (prev === next ? prev : next));
    };

    sync();
    const timer = window.setInterval(sync, 500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!justCleared) return;
    const timer = window.setTimeout(() => setJustCleared(false), 4000);
    return () => window.clearTimeout(timer);
  }, [justCleared]);

  const handleClear = () => {
    clearPatientContact();
    clearFormFields();
    setHasSaved(false);
    setJustCleared(true);
  };

  if (!container || (!hasSaved && !justCleared)) return null;

  return createPortal(
    <div className="patient-controls patient-controls--inline">
      {justCleared ? (
        <p className="patient-controls__done" role="status">
          Τα στοιχεία διαγράφηκαν από αυτή τη συσκευή.
        </p>
      ) : (
        <button type="button" className="patient-controls__button" onClick={handleClear}>
          <span aria-hidden="true">🗑</span>
          Διαγραφή αποθηκευμένων στοιχείων
        </button>
      )}
    </div>,
    container
  );
}
