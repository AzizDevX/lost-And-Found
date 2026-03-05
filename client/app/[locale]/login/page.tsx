"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios, { AxiosError } from "axios";
import { type Locale } from "@/i18n/routing";
import { EyeIcon, MailIcon, LockIcon, SearchIcon } from "@/components/Icons";
import styles from "./login.module.css";
// ─── Access-token store ───────────────────────────────────────────────────────
// Kept in a module-level ref so auth interceptors can read it without touching
// localStorage. In a real app, lift this into a React context / Zustand store.
let _accessToken: string | null = null;
export const getAccessToken = () => _accessToken;
export const clearAccessToken = () => {
  _accessToken = null;
};

// ─── Axios instance ───────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL, // http://localhost:5000  (see .env.local)
  withCredentials: true, // lets the server set the httpOnly refreshToken cookie
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormState {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

interface LoginSuccess {
  success: true;
  message: string;
  accessToken: string;
}

interface LoginFailure {
  success: false;
  error: "INVALID_CREDENTIALS" | "ACCOUNT_BANNED" | string;
  message: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Lowercase + strip any accidental double-domain (e.g. user@ted-university.com@gmail.com) */
function normaliseEmail(raw: string): string {
  const lower = raw.trim().toLowerCase();
  const parts = lower.split("@");
  if (parts.length > 2) return `${parts[0]}@${parts[1]}`;
  return lower;
}

// ─── Inline alert icons (small, no extra import needed) ───────────────────────
const WarnIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={styles.alertIcon}
  >
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const OkIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={styles.alertIcon}
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const t = useTranslations("login");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState<FormState>({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPwd, setShowPwd] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // ── Validation ───────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: FormErrors = {};
    const email = normaliseEmail(form.email);

    if (!email) {
      errs.email = t("errors.emailRequired");
    } else if (!/^[a-z0-9._%+\-]+@ted-university\.com$/.test(email)) {
      // Only @ted-university.com addresses are valid — no other domains
      errs.email = t("errors.emailInvalid");
    }

    if (!form.password) {
      errs.password = t("errors.passwordRequired");
    } else if (form.password.length < 6) {
      errs.password = t("errors.passwordLength");
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setErrors({});
    const email = normaliseEmail(form.email);

    startTransition(async () => {
      try {
        const { data } = await api.post<LoginSuccess>("/api/auth/login", {
          email,
          password: form.password,
        });

        // Store access token in module-level ref (React state — no localStorage)
        _accessToken = data.accessToken;

        // Refresh token is automatically stored in the httpOnly cookie by the server
        setSuccessMsg(t("success"));
        setTimeout(() => {
          window.location.href = `/${locale}/home`;
        }, 1400);
      } catch (err) {
        const axiosErr = err as AxiosError<LoginFailure>;

        if (!axiosErr.response) {
          // Network error / server down
          setErrors({ general: t("errors.serverError") });
          return;
        }

        const { status, data } = axiosErr.response;

        if (status === 403 && data?.error === "ACCOUNT_BANNED") {
          setErrors({ general: data.message });
          return;
        }

        if (status === 400 || status === 404) {
          setErrors({ general: t("errors.invalidCredentials") });
          return;
        }

        setErrors({ general: t("errors.serverError") });
      }
    });
  };

  // ── Field helpers ─────────────────────────────────────────────────────────────
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className={styles.pageWrap} suppressHydrationWarning>
      {/* ── Left branding panel ───────────────────────────────────────────── */}
      <div className={styles.panelLeft}>
        <div className={styles.leftBg} />

        {/* Hero */}
        <div className={styles.heroSection}>
          <div className={styles.heroIcon}>
            <SearchIcon />
          </div>
          <h1 className={styles.heroTitle}>
            Find what
            <br />
            <span>matters.</span>
          </h1>
          <p className={styles.heroDesc}>
            The official lost and found platform for Ted University students and
            staff. Report, search, and recover your belongings — fast.
          </p>

          <div className={styles.features}>
            {[
              {
                title: "Report Lost Items",
                desc: "Log missing belongings with photos and location details.",
              },
              {
                title: "Browse Found Items",
                desc: "Search campus-wide listings updated in real time.",
              },
              {
                title: "Claim & Collect",
                desc: "Connect with the finder and arrange secure retrieval.",
              },
            ].map((f) => (
              <div className={styles.feature} key={f.title}>
                <div className={styles.featureAccent} />
                <div className={styles.featureText}>
                  <h4>{f.title}</h4>
                  <p>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className={styles.leftCaption}>
          Ted University &mdash; ISP &mdash; University by Clevory
        </p>
      </div>

      {/* ── Right form panel ──────────────────────────────────────────────── */}
      <div className={styles.panelRight}>
        <div className={styles.card}>
          {/* Header */}
          <div className={styles.cardHeader}>
            <p className={styles.cardEyebrow}>{t("university")}</p>
            <h2 className={styles.cardTitle}>{t("title")}</h2>
            <p className={styles.cardSubtitle}>{t("subtitle")}</p>
          </div>

          {/* Alerts */}
          {errors.general && (
            <div
              className={`${styles.alert} ${styles.alertError}`}
              role="alert"
            >
              <WarnIcon />
              {errors.general}
            </div>
          )}
          {successMsg && (
            <div
              className={`${styles.alert} ${styles.alertSuccess}`}
              role="status"
            >
              <OkIcon />
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="email">
                {t("email.label")}
              </label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>
                  <MailIcon />
                </span>
                <input
                  id="email"
                  type="email"
                  className={`${styles.input}${errors.email ? ` ${styles.inputError}` : ""}`}
                  placeholder={t("email.placeholder")}
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  autoComplete="email"
                  aria-describedby={errors.email ? "email-error" : undefined}
                  disabled={isPending}
                  suppressHydrationWarning
                />
              </div>
              {errors.email && (
                <p className={styles.fieldError} id="email-error">
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="password">
                {t("password.label")}
              </label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>
                  <LockIcon />
                </span>
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  className={`${styles.input}${errors.password ? ` ${styles.inputError}` : ""}`}
                  placeholder={t("password.placeholder")}
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  autoComplete="current-password"
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                  disabled={isPending}
                  style={{ paddingRight: "44px" }}
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPwd((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showPwd} />
                </button>
              </div>
              {errors.password && (
                <p className={styles.fieldError} id="password-error">
                  {errors.password}
                </p>
              )}
            </div>

            {/* Remember me + Forgot password */}
            <div className={styles.formRow}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={form.rememberMe}
                  onChange={(e) => setField("rememberMe", e.target.checked)}
                  disabled={isPending}
                />
                <div className={styles.checkboxBox}>
                  <div className={styles.checkboxCheck} />
                </div>
                {t("rememberMe")}
              </label>

              <Link href={`/${locale}/login`} className={styles.forgotLink}>
                {t("forgotPassword")}
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isPending || !!successMsg}
            >
              {isPending ? (
                <>
                  <span className={styles.spinner} />
                  {t("submitting")}
                </>
              ) : (
                t("submit")
              )}
            </button>
          </form>

          <div className={styles.dividerLine} />

          <p className={styles.formFooter}>
            {t("noAccount")}
            <Link href={`/${locale}/register`} className={styles.registerLink}>
              {t("register")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
