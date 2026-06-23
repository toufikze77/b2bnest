import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { LandingPage, getPages, savePage, seedIfEmpty } from "@/lib/leadGen";
import PageRenderer from "./PageRenderer";

export default function PublicPage() {
  const { slug } = useParams();
  const [page, setPage] = useState<LandingPage | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    seedIfEmpty();
    const p = getPages().find(x => x.slug === slug);
    if (!p) setMissing(true);
    else {
      const updated = { ...p, views: p.views + 1 };
      savePage(updated);
      setPage(updated);
      document.title = p.settings.title || p.name;
      const emoji = p.settings.faviconEmoji === "🚀" ? "" : p.settings.faviconEmoji;
      if (emoji) {
        const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement("link");
        link.rel = "icon";
        link.href = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="80" font-size="80">${emoji}</text></svg>`;
        document.head.appendChild(link);
      }
    }
  }, [slug]);

  if (missing) return <div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl">Page not found</h1></div>;
  if (!page) return null;
  return <div className="min-h-screen"><PageRenderer page={page} /></div>;
}
