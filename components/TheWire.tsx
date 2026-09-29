"use client";
/**
 * THE WIRE — fan radio player for The PIT.
 *
 * Design: photo-realistic vintage radio panel. No skip, no playlist.
 * Just genre dial, volume knob, VU meters, and whatever's on.
 * Connects to mymymy /radio/public/ endpoints.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const MYMYMY = process.env.NEXT_PUBLIC_MYMYMY_URL || "https://app.mymymy.studio";
const POLL_MS = 25_000; // refresh signed URL before it expires

type Station = { slug: string; name: string; genre: string; tracks: number; bands: string[] };
type SocialLinks = { soundcloud?: string; spotify?: string };
type NowPlaying = {
  slug: string; name: string; genre: string;
  social_links?: SocialLinks;
  track: { title: string; artist: string; duration_ms: number; offset_ms: number; url: string | null; cover_url: string | null; bpm?: number | null; musical_key?: string | null } | null;
  next: { title: string; artist: string } | null;
  full_playback?: boolean;
  preview_seconds?: number | null;
  total_tracks: number;
} | null;

// --- VU meter (canvas, two-channel simulated level) ---
function VuMeter({ playing }: { playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const levelRef = useRef({ l: 0.4, r: 0.35 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;
    const BARS = 20;
    const gap = 2;
    const bw = (W - gap * (BARS - 1)) / BARS;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const ch = Math.floor(H / 2) - 2;

      function drawChannel(yOff: number, level: number) {
        const lit = Math.round(level * BARS);
        for (let i = 0; i < BARS; i++) {
          const x = i * (bw + gap);
          const frac = i / BARS;
          let color: string;
          if (frac < 0.6) color = i < lit ? "#00e060" : "#0a200f";
          else if (frac < 0.85) color = i < lit ? "#e0d000" : "#1a1700";
          else color = i < lit ? "#e03020" : "#1a0500";
          ctx.fillStyle = color;
          ctx.fillRect(x, yOff, bw, ch);
        }
      }

      if (playing) {
        // Natural drift + occasional peak
        levelRef.current.l += (Math.random() - 0.46) * 0.08;
        levelRef.current.r += (Math.random() - 0.47) * 0.07;
        levelRef.current.l = Math.max(0.05, Math.min(0.98, levelRef.current.l));
        levelRef.current.r = Math.max(0.05, Math.min(0.98, levelRef.current.r));
        // occasional quiet dip
        if (Math.random() < 0.015) { levelRef.current.l *= 0.6; levelRef.current.r *= 0.6; }
      } else {
        levelRef.current.l *= 0.92;
        levelRef.current.r *= 0.92;
      }

      drawChannel(0, levelRef.current.l);
      drawChannel(ch + 4, levelRef.current.r);
      frameRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(frameRef.current);
  }, [playing]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={48}
      style={{ imageRendering: "pixelated" }}
      className="w-full"
    />
  );
}

// --- Rotary knob (SVG, photo-real gradient) ---
function Knob({
  value, max, onChange, size = 72, label,
}: {
  value: number; max: number; onChange: (v: number) => void; size?: number; label?: string;
}) {
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);
  const angle = -135 + (value / max) * 270;

  // onChange is a fresh arrow on every parent render, so keep it in a ref.
  // Listing it as a dependency tore the listeners down and rebuilt them on
  // every mouse move — mid-drag.
  const cbRef = useRef(onChange);
  useEffect(() => { cbRef.current = onChange; }, [onChange]);

  const clamp = (v: number) => Math.max(0, Math.min(max, v));

  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startVal.current = value;
    e.preventDefault();
  };

  const onTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    startY.current = e.touches[0].clientY;
    startVal.current = value;
  };

  // A knob that only responds to a vertical drag reads as broken: people click
  // it, nothing happens, and they conclude the volume doesn't work. Wheel,
  // touch and arrow keys all drive it now.
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    cbRef.current(clamp(value + (e.deltaY < 0 ? 0.05 : -0.05) * max));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.2 : 0.05;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); cbRef.current(clamp(value + step * max)); }
    if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); cbRef.current(clamp(value - step * max)); }
    if (e.key === "Home") { e.preventDefault(); cbRef.current(0); }
    if (e.key === "End") { e.preventDefault(); cbRef.current(max); }
  };

  useEffect(() => {
    const move = (clientY: number) => {
      if (!isDragging.current) return;
      const delta = (startY.current - clientY) / 120;
      cbRef.current(clamp(startVal.current + delta * max));
    };
    const onMove = (e: MouseEvent) => move(e.clientY);
    const onTouchMove = (e: TouchEvent) => { if (isDragging.current) move(e.touches[0].clientY); };
    const onUp = () => { isDragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [max]);

  const r = size / 2;
  const ind = {
    x: r + (r - 8) * Math.sin((angle * Math.PI) / 180),
    y: r - (r - 8) * Math.cos((angle * Math.PI) / 180),
  };

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <svg
        width={size} height={size}
        style={{ cursor: "ns-resize", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.7))", outline: "none" }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Number(value.toFixed(2))}
      >
        <defs>
          <radialGradient id={`kg-${label}`} cx="38%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#c8c8c8" />
            <stop offset="35%" stopColor="#787878" />
            <stop offset="70%" stopColor="#383838" />
            <stop offset="100%" stopColor="#0a0a0a" />
          </radialGradient>
          <radialGradient id={`kg2-${label}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>
        {/* outer ring (bezel) */}
        <circle cx={r} cy={r} r={r - 1} fill="#1a1a1a" stroke="#111" strokeWidth="1" />
        {/* knob body */}
        <circle cx={r} cy={r} r={r - 6} fill={`url(#kg-${label})`} />
        {/* gloss overlay */}
        <circle cx={r} cy={r} r={r - 6} fill={`url(#kg2-${label})`} />
        {/* indicator dot */}
        <circle cx={ind.x} cy={ind.y} r={4} fill="#ff8c00" opacity="0.9" />
        <circle cx={ind.x} cy={ind.y} r={2} fill="#ffd080" />
      </svg>
      {label && <div className="text-[9px] uppercase tracking-[0.3em] text-mute">{label}</div>}
    </div>
  );
}

