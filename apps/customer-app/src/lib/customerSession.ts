const CUSTOMER_SESSION_KEY = 'riverside_customer';

// Same-tab listeners can't rely on the native `storage` event — it only
// fires in *other* tabs/windows — so clearCustomerSession() also dispatches
// this custom event for same-tab subscribers (see subscribeToCustomerSession).
const CUSTOMER_SESSION_CHANGE_EVENT = 'riverside-customer-session-change';

export interface CustomerSession {
  customer_id: string;
  phone: string;
  name: string;
}

function isCustomerSession(value: unknown): value is CustomerSession {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.customer_id === 'string' &&
    typeof v.phone === 'string' &&
    typeof v.name === 'string'
  );
}

// Reads the session the landing page (web/index.html) writes to localStorage.
// localStorage, not sessionStorage — a customer session should persist across
// tabs/reloads, unlike the staff PIN gate in staff-dashboard's staffAuth.ts.
export function getCustomerSession(): CustomerSession | null {
  const raw = localStorage.getItem(CUSTOMER_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isCustomerSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearCustomerSession(): void {
  localStorage.removeItem(CUSTOMER_SESSION_KEY);
  // Native `storage` events don't fire in the tab that made the change, so
  // same-tab consumers (App.tsx's header, MyOrders, LoyaltyCard) need this
  // to know the session just disappeared out from under them.
  window.dispatchEvent(new Event(CUSTOMER_SESSION_CHANGE_EVENT));
}

// Subscribes to both same-tab session changes (the custom event dispatched
// above) and cross-tab changes (the native `storage` event, which fires only
// in *other* tabs when localStorage changes there). Callback receives no
// arguments — callers should re-read getCustomerSession() themselves, since
// that's the one source of truth. Returns an unsubscribe function.
export function subscribeToCustomerSession(callback: () => void): () => void {
  const onCustomEvent = () => callback();
  const onStorageEvent = (e: StorageEvent) => {
    if (e.key === null || e.key === CUSTOMER_SESSION_KEY) callback();
  };
  window.addEventListener(CUSTOMER_SESSION_CHANGE_EVENT, onCustomEvent);
  window.addEventListener('storage', onStorageEvent);
  return () => {
    window.removeEventListener(CUSTOMER_SESSION_CHANGE_EVENT, onCustomEvent);
    window.removeEventListener('storage', onStorageEvent);
  };
}
