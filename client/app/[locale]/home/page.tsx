"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { type Locale } from "@/i18n";
import styles from "./home.module.css";

// ── Stat icons ────────────────────────────────────────────────────────────────
const BoxIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="21 8 21 21 3 21 3 8" />
    <rect x="1" y="3" width="22" height="5" />
    <line x1="10" y1="12" x2="14" y2="12" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const MegaphoneIcon = () => (
  <svg
    width="20"
    height="20"
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

// ── Component ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const t = useTranslations("home");
  const locale = useLocale() as Locale;

  return (
    <div className={styles.pageWrap}>
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />

        <div className={styles.heroGrid}>
          {/* Left — text */}
          <div className={styles.heroText}>
            <div className={styles.heroEyebrow}>{t("eyebrow")}</div>

            <h1 className={styles.heroTitle}>
              {t("title")}
              <br />
              <span>{t("titleHighlight")}</span>
            </h1>

            <p className={styles.heroDesc}>{t("description")}</p>
          </div>

          {/* Right — stats */}
          <div className={styles.heroStats}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <BoxIcon />
              </div>
              <div className={styles.statInfo}>
                <strong>{t("stats.soon")}</strong>
                <span>{t("stats.itemsReported")}</span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <CheckIcon />
              </div>
              <div className={styles.statInfo}>
                <strong>{t("stats.soon")}</strong>
                <span>{t("stats.itemsReturned")}</span>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <MegaphoneIcon />
              </div>
              <div className={styles.statInfo}>
                <strong>{t("stats.soon")}</strong>
                <span>{t("stats.announcements")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionEyebrow}>{t("howItWorks.eyebrow")}</div>
          <h2 className={styles.sectionTitle}>{t("howItWorks.title")}</h2>
          <p className={styles.sectionSub}>{t("howItWorks.subtitle")}</p>
        </div>

        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepNum}>01</div>
            <h3>{t("howItWorks.steps.browse.title")}</h3>
            <p>{t("howItWorks.steps.browse.description")}</p>
          </div>

          <div className={styles.step}>
            <div className={styles.stepNum}>02</div>
            <h3>{t("howItWorks.steps.report.title")}</h3>
            <p>{t("howItWorks.steps.report.description")}</p>
          </div>

          <div className={styles.step}>
            <div className={styles.stepNum}>03</div>
            <h3>{t("howItWorks.steps.connect.title")}</h3>
            <p>{t("howItWorks.steps.connect.description")}</p>
          </div>
        </div>
      </div>

      {/* ── Announcements CTA Banner ──────────────────────────────────────────── */}
      <div className={styles.announcementWrap}>
        <div className={styles.announcementBanner}>
          <div className={styles.bannerBg} />
          <div className={styles.bannerContent}>
            <div className={styles.bannerEyebrow}>{t("banner.eyebrow")}</div>
            <h2 className={styles.bannerTitle}>{t("banner.title")}</h2>
            <p className={styles.bannerDesc}>{t("banner.description")}</p>
          </div>
          <div className={styles.bannerAction}>
            <Link
              href={`/${locale}/announcements`}
              className={styles.btnPrimary}
            >
              {t("banner.cta")}
            </Link>
          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className={styles.footer}>{t("footer")}</footer>
    </div>
  );
}
