"use client";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Mic, Square, Play, Wand2, UploadCloud, Sparkles, RotateCcw } from "lucide-react";
import Tuner from "./Tuner";

type P = { hp:number; low:number; mid:number; midF:number; high:number; comp:number; gain:number; normalize:boolean; limit:boolean; };
const CLEAN:P = { hp:70, low:1.5, mid:2, midF:2500, high:3, comp:18, gain:1, normalize:true, limit:true };
const FLAT:P  = { hp:20, low:0, mid:0, midF:1500, high:0, comp:0, gain:0, normalize:false, limit:false };
const KINDS = [
  ["idea", "Idea"],
  ["rehearsal", "Rehearsal"],
  ["live", "Live"],
  ["acoustic", "Acoustic"],
  ["sample", "Sample"],
] as const;

function encodeWAV(buf:AudioBuffer):Blob{
  const ch=Math.min(2,buf.numberOfChannels), sr=buf.sampleRate, n=buf.length;
  const data=new DataView(new ArrayBuffer(44+n*ch*2));
  const w=(o:number,s:string)=>{for(let i=0;i<s.length;i++)data.setUint8(o+i,s.charCodeAt(i));};
  w(0,"RIFF");data.setUint32(4,36+n*ch*2,true);w(8,"WAVE");w(12,"fmt ");
  data.setUint32(16,16,true);data.setUint16(20,1,true);data.setUint16(22,ch,true);
  data.setUint32(24,sr,true);data.setUint32(28,sr*ch*2,true);data.setUint16(32,ch*2,true);data.setUint16(34,16,true);
  w(36,"data");data.setUint32(40,n*ch*2,true);
  let off=44;
  const chans=[]; for(let c=0;c<ch;c++)chans.push(buf.getChannelData(c));
  for(let i=0;i<n;i++)for(let c=0;c<ch;c++){let v=Math.max(-1,Math.min(1,chans[c][i]));data.setInt16(off,v<0?v*0x8000:v*0x7fff,true);off+=2;}
  return new Blob([data],{type:"audio/wav"});
}

// Build + render the master chain into a new buffer (offline).
async function master(src:AudioBuffer, p:P):Promise<AudioBuffer>{
  const ch=Math.min(2,src.numberOfChannels);
  const ctx=new OfflineAudioContext(ch, src.length, src.sampleRate);
  const s=ctx.createBufferSource(); s.buffer=src;
  const hp=ctx.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=p.hp;
  const low=ctx.createBiquadFilter(); low.type="lowshelf"; low.frequency.value=120; low.gain.value=p.low;
  const mid=ctx.createBiquadFilter(); mid.type="peaking"; mid.frequency.value=p.midF; mid.Q.value=1; mid.gain.value=p.mid;
  const high=ctx.createBiquadFilter(); high.type="highshelf"; high.frequency.value=8000; high.gain.value=p.high;
  const comp=ctx.createDynamicsCompressor();
  comp.threshold.value=-1*p.comp; comp.knee.value=24; comp.ratio.value=p.comp>0?3:1; comp.attack.value=0.005; comp.release.value=0.2;
  const g=ctx.createGain(); g.gain.value=Math.pow(10,p.gain/20);
  // soft limiter (tanh) to kill clipping
  const lim=ctx.createWaveShaper();
  if(p.limit){const N=1024,c=new Float32Array(N);for(let i=0;i<N;i++){const x=(i/(N-1))*2-1;c[i]=Math.tanh(x*1.6)/Math.tanh(1.6);}lim.curve=c;}
  s.connect(hp);hp.connect(low);low.connect(mid);mid.connect(high);high.connect(comp);comp.connect(g);
  if(p.limit){g.connect(lim);lim.connect(ctx.destination);} else g.connect(ctx.destination);
  s.start();
  let out=await ctx.startRendering();
  if(p.normalize){ // peak-normalize to -1 dBFS
    let peak=1e-6; for(let c=0;c<out.numberOfChannels;c++){const d=out.getChannelData(c);for(let i=0;i<d.length;i++)peak=Math.max(peak,Math.abs(d[i]));}
    const k=0.89/peak; if(k<1.5)for(let c=0;c<out.numberOfChannels;c++){const d=out.getChannelData(c);for(let i=0;i<d.length;i++)d[i]*=k;}
  }
  return out;
}

