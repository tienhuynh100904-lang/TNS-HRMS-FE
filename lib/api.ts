// Client for the tns-hrms backend (Spring Boot). Only used in the browser.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const TOKEN_KEY = "access_token";
const ACCOUNT_KEY = "account";

export type Account = {
  id: number;
  email: string;
  username: string;
  avatar?: string;
  phone?: string;
  role?: string;
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

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export function getAccount(): Account | null {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? "null");
  } catch {
    return null;
  }
}

function saveLogin(data: { access_token: string; account: Account }) {
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(data.account));
}

export function clearLogin() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ACCOUNT_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function send(path: string, init: RequestInit = {}) {
  const token = getToken();
  return fetch(API_URL + path, {
    ...init,
    credentials: "include", // the refresh token lives in an HttpOnly cookie
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

async function unwrap<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.message ?? `Lỗi ${res.status}`);
  return body?.data as T;
}

async function refresh() {
  const res = await fetch(API_URL + "/api/v1/auth/refresh", { method: "POST", credentials: "include" });
  if (!res.ok) return false;
  saveLogin(await unwrap(res));
  return true;
}

/** Calls the API; on 401 tries the refresh cookie once, then sends the user back to the login page. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res = await send(path, init);
  if (res.status === 401 && (await refresh())) res = await send(path, init);
  if (res.status === 401) {
    clearLogin();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose: drops all state of the old session
    window.location.href = "/login";
  }
  return unwrap<T>(res);
}

export async function login(email: string, password: string) {
  const res = await send("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  if (res.status === 401) throw new ApiError(401, "Email hoặc mật khẩu không đúng");
  saveLogin(await unwrap(res));
}

export async function logout() {
  await send("/api/v1/auth/logout", { method: "POST" }).catch(() => {});
  clearLogin();
}

export function query(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  return q.toString();
}
