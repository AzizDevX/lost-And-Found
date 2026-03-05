"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios, { AxiosError } from "axios";
import { type Locale } from "@/i18n/routing";
import {
  EyeIcon,
  MailIcon,
  LockIcon,
  UserIcon,
  SearchIcon,
} from "@/components/Icons";
import styles from "./register.module.css";

// ─── Axios instance ───────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

// ─── Password strength ────────────────────────────────────────────────────────
function getStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}

const STRENGTH_COLORS = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"];
const STRENGTH_WIDTHS = ["0%", "25%", "50%", "75%", "100%"];

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
  general?: string;
}

interface RegisterFailure {
  success: false;
  error: "EMAIL_ALREADY_EXISTS" | string;
  message: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normaliseEmail(raw: string): string {
  const lower = raw.trim().toLowerCase();
  const parts = lower.split("@");
  if (parts.length > 2) return `${parts[0]}@${parts[1]}`;
  return lower;
}

// ─── Inline alert icons ───────────────────────────────────────────────────────
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
export default function RegisterPage() {
  const t = useTranslations("register");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    terms: false,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [showPwd, setShowPwd] = useState(false);
  const [showCfm, setShowCfm] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const strength = getStrength(form.password);
  const strengthLabels = [
    "",
    t("passwordStrength.weak"),
    t("passwordStrength.fair"),
    t("passwordStrength.good"),
    t("passwordStrength.strong"),
  ];

  // ── Field helper ─────────────────────────────────────────────────────────────
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // ── Validation ───────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: FormErrors = {};
    const email = normaliseEmail(form.email);

    if (!form.firstName.trim()) errs.firstName = t("errors.firstNameRequired");
    if (!form.lastName.trim()) errs.lastName = t("errors.lastNameRequired");

    if (!email) {
      errs.email = t("errors.emailRequired");
    } else if (!email.endsWith("@ted-university.com")) {
      errs.email = t("errors.emailInvalid");
    } else if (!/^[a-z0-9._%+\-]+@ted-university\.com$/.test(email)) {
      errs.email = t("errors.emailInvalid");
    }

    if (!form.password) {
      errs.password = t("errors.passwordRequired");
    } else if (form.password.length < 8) {
      errs.password = t("errors.passwordLength");
    }

    if (!form.confirmPassword) {
      errs.confirmPassword = t("errors.confirmPasswordRequired");
    } else if (form.password !== form.confirmPassword) {
      errs.confirmPassword = t("errors.passwordMismatch");
    }

    if (!form.terms) errs.terms = t("errors.termsRequired");

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
        await api.post("/api/auth/register", {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email,
          password: form.password,
        });

        setSuccessMsg(t("success"));
        setTimeout(() => router.push(`/${locale}/login`), 1800);
      } catch (err) {
        const axiosErr = err as AxiosError<RegisterFailure>;

        if (!axiosErr.response) {
          setErrors({ general: t("errors.serverError") });
          return;
        }

        const { status, data } = axiosErr.response;

        if (status === 409 && data?.error === "EMAIL_ALREADY_EXISTS") {
          setErrors({ email: t("errors.emailTaken") });
          return;
        }

        setErrors({ general: t("errors.serverError") });
      }
    });
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
            Join the
            <br />
            <span>community.</span>
          </h1>
          <p className={styles.heroDesc}>
            Create your Ted University account to report lost items, browse
            found belongings, and help fellow students.
          </p>

          <div className={styles.steps}>
            {[
              {
                n: "1",
                title: "Create your account",
                desc: "Fill in your details and verify your university email.",
              },
              {
                n: "2",
                title: "Set up your profile",
                desc: "Add your student ID and contact preferences.",
              },
              {
                n: "3",
                title: "Start helping",
                desc: "Report lost items or claim what you found on campus.",
              },
            ].map((s) => (
              <div className={styles.step} key={s.n}>
                <div className={styles.stepNum}>{s.n}</div>
                <div className={styles.stepText}>
                  <h4>{s.title}</h4>
                  <p>{s.desc}</p>
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
            {/* First name + Last name */}
            <div className={styles.nameRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="firstName">
                  {t("firstName.label")}
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}>
                    <UserIcon />
                  </span>
                  <input
                    id="firstName"
                    type="text"
                    className={`${styles.input}${errors.firstName ? ` ${styles.inputError}` : ""}`}
                    placeholder={t("firstName.placeholder")}
                    value={form.firstName}
                    onChange={(e) => setField("firstName", e.target.value)}
                    autoComplete="given-name"
                    disabled={isPending}
                    suppressHydrationWarning
                  />
                </div>
                {errors.firstName && (
                  <p className={styles.fieldError}>{errors.firstName}</p>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="lastName">
                  {t("lastName.label")}
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}>
                    <UserIcon />
                  </span>
                  <input
                    id="lastName"
                    type="text"
                    className={`${styles.input}${errors.lastName ? ` ${styles.inputError}` : ""}`}
                    placeholder={t("lastName.placeholder")}
                    value={form.lastName}
                    onChange={(e) => setField("lastName", e.target.value)}
                    autoComplete="family-name"
                    disabled={isPending}
                    suppressHydrationWarning
                  />
                </div>
                {errors.lastName && (
                  <p className={styles.fieldError}>{errors.lastName}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="reg-email">
                {t("email.label")}
              </label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>
                  <MailIcon />
                </span>
                <input
                  id="reg-email"
                  type="email"
                  className={`${styles.input}${errors.email ? ` ${styles.inputError}` : ""}`}
                  placeholder={t("email.placeholder")}
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  autoComplete="email"
                  disabled={isPending}
                  suppressHydrationWarning
                />
              </div>
              {errors.email && (
                <p className={styles.fieldError}>{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="reg-password">
                {t("password.label")}
              </label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>
                  <LockIcon />
                </span>
                <input
                  id="reg-password"
                  type={showPwd ? "text" : "password"}
                  className={`${styles.input}${errors.password ? ` ${styles.inputError}` : ""}`}
                  placeholder={t("password.placeholder")}
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  autoComplete="new-password"
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

              {/* Strength bar */}
              {form.password && (
                <div className={styles.strengthWrap}>
                  <div className={styles.strengthTrack}>
                    <div
                      className={styles.strengthFill}
                      style={{
                        width: STRENGTH_WIDTHS[strength],
                        background: STRENGTH_COLORS[strength],
                      }}
                    />
                  </div>
                  <span className={styles.strengthLabel}>
                    {t("passwordStrength.label")}:{" "}
                    <strong style={{ color: STRENGTH_COLORS[strength] }}>
                      {strengthLabels[strength]}
                    </strong>
                  </span>
                </div>
              )}

              {errors.password && (
                <p className={styles.fieldError}>{errors.password}</p>
              )}
            </div>

            {/* Confirm password */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="confirmPassword">
                {t("confirmPassword.label")}
              </label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>
                  <LockIcon />
                </span>
                <input
                  id="confirmPassword"
                  type={showCfm ? "text" : "password"}
                  className={`${styles.input}${errors.confirmPassword ? ` ${styles.inputError}` : ""}`}
                  placeholder={t("confirmPassword.placeholder")}
                  value={form.confirmPassword}
                  onChange={(e) => setField("confirmPassword", e.target.value)}
                  autoComplete="new-password"
                  disabled={isPending}
                  style={{ paddingRight: "44px" }}
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowCfm((v) => !v)}
                  tabIndex={-1}
                  aria-label={showCfm ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showCfm} />
                </button>
              </div>
              {errors.confirmPassword && (
                <p className={styles.fieldError}>{errors.confirmPassword}</p>
              )}
            </div>

            {/* Terms */}
            <div className={styles.termsRow}>
              <div
                className={`${styles.checkboxBox}${form.terms ? ` ${styles.checkboxBoxChecked}` : ""}`}
                onClick={() => {
                  if (!isPending) {
                    setForm((f) => ({ ...f, terms: !f.terms }));
                    if (errors.terms)
                      setErrors((e) => ({ ...e, terms: undefined }));
                  }
                }}
                role="checkbox"
                aria-checked={form.terms}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    setForm((f) => ({ ...f, terms: !f.terms }));
                  }
                }}
              >
                {form.terms && <div className={styles.checkboxCheck} />}
              </div>
              <span className={styles.termsText}>
                {t("terms")}{" "}
                <Link href={`/${locale}/terms`} className={styles.termsLink}>
                  {t("termsLink")}
                </Link>
              </span>
            </div>
            {errors.terms && (
              <p
                className={styles.fieldError}
                style={{ marginTop: -12, marginBottom: 16 }}
              >
                {errors.terms}
              </p>
            )}

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
            {t("haveAccount")}
            <Link href={`/${locale}/login`} className={styles.loginLink}>
              {t("login")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
