import { getTranslations } from "next-intl/server";
import { APP_NAME, TAGLINE } from "@/lib/config";

export default async function Home() {
  const t = await getTranslations("home");
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-4 p-6">
      <h1 className="text-3xl font-bold">{APP_NAME}</h1>
      <p className="text-lg">{t("tagline")}</p>
      <p className="text-sm text-gray-700">{t("trust")}</p>
      <p className="text-xs text-gray-500">{TAGLINE}</p>
    </main>
  );
}
