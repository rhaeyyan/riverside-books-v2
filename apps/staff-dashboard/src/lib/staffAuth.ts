const STAFF_SESSION_KEY = 'riverside_staff';

const PIN_TO_STAFF: Record<string, string> = {
  '1234': 'Jordan (Manager)',
  '5678': 'Priya (Bookseller)',
};

export function resolvePin(pin: string): string | null {
  return PIN_TO_STAFF[pin] ?? null;
}

export function getStaffSession(): string | null {
  return sessionStorage.getItem(STAFF_SESSION_KEY);
}

export function setStaffSession(name: string): void {
  sessionStorage.setItem(STAFF_SESSION_KEY, name);
}

export function clearStaffSession(): void {
  sessionStorage.removeItem(STAFF_SESSION_KEY);
}
