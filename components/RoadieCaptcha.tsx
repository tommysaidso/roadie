"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const INSTRUMENTS = [
  {
    name: "GUITAR", label: "guitar", w: 58, h: 120,
    svg: `<svg viewBox="0 0 58 120" width="58" height="120" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="0" width="18" height="12" rx="4"/>
      <circle cx="16" cy="3" r="3.5"/><circle cx="16" cy="9.5" r="3.5"/>
      <circle cx="42" cy="3" r="3.5"/><circle cx="42" cy="9.5" r="3.5"/>
      <rect x="26" y="11" width="6" height="62"/>
      <rect x="18" y="63" width="22" height="14" rx="3"/>
      <ellipse cx="29" cy="80" rx="17" ry="14"/>
      <rect x="18" y="79" width="22" height="18"/>
      <ellipse cx="29" cy="104" rx="21" ry="16"/>
    </svg>`,
  },
  {
    name: "MICROPHONE", label: "mic", w: 50, h: 115,
    svg: `<svg viewBox="0 0 50 115" width="50" height="115" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <rect x="13" y="2" width="24" height="42" rx="12"/>
      <rect x="18" y="43" width="14" height="32"/>
      <rect x="14" y="73" width="22" height="6" rx="3"/>
      <rect x="22" y="78" width="6" height="18"/>
      <rect x="4" y="93" width="42" height="6" rx="3"/>
      <rect x="2" y="99" width="14" height="5" rx="2.5" transform="rotate(-18 9 101)"/>
      <rect x="34" y="99" width="14" height="5" rx="2.5" transform="rotate(18 41 101)"/>
    </svg>`,
  },
  {
    name: "DRUM KIT", label: "drum kit", w: 108, h: 82,
    svg: `<svg viewBox="0 0 108 82" width="108" height="82" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="52" cy="62" rx="28" ry="18"/>
      <rect x="24" y="62" width="56" height="14" rx="2"/>
      <ellipse cx="52" cy="76" rx="28" ry="10"/>
      <ellipse cx="38" cy="38" rx="14" ry="9"/>
      <rect x="24" y="38" width="28" height="12" rx="1"/>
      <ellipse cx="38" cy="50" rx="14" ry="7"/>
      <ellipse cx="90" cy="54" rx="14" ry="9"/>
      <rect x="76" y="54" width="28" height="14" rx="1"/>
      <ellipse cx="90" cy="68" rx="14" ry="7"/>
      <ellipse cx="14" cy="50" rx="12" ry="8"/>
      <rect x="2" y="50" width="24" height="10" rx="1"/>
      <ellipse cx="14" cy="60" rx="12" ry="6"/>
      <ellipse cx="6" cy="20" rx="12" ry="4"/>
      <ellipse cx="6" cy="25" rx="12" ry="4"/>
      <ellipse cx="100" cy="18" rx="10" ry="3"/>
    </svg>`,
  },
  {
    name: "BASS", label: "bass guitar", w: 54, h: 120,
    svg: `<svg viewBox="0 0 54 120" width="54" height="120" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <rect x="17" y="0" width="20" height="14" rx="4"/>
      <circle cx="13" cy="3.5" r="3.5"/><circle cx="13" cy="10" r="3.5"/>
      <circle cx="41" cy="3.5" r="3.5"/><circle cx="41" cy="10" r="3.5"/>
      <rect x="22" y="13" width="10" height="58"/>
      <rect x="16" y="65" width="22" height="14" rx="3"/>
      <path d="M16,70 L2,74 L2,85 L16,88 Z"/>
      <rect x="2" y="74" width="50" height="24" rx="4"/>
      <rect x="10" y="94" width="40" height="24" rx="6"/>
    </svg>`,
  },
  {
    name: "AMP", label: "amp", w: 96, h: 84,
    svg: `<svg viewBox="0 0 96 84" width="96" height="84" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="10" width="92" height="72" rx="6"/>
      <rect x="32" y="4" width="32" height="10" rx="4"/>
      <rect x="38" y="0" width="20" height="6" rx="3"/>
      <circle cx="44" cy="46" r="26" fill="none" stroke="rgba(11,11,15,0.35)" strokeWidth="5"/>
      <circle cx="44" cy="46" r="16" fill="none" stroke="rgba(11,11,15,0.2)" strokeWidth="3"/>
      <rect x="76" y="18" width="12" height="52" rx="3"/>
    </svg>`,
  },
];

const CLEAR_POS = {
  position: "", left: "", top: "", width: "", height: "", margin: "", zIndex: "", transition: "",
} as const;

