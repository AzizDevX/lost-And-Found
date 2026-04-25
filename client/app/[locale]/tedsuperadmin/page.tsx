"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useTransition,
} from "react";
import { useTranslations, useLocale } from "next-intl";

import styles from "./adminDashboard.module.css";

// ─── API base ─────────────────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_URL + "/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminRole = "superadmin" | "moderator";

interface AdminSession {
  id: string;
  username: string;
  email: string;
  role: AdminRole;
  accessToken: string;
}

type Tab = "overview" | "announcements" | "users" | "logs";

interface Announcement {
  _id: string;
  type: "lost" | "found";
  category: string;
  description: string;
  images: string[];
  status: "pending" | "accepted" | "rejected";
  displayStatus?: string;
  cancelledByUser: boolean;
  userConfirmed: boolean;
  closedWithoutMatch: boolean;
  closedWithoutMatchAt?: string;
  isReturned: boolean;
  rejectionReason?: string;
  author: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    userAvatar?: string;
    isBanned?: boolean;
  };
  reviewedBy?: { username: string; email: string };
  reviewedAt?: string;
  createdAt: string;
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  userAvatar?: string;
  isBanned: boolean;
  banReason?: string;
  bannedAt?: string;
  bannedBy?: string;
  banExpiresAt?: string | null; // null = permanent, ISO string = timed
  createdAt: string;
  announcementStats?: { total: number; accepted: number; pending: number };
}

interface AdminLog {
  _id: string;
  admin: { username: string; email: string; role: string };
  adminUsername: string;
  adminRole: string;
  action: string;
  targetType: string;
  targetLabel?: string;
  meta?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface OverviewStats {
  pending: number;
  accepted: number;
  rejected: number;
  cancelled: number;
  confirmed: number;
  closedWithoutMatch: number;
  totalUsers: number;
  banned: number;
  returned: number;
  active: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 2) return locale === "fr" ? "à l'instant" : "just now";
  if (min < 60) return locale === "fr" ? `il y a ${min}min` : `${min}m ago`;
  if (hr < 24) return locale === "fr" ? `il y a ${hr}h` : `${hr}h ago`;
  return locale === "fr" ? `il y a ${day}j` : `${day}d ago`;
}

