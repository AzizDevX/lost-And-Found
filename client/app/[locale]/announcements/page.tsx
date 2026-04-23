"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { api, initAuth } from "@/lib/auth";
import styles from "./announcements.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type PostType = "lost" | "found";
type FilterType = "all" | PostType;

type Category =
  | "electronics"
  | "clothing"
  | "bags"
  | "keys"
  | "documents"
  | "jewelry"
  | "books"
  | "sports"
  | "other";

interface ContactInfo {
  facebook?: string;
  instagram?: string;
  phone?: string;
  email?: string;
}

interface Post {
  _id: string;
  type: PostType;
  category: Category;
  description: string;
  images?: string[];
  image?: string;
  contact: ContactInfo;
  author: {
    firstName: string;
    lastName: string;
    userAvatar?: string;
  };
  createdAt: string;
}

interface FormErrors {
  description?: string;
  category?: string;
  images?: string;
  contact?: string;
  contactEmail?: string;
  phone?: string;
  general?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: Category }[] = [
  { value: "electronics" },
  { value: "clothing" },
  { value: "bags" },
  { value: "keys" },
  { value: "documents" },
  { value: "jewelry" },
  { value: "books" },
  { value: "sports" },
  { value: "other" },
];

// Category SVG icons — no emojis
const CATEGORY_ICONS: Record<Category, JSX.Element> = {
  electronics: (
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
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  clothing: (
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
      <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z" />
    </svg>
  ),
  bags: (
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
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  ),
  keys: (
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
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  ),
  documents: (
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
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  jewelry: (
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
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  books: (
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
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  ),
  sports: (
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
      <path d="M4.93 4.93l4.24 4.24m5.66 5.66l4.24 4.24M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24" />
    </svg>
  ),
  other: (
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
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
};

// ─── Tunisian phone validation ─────────────────────────────────────────────────

function validateTunisianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-().]/g, "");
  let digits = cleaned;
  if (cleaned.startsWith("+216")) digits = cleaned.slice(4);
  else if (cleaned.startsWith("00216")) digits = cleaned.slice(5);

  if (digits.length !== 8) return false;
  if (!/^[234579]/.test(digits)) return false;
  if (/^(.)\1{7}$/.test(digits)) return false; // reject 00000000, 11111111, etc.
  if (!/^\d{8}$/.test(digits)) return false;
  return true;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const LockIcon = () => (
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
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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
const SearchIcon = () => (
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
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const ImageIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);
const XIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const AlertIcon = () => (
  <svg
    width="14"
    height="14"
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
    width="14"
    height="14"
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
const FacebookIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);
const InstagramIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);
const PhoneIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);
const MailIcon = () => (
  <svg
    width="12"
    height="12"
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
const TagIcon = () => (
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
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);
const SendIcon = () => (
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
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const MegaphoneIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 11l19-9-9 19-2-8-8-2z" />
  </svg>
);
const PlusIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string, locale: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return locale === "fr" ? "À l'instant" : "Just now";
  if (diff < 3600)
    return `${Math.floor(diff / 60)}${locale === "fr" ? " min" : "m"}`;
  if (diff < 86400)
    return `${Math.floor(diff / 3600)}${locale === "fr" ? " h" : "h"}`;
  return `${Math.floor(diff / 86400)}${locale === "fr" ? " j" : "d"}`;
}

// ─── Image Carousel ──────────────────────────────────────────────────────────

function ImageCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [idx, setIdx] = useState(0);
  if (!images || images.length === 0) return null;
  if (images.length === 1) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={images[0]} alt={alt} className={styles.postImage} />;
  }
  return (
    <div className={styles.carousel}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[idx]}
        alt={`${alt} ${idx + 1}`}
        className={styles.postImage}
      />
      <button
        className={`${styles.carouselBtn} ${styles.carouselBtnPrev}`}
        onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
        aria-label="Previous"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button
        className={`${styles.carouselBtn} ${styles.carouselBtnNext}`}
        onClick={() => setIdx((i) => (i + 1) % images.length)}
        aria-label="Next"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      <div className={styles.carouselDots}>
        {images.map((_, i) => (
          <button
            key={i}
            className={`${styles.carouselDot} ${i === idx ? styles.carouselDotActive : ""}`}
            onClick={() => setIdx(i)}
            aria-label={`Photo ${i + 1}`}
          />
        ))}
      </div>
      <div className={styles.carouselCounter}>
        {idx + 1} / {images.length}
      </div>
    </div>
  );
}

