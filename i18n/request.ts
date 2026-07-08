import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const locales = ["en", "pcm"] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async () => {
  const cookie = (await cookies()).get("locale")?.value;
  const locale: Locale = locales.includes(cookie as Locale) ? (cookie as Locale) : "en";
  return { locale, messages: (await import(`../messages/${locale}.json`)).default };
});
