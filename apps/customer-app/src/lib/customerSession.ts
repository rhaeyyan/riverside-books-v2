import { client } from '../api/client';
import type { components } from '../api/types';

export type Customer = components['schemas']['Customer'];

const CUSTOMER_SESSION_KEY = 'riverside_customer';

// Same-tab listeners can't rely on the native `storage` event — it only
// fires in *other* tabs/windows — so any same-tab write (clearCustomerSession,
// or a successful login()/register() below) also dispatches this custom
// event for same-tab subscribers (see subscribeToCustomerSession).
const CUSTOMER_SESSION_CHANGE_EVENT = 'riverside-customer-session-change';

export interface CustomerSession {
  customer_id: string;
  email: string;
  name: string;
  phone: string | null;
}

function isCustomerSession(value: unknown): value is CustomerSession {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.customer_id === 'string' &&
    typeof v.email === 'string' &&
    typeof v.name === 'string' &&
    (v.phone === null || typeof v.phone === 'string')
  );
}

// Reads the session that either this file's login()/register() (below) or
// the landing page (web/index.html) has written to localStorage — both
// write the same shape (see the module doc on CustomerSession). localStorage,
// not sessionStorage — a customer session should persist across tabs/reloads,
// unlike the staff PIN gate in staff-dashboard's staffAuth.ts.
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

function writeCustomerSession(session: CustomerSession): void {
  localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(CUSTOMER_SESSION_CHANGE_EVENT));
}

function sessionFromCustomer(customer: Customer): CustomerSession {
  return {
    customer_id: customer.customer_id,
    email: customer.email,
    name: customer.name,
    phone: customer.phone ?? null,
  };
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

export type AuthResult = { ok: true; customer: Customer } | { ok: false; error: string };

// Shared connection-failure copy — matches the wording already used for
// fetch failures elsewhere in this app (MyOrders.tsx, LoyaltyCard.tsx).
const CONNECTION_ERROR = 'Unable to connect to the store database. Please try again.';

/**
 * Signs an existing customer in against POST /api/customers/login. On
 * success, writes the session (see CustomerSession above) and returns the
 * customer. Never throws — a 401 or a network failure both resolve to
 * `{ ok: false, error }` with copy safe to show directly in a form.
 */
export async function login(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error, response } = await client.POST('/api/customers/login', {
      body: { email, password },
    });
    if (error || !data) {
      if (response.status === 401) {
        return { ok: false, error: 'Incorrect email or password.' };
      }
      return { ok: false, error: 'Could not sign in. Please try again.' };
    }
    writeCustomerSession(sessionFromCustomer(data));
    return { ok: true, customer: data };
  } catch {
    return { ok: false, error: CONNECTION_ERROR };
  }
}

/**
 * Registers a new customer against POST /api/customers (now the
 * email/password registration endpoint, not the old phone-only one). On
 * success, writes the session and returns the customer. A 400 (duplicate
 * email) surfaces as a clear, user-facing message rather than a raw detail
 * string.
 */
export async function register(
  email: string,
  password: string,
  name: string,
  phone?: string
): Promise<AuthResult> {
  try {
    const { data, error, response } = await client.POST('/api/customers', {
      body: { email, password, name, phone: phone?.trim() || null },
    });
    if (error || !data) {
      if (response.status === 400) {
        return { ok: false, error: 'An account with this email already exists.' };
      }
      if (response.status === 422) {
        return {
          ok: false,
          error: 'Please check your details — the email must look valid and the password needs at least 8 characters.',
        };
      }
      return { ok: false, error: 'Could not create your account. Please try again.' };
    }
    writeCustomerSession(sessionFromCustomer(data));
    return { ok: true, customer: data };
  } catch {
    return { ok: false, error: CONNECTION_ERROR };
  }
}
