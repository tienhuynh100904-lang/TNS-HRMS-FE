// Client for the tns-hrms backend (Spring Boot). Only used in the browser.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// The backend is an OAuth2 authorization server (client credentials grant): an application logs in with a client id and
// secret and gets an access token that lives for `expires_in` seconds. There are no users and no refresh token: the
// token is renewed by asking for a new one with the same secret, 5 minutes before it expires. The secret is kept in
// memory only (never in storage), so after a page reload the token just runs out and the user logs in again.
const TOKEN_KEY = "access_token";
const SESSION_KEY = "session";

export type Session = {
  clientId: string;
  expiresAt: number; // epoch milliseconds
};

export type Page<T> = {
  meta: { page: number; pageSize: number; pages: number; total: number };
  result: T[];
};

export type DailyAttendance = {
  branchCode: string;
  userCode: string;
  employeeCode: string | null;
  fullName: string | null;
  departmentName: string | null;
  workDate: string;
  checkInTime: string;
  checkOutTime: string | null;
  punchCount: number;
  status: "OK" | "SINGLE_PUNCH" | "IN_PROGRESS";
};

export type PunchUser = {
  branchCode: string;
  userCode: string;
  employeeCode: string | null;
  fullName: string | null;
  departmentName: string | null;
  punchTime: string;
};

export type Employee = {
  id: number;
  employeeCode: string;
  userCode: string | null; // code on the attendance devices; null when the employee does not use a device
  cardCode: string | null;
  fullName: string | null;
  departmentId: number | null;
  departmentName: string | null;
  active: boolean;
};

export type EmployeePunch = {
  punchTime: string;
  branchCode: string;
  direction: "IN" | "OUT" | null;
};

export type PullResult = {
  branchCode: string;
  result: { received: number; inserted: number; updated: number; duplicates: number; skipped: number } | null;
  error: string | null;
};

type Audit = { createdAt: string | null; updatedAt: string | null; createdBy: string | null; updatedBy: string | null };

/** An application allowed to call the API (OAuth2 client). The secret is only ever returned on create / renew. */
export type ApiClient = Audit & {
  id: number;
  clientId: string;
  name: string | null;
  description: string | null;
  active: boolean;
  role: string | null; // role name
};

export type ApiClientWithSecret = ApiClient & { clientSecret: string };

export type Permission = Audit & {
  id: number;
  name: string;
  apiPath: string; // the endpoint's path pattern, e.g. /api/v1/clients/{id}
  method: string;
  module: string;
  active: boolean;
};

export type Role = Audit & { id: number; name: string; description: string | null; active: boolean };

export type RoleDetail = Role & { permissions: Permission[] };

/** The role that may call every endpoint without any permission; it cannot be renamed, turned off or deleted. */
export const ADMIN_ROLE = "ADMIN";

export function getSession(): Session | null {
  try {
    const session: Session | null = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    return session && session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

/** The access token, or null when there is none or it has expired. */
export const getToken = () => (getSession() ? localStorage.getItem(TOKEN_KEY) : null);

export function clearLogin() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function send(path: string, init: RequestInit = {}) {
  // the timers may have been throttled: renew here too when the token is about to expire
  const session = getSession();
  if (session && credentials && session.expiresAt - Date.now() < RENEW_BEFORE_MS) await renew();
  const token = getToken();
  return fetch(API_URL + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

async function unwrap<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (res.status === 403) throw new ApiError(403, "Client này không có quyền thực hiện thao tác này");
  if (!res.ok) throw new ApiError(res.status, body?.message ?? `Lỗi ${res.status}`);
  return body?.data as T;
}

function toLogin() {
  clearLogin();
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose: drops all state of the old session
  window.location.href = "/login";
}

/** Calls the API; on 401 (no token, expired, or the client was deactivated) sends the user back to the login page. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await send(path, init);
  if (res.status === 401) toLogin();
  return unwrap<T>(res);
}

// --- session: login, silent renewal, expiry -------------------------------------------------------------------------

const RENEW_BEFORE_MS = 5 * 60 * 1000;
const RETRY_MS = 30 * 1000;

let credentials: { clientId: string; clientSecret: string } | null = null; // memory only, see the top of the file
let timer: ReturnType<typeof setTimeout> | undefined;
let renewing: Promise<boolean> | null = null;
let listening = false;

/** Gets a token through our own /api/token route (the backend's token endpoint has no CORS, see there) and keeps it. */
async function requestToken(clientId: string, clientSecret: string) {
  const res = await fetch("/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.message ?? `Lỗi ${res.status}`);
  const session: Session = { clientId: clientId.trim(), expiresAt: Date.now() + body.expires_in * 1000 };
  localStorage.setItem(TOKEN_KEY, body.access_token);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/**
 * Asks for a new token. Rejected credentials (the secret was renewed, the client was deactivated) end the session;
 * any other failure keeps the old token and tries again shortly, until that token expires.
 */
async function renew() {
  if (!credentials) return;
  const { clientId, clientSecret } = credentials;
  renewing ??= requestToken(clientId, clientSecret)
    .then(() => true)
    .catch((e) => {
      if (e instanceof ApiError && e.status === 401) toLogin();
      return false;
    })
    .finally(() => {
      renewing = null;
    });
  if (await renewing) schedule();
  else {
    clearTimeout(timer);
    timer = setTimeout(schedule, RETRY_MS);
  }
}

/** Sleeps until it is time to renew (when this tab holds the secret) or until the token expires, then looks again. */
function schedule() {
  clearTimeout(timer);
  const session = getSession();
  if (!session) return toLogin();
  const renewAt = credentials ? session.expiresAt - RENEW_BEFORE_MS : Infinity;
  if (renewAt <= Date.now()) return void renew();
  timer = setTimeout(schedule, Math.min(renewAt, session.expiresAt) - Date.now());
}

/** Starts the renewal / expiry timers for the logged-in session; call it whenever a page loads with a token. */
export function watchSession() {
  schedule();
  if (listening) return;
  listening = true;
  // timers are throttled in background tabs and stop while the computer sleeps: look again when the tab comes back
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && getToken() && schedule());
}

/** Logs in with an OAuth2 client. */
export async function login(clientId: string, clientSecret: string) {
  await requestToken(clientId, clientSecret);
  credentials = { clientId: clientId.trim(), clientSecret };
  watchSession();
}

/** The secret of `clientId` was just renewed: when it is the client logged in here, keep renewing with the new one. */
export function rememberSecret(clientId: string, clientSecret: string) {
  if (credentials?.clientId === clientId) credentials = { clientId, clientSecret };
}

/** There is nothing to revoke on the server (tokens just expire), so logging out only forgets the token and secret. */
export function logout() {
  credentials = null;
  clearTimeout(timer);
  clearLogin();
}

export function query(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  return q.toString();
}
