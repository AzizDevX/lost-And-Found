"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { routing, localeNames, type Locale } from "@/i18n/routing";
import { isAuthenticated, initAuth, signOut } from "@/lib/auth";
import styles from "./navbar.module.css";

// ─── Icons ────────────────────────────────────────────────────────────────────

const GlobeIcon = () => (
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
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const ChevronDown = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const UserIcon = () => (
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
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// ─── Nav links ────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: "Home", href: "/home" },
  { label: "Announcements", href: "/announcements" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Navbar() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const langRef = useRef<HTMLDivElement>(null);

  // ── On mount: try to restore session silently via /api/auth/refresh ─────────
  useEffect(() => {
    initAuth().then((ok) => setLoggedIn(ok));
  }, []);

  // ── Re-check auth state on every route change ────────────────────────────────
  useEffect(() => {
    setLoggedIn(isAuthenticated());
    setMobileOpen(false); // close drawer on navigate
  }, [pathname]);

  // ── Scroll detection ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Close lang dropdown on outside click ─────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node))
        setLangOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Locale switch ─────────────────────────────────────────────────────────────
  const changeLocale = (next: Locale) => {
    setLangOpen(false);
    setMobileOpen(false);
    const parts = pathname.split("/");
    parts[1] = next;
    router.replace(parts.join("/"));
  };

  // ── Sign out ─────────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    await signOut(); // clears memory token + calls /api/auth/logout
    setLoggedIn(false);
    setMobileOpen(false);
    router.push(`/${locale}/login`);
  };

  const isActive = (href: string) =>
    pathname === `/${locale}${href}` ||
    pathname.startsWith(`/${locale}${href}/`);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <nav
        className={`${styles.navbar}${scrolled ? ` ${styles.navbarScrolled}` : ""}`}
      >
        <div className={styles.inner}>
          {/* Logo — flush left */}
          <Link href={`/${locale}/home`} className={styles.logo}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/icons/ted-logo.jpg"
              alt="Ted University"
              className={styles.logoImg}
            />
            <div className={styles.logoText}>
              <span className={styles.logoTitle}>Ted Lost &amp; Found</span>
              <span className={styles.logoSub}>University Portal</span>
            </div>
          </Link>

          {/* Nav links — absolutely centred */}
          <ul className={styles.navLinks}>
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={`/${locale}${link.href}`}
                  className={`${styles.navLink}${isActive(link.href) ? ` ${styles.navLinkActive}` : ""}`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Right side — flush right */}
          <div className={styles.navRight}>
            {/* Language switcher */}
            <div className={styles.langWrap} ref={langRef}>
              <button
                className={styles.langBtn}
                onClick={() => setLangOpen((v) => !v)}
              >
                <GlobeIcon />
                {localeNames[locale]}
                <ChevronDown />
              </button>
              {langOpen && (
                <div className={styles.langDropdown}>
                  {routing.locales.map((l) => (
                    <button
                      key={l}
                      className={`${styles.langOption}${l === locale ? ` ${styles.langOptionActive}` : ""}`}
                      onClick={() => changeLocale(l)}
                    >
                      {localeNames[l]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sign In / My Account — driven by JWT in memory */}
            {loggedIn ? (
              <Link href={`/${locale}/account`} className={styles.accountBtn}>
                <span className={styles.accountAvatar}>
                  <UserIcon />
                </span>
                My Account
              </Link>
            ) : (
              <Link href={`/${locale}/login`} className={styles.signInBtn}>
                Sign In
              </Link>
            )}
          </div>

          {/* Hamburger — mobile only */}
          <button
            className={`${styles.hamburger}${mobileOpen ? ` ${styles.hamburgerOpen}` : ""}`}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            <span className={styles.bar} />
            <span className={styles.bar} />
            <span className={styles.bar} />
          </button>
        </div>
      </nav>

      {/* Mobile drawer — only rendered in DOM when open */}
      {mobileOpen && (
        <div className={styles.mobileMenu}>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={`/${locale}${link.href}`}
              className={`${styles.mobileNavLink}${isActive(link.href) ? ` ${styles.mobileNavLinkActive}` : ""}`}
            >
              {link.label}
            </Link>
          ))}

          <div className={styles.mobileDivider} />

          <div className={styles.mobileBottom}>
            {/* Language pills */}
            <div className={styles.mobileLangRow}>
              {routing.locales.map((l) => (
                <button
                  key={l}
                  className={`${styles.mobileLangBtn}${l === locale ? ` ${styles.mobileLangBtnActive}` : ""}`}
                  onClick={() => changeLocale(l)}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Auth */}
            {loggedIn ? (
              <Link
                href={`/${locale}/account`}
                className={`${styles.mobileAuthBtn} ${styles.mobileAccount}`}
                onClick={() => setMobileOpen(false)}
              >
                My Account
              </Link>
            ) : (
              <Link
                href={`/${locale}/login`}
                className={`${styles.mobileAuthBtn} ${styles.mobileSignIn}`}
                onClick={() => setMobileOpen(false)}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Pushes page content below fixed navbar */}
      <div className={styles.navSpacer} />
    </>
  );
}
