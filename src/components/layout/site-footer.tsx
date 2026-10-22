import { siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6">
        <p>
          <strong className="font-medium text-foreground">免責聲明：</strong>
          {siteConfig.disclaimer}
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <span>資料來源：</span>
          {siteConfig.dataSources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {s.name}
            </a>
          ))}
        </p>
        <p>© {siteConfig.name}</p>
      </div>
    </footer>
  );
}
