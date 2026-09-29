import { listForVenue, venueName } from "@/lib/backline";
import { ShoppingBag, ExternalLink, Guitar } from "lucide-react";
export const dynamic = "force-dynamic";

// PUBLIC shoppable list — "what's on this stage?" Every item links out to buy.
// The QR here is the VISIBLE one for the room / a poster. The eye-invisible,
// camera-only QR that rides the video is a separate render-side layer.
export default async function BacklinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vid = Number(id);
  const name = venueName(vid);
  const items = listForVenue(vid);
  const pageUrl = `https://roadie.mymymy.studio/backline/${vid}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=190x190&margin=1&bgcolor=0b0b0f&color=ffffff&data=${encodeURIComponent(pageUrl)}`;

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-8">
      <div className="flex items-center gap-2 mb-1"><Guitar size={18} className="text-neon" /><span className="label">Sponsored backline</span></div>
      <h1 className="text-3xl md:text-4xl font-black tracking-tight">What&rsquo;s on this stage</h1>
      <p className="text-muted mt-2">{name} — the gear the players are on tonight. Heard something you liked? Tap it, get one.</p>

      <div className="flex flex-wrap gap-6 items-start mt-6">
        <div className="flex-1 min-w-[260px] space-y-3">
          {items.length === 0
            ? <div className="card p-5 text-sm text-muted">No backline listed here yet.</div>
            : items.map((b: any) => (
              <a key={b.id} href={b.buy_url || "#"} target="_blank" rel="noreferrer"
                className="card p-4 flex items-center gap-3 hover:border-neon transition group">
                <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(255,61,110,0.12)", color: "#ff3d6e" }}><ShoppingBag size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className="font-bold block truncate">{b.item}</span>
                  <span className="text-xs text-muted">{[b.brand, b.category].filter(Boolean).join(" · ")}{b.sponsor_name ? ` · via ${b.sponsor_name}` : ""}{b.price ? ` · ${b.price}` : ""}</span>
                </span>
                {b.buy_url && <span className="text-xs font-semibold flex items-center gap-1 shrink-0" style={{ color: "#ff3d6e" }}>buy <ExternalLink size={12} /></span>}
              </a>
            ))}
        </div>

        <div className="card p-4 text-center">
          <img src={qr} alt="Scan for this stage's gear" width={190} height={190} style={{ borderRadius: 10, background: "#0b0b0f" }} />
          <div className="text-[11px] text-muted mt-2 max-w-[190px]">Scan to open this list on your phone — buy the gear you heard tonight.</div>
        </div>
      </div>

      <p className="text-xs text-muted mt-8">Backline is sponsor-supported. Buying through these links supports the room and the jam.</p>
    </div>
  );
}
