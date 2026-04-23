"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { api, initAuth } from "@/lib/auth";
import styles from "./account.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type Year = "L1" | "L2" | "L3" | "M1" | "M2";
type Specialty = "glsi" | "bd" | "isr" | "cloud" | "cyber";
type AnnouncementStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "confirmed";
type AnnouncementType = "lost" | "found";

interface AccountData {
  firstName: string;
  lastName: string;
  email: string;
  year: Year | "";
  specialty: Specialty | "";
  userAvatar?: string;
  banned?: boolean;
  banExpiresAt?: string | null; // ISO date string or null for lifetime
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  newPassword?: string;
  general?: string;
}

interface ContactInfo {
  facebook?: string;
  instagram?: string;
  phone?: string;
  email?: string;
}

interface Announcement {
  id: string;
  type: AnnouncementType;
  category: string;
  description: string;
  status: AnnouncementStatus; // raw DB status (pending|accepted|rejected)
  displayStatus: AnnouncementStatus; // computed: cancelled/confirmed override accepted
  images?: string[];
  contact?: ContactInfo;
  createdAt: string;
  updatedAt: string;
}

interface MyAnnouncementsResponse {
  success: boolean;
  data: Announcement[];
  pagination?: { page: number; limit: number; total: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function avatarSrc(path: string): string {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("blob:")) return path;
  return `${API_URL}/${path.replace(/^\//, "")}`;
}

function imageSrc(path: string): string {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("blob:")) return path;
  return `${API_URL}/${path.replace(/^\//, "")}`;
}

