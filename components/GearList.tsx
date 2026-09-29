"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Guitar, Camera, ScanLine, Plus, X } from "lucide-react";

// The gear list — brand, model, serial, photo.
//
// Sits beside the free-text "what's in the bag" list rather than replacing it.
// "hardware, throne" is a perfectly good line and should stay a line; this is
// for the pieces worth naming, because a stolen amp is recovered by its serial
// number and nothing else.
//
// Three ways in for a serial, because the useful one depends on where you are:
// scan the barcode with the phone camera, photograph the plate, or type it.

const inp = "w-full bg-[#0b0b0f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm " +
            "focus:outline-none focus:border-[#ff3d6e]";

type Kind = { id: string; label: string; brands: string[] };

export default function GearList({ bandId }: { bandId: number }) {
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [gear, setGear] = useState<any[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<any>({ kind: "guitar", brand: "", model: "", serial: "" });
  const [customBrand, setCustomBrand] = useState(false);
  const [scanning, setScanning] = useState(false);
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/gear?band=${bandId}`).then(r => r.json()).catch(() => null);
    if (!r) { setGear([]); return; }
    setKinds(r.kinds || []); setGear(r.gear || []); setCanEdit(!!r.can_edit);
  }, [bandId]);
  useEffect(() => { load(); }, [load]);

  const brands = kinds.find(k => k.id === draft.kind)?.brands ?? [];

  async function save() {
    if (!draft.brand && !draft.model) { setNote("Give it at least a brand or a model."); return; }
    setBusy(true); setNote(null);
    const r = await fetch("/api/gear", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ band: bandId, item: draft }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }));
    setBusy(false);
    if (r?.error) { setNote(r.error); return; }
    setGear(r.gear || []);
    setDraft({ kind: draft.kind, brand: "", model: "", serial: "" });
    setCustomBrand(false);
    if (r.serial_seen_elsewhere?.length) {
      setNote(`Heads up — that serial is also listed by ${r.serial_seen_elsewhere.map((x: any) => x.band).join(", ")}. Usually that just means it's listed twice.`);
    } else setNote("Added.");
  }

  async function uploadPhoto(f: File, id?: number) {
    setBusy(true);
    const fd = new FormData(); fd.append("band", String(bandId)); fd.append("file", f);
    const r = await fetch("/api/gear", { method: "POST", body: fd }).then(r => r.json()).catch(e => ({ error: String(e) }));
    setBusy(false);
    if (r?.error) { setNote(r.error); return; }
    if (id) {
      const up = await fetch("/api/gear", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ band: bandId, item: { id, photo: r.photo } }),
      }).then(x => x.json()).catch(() => null);
      if (up?.gear) setGear(up.gear);
    } else {
      setDraft((d: any) => ({ ...d, photo: r.photo }));
    }
    setNote("Photo saved.");
  }

  /**
   * Scan a barcode with the phone camera.
   *
   * Uses the browser's own BarcodeDetector where it exists (Chrome, Android) —
   * no library, no upload, nothing leaves the phone. Where it doesn't exist we
   * say so plainly and fall back to a photo or typing, rather than opening a
   * camera that quietly never reads anything.
   */
  async function startScan() {
    const Det = (window as any).BarcodeDetector;
    if (!Det) { setNote("This browser can't scan barcodes — photograph the serial plate or type it."); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.current = s; setScanning(true);
      setTimeout(async () => {
        if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => {}); }
        const det = new Det({ formats: ["code_128", "code_39", "ean_13", "qr_code", "data_matrix"] });
        const tick = async () => {
          if (!stream.current || !video.current) return;
          try {
            const found = await det.detect(video.current);
            if (found?.length) {
              setDraft((d: any) => ({ ...d, serial: found[0].rawValue, serial_source: "scan" }));
              setNote(`Scanned: ${found[0].rawValue}`);
              stopScan();
              return;
            }
          } catch {}
          requestAnimationFrame(tick);
        };
        tick();
      }, 60);
    } catch (e: any) {
      setNote(`No camera: ${e?.message || e}`);
    }
  }
  function stopScan() {
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null; setScanning(false);
  }
  useEffect(() => () => stopScan(), []);

  if (gear === null) return null;

  return (
    <div className="mt-3 rounded-xl border border-[#2a2a3a]">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/[0.03]">
        <Guitar size={15} style={{ color: "#ffb03d" }} />
        <span className="font-semibold text-sm">Gear &amp; serials</span>
        <span className="pill text-[10px]">{gear.length}</span>
        <span className="ml-auto text-xs text-muted">{open ? "hide" : "show"}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 border-t border-[#2a2a3a] pt-3 flex flex-col gap-2">
          {note && <div className="text-xs text-muted">{note}</div>}

          {gear.map(g => (
            <div key={g.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm"
              style={{ background: "rgba(255,255,255,0.03)" }}>
              {g.photo
                ? <img src={`/gear/${g.photo}`} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                : <span className="pill text-[9px] shrink-0">{g.kind}</span>}
              <span className="truncate">{[g.brand, g.model].filter(Boolean).join(" ")}</span>
              {g.serial && <span className="text-[11px] font-mono text-muted truncate">#{g.serial}</span>}
              {canEdit && (
                <div className="ml-auto flex gap-1 shrink-0">
                  <label className="pill text-[9px] cursor-pointer hover:border-neon">
                    photo
                    <input type="file" hidden accept="image/*" capture="environment"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f, g.id); e.currentTarget.value = ""; }} />
                  </label>
                  <button className="pill text-[9px] hover:border-neon" disabled={busy}
                    onClick={async () => {
                      const r = await fetch("/api/gear", {
                        method: "POST", headers: { "content-type": "application/json" },
                        body: JSON.stringify({ band: bandId, action: "delete", id: g.id }),
                      }).then(x => x.json()).catch(() => null);
                      if (r?.gear) setGear(r.gear);
                    }}>remove</button>
                </div>
              )}
            </div>
          ))}
          {!gear.length && <div className="text-sm text-muted">Nothing listed yet.</div>}

          {canEdit && (
            <>
              {scanning && (
                <div className="rounded-lg overflow-hidden border border-[#2a2a3a] relative">
                  <video ref={video} playsInline muted className="w-full max-h-56 object-cover" />
                  <button className="btn absolute top-2 right-2 px-2 py-1 text-[11px]" onClick={stopScan}>
                    <X size={12} /> stop
                  </button>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-2">
                <label className="text-[11px] text-muted">
                  What is it
                  <select className={inp + " mt-1"} value={draft.kind}
                    onChange={e => { setDraft((d: any) => ({ ...d, kind: e.target.value, brand: "" })); setCustomBrand(false); }}>
                    {kinds.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                  </select>
                </label>

                <label className="text-[11px] text-muted">
                  Brand
                  {customBrand || !brands.length ? (
                    <input className={inp + " mt-1"} autoFocus={customBrand} placeholder="type the brand"
                      value={draft.brand} onChange={e => setDraft((d: any) => ({ ...d, brand: e.target.value }))} />
                  ) : (
                    <select className={inp + " mt-1"} value={draft.brand}
                      onChange={e => {
                        if (e.target.value === "__other") { setCustomBrand(true); setDraft((d: any) => ({ ...d, brand: "" })); }
                        else setDraft((d: any) => ({ ...d, brand: e.target.value }));
                      }}>
                      <option value="">— pick a brand —</option>
                      {brands.map(b => <option key={b} value={b}>{b}</option>)}
                      <option value="__other">Something else…</option>
                    </select>
                  )}
                </label>

                <input className={inp} placeholder="model — Stratocaster, Rockerverb 50"
                  value={draft.model} onChange={e => setDraft((d: any) => ({ ...d, model: e.target.value }))} />

                <div className="flex gap-2">
                  <input className={inp + " font-mono"} placeholder="serial number"
                    value={draft.serial}
                    onChange={e => setDraft((d: any) => ({ ...d, serial: e.target.value, serial_source: "manual" }))} />
                  <button className="btn px-2 shrink-0" title="Scan a barcode" onClick={startScan}>
                    <ScanLine size={14} />
                  </button>
                  <label className="btn px-2 shrink-0 cursor-pointer" title="Photograph it">
                    <Camera size={14} />
                    <input type="file" hidden accept="image/*" capture="environment"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.currentTarget.value = ""; }} />
                  </label>
                </div>
              </div>

              <button className="btn btn-neon self-start" disabled={busy} onClick={save}>
                <Plus size={13} className="inline mr-1" />Add to the bag
              </button>
              <p className="text-[11px] text-muted">
                Serials are what get gear back. Scan the barcode, photograph the plate, or type it —
                spacing and case don&apos;t matter, we tidy it.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
