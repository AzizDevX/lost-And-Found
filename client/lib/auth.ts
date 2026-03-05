/**
 * Authentication Service
 * ─ Access token: module-level memory ref (never localStorage)
 * ─ Refresh token: httpOnly cookie managed by the server
 * ─ On app boot call initAuth() to silently restore session via /api/auth/refresh
 */

import axios, { AxiosError } from "axios";

// ─── Axios instance ───────────────────────────────────────────────────────────
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL, // http://localhost:5000
  withCredentials: true, // send httpOnly refresh cookie automatically
});

// ─── Access token store — memory only ────────────────────────────────────────
let _accessToken: string | null = null;

export const getAccessToken = (): string | null => _accessToken;
export const setAccessToken = (t: string) => {
  _accessToken = t;
};
export const clearAccessToken = () => {
  _accessToken = null;
};
export const isAuthenticated = (): boolean => !!_accessToken;

// ─── Attach Bearer token to every outgoing request ───────────────────────────
api.interceptors.request.use((config) => {
  if (_accessToken) config.headers.Authorization = `Bearer ${_accessToken}`;
  return config;
});

// ─── Auto-refresh on 401 (silent token rotation) ─────────────────────────────
let _refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const token = await refreshSession();
      if (token) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface AuthError {
  code: string;
  message: string;
}

type ServerError = { success: false; error: string; message: string };

function parseError(err: unknown, fallbackCode = "SERVER_ERROR"): AuthError {
  const e = err as AxiosError<ServerError>;
  if (!e.response)
    return { code: "NETWORK_ERROR", message: "Cannot reach server." };
  return {
    code: e.response.data?.error ?? fallbackCode,
    message: e.response.data?.message ?? "Something went wrong.",
  };
}

// ─── refreshSession ───────────────────────────────────────────────────────────
// POST /api/auth/refresh
// Server reads httpOnly refreshToken cookie → verifies session → rotates tokens
// Returns new accessToken or null if session is invalid/expired

export async function refreshSession(): Promise<string | null> {
  if (_refreshing) return _refreshing; // deduplicate concurrent calls

  _refreshing = (async () => {
    try {
      const { data } = await axios.post<{ success: true; accessToken: string }>(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`,
        {},
        { withCredentials: true },
      );
      _accessToken = data.accessToken;
      return data.accessToken;
    } catch {
      // Any 401 (REFRESH_TOKEN_MISSING / INVALID_REFRESH_TOKEN / SESSION_NOT_FOUND
      // / SESSION_EXPIRED / REFRESH_TOKEN_MISMATCH / USER_NOT_FOUND) → clear token
      _accessToken = null;
      return null;
    } finally {
      _refreshing = null;
    }
  })();

  return _refreshing;
}

// ─── initAuth ─────────────────────────────────────────────────────────────────
// Call once on app boot to silently restore session from the httpOnly cookie.
// Returns true if authenticated, false if the user needs to log in.

export async function initAuth(): Promise<boolean> {
  if (_accessToken) return true;
  const token = await refreshSession();
  return !!token;
}

// ─── Login ────────────────────────────────────────────────────────────────────
// POST /api/auth/login  →  { success, accessToken }
// Server sets refreshToken httpOnly cookie automatically

export type LoginResult =
  | { success: true; accessToken: string }
  | { success: false; error: AuthError };

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<LoginResult> {
  try {
    const { data } = await api.post<{ success: true; accessToken: string }>(
      "/api/auth/login",
      payload,
    );
    _accessToken = data.accessToken;
    return { success: true, accessToken: data.accessToken };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

// ─── Register ─────────────────────────────────────────────────────────────────
// POST /api/auth/register  →  { success: true, message }

export type RegisterResult =
  | { success: true }
  | { success: false; error: AuthError };

export async function registerUser(payload: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<RegisterResult> {
  try {
    await api.post("/api/auth/register", payload);
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

// ─── Forgot password ──────────────────────────────────────────────────────────

export type ForgotPasswordResult =
  | { success: true }
  | { success: false; error: AuthError };

export async function requestPasswordReset(
  email: string,
): Promise<ForgotPasswordResult> {
  try {
    await api.post("/api/auth/forgot-password", { email });
    return { success: true };
  } catch (err) {
    return { success: false, error: parseError(err) };
  }
}

// ─── Sign out ─────────────────────────────────────────────────────────────────
// Clears memory token + calls /api/auth/logout so server invalidates the session
// and clears the httpOnly cookie.

export async function signOut(): Promise<void> {
  try {
    await api.post("/api/auth/logout");
  } catch {
    // ignore server errors — clear client state regardless
  } finally {
    _accessToken = null;
  }
}