interface Props {
  onVerified: () => void;
}

export default function RoadieCaptcha({ onVerified }: Props) {
  const [instr, setInstr] = useState(INSTRUMENTS[0]);
  const [spot, setSpot] = useState({ x: 50, y: 40 });
  const [success, setSuccess] = useState(false);

  const instrRef = useRef<HTMLDivElement>(null);
  const spotRef  = useRef<HTMLDivElement>(null);
  const locked   = useRef(false);
  const dragging = useRef(false);
  const orig     = useRef({ left: 0, top: 0 });
  const grab     = useRef({ x: 0, y: 0 });

  const reset = useCallback(() => {
    setInstr(INSTRUMENTS[Math.floor(Math.random() * INSTRUMENTS.length)]);
    setSpot({ x: 24 + Math.random() * 52, y: 18 + Math.random() * 48 });
    setSuccess(false);
    locked.current = false;
    if (instrRef.current) Object.assign(instrRef.current.style, CLEAR_POS);
  }, []);

  useEffect(() => { reset(); }, [reset]);

  const startDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (locked.current || !instrRef.current || !spotRef.current) return;
    e.preventDefault();

    const px = "touches" in e ? e.touches[0].clientX : e.clientX;
    const py = "touches" in e ? e.touches[0].clientY : e.clientY;
    const r  = instrRef.current.getBoundingClientRect();

    orig.current = { left: r.left, top: r.top };
    grab.current = { x: px - r.left, y: py - r.top };

    Object.assign(instrRef.current.style, {
      position: "fixed", left: r.left + "px", top: r.top + "px",
      width: r.width + "px", height: r.height + "px",
      margin: "0", zIndex: "9999", transition: "none",
    });
    dragging.current = true;

    function move(ev: MouseEvent | TouchEvent) {
      if (!dragging.current || !instrRef.current) return;
      ev.preventDefault();
      const x = "touches" in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const y = "touches" in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
      instrRef.current.style.left = x - grab.current.x + "px";
      instrRef.current.style.top  = y - grab.current.y + "px";
    }

    function end() {
      if (!dragging.current || !instrRef.current || !spotRef.current) return;
      dragging.current = false;
      cleanup();

      const ir = instrRef.current.getBoundingClientRect();
      const sr = spotRef.current.getBoundingClientRect();
      const dist = Math.hypot(
        (ir.left + ir.width  / 2) - (sr.left + sr.width  / 2),
        (ir.top  + ir.height / 2) - (sr.top  + sr.height / 2),
      );

      if (dist <= 62) {
        locked.current = true;
        Object.assign(instrRef.current.style, {
          transition: "left 0.22s ease, top 0.22s ease",
          left: sr.left + sr.width  / 2 - ir.width  / 2 + "px",
          top:  sr.top  + sr.height / 2 - ir.height / 2 + "px",
          zIndex: "50",
        });
        setTimeout(() => { setSuccess(true); setTimeout(onVerified, 820); }, 300);
      } else {
        Object.assign(instrRef.current.style, {
          transition: "left 0.4s cubic-bezier(0.34,1.5,0.64,1), top 0.4s cubic-bezier(0.34,1.5,0.64,1)",
          left: orig.current.left + "px",
          top:  orig.current.top  + "px",
        });
        setTimeout(() => {
          if (instrRef.current) Object.assign(instrRef.current.style, CLEAR_POS);
        }, 430);
      }
    }

    function cleanup() {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup",   end);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend",  end);
    }

    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup",   end);
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend",  end);
  }, [onVerified]);

  return (
    <div className="rounded-xl overflow-hidden border border-edge select-none">

      {/* ── Stage ── */}
      <div className="relative bg-ink overflow-hidden" style={{ height: 188 }}>

        {/* Light beams (triangles via border trick) */}
        <div className="absolute top-0 left-[17%] pointer-events-none"
          style={{ width:0, height:0, borderLeft:"22px solid transparent", borderRight:"22px solid transparent", borderTop:"188px solid rgba(255,61,110,0.04)" }}/>
        <div className="absolute top-0 left-[54%] pointer-events-none"
          style={{ width:0, height:0, borderLeft:"34px solid transparent", borderRight:"34px solid transparent", borderTop:"188px solid rgba(61,240,255,0.025)" }}/>
        <div className="absolute top-0 right-[13%] pointer-events-none"
          style={{ width:0, height:0, borderLeft:"16px solid transparent", borderRight:"16px solid transparent", borderTop:"188px solid rgba(255,61,110,0.03)" }}/>

        {/* Spotlight glow */}
        <div className="absolute pointer-events-none" style={{
          left: `${spot.x}%`, top: `${spot.y}%`,
          width: 130, height: 130,
          transform: "translate(-50%,-50%)",
          borderRadius: "50%",
          background: success
            ? "radial-gradient(circle, rgba(61,220,132,0.38) 0%, rgba(61,220,132,0.1) 40%, transparent 70%)"
            : "radial-gradient(circle, rgba(255,61,110,0.3) 0%, rgba(255,61,110,0.09) 40%, transparent 72%)",
          transition: "background 0.35s",
        }}/>

        {/* Target ring (also the hit-test ref) */}
        <div ref={spotRef} className="absolute pointer-events-none" style={{
          left: `${spot.x}%`, top: `${spot.y}%`,
          width: 72, height: 72,
          transform: "translate(-50%,-50%)",
          borderRadius: "50%",
          border: success ? "none" : "2px dashed rgba(255,61,110,0.5)",
          animation: success ? "none" : "rc-pulse 2.6s ease-in-out infinite",
        }}/>

        {/* PLACE HERE label */}
        {!success && (
          <div className="absolute pointer-events-none text-[8px] font-bold tracking-[0.22em] uppercase"
            style={{
              left: `${spot.x}%`, top: `calc(${spot.y}% + 44px)`,
              transform: "translateX(-50%)",
              color: "rgba(255,61,110,0.4)", whiteSpace: "nowrap",
            }}>
            PLACE HERE
          </div>
        )}

        {/* Stage floor planks */}
        <div className="absolute bottom-0 left-0 right-0 h-6 border-t border-white/[0.04] pointer-events-none"
          style={{ background: "repeating-linear-gradient(90deg,rgba(60,40,15,0.2) 0,rgba(60,40,15,0.2) 1px,transparent 1px,transparent 42px)" }}/>

        {/* Success overlay */}
        {success && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20"
            style={{ background: "rgba(11,11,15,0.92)", backdropFilter: "blur(6px)", animation: "rc-fadein 0.35s ease" }}>
            <div className="w-12 h-12 rounded-full bg-moss flex items-center justify-center mb-3"
              style={{ animation: "rc-pop 0.32s cubic-bezier(0.175,0.885,0.32,1.4) both" }}>
              <svg fill="none" stroke="#0b0b0f" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width={22} height={22}>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div className="text-moss font-bold tracking-widest uppercase mb-1"
              style={{ fontFamily: "Impact, Arial Narrow, sans-serif", fontSize: 21, letterSpacing: "0.07em" }}>
              Roadie Verified
            </div>
            <div className="text-muted text-xs tracking-wide">You&rsquo;re cleared.</div>
          </div>
        )}
      </div>

      {/* ── Info strip ── */}
      <div className="px-4 py-3 bg-panel border-t border-edge">
        <p className="text-[9.5px] text-muted tracking-[0.2em] uppercase font-bold mb-1">Are you a roadie?</p>
        <p className="text-sm text-white/80">
          Drag the <span className="text-neon font-bold">{instr.name}</span> onto the stage
        </p>
      </div>

      {/* ── Gear crate ── */}
      <div className="relative bg-panel2 border-t border-edge flex items-center justify-center" style={{ height: 128 }}>
        <div className="absolute top-2 left-3 text-[8px] font-bold tracking-[0.26em] uppercase text-white/18">GEAR</div>

        <div
          ref={instrRef}
          onMouseDown={startDrag}
          onTouchStart={startDrag}
          className="flex items-center justify-center relative z-10"
          style={{ cursor: "grab", touchAction: "none", color: "#ff3d6e" }}
          dangerouslySetInnerHTML={{ __html: instr.svg }}
        />

        <button
          onClick={reset}
          className="absolute bottom-2 right-3 text-[10px] tracking-wide text-white/25 hover:text-neon transition-colors duration-150"
        >
          different one
        </button>
      </div>

      <style>{`
        @keyframes rc-pulse {
          0%,100% { opacity:.45; transform:translate(-50%,-50%) scale(1); }
          50%      { opacity:.8;  transform:translate(-50%,-50%) scale(1.12); }
        }
        @keyframes rc-fadein { from{opacity:0} to{opacity:1} }
        @keyframes rc-pop {
          from { transform:scale(0); opacity:0 }
          to   { transform:scale(1); opacity:1 }
        }
      `}</style>
    </div>
  );
}
