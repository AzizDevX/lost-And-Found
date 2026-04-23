import { getRequestConfig } from "next-intl/server";
import { routing, type Locale } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // fallback
  if (!locale || !routing.locales.includes(locale as Locale)) {
    locale = routing.defaultLocale;
  }

  const common = (await import(`../messages/${locale}.json`)).default;
  const admin = (await import(`../messages/admin.${locale}.json`)).default;

  return {
    locale,
    messages: {
      ...common,
      admin,
    },
  };
});