function formatBanDate(isoString: string, locale: string): string {
  return new Date(isoString).toLocaleString(locale, {
    dateStyle: "long",
    timeStyle: "short",
  });
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

const BanIcon = () => (
  <svg
    width="22"
    height="22"
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

const ClockIcon = () => (
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
);

const CheckCircleIcon = () => (
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
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const XCircleIcon = () => (
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
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const ImageIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

// ─── Announcement Card Sub-component ──────────────────────────────────────────

function AnnouncementCard({
  ann,
  onCancel,
  onConfirm,
  onClose,
  actionLoading,
}: {
  ann: Announcement;
  onCancel?: (id: string) => void;
  onConfirm?: (id: string) => void;
  onClose?: (id: string) => void;
  actionLoading: string | null;
}) {
  const t = useTranslations("account");
  const tAnn = useTranslations("announcements");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const statusColor: Record<AnnouncementStatus, string> = {
    pending: styles.statusPending,
    accepted: styles.statusAccepted,
    rejected: styles.statusRejected,
    cancelled: styles.statusCancelled,
    confirmed: styles.statusConfirmed,
  };

  const isLoading = actionLoading === ann.id;
  // Use displayStatus for all UI decisions
  const ds = ann.displayStatus;

  return (
    <>
      {lightboxSrc && (
        <div className={styles.lightbox} onClick={() => setLightboxSrc(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt=""
            className={styles.lightboxImg}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className={styles.lightboxClose}
            onClick={() => setLightboxSrc(null)}
          >
            ×
          </button>
        </div>
      )}

      <div className={styles.annCard}>
        {/* Top row */}
        <div className={styles.annCardTop}>
          <div className={styles.annCardMeta}>
            <span
              className={`${styles.annTypeBadge} ${ann.type === "lost" ? styles.typeLost : styles.typeFound}`}
            >
              {tAnn(`types.${ann.type}`)}
            </span>
            <span className={`${styles.annStatusBadge} ${statusColor[ds]}`}>
              {t(`announcements.statuses.${ds}`)}
            </span>
            <span className={styles.annCategory}>
              {tAnn(`categories.${ann.category as keyof object}` as never)}
            </span>
          </div>
          <span className={styles.annDate}>
            <ClockIcon />
            {new Date(ann.createdAt).toLocaleDateString()}
          </span>
        </div>

        {/* Description */}
        <p className={styles.annDescription}>{ann.description}</p>

        {/* Images */}
        {ann.images && ann.images.length > 0 && (
          <div className={styles.annImages}>
            {ann.images.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={imageSrc(img)}
                alt={tAnn("post.imageAlt")}
                className={styles.annThumb}
                onClick={() => setLightboxSrc(imageSrc(img))}
              />
            ))}
          </div>
        )}

        {/* Contact info */}
        {ann.contact && Object.values(ann.contact).some(Boolean) && (
          <div className={styles.annContact}>
            {ann.contact.email && <span>✉ {ann.contact.email}</span>}
            {ann.contact.phone && <span>📞 {ann.contact.phone}</span>}
            {ann.contact.facebook && <span>fb: {ann.contact.facebook}</span>}
            {ann.contact.instagram && <span>ig: @{ann.contact.instagram}</span>}
          </div>
        )}

        {/* Actions — only show on non-terminal displayStatuses */}
        {(onCancel || onConfirm || onClose) && (
          <div className={styles.annActions}>
            {/* Cancel: allowed for pending and accepted (not yet cancelled/confirmed/rejected) */}
            {onCancel && (ds === "pending" || ds === "accepted") && (
              <button
                className={styles.annBtnDanger}
                onClick={() => onCancel(ann.id)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span
                    className={styles.spinner}
                    style={{
                      borderColor: "rgba(255,255,255,0.2)",
                      borderTopColor: "#fff",
                    }}
                  />
                ) : (
                  <XCircleIcon />
                )}
                {t("announcements.actions.cancel")}
              </button>
            )}
            {/* Confirm found: allowed for accepted only */}
            {onConfirm && ds === "accepted" && (
              <button
                className={styles.annBtnSuccess}
                onClick={() => onConfirm(ann.id)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span
                    className={styles.spinner}
                    style={{
                      borderColor: "rgba(17,17,17,0.2)",
                      borderTopColor: "#111",
                    }}
                  />
                ) : (
                  <CheckCircleIcon />
                )}
                {t("announcements.actions.confirmFound")}
              </button>
            )}
            {/* Close without found: allowed for accepted only */}
            {onClose && ds === "accepted" && (
              <button
                className={styles.annBtnSecondary}
                onClick={() => onClose(ann.id)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className={styles.spinner} />
                ) : (
                  <XCircleIcon />
                )}
                {t("announcements.actions.closeNotFound")}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const t = useTranslations("account");
  const locale = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth state
  const [authState, setAuthState] = useState<
    "loading" | "unauthenticated" | "authenticated"
  >("loading");

  // Ban state
  const [banned, setBanned] = useState(false);
  const [banExpiresAt, setBanExpiresAt] = useState<string | null>(null);

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

  // Announcements state
  const [myAnnouncements, setMyAnnouncements] = useState<Announcement[]>([]);
  const [annLoading, setAnnLoading] = useState(false);
  const [annActionLoading, setAnnActionLoading] = useState<string | null>(null);
  const [annTab, setAnnTab] = useState<"pending" | "active" | "history">(
    "pending",
  );

  // ── Confirm dialog state ──────────────────────────────────────────────────
  const [confirmDialog, setConfirmDialog] = useState<{
    id: string;
    action: "cancel" | "confirm" | "close";
  } | null>(null);

  // ── Auth check on mount ────────────────────────────────────────────────────
  useEffect(() => {
    initAuth().then((authenticated) => {
      if (authenticated) {
        setAuthState("authenticated");
        fetchAccount();
        fetchMyAnnouncements();
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
      if (d.userAvatar) setAvatarPreview(avatarSrc(d.userAvatar));
      if (d.banned) {
        setBanned(true);
        setBanExpiresAt(d.banExpiresAt ?? null);
      }
    } catch {
      // silent
    }
  }

  // ── Fetch my announcements ─────────────────────────────────────────────────
  async function fetchMyAnnouncements() {
    setAnnLoading(true);
    try {
      const { data } = await api.get<MyAnnouncementsResponse>(
        "/api/announcements/my",
      );
      setMyAnnouncements(data.data ?? []);
    } catch {
      // silent
    } finally {
      setAnnLoading(false);
    }
  }

  // ── Announcement actions ───────────────────────────────────────────────────
  async function handleCancelAnnouncement(id: string) {
    setConfirmDialog({ id, action: "cancel" });
  }

  async function handleConfirmAnnouncement(id: string) {
    setConfirmDialog({ id, action: "confirm" });
  }

  // "Close without found" = cancel an accepted announcement
  async function handleCloseNotFound(id: string) {
    setConfirmDialog({ id, action: "close" });
  }

  async function executeAction(
    id: string,
    action: "cancel" | "confirm" | "close",
  ) {
    setConfirmDialog(null);
    setAnnActionLoading(id);
    try {
      if (action === "confirm") {
        await api.patch(`/api/announcements/${id}/confirm`);
        setMyAnnouncements((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, displayStatus: "confirmed" } : a,
          ),
        );
      } else {
        // cancel & close both call /cancel
        await api.patch(`/api/announcements/${id}/cancel`);
        setMyAnnouncements((prev) =>
          prev.map((a) =>
            a.id === id ? { ...a, displayStatus: "cancelled" } : a,
          ),
        );
      }
    } catch {
      // silent
    } finally {
      setAnnActionLoading(null);
    }
  }

  // ── Derived announcement lists ─────────────────────────────────────────────
  const pendingAnns = myAnnouncements.filter(
    (a) => a.displayStatus === "pending",
  );
  const activeAnns = myAnnouncements.filter(
    (a) => a.displayStatus === "accepted",
  );
  const historyAnns = myAnnouncements.filter((a) =>
    ["rejected", "cancelled", "confirmed"].includes(a.displayStatus),
  );

  // ── Avatar upload ──────────────────────────────────────────────────────────
  function handleAvatarClick() {
    fileInputRef.current?.click();
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const { data } = await api.put<{ success: boolean; data: AccountData }>(
        "/api/account/picture",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      if (data.data.userAvatar) {
        setAvatarPreview(avatarSrc(data.data.userAvatar));
        setForm((f) => ({ ...f, userAvatar: data.data.userAvatar ?? "" }));
      }
    } catch {
      setErrors((e) => ({ ...e, general: t("errors.serverError") }));
    } finally {
      setAvatarUploading(false);
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
        const payload: Record<string, string | null> = {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          year: form.year || null,
          specialty: form.specialty || null,
        };
        if (form.currentPassword)
          payload.currentPassword = form.currentPassword;
        if (form.newPassword) payload.newPassword = form.newPassword;
        await api.put("/api/account/edit", payload);
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

  const initials =
    (form.firstName?.[0] ?? "") + (form.lastName?.[0] ?? "") || "?";

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await api.post("/api/auth/logout");
    } catch {
      // ignore
    } finally {
      setIsLoggingOut(false);
      window.location.href = `/${locale}/login`;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.pageWrap} suppressHydrationWarning>
      <div className={styles.pageBg} />

      {/* ── Confirm Action Dialog ────────────────────────────────────────── */}
      {confirmDialog && (
        <div className={styles.authOverlay} style={{ zIndex: 200 }}>
          <div className={styles.authModal}>
            <div className={styles.authModalIcon}>
              {confirmDialog.action === "confirm" ? (
                <CheckCircleIcon />
              ) : (
                <XCircleIcon />
              )}
            </div>
            <h2 className={styles.authModalTitle}>
              {t(`announcements.confirm.${confirmDialog.action}.title`)}
            </h2>
            <p className={styles.authModalDesc}>
              {t(`announcements.confirm.${confirmDialog.action}.description`)}
            </p>
            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
              <button
                className={styles.annBtnSecondary}
                onClick={() => setConfirmDialog(null)}
              >
                {t("announcements.confirm.cancelBtn")}
              </button>
              <button
                className={
                  confirmDialog.action === "confirm"
                    ? styles.annBtnSuccess
                    : styles.annBtnDanger
                }
                onClick={() =>
                  executeAction(confirmDialog.id, confirmDialog.action)
                }
              >
                {t("announcements.confirm.okBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Not authenticated modal ──────────────────────────────────────── */}
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

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {authState === "loading" && (
        <div className={styles.loadingWrap}>
          <div className={styles.loadingSpinner} />
          <span>{t("loading")}</span>
        </div>
      )}

      {/* ── Main card ────────────────────────────────────────────────────── */}
      {authState === "authenticated" && (
        <div className={styles.card}>
          {/* ── Ban Banner ─────────────────────────────────────────────── */}
          {banned && (
            <div className={styles.banBanner}>
              <div className={styles.banBannerIcon}>
                <BanIcon />
              </div>
              <div className={styles.banBannerContent}>
                <p className={styles.banBannerTitle}>
                  {banExpiresAt
                    ? t("ban.titleTemporary")
                    : t("ban.titleLifetime")}
                </p>
                <p className={styles.banBannerDesc}>
                  {banExpiresAt
                    ? t("ban.descriptionTemporary", {
                        date: formatBanDate(banExpiresAt, locale),
                      })
                    : t("ban.descriptionLifetime")}
                </p>
              </div>
            </div>
          )}

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

              {/* Personal info divider */}
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

              {/* Academic info divider */}
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

              {/* Password divider */}
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

          {/* ── My Announcements Section ──────────────────────────────── */}
          <div className={styles.annSection}>
            {/* Section header */}
            <div
              className={`${styles.sectionDivider} ${styles.annSectionHeader}`}
            >
              <span className={styles.sectionDividerLabel}>
                {t("announcements.title")}
              </span>
              <div className={styles.sectionDividerLine} />
            </div>

            {/* Tabs */}
            <div className={styles.annTabs}>
              <button
                className={`${styles.annTab} ${annTab === "pending" ? styles.annTabActive : ""}`}
                onClick={() => setAnnTab("pending")}
              >
                {t("announcements.tabs.pending")}
                {pendingAnns.length > 0 && (
                  <span className={styles.annTabCount}>
                    {pendingAnns.length}
                  </span>
                )}
              </button>
              <button
                className={`${styles.annTab} ${annTab === "active" ? styles.annTabActive : ""}`}
                onClick={() => setAnnTab("active")}
              >
                {t("announcements.tabs.active")}
                {activeAnns.length > 0 && (
                  <span className={styles.annTabCount}>
                    {activeAnns.length}
                  </span>
                )}
              </button>
              <button
                className={`${styles.annTab} ${annTab === "history" ? styles.annTabActive : ""}`}
                onClick={() => setAnnTab("history")}
              >
                {t("announcements.tabs.history")}
              </button>
            </div>

            {/* Tab content */}
            {annLoading ? (
              <div className={styles.annLoading}>
                <div className={styles.loadingSpinner} />
              </div>
            ) : (
              <div className={styles.annList}>
                {/* Pending */}
                {annTab === "pending" &&
                  (pendingAnns.length === 0 ? (
                    <div className={styles.annEmpty}>
                      <span className={styles.annEmptyIcon}>
                        <ClockIcon />
                      </span>
                      <p>{t("announcements.empty.pending")}</p>
                    </div>
                  ) : (
                    pendingAnns.map((ann) => (
                      <AnnouncementCard
                        key={ann.id}
                        ann={ann}
                        onCancel={handleCancelAnnouncement}
                        actionLoading={annActionLoading}
                      />
                    ))
                  ))}

                {/* Active */}
                {annTab === "active" &&
                  (activeAnns.length === 0 ? (
                    <div className={styles.annEmpty}>
                      <span className={styles.annEmptyIcon}>
                        <CheckCircleIcon />
                      </span>
                      <p>{t("announcements.empty.active")}</p>
                    </div>
                  ) : (
                    activeAnns.map((ann) => (
                      <AnnouncementCard
                        key={ann.id}
                        ann={ann}
                        onCancel={handleCancelAnnouncement}
                        onConfirm={handleConfirmAnnouncement}
                        onClose={handleCloseNotFound}
                        actionLoading={annActionLoading}
                      />
                    ))
                  ))}

                {/* History */}
                {annTab === "history" &&
                  (historyAnns.length === 0 ? (
                    <div className={styles.annEmpty}>
                      <span className={styles.annEmptyIcon}>
                        <ImageIcon />
                      </span>
                      <p>{t("announcements.empty.history")}</p>
                    </div>
                  ) : (
                    historyAnns.map((ann) => (
                      <AnnouncementCard
                        key={ann.id}
                        ann={ann}
                        actionLoading={annActionLoading}
                      />
                    ))
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
