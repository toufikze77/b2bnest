import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Target } from "lucide-react";
import { seedIfEmpty } from "@/lib/leadGen";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/lead-generation", label: "Overview", end: true },
  { to: "/lead-generation/leads", label: "Leads" },
  { to: "/lead-generation/forms", label: "Forms" },
  { to: "/lead-generation/pages", label: "Landing Pages" },
  { to: "/lead-generation/import", label: "Import" },
];

interface Props { children: ReactNode; title?: string; subtitle?: string; right?: ReactNode; }

export default function LeadGenLayout({ children, title = "Lead Generation", subtitle = "Capture, score and convert leads — automatically added to your CRM", right }: Props) {
  useEffect(() => { seedIfEmpty(); }, []);
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-[#f0f4f8]">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white" style={{ background: "#2563eb" }}>
              <Target className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#0A1628]">{title}</h1>
              <p className="text-gray-600 text-sm">{subtitle}</p>
            </div>
          </div>
          <div>{right}</div>
        </div>

        <div className="border-b border-gray-200 mb-6 overflow-x-auto">
          <nav className="flex gap-1 min-w-max">
            {tabs.map(t => {
              const active = t.end ? pathname === t.to : pathname.startsWith(t.to);
              return (
                <Link key={t.to} to={t.to}
                  className={cn(
                    "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                    active ? "border-[#2563eb] text-[#2563eb]" : "border-transparent text-gray-600 hover:text-[#0A1628]"
                  )}>
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {children}
      </div>
    </div>
  );
}
