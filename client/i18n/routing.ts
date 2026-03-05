import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fr"],
  defaultLocale: "en",
  localePrefix: "always",
});

// Re-export types & helpers so other files can still import from "@/i18n/routing"
export type Locale = (typeof routing.locales)[number];

export const localeNames: Record<Locale, string> = {
  en: "English",
  fr: "Français",
};

export const localeDir: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  fr: "ltr",
};
