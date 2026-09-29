import { NextRequest, NextResponse } from "next/server";
import { all, getDb, run } from "@/lib/db";
import { requireUser, ownsBand, ownsSponsor, ownsVenue, forbid } from "@/lib/guard";

export const dynamic = "force-dynamic";

const TEMPLATES = [
  {
    slug: "presale-merch",
    name: "Pre-sale + merch bundle",
    owner_kind: "band",
    goal: "presale",
    blocks: ["hero", "date", "ticket_button", "merch_bundle", "fan_follow"],
    notes: "Sell the show before load-in: ticket link, shirt/vinyl add-on, follow capture.",
  },
  {
    slug: "venue-coupon",
    name: "Venue fan coupon",
    owner_kind: "venue",
    goal: "coupon",
    blocks: ["hero", "offer", "show_calendar", "redeem_code", "map"],
    notes: "Bring fans into the room: cover discount, food special, QR at door.",
  },
  {
    slug: "vendor-spot",
    name: "Vendor spot on the route",
    owner_kind: "sponsor",
    goal: "vendor_spot",
    blocks: ["brand_story", "route_map", "spot_sizes", "prize_draw", "coupon"],
    notes: "Vendor activation inside the ring: pick the arc, book the spot, run a prize draw at the gate.",
  },
  {
    slug: "band-venue-split",
    name: "Band + venue sales split",
    owner_kind: "venue",
    goal: "merch",
    blocks: ["co_headline", "ticket_button", "merch_table", "coupon", "after_show_followup"],
    notes: "Joint funnel for room and artist: tickets, merch table, coupon, after-show follow-up.",
  },
];

function ensureCampaignSchema() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS campaign_templates (
      id INTEGER PRIMARY KEY,
      slug TEXT UNIQUE,
      name TEXT NOT NULL,
      owner_kind TEXT DEFAULT 'venue',
      goal TEXT,
      default_blocks TEXT,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY,
      owner_kind TEXT NOT NULL,
      owner_id INTEGER NOT NULL,
      template_id INTEGER,
      title TEXT NOT NULL,
      audience TEXT DEFAULT 'fans',
      status TEXT DEFAULT 'draft',
      start_date TEXT,
      end_date TEXT,
      blocks TEXT,
      budget INTEGER DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      conversions INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY,
      campaign_id INTEGER,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      offer TEXT,
      redeem_url TEXT,
      max_redemptions INTEGER DEFAULT 0,
      redeemed INTEGER DEFAULT 0,
      valid_from TEXT,
      valid_to TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  for (const t of TEMPLATES) {
    run(
      `INSERT OR IGNORE INTO campaign_templates(slug,name,owner_kind,goal,default_blocks,notes)
       VALUES(?,?,?,?,?,?)`,
      t.slug,
      t.name,
      t.owner_kind,
      t.goal,
      JSON.stringify(t.blocks),
      t.notes,
    );
  }
}

function canOwn(user: any, kind: string, id: number) {
  if (kind === "band") return ownsBand(user, id);
  if (kind === "venue") return ownsVenue(user, id);
  if (kind === "sponsor") return ownsSponsor(user, id);
  return false;
}

export async function GET(req: NextRequest) {
  ensureCampaignSchema();
  const ownerKind = req.nextUrl.searchParams.get("ownerKind");
  const ownerId = Number(req.nextUrl.searchParams.get("ownerId") || 0);
  const where = ownerKind && ownerId ? "WHERE c.owner_kind=? AND c.owner_id=?" : "WHERE c.status='live'";
  const args = ownerKind && ownerId ? [ownerKind, ownerId] : [];
  const campaigns = all(
    `SELECT c.*, t.name template, t.goal
     FROM campaigns c LEFT JOIN campaign_templates t ON t.id=c.template_id
     ${where}
     ORDER BY c.created_at DESC`,
    ...args,
  );
  const coupons = all(
    `SELECT co.*, c.title campaign_title, c.owner_kind
     FROM coupons co JOIN campaigns c ON c.id=co.campaign_id
     ${ownerKind && ownerId ? "WHERE c.owner_kind=? AND c.owner_id=?" : "WHERE c.status='live'"}
     ORDER BY co.created_at DESC`,
    ...args,
  );
  return NextResponse.json({
    templates: all("SELECT * FROM campaign_templates ORDER BY id"),
    campaigns,
    coupons,
  });
}

export async function POST(req: NextRequest) {
  ensureCampaignSchema();
  const g = requireUser(req);
  if (g.deny) return g.deny;
  const p = await req.json();
  const ownerKind = String(p.owner_kind || "venue");
  const ownerId = Number(p.owner_id || 0);
  if (!canOwn(g.user, ownerKind, ownerId)) return forbid("You can only launch campaigns for your own band, venue, or sponsor account.");
  const tpl: any = all("SELECT * FROM campaign_templates WHERE id=?", Number(p.template_id || 0))[0];
  const blocks = p.blocks || (tpl?.default_blocks ? JSON.parse(tpl.default_blocks) : ["hero", "offer", "cta"]);
  const r = run(
    `INSERT INTO campaigns(owner_kind,owner_id,template_id,title,audience,status,start_date,end_date,blocks,budget)
     VALUES(?,?,?,?,?,?,?,?,?,?)`,
    ownerKind,
    ownerId,
    p.template_id || null,
    p.title || tpl?.name || "Campaign",
    p.audience || "fans",
    p.status || "draft",
    p.start_date || null,
    p.end_date || null,
    JSON.stringify(blocks),
    Number(p.budget || 0),
  );
  const campaignId = Number(r.lastInsertRowid);
  if (p.coupon_code || p.offer) {
    run(
      `INSERT INTO coupons(campaign_id,code,title,offer,redeem_url,max_redemptions,valid_from,valid_to)
       VALUES(?,?,?,?,?,?,?,?)`,
      campaignId,
      String(p.coupon_code || `ROADIE${campaignId}`).toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24),
      p.coupon_title || p.title || "ROADIE offer",
      p.offer || "",
      p.redeem_url || "",
      Number(p.max_redemptions || 0),
      p.start_date || null,
      p.end_date || null,
    );
  }
  return NextResponse.json({ ok: true, campaign_id: campaignId });
}
