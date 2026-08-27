const STAFF_SESSION_KEY = 'riverside_staff';

// Mirrors the base URL resolution in ../api/client.ts. The generated
// `openapi-fetch` client (src/api/types.ts) doesn't yet know about
// /api/staff/login — that endpoint isn't in this worktree's backend, so
// `npm run gen:types` hasn't picked it up. Once the backend change lands and
// types.ts is regenerated, this can move onto `client.POST("/api/staff/login", …)`
// alongside the rest of the app instead of a standalone fetch.
const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://127.0.0.1:8000');

export type StaffRole = 'Manager' | 'Bookseller';

export interface StaffSession {
  staff_id: string;
  name: string;
  role: StaffRole;
}

export type StaffLoginResult =
  | { ok: true; staff: StaffSession }
  | { ok: false; error: string };

const NETWORK_ERROR_MESSAGE = "Couldn't reach the server. Check your connection and try again.";
const DEFAULT_ERROR_MESSAGE = 'Incorrect email or password';

export async function login(email: string, password: string): Promise<StaffLoginResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, error: NETWORK_ERROR_MESSAGE };
  }

  if (!response.ok) {
    let error = DEFAULT_ERROR_MESSAGE;
    try {
      const body = await response.json();
      if (typeof body?.detail === 'string') {
        error = body.detail;
      }
    } catch {
      // No JSON body to read; fall back to the default message.
    }
    return { ok: false, error };
  }

  const data = await response.json();
  const staff: StaffSession = {
    staff_id: data.staff_id,
    name: data.name,
    role: data.role,
  };
  setStaffSession(staff);
  return { ok: true, staff };
}

function setStaffSession(staff: StaffSession): void {
  sessionStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(staff));
}

export function getStaffSession(): StaffSession | null {
  const raw = sessionStorage.getItem(STAFF_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.staff_id === 'string' && typeof parsed.name === 'string') {
      return parsed as StaffSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearStaffSession(): void {
  sessionStorage.removeItem(STAFF_SESSION_KEY);
}
