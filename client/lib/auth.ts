/**
 * Authentication Service — Stub implementation
 *
 * To connect your real API:
 *   1. Set NEXT_PUBLIC_API_URL in .env.local
 *   2. Uncomment "OPTION A" blocks in each function
 *   3. Adjust request/response shapes to match your API contract
 *   4. Remove the mock delays and demo data
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

// ─── Shared types ──────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "student" | "staff" | "admin";
  token: string;
}

export interface AuthError {
  code: "INVALID_CREDENTIALS" | "EMAIL_TAKEN" | "EMAIL_NOT_FOUND" | "SERVER_ERROR" | "NETWORK_ERROR";
  message: string;
}

// ─── Login ─────────────────────────────────────────────────────────────────────

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export type LoginResult =
  | { success: true; user: AuthUser }
  | { success: false; error: AuthError };

export async function loginUser(credentials: LoginCredentials): Promise<LoginResult> {
  // ── OPTION A: Real API ────────────────────────────────────────────────────────
  // try {
  //   const res = await fetch(`${BASE_URL}/auth/login`, {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({ email: credentials.email, password: credentials.password }),
  //   });
  //   if (!res.ok) {
  //     const err = await res.json();
  //     if (res.status === 401)
  //       return { success: false, error: { code: "INVALID_CREDENTIALS", message: err.message } };
  //     return { success: false, error: { code: "SERVER_ERROR", message: err.message } };
  //   }
  //   return { success: true, user: await res.json() };
  // } catch {
  //   return { success: false, error: { code: "NETWORK_ERROR", message: "Network error" } };
  // }

  // ── OPTION B: Mock stub ───────────────────────────────────────────────────────
  await new Promise((r) => setTimeout(r, 1200));
  if (credentials.email === "demo@university.edu" && credentials.password === "password123") {
    return { success: true, user: { id: "usr_001", email: credentials.email, name: "Demo Student", role: "student", token: "mock_jwt_token_xyz" } };
  }
  return { success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." } };
}

// ─── Register ──────────────────────────────────────────────────────────────────

export interface RegisterCredentials {
  firstName: string;
  lastName: string;
  studentId: string;
  role: "student" | "staff" | "admin";
  email: string;
  password: string;
}

export type RegisterResult =
  | { success: true; user: AuthUser }
  | { success: false; error: AuthError };

export async function registerUser(credentials: RegisterCredentials): Promise<RegisterResult> {
  // ── OPTION A: Real API ────────────────────────────────────────────────────────
  // try {
  //   const res = await fetch(`${BASE_URL}/auth/register`, {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify(credentials),
  //   });
  //   if (!res.ok) {
  //     const err = await res.json();
  //     if (res.status === 409)
  //       return { success: false, error: { code: "EMAIL_TAKEN", message: err.message } };
  //     return { success: false, error: { code: "SERVER_ERROR", message: err.message } };
  //   }
  //   return { success: true, user: await res.json() };
  // } catch {
  //   return { success: false, error: { code: "NETWORK_ERROR", message: "Network error" } };
  // }

  // ── OPTION B: Mock stub ───────────────────────────────────────────────────────
  await new Promise((r) => setTimeout(r, 1500));
  if (credentials.email === "taken@university.edu") {
    return { success: false, error: { code: "EMAIL_TAKEN", message: "Email already registered." } };
  }
  return {
    success: true,
    user: {
      id: "usr_new",
      email: credentials.email,
      name: `${credentials.firstName} ${credentials.lastName}`,
      role: credentials.role,
      token: "mock_jwt_new_user",
    },
  };
}

// ─── Forgot Password ───────────────────────────────────────────────────────────

export interface ForgotPasswordPayload { email: string }

export type ForgotPasswordResult =
  | { success: true }
  | { success: false; error: AuthError };

export async function requestPasswordReset(payload: ForgotPasswordPayload): Promise<ForgotPasswordResult> {
  // ── OPTION A: Real API ────────────────────────────────────────────────────────
  // try {
  //   const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify(payload),
  //   });
  //   if (!res.ok) {
  //     const err = await res.json();
  //     if (res.status === 404)
  //       return { success: false, error: { code: "EMAIL_NOT_FOUND", message: err.message } };
  //     return { success: false, error: { code: "SERVER_ERROR", message: err.message } };
  //   }
  //   return { success: true };
  // } catch {
  //   return { success: false, error: { code: "NETWORK_ERROR", message: "Network error" } };
  // }

  // ── OPTION B: Mock stub ───────────────────────────────────────────────────────
  await new Promise((r) => setTimeout(r, 1200));
  if (payload.email === "notfound@university.edu") {
    return { success: false, error: { code: "EMAIL_NOT_FOUND", message: "Email not found." } };
  }
  return { success: true };
}
