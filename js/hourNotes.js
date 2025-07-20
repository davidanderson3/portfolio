export const NOTES_KEY = 'hourNotes';

export function loadHourNotes() {
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveHourNotes(notes) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes || {}));
}