function SkeletonPost() {
  return (
    <div className={styles.skeletonCard}>
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          marginBottom: "14px",
        }}
      >
        <div
          className={styles.skeletonLine}
          style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }}
        />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div
            className={styles.skeletonLine}
            style={{ height: 12, width: "40%" }}
          />
          <div
            className={styles.skeletonLine}
            style={{ height: 10, width: "25%" }}
          />
        </div>
      </div>
      <div
        className={styles.skeletonLine}
        style={{
          height: 160,
          width: "100%",
          borderRadius: 8,
          marginBottom: 12,
        }}
      />
      <div
        className={styles.skeletonLine}
        style={{ height: 12, width: "90%", marginBottom: 8 }}
      />
      <div
        className={styles.skeletonLine}
        style={{ height: 12, width: "70%" }}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AnnouncementsPage() {
  const t = useTranslations("announcements");
  const locale = useLocale();
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Auth
  const [authState, setAuthState] = useState<
    "loading" | "unauthenticated" | "authenticated"
  >("loading");
  const [currentUser, setCurrentUser] = useState<{
    firstName: string;
    lastName: string;
    userAvatar?: string;
  } | null>(null);

  // Posts
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  // Filters
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");

  // Compose state
  const [composeOpen, setComposeOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [postType, setPostType] = useState<PostType>("lost");
  const [form, setForm] = useState({
    description: "",
    category: "" as Category | "",
    facebook: "",
    instagram: "",
    phone: "",
    email: "",
  });
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [successMsg, setSuccessMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  // ── Auth + user fetch ──────────────────────────────────────────────────────
  useEffect(() => {
    initAuth().then(async (authenticated) => {
      if (authenticated) {
        setAuthState("authenticated");
        try {
          const { data } = await api.get<{
            success: true;
            data: { firstName: string; lastName: string; userAvatar?: string };
          }>("/api/account/user");
          setCurrentUser(data.data);
        } catch {
          /* silent */
        }
      } else {
        setAuthState("unauthenticated");
      }
    });
  }, []);

  // ── Fetch posts — available to all, including guests ───────────────────────
  const fetchPosts = useCallback(async () => {
    setPostsLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (search.trim()) params.set("search", search.trim());

      const { data } = await api.get<{ success: true; data: Post[] }>(
        `/api/announcements?${params.toString()}`,
      );
      setPosts(data.data ?? []);
    } catch {
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, [typeFilter, categoryFilter, search]);

  useEffect(() => {
    // Always fetch — guests can view, only posting is gated
    fetchPosts();
  }, [fetchPosts]);

  // ── Multiple image upload (up to 5) ───────────────────────────────────────
  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const remaining = 5 - imagePreviews.length;
    const toProcess = files.slice(0, remaining);

    setImageFiles((prev) => [...prev, ...toProcess]);

    toProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = reader.result as string;
        setImagePreviews((prev) => [...prev, b64]);
        setErrors((er) => ({ ...er, images: undefined }));
      };
      reader.readAsDataURL(file);
    });

    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function removeImage(index: number) {
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Phone validation helper ────────────────────────────────────────────────
  function getPhoneError(phone: string): string | undefined {
    if (!phone) return undefined;
    if (!validateTunisianPhone(phone)) {
      return locale === "fr"
        ? "Numéro invalide. Format tunisien requis (ex: 20 123 456)"
        : "Invalid number. Tunisian format required (e.g. 20 123 456)";
    }
    return undefined;
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validate(): boolean {
    const errs: FormErrors = {};

    // Description
    const desc = form.description.trim();
    if (!desc) {
      errs.description = t("errors.descriptionRequired");
    } else if (desc.length < 10) {
      errs.description = t("errors.descriptionMinLength");
    }

    // Category
    if (!form.category) errs.category = t("errors.categoryRequired");

    // Image
    if (imagePreviews.length === 0) errs.images = t("errors.imageRequired");

    // Contact — at least one required
    const hasContact =
      form.facebook.trim() ||
      form.instagram.trim() ||
      form.phone.trim() ||
      form.email.trim();
    if (!hasContact) errs.contact = t("errors.contactRequired");

    // Phone format
    if (form.phone.trim()) {
      const phoneErr = getPhoneError(form.phone);
      if (phoneErr) errs.phone = phoneErr;
    }

    // Email format (if filled)
    if (form.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) {
        errs.contactEmail = t("errors.contactEmailInvalid");
      }
    }

    // Facebook username — no spaces, no full URLs
    if (form.facebook.trim()) {
      const fb = form.facebook.trim();
      if (/\s/.test(fb) || fb.includes("facebook.com")) {
        errs.contact = t("errors.usernameInvalid");
      }
    }

    // Instagram username — no spaces, no full URLs
    if (form.instagram.trim()) {
      const ig = form.instagram.trim();
      if (/\s/.test(ig) || ig.includes("instagram.com")) {
        errs.contact = t("errors.usernameInvalid");
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Submit post ────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setErrors({});
    setSuccessMsg("");
    setConfirmOpen(true);
  }

  function handleConfirmSubmit() {
    setConfirmOpen(false);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("type", postType);
        formData.append("category", form.category);
        formData.append("description", form.description.trim());

        if (form.facebook)
          formData.append("contact[facebook]", form.facebook.trim());
        if (form.instagram)
          formData.append("contact[instagram]", form.instagram.trim());
        if (form.phone) formData.append("contact[phone]", form.phone.trim());
        if (form.email) formData.append("contact[email]", form.email.trim());

        imageFiles.forEach((file) => formData.append("images", file));

        await api.post("/api/announcement", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        setSuccessMsg(t("pendingApproval"));
        setForm({
          description: "",
          category: "",
          facebook: "",
          instagram: "",
          phone: "",
          email: "",
        });
        setImagePreviews([]);
        setImageFiles([]);
        setComposeOpen(false);
        fetchPosts();
      } catch (err: unknown) {
        // ── Extract the server's error code + message ──────────────────────
        const resp = (
          err as { response?: { data?: { error?: string; message?: string } } }
        )?.response?.data;
        const code = resp?.error ?? "";
        const message = resp?.message ?? t("errors.serverError");

        // ── Route the message to the right field so the user sees it inline ─
        if (code === "USER_BANNED") {
          setErrors({ general: message });
        } else if (code === "VALIDATION_ERROR") {
          // Map Joi field hints to the right FormErrors slot
          const msg = message.toLowerCase();
          if (msg.includes("description")) {
            setErrors({ description: message });
          } else if (msg.includes("category")) {
            setErrors({ category: message });
          } else if (msg.includes("image")) {
            setErrors({ images: message });
          } else if (msg.includes("phone")) {
            setErrors({ phone: message });
          } else if (msg.includes("email")) {
            setErrors({ contact: message });
          } else if (msg.includes("contact")) {
            setErrors({ contact: message });
          } else {
            setErrors({ general: message });
          }
        } else if (
          code === "FILE_TOO_LARGE" ||
          code === "TOO_MANY_FILES" ||
          code === "INVALID_FILE_TYPE" ||
          code === "UPLOAD_ERROR"
        ) {
          setErrors({ images: message });
        } else {
          // Fallback: show the server message verbatim rather than the generic one
          setErrors({ general: message });
        }
      }
    });
  }

  function handleCancel() {
    setComposeOpen(false);
    setForm({
      description: "",
      category: "",
      facebook: "",
      instagram: "",
      phone: "",
      email: "",
    });
    setImagePreviews([]);
    setImageFiles([]);
    setErrors({});
    setSuccessMsg("");
  }

  function setField<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  // ── Category count helpers ─────────────────────────────────────────────────
  function countForCategory(cat: Category | "all"): number {
    if (cat === "all") return posts.length;
    return posts.filter((p) => p.category === cat).length;
  }

  // ── Initials ───────────────────────────────────────────────────────────────
  const userInitials = currentUser
    ? (
        (currentUser.firstName?.[0] ?? "") + (currentUser.lastName?.[0] ?? "")
      ).toUpperCase() || "?"
    : "?";

  const postInitials = (p: Post) =>
    (
      (p.author.firstName?.[0] ?? "") + (p.author.lastName?.[0] ?? "")
    ).toUpperCase() || "?";

  // ── Avatar URL helper ──────────────────────────────────────────────────────
  function avatarUrl(path: string | undefined): string | undefined {
    if (!path) return undefined;
    if (path.startsWith("http")) return path;
    return `${process.env.NEXT_PUBLIC_API_URL}/${path}`;
  }

  // ── Announcement image URL helper ──────────────────────────────────────────
  function imageUrl(path: string): string {
    if (!path) return "";
    if (
      path.startsWith("http") ||
      path.startsWith("blob:") ||
      path.startsWith("data:")
    )
      return path;
    const clean = path.startsWith("/") ? path.slice(1) : path;
    return `${process.env.NEXT_PUBLIC_API_URL}/${clean}`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.pageWrap} suppressHydrationWarning>
      <div className={styles.layout}>
        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className={styles.pageHeader}>
          <p className={styles.pageEyebrow}>{t("eyebrow")}</p>
          <h1 className={styles.pageTitle}>{t("title")}</h1>
          <p className={styles.pageSubtitle}>{t("subtitle")}</p>
        </div>

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className={styles.sidebar}>
          {/* Type filter */}
          <div className={styles.sideCard}>
            <p className={styles.sideCardTitle}>{t("filters.type")}</p>
            <div className={styles.typeFilter}>
              {(["all", "lost", "found"] as FilterType[]).map((type) => (
                <button
                  key={type}
                  className={`${styles.typeBtn} ${typeFilter === type ? styles.typeBtnActive : ""}`}
                  onClick={() => setTypeFilter(type)}
                >
                  {t(`filters.${type}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Category filter — no emojis */}
          <div className={styles.sideCard}>
            <p className={styles.sideCardTitle}>{t("filters.category")}</p>
            <div className={styles.filterList}>
              <button
                className={`${styles.filterBtn} ${categoryFilter === "all" ? styles.filterBtnActive : ""}`}
                onClick={() => setCategoryFilter("all")}
              >
                <span className={styles.filterIconSvg}>
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
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                </span>
                {t("filters.allCategories")}
                <span className={styles.filterCount}>{posts.length}</span>
              </button>
              {CATEGORIES.map(({ value }) => (
                <button
                  key={value}
                  className={`${styles.filterBtn} ${categoryFilter === value ? styles.filterBtnActive : ""}`}
                  onClick={() => setCategoryFilter(value)}
                >
                  <span className={styles.filterIconSvg}>
                    {CATEGORY_ICONS[value]}
                  </span>
                  {t(`categories.${value}`)}
                  <span className={styles.filterCount}>
                    {countForCategory(value)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Feed ────────────────────────────────────────────────────────── */}
        <div className={styles.feed}>
          {/* Search */}
          <div className={styles.searchBar}>
            <span className={styles.searchIcon}>
              <SearchIcon />
            </span>
            <input
              className={styles.searchInput}
              placeholder={t("search.placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Confirmation Modal */}
          {confirmOpen && (
            <div className={styles.modalOverlay}>
              <div className={styles.modalCard}>
                <h3 className={styles.modalTitle}>{t("confirm.title")}</h3>
                <p className={styles.modalDesc}>{t("confirm.description")}</p>
                <div className={styles.modalRow}>
                  <span className={styles.modalLabel}>{t("confirm.type")}</span>
                  <span
                    className={
                      postType === "lost" ? styles.badgeLost : styles.badgeFound
                    }
                  >
                    {t(`types.${postType}`)}
                  </span>
                </div>
                {form.category && (
                  <div className={styles.modalRow}>
                    <span className={styles.modalLabel}>
                      {t("confirm.category")}
                    </span>
                    <span className={styles.modalValue}>
                      {t(`categories.${form.category as Category}`)}
                    </span>
                  </div>
                )}
                <div className={styles.modalRow}>
                  <span className={styles.modalLabel}>
                    {t("confirm.description_label")}
                  </span>
                  <span className={styles.modalValue}>{form.description}</span>
                </div>
                {imagePreviews.length > 0 && (
                  <div className={styles.modalRow}>
                    <span className={styles.modalLabel}>
                      {t("confirm.image")}
                    </span>
                    <span className={styles.modalValue}>
                      {t("confirm.imageAttached").replace(
                        "[[count]]",
                        String(imagePreviews.length),
                      )}
                    </span>
                  </div>
                )}
                <div className={styles.modalActions}>
                  <button
                    className={styles.cancelBtn}
                    onClick={() => setConfirmOpen(false)}
                  >
                    {t("confirm.cancel")}
                  </button>
                  <button
                    className={styles.submitBtn}
                    onClick={handleConfirmSubmit}
                  >
                    <SendIcon />
                    {t("confirm.submit")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Post-submit success banner */}
          {successMsg && !composeOpen && (
            <div
              className={`${styles.alert} ${styles.alertSuccess}`}
              role="status"
            >
              <OkIcon />
              {successMsg}
            </div>
          )}

          {/* Compose box */}
          <div className={styles.composeBox}>
            <div className={styles.composeHeader}>
              {/* Avatar */}
              <div className={styles.composeAvatar}>
                {authState === "authenticated" && currentUser?.userAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl(currentUser.userAvatar)!}
                    alt=""
                    className={styles.composeAvatarImg}
                  />
                ) : authState === "authenticated" ? (
                  userInitials
                ) : (
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
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}
              </div>

              {/* Prompt — authenticated: guided text; guest: sign-in button */}
              {!composeOpen && (
                <>
                  {authState === "authenticated" ? (
                    <span className={styles.composePrompt}>
                      {postType === "lost" || postType === "found"
                        ? t("compose.guidedPrompt")
                        : t("compose.guidedPrompt")}
                    </span>
                  ) : (
                    <Link
                      href={`/${locale}/login`}
                      className={styles.composeSignInBtn}
                    >
                      <SignInIcon />
                      {t("compose.signInToPost")}
                    </Link>
                  )}
                </>
              )}
              {composeOpen && authState === "authenticated" && (
                <span className={styles.composePromptActive}>
                  {t("compose.guidedActive")
                    .replace("[[name]]", currentUser?.firstName ?? "")
                    .replace("[[type]]", t(`types.${postType}`))}
                </span>
              )}

              {/* Type toggle — only shown when authenticated and compose is not open */}
              {authState === "authenticated" && !composeOpen && (
                <div className={styles.composeTypeToggle}>
                  <button
                    className={`${styles.composeTypeBtn} ${postType === "lost" ? styles.composeTypeBtnActiveLost : ""}`}
                    onClick={() => {
                      setPostType("lost");
                      setComposeOpen(true);
                    }}
                  >
                    {t("compose.typeLost")}
                  </button>
                  <button
                    className={`${styles.composeTypeBtn} ${postType === "found" ? styles.composeTypeBtnActiveFound : ""}`}
                    onClick={() => {
                      setPostType("found");
                      setComposeOpen(true);
                    }}
                  >
                    {t("compose.typeFound")}
                  </button>
                </div>
              )}
            </div>

            {/* Full compose form — only when authenticated */}
            {composeOpen && authState === "authenticated" && (
              <form onSubmit={handleSubmit} noValidate>
                <div className={styles.composeForm}>
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

                  {/* Description */}
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      {t("compose.description.label")}
                    </label>
                    <textarea
                      className={`${styles.textarea}${errors.description ? ` ${styles.inputError}` : ""}`}
                      placeholder={
                        postType === "lost"
                          ? t("compose.description.placeholderLost")
                          : t("compose.description.placeholderFound")
                      }
                      value={form.description}
                      onChange={(e) => setField("description", e.target.value)}
                      disabled={isPending}
                      rows={3}
                    />
                    <div className={styles.descFooter}>
                      {errors.description ? (
                        <p className={styles.fieldError}>
                          {errors.description}
                        </p>
                      ) : (
                        <span />
                      )}
                      <span
                        className={`${styles.charCount} ${
                          form.description.trim().length < 10
                            ? styles.charCountWarn
                            : styles.charCountOk
                        }`}
                      >
                        {form.description.trim().length}/10
                      </span>
                    </div>
                  </div>

                  {/* Category + Multi-Image row */}
                  <div className={styles.composeFormRow}>
                    {/* Category — no emojis */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        {t("compose.category.label")}
                      </label>
                      <div className={styles.inputWrap}>
                        <span className={styles.inputIcon}>
                          <TagIcon />
                        </span>
                        <select
                          className={`${styles.select}${errors.category ? ` ${styles.inputError}` : ""}`}
                          value={form.category}
                          onChange={(e) =>
                            setField(
                              "category",
                              e.target.value as Category | "",
                            )
                          }
                          disabled={isPending}
                        >
                          <option value="">
                            {t("compose.category.placeholder")}
                          </option>
                          {CATEGORIES.map(({ value }) => (
                            <option key={value} value={value}>
                              {t(`categories.${value}`)}
                            </option>
                          ))}
                        </select>
                        <span className={styles.selectArrow}>
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </span>
                      </div>
                      {errors.category && (
                        <p className={styles.fieldError}>{errors.category}</p>
                      )}
                    </div>

                    {/* Multi-photo upload */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        {t("compose.image.label")}
                        {imagePreviews.length > 0 && (
                          <span className={styles.imageCount}>
                            {" "}
                            · {imagePreviews.length}/5
                          </span>
                        )}
                      </label>

                      {imagePreviews.length > 0 ? (
                        <div className={styles.imageThumbnailStrip}>
                          {imagePreviews.map((src, i) => (
                            <div key={i} className={styles.imageThumbnailWrap}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={src}
                                alt=""
                                className={styles.imageThumbnail}
                              />
                              <button
                                type="button"
                                className={styles.imageRemoveBtn}
                                onClick={() => removeImage(i)}
                                disabled={isPending}
                              >
                                <XIcon />
                              </button>
                            </div>
                          ))}
                          {imagePreviews.length < 5 && (
                            <button
                              type="button"
                              className={styles.addMoreImagesBtn}
                              onClick={() => imageInputRef.current?.click()}
                              disabled={isPending}
                            >
                              <PlusIcon />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div
                          className={`${styles.imageUploadArea}${errors.images ? ` ${styles.imageUploadAreaError}` : ""}`}
                          onClick={() => imageInputRef.current?.click()}
                        >
                          <div className={styles.uploadIcon}>
                            <ImageIcon />
                          </div>
                          <p className={styles.uploadText}>
                            <span className={styles.uploadTextAccent}>
                              {t("compose.image.click")}
                            </span>{" "}
                            {t("compose.image.or")}
                          </p>
                          <p className={styles.uploadSubtext}>
                            {t("compose.image.hint")}
                          </p>
                        </div>
                      )}

                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: "none" }}
                        onChange={handleImageChange}
                      />
                      {errors.images && (
                        <p className={styles.fieldError}>{errors.images}</p>
                      )}
                    </div>
                  </div>

                  {/* Contact info */}
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      {t("compose.contact.label")}
                    </label>
                    {errors.contact && (
                      <p className={styles.fieldError}>{errors.contact}</p>
                    )}
                  </div>

                  <div className={styles.composeFormRow}>
                    {/* Facebook */}
                    <div className={styles.formGroup}>
                      <div className={styles.inputWrap}>
                        <span className={styles.inputIcon}>
                          <FacebookIcon />
                        </span>
                        <input
                          type="text"
                          className={styles.input}
                          placeholder={t("compose.contact.facebook")}
                          value={form.facebook}
                          onChange={(e) => {
                            setField("facebook", e.target.value);
                            setErrors((er) => ({ ...er, contact: undefined }));
                          }}
                          disabled={isPending}
                        />
                      </div>
                    </div>
                    {/* Instagram */}
                    <div className={styles.formGroup}>
                      <div className={styles.inputWrap}>
                        <span className={styles.inputIcon}>
                          <InstagramIcon />
                        </span>
                        <input
                          type="text"
                          className={styles.input}
                          placeholder={t("compose.contact.instagram")}
                          value={form.instagram}
                          onChange={(e) => {
                            setField("instagram", e.target.value);
                            setErrors((er) => ({ ...er, contact: undefined }));
                          }}
                          disabled={isPending}
                        />
                      </div>
                    </div>
                    {/* Phone — Tunisian format */}
                    <div className={styles.formGroup}>
                      <div className={styles.inputWrap}>
                        <span className={styles.inputIcon}>
                          <PhoneIcon />
                        </span>
                        <input
                          type="tel"
                          className={`${styles.input}${errors.phone ? ` ${styles.inputError}` : ""}`}
                          placeholder={
                            locale === "fr"
                              ? "Ex: 20 123 456"
                              : "e.g. 20 123 456"
                          }
                          value={form.phone}
                          onChange={(e) => {
                            setField("phone", e.target.value);
                            setErrors((er) => ({
                              ...er,
                              contact: undefined,
                              phone: undefined,
                            }));
                          }}
                          onBlur={() => {
                            if (form.phone) {
                              const err = getPhoneError(form.phone);
                              if (err)
                                setErrors((er) => ({ ...er, phone: err }));
                            }
                          }}
                          disabled={isPending}
                        />
                      </div>
                      {errors.phone && (
                        <p className={styles.fieldError}>{errors.phone}</p>
                      )}
                    </div>
                    {/* Email */}
                    <div className={styles.formGroup}>
                      <div className={styles.inputWrap}>
                        <span className={styles.inputIcon}>
                          <MailIcon />
                        </span>
                        <input
                          type="email"
                          className={`${styles.input}${errors.contactEmail ? ` ${styles.inputError}` : ""}`}
                          placeholder={t("compose.contact.email")}
                          value={form.email}
                          onChange={(e) => {
                            setField("email", e.target.value);
                            setErrors((er) => ({
                              ...er,
                              contact: undefined,
                              contactEmail: undefined,
                            }));
                          }}
                          disabled={isPending}
                        />
                      </div>
                      {errors.contactEmail && (
                        <p className={styles.fieldError}>
                          {errors.contactEmail}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className={styles.composeFooter}>
                    <span className={styles.composeFooterHint}>
                      {t("compose.footerHint")}
                    </span>
                    <div className={styles.composeActions}>
                      <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={handleCancel}
                        disabled={isPending}
                      >
                        {t("compose.cancel")}
                      </button>
                      <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={isPending}
                      >
                        {isPending ? (
                          <>
                            <span className={styles.spinner} />
                            {t("compose.submitting")}
                          </>
                        ) : (
                          <>
                            <SendIcon />
                            {t("compose.submit")}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* Posts */}
          {postsLoading ? (
            <>
              <SkeletonPost />
              <SkeletonPost />
              <SkeletonPost />
            </>
          ) : posts.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>
                <MegaphoneIcon />
              </div>
              <h3 className={styles.emptyStateTitle}>{t("empty.title")}</h3>
              <p className={styles.emptyStateDesc}>{t("empty.description")}</p>
            </div>
          ) : (
            posts.map((post, i) => {
              const postImages =
                post.images && post.images.length > 0
                  ? post.images.map(imageUrl)
                  : post.image
                    ? [imageUrl(post.image)]
                    : [];

              return (
                <div
                  key={post._id}
                  className={styles.postCard}
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  {/* Header */}
                  <div className={styles.postCardHeader}>
                    <div className={styles.postAvatar}>
                      {post.author.userAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarUrl(post.author.userAvatar)!}
                          alt=""
                          className={styles.postAvatarImg}
                        />
                      ) : (
                        postInitials(post)
                      )}
                    </div>
                    <div className={styles.postMeta}>
                      <p className={styles.postAuthor}>
                        {post.author.firstName} {post.author.lastName}
                      </p>
                      <p className={styles.postTime}>
                        {timeAgo(post.createdAt, locale)}
                      </p>
                    </div>
                    <div className={styles.postBadges}>
                      <span
                        className={
                          post.type === "lost"
                            ? styles.badgeLost
                            : styles.badgeFound
                        }
                      >
                        {t(`types.${post.type}`)}
                      </span>
                      <span className={styles.badgeCategory}>
                        <span className={styles.badgeCategoryIcon}>
                          {CATEGORY_ICONS[post.category]}
                        </span>
                        {t(`categories.${post.category}`)}
                      </span>
                    </div>
                  </div>

                  {/* Image carousel */}
                  {postImages.length > 0 && (
                    <ImageCarousel
                      images={postImages}
                      alt={t("post.imageAlt")}
                    />
                  )}

                  {/* Body */}
                  <div className={styles.postBody}>
                    <p className={styles.postDescription}>{post.description}</p>
                    <div className={styles.postContacts}>
                      {post.contact.facebook && (
                        <a
                          href={`https://facebook.com/${post.contact.facebook}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.contactChip}
                        >
                          <FacebookIcon />
                          {post.contact.facebook}
                        </a>
                      )}
                      {post.contact.instagram && (
                        <a
                          href={`https://instagram.com/${post.contact.instagram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.contactChip}
                        >
                          <InstagramIcon />
                          {post.contact.instagram}
                        </a>
                      )}
                      {post.contact.phone && (
                        <a
                          href={`tel:${post.contact.phone}`}
                          className={styles.contactChip}
                        >
                          <PhoneIcon />
                          {post.contact.phone}
                        </a>
                      )}
                      {post.contact.email && (
                        <a
                          href={`mailto:${post.contact.email}`}
                          className={styles.contactChip}
                        >
                          <MailIcon />
                          {post.contact.email}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
