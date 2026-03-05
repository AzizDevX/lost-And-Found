"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerUser } from "@/lib/auth";
import { type Locale } from "@/i18n";
import {
  EyeIcon,
  MailIcon,
  LockIcon,
  UserIcon,
  IdCardIcon,
  SearchIcon,
} from "@/components/Icons";
import LanguageSwitcher from "@/components/LanguageSwitcher";

// ─── Password strength ────────────────────────────────────────────────────────
function getPasswordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
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
  studentId: string;
  role: "student" | "staff" | "admin";
  email: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  studentId?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
  general?: string;
}

export default function RegisterPage() {
  const t = useTranslations("register");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState<FormState>({
    firstName: "",
    lastName: "",
    studentId: "",
    role: "student",
    email: "",
    password: "",
    confirmPassword: "",
    terms: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const strength = getPasswordStrength(form.password);
  const strengthLabels = [
    "-",
    t("passwordStrength.weak"),
    t("passwordStrength.fair"),
    t("passwordStrength.good"),
    t("passwordStrength.strong"),
  ];

  const set =
    (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value =
        e.target.type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : e.target.value;
      setForm((f) => ({ ...f, [field]: value }));
      if (errors[field as keyof FormErrors])
        setErrors((err) => ({ ...err, [field]: undefined }));
    };

  const validate = (): boolean => {
    const errs: FormErrors = {};
    if (!form.firstName.trim()) errs.firstName = t("errors.firstNameRequired");
    if (!form.lastName.trim()) errs.lastName = t("errors.lastNameRequired");
    if (!form.studentId.trim()) errs.studentId = t("errors.studentIdRequired");
    if (!form.email.trim()) errs.email = t("errors.emailRequired");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = t("errors.emailInvalid");
    if (!form.password) errs.password = t("errors.passwordRequired");
    else if (form.password.length < 8)
      errs.password = t("errors.passwordLength");
    if (!form.confirmPassword)
      errs.confirmPassword = t("errors.confirmPasswordRequired");
    else if (form.password !== form.confirmPassword)
      errs.confirmPassword = t("errors.passwordMismatch");
    if (!form.terms) errs.terms = t("errors.termsRequired");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setErrors({});
    startTransition(async () => {
      const result = await registerUser(form);
      if (result.success) {
        setSuccessMsg(t("success"));
        setTimeout(() => router.push(`/${locale}/login`), 1800);
      } else {
        const errKey =
          result.error.code === "EMAIL_TAKEN"
            ? "errors.emailTaken"
            : "errors.serverError";
        setErrors({ general: t(errKey) });
      }
    });
  };

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-16px); }
        }

        .rpage {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 1.4fr;
          background: var(--bg-deep);
          position: relative;
        }

        /* ── Left panel ─────────────────────── */
        .rpanel-left {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 60px 40px;
          position: relative;
          overflow: hidden;
          border-right: 1px solid var(--border);
          background:
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(79,142,247,0.15) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 90% 100%, rgba(99,102,241,0.1) 0%, transparent 60%),
            var(--bg-deep);
        }
        .rorb {
          position: absolute; border-radius: 50%;
          pointer-events: none; filter: blur(70px); opacity: 0.2;
        }
        .rorb-1 { width: 280px; height: 280px; background: #4f8ef7; top: -60px; left: -60px; animation: float 10s ease-in-out infinite; }
        .rorb-2 { width: 200px; height: 200px; background: #8b5cf6; bottom: 40px; right: -40px; animation: float 13s ease-in-out infinite 4s; }

        .rbrand { text-align: center; animation: fadeUp 0.7s ease both; }
        .rbrand-icon-wrap { position: relative; width: 80px; height: 80px; margin: 0 auto 24px; }
        .rbrand-ring {
          position: absolute; inset: -8px; border-radius: 50%;
          border: 2px solid var(--accent); opacity: 0.4;
          animation: spin 8s linear infinite;
          border-top-color: transparent; border-bottom-color: transparent;
        }
        .rbrand-icon {
          width: 80px; height: 80px;
          background: linear-gradient(135deg, #1e3a5f, #0f2040);
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          border: 2px solid var(--accent); box-shadow: 0 0 28px rgba(79,142,247,0.3);
          color: var(--accent);
        }
        .rbrand-name {
          font-family: var(--font-display); font-size: clamp(22px, 2.5vw, 30px);
          font-weight: 700; color: var(--text-primary);
          line-height: 1.2; margin-bottom: 8px;
        }
        .rbrand-sub { font-size: 13px; color: var(--text-secondary); }

        .rsteps {
          margin-top: 48px; width: 100%; max-width: 300px;
          display: flex; flex-direction: column; gap: 0;
          animation: fadeUp 0.7s ease 0.2s both;
        }
        .rstep {
          display: flex; gap: 16px; align-items: flex-start;
          position: relative;
        }
        .rstep:not(:last-child)::after {
          content: ''; position: absolute;
          left: 15px; top: 32px;
          width: 2px; height: calc(100% - 8px);
          background: linear-gradient(to bottom, var(--accent), transparent);
          opacity: 0.3;
        }
        [dir="rtl"] .rstep:not(:last-child)::after { left: auto; right: 15px; }
        .rstep-num {
          width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
          background: rgba(79,142,247,0.12); border: 1.5px solid rgba(79,142,247,0.4);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; color: var(--accent);
          margin-bottom: 24px;
        }
        .rstep-text { padding-top: 6px; }
        .rstep-text h4 { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; }
        .rstep-text p { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }

        /* ── Right / form panel ─────────────── */
        .rpanel-right {
          display: flex; flex-direction: column;
          justify-content: center; align-items: center;
          padding: 48px 48px;
          position: relative;
          overflow-y: auto;
        }

        /* ── Card ───────────────────────────── */
        .rcard {
          width: 100%; max-width: 500px;
          animation: fadeUp 0.6s ease 0.1s both;
        }
        .rcard-header { margin-bottom: 32px; }
        .rcard-title {
          font-family: var(--font-display);
          font-size: clamp(26px, 3vw, 36px);
          font-weight: 700; color: var(--text-primary);
          line-height: 1.1; margin-bottom: 6px; letter-spacing: -0.5px;
        }
        .rcard-subtitle { font-size: 14px; color: var(--text-secondary); }

        /* ── Form grid ──────────────────────── */
        .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .form-group { margin-bottom: 18px; }
        .form-label {
          display: block; font-size: 13px; font-weight: 500;
          color: var(--text-secondary); margin-bottom: 7px; letter-spacing: 0.02em;
        }
        .input-wrap { position: relative; display: flex; align-items: center; }
        .input-icon {
          position: absolute; left: 14px; color: var(--text-muted);
          pointer-events: none; transition: all 0.2s; display: flex; align-items: center;
        }
        [dir="rtl"] .input-icon { left: auto; right: 14px; }
        .input {
          width: 100%; padding: 12px 16px 12px 44px;
          background: var(--bg-input); border: 1.5px solid var(--border);
          border-radius: 8px; color: var(--text-primary);
          font-family: var(--font-body); font-size: 14px; outline: none;
          transition: all 0.2s;
        }
        [dir="rtl"] .input { padding: 12px 44px 12px 16px; }
        .input::placeholder { color: var(--text-muted); }
        .input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(79,142,247,0.2); }
        .input-wrap:focus-within .input-icon { color: var(--accent); }
        .input.error { border-color: var(--error); }
        .input.error:focus { box-shadow: 0 0 0 3px rgba(248,113,113,0.2); }
        .eye-btn {
          position: absolute; right: 12px; background: none; border: none;
          color: var(--text-muted); cursor: pointer; padding: 4px;
          display: flex; transition: all 0.2s;
        }
        [dir="rtl"] .eye-btn { right: auto; left: 12px; }
        .eye-btn:hover { color: var(--text-secondary); }
        .field-error { margin-top: 5px; font-size: 12px; color: var(--error); }

        /* ── Role selector ──────────────────── */
        .role-group { display: flex; gap: 10px; margin-bottom: 0; }
        .role-btn {
          flex: 1; padding: 10px 8px; border-radius: 8px;
          border: 1.5px solid var(--border); background: var(--bg-input);
          color: var(--text-secondary); font-family: var(--font-body);
          font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s;
          text-align: center;
        }
        .role-btn:hover { border-color: rgba(79,142,247,0.4); color: var(--text-primary); }
        .role-btn.active {
          border-color: var(--accent); background: rgba(79,142,247,0.1);
          color: var(--accent);
        }

        /* ── Password strength ──────────────── */
        .strength-bar-wrap {
          margin-top: 8px; display: flex; flex-direction: column; gap: 4px;
        }
        .strength-track {
          height: 3px; background: var(--border); border-radius: 2px; overflow: hidden;
        }
        .strength-fill {
          height: 100%; border-radius: 2px; transition: width 0.4s ease, background 0.3s;
        }
        .strength-label { font-size: 11px; color: var(--text-muted); }

        /* ── Terms ──────────────────────────── */
        .terms-row {
          display: flex; align-items: flex-start; gap: 10px;
          margin-bottom: 24px; margin-top: 4px;
        }
        .checkbox-box {
          width: 17px; height: 17px; flex-shrink: 0; margin-top: 1px;
          border: 1.5px solid var(--border); border-radius: 4px;
          background: var(--bg-input); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .checkbox-box.checked { background: var(--accent); border-color: var(--accent); }
        .checkbox-check {
          width: 9px; height: 6px;
          border-left: 2px solid #fff; border-bottom: 2px solid #fff;
          transform: rotate(-45deg) translate(1px, -1px);
        }
        .terms-text { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
        .terms-link { color: var(--accent); text-decoration: none; }
        .terms-link:hover { color: var(--accent-hover); }

        /* ── Submit ─────────────────────────── */
        .submit-btn {
          width: 100%; padding: 14px 20px; border: none; border-radius: 8px;
          background: linear-gradient(135deg, #4f8ef7 0%, #6366f1 100%);
          color: #fff; font-family: var(--font-body); font-size: 15px;
          font-weight: 600; cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 10px;
        }
        .submit-btn:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(79,142,247,0.4); }
        .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }

        /* ── Alerts ─────────────────────────── */
        .alert { padding: 12px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 18px; animation: fadeUp 0.3s ease; display: flex; gap: 8px; align-items: flex-start; }
        .alert-error { background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3); color: #fca5a5; }
        .alert-success { background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.3); color: #6ee7b7; }

        /* ── Footer ─────────────────────────── */
        .form-footer { margin-top: 24px; text-align: center; font-size: 13px; color: var(--text-muted); }
        .form-footer a { color: var(--accent); text-decoration: none; font-weight: 500; margin-inline-start: 4px; }
        .form-footer a:hover { color: var(--accent-hover); }

        /* ── Responsive ─────────────────────── */
        @media (max-width: 960px) {
          .rpage { grid-template-columns: 1fr; }
          .rpanel-left { display: none; }
          .rpanel-right { padding: 48px 24px; }
        }
        @media (max-width: 500px) {
          .rpanel-right { padding: 48px 16px; }
          .form-row-2 { grid-template-columns: 1fr; }
          .rcard-title { font-size: 26px; }
        }
      `}</style>

      <div className="rpage" suppressHydrationWarning>
        {/* ── Left panel ── */}
        <div className="rpanel-left">
          <div className="rorb rorb-1" />
          <div className="rorb rorb-2" />

          <div className="rbrand">
            <div className="rbrand-icon-wrap">
              <div className="rbrand-ring" />
              <div className="rbrand-icon">
                <SearchIcon />
              </div>
            </div>
            <h1 className="rbrand-name">{t("university")}</h1>
            <p className="rbrand-sub">{t("subtitle")}</p>
          </div>

          <div className="rsteps">
            {[
              {
                n: "1",
                title: "Create your account",
                desc: "Fill in your details and university credentials.",
              },
              {
                n: "2",
                title: "Verify your email",
                desc: "Check your inbox for a confirmation link.",
              },
              {
                n: "3",
                title: "Start using the portal",
                desc: "Report lost items or browse what's been found.",
              },
            ].map((s) => (
              <div className="rstep" key={s.n}>
                <div className="rstep-num">{s.n}</div>
                <div className="rstep-text">
                  <h4>{s.title}</h4>
                  <p>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right / form panel ── */}
        <div className="rpanel-right">
          <LanguageSwitcher locale={locale} page="register" />

          <div className="rcard">
            <div className="rcard-header">
              <h2 className="rcard-title">{t("title")}</h2>
              <p className="rcard-subtitle">{t("subtitle")}</p>
            </div>

            {errors.general && (
              <div className="alert alert-error">⚠ {errors.general}</div>
            )}
            {successMsg && (
              <div className="alert alert-success">✓ {successMsg}</div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {/* Name row */}
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="firstName">
                    {t("firstName.label")}
                  </label>
                  <div className="input-wrap">
                    <span className="input-icon">
                      <UserIcon />
                    </span>
                    <input
                      id="firstName"
                      type="text"
                      className={`input${errors.firstName ? " error" : ""}`}
                      placeholder={t("firstName.placeholder")}
                      value={form.firstName}
                      onChange={set("firstName")}
                      autoComplete="given-name"
                      disabled={isPending}
                      suppressHydrationWarning
                    />
                  </div>
                  {errors.firstName && (
                    <p className="field-error">⚠ {errors.firstName}</p>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="lastName">
                    {t("lastName.label")}
                  </label>
                  <div className="input-wrap">
                    <span className="input-icon">
                      <UserIcon />
                    </span>
                    <input
                      id="lastName"
                      type="text"
                      className={`input${errors.lastName ? " error" : ""}`}
                      placeholder={t("lastName.placeholder")}
                      value={form.lastName}
                      onChange={set("lastName")}
                      autoComplete="family-name"
                      disabled={isPending}
                      suppressHydrationWarning
                    />
                  </div>
                  {errors.lastName && (
                    <p className="field-error">⚠ {errors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="form-group">
                <label className="form-label" htmlFor="reg-email">
                  {t("email.label")}
                </label>
                <div className="input-wrap">
                  <span className="input-icon">
                    <MailIcon />
                  </span>
                  <input
                    id="reg-email"
                    type="email"
                    className={`input${errors.email ? " error" : ""}`}
                    placeholder={t("email.placeholder")}
                    value={form.email}
                    onChange={set("email")}
                    autoComplete="email"
                    disabled={isPending}
                    suppressHydrationWarning
                  />
                </div>
                {errors.email && (
                  <p className="field-error">⚠ {errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div className="form-group">
                <label className="form-label" htmlFor="reg-password">
                  {t("password.label")}
                </label>
                <div className="input-wrap">
                  <span className="input-icon">
                    <LockIcon />
                  </span>
                  <input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    className={`input${errors.password ? " error" : ""}`}
                    placeholder={t("password.placeholder")}
                    value={form.password}
                    onChange={set("password")}
                    autoComplete="new-password"
                    disabled={isPending}
                    style={{ paddingRight: "44px" }}
                    suppressHydrationWarning
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
                {form.password && (
                  <div className="strength-bar-wrap">
                    <div className="strength-track">
                      <div
                        className="strength-fill"
                        style={{
                          width: STRENGTH_WIDTHS[strength],
                          background: STRENGTH_COLORS[strength],
                        }}
                      />
                    </div>
                    <span className="strength-label">
                      {t("passwordStrength.label")}:{" "}
                      <strong style={{ color: STRENGTH_COLORS[strength] }}>
                        {strengthLabels[strength]}
                      </strong>
                    </span>
                  </div>
                )}
                {errors.password && (
                  <p className="field-error">⚠ {errors.password}</p>
                )}
              </div>

              {/* Confirm password */}
              <div className="form-group">
                <label className="form-label" htmlFor="confirmPassword">
                  {t("confirmPassword.label")}
                </label>
                <div className="input-wrap">
                  <span className="input-icon">
                    <LockIcon />
                  </span>
                  <input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    className={`input${errors.confirmPassword ? " error" : ""}`}
                    placeholder={t("confirmPassword.placeholder")}
                    value={form.confirmPassword}
                    onChange={set("confirmPassword")}
                    autoComplete="new-password"
                    disabled={isPending}
                    style={{ paddingRight: "44px" }}
                    suppressHydrationWarning
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    onClick={() => setShowConfirm((v) => !v)}
                    tabIndex={-1}
                  >
                    <EyeIcon open={showConfirm} />
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="field-error">⚠ {errors.confirmPassword}</p>
                )}
              </div>

              {/* Terms */}
              <div className="terms-row">
                <div
                  className={`checkbox-box${form.terms ? " checked" : ""}`}
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
                  {form.terms && <div className="checkbox-check" />}
                </div>
                <span className="terms-text">
                  {t("terms")}{" "}
                  <Link href={`/${locale}/terms`} className="terms-link">
                    {t("termsLink")}
                  </Link>
                </span>
              </div>
              {errors.terms && (
                <p
                  className="field-error"
                  style={{ marginTop: -16, marginBottom: 16 }}
                >
                  ⚠ {errors.terms}
                </p>
              )}

              <button
                type="submit"
                className="submit-btn"
                disabled={isPending || !!successMsg}
              >
                {isPending ? (
                  <>
                    <span className="spinner" />
                    {t("submitting")}
                  </>
                ) : (
                  t("submit")
                )}
              </button>
            </form>

            <p className="form-footer">
              {t("haveAccount")}
              <Link href={`/${locale}/login`}>{t("login")}</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
