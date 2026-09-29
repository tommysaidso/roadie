"use client";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Home, ChevronRight } from "lucide-react";

const LABELS: Record<string, string> = {
  admin:       "Admin",
  pitch:       "Film Pitch",
  "ring-pitch":"Business Plan",
  offers:      "Sponsor Offers",
  studio:      "Promo Studio",
  inbox:       "Inbox",
  reachout:    "Reachout",
  backend:     "Backend",
  advertiser:  "Advertiser Console",
  venue:       "Host Site",
  production:  "Production Team",
  agreements:  "Paperwork & Crew",
};

// Suggested next action per path
const NEXT_STEP: Record<string, { label: string; href: string }> = {
  "/admin/pitch":       { label: "Sponsor Offers",  href: "/admin/offers"     },
  "/admin/ring-pitch":  { label: "Film Pitch",      href: "/admin/pitch"      },
  "/admin/studio":      { label: "Sponsor Offers",  href: "/admin/offers"     },
  "/admin/offers":      { label: "Promo Studio",    href: "/admin/studio"     },
  "/admin/inbox":       { label: "Reachout",        href: "/admin/reachout"   },
  "/admin/production":  { label: "Film Pitch",      href: "/admin/pitch"      },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  const parts    = pathname.split("/").filter(Boolean); // ["admin", "pitch", ...]
  const crumbs   = parts.map((seg, i) => ({
    label: LABELS[seg] ?? seg,
    href:  "/" + parts.slice(0, i + 1).join("/"),
  }));

  const isHome   = pathname === "/admin";
  const next     = NEXT_STEP[pathname];

  // Back target: one level up from current path, capped at /admin
  const backHref = parts.length > 1
    ? "/" + parts.slice(0, -1).join("/")
    : null;

  return (
    <div>
      {/* ── Admin nav bar ── */}
      <div className="sticky top-0 z-40 flex items-center gap-2 px-4 py-2 border-b border-edge bg-surface/90 backdrop-blur text-sm">

        {/* Back */}
        {!isHome && backHref && (
          <button
            onClick={() => router.push(backHref)}
            className="flex items-center gap-1 text-muted hover:text-foreground transition shrink-0"
            aria-label="Back"
          >
            <ChevronLeft size={15} />
            <span className="hidden sm:inline">Back</span>
          </button>
        )}

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={c.href} className="flex items-center gap-1 min-w-0">
              {i > 0 && <ChevronRight size={12} className="text-muted shrink-0" />}
              {i === crumbs.length - 1 ? (
                <span className="font-semibold truncate">{c.label}</span>
              ) : (
                <Link href={c.href} className="text-muted hover:text-foreground transition truncate">
                  {c.label}
                </Link>
              )}
            </span>
          ))}
        </nav>

        {/* Suggested next */}
        {next && (
          <Link
            href={next.href}
            className="flex items-center gap-1 text-muted hover:text-foreground transition shrink-0 text-xs border border-edge rounded px-2 py-0.5"
          >
            {next.label} <ChevronRight size={12} />
          </Link>
        )}

        {/* Home — always present unless we're already there */}
        {!isHome && (
          <Link
            href="/admin"
            className="flex items-center gap-1 text-muted hover:text-foreground transition shrink-0 ml-1"
            aria-label="Admin home"
            title="Admin home"
          >
            <Home size={15} />
          </Link>
        )}
      </div>

      {children}
    </div>
  );
}