export default function FloorStudio(){
  const [title,setTitle]=useState("Floor session");
  const [kind,setKind]=useState("idea");
  const [rec,setRec]=useState(false);
  const [blob,setBlob]=useState<Blob|null>(null);
  const [buf,setBuf]=useState<AudioBuffer|null>(null);
  const [p,setP]=useState<P>(CLEAN);
  const [busy,setBusy]=useState("");
  const [sessions,setSessions]=useState<any[]>([]);
  const [elapsed,setElapsed]=useState(0);
  const mr=useRef<MediaRecorder|null>(null); const chunks=useRef<Blob[]>([]); const timer=useRef<any>(null);
  const ac=useRef<AudioContext|null>(null); const playing=useRef<AudioBufferSourceNode|null>(null);

  useEffect(()=>{ load(); },[]);
  async function load(){
    const r=await fetch("/api/sessions?mine=1", { cache:"no-store" });
    const d=await r.json();
    setSessions(d.sessions||[]);
  }

  async function start(){
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
      chunks.current=[]; const m=new MediaRecorder(stream); mr.current=m;
      m.ondataavailable=e=>{ if(e.data.size)chunks.current.push(e.data); };
      m.onstop=async()=>{ const b=new Blob(chunks.current,{type:m.mimeType||"audio/webm"}); setBlob(b);
        const arr=await b.arrayBuffer(); const c=new (window.AudioContext||(window as any).webkitAudioContext)(); ac.current=c;
        try{ setBuf(await c.decodeAudioData(arr)); }catch{ setBusy("Couldn't decode that recording — try again."); }
        stream.getTracks().forEach(t=>t.stop());
      };
      m.start(); setRec(true); setElapsed(0); timer.current=setInterval(()=>setElapsed(e=>e+1),1000);
    }catch{ setBusy("Mic blocked — allow microphone access (needs https or localhost)."); }
  }
  function stop(){ mr.current?.stop(); setRec(false); clearInterval(timer.current); }

  function stopPlay(){ try{ playing.current?.stop(); }catch{} playing.current=null; }
  async function preview(which:"orig"|"master"){
    if(!buf)return; stopPlay();
    const c=ac.current||new AudioContext(); ac.current=c; await c.resume();
    const data= which==="orig"? buf : await master(buf,p);
    const src=c.createBufferSource(); src.buffer=data; src.connect(c.destination); src.start(); playing.current=src;
  }
  async function publish(){
    if(!buf)return; setBusy("Mastering…"); stopPlay();
    const rendered=await master(buf,p); const wav=encodeWAV(rendered);
    const b64=await new Promise<string>(res=>{const r=new FileReader();r.onload=()=>res(String(r.result));r.readAsDataURL(wav);});
    setBusy("Uploading to the bucket…");
    await fetch("/api/sessions",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({title,kind,mime:"audio/wav",duration_ms:Math.round((buf.duration||elapsed)*1000),enhanced:true,audioBase64:b64})});
    setBusy("Saved ✓"); setBlob(null); setBuf(null); load(); setTimeout(()=>setBusy(""),1500);
  }

  const Slider=({label,val,min,max,step,set,suffix}:any)=>(
    <div className="flex items-center gap-2"><span className="text-xs text-muted w-24 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step||1} value={val} onChange={e=>set(Number(e.target.value))} className="flex-1"/>
      <span className="text-xs w-12 text-right">{val}{suffix||""}</span></div>
  );

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="label">Record off the floor</div>
        </div>
        <div className="space-y-2 mb-3">
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Session title" className="bg-ink border border-edge rounded-lg px-2 py-1.5 text-sm"/>
          <div className="flex flex-wrap gap-1.5" aria-label="Take type">
            {KINDS.map(([value,label])=>(
              <button
                key={value}
                type="button"
                onClick={()=>setKind(value)}
                className={`pill text-xs ${kind===value ? "border-neon text-white" : "text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!rec
            ? <button onClick={start} className="btn btn-neon flex items-center gap-1"><Mic size={16}/>Record</button>
            : <button onClick={stop} className="btn flex items-center gap-1 animate-pulse" style={{borderColor:"#ff3d6e",color:"#ff3d6e"}}><Square size={16}/>Stop</button>}
          <span className="font-mono text-lg">{String(Math.floor(elapsed/60)).padStart(2,"0")}:{String(elapsed%60).padStart(2,"0")}</span>
          {buf && <span className="text-xs text-moss">take ready ({buf.duration.toFixed(1)}s)</span>}
        </div>
        <div className="text-[11px] text-muted mt-2">Phone mic works great for riffs, samples, rehearsals, campfire jams, and room takes. Capture and cleanup happen on-device.</div>
        <div className="mt-2 rounded-lg border border-edge bg-panel2 px-3 py-2 text-[11px] text-muted">
          Saves privately to your ROADIE account as a take, then the Deck button opens it in mymymy for sampler, mixer, stems, and ACE.
        </div>
        {busy && <div className="text-sm mt-3" style={{color:busy.includes("✓")?"#3ddc84":"#ffb33d"}}>{busy}</div>}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="label">Clean it up</div>
          <div className="flex gap-2">
            <button onClick={()=>setP(CLEAN)} className="btn text-xs flex items-center gap-1"><Wand2 size={13}/>Auto-clean</button>
            <button onClick={()=>setP(FLAT)} className="btn text-xs flex items-center gap-1"><RotateCcw size={13}/>Flat</button>
          </div>
        </div>
        <div className="space-y-2">
          <Slider label="Rumble cut" val={p.hp} min={20} max={300} set={(v:number)=>setP({...p,hp:v})} suffix="Hz"/>
          <Slider label="Low" val={p.low} min={-12} max={12} step={0.5} set={(v:number)=>setP({...p,low:v})} suffix="dB"/>
          <Slider label="Mid" val={p.mid} min={-12} max={12} step={0.5} set={(v:number)=>setP({...p,mid:v})} suffix="dB"/>
          <Slider label="Mid freq" val={p.midF} min={300} max={5000} step={50} set={(v:number)=>setP({...p,midF:v})} suffix="Hz"/>
          <Slider label="High / air" val={p.high} min={-12} max={12} step={0.5} set={(v:number)=>setP({...p,high:v})} suffix="dB"/>
          <Slider label="Compress" val={p.comp} min={0} max={30} set={(v:number)=>setP({...p,comp:v})}/>
          <Slider label="Output" val={p.gain} min={-6} max={12} step={0.5} set={(v:number)=>setP({...p,gain:v})} suffix="dB"/>
          <div className="flex gap-4 pt-1">
            <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={p.normalize} onChange={e=>setP({...p,normalize:e.target.checked})}/> Normalize</label>
            <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={p.limit} onChange={e=>setP({...p,limit:e.target.checked})}/> De-clip limiter</label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button disabled={!buf} onClick={()=>preview("orig")} className="btn text-sm flex items-center gap-1"><Play size={14}/>Raw</button>
          <button disabled={!buf} onClick={()=>preview("master")} className="btn text-sm flex items-center gap-1"><Play size={14}/>Cleaned</button>
          <button disabled={!buf} onClick={stopPlay} className="btn text-sm">Stop</button>
          <button disabled={!buf} onClick={publish} className="btn btn-neon text-sm flex items-center gap-1"><UploadCloud size={14}/>Save take</button>
        </div>
        <div className="text-[11px] text-muted mt-3 flex items-center gap-1"><Sparkles size={12} className="text-neon"/>AI upscale / neural enhance runs on mymymy when connected — flips the take to studio-grade. Browser cleanup ships now.</div>
      </div>

      <div className="card p-5 lg:col-span-2">
        <div className="label mb-2">Saved takes</div>
        {sessions.length? sessions.map((s:any)=>(
          <div key={s.id} className="flex items-center justify-between gap-3 py-2 border-b border-edge last:border-0 flex-wrap">
            <div><span className="font-medium">{s.title}</span> <span className="text-xs text-muted">· {s.kind}{s.band?` · ${s.band}`:""}{s.enhanced?" · cleaned":""}</span></div>
            <div className="flex items-center gap-2">
              <audio controls preload="none" src={`/api/sessions/audio?key=${s.audio_key}`} style={{height:32}}/>
              <a
                href={`/api/sessions/deck?key=${encodeURIComponent(s.audio_key)}`}
                className="btn text-xs flex items-center gap-1"
                title="Open this take in the mymymy Deck mixer, sampler and ACE tools"
              >
                <ExternalLink size={13}/> Deck
              </a>
            </div>
          </div>
        )) : <div className="text-sm text-muted">No takes yet — record one above.</div>}
      </div>
      <Tuner />
    </div>
  );
}
