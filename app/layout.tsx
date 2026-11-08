import "./globals.css";
import type { Metadata, Viewport } from "next";
import Shell from "../components/Shell";
import { ensureProfileSchema } from "@/lib/profiles";

// The public address, so share images and links resolve to the real site rather
// than the container's own localhost (Google and Facebook showed no image).
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://roadie.mymymy.studio";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "ROADIE — the band's road kit", template: "%s · ROADIE" },
  description: "Community, venues, AI booking, tour map and sponsors for Canadian bands. Front-of-house to mymymy.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ROADIE" },
  openGraph: {
    title: "ROADIE — be your own bookie",
    description: "Venues. Bookings. Tour routes. Fans. Free — built by musicians, not suits.",
    images: ["/promo/bookie.png"],
  },
  twitter: { card: "summary_large_image", images: ["/promo/bookie.png"] },
};
export const viewport: Viewport = {
  themeColor: "#0b0b0f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",          // use the full notch/safe-area on phones
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Profiles carry the ownership union, so the table must exist and be
  // backfilled before anything asks who owns what. Doing it lazily inside
  // /api/profiles was too late: that route answers 401 to a signed-out visitor
  // and returns before it ever reaches the schema, so a fresh container never
  // built the table. Here it runs on the first page render, whoever shows up.
  // Idempotent and cheap after the first call.
  ensureProfileSchema();

  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