// --- LCD frequency display ---
function LcdDisplay({ genre, station }: { genre: string; station: string }) {
  return (
    <div
      className="relative mx-auto w-full max-w-[280px] rounded-lg px-4 py-2 text-center"
      style={{
        background: "linear-gradient(180deg, #0a1a08 0%, #0f2410 100%)",
        border: "2px solid #0a0a0a",
        boxShadow: "inset 0 2px 6px rgba(0,0,0,0.8), 0 0 12px rgba(0,200,60,0.08)",
      }}
    >
      <div
        className="font-mono text-lg font-bold tracking-[0.2em]"
        style={{ color: "#40ff60", textShadow: "0 0 8px #20ff40, 0 0 20px rgba(40,255,80,0.4)" }}
      >
        THE WIRE
      </div>
      <div
        className="mt-0.5 font-mono text-xs tracking-widest"
        style={{ color: "#30cc50", textShadow: "0 0 6px rgba(40,200,60,0.5)" }}
      >
        {genre ? genre.toUpperCase() : "TUNING…"}
        {station ? ` · ${station.slice(0, 18)}` : ""}
      </div>
    </div>
  );
}

// ---- Main component ----
export default function TheWire() {
  // Track detail lives behind a toggle so the panel stays a radio, not a
  // dashboard. Off by default; the overlay is glass so the player still
  // reads through it.
  const [showInfo, setShowInfo] = useState(false);
  // Set when a preview runs out, so we can offer the upgrade in place.
  const [previewHit, setPreviewHit] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [currentStation, setCurrentStation] = useState<Station | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.75);
  const [loading, setLoading] = useState(true);
  const [noStations, setNoStations] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Which song is currently loaded into the element, by path.
  const trackIdRef = useRef<string | null>(null);
  const genreDialValue = genres.indexOf(selectedGenre ?? "") < 0 ? 0 : genres.indexOf(selectedGenre ?? "");

  // Load public stations
  useEffect(() => {
    (async () => {
      try {
        const [sg, ss] = await Promise.all([
          fetch(`${MYMYMY}/api/radio/public/genres`).then(r => r.json()),
          fetch(`${MYMYMY}/api/radio/public/stations`).then(r => r.json()),
        ]);
        setGenres(Array.isArray(sg) ? sg : []);
        setStations(Array.isArray(ss) ? ss : []);
        if (!Array.isArray(ss) || ss.length === 0) {
          setNoStations(true);
        } else {
          setCurrentStation(ss[0]);
          setSelectedGenre(ss[0]?.genre ?? null);
        }
      } catch {
        setNoStations(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fetchNow = useCallback(async (slug: string) => {
    try {
      const data = await fetch(`${MYMYMY}/api/radio/public/${slug}/now`).then(r => r.json());
      setNowPlaying(data);
      if (data.track?.url && audioRef.current) {
        const a = audioRef.current;
        const wasPlaying = !a.paused;

        // Identify the track by its PATH, not the whole URL. The signed URL is
        // re-issued on every poll, so comparing full URLs said "new track"
        // every 25 seconds: the element reloaded and playback restarted mid-song,
        // over and over. Only swap the source when the song genuinely changes.
        const id = String(data.track.url).split("?")[0];
        if (trackIdRef.current !== id) {
          trackIdRef.current = id;
          setPreviewHit(false);
          a.src = data.track.url;
          a.currentTime = (data.track.offset_ms ?? 0) / 1000;
          if (wasPlaying) a.play().catch(() => {});
        }
        a.volume = volume;
      }
    } catch { /* network blip */ }
  }, [volume]);

  // Switch station
  useEffect(() => {
    if (!currentStation) return;
    fetchNow(currentStation.slug);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchNow(currentStation.slug), POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [currentStation, fetchNow]);

  // Genre dial changes → pick first station of that genre
  const onGenreDial = (v: number) => {
    if (!genres.length) return;
    const idx = Math.round((v / genres.length) * (genres.length - 1));
    const g = genres[Math.min(idx, genres.length - 1)];
    setSelectedGenre(g);
    const match = stations.find(s => s.genre?.toLowerCase() === g?.toLowerCase());
    if (match) setCurrentStation(match);
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a || !nowPlaying?.track?.url) return;
    if (a.paused) {
      if (!a.src || a.src !== nowPlaying.track.url) {
        a.src = nowPlaying.track.url;
        a.currentTime = (nowPlaying.track.offset_ms ?? 0) / 1000;
      }
      a.play().catch(() => {});
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  const onVolume = (v: number) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  // Panel background — brushed aluminum dark
  const panelStyle: React.CSSProperties = {
    background: "linear-gradient(160deg, #2a2a2e 0%, #1a1a1c 40%, #0f0f10 100%)",
    border: "2px solid #111",
    boxShadow: "0 8px 32px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.5)",
  };

  const trackLabel = nowPlaying?.track
    ? `${nowPlaying.track.artist ?? "Unknown"} — ${nowPlaying.track.title ?? "Untitled"}`
    : noStations
    ? "Stations going live as bands join the ring"
    : "Loading…";

  return (
    <div className="rounded-2xl p-4 sm:p-6 w-full max-w-[420px] mx-auto" style={panelStyle}>
      {/* branding strip */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[9px] uppercase tracking-[0.5em] text-mute">ROADIE</div>
          <div className="text-xs font-black tracking-[0.3em]" style={{ color: "#ff3d6e" }}>THE WIRE</div>
        </div>
        <div className="flex items-center gap-2">
          {playing && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ background: "#ff3d6e" }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#ff3d6e" }} />
            </span>
          )}
          <div className="text-[9px] text-mute">{playing ? "LIVE" : "OFF AIR"}</div>
        </div>
      </div>

      {/* LCD display */}
      <LcdDisplay genre={currentStation?.genre ?? ""} station={currentStation?.name ?? ""} />

      {/* VU meter */}
      <div className="mt-3 rounded-lg p-2" style={{ background: "rgba(0,0,0,0.5)", border: "1px solid #1a1a1a" }}>
        <div className="text-[8px] uppercase tracking-[0.4em] text-mute mb-1">VU</div>
        <VuMeter playing={playing} />
      </div>

      {/* Dials row */}
      <div className="mt-4 flex items-end justify-around">
        <Knob
          value={Math.max(0, genreDialValue)}
          max={Math.max(1, genres.length - 1)}
          onChange={onGenreDial}
          size={72}
          label="Genre"
        />

        {/* Play/Stop — big center button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={togglePlay}
            disabled={noStations || loading}
            style={{
              width: 56, height: 56,
              background: playing
                ? "radial-gradient(circle at 40% 35%, #ff6060, #880000)"
                : "radial-gradient(circle at 40% 35%, #80ff80, #006600)",
              boxShadow: playing
                ? "0 4px 12px rgba(255,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.2)"
                : "0 4px 12px rgba(0,200,0,0.4), inset 0 1px 2px rgba(255,255,255,0.2)",
              borderRadius: "50%",
              border: "3px solid #111",
              cursor: noStations ? "not-allowed" : "pointer",
              transition: "all 0.15s",
              opacity: noStations || loading ? 0.4 : 1,
            }}
            aria-label={playing ? "Stop" : "Play"}
          >
            <span className="text-white text-xl font-bold" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
              {playing ? "■" : "▶"}
            </span>
          </button>
          <div className="text-[9px] uppercase tracking-[0.3em] text-mute">
            {loading ? "Loading" : playing ? "Stop" : "Play"}
          </div>
        </div>

        <Knob value={volume} max={1} onChange={onVolume} size={72} label="Volume" />
      </div>

      {/* Preview ran out — the offer, in place, on the glass. Not a modal:
          the player stays visible so it is obvious what you are buying. */}
      {previewHit && (
        <div className="mt-3 rounded-xl px-4 py-3 text-center"
          style={{
            background: "rgba(18,18,24,0.55)",
            backdropFilter: "blur(14px) saturate(160%)",
            WebkitBackdropFilter: "blur(14px) saturate(160%)",
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), 0 8px 28px rgba(0,0,0,0.55)",
          }}>
          <div className="text-[9px] uppercase tracking-[0.4em] text-mute">preview over</div>
          <div className="text-sm text-white mt-1">Hear the whole song — $1 a month.</div>
          <div className="text-[11px] text-mute mt-0.5">Every track on The Wire, end to end.</div>
          <a href="/api/auth/sso/start"
            className="inline-block mt-2 rounded-full px-4 py-1.5 text-xs font-bold"
            style={{ background: "#ff3d6e", color: "#0b0b0f" }}>
            Upgrade for $1
          </a>
        </div>
      )}

      {/* Station chips.
          Built from STATIONS, not from genres. Built from genres, a station
          with no genre set has no chip at all — which is what happened to ADAM
          Radio: it is the default station, so you heard it playing with nothing
          on screen to select it and no way back once you left. A chip per
          station means nothing can be orphaned by missing data. Labelled by
          genre when there is one, by station name when there isn't. */}
      {stations.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1 justify-center">
          {stations.map(st => {
            const active = currentStation?.slug === st.slug;
            const label = st.genre || st.name.replace(/\s*Radio$/i, "");
            return (
              <button
                key={st.slug}
                onClick={() => { setCurrentStation(st); setSelectedGenre(st.genre ?? null); }}
                title={`${st.name}${st.genre ? " — " + st.genre : ""} · ${st.tracks} tracks`}
                className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-widest transition ${
                  active ? "text-black font-bold"
                         : "border border-white/15 text-mute hover:border-white/30 hover:text-ink"
                }`}
                style={active ? { background: "#ff3d6e" } : {}}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Now playing */}
      <div className="mt-3 rounded-lg px-3 py-2 relative" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid #1a1a1a" }}>
        <div className="flex items-center justify-between">
          <div className="text-[8px] uppercase tracking-[0.4em] text-mute">Now on the wire</div>
          {/* Only offered when there is something to show. A toggle that opens
              an empty panel is worse than no toggle. */}
          {(nowPlaying?.track?.bpm || nowPlaying?.track?.musical_key) && (
            <button onClick={() => setShowInfo(v => !v)}
              aria-pressed={showInfo}
              className="text-[8px] uppercase tracking-[0.3em] px-2 py-0.5 rounded-full transition-colors"
              style={{
                color: showInfo ? "#ff3d6e" : "#6a6a78",
                border: "1px solid " + (showInfo ? "rgba(255,61,110,0.45)" : "rgba(255,255,255,0.10)"),
                background: showInfo ? "rgba(255,61,110,0.10)" : "rgba(255,255,255,0.03)",
              }}>
              info
            </button>
          )}
        </div>

        {/* Apple-glass overlay: blurred, semi-transparent, sits over the plate
            rather than pushing the layout around when it opens. */}
        {showInfo && (nowPlaying?.track?.bpm || nowPlaying?.track?.musical_key) && (
          <div className="absolute inset-0 z-10 rounded-lg flex items-center justify-center gap-6 px-4"
            style={{
              background: "rgba(18,18,24,0.55)",
              backdropFilter: "blur(14px) saturate(160%)",
              WebkitBackdropFilter: "blur(14px) saturate(160%)",
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), 0 8px 28px rgba(0,0,0,0.55)",
            }}
            onClick={() => setShowInfo(false)}>
            {nowPlaying?.track?.musical_key && (
              <div className="text-center">
                <div className="text-[8px] uppercase tracking-[0.4em] text-mute">key</div>
                <div className="text-xl font-black text-white">{nowPlaying.track.musical_key}</div>
              </div>
            )}
            {nowPlaying?.track?.bpm && (
              <div className="text-center">
                <div className="text-[8px] uppercase tracking-[0.4em] text-mute">bpm</div>
                <div className="text-xl font-black text-white">{nowPlaying.track.bpm}</div>
              </div>
            )}
          </div>
        )}
        <div className="mt-1.5 flex items-center gap-3">
          {nowPlaying?.track?.cover_url ? (
            <img
              src={nowPlaying.track.cover_url}
              alt={nowPlaying.track.title ?? "cover"}
              className="h-12 w-12 shrink-0 rounded object-cover"
              style={{ border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 2px 8px rgba(0,0,0,0.6)" }}
            />
          ) : nowPlaying?.track ? (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded text-xl"
              style={{ background: "rgba(255,61,110,0.15)", border: "1px solid rgba(255,61,110,0.2)" }}>
              &#9834;
            </div>
          ) : null}
          <div className="min-w-0">
            <div className="truncate text-xs text-ink">{trackLabel}</div>
            {nowPlaying?.next && (
              <div className="mt-0.5 truncate text-[9px] text-mute">
                Up: {nowPlaying.next.artist} — {nowPlaying.next.title}
              </div>
            )}
          </div>
        </div>

        {/* Social links — pause Wire before opening so nothing overlaps */}
        {nowPlaying?.social_links && Object.keys(nowPlaying.social_links).length > 0 && (
          <div className="mt-2.5 flex gap-2">
            {nowPlaying.social_links.soundcloud && (
              <button
                onClick={() => {
                  audioRef.current?.pause();
                  setPlaying(false);
                  window.open(nowPlaying.social_links!.soundcloud, "_blank",
                    "width=460,height=700,noopener,noreferrer");
                }}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-medium tracking-widest transition-all active:scale-95"
                style={{
                  background: "rgba(255,85,0,0.10)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,85,0,0.25)",
                  color: "rgba(255,120,50,0.9)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.85 }}>
                  <path d="M11.56 8.87V17h8.76c.97 0 1.68-.64 1.68-1.57 0-.93-.68-1.56-1.68-1.56-.1 0-.2.01-.3.03.07-.27.11-.56.11-.85 0-1.87-1.52-3.38-3.38-3.38-.78 0-1.5.27-2.06.72-.44-1.14-1.56-1.94-2.87-1.94-.22 0-.44.03-.65.08.25.47.39 1 .39 1.34zm-1.35 1.04c-.07-.36-.1-.72-.1-1.04C10.11 6.28 8.27 4.5 6 4.5c-2.27 0-4.11 1.78-4.11 4.37 0 .32.03.62.09.9-.06 0-.12-.01-.19-.01C.81 9.76 0 10.54 0 11.5s.81 1.74 1.79 1.74H9.5c.61 0 1.11-.48 1.11-1.07V9.91z"/>
                </svg>
                SoundCloud
              </button>
            )}
            {nowPlaying.social_links.spotify && (
              <button
                onClick={() => {
                  audioRef.current?.pause();
                  setPlaying(false);
                  window.open(nowPlaying.social_links!.spotify, "_blank",
                    "width=460,height=700,noopener,noreferrer");
                }}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-medium tracking-widest transition-all active:scale-95"
                style={{
                  background: "rgba(30,215,96,0.08)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  border: "1px solid rgba(30,215,96,0.22)",
                  color: "rgba(40,220,100,0.9)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.85 }}>
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                Spotify
              </button>
            )}
          </div>
        )}
      </div>

      {/* When a song ends, ask for the next one immediately. Without this the
          wire went quiet until the 25-second poll came round. */}
      <audio ref={audioRef} preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { trackIdRef.current = null; if (currentStation) fetchNow(currentStation.slug); }}
        onTimeUpdate={e => {
          // Fans hear a preview. Measured from where the shared clock dropped
          // them in, not from zero — otherwise joining mid-song would cut off
          // instantly and look broken rather than limited.
          const lim = nowPlaying?.preview_seconds;
          if (!lim || nowPlaying?.full_playback) return;
          const a = e.currentTarget;
          const started = (nowPlaying?.track?.offset_ms ?? 0) / 1000;
          if (a.currentTime - started >= lim) { a.pause(); setPreviewHit(true); }
        }}
        onError={() => { trackIdRef.current = null; }} />
    </div>
  );
}
