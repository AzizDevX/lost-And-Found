"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { routing, localeNames, type Locale } from "@/i18n/routing";
import { GlobeIcon, ChevronIcon } from "./Icons";
import styles from "./Languageswitcher.module.css";

export default function LanguageSwitcher({
  locale,
  page,
}: {
  locale: Locale;
  page: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className={styles.langBar} ref={ref}>
      <button className={styles.langBtn} onClick={() => setOpen((v) => !v)}>
        <GlobeIcon />
        {localeNames[locale]}
        <ChevronIcon />
      </button>
      {open && (
        <div className={styles.langDropdown}>
          {routing.locales.map((l) => (
            <button
              key={l}
              className={`${styles.langOption}${l === locale ? ` ${styles.active}` : ""}`}
              onClick={() => {
                setOpen(false);
                router.replace(`/${l}/${page}`);
              }}
            >
              {localeNames[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
