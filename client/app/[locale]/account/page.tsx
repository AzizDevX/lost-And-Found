"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { api, initAuth } from "@/lib/auth";
import styles from "./account.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type Year = "L1" | "L2" | "L3" | "M1" | "M2";
type Specialty = "glsi" | "bd" | "isr" | "cloud" | "cyber";

interface AccountData {
  firstName: string;
  lastName: string;
  email: string;
  year: Year | "";
  specialty: Specialty | "";
  userAvatar?: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  newPassword?: string;
  general?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Turns a server-relative path into a full URL for <img> src */
function avatarSrc(path: string): string {
  if (!path) return "";
  // Already a full URL (e.g. blob: or http:)
  if (path.startsWith("http") || path.startsWith("blob:")) return path;
  return `${API_URL}/${path.replace(/^\//, "")}`;
}

// ─── Specialty options by year ────────────────────────────────────────────────

const EARLY_SPECIALTIES: Specialty[] = ["glsi", "isr", "bd"];
const LATE_SPECIALTIES: Specialty[] = ["cyber", "cloud"];
const LATE_YEARS: Year[] = ["M1", "M2"];

function getSpecialties(year: Year | ""): Specialty[] {
  if (!year) return [];
  return LATE_YEARS.includes(year as Year)
    ? LATE_SPECIALTIES
    : EARLY_SPECIALTIES;
}

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

const UserIcon = () => (
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
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const MailIcon = () => (
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
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const LockIcon = () => (
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
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const GraduationIcon = () => (
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
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
);

const CameraIcon = () => (
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
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
);

const AlertIcon = () => (
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

const LogoutIcon = () => (
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
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
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

const EyeIcon = ({ open }: { open: boolean }) =>
  open ? (
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
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
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
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

const SignInIcon = () => (
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
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <polyline points="10 17 15 12 10 7" />
    <line x1="15" y1="12" x2="3" y2="12" />
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const t = useTranslations("account");
  const locale = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth state
  const [authState, setAuthState] = useState<
    "loading" | "unauthenticated" | "authenticated"
  >("loading");

  // Form state
  const [form, setForm] = useState<
    AccountData & { currentPassword: string; newPassword: string }
  >({
    firstName: "",
    lastName: "",
    email: "",
    year: "",
    specialty: "",
    userAvatar: "",
    currentPassword: "",
    newPassword: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [successMsg, setSuccessMsg] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // ── Auth check on mount ────────────────────────────────────────────────────
  useEffect(() => {
    initAuth().then((authenticated) => {
      if (authenticated) {
        setAuthState("authenticated");
        fetchAccount();
      } else {
        setAuthState("unauthenticated");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch account data ─────────────────────────────────────────────────────
  async function fetchAccount() {
    try {
      const { data } = await api.get<{ success: true; data: AccountData }>(
        "/api/account/user",
      );
      const d = data.data;
      setForm((f) => ({
        ...f,
        firstName: d.firstName ?? "",
        lastName: d.lastName ?? "",
        email: d.email ?? "",
        year: d.year ?? "",
        specialty: d.specialty ?? "",
        userAvatar: d.userAvatar ?? "",
      }));
      // Prepend API base URL so the browser can load the image
      if (d.userAvatar) setAvatarPreview(avatarSrc(d.userAvatar));
    } catch {
      // silent — form stays empty
    }
  }

  // ── Avatar upload ──────────────────────────────────────────────────────────
  function handleAvatarClick() {
    fileInputRef.current?.click();
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local preview
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const { data } = await api.put<{ success: boolean; data: AccountData }>(
        "/api/account/picture",
        formData,
        // Let the browser set the correct multipart Content-Type with boundary
        { headers: { "Content-Type": "multipart/form-data" } },
      );

      // Update preview with the real server path
      if (data.data.userAvatar) {
        setAvatarPreview(avatarSrc(data.data.userAvatar));
        setForm((f) => ({ ...f, userAvatar: data.data.userAvatar ?? "" }));
      }
    } catch {
      setErrors((e) => ({ ...e, general: t("errors.serverError") }));
    } finally {
      setAvatarUploading(false);
      // Reset input so the same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validate(): boolean {
    const errs: FormErrors = {};

    if (!form.firstName.trim()) {
      errs.firstName = t("errors.firstNameRequired");
    } else if (form.firstName.trim().length < 2) {
      errs.firstName = t("errors.firstNameMinLength");
    }

    if (!form.lastName.trim()) {
      errs.lastName = t("errors.lastNameRequired");
    } else if (form.lastName.trim().length < 2) {
      errs.lastName = t("errors.lastNameMinLength");
    }

    if (!form.email.trim()) {
      errs.email = t("errors.emailRequired");
    } else if (
      !/^[a-z0-9._%+\-]+@ted-university\.com$/i.test(form.email.trim())
    ) {
      errs.email = t("errors.emailInvalid");
    }

    if (form.newPassword && form.newPassword.length < 6) {
      errs.newPassword = t("errors.passwordLength");
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setErrors({});
    setSuccessMsg("");

    startTransition(async () => {
      try {
        // Allow null so that an unselected dropdown clears the field in the DB
        const payload: Record<string, string | null> = {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          year: form.year || null, // "" → null (no selection)
          specialty: form.specialty || null, // "" → null (no selection)
        };

        if (form.currentPassword)
          payload.currentPassword = form.currentPassword;
        if (form.newPassword) payload.newPassword = form.newPassword;
        // userAvatar is handled separately via /api/account/picture — not sent here

        await api.put("/api/account/edit", payload); // PUT, not PATCH
        setSuccessMsg(t("success"));
        setForm((f) => ({ ...f, currentPassword: "", newPassword: "" }));
      } catch {
        setErrors({ general: t("errors.serverError") });
      }
    });
  }

  // ── Field helpers ──────────────────────────────────────────────────────────
  function setField<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
    if (successMsg) setSuccessMsg("");
  }

  // When year changes, reset specialty if incompatible
  function handleYearChange(year: Year | "") {
    const validSpecialties = getSpecialties(year);
    setForm((f) => ({
      ...f,
      year,
      specialty: validSpecialties.includes(f.specialty as Specialty)
        ? f.specialty
        : "",
    }));
  }

  // ── Initials for avatar placeholder ───────────────────────────────────────
  const initials =
    (form.firstName?.[0] ?? "") + (form.lastName?.[0] ?? "") || "?";

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await api.post("/api/auth/logout");
    } catch {
      // even if it fails, redirect anyway
    } finally {
      setIsLoggingOut(false);
      window.location.href = `/${locale}/login`;
    }
  }
  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.pageWrap} suppressHydrationWarning>
      <div className={styles.pageBg} />

      {/* ── Not authenticated modal ────────────────────────────────────────── */}
      {authState === "unauthenticated" && (
        <div className={styles.authOverlay}>
          <div className={styles.authModal}>
            <div className={styles.authModalIcon}>
              <LockIcon />
            </div>
            <h2 className={styles.authModalTitle}>{t("auth.title")}</h2>
            <p className={styles.authModalDesc}>{t("auth.description")}</p>
            <Link href={`/${locale}/login`} className={styles.authModalBtn}>
              <SignInIcon />
              {t("auth.cta")}
            </Link>
          </div>
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {authState === "loading" && (
        <div className={styles.loadingWrap}>
          <div className={styles.loadingSpinner} />
          <span>{t("loading")}</span>
        </div>
      )}

      {/* ── Main card ─────────────────────────────────────────────────────── */}
      {authState === "authenticated" && (
        <div className={styles.card}>
          {/* Header */}
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderRow}>
              <div>
                <p className={styles.cardEyebrow}>{t("eyebrow")}</p>
                <h1 className={styles.cardTitle}>{t("title")}</h1>
                <p className={styles.cardSubtitle}>{t("subtitle")}</p>
              </div>
              <button
                type="button"
                className={styles.logoutBtn}
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <span
                    className={styles.spinner}
                    style={{
                      borderColor: "rgba(255,255,255,0.25)",
                      borderTopColor: "#fff",
                    }}
                  />
                ) : (
                  <LogoutIcon />
                )}
                {isLoggingOut ? t("loggingOut") : t("logout")}
              </button>
            </div>
          </div>

          {/* Avatar */}
          <div className={styles.avatarSection}>
            <div
              className={styles.avatarWrap}
              onClick={handleAvatarClick}
              title={t("avatar.change")}
            >
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview}
                  alt={t("avatar.alt")}
                  className={styles.avatarImg}
                />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {initials.toUpperCase()}
                </div>
              )}

              {avatarUploading ? (
                <div className={styles.avatarUploading}>
                  <div className={styles.loadingSpinner} />
                </div>
              ) : (
                <div className={styles.avatarOverlay}>
                  <CameraIcon />
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleAvatarChange}
              />
            </div>

            <div className={styles.avatarInfo}>
              <h3>
                {form.firstName || form.lastName
                  ? `${form.firstName} ${form.lastName}`.trim()
                  : t("avatar.namePlaceholder")}
              </h3>
              <p>{form.email || t("avatar.emailPlaceholder")}</p>
              <p className={styles.avatarHint}>{t("avatar.hint")}</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.formGrid}>
              {/* Global alerts */}
              {errors.general && (
                <div
                  className={`${styles.alert} ${styles.alertError}`}
                  role="alert"
                >
                  <AlertIcon />
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

              {/* ── Personal info divider ────────────────────────────────── */}
              <div
                className={`${styles.sectionDivider} ${styles.formGridFull}`}
              >
                <span className={styles.sectionDividerLabel}>
                  {t("sections.personal")}
                </span>
                <div className={styles.sectionDividerLine} />
              </div>

              {/* First name */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="firstName">
                  {t("fields.firstName.label")}
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}>
                    <UserIcon />
                  </span>
                  <input
                    id="firstName"
                    type="text"
                    className={`${styles.input}${errors.firstName ? ` ${styles.inputError}` : ""}`}
                    placeholder={t("fields.firstName.placeholder")}
                    value={form.firstName}
                    onChange={(e) => setField("firstName", e.target.value)}
                    disabled={isPending}
                    suppressHydrationWarning
                  />
                </div>
                {errors.firstName && (
                  <p className={styles.fieldError}>{errors.firstName}</p>
                )}
              </div>

              {/* Last name */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="lastName">
                  {t("fields.lastName.label")}
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}>
                    <UserIcon />
                  </span>
                  <input
                    id="lastName"
                    type="text"
                    className={`${styles.input}${errors.lastName ? ` ${styles.inputError}` : ""}`}
                    placeholder={t("fields.lastName.placeholder")}
                    value={form.lastName}
                    onChange={(e) => setField("lastName", e.target.value)}
                    disabled={isPending}
                    suppressHydrationWarning
                  />
                </div>
                {errors.lastName && (
                  <p className={styles.fieldError}>{errors.lastName}</p>
                )}
              </div>

              {/* Email */}
              <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                <label className={styles.formLabel} htmlFor="email">
                  {t("fields.email.label")}
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}>
                    <MailIcon />
                  </span>
                  <input
                    id="email"
                    type="email"
                    className={`${styles.input}${errors.email ? ` ${styles.inputError}` : ""}`}
                    placeholder={t("fields.email.placeholder")}
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    disabled={isPending}
                    suppressHydrationWarning
                  />
                </div>
                {errors.email && (
                  <p className={styles.fieldError}>{errors.email}</p>
                )}
              </div>

              {/* ── Academic info divider ────────────────────────────────── */}
              <div
                className={`${styles.sectionDivider} ${styles.formGridFull}`}
              >
                <span className={styles.sectionDividerLabel}>
                  {t("sections.academic")}
                </span>
                <div className={styles.sectionDividerLine} />
              </div>

              {/* Year */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="year">
                  {t("fields.year.label")}
                  <span className={styles.optionalBadge}>{t("optional")}</span>
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}>
                    <GraduationIcon />
                  </span>
                  <select
                    id="year"
                    className={styles.select}
                    value={form.year}
                    onChange={(e) =>
                      handleYearChange(e.target.value as Year | "")
                    }
                    disabled={isPending}
                  >
                    <option value="">{t("fields.year.placeholder")}</option>
                    {(["L1", "L2", "L3", "M1", "M2"] as Year[]).map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <span className={styles.selectArrow}>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </div>
              </div>

              {/* Specialty */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="specialty">
                  {t("fields.specialty.label")}
                  <span className={styles.optionalBadge}>{t("optional")}</span>
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}>
                    <GraduationIcon />
                  </span>
                  <select
                    id="specialty"
                    className={styles.select}
                    value={form.specialty}
                    onChange={(e) =>
                      setField("specialty", e.target.value as Specialty | "")
                    }
                    disabled={isPending || !form.year}
                  >
                    <option value="">
                      {t("fields.specialty.placeholder")}
                    </option>
                    {getSpecialties(form.year).map((s) => (
                      <option key={s} value={s}>
                        {s.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <span className={styles.selectArrow}>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </div>
              </div>

              {/* ── Password divider ─────────────────────────────────────── */}
              <div
                className={`${styles.sectionDivider} ${styles.formGridFull}`}
              >
                <span className={styles.sectionDividerLabel}>
                  {t("sections.password")}
                </span>
                <div className={styles.sectionDividerLine} />
              </div>

              {/* Current password */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="currentPassword">
                  {t("fields.currentPassword.label")}
                  <span className={styles.optionalBadge}>{t("optional")}</span>
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}>
                    <LockIcon />
                  </span>
                  <input
                    id="currentPassword"
                    type={showCurrentPwd ? "text" : "password"}
                    className={styles.input}
                    placeholder={t("fields.currentPassword.placeholder")}
                    value={form.currentPassword}
                    onChange={(e) =>
                      setField("currentPassword", e.target.value)
                    }
                    disabled={isPending}
                    style={{ paddingRight: "44px" }}
                    suppressHydrationWarning
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowCurrentPwd((v) => !v)}
                    tabIndex={-1}
                  >
                    <EyeIcon open={showCurrentPwd} />
                  </button>
                </div>
              </div>

              {/* New password */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="newPassword">
                  {t("fields.newPassword.label")}
                  <span className={styles.optionalBadge}>{t("optional")}</span>
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}>
                    <LockIcon />
                  </span>
                  <input
                    id="newPassword"
                    type={showNewPwd ? "text" : "password"}
                    className={`${styles.input}${errors.newPassword ? ` ${styles.inputError}` : ""}`}
                    placeholder={t("fields.newPassword.placeholder")}
                    value={form.newPassword}
                    onChange={(e) => setField("newPassword", e.target.value)}
                    disabled={isPending}
                    style={{ paddingRight: "44px" }}
                    suppressHydrationWarning
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowNewPwd((v) => !v)}
                    tabIndex={-1}
                  >
                    <EyeIcon open={showNewPwd} />
                  </button>
                </div>
                {errors.newPassword && (
                  <p className={styles.fieldError}>{errors.newPassword}</p>
                )}
              </div>

              {/* Submit */}
              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={isPending}
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
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
