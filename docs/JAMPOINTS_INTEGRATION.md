# JAM POINTS x ROADIE — integration work order
2026-09-02 · from the SoCal Jams build-out (Ben + Claude) · spec, not yet applied

## What ROADIE already has (audited 2026-09-02)

- `vendor_offers` + `vendor_offer_redemptions` (lib/vendorOffers.ts, app/api/vendor-offers,
  admin OffersConsole): sponsor-owned standing discounts, percent/amount/freebie,
  city/region/anywhere scope, band+fan audiences, minted redemption tokens, ledger-checked,
  suspend override. **DARK on prod: ROADIE_VENDOR_TOKENS is not set.**
- Fan multicam (lib/fanclips.ts, multicam_sets + fan_clips): R2 direct upload, licence
  capture, audio-offset alignment via ffmpeg workorder, orientation vertical=punch-in /
  wide=wide. Deliberately stops before auto-cutting. **DARK on prod: no R2_* env.**
- gigbag, venues, sponsors, map, hubs, coupons, perks routes.

## Gap 1 — the EARN side (the scavenger hunt)

ROADIE covers SPEND (offers/redeem). Jam Points adds EARN:
- vendor check-in via per-vendor QR (payload `RDPTS:<vendor>:<city>`), one scan per
  vendor per day, server-validated
- points balance per user; day-streak bonus (5 spots/day = +100)
- tiers: 100 local perk / 250 double-up / 500 ANYWHERE CARD (redeem network-wide,
  ties into offers scope='anywhere')
- member points card (QR) — phone wallet passes later
Schema draft: `lib/migrations/DRAFT_jampoints.sql` (NOT applied). API surface mirrors
vendor-offers style: feature flag `ROADIE_JAM_POINTS=1`, dark-404 until shipped.

## Gap 2 — network vendor VISIBILITY

Requirement (Ben): a musician anywhere in the network world (USA/Canada/UK) can SEE
every vendor using jam points and find them. Today `offersNear` is deliberately
city/region-scoped. Add: map-layer feed (vendor pins with active offers/points
participation, geo from vendor_offers.lat/lng) surfaced on /map + /discover —
browseable network-wide, but bulk-scrape-resistant (tile/viewport scoped).

## Gap 3 — the localjams BRIDGE

socaljams (Mike Hanson's property, github.com/tommysaidso/socaljams) runs its own
"Jams Tokens". Peer federation, no master: `/api/bridge/{profiles,events,tokens}`,
email as join key, HMAC-signed inter-site calls. Ledger semantics shared: earn local,
redeem network-wide; per-property currency naming. Ring Tour: ROADIE pulls local-jams
events per stop, pushes tour dates back; tack-on shows (second band / bigger show)
route through the local property.

## Gap 4 — LIVE multicam (fan experience)

fanclips = post-show. The SoCal Jams build adds the LIVE lane (working UI demo in the
socaljams repo, page `#crowdcam` + `#console`):
- QR at the venue opens phone camera in browser (no app), feed joins the switch
- SHOW CONSOLE: AI auto-director by default (beat/motion-aware, musical hold-times),
  per-show operator login (expires end of night), take-the-wheel manual cut
- replay-in-app for the room; every clip vaulted + auto-tagged (face registration)
- post: scrub timeline w/ playhead, auto color balance, stitch & master, export
PRODUCTION DOCTRINE (HARD): FOH board take captured every show = AUDIO MASTER
(phone mics = sync reference only); attendee phones shoot VERTICAL 9:16 (safety +
punch-ins); 16:9 only from fixed/venue cams (orientation + master shot); ~20
concurrent phone feeds is the design target. fan_clips.orientation already encodes
the vertical/wide doctrine — live lane reuses it.

## Turn-on checklist (each = Ben's word, prod restart)

1. `ROADIE_VENDOR_TOKENS=1` on the roadie service env → offers surface goes live
2. R2_* env for fanclips storage → multicam intake goes live
3. Apply jampoints migration + ship earn API behind `ROADIE_JAM_POINTS=1`
4. Map vendor layer; 5. bridge endpoints; 6. live switcher lane

Reference implementation for UX: github.com/tommysaidso/socaljams (single-file demo
of wallet, card, switcher, console, doctrine copy).
