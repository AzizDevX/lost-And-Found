"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/auth";
import { type Locale } from "@/i18n";
import { MailIcon, ArrowLeftIcon, SearchIcon, CheckCircleIcon } from "@/components/Icons";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const RESEND_COOLDOWN = 60; // seconds

export default function ForgotPasswordPage() {
  const t = useTranslations("forgotPassword");
  const locale = useLocale() as Locale;
  const [isPending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer after send
  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [countdown]);

  const validate = (val: string): boolean => {
    if (!val.trim()) { setEmailError(t("errors.emailRequired")); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { setEmailError(t("errors.emailInvalid")); return false; }
    return true;
  };

  const doRequest = async (addr: string) => {
    const result = await requestPasswordReset({ email: addr });
    if (result.success) {
      setSubmitted(true);
      setCountdown(RESEND_COOLDOWN);
    } else {
      const errKey = result.error.code === "EMAIL_NOT_FOUND" ? "errors.emailNotFound" : "errors.serverError";
      setGeneralError(t(errKey));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError("");
    if (!validate(email)) return;
    startTransition(async () => { await doRequest(email); });
  };

  const handleResend = () => {
    if (countdown > 0 || isResending) return;
    setIsResending(true);
    startTransition(async () => {
      await doRequest(email);
      setIsResending(false);
    });
  };

  const successMessage = t("successMessage").replace("{email}", email);
  const resendLabel = countdown > 0
    ? t("resendCooldown").replace("{seconds}", String(countdown))
    : isResending ? t("resending") : t("resend");

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50%       { transform: translateY(-14px) scale(1.02); }
        }
        @keyframes checkDraw {
          from { stroke-dashoffset: 200; opacity: 0; }
          to   { stroke-dashoffset: 0;   opacity: 1; }
        }
        @keyframes successPop {
          0%   { transform: scale(0.7); opacity: 0; }
          70%  { transform: scale(1.05); }
          100% { transform: scale(1);   opacity: 1; }
        }

        .fp-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(ellipse 70% 50% at 20% 20%, rgba(79,142,247,0.1) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 80% 80%, rgba(99,102,241,0.08) 0%, transparent 60%),
            var(--bg-deep);
          padding: 40px 16px;
          position: relative;
        }

        /* Decorative blobs */
        .fp-blob {
          position: fixed; border-radius: 50%; pointer-events: none;
          filter: blur(90px); opacity: 0.12;
        }
        .fp-blob-1 { width: 400px; height: 400px; background: #4f8ef7; top: -100px; left: -100px; animation: float 11s ease-in-out infinite; }
        .fp-blob-2 { width: 300px; height: 300px; background: #8b5cf6; bottom: -80px; right: -80px; animation: float 14s ease-in-out infinite 5s; }

        /* ── Card ── */
        .fp-card {
          width: 100%; max-width: 460px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 22px;
          padding: 48px 44px;
          box-shadow: 0 32px 80px rgba(0,0,0,0.5);
          position: relative;
          z-index: 1;
          animation: fadeUp 0.6s ease both;
        }

        /* ── Brand mark inside card ── */
        .fp-brand {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 36px;
        }
        .fp-brand-icon {
          width: 40px; height: 40px;
          background: linear-gradient(135deg, #1e3a5f, #0f2040);
          border-radius: 10px; display: flex; align-items: center; justify-content: center;
          border: 1px solid var(--accent); color: var(--accent);
          flex-shrink: 0;
        }
        .fp-brand-name {
          font-family: var(--font-display); font-size: 15px;
          font-weight: 600; color: var(--text-secondary);
        }

        /* ── Header ── */
        .fp-icon-wrap {
          width: 72px; height: 72px;
          background: rgba(79,142,247,0.1);
          border: 1.5px solid rgba(79,142,247,0.3);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 24px; color: var(--accent);
        }
        .fp-title {
          font-family: var(--font-display); font-size: clamp(24px, 3vw, 32px);
          font-weight: 700; color: var(--text-primary);
          line-height: 1.15; margin-bottom: 8px; letter-spacing: -0.4px;
        }
        .fp-subtitle { font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 32px; }

        /* ── Input ── */
        .form-group { margin-bottom: 20px; }
        .form-label { display: block; font-size: 13px; font-weight: 500; color: var(--text-secondary); margin-bottom: 7px; }
        .input-wrap { position: relative; display: flex; align-items: center; }
        .input-icon { position: absolute; left: 14px; color: var(--text-muted); pointer-events: none; display: flex; align-items: center; transition: all 0.2s; }
        [dir="rtl"] .input-icon { left: auto; right: 14px; }
        .input {
          width: 100%; padding: 13px 16px 13px 44px;
          background: var(--bg-input); border: 1.5px solid var(--border);
          border-radius: 8px; color: var(--text-primary);
          font-family: var(--font-body); font-size: 14px; outline: none; transition: all 0.2s;
        }
        [dir="rtl"] .input { padding: 13px 44px 13px 16px; }
        .input::placeholder { color: var(--text-muted); }
        .input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(79,142,247,0.2); }
        .input-wrap:focus-within .input-icon { color: var(--accent); }
        .input.error { border-color: var(--error); }
        .input.error:focus { box-shadow: 0 0 0 3px rgba(248,113,113,0.2); }
        .field-error { margin-top: 6px; font-size: 12px; color: var(--error); }

        /* ── Alert ── */
        .alert { padding: 12px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 18px; animation: fadeUp 0.3s ease; display: flex; gap: 8px; }
        .alert-error { background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3); color: #fca5a5; }

        /* ── Submit ── */
        .submit-btn {
          width: 100%; padding: 14px; border: none; border-radius: 8px;
          background: linear-gradient(135deg, #4f8ef7, #6366f1);
          color: #fff; font-family: var(--font-body); font-size: 15px;
          font-weight: 600; cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 10px;
        }
        .submit-btn:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(79,142,247,0.4); }
        .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }

        /* ── Back link ── */
        .back-link {
          display: flex; align-items: center; gap: 6px;
          margin-top: 24px; font-size: 13px; color: var(--text-muted);
          text-decoration: none; transition: all 0.2s; width: fit-content;
          margin-inline: auto;
        }
        .back-link:hover { color: var(--accent); }

        /* ── Success state ── */
        .fp-success {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; padding: 8px 0;
          animation: successPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .fp-success-icon {
          color: var(--success);
          margin-bottom: 20px;
        }
        .fp-success-icon svg {
          stroke-dasharray: 200;
          stroke-dashoffset: 200;
          animation: checkDraw 0.8s ease 0.2s forwards;
        }
        .fp-success-title {
          font-family: var(--font-display); font-size: 26px;
          font-weight: 700; color: var(--text-primary);
          margin-bottom: 12px;
        }
        .fp-success-msg {
          font-size: 14px; color: var(--text-secondary); line-height: 1.7;
          margin-bottom: 32px; max-width: 340px;
        }
        .fp-success-msg strong { color: var(--accent); }
        .resend-btn {
          padding: 11px 24px; border-radius: 8px;
          border: 1.5px solid var(--border); background: var(--bg-input);
          color: var(--text-secondary); font-family: var(--font-body);
          font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; gap: 8px;
        }
        .resend-btn:not(:disabled):hover { border-color: var(--accent); color: var(--accent); }
        .resend-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .countdown-ring {
          width: 18px; height: 18px; border-radius: 50%;
          border: 2px solid var(--accent); display: inline-flex;
          align-items: center; justify-content: center;
          font-size: 9px; font-weight: 700; color: var(--accent);
        }

        /* ── Responsive ── */
        @media (max-width: 520px) {
          .fp-card { padding: 36px 24px; border-radius: 16px; }
          .fp-title { font-size: 24px; }
        }
      `}</style>

      <div className="fp-page" suppressHydrationWarning>
        <div className="fp-blob fp-blob-1" />
        <div className="fp-blob fp-blob-2" />

        <LanguageSwitcher locale={locale} page="forgot-password" />

        <div className="fp-card">
          {/* Brand mark */}
          <div className="fp-brand">
            <div className="fp-brand-icon">
              <SearchIcon />
            </div>
            <span className="fp-brand-name">{t("university")}</span>
          </div>

          {!submitted ? (
            /* ── Request form ── */
            <>
              <div className="fp-icon-wrap">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>

              <h1 className="fp-title">{t("title")}</h1>
              <p className="fp-subtitle">{t("subtitle")}</p>

              {generalError && <div className="alert alert-error">⚠ {generalError}</div>}

              <form onSubmit={handleSubmit} noValidate>
                <div className="form-group">
                  <label className="form-label" htmlFor="fp-email">{t("email.label")}</label>
                  <div className="input-wrap">
                    <span className="input-icon"><MailIcon /></span>
                    <input
                      id="fp-email"
                      type="email"
                      className={`input${emailError ? " error" : ""}`}
                      placeholder={t("email.placeholder")}
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(""); setGeneralError(""); }}
                      autoComplete="email"
                      disabled={isPending}
                      suppressHydrationWarning
                    />
                  </div>
                  {emailError && <p className="field-error">⚠ {emailError}</p>}
                </div>

                <button type="submit" className="submit-btn" disabled={isPending}>
                  {isPending ? <><span className="spinner" />{t("submitting")}</> : t("submit")}
                </button>
              </form>

              <Link href={`/${locale}/login`} className="back-link">
                <ArrowLeftIcon /> {t("backToLogin")}
              </Link>
            </>
          ) : (
            /* ── Success state ── */
            <div className="fp-success">
              <div className="fp-success-icon">
                <CheckCircleIcon />
              </div>
              <h2 className="fp-success-title">{t("successTitle")}</h2>
              <p className="fp-success-msg">
                {successMessage.split(email).map((part, i, arr) =>
                  i < arr.length - 1
                    ? <span key={i}>{part}<strong>{email}</strong></span>
                    : <span key={i}>{part}</span>
                )}
              </p>

              <button
                className="resend-btn"
                onClick={handleResend}
                disabled={countdown > 0 || isResending}
              >
                {isResending ? (
                  <><span className="spinner" style={{ borderColor: "rgba(79,142,247,0.3)", borderTopColor: "var(--accent)" }} />{t("resending")}</>
                ) : countdown > 0 ? (
                  <><div className="countdown-ring">{countdown}</div>{t("resendCooldown").replace("{seconds}", String(countdown))}</>
                ) : (
                  t("resend")
                )}
              </button>

              <Link href={`/${locale}/login`} className="back-link" style={{ marginTop: 20 }}>
                <ArrowLeftIcon /> {t("backToLogin")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