function initials(first: string, last: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

function avatarUrl(path?: string): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API.replace("/api", "")}/${path}`;
}

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icon = {
  Dashboard: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  Announcements: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  Users: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  Logs: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  Logout: () => (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Check: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  X: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Trash: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  ),
  Eye: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Ban: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  ),
  Unban: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  Return: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
    </svg>
  ),
  Search: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Refresh: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  ),
  Menu: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  Close: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Shield: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  ChevronLeft: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  ChevronRight: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  ChevronDown: () => (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  Warn: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  List: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  Lock: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ),
  Mail: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  Clock: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  User: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
};

// ─── API layer ────────────────────────────────────────────────────────────────

class AdminAPI {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };
  }

  private async req<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API}/admin${path}`, {
      ...opts,
      headers: { ...this.headers(), ...(opts.headers ?? {}) },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? `HTTP ${res.status}`);
    }
    return res.json();
  }

  // Announcements
  listAnnouncements(params: URLSearchParams) {
    return this.req<{
      success: boolean;
      data: Announcement[];
      pagination: Pagination;
      summary: {
        pending: number;
        accepted: number;
        rejected: number;
        cancelled: number;
        confirmed: number;
        closedWithoutMatch: number;
      };
    }>(`/announcements?${params}`);
  }
  getAnnouncement(id: string) {
    return this.req<{ success: boolean; data: Announcement }>(
      `/announcements/${id}`,
    );
  }
  reviewAnnouncement(
    id: string,
    status: "accepted" | "rejected",
    rejectionReason?: string,
  ) {
    return this.req(`/announcements/${id}/review`, {
      method: "PATCH",
      body: JSON.stringify({ status, rejectionReason }),
    });
  }
  markReturned(id: string, isReturned: boolean) {
    return this.req(`/announcements/${id}/returned`, {
      method: "PATCH",
      body: JSON.stringify({ isReturned }),
    });
  }
  adminCloseWithoutMatch(id: string) {
    return this.req(`/announcements/${id}/admin-close`, {
      method: "PATCH",
    });
  }
  deleteAnnouncement(id: string) {
    return this.req(`/announcements/${id}`, { method: "DELETE" });
  }

  // Users
  listUsers(params: URLSearchParams) {
    return this.req<{ success: boolean; data: User[]; pagination: Pagination }>(
      `/users?${params}`,
    );
  }
  getUser(id: string) {
    return this.req<{ success: boolean; data: User }>(`/users/${id}`);
  }
  getUserAnnouncements(id: string, params: URLSearchParams) {
    return this.req<{
      success: boolean;
      data: Announcement[];
      pagination: Pagination;
    }>(`/users/${id}/announcements?${params}`);
  }
  banUser(id: string, reason: string, durationDays: number | null) {
    return this.req(`/users/${id}/ban`, {
      method: "PATCH",
      body: JSON.stringify({ reason, durationDays }),
    });
  }
  unbanUser(id: string) {
    return this.req(`/users/${id}/unban`, { method: "PATCH" });
  }

  // Logs
  listLogs(params: URLSearchParams) {
    return this.req<{
      success: boolean;
      data: AdminLog[];
      pagination: Pagination;
    }>(`/logs?${params}`);
  }
  logsSummary(days: number) {
    return this.req<{
      success: boolean;
      data: {
        period: string;
        totalActions: number;
        byAction: { action: string; count: number }[];
      };
    }>(`/logs/summary?days=${days}`);
  }
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function adminLogin(
  email: string,
  password: string,
): Promise<AdminSession> {
  const res = await fetch(`${API}/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? "Login failed");
  return { ...body.data.admin, accessToken: body.data.accessToken };
}

async function adminRefreshToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API}/admin/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.data?.accessToken ?? null;
  } catch {
    return null;
  }
}

async function adminLogoutAPI() {
  await fetch(`${API}/admin/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const SESSION_KEY = "adminSession";

function loadSession(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveSession(s: AdminSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
}
function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

// ─── Confirmation Modal ───────────────────────────────────────────────────────

function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmClass,
  icon,
  onClose,
  onConfirm,
  loading,
  extra,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmClass: string;
  icon: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{title}</span>
          <button className={styles.modalClose} onClick={onClose}>
            <Icon.Close />
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.modalWarning}>
            <Icon.Warn />
            {message}
          </div>
          {extra}
        </div>
        <div className={styles.modalFooter}>
          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onClose}
          >
            <Icon.Close style={{ width: 12 }} />
            {/* Cancel label not passed to this component; use SimpleConfirm instead */}
          </button>
          <button
            className={`${styles.btn} ${confirmClass}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <span className={styles.spinner} /> : icon}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// A simpler two-button confirm used everywhere
function SimpleConfirm({
  title,
  message,
  cancelLabel,
  confirmLabel,
  confirmClass,
  icon,
  onClose,
  onConfirm,
  loading,
  extra,
}: {
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  confirmClass: string;
  icon: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{title}</span>
          <button className={styles.modalClose} onClick={onClose}>
            <Icon.Close />
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.modalWarning}>
            <Icon.Warn />
            {message}
          </div>
          {extra}
        </div>
        <div className={styles.modalFooter}>
          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            className={`${styles.btn} ${confirmClass}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <span className={styles.spinner} /> : icon}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (s: AdminSession) => void }) {
  const t = useTranslations("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await adminLogin(email, password);
      saveSession(session);
      onLogin(session);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t("auth.invalidCredentials"),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.loginScreen}>
      <div className={styles.loginCard}>
        <div className={styles.loginBrand}>
          <div className={styles.loginLogo}>
            <Icon.Shield />
          </div>
          <div>
            <div className={styles.loginBrandName}>TED University</div>
            <div className={styles.loginBrandSub}>Lost &amp; Found</div>
          </div>
        </div>
        <h1 className={styles.loginTitle}>{t("auth.loginTitle")}</h1>
        <p className={styles.loginSubtitle}>{t("auth.loginSubtitle")}</p>
        {error && (
          <div className={styles.loginError}>
            <Icon.Warn />
            {error}
          </div>
        )}
        <form className={styles.loginForm} onSubmit={handleSubmit}>
          <div className={styles.loginField}>
            <label className={styles.loginLabel}>{t("auth.email")}</label>
            <input
              type="email"
              className={styles.loginInput}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ted.edu.tn"
              required
              autoFocus
              autoComplete="email"
            />
          </div>
          <div className={styles.loginField}>
            <label className={styles.loginLabel}>{t("auth.password")}</label>
            <input
              type="password"
              className={styles.loginInput}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className={styles.loginBtn} disabled={loading}>
            {loading ? (
              <>
                <span className={styles.spinner} />
                {t("auth.loggingIn")}
              </>
            ) : (
              <>
                <Icon.Lock />
                {t("auth.login")}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({
  session,
  activeTab,
  onTab,
  pendingCount,
  open,
  onClose,
  onLogout,
}: {
  session: AdminSession;
  activeTab: Tab;
  onTab: (t: Tab) => void;
  pendingCount: number;
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}) {
  const t = useTranslations("admin");

  const navItems: { tab: Tab; label: string; icon: JSX.Element }[] = [
    { tab: "overview", label: t("nav.overview"), icon: <Icon.Dashboard /> },
    {
      tab: "announcements",
      label: t("nav.announcements"),
      icon: <Icon.Announcements />,
    },
    { tab: "users", label: t("nav.users"), icon: <Icon.Users /> },
    ...(session.role === "superadmin"
      ? [{ tab: "logs" as Tab, label: t("nav.logs"), icon: <Icon.Logs /> }]
      : []),
  ];

  return (
    <>
      {open && <div className={styles.sidebarOverlay} onClick={onClose} />}
      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarBrand}>
          <div className={styles.sidebarLogo}>
            <div className={styles.sidebarLogoIcon}>
              <Icon.Shield />
            </div>
            <span className={styles.sidebarLogoName}>TED University</span>
          </div>
          <div className={styles.sidebarAdmin}>
            {session.role === "superadmin" ? "Superadmin" : "Moderator"}
          </div>
        </div>
        <nav className={styles.sidebarNav}>
          {navItems.map(({ tab, label, icon }) => (
            <button
              key={tab}
              className={`${styles.navItem} ${activeTab === tab ? styles.navItemActive : ""}`}
              onClick={() => {
                onTab(tab);
                onClose();
              }}
            >
              <span className={styles.navIcon}>{icon}</span>
              {label}
              {tab === "announcements" && pendingCount > 0 && (
                <span className={styles.navBadge}>
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.sidebarAdminInfo}>
            <div className={styles.sidebarAdminAvatar}>
              {initials(session.username, "")}
            </div>
            <div>
              <div className={styles.sidebarAdminName}>{session.username}</div>
              <div className={styles.sidebarAdminRole}>{session.role}</div>
            </div>
          </div>
          <button className={styles.logoutBtn} onClick={onLogout}>
            <Icon.Logout />
            {t("nav.logout")}
          </button>
        </div>
      </aside>
    </>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  api,
  session,
  onNav,
}: {
  api: AdminAPI;
  session: AdminSession;
  onNav: (t: Tab) => void;
}) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [annRes, userRes, logRes] = await Promise.all([
        api.listAnnouncements(
          new URLSearchParams({ status: "all", limit: "1" }),
        ),
        api.listUsers(new URLSearchParams({ limit: "1" })),
        ...(session.role === "superadmin"
          ? [api.listLogs(new URLSearchParams({ limit: "8" }))]
          : [
              Promise.resolve({
                success: true,
                data: [],
                pagination: { total: 0, page: 1, limit: 8, totalPages: 0 },
              }),
            ]),
      ]);
      setStats({
        pending: annRes.summary.pending,
        accepted: annRes.summary.accepted,
        rejected: annRes.summary.rejected,
        totalUsers: userRes.pagination.total,
        banned: 0, // TODO: fetch from dedicated endpoint (isBanned=true user count)
        returned: annRes.summary.confirmed ?? 0, // TODO: server-side addition needed for true returned count
        active: annRes.summary.accepted,
        cancelled: annRes.summary.cancelled,
        confirmed: annRes.summary.confirmed ?? 0,
        closedWithoutMatch: annRes.summary.closedWithoutMatch ?? 0,
      });
      setLogs((logRes as { success: boolean; data: AdminLog[] }).data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [api, session.role, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onRefresh() {
      load();
    }
    window.addEventListener("admin:refresh", onRefresh);
    return () => window.removeEventListener("admin:refresh", onRefresh);
  }, [load]);

  function logDotClass(action: string) {
    if (action.includes("ACCEPT") || action.includes("UNBAN"))
      return styles.activityDotGreen;
    if (
      action.includes("REJECT") ||
      action.includes("BAN") ||
      action.includes("DELETE")
    )
      return styles.activityDotRed;
    if (
      action.includes("AUTH") ||
      action.includes("LOGIN") ||
      action.includes("LOGOUT")
    )
      return styles.activityDotYellow;
    return styles.activityDotBlue;
  }

  const statCards = [
    {
      label: t("overview.stats.pending"),
      value: stats?.pending,
      iconClass: styles.statIconYellow,
      icon: <Icon.Announcements />,
    },
    {
      label: t("overview.stats.accepted"),
      value: stats?.accepted,
      iconClass: styles.statIconGreen,
      icon: <Icon.Check />,
    },
    {
      label: t("overview.stats.rejected"),
      value: stats?.rejected,
      iconClass: styles.statIconRed,
      icon: <Icon.X />,
    },
    {
      label: t("overview.stats.cancelled"),
      value: stats?.cancelled,
      iconClass: styles.statIconBlue,
      icon: <Icon.Ban />,
    },
    {
      label: t("overview.stats.totalUsers"),
      value: stats?.totalUsers,
      iconClass: styles.statIconBlue,
      icon: <Icon.Users />,
    },
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div className={styles.pageEyebrow}>{t("overview.eyebrow")}</div>
        <h1 className={styles.pageTitle}>
          {t("overview.welcome")}, {session.username}
        </h1>
      </div>
      {error && (
        <div className={`${styles.alert} ${styles.alertError}`}>
          <Icon.Warn />
          {error}
        </div>
      )}
      <div className={styles.statsGrid}>
        {statCards.map(({ label, value, iconClass, icon }, i) => (
          <div
            key={label}
            className={styles.statCard}
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <div className={styles.statCardTop}>
              <span className={styles.statLabel}>{label}</span>
              <span className={`${styles.statIcon} ${iconClass}`}>{icon}</span>
            </div>
            {loading ? (
              <div
                className={styles.skeletonLine}
                style={{ height: 36, width: 80, borderRadius: 8 }}
              />
            ) : (
              <div className={styles.statValue}>{value ?? 0}</div>
            )}
          </div>
        ))}
      </div>
      <div className={styles.overviewGrid}>
        {session.role === "superadmin" && (
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                {t("overview.recentActivity")}
              </span>
              <button
                className={styles.cardAction}
                onClick={() => onNav("logs")}
              >
                {t("nav.logs")}
              </button>
            </div>
            {loading ? (
              <div className={styles.loadingCenter}>
                <div className={styles.loadingSpinner} />
              </div>
            ) : logs.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <Icon.List />
                </div>
                <p className={styles.emptyDesc}>{t("overview.noActivity")}</p>
              </div>
            ) : (
              <div className={styles.activityList}>
                {logs.map((log, i) => (
                  <div
                    key={log._id}
                    className={styles.activityItem}
                    style={{ animationDelay: `${i * 0.04}s` }}
                  >
                    <span
                      className={`${styles.activityDot} ${logDotClass(log.action)}`}
                    />
                    <div className={styles.activityContent}>
                      <div className={styles.activityAction}>
                        {t(
                          `logs.actions.${log.action}` as Parameters<
                            typeof t
                          >[0],
                          { fallback: log.action },
                        )}
                      </div>
                      {log.targetLabel && (
                        <div className={styles.activityTarget}>
                          {log.targetLabel}
                        </div>
                      )}
                    </div>
                    <span className={styles.activityTime}>
                      {timeAgo(log.createdAt, locale)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              {t("overview.quickActions")}
            </span>
          </div>
          <div className={styles.quickActions}>
            <button
              className={styles.quickActionBtn}
              onClick={() => onNav("announcements")}
            >
              <span className={styles.quickActionIcon}>
                <Icon.Announcements />
              </span>
              <span className={styles.quickActionText}>
                <div className={styles.quickActionLabel}>
                  {t("overview.goToAnnouncements")}
                </div>
                <div className={styles.quickActionSub}>
                  {stats?.pending ?? 0}{" "}
                  {t("overview.stats.pending").toLowerCase()}
                </div>
              </span>
              <Icon.ChevronRight />
            </button>
            <button
              className={styles.quickActionBtn}
              onClick={() => onNav("users")}
            >
              <span className={styles.quickActionIcon}>
                <Icon.Users />
              </span>
              <span className={styles.quickActionText}>
                <div className={styles.quickActionLabel}>
                  {t("overview.goToUsers")}
                </div>
                <div className={styles.quickActionSub}>
                  {stats?.totalUsers ?? 0} {t("users.title").toLowerCase()}
                </div>
              </span>
              <Icon.ChevronRight />
            </button>
            {session.role === "superadmin" && (
              <button
                className={styles.quickActionBtn}
                onClick={() => onNav("logs")}
              >
                <span className={styles.quickActionIcon}>
                  <Icon.Logs />
                </span>
                <span className={styles.quickActionText}>
                  <div className={styles.quickActionLabel}>{t("nav.logs")}</div>
                  <div className={styles.quickActionSub}>
                    {t("logs.eyebrow")}
                  </div>
                </span>
                <Icon.ChevronRight />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Announcement Detail Modal ────────────────────────────────────────────────

function AnnouncementDetailModal({
  ann,
  api,
  onClose,
  onRefresh,
  isSuperAdmin,
}: {
  ann: Announcement;
  api: AdminAPI;
  onClose: () => void;
  onRefresh: () => void;
  isSuperAdmin: boolean;
}) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [rejectReason, setRejectReason] = useState(ann.rejectionReason ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bigImg, setBigImg] = useState<string | null>(null);

  // Confirmation states
  const [confirmAction, setConfirmAction] = useState<
    "accept" | "reject" | "delete" | "returned" | "closeWithoutMatch" | null
  >(null);

  async function handleReview(status: "accepted" | "rejected") {
    setLoading(true);
    setError("");
    try {
      await api.reviewAnnouncement(ann._id, status, rejectReason || undefined);
      onRefresh();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  }

  async function handleToggleReturned() {
    setLoading(true);
    setError("");
    try {
      await api.markReturned(ann._id, !ann.isReturned);
      onRefresh();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  }

  async function handleCloseWithoutMatch() {
    setLoading(true);
    setError("");
    try {
      await api.adminCloseWithoutMatch(ann._id);
      onRefresh();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  }

  async function handleDelete() {
    setLoading(true);
    setError("");
    try {
      await api.deleteAnnouncement(ann._id);
      onRefresh();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  }

  const displayStatus = ann.cancelledByUser
    ? "cancelled"
    : ann.closedWithoutMatch
      ? "closedWithoutMatch"
      : ann.userConfirmed
        ? "confirmed"
        : ann.isReturned && ann.status === "accepted"
          ? "returned"
          : ann.status;
  const statusBadgeClass =
    {
      pending: styles.badgePending,
      accepted: styles.badgeAccepted,
      returned: styles.badgeReturned ?? styles.badgeConfirmed,
      rejected: styles.badgeRejected,
      cancelled: styles.badgeCancelled,
      confirmed: styles.badgeConfirmed,
      closedWithoutMatch:
        styles.badgeClosedWithoutMatch ?? styles.badgeCancelled,
    }[displayStatus] ?? styles.badgePending;

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div
          className={`${styles.modal} ${styles.modalLarge}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.modalHeader}>
            <span className={styles.modalTitle}>
              {t("announcements.modal.viewTitle")}
            </span>
            <button className={styles.modalClose} onClick={onClose}>
              <Icon.Close />
            </button>
          </div>
          <div
            className={styles.modalBody}
            style={{ maxHeight: "70vh", overflowY: "auto" }}
          >
            {error && (
              <div className={`${styles.alert} ${styles.alertError}`}>
                <Icon.Warn />
                {error}
              </div>
            )}

            {/* Read-only notice for cancelled / confirmed announcements */}
            {ann.cancelledByUser && (
              <div
                className={`${styles.alert}`}
                style={{
                  background: "var(--yellow-dim)",
                  border: "1px solid var(--yellow-border)",
                  color: "var(--accent)",
                  marginBottom: 14,
                }}
              >
                <Icon.Warn />
                {t("announcements.modal.cancelledNotice")}
              </div>
            )}
            {ann.userConfirmed && !ann.cancelledByUser && (
              <div
                className={`${styles.alert}`}
                style={{
                  background: "var(--green-dim)",
                  border: "1px solid var(--green-border)",
                  color: "var(--success)",
                  marginBottom: 14,
                }}
              >
                <Icon.Unban />
                {t("announcements.modal.confirmedNotice")}
              </div>
            )}
            {ann.closedWithoutMatch &&
              !ann.cancelledByUser &&
              !ann.userConfirmed && (
                <div
                  className={`${styles.alert}`}
                  style={{
                    background: "var(--yellow-dim)",
                    border: "1px solid var(--yellow-border)",
                    color: "var(--accent)",
                    marginBottom: 14,
                  }}
                >
                  <Icon.Warn />
                  {t("announcements.modal.closedWithoutMatchNotice")}
                </div>
              )}

            {/* ── Image section: smart logic ───────────────────────────────── */}
            {displayStatus === "rejected" || displayStatus === "cancelled" ? (
              /* Cancelled / rejected → images are deleted on the server.
                 Show one single notice, never try to render the images. */
              <div
                className={styles.alert}
                style={{
                  background: "var(--yellow-dim)",
                  border: "1px solid var(--yellow-border)",
                  color: "var(--accent)",
                  marginBottom: 14,
                }}
              >
                <Icon.Warn />
                {t("announcements.modal.imagesDeleted")}
              </div>
            ) : ann.images?.length > 0 ? (
              /* Any other status → try to render images, show error per image if it fails */
              <div>
                {bigImg ? (
                  <div className={styles.detailImageFullWrap}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${API.replace("/api", "")}/${bigImg}`}
                      alt=""
                      className={styles.detailImageFull}
                      onClick={() => setBigImg(null)}
                      style={{ cursor: "zoom-out", marginBottom: 10 }}
                      onError={(e) => {
                        const el = e.currentTarget;
                        el.style.display = "none";
                        const fb = el.nextElementSibling as HTMLElement | null;
                        if (fb) fb.style.display = "flex";
                      }}
                    />
                    <div
                      className={styles.imgErrorFull}
                      style={{ display: "none" }}
                      onClick={() => setBigImg(null)}
                    >
                      <Icon.Warn />
                      <span>{t("announcements.modal.imageLoadError")}</span>
                    </div>
                  </div>
                ) : (
                  <div
                    className={styles.detailImages}
                    style={{ marginBottom: 14 }}
                  >
                    {ann.images.map((img, i) => (
                      <div key={i} className={styles.detailImageWrap}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`${API.replace("/api", "")}/${img}`}
                          alt=""
                          className={styles.detailImage}
                          onClick={() => setBigImg(img)}
                          onError={(e) => {
                            const el = e.currentTarget;
                            el.style.display = "none";
                            const fb =
                              el.nextElementSibling as HTMLElement | null;
                            if (fb) fb.style.display = "flex";
                          }}
                        />
                        <div
                          className={styles.imgError}
                          style={{ display: "none" }}
                        >
                          <Icon.Warn />
                          <span>{t("announcements.modal.imageLoadError")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <div className={styles.detailRow}>
              <div className={styles.detailField}>
                <span className={styles.detailLabel}>
                  {t("announcements.table.author")}
                </span>
                <span className={styles.detailValue}>
                  {ann.author.firstName} {ann.author.lastName}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {ann.author.email}
                </span>
              </div>
              <div className={styles.detailField}>
                <span className={styles.detailLabel}>
                  {t("announcements.table.status")}
                </span>
                <span className={`${styles.badge} ${statusBadgeClass}`}>
                  {t(
                    `announcements.status.${displayStatus}` as Parameters<
                      typeof t
                    >[0],
                  )}
                </span>
              </div>
              <div className={styles.detailField}>
                <span className={styles.detailLabel}>
                  {t("announcements.table.type")}
                </span>
                <span
                  className={`${styles.badge} ${ann.type === "lost" ? styles.badgeLost : styles.badgeFound}`}
                >
                  {t(
                    `announcements.types.${ann.type}` as Parameters<
                      typeof t
                    >[0],
                  )}
                </span>
              </div>
              <div className={styles.detailField}>
                <span className={styles.detailLabel}>
                  {t("announcements.table.category")}
                </span>
                <span className={styles.detailValue}>
                  {t(`categories.${ann.category}` as Parameters<typeof t>[0])}
                </span>
              </div>
            </div>

            <div className={styles.detailField} style={{ marginTop: 12 }}>
              <span className={styles.detailLabel}>
                {t("announcements.table.date")}
              </span>
              <span className={styles.detailValue}>
                {formatDate(ann.createdAt, locale)}
              </span>
            </div>
            <div className={styles.detailField} style={{ marginTop: 12 }}>
              <span className={styles.detailLabel}>
                {t("announcements.modal.descriptionLabel")}
              </span>
              <span className={styles.detailValue}>{ann.description}</span>
            </div>
            {ann.rejectionReason && (
              <div className={styles.detailField} style={{ marginTop: 12 }}>
                <span className={styles.detailLabel}>
                  {t("announcements.modal.rejectionReasonLabel")}
                </span>
                <span
                  className={styles.detailValue}
                  style={{ color: "var(--danger)" }}
                >
                  {ann.rejectionReason}
                </span>
              </div>
            )}

            {(ann.status === "pending" || ann.status === "accepted") &&
              !ann.cancelledByUser &&
              !ann.userConfirmed &&
              !ann.closedWithoutMatch && (
                <div className={styles.formField} style={{ marginTop: 16 }}>
                  <label className={styles.formLabel}>
                    {t("announcements.modal.rejectTitle")}
                  </label>
                  <textarea
                    className={styles.formTextarea}
                    placeholder={t("announcements.modal.rejectPlaceholder")}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                  />
                </div>
              )}
          </div>

          <div className={styles.modalFooter}>
            {/* PENDING: accept + reject */}
            {ann.status === "pending" && !ann.cancelledByUser && (
              <>
                <button
                  className={`${styles.btn} ${styles.btnDanger}`}
                  onClick={() => setConfirmAction("reject")}
                  disabled={loading}
                >
                  <Icon.X />
                  {t("announcements.actions.reject")}
                </button>
                <button
                  className={`${styles.btn} ${styles.btnSuccess}`}
                  onClick={() => setConfirmAction("accept")}
                  disabled={loading}
                >
                  <Icon.Check />
                  {t("announcements.actions.accept")}
                </button>
              </>
            )}

            {/* ACCEPTED (active): mark returned + close no match + force-reject */}
            {ann.status === "accepted" &&
              !ann.cancelledByUser &&
              !ann.userConfirmed &&
              !ann.closedWithoutMatch && (
                <>
                  {!ann.isReturned && (
                    <button
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      onClick={() => setConfirmAction("closeWithoutMatch")}
                      disabled={loading}
                    >
                      <Icon.X />
                      {t("announcements.actions.closeWithoutMatch")}
                    </button>
                  )}
                  <button
                    className={`${styles.btn} ${ann.isReturned ? styles.btnSecondary : styles.btnSuccess}`}
                    onClick={() => setConfirmAction("returned")}
                    disabled={loading}
                  >
                    <Icon.Return />
                    {ann.isReturned
                      ? t("announcements.actions.markActive")
                      : t("announcements.actions.markReturned")}
                  </button>
                  <button
                    className={`${styles.btn} ${styles.btnDanger}`}
                    onClick={() => setConfirmAction("reject")}
                    disabled={loading}
                  >
                    <Icon.X />
                    {t("announcements.actions.forceReject")}
                  </button>
                </>
              )}

            {/* CANCELLED / CONFIRMED / closedWithoutMatch: read-only — no action buttons */}

            {/* DELETE — all admins, always */}
            <button
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={() => setConfirmAction("delete")}
              disabled={loading}
            >
              <Icon.Trash />
              {t("announcements.actions.delete")}
            </button>
            <button
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={onClose}
            >
              {t("common.close")}
            </button>
          </div>
        </div>
      </div>

      {/* Nested confirmation modals */}
      {confirmAction === "accept" && (
        <SimpleConfirm
          title={t("announcements.modal.confirmAcceptTitle")}
          message={t("announcements.modal.confirmAcceptMessage")}
          cancelLabel={t("common.cancel")}
          confirmLabel={t("announcements.actions.accept")}
          confirmClass={styles.btnSuccess}
          icon={<Icon.Check />}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => handleReview("accepted")}
          loading={loading}
        />
      )}
      {confirmAction === "reject" && (
        <SimpleConfirm
          title={
            ann.status === "accepted"
              ? t("announcements.modal.confirmForceRejectTitle")
              : t("announcements.modal.confirmRejectTitle")
          }
          message={
            ann.status === "accepted"
              ? t("announcements.modal.confirmForceRejectMessage")
              : t("announcements.modal.confirmRejectMessage")
          }
          cancelLabel={t("common.cancel")}
          confirmLabel={
            ann.status === "accepted"
              ? t("announcements.actions.forceReject")
              : t("announcements.actions.reject")
          }
          confirmClass={styles.btnDanger}
          icon={<Icon.X />}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => handleReview("rejected")}
          loading={loading}
          extra={
            rejectReason ? (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12.5,
                  color: "var(--text-muted)",
                  fontStyle: "italic",
                }}
              >
                {t("announcements.modal.rejectReasonPreview")}: &ldquo;
                {rejectReason}&rdquo;
              </div>
            ) : undefined
          }
        />
      )}
      {confirmAction === "delete" && (
        <SimpleConfirm
          title={t("announcements.modal.deleteTitle")}
          message={t("announcements.modal.deleteConfirm")}
          cancelLabel={t("common.cancel")}
          confirmLabel={t("common.delete")}
          confirmClass={styles.btnDanger}
          icon={<Icon.Trash />}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleDelete}
          loading={loading}
        />
      )}
      {confirmAction === "returned" && (
        <SimpleConfirm
          title={
            ann.isReturned
              ? t("announcements.modal.confirmUnreturnTitle")
              : t("announcements.modal.confirmReturnTitle")
          }
          message={
            ann.isReturned
              ? t("announcements.modal.confirmUnreturnMessage")
              : t("announcements.modal.confirmReturnMessage")
          }
          cancelLabel={t("common.cancel")}
          confirmLabel={
            ann.isReturned
              ? t("announcements.actions.markActive")
              : t("announcements.actions.markReturned")
          }
          confirmClass={styles.btnSuccess}
          icon={<Icon.Return />}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleToggleReturned}
          loading={loading}
        />
      )}
      {confirmAction === "closeWithoutMatch" && (
        <SimpleConfirm
          title={t("announcements.modal.confirmCloseWithoutMatchTitle")}
          message={t("announcements.modal.confirmCloseWithoutMatchMessage")}
          cancelLabel={t("common.cancel")}
          confirmLabel={t("announcements.actions.closeWithoutMatch")}
          confirmClass={styles.btnDanger}
          icon={<Icon.X />}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleCloseWithoutMatch}
          loading={loading}
        />
      )}
    </>
  );
}

// ─── Announcements Tab ────────────────────────────────────────────────────────

function AnnouncementsTab({
  api,
  session,
}: {
  api: AdminAPI;
  session: AdminSession;
}) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
  const [statusFilter, setStatusFilter] = useState<
    | "all"
    | "pending"
    | "accepted"
    | "rejected"
    | "cancelled"
    | "closedWithoutMatch"
  >("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewAnn, setViewAnn] = useState<Announcement | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Per-row confirmations
  const [confirmReview, setConfirmReview] = useState<{
    ann: Announcement;
    status: "accepted" | "rejected";
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);
  const [confirmReturned, setConfirmReturned] = useState<Announcement | null>(
    null,
  );
  const [confirmCloseNoMatch, setConfirmCloseNoMatch] =
    useState<Announcement | null>(null);

  const [, startTransition] = useTransition();

  const load = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError("");
      try {
        const p = new URLSearchParams({
          status: statusFilter,
          page: String(page),
          limit: "20",
        });
        const res = await api.listAnnouncements(p);
        setAnnouncements(res.data);
        setPagination(res.pagination);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : t("common.error"));
      } finally {
        setLoading(false);
      }
    },
    [api, statusFilter, t],
  );

  useEffect(() => {
    startTransition(() => {
      load(1);
    });
  }, [load]);

  useEffect(() => {
    function onRefresh() {
      load(pagination.page);
    }
    window.addEventListener("admin:refresh", onRefresh);
    return () => window.removeEventListener("admin:refresh", onRefresh);
  }, [load, pagination.page]);

  async function handleQuickReview(
    ann: Announcement,
    status: "accepted" | "rejected",
  ) {
    setActionLoading(ann._id);
    try {
      await api.reviewAnnouncement(ann._id, status);
      await load(pagination.page);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setActionLoading(null);
      setConfirmReview(null);
    }
  }

  async function handleDelete(id: string) {
    setActionLoading(id);
    try {
      await api.deleteAnnouncement(id);
      setConfirmDelete(null);
      await load(pagination.page);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleReturned(ann: Announcement) {
    setActionLoading(ann._id);
    try {
      await api.markReturned(ann._id, !ann.isReturned);
      await load(pagination.page);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setActionLoading(null);
      setConfirmReturned(null);
    }
  }

  async function handleCloseNoMatch(ann: Announcement) {
    setActionLoading(ann._id);
    try {
      await api.adminCloseWithoutMatch(ann._id);
      await load(pagination.page);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setActionLoading(null);
      setConfirmCloseNoMatch(null);
    }
  }

  const filterTabs: { key: typeof statusFilter; label: string }[] = [
    { key: "pending", label: t("announcements.filters.pending") },
    { key: "accepted", label: t("announcements.filters.accepted") },
    { key: "rejected", label: t("announcements.filters.rejected") },
    { key: "cancelled", label: t("announcements.filters.cancelled") },
    {
      key: "closedWithoutMatch",
      label: t("announcements.filters.closedWithoutMatch"),
    },
    { key: "all", label: t("announcements.filters.all") },
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div className={styles.pageEyebrow}>{t("announcements.eyebrow")}</div>
        <h1 className={styles.pageTitle}>{t("announcements.title")}</h1>
      </div>

      {error && (
        <div className={`${styles.alert} ${styles.alertError}`}>
          <Icon.Warn />
          {error}
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.filterTabs}>
          {filterTabs.map(({ key, label }) => (
            <button
              key={key}
              className={`${styles.filterTab} ${statusFilter === key ? styles.filterTabActive : ""}`}
              onClick={() => setStatusFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.tableWrap}>
        {loading ? (
          <div className={styles.loadingCenter}>
            <div className={styles.loadingSpinner} />
            <span>{t("common.loading")}</span>
          </div>
        ) : announcements.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Icon.Announcements />
            </div>
            <div className={styles.emptyTitle}>{t("announcements.empty")}</div>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("announcements.table.author")}</th>
                <th>{t("announcements.table.type")}</th>
                <th>{t("announcements.table.category")}</th>
                <th>{t("announcements.table.status")}</th>
                <th>{t("announcements.table.date")}</th>
                <th>{t("announcements.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {announcements.map((ann) => {
                const displayStatus = ann.cancelledByUser
                  ? "cancelled"
                  : ann.closedWithoutMatch
                    ? "closedWithoutMatch"
                    : ann.userConfirmed
                      ? "confirmed"
                      : ann.isReturned && ann.status === "accepted"
                        ? "returned"
                        : ann.status;
                const statusCls =
                  {
                    pending: styles.badgePending,
                    accepted: styles.badgeAccepted,
                    returned: styles.badgeReturned ?? styles.badgeConfirmed,
                    rejected: styles.badgeRejected,
                    cancelled: styles.badgeCancelled,
                    confirmed: styles.badgeConfirmed,
                    closedWithoutMatch:
                      styles.badgeClosedWithoutMatch ?? styles.badgeCancelled,
                  }[displayStatus] ?? styles.badgePending;

                return (
                  <tr key={ann._id}>
                    <td>
                      <div className={styles.authorCell}>
                        <div className={styles.authorAvatar}>
                          {ann.author.userAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={avatarUrl(ann.author.userAvatar)!}
                              alt=""
                              className={styles.authorAvatarImg}
                            />
                          ) : (
                            initials(ann.author.firstName, ann.author.lastName)
                          )}
                        </div>
                        <div>
                          <div className={styles.authorName}>
                            {ann.author.firstName} {ann.author.lastName}
                          </div>
                          <div className={styles.authorEmail}>
                            {ann.author.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${ann.type === "lost" ? styles.badgeLost : styles.badgeFound}`}
                      >
                        {t(
                          `announcements.types.${ann.type}` as Parameters<
                            typeof t
                          >[0],
                        )}
                      </span>
                    </td>
                    <td>
                      <span
                        className={styles.badge}
                        style={{
                          background: "var(--yellow-dim)",
                          border: "1px solid var(--yellow-border)",
                          color: "var(--accent)",
                        }}
                      >
                        {t(
                          `categories.${ann.category}` as Parameters<
                            typeof t
                          >[0],
                        )}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${statusCls}`}>
                        {t(
                          `announcements.status.${displayStatus}` as Parameters<
                            typeof t
                          >[0],
                        )}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                      {formatDate(ann.createdAt, locale)}
                    </td>
                    <td>
                      <div className={styles.actionRow}>
                        <button
                          className={styles.iconBtn}
                          title={t("announcements.actions.view")}
                          onClick={() => setViewAnn(ann)}
                        >
                          <Icon.Eye />
                        </button>

                        {/* PENDING: accept + reject */}
                        {ann.status === "pending" && !ann.cancelledByUser && (
                          <>
                            <button
                              className={`${styles.iconBtn} ${styles.iconBtnSuccess}`}
                              title={t("announcements.actions.accept")}
                              onClick={() =>
                                setConfirmReview({ ann, status: "accepted" })
                              }
                              disabled={actionLoading === ann._id}
                            >
                              {actionLoading === ann._id ? (
                                <span
                                  className={styles.spinnerLight}
                                  style={{
                                    width: 12,
                                    height: 12,
                                    border: "2px solid transparent",
                                    borderTopColor: "currentColor",
                                    borderRadius: "50%",
                                    display: "inline-block",
                                  }}
                                />
                              ) : (
                                <Icon.Check />
                              )}
                            </button>
                            <button
                              className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                              title={t("announcements.actions.reject")}
                              onClick={() =>
                                setConfirmReview({ ann, status: "rejected" })
                              }
                              disabled={actionLoading === ann._id}
                            >
                              <Icon.X />
                            </button>
                          </>
                        )}

                        {/* ACCEPTED (active): close no match + mark returned + force-reject */}
                        {ann.status === "accepted" &&
                          !ann.cancelledByUser &&
                          !ann.userConfirmed &&
                          !ann.closedWithoutMatch && (
                            <>
                              {!ann.isReturned && (
                                <button
                                  className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                  title={t(
                                    "announcements.actions.closeWithoutMatch",
                                  )}
                                  onClick={() => setConfirmCloseNoMatch(ann)}
                                  disabled={actionLoading === ann._id}
                                >
                                  <Icon.Ban />
                                </button>
                              )}
                              <button
                                className={`${styles.iconBtn} ${ann.isReturned ? styles.iconBtnActive : styles.iconBtnSuccess}`}
                                title={
                                  ann.isReturned
                                    ? t("announcements.actions.markActive")
                                    : t("announcements.actions.markReturned")
                                }
                                onClick={() => setConfirmReturned(ann)}
                                disabled={actionLoading === ann._id}
                              >
                                <Icon.Return />
                              </button>
                              <button
                                className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                title={t("announcements.actions.forceReject")}
                                onClick={() =>
                                  setConfirmReview({ ann, status: "rejected" })
                                }
                                disabled={actionLoading === ann._id}
                              >
                                <Icon.X />
                              </button>
                            </>
                          )}

                        {/* REJECTED / CANCELLED / CONFIRMED / closedWithoutMatch: view-only — no action buttons except delete */}

                        {/* DELETE — all admins, always available */}
                        <button
                          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                          title={t("announcements.actions.delete")}
                          onClick={() => setConfirmDelete(ann)}
                        >
                          <Icon.Trash />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {pagination.totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              className={styles.pageBtn}
              disabled={pagination.page <= 1}
              onClick={() => load(pagination.page - 1)}
            >
              <Icon.ChevronLeft />
            </button>
            <span className={styles.pageInfo}>
              {t("common.page")} {pagination.page} {t("common.of")}{" "}
              {pagination.totalPages}
            </span>
            <button
              className={styles.pageBtn}
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => load(pagination.page + 1)}
            >
              <Icon.ChevronRight />
            </button>
          </div>
        )}
      </div>

      {viewAnn && (
        <AnnouncementDetailModal
          ann={viewAnn}
          api={api}
          onClose={() => setViewAnn(null)}
          onRefresh={() => load(pagination.page)}
          isSuperAdmin={session.role === "superadmin"}
        />
      )}

      {/* Quick-review confirmation */}
      {confirmReview && (
        <SimpleConfirm
          title={
            confirmReview.status === "accepted"
              ? t("announcements.modal.confirmAcceptTitle")
              : confirmReview.ann.status === "accepted"
                ? t("announcements.modal.confirmForceRejectTitle")
                : t("announcements.modal.confirmRejectTitle")
          }
          message={
            confirmReview.status === "accepted"
              ? t("announcements.modal.confirmAcceptMessage")
              : confirmReview.ann.status === "accepted"
                ? t("announcements.modal.confirmForceRejectMessage")
                : t("announcements.modal.confirmRejectMessage")
          }
          cancelLabel={t("common.cancel")}
          confirmLabel={
            confirmReview.status === "accepted"
              ? t("announcements.actions.accept")
              : confirmReview.ann.status === "accepted"
                ? t("announcements.actions.forceReject")
                : t("announcements.actions.reject")
          }
          confirmClass={
            confirmReview.status === "accepted"
              ? styles.btnSuccess
              : styles.btnDanger
          }
          icon={
            confirmReview.status === "accepted" ? <Icon.Check /> : <Icon.X />
          }
          onClose={() => setConfirmReview(null)}
          onConfirm={() =>
            handleQuickReview(confirmReview.ann, confirmReview.status)
          }
          loading={actionLoading === confirmReview.ann._id}
        />
      )}
      {confirmDelete && (
        <SimpleConfirm
          title={t("announcements.modal.deleteTitle")}
          message={t("announcements.modal.deleteConfirm")}
          cancelLabel={t("common.cancel")}
          confirmLabel={t("common.delete")}
          confirmClass={styles.btnDanger}
          icon={<Icon.Trash />}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete._id)}
          loading={actionLoading === confirmDelete._id}
        />
      )}

      {/* Mark returned confirmation */}
      {confirmReturned && (
        <SimpleConfirm
          title={
            confirmReturned.isReturned
              ? t("announcements.modal.confirmUnreturnTitle")
              : t("announcements.modal.confirmReturnTitle")
          }
          message={
            confirmReturned.isReturned
              ? t("announcements.modal.confirmUnreturnMessage")
              : t("announcements.modal.confirmReturnMessage")
          }
          cancelLabel={t("common.cancel")}
          confirmLabel={
            confirmReturned.isReturned
              ? t("announcements.actions.markActive")
              : t("announcements.actions.markReturned")
          }
          confirmClass={styles.btnSuccess}
          icon={<Icon.Return />}
          onClose={() => setConfirmReturned(null)}
          onConfirm={() => handleToggleReturned(confirmReturned)}
          loading={actionLoading === confirmReturned._id}
        />
      )}

      {/* Close without match confirmation */}
      {confirmCloseNoMatch && (
        <SimpleConfirm
          title={t("announcements.modal.confirmCloseWithoutMatchTitle")}
          message={t("announcements.modal.confirmCloseWithoutMatchMessage")}
          cancelLabel={t("common.cancel")}
          confirmLabel={t("announcements.actions.closeWithoutMatch")}
          confirmClass={styles.btnDanger}
          icon={<Icon.Ban />}
          onClose={() => setConfirmCloseNoMatch(null)}
          onConfirm={() => handleCloseNoMatch(confirmCloseNoMatch)}
          loading={actionLoading === confirmCloseNoMatch._id}
        />
      )}
    </div>
  );
}

// ─── User History Modal ───────────────────────────────────────────────────────

function UserHistoryModal({
  user,
  api,
  onClose,
  session,
}: {
  user: User;
  api: AdminAPI;
  onClose: () => void;
  session: AdminSession;
}) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [viewAnn, setViewAnn] = useState<Announcement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);
  const [confirmReview, setConfirmReview] = useState<{
    ann: Announcement;
    status: "accepted" | "rejected";
  } | null>(null);

  const loadAnn = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const res = await api.getUserAnnouncements(
          user._id,
          new URLSearchParams({ page: String(page), limit: "10" }),
        );
        setAnnouncements(res.data);
        setPagination(res.pagination);
      } catch {
        setAnnouncements([]);
      } finally {
        setLoading(false);
      }
    },
    [api, user._id],
  );

  useEffect(() => {
    loadAnn(1);
  }, [loadAnn]);

  async function handleDelete(id: string) {
    setActionLoading(id);
    try {
      await api.deleteAnnouncement(id);
      setConfirmDelete(null);
      await loadAnn(pagination.page);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleQuickReview(
    ann: Announcement,
    status: "accepted" | "rejected",
  ) {
    setActionLoading(ann._id);
    try {
      await api.reviewAnnouncement(ann._id, status);
      setConfirmReview(null);
      await loadAnn(pagination.page);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <>
      <div className={styles.modalOverlay} onClick={onClose}>
        <div
          className={`${styles.modal} ${styles.modalXLarge}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.modalHeader}>
            <span className={styles.modalTitle}>
              {t("users.history.title")}
            </span>
            <button className={styles.modalClose} onClick={onClose}>
              <Icon.Close />
            </button>
          </div>
          <div
            className={styles.modalBody}
            style={{ maxHeight: "80vh", overflowY: "auto" }}
          >
            {/* User profile card */}
            <div className={styles.userProfileCard}>
              <div className={styles.userProfileLeft}>
                <div
                  className={styles.authorAvatar}
                  style={{ width: 52, height: 52, fontSize: 20 }}
                >
                  {user.userAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl(user.userAvatar)!}
                      alt=""
                      className={styles.authorAvatarImg}
                    />
                  ) : (
                    initials(user.firstName, user.lastName)
                  )}
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 16,
                      color: "var(--text-primary)",
                    }}
                  >
                    {user.firstName} {user.lastName}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      marginTop: 2,
                    }}
                  >
                    <Icon.Mail />
                    {user.email}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      marginTop: 3,
                    }}
                  >
                    <Icon.Clock />
                    {t("users.history.joined")}:{" "}
                    {formatDate(user.createdAt, locale)}
                  </div>
                </div>
              </div>
              <div className={styles.userProfileStats}>
                <div className={styles.userProfileStat}>
                  <div className={styles.userProfileStatValue}>
                    {user.announcementStats?.total ?? 0}
                  </div>
                  <div className={styles.userProfileStatLabel}>
                    {t("users.history.totalPosts")}
                  </div>
                </div>
                <div className={styles.userProfileStat}>
                  <div
                    className={styles.userProfileStatValue}
                    style={{ color: "var(--success)" }}
                  >
                    {user.announcementStats?.accepted ?? 0}
                  </div>
                  <div className={styles.userProfileStatLabel}>
                    {t("overview.stats.accepted")}
                  </div>
                </div>
                <div className={styles.userProfileStat}>
                  <div
                    className={styles.userProfileStatValue}
                    style={{ color: "var(--accent)" }}
                  >
                    {user.announcementStats?.pending ?? 0}
                  </div>
                  <div className={styles.userProfileStatLabel}>
                    {t("overview.stats.pending")}
                  </div>
                </div>
              </div>
            </div>

            {/* Ban status */}
            {user.isBanned && (
              <div className={styles.banInfoBox}>
                <Icon.Ban />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {t("users.history.bannedStatus")}
                  </div>
                  {user.bannedAt && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--danger)",
                        opacity: 0.8,
                      }}
                    >
                      {t("users.history.bannedAt")}:{" "}
                      {formatDate(user.bannedAt, locale)}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--danger)",
                      opacity: 0.8,
                      marginTop: 2,
                    }}
                  >
                    {user.banExpiresAt
                      ? `${t("users.banExpires")}: ${formatDate(user.banExpiresAt, locale)}`
                      : t("users.banPermanent")}
                  </div>
                  {user.banReason && (
                    <div
                      style={{
                        fontSize: 12.5,
                        marginTop: 4,
                        color: "var(--danger)",
                        opacity: 0.9,
                      }}
                    >
                      {t("users.banReason")}: {user.banReason}
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div
                className={`${styles.alert} ${styles.alertError}`}
                style={{ marginTop: 12 }}
              >
                <Icon.Warn />
                {error}
              </div>
            )}

            {/* Announcements */}
            <div style={{ marginTop: 20 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 13.5,
                  color: "var(--text-secondary)",
                  marginBottom: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {t("users.announcements.title")} {user.firstName}
                {pagination.total > 0 && (
                  <span
                    style={{
                      marginLeft: 8,
                      color: "var(--text-muted)",
                      fontWeight: 400,
                    }}
                  >
                    ({pagination.total})
                  </span>
                )}
              </div>
              {loading ? (
                <div
                  className={styles.loadingCenter}
                  style={{ padding: "24px 0" }}
                >
                  <div className={styles.loadingSpinner} />
                </div>
              ) : announcements.length === 0 ? (
                <div
                  className={styles.emptyState}
                  style={{ padding: "24px 0" }}
                >
                  <p className={styles.emptyDesc}>
                    {t("users.announcements.empty")}
                  </p>
                </div>
              ) : (
                <table className={styles.table} style={{ fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      <th>{t("announcements.table.author")}</th>
                      <th>{t("announcements.table.type")}</th>
                      <th>{t("announcements.table.category")}</th>
                      <th>Description</th>
                      <th>{t("announcements.table.status")}</th>
                      <th>{t("announcements.table.date")}</th>
                      <th>{t("announcements.table.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {announcements.map((a) => {
                      const ds = a.cancelledByUser
                        ? "cancelled"
                        : a.closedWithoutMatch
                          ? "closedWithoutMatch"
                          : a.userConfirmed
                            ? "confirmed"
                            : a.isReturned && a.status === "accepted"
                              ? "returned"
                              : a.status;
                      const sc =
                        {
                          pending: styles.badgePending,
                          accepted: styles.badgeAccepted,
                          returned:
                            styles.badgeReturned ?? styles.badgeConfirmed,
                          rejected: styles.badgeRejected,
                          cancelled: styles.badgeCancelled,
                          confirmed: styles.badgeConfirmed,
                          closedWithoutMatch:
                            styles.badgeClosedWithoutMatch ??
                            styles.badgeCancelled,
                        }[ds] ?? styles.badgePending;
                      return (
                        <tr key={a._id}>
                          <td>
                            {a.author && typeof a.author === "object" ? (
                              <div className={styles.authorCell}>
                                <div
                                  className={styles.authorAvatar}
                                  style={{
                                    width: 28,
                                    height: 28,
                                    fontSize: 11,
                                  }}
                                >
                                  {(a.author as Announcement["author"])
                                    .userAvatar ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={
                                        avatarUrl(
                                          (a.author as Announcement["author"])
                                            .userAvatar,
                                        )!
                                      }
                                      alt=""
                                      className={styles.authorAvatarImg}
                                    />
                                  ) : (
                                    initials(
                                      (a.author as Announcement["author"])
                                        .firstName,
                                      (a.author as Announcement["author"])
                                        .lastName,
                                    )
                                  )}
                                </div>
                                <div>
                                  <div
                                    className={styles.authorName}
                                    style={{ fontSize: 12 }}
                                  >
                                    {
                                      (a.author as Announcement["author"])
                                        .firstName
                                    }{" "}
                                    {
                                      (a.author as Announcement["author"])
                                        .lastName
                                    }
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span
                                style={{
                                  color: "var(--text-muted)",
                                  fontSize: 12,
                                }}
                              >
                                —
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`${styles.badge} ${a.type === "lost" ? styles.badgeLost : styles.badgeFound}`}
                            >
                              {t(
                                `announcements.types.${a.type}` as Parameters<
                                  typeof t
                                >[0],
                              )}
                            </span>
                          </td>
                          <td style={{ color: "var(--text-muted)" }}>
                            {t(
                              `categories.${a.category}` as Parameters<
                                typeof t
                              >[0],
                            )}
                          </td>
                          <td>
                            <div className={styles.descCell}>
                              {a.description}
                            </div>
                          </td>
                          <td>
                            <span className={`${styles.badge} ${sc}`}>
                              {t(
                                `announcements.status.${ds}` as Parameters<
                                  typeof t
                                >[0],
                              )}
                            </span>
                          </td>
                          <td
                            style={{
                              color: "var(--text-muted)",
                              fontSize: 11.5,
                            }}
                          >
                            {formatDate(a.createdAt, locale)}
                          </td>
                          <td>
                            <div className={styles.actionRow}>
                              <button
                                className={styles.iconBtn}
                                title={t("announcements.actions.view")}
                                onClick={() => setViewAnn(a)}
                              >
                                <Icon.Eye />
                              </button>

                              {/* PENDING: accept + reject */}
                              {a.status === "pending" && !a.cancelledByUser && (
                                <>
                                  <button
                                    className={`${styles.iconBtn} ${styles.iconBtnSuccess}`}
                                    title={t("announcements.actions.accept")}
                                    onClick={() =>
                                      setConfirmReview({
                                        ann: a,
                                        status: "accepted",
                                      })
                                    }
                                    disabled={actionLoading === a._id}
                                  >
                                    <Icon.Check />
                                  </button>
                                  <button
                                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                    title={t("announcements.actions.reject")}
                                    onClick={() =>
                                      setConfirmReview({
                                        ann: a,
                                        status: "rejected",
                                      })
                                    }
                                    disabled={actionLoading === a._id}
                                  >
                                    <Icon.X />
                                  </button>
                                </>
                              )}

                              {/* ACCEPTED (active): force-reject */}
                              {a.status === "accepted" &&
                                !a.cancelledByUser &&
                                !a.userConfirmed &&
                                !a.closedWithoutMatch && (
                                  <button
                                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                    title={t(
                                      "announcements.actions.forceReject",
                                    )}
                                    onClick={() =>
                                      setConfirmReview({
                                        ann: a,
                                        status: "rejected",
                                      })
                                    }
                                    disabled={actionLoading === a._id}
                                  >
                                    <Icon.X />
                                  </button>
                                )}

                              {/* REJECTED / CANCELLED / CONFIRMED / closedWithoutMatch: view-only — no action buttons */}

                              {/* DELETE — all admins */}
                              <button
                                className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                title={t("announcements.actions.delete")}
                                onClick={() => setConfirmDelete(a)}
                                disabled={actionLoading === a._id}
                              >
                                <Icon.Trash />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {pagination.totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    disabled={pagination.page <= 1}
                    onClick={() => loadAnn(pagination.page - 1)}
                  >
                    <Icon.ChevronLeft />
                  </button>
                  <span className={styles.pageInfo}>
                    {t("common.page")} {pagination.page} {t("common.of")}{" "}
                    {pagination.totalPages}
                  </span>
                  <button
                    className={styles.pageBtn}
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => loadAnn(pagination.page + 1)}
                  >
                    <Icon.ChevronRight />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {viewAnn && (
        <AnnouncementDetailModal
          ann={viewAnn}
          api={api}
          onClose={() => setViewAnn(null)}
          onRefresh={() => loadAnn(pagination.page)}
          isSuperAdmin={session.role === "superadmin"}
        />
      )}

      {confirmReview && (
        <SimpleConfirm
          title={
            confirmReview.status === "accepted"
              ? t("announcements.modal.confirmAcceptTitle")
              : confirmReview.ann.status === "accepted"
                ? t("announcements.modal.confirmForceRejectTitle")
                : t("announcements.modal.confirmRejectTitle")
          }
          message={
            confirmReview.status === "accepted"
              ? t("announcements.modal.confirmAcceptMessage")
              : confirmReview.ann.status === "accepted"
                ? t("announcements.modal.confirmForceRejectMessage")
                : t("announcements.modal.confirmRejectMessage")
          }
          cancelLabel={t("common.cancel")}
          confirmLabel={
            confirmReview.status === "accepted"
              ? t("announcements.actions.accept")
              : confirmReview.ann.status === "accepted"
                ? t("announcements.actions.forceReject")
                : t("announcements.actions.reject")
          }
          confirmClass={
            confirmReview.status === "accepted"
              ? styles.btnSuccess
              : styles.btnDanger
          }
          icon={
            confirmReview.status === "accepted" ? <Icon.Check /> : <Icon.X />
          }
          onClose={() => setConfirmReview(null)}
          onConfirm={() =>
            handleQuickReview(confirmReview.ann, confirmReview.status)
          }
          loading={actionLoading === confirmReview.ann._id}
        />
      )}

      {confirmDelete && (
        <SimpleConfirm
          title={t("announcements.modal.deleteTitle")}
          message={t("announcements.modal.deleteConfirm")}
          cancelLabel={t("common.cancel")}
          confirmLabel={t("common.delete")}
          confirmClass={styles.btnDanger}
          icon={<Icon.Trash />}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete._id)}
          loading={actionLoading === confirmDelete._id}
        />
      )}
    </>
  );
}

// ─── Ban Modal ────────────────────────────────────────────────────────────────

const BAN_DURATIONS: { days: number | null; labelKey: string }[] = [
  { days: 1, labelKey: "users.modal.banDuration1" },
  { days: 3, labelKey: "users.modal.banDuration3" },
  { days: 7, labelKey: "users.modal.banDuration7" },
  { days: 14, labelKey: "users.modal.banDuration14" },
  { days: 30, labelKey: "users.modal.banDuration30" },
  { days: 90, labelKey: "users.modal.banDuration90" },
  { days: null, labelKey: "users.modal.banTypePermanent" },
];

function BanModal({
  user,
  onClose,
  onConfirm,
  loading,
}: {
  user: User;
  onClose: () => void;
  onConfirm: (reason: string, durationDays: number | null) => void;
  loading: boolean;
}) {
  const t = useTranslations("admin");
  const [reason, setReason] = useState("");
  const [durationDays, setDurationDays] = useState<number | null>(7); // default 7 days
  const [err, setErr] = useState("");

  function submit() {
    if (reason.trim().length < 5) {
      setErr(t("users.modal.banReasonMinErr"));
      return;
    }
    if (reason.trim().length > 300) {
      setErr(t("users.modal.banReasonMaxErr"));
      return;
    }
    onConfirm(reason.trim(), durationDays);
  }

  const isPermanent = durationDays === null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{t("users.modal.banTitle")}</span>
          <button className={styles.modalClose} onClick={onClose}>
            <Icon.Close />
          </button>
        </div>
        <div className={styles.modalBody}>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: 13.5,
              marginBottom: 16,
            }}
          >
            {user.firstName} {user.lastName} &lt;{user.email}&gt;
          </p>
          {err && (
            <div className={`${styles.alert} ${styles.alertError}`}>
              <Icon.Warn />
              {err}
            </div>
          )}

          {/* Duration selector */}
          <div className={styles.formField} style={{ marginBottom: 14 }}>
            <label className={styles.formLabel}>
              {t("users.modal.banDurationLabel")}
            </label>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 7,
                marginTop: 6,
              }}
            >
              {BAN_DURATIONS.map(({ days, labelKey }) => {
                const active = days === durationDays;
                return (
                  <button
                    key={String(days)}
                    type="button"
                    onClick={() => setDurationDays(days)}
                    style={{
                      padding: "5px 13px",
                      borderRadius: 7,
                      fontSize: 13,
                      fontWeight: active ? 700 : 500,
                      cursor: "pointer",
                      border: active
                        ? days === null
                          ? "2px solid var(--danger)"
                          : "2px solid var(--accent)"
                        : "1.5px solid var(--border)",
                      background: active
                        ? days === null
                          ? "var(--danger-dim, rgba(239,68,68,.12))"
                          : "var(--yellow-dim)"
                        : "var(--surface)",
                      color: active
                        ? days === null
                          ? "var(--danger)"
                          : "var(--accent)"
                        : "var(--text-secondary)",
                      transition: "all 0.15s",
                    }}
                  >
                    {t(labelKey as Parameters<typeof t>[0])}
                  </button>
                );
              })}
            </div>
            {/* Preview */}
            <div
              style={{
                marginTop: 9,
                fontSize: 12.5,
                color: isPermanent ? "var(--danger)" : "var(--text-muted)",
                fontStyle: "italic",
              }}
            >
              {isPermanent
                ? t("users.modal.banPreviewPermanent")
                : t("users.modal.banPreviewTimed", {
                    date: new Date(
                      Date.now() + (durationDays ?? 0) * 86400000,
                    ).toLocaleDateString(undefined, {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }),
                  })}
            </div>
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>
              {t("users.modal.banReasonLabel")}
            </label>
            <textarea
              className={styles.formTextarea}
              placeholder={t("users.modal.banReasonPlaceholder")}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setErr("");
              }}
              rows={3}
            />
            <span className={styles.formHint}>
              {t("users.modal.banReasonHint")}
            </span>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onClose}
          >
            {t("common.cancel")}
          </button>
          <button
            className={`${styles.btn} ${isPermanent ? styles.btnDanger : (styles.btnWarning ?? styles.btnDanger)}`}
            onClick={submit}
            disabled={loading}
          >
            {loading ? <span className={styles.spinner} /> : <Icon.Ban />}
            {isPermanent
              ? t("users.modal.banSubmitPermanent")
              : t("users.modal.banSubmitTimed")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab({ api, session }: { api: AdminAPI; session: AdminSession }) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
  const [banFilter, setBanFilter] = useState<"" | "true" | "false">("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banUser, setBanUser] = useState<User | null>(null);
  const [banLoading, setBanLoading] = useState(false);
  const [unbanUser, setUnbanUser] = useState<User | null>(null);
  const [unbanLoading, setUnbanLoading] = useState(false);
  const [historyUser, setHistoryUser] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearch(v: string) {
    setSearch(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(v), 400);
  }

  const load = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError("");
      try {
        const p = new URLSearchParams({ page: String(page), limit: "20" });
        if (banFilter) p.set("isBanned", banFilter);
        if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
        const res = await api.listUsers(p);
        setUsers(res.data);
        setPagination(res.pagination);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : t("common.error"));
      } finally {
        setLoading(false);
      }
    },
    [api, banFilter, debouncedSearch, t],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  useEffect(() => {
    function onRefresh() {
      load(pagination.page);
    }
    window.addEventListener("admin:refresh", onRefresh);
    return () => window.removeEventListener("admin:refresh", onRefresh);
  }, [load, pagination.page]);

  async function handleBan(reason: string, durationDays: number | null) {
    if (!banUser) return;
    setBanLoading(true);
    try {
      await api.banUser(banUser._id, reason, durationDays);
      setBanUser(null);
      await load(pagination.page);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBanLoading(false);
    }
  }

  async function handleUnban() {
    if (!unbanUser) return;
    setUnbanLoading(true);
    try {
      await api.unbanUser(unbanUser._id);
      setUnbanUser(null);
      await load(pagination.page);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setUnbanLoading(false);
    }
  }

  const filterTabs = [
    { key: "" as typeof banFilter, label: t("users.filters.all") },
    { key: "false" as typeof banFilter, label: t("users.filters.active") },
    { key: "true" as typeof banFilter, label: t("users.filters.banned") },
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div className={styles.pageEyebrow}>{t("users.eyebrow")}</div>
        <h1 className={styles.pageTitle}>{t("users.title")}</h1>
      </div>

      {error && (
        <div className={`${styles.alert} ${styles.alertError}`}>
          <Icon.Warn />
          {error}
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.filterTabs}>
          {filterTabs.map(({ key, label }) => (
            <button
              key={key}
              className={`${styles.filterTab} ${banFilter === key ? styles.filterTabActive : ""}`}
              onClick={() => setBanFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <Icon.Search />
          </span>
          <input
            className={styles.searchInput}
            placeholder={t("users.search")}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.tableWrap}>
        {loading ? (
          <div className={styles.loadingCenter}>
            <div className={styles.loadingSpinner} />
            <span>{t("common.loading")}</span>
          </div>
        ) : users.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Icon.Users />
            </div>
            <div className={styles.emptyTitle}>{t("users.empty")}</div>
          </div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("users.table.user")}</th>
                  <th>{t("users.table.announcements")}</th>
                  <th>{t("users.table.status")}</th>
                  <th>{t("users.table.joined")}</th>
                  <th>{t("users.table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td>
                      <div className={styles.authorCell}>
                        <div className={styles.authorAvatar}>
                          {user.userAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={avatarUrl(user.userAvatar)!}
                              alt=""
                              className={styles.authorAvatarImg}
                            />
                          ) : (
                            initials(user.firstName, user.lastName)
                          )}
                        </div>
                        <div>
                          <div className={styles.authorName}>
                            {user.firstName} {user.lastName}
                          </div>
                          <div className={styles.authorEmail}>{user.email}</div>
                          {user.isBanned && user.banReason && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--danger)",
                                marginTop: 2,
                                opacity: 0.85,
                              }}
                            >
                              {t("users.banReason")}:{" "}
                              {user.banReason.slice(0, 60)}
                              {user.banReason.length > 60 ? "…" : ""}
                            </div>
                          )}
                          {user.isBanned && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--danger)",
                                opacity: 0.7,
                                marginTop: 1,
                              }}
                            >
                              {user.banExpiresAt
                                ? `${t("users.banExpires")}: ${formatDate(user.banExpiresAt, locale)}`
                                : t("users.banPermanent")}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: 13 }}>
                      {user.announcementStats?.total ?? 0}
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${user.isBanned ? styles.badgeBanned : styles.badgeActive}`}
                      >
                        {user.isBanned
                          ? t("users.status.banned")
                          : t("users.status.active")}
                      </span>
                    </td>
                    <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                      {formatDate(user.createdAt, locale)}
                    </td>
                    <td>
                      <div className={styles.actionRow}>
                        {/* View history — opens full modal */}
                        <button
                          className={styles.iconBtn}
                          title={t("users.actions.viewHistory")}
                          onClick={() => setHistoryUser(user)}
                        >
                          <Icon.User />
                        </button>
                        {user.isBanned ? (
                          <button
                            className={`${styles.iconBtn} ${styles.iconBtnSuccess}`}
                            title={t("users.actions.unban")}
                            onClick={() => setUnbanUser(user)}
                            disabled={actionLoading === user._id}
                          >
                            <Icon.Unban />
                          </button>
                        ) : (
                          <button
                            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                            title={t("users.actions.ban")}
                            onClick={() => setBanUser(user)}
                            disabled={actionLoading === user._id}
                          >
                            <Icon.Ban />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pagination.totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  className={styles.pageBtn}
                  disabled={pagination.page <= 1}
                  onClick={() => load(pagination.page - 1)}
                >
                  <Icon.ChevronLeft />
                </button>
                <span className={styles.pageInfo}>
                  {t("common.page")} {pagination.page} {t("common.of")}{" "}
                  {pagination.totalPages}
                </span>
                <button
                  className={styles.pageBtn}
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => load(pagination.page + 1)}
                >
                  <Icon.ChevronRight />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* User history modal */}
      {historyUser && (
        <UserHistoryModal
          user={historyUser}
          api={api}
          onClose={() => setHistoryUser(null)}
          session={session}
        />
      )}

      {/* Ban modal */}
      {banUser && (
        <BanModal
          user={banUser}
          onClose={() => setBanUser(null)}
          onConfirm={handleBan}
          loading={banLoading}
        />
      )}

      {/* Unban confirmation */}
      {unbanUser && (
        <div className={styles.modalOverlay} onClick={() => setUnbanUser(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>
                {t("users.modal.unbanTitle")}
              </span>
              <button
                className={styles.modalClose}
                onClick={() => setUnbanUser(null)}
              >
                <Icon.Close />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ color: "var(--text-secondary)", fontSize: 13.5 }}>
                {unbanUser.firstName} {unbanUser.lastName} &lt;{unbanUser.email}
                &gt;
              </p>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: 13,
                  marginTop: 10,
                }}
              >
                {t("users.modal.unbanConfirm")}
              </p>
              {unbanUser.banReason && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 14px",
                    borderRadius: 9,
                    background: "var(--danger-dim)",
                    border: "1px solid var(--danger-border)",
                    color: "var(--danger)",
                    fontSize: 13,
                  }}
                >
                  {t("users.banReason")}: {unbanUser.banReason}
                  {unbanUser.banExpiresAt && (
                    <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
                      {t("users.banExpires")}:{" "}
                      {formatDate(unbanUser.banExpiresAt, locale)}
                    </div>
                  )}
                  {!unbanUser.banExpiresAt && (
                    <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
                      {t("users.banPermanent")}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setUnbanUser(null)}
              >
                {t("common.cancel")}
              </button>
              <button
                className={`${styles.btn} ${styles.btnSuccess}`}
                onClick={handleUnban}
                disabled={unbanLoading}
              >
                {unbanLoading ? (
                  <span className={styles.spinner} />
                ) : (
                  <Icon.Unban />
                )}
                {t("users.actions.unban")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Logs Tab ─────────────────────────────────────────────────────────────────

// ─── Log Detail Modal ─────────────────────────────────────────────────────────

function LogDetailModal({
  log,
  onClose,
}: {
  log: AdminLog;
  onClose: () => void;
}) {
  const t = useTranslations("admin");
  const locale = useLocale();

  function actionClass(action: string) {
    if (action.includes("ACCEPT") || action.includes("UNBAN"))
      return styles.logActionAccept;
    if (
      action.includes("REJECT") ||
      action.includes("BAN") ||
      action.includes("DELETE")
    )
      return styles.logActionReject;
    if (
      action.includes("LOGIN") ||
      action.includes("LOGOUT") ||
      action.includes("REFRESH")
    )
      return styles.logActionAuth;
    return styles.logActionDefault;
  }

  const metaEntries = log.meta ? Object.entries(log.meta) : [];

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${styles.modalLarge}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>
            {t("logs.modal.detailTitle")}
          </span>
          <button className={styles.modalClose} onClick={onClose}>
            <Icon.Close />
          </button>
        </div>

        <div
          className={styles.modalBody}
          style={{ maxHeight: "75vh", overflowY: "auto" }}
        >
          {/* Action badge + timestamp */}
          <div className={styles.logDetailHero}>
            <span
              className={`${styles.logAction} ${actionClass(log.action)}`}
              style={{ fontSize: 13.5, padding: "5px 14px" }}
            >
              {t(`logs.actions.${log.action}` as Parameters<typeof t>[0], {
                fallback: log.action,
              })}
            </span>
            <span className={styles.logDetailTime}>
              {formatDate(log.createdAt, locale)}&nbsp;&nbsp;
              <span style={{ opacity: 0.55 }}>
                {new Date(log.createdAt).toLocaleTimeString(
                  locale === "fr" ? "fr-FR" : "en-GB",
                  { hour: "2-digit", minute: "2-digit", second: "2-digit" },
                )}
              </span>
            </span>
          </div>

          {/* Two-column detail grid */}
          <div className={styles.detailRow} style={{ marginTop: 18 }}>
            {/* Admin info */}
            <div className={styles.logDetailCard}>
              <div className={styles.logDetailCardTitle}>
                {t("logs.modal.adminSection")}
              </div>
              <div className={styles.detailField} style={{ marginTop: 10 }}>
                <span className={styles.detailLabel}>
                  {t("logs.table.admin")}
                </span>
                <span
                  className={styles.detailValue}
                  style={{ fontWeight: 600 }}
                >
                  {log.adminUsername}
                </span>
              </div>
              <div className={styles.detailField} style={{ marginTop: 8 }}>
                <span className={styles.detailLabel}>
                  {t("logs.modal.adminEmail")}
                </span>
                <span
                  className={styles.detailValue}
                  style={{ wordBreak: "break-all" }}
                >
                  {log.admin?.email ?? "—"}
                </span>
              </div>
              <div className={styles.detailField} style={{ marginTop: 8 }}>
                <span className={styles.detailLabel}>
                  {t("logs.modal.adminRole")}
                </span>
                <span
                  className={styles.detailValue}
                  style={{ textTransform: "capitalize" }}
                >
                  {log.adminRole}
                </span>
              </div>
            </div>

            {/* Target + IP */}
            <div className={styles.logDetailCard}>
              <div className={styles.logDetailCardTitle}>
                {t("logs.modal.targetSection")}
              </div>
              <div className={styles.detailField} style={{ marginTop: 10 }}>
                <span className={styles.detailLabel}>
                  {t("logs.table.target")}
                </span>
                <span className={styles.detailValue}>
                  {log.targetLabel ?? "—"}
                </span>
              </div>
              {log.targetType && (
                <div className={styles.detailField} style={{ marginTop: 8 }}>
                  <span className={styles.detailLabel}>
                    {t("logs.modal.targetType")}
                  </span>
                  <span
                    className={styles.detailValue}
                    style={{ textTransform: "uppercase", fontSize: 12 }}
                  >
                    {log.targetType}
                  </span>
                </div>
              )}
              <div className={styles.detailField} style={{ marginTop: 8 }}>
                <span className={styles.detailLabel}>{t("logs.table.ip")}</span>
                <span className={styles.logIp}>{log.ip ?? "—"}</span>
              </div>
            </div>
          </div>

          {/* Meta / extra data */}
          {metaEntries.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div className={styles.logDetailCardTitle}>
                {t("logs.modal.metaSection")}
              </div>
              <div className={styles.logMetaGrid}>
                {metaEntries.map(([key, value]) => (
                  <div key={key} className={styles.logMetaRow}>
                    <span className={styles.logMetaKey}>{key}</span>
                    <span className={styles.logMetaValue}>
                      {typeof value === "object"
                        ? JSON.stringify(value, null, 2)
                        : String(value ?? "—")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw action key for reference */}
          <div style={{ marginTop: 18 }}>
            <div className={styles.logDetailCardTitle}>
              {t("logs.modal.rawAction")}
            </div>
            <div className={styles.logRawAction}>{log.action}</div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onClose}
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

function LogsTab({ api }: { api: AdminAPI }) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 1,
  });
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState<{
    totalActions: number;
    byAction: { action: string; count: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewLog, setViewLog] = useState<AdminLog | null>(null);
  const load = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError("");
      try {
        const since = new Date(
          Date.now() - days * 24 * 3600 * 1000,
        ).toISOString();
        const p = new URLSearchParams({
          page: String(page),
          limit: "50",
          from: since,
        });
        const [logRes, sumRes] = await Promise.all([
          api.listLogs(p),
          api.logsSummary(days),
        ]);
        setLogs(logRes.data);
        setPagination(logRes.pagination);
        setSummary(sumRes.data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : t("common.error"));
      } finally {
        setLoading(false);
      }
    },
    [api, days, t],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  useEffect(() => {
    function onRefresh() {
      load(pagination.page);
    }
    window.addEventListener("admin:refresh", onRefresh);
    return () => window.removeEventListener("admin:refresh", onRefresh);
  }, [load, pagination.page]);

  function actionClass(action: string) {
    if (action.includes("ACCEPT") || action.includes("UNBAN"))
      return styles.logActionAccept;
    if (
      action.includes("REJECT") ||
      action.includes("BAN") ||
      action.includes("DELETE")
    )
      return styles.logActionReject;
    if (
      action.includes("LOGIN") ||
      action.includes("LOGOUT") ||
      action.includes("REFRESH")
    )
      return styles.logActionAuth;
    return styles.logActionDefault;
  }

  const periodOptions = [
    { value: 7, label: t("logs.filters.days7") },
    { value: 30, label: t("logs.filters.days30") },
    { value: 90, label: t("logs.filters.days90") },
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div className={styles.pageEyebrow}>{t("logs.eyebrow")}</div>
        <h1 className={styles.pageTitle}>{t("logs.title")}</h1>
      </div>

      {error && (
        <div className={`${styles.alert} ${styles.alertError}`}>
          <Icon.Warn />
          {error}
        </div>
      )}

      {summary && (
        <div className={styles.summaryGrid}>
          <div className={styles.summaryChip}>
            <span className={styles.summaryChipCount}>
              {summary.totalActions}
            </span>
            {t("logs.summary.total")}
          </div>
          {summary.byAction.slice(0, 5).map(({ action, count }) => (
            <div key={action} className={styles.summaryChip}>
              <span className={styles.summaryChipCount}>{count}</span>
              {t(`logs.actions.${action}` as Parameters<typeof t>[0], {
                fallback: action,
              })}
            </div>
          ))}
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.selectWrap}>
          <select
            className={styles.select}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {periodOptions.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <span className={styles.selectArrow}>
            <Icon.ChevronDown />
          </span>
        </div>
      </div>

      <div className={styles.tableWrap}>
        {loading ? (
          <div className={styles.loadingCenter}>
            <div className={styles.loadingSpinner} />
            <span>{t("common.loading")}</span>
          </div>
        ) : logs.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Icon.Logs />
            </div>
            <div className={styles.emptyTitle}>{t("logs.empty")}</div>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("logs.table.admin")}</th>
                <th>{t("logs.table.action")}</th>
                <th>{t("logs.table.target")}</th>
                <th>{t("logs.table.ip")}</th>
                <th>{t("logs.table.date")}</th>
                <th>{t("logs.table.details")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id}>
                  <td>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {log.adminUsername}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--text-muted)",
                        textTransform: "capitalize",
                      }}
                    >
                      {log.adminRole}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`${styles.logAction} ${actionClass(log.action)}`}
                    >
                      {t(
                        `logs.actions.${log.action}` as Parameters<typeof t>[0],
                        { fallback: log.action },
                      )}
                    </span>
                  </td>
                  <td>
                    <div
                      className={styles.descCell}
                      title={log.targetLabel ?? ""}
                    >
                      {log.targetType && (
                        <span
                          style={{
                            fontSize: 10.5,
                            color: "var(--text-muted)",
                            marginRight: 6,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {log.targetType}
                        </span>
                      )}
                      {log.targetLabel}
                    </div>
                  </td>
                  <td>
                    <span className={styles.logIp}>{log.ip ?? "—"}</span>
                  </td>
                  <td
                    style={{
                      color: "var(--text-muted)",
                      fontSize: 12,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {timeAgo(log.createdAt, locale)}
                    <div style={{ fontSize: 11, marginTop: 2 }}>
                      {formatDate(log.createdAt, locale)}
                    </div>
                  </td>
                  <td>
                    <button
                      className={styles.iconBtn}
                      title={t("logs.modal.detailTitle")}
                      onClick={() => setViewLog(log)}
                    >
                      <Icon.Eye />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {pagination.totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              className={styles.pageBtn}
              disabled={pagination.page <= 1}
              onClick={() => load(pagination.page - 1)}
            >
              <Icon.ChevronLeft />
            </button>
            <span className={styles.pageInfo}>
              {t("common.page")} {pagination.page} {t("common.of")}{" "}
              {pagination.totalPages}
            </span>
            <button
              className={styles.pageBtn}
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => load(pagination.page + 1)}
            >
              <Icon.ChevronRight />
            </button>
          </div>
        )}
      </div>

      {viewLog && (
        <LogDetailModal log={viewLog} onClose={() => setViewLog(null)} />
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const t = useTranslations("admin");
  const [session, setSession] = useState<AdminSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    async function init() {
      const stored = loadSession();
      if (stored) {
        const newToken = await adminRefreshToken();
        if (newToken) {
          const updated = { ...stored, accessToken: newToken };
          saveSession(updated);
          setSession(updated);
        } else {
          setSession(stored);
        }
      }
      setSessionLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(
      async () => {
        const newToken = await adminRefreshToken();
        if (newToken && session) {
          const updated = { ...session, accessToken: newToken };
          saveSession(updated);
          setSession(updated);
        } else if (!newToken) {
          clearSession();
          setSession(null);
        }
      },
      13 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const api = new AdminAPI(session.accessToken);
    api
      .listAnnouncements(new URLSearchParams({ status: "pending", limit: "1" }))
      .then((res) => setPendingCount(res.summary.pending))
      .catch(() => {});
  }, [session, activeTab]);

  async function handleLogout() {
    await adminLogoutAPI();
    clearSession();
    setSession(null);
  }

  if (sessionLoading) {
    return (
      <div
        className={styles.dashWrap}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className={styles.loadingCenter}>
          <div className={styles.loadingSpinner} />
          <span>{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={styles.dashWrap}>
        <LoginScreen
          onLogin={(s) => {
            saveSession(s);
            setSession(s);
          }}
        />
      </div>
    );
  }

  const api = new AdminAPI(session.accessToken);

  const TAB_TITLES: Record<Tab, string> = {
    overview: t("nav.overview"),
    announcements: t("nav.announcements"),
    users: t("nav.users"),
    logs: t("nav.logs"),
  };

  return (
    <div className={styles.dashWrap}>
      <Sidebar
        session={session}
        activeTab={activeTab}
        onTab={setActiveTab}
        pendingCount={pendingCount}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={handleLogout}
      />
      <div className={styles.main}>
        <header className={styles.topBar}>
          <button
            className={styles.hamburger}
            onClick={() => setSidebarOpen(true)}
          >
            <Icon.Menu />
          </button>
          <span className={styles.topBarTitle}>{TAB_TITLES[activeTab]}</span>
          <span className={styles.topBarSpacer} />
          <button
            className={styles.topBarRefresh}
            onClick={() =>
              window.dispatchEvent(new CustomEvent("admin:refresh"))
            }
          >
            <Icon.Refresh />
            {t("common.refresh")}
          </button>
        </header>
        <main className={styles.content}>
          {activeTab === "overview" && (
            <OverviewTab api={api} session={session} onNav={setActiveTab} />
          )}
          {activeTab === "announcements" && (
            <AnnouncementsTab api={api} session={session} />
          )}
          {activeTab === "users" && <UsersTab api={api} session={session} />}
          {activeTab === "logs" && session.role === "superadmin" && (
            <LogsTab api={api} />
          )}
        </main>
      </div>
    </div>
  );
}
