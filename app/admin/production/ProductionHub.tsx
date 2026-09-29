"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Users, Calendar, FileText, MessageSquare,
  Plus, Check, Trash2, Phone, Mail, ChevronLeft,
  ChevronRight, AlertCircle, Shield, Briefcase, DollarSign
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Crew = {
  id: number; name: string; role: string; department: string | null;
  email: string | null; phone: string | null; union_status: string;
  rate_type: string; rate_cad: number; contract_status: string;
  t4_status: string; worksafe_bc: string; sin_on_file: number;
  filming_province: string; emergency_contact: string | null; notes: string | null;
};

type Event = {
  id: number; title: string; event_type: string; location: string | null;
  start_at: string; end_at: string | null; crew_ids: string;
  notes: string | null; status: string;
};

type Doc = {
  id: number; doc_type: string; crew_id: number | null; crew_name: string | null;
  status: string; reference_number: string | null; issued_at: string | null;
  due_at: string | null; filed_at: string | null; notes: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DEPARTMENTS = ["Direction","Camera","Production","Art","Sound","Lighting","Grip","Wardrobe","Makeup","Post","Talent","Office"];
const ROLES: Record<string, string[]> = {
  Direction:  ["Director","1st AD","2nd AD","Script Supervisor","DGA Rep"],
  Camera:     ["DP","Camera Operator","1st AC","2nd AC","DIT","Steadicam"],
  Production: ["Executive Producer","Line Producer","Production Manager","Production Coordinator","Production Assistant","UPM"],
  Sound:      ["Sound Mixer","Boom Operator","Sound Assistant"],
  Lighting:   ["Gaffer","Best Boy Electric","Electrician"],
  Grip:       ["Key Grip","Best Boy Grip","Dolly Grip","Grip"],
  Art:        ["Production Designer","Art Director","Set Decorator","Props Master"],
  Wardrobe:   ["Costume Designer","Wardrobe Supervisor","Dresser"],
  Makeup:     ["Key Makeup","Key Hair","Makeup Artist"],
  Post:       ["Editor","Colorist","VFX Supervisor","Post Supervisor"],
  Talent:     ["Host","Series Regular","Guest","Background"],
  Office:     ["Accountant","Payroll","Legal","Office PA"],
};
const ALL_ROLES = Object.values(ROLES).flat();

const EVENT_TYPES = ["shoot","scout","rehearsal","production-meeting","table-read","travel","wrap","premiere","other"];
const DOC_TYPES   = ["T4","T2125","WorkSafe BC","Contract","Permit","Insurance","Release","NDA","Invoice","Other"];
const UNION_OPTS  = ["non-union","DGC","IATSE","ACTRA","UBCP","Teamsters","WGC","CMPA"];

const PROVINCES = ["BC","AB","SK","MB","ON","QC","NS","NB","NL","PE","YT","NT","NU"];
const WCB_NAME: Record<string, string> = {
  BC: "WorkSafe BC",
  AB: "WCB Alberta",
  SK: "Saskatchewan WCB",
  MB: "WCB Manitoba",
  ON: "WSIB Ontario",
  QC: "CNESST Quebec",
  NS: "WCB Nova Scotia",
  NB: "WorkSafeNB",
  NL: "WorkplaceNL",
  PE: "WCB PEI",
  YT: "YG Workers Comp",
  NT: "WSCC NWT",
  NU: "WSCC Nunavut",
};

const STATUS_COLOR: Record<string, string> = {
  none: "text-muted", pending: "text-yellow-400", issued: "text-blue-400",
  signed: "text-green-400", filed: "text-green-400", active: "text-green-400",
  registered: "text-blue-400", exempt: "text-muted", expired: "text-red-400",
  scheduled: "text-blue-400", completed: "text-green-400", cancelled: "text-red-400",
  interested: "text-green-400", declined: "text-red-400",
};

const EVENT_COLOR: Record<string, string> = {
  shoot: "bg-neon/20 border-neon/40", scout: "bg-blue-500/20 border-blue-500/40",
  rehearsal: "bg-purple-500/20 border-purple-500/40", "production-meeting": "bg-yellow-500/20 border-yellow-500/40",
  travel: "bg-orange-500/20 border-orange-500/40", wrap: "bg-red-500/20 border-red-500/40",
  premiere: "bg-pink-500/20 border-pink-500/40", other: "bg-white/10 border-white/20",
};

function pill(text: string, cls = "") {
  return <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls}`}>{text}</span>;
}

function todayLocal() {
  return new Date().toISOString().slice(0, 16);
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function firstDayOf(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductionHub() {
  const [tab, setTab]     = useState<"crew"|"schedule"|"docs"|"comms">("crew");
  const [crew, setCrew]   = useState<Crew[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [docs, setDocs]   = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear]   = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  // Forms
  const [showCrewForm, setShowCrewForm]   = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showDocForm, setShowDocForm]     = useState(false);
  const [editingCrew, setEditingCrew]     = useState<Crew | null>(null);

  const [crewForm, setCrewForm] = useState({
    name:"", role:"", department:"Direction", email:"", phone:"",
    union_status:"non-union", rate_type:"daily", rate_cad:"",
    contract_status:"none", t4_status:"none", worksafe_bc:"none",
    sin_on_file: false, filming_province:"BC",
    emergency_contact:"", notes:"",
  });
  const [eventForm, setEventForm] = useState({
    title:"", event_type:"shoot", location:"", start_at:todayLocal(),
    end_at:"", notes:"", crew_ids:[] as number[],
  });
  const [docForm, setDocForm] = useState({
    doc_type:"Contract", crew_id:"", crew_name:"", status:"pending",
    reference_number:"", due_at:"", notes:"",
  });

  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, e, d] = await Promise.all([
      fetch("/api/admin/production").then(r => r.json()),
      fetch("/api/admin/production/schedule").then(r => r.json()),
      fetch("/api/admin/production/docs").then(r => r.json()),
    ]);
    setCrew(c.crew || []);
    setEvents(e.events || []);
    setDocs(d.docs || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Crew actions ─────────────────────────────────────────────────────────

  function openCrewForm(c?: Crew) {
    if (c) {
      setCrewForm({
        name:c.name, role:c.role, department:c.department||"Direction",
        email:c.email||"", phone:c.phone||"", union_status:c.union_status,
        rate_type:c.rate_type, rate_cad:c.rate_cad.toString(),
        contract_status:c.contract_status, t4_status:c.t4_status,
        worksafe_bc:c.worksafe_bc, sin_on_file: !!c.sin_on_file,
        filming_province: c.filming_province || "BC",
        emergency_contact:c.emergency_contact||"", notes:c.notes||"",
      });
      setEditingCrew(c);
    } else {
      setCrewForm({ name:"", role:"", department:"Direction", email:"", phone:"",
        union_status:"non-union", rate_type:"daily", rate_cad:"",
        contract_status:"none", t4_status:"none", worksafe_bc:"none",
        emergency_contact:"", notes:"" });
      setEditingCrew(null);
    }
    setShowCrewForm(true);
  }

  async function saveCrew(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body = { ...crewForm, rate_cad: parseInt(crewForm.rate_cad)||0,
      ...(editingCrew ? { id: editingCrew.id } : {}) };
    await fetch("/api/admin/production", {
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)
    });
    setShowCrewForm(false); setSaving(false); await load();
  }

  async function deleteCrew(id: number) {
    if (!confirm("Remove this crew member?")) return;
    await fetch("/api/admin/production", {
      method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id})
    });
    await load();
  }

  // ── Event actions ─────────────────────────────────────────────────────────

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    await fetch("/api/admin/production/schedule", {
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(eventForm)
    });
    setShowEventForm(false); setSaving(false); await load();
  }

  async function deleteEvent(id: number) {
    await fetch("/api/admin/production/schedule", {
      method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id})
    });
    await load();
  }

  // ── Doc actions ───────────────────────────────────────────────────────────

  async function saveDoc(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    const crewMatch = crew.find(c => c.id === parseInt(docForm.crew_id));
    await fetch("/api/admin/production/docs", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        ...docForm,
        crew_id: docForm.crew_id ? parseInt(docForm.crew_id) : null,
        crew_name: crewMatch?.name || docForm.crew_name || null,
        due_at: docForm.due_at || null,
      })
    });
    setShowDocForm(false); setSaving(false); await load();
  }

  async function patchDoc(id: number, status: string) {
    await fetch("/api/admin/production/docs", {
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id, status})
    });
    await load();
  }

  // ── Calendar ──────────────────────────────────────────────────────────────

  const daysInCal  = daysInMonth(calYear, calMonth);
  const firstDay   = firstDayOf(calYear, calMonth);
  const today      = new Date();

  function eventsOnDay(day: number) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return events.filter(ev => ev.start_at.startsWith(dateStr));
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  const pendingContracts = crew.filter(c => c.contract_status !== "signed").length;
  const pendingT4        = crew.filter(c => c.t4_status !== "filed" && c.t4_status !== "none").length;
  const wsbcIssues       = crew.filter(c => c.worksafe_bc !== "active" && c.worksafe_bc !== "exempt" && c.worksafe_bc !== "none").length;
  const sinMissing       = crew.filter(c => !c.sin_on_file);
  const upcomingEvents   = events.filter(ev => new Date(ev.start_at) >= today && ev.status === "scheduled").length;

  // ─── Render ───────────────────────────────────────────────────────────────

  const TAB_BAR = (
    <div className="flex gap-1 border-b border-edge mb-6">
      {([
        ["crew",     <Users size={14}/>,     "Crew"],
        ["schedule", <Calendar size={14}/>,  "Schedule"],
        ["docs",     <FileText size={14}/>,  "Compliance"],
        ["comms",    <MessageSquare size={14}/>, "Comms"],
      ] as const).map(([key, icon, label]) => (
        <button key={key} onClick={() => setTab(key as any)}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition -mb-px
            ${tab === key ? "border-neon text-foreground" : "border-transparent text-muted hover:text-foreground"}`}>
          {icon} {label}
          {key === "crew"     && crew.length   > 0 && <span className="pill text-[10px] py-0">{crew.length}</span>}
          {key === "schedule" && upcomingEvents > 0 && <span className="pill text-[10px] py-0">{upcomingEvents}</span>}
          {key === "docs"     && pendingContracts > 0 && <span className="pill text-[10px] py-0 bg-yellow-500/20 border-yellow-500/30 text-yellow-400">{pendingContracts}</span>}
        </button>
      ))}
    </div>
  );

  // ── CREW TAB ─────────────────────────────────────────────────────────────

  const deptGroups = DEPARTMENTS.map(dept => ({
    dept, members: crew.filter(c => c.department === dept),
  })).filter(g => g.members.length > 0);

  const CrewTab = (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3 flex-wrap">
          {sinMissing.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-400 font-bold">
              <AlertCircle size={12}/> TOUR BLOCKED — {sinMissing.length} member{sinMissing.length>1?"s":""} missing SIN on file
            </span>
          )}
          {pendingContracts > 0 && (
            <span className="flex items-center gap-1 text-xs text-yellow-400">
              <AlertCircle size={12}/> {pendingContracts} contracts unsigned
            </span>
          )}
          {wsbcIssues > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <Shield size={12}/> {wsbcIssues} WorkSafe BC issues
            </span>
          )}
        </div>
        <button onClick={() => openCrewForm()} className="btn btn-neon flex items-center gap-1.5 text-sm">
          <Plus size={14}/> Add crew
        </button>
      </div>

      {showCrewForm && (
        <form onSubmit={saveCrew} className="card p-5 flex flex-col gap-4 border border-neon/30">
          <div className="font-black">{editingCrew ? "Edit crew member" : "Add crew member"}</div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Name *</span>
              <input className="field-input" value={crewForm.name} required
                onChange={e => setCrewForm(f=>({...f, name:e.target.value}))} placeholder="Full name"/>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Department</span>
              <select className="field-input" value={crewForm.department}
                onChange={e => setCrewForm(f=>({...f, department:e.target.value, role:""}))}>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Role *</span>
              <select className="field-input" value={crewForm.role} required
                onChange={e => setCrewForm(f=>({...f, role:e.target.value}))}>
                <option value="">— select —</option>
                {(ROLES[crewForm.department] || ALL_ROLES).map(r => <option key={r}>{r}</option>)}
                <option value="Other">Other</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Union / Guild</span>
              <select className="field-input" value={crewForm.union_status}
                onChange={e => setCrewForm(f=>({...f, union_status:e.target.value}))}>
                {UNION_OPTS.map(u => <option key={u}>{u}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Email</span>
              <input className="field-input" type="email" value={crewForm.email}
                onChange={e => setCrewForm(f=>({...f, email:e.target.value}))} placeholder="crew@example.com"/>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Phone</span>
              <input className="field-input" value={crewForm.phone}
                onChange={e => setCrewForm(f=>({...f, phone:e.target.value}))} placeholder="+1 604 000 0000"/>
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Rate type</span>
              <select className="field-input" value={crewForm.rate_type}
                onChange={e => setCrewForm(f=>({...f, rate_type:e.target.value}))}>
                <option value="daily">Daily (CAD)</option>
                <option value="weekly">Weekly (CAD)</option>
                <option value="flat">Flat deal (CAD)</option>
                <option value="deferred">Deferred</option>
                <option value="volunteer">Volunteer</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Rate (CAD $)</span>
              <input className="field-input" type="number" value={crewForm.rate_cad}
                onChange={e => setCrewForm(f=>({...f, rate_cad:e.target.value}))} placeholder="0"/>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Contract</span>
              <select className="field-input" value={crewForm.contract_status}
                onChange={e => setCrewForm(f=>({...f, contract_status:e.target.value}))}>
                <option value="none">None</option>
                <option value="pending">Pending</option>
                <option value="issued">Issued</option>
                <option value="signed">Signed</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">T4 status</span>
              <select className="field-input" value={crewForm.t4_status}
                onChange={e => setCrewForm(f=>({...f, t4_status:e.target.value}))}>
                <option value="none">N/A</option>
                <option value="pending">Pending</option>
                <option value="issued">Issued</option>
                <option value="filed">Filed</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Province (for WCB)</span>
              <select className="field-input" value={crewForm.filming_province}
                onChange={e => setCrewForm(f=>({...f, filming_province:e.target.value}))}>
                {PROVINCES.map(p => <option key={p} value={p}>{p} — {WCB_NAME[p]}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">{WCB_NAME[crewForm.filming_province] || "Workers Comp"}</span>
              <select className="field-input" value={crewForm.worksafe_bc}
                onChange={e => setCrewForm(f=>({...f, worksafe_bc:e.target.value}))}>
                <option value="none">Not set</option>
                <option value="pending">Registration pending</option>
                <option value="registered">Registered</option>
                <option value="active">Active coverage</option>
                <option value="exempt">Exempt</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Emergency contact</span>
              <input className="field-input" value={crewForm.emergency_contact}
                onChange={e => setCrewForm(f=>({...f, emergency_contact:e.target.value}))} placeholder="Name / phone"/>
            </label>
          </div>
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={crewForm.sin_on_file}
              onChange={e => setCrewForm(f=>({...f, sin_on_file:e.target.checked}))}
              className="mt-0.5 accent-neon w-4 h-4 shrink-0"/>
            <span>
              <span className="text-sm font-semibold">SIN on file</span>
              <span className="block text-xs text-muted mt-0.5">
                Confirms accounting has the Social Insurance Number. Do NOT enter the actual SIN here — collect it via paper form or{" "}
                <strong>BC Identity</strong> (BC Services Card app) and store it in your payroll system.
                Band members cannot tour until this is checked.
              </span>
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted uppercase tracking-wide">Notes</span>
            <textarea className="field-input" rows={2} value={crewForm.notes}
              onChange={e => setCrewForm(f=>({...f, notes:e.target.value}))}/>
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-neon flex items-center gap-1.5">
              <Check size={13}/> {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setShowCrewForm(false)} className="btn">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <div className="text-muted text-sm">Loading…</div> :
       crew.length === 0 ? (
        <div className="card px-5 py-10 text-center text-muted text-sm">
          No crew added yet. Hit "Add crew" to start your call sheet.
        </div>
       ) : (
        <div className="flex flex-col gap-4">
          {deptGroups.map(({ dept, members }) => (
            <div key={dept} className="card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-edge bg-white/3">
                <span className="font-black text-sm">{dept}</span>
                <span className="pill text-[10px] py-0">{members.length}</span>
              </div>
              <div className="divide-y divide-edge">
                {members.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/3 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{m.name}</span>
                        <span className="text-xs text-muted">{m.role}</span>
                        {m.union_status !== "non-union" && pill(m.union_status, "border-blue-500/30 text-blue-400")}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {m.email && (
                          <a href={`mailto:${m.email}`} className="flex items-center gap-1 text-xs text-muted hover:text-foreground">
                            <Mail size={11}/> {m.email}
                          </a>
                        )}
                        {m.phone && (
                          <a href={`tel:${m.phone}`} className="flex items-center gap-1 text-xs text-muted hover:text-foreground">
                            <Phone size={11}/> {m.phone}
                          </a>
                        )}
                        {m.rate_cad > 0 && (
                          <span className="flex items-center gap-1 text-xs text-muted">
                            <DollarSign size={11}/> ${m.rate_cad.toLocaleString("en-CA")} / {m.rate_type}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      {!m.sin_on_file && (
                        <span className="text-[11px] font-bold text-red-400 border border-red-500/30 rounded px-1.5 py-0.5" title="SIN not on file — cannot tour">
                          SIN missing
                        </span>
                      )}
                      <span className={`text-[11px] font-semibold ${STATUS_COLOR[m.contract_status] ?? "text-muted"}`} title="Contract">
                        {m.contract_status === "signed" ? "Contract ✓" : m.contract_status !== "none" ? `Contract: ${m.contract_status}` : ""}
                      </span>
                      <span className={`text-[11px] font-semibold ${STATUS_COLOR[m.worksafe_bc] ?? "text-muted"}`}
                        title={WCB_NAME[m.filming_province] || "Workers Comp"}>
                        {m.worksafe_bc !== "none" ? `${m.filming_province} WCB: ${m.worksafe_bc}` : ""}
                      </span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <button onClick={() => openCrewForm(m)} className="btn text-xs py-0.5 px-2">Edit</button>
                      <button onClick={() => deleteCrew(m.id)} className="btn text-xs py-0.5 px-2 text-red-400"><Trash2 size={12}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
       )}
    </div>
  );

  // ── SCHEDULE TAB ──────────────────────────────────────────────────────────

  const ScheduleTab = (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => {
            const d = new Date(calYear, calMonth - 1);
            setCalYear(d.getFullYear()); setCalMonth(d.getMonth());
          }} className="btn p-1.5"><ChevronLeft size={14}/></button>
          <span className="font-black text-sm min-w-[140px] text-center">
            {MONTH_NAMES[calMonth]} {calYear}
          </span>
          <button onClick={() => {
            const d = new Date(calYear, calMonth + 1);
            setCalYear(d.getFullYear()); setCalMonth(d.getMonth());
          }} className="btn p-1.5"><ChevronRight size={14}/></button>
        </div>
        <button onClick={() => { setShowEventForm(true); setEventForm(f=>({...f, start_at:todayLocal()})); }}
          className="btn btn-neon flex items-center gap-1.5 text-sm">
          <Plus size={14}/> Add event
        </button>
      </div>

      {showEventForm && (
        <form onSubmit={saveEvent} className="card p-5 flex flex-col gap-4 border border-neon/30">
          <div className="font-black">Add production event</div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Title *</span>
              <input className="field-input" value={eventForm.title} required
                onChange={e => setEventForm(f=>({...f, title:e.target.value}))} placeholder="Ep 1 shoot — Trail BC"/>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Type</span>
              <select className="field-input" value={eventForm.event_type}
                onChange={e => setEventForm(f=>({...f, event_type:e.target.value}))}>
                {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 col-span-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Location</span>
              <input className="field-input" value={eventForm.location}
                onChange={e => setEventForm(f=>({...f, location:e.target.value}))} placeholder="Trail, BC"/>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Start *</span>
              <input className="field-input" type="datetime-local" value={eventForm.start_at} required
                onChange={e => setEventForm(f=>({...f, start_at:e.target.value}))}/>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">End</span>
              <input className="field-input" type="datetime-local" value={eventForm.end_at}
                onChange={e => setEventForm(f=>({...f, end_at:e.target.value}))}/>
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted uppercase tracking-wide">Notes</span>
            <textarea className="field-input" rows={2} value={eventForm.notes}
              onChange={e => setEventForm(f=>({...f, notes:e.target.value}))} placeholder="Call time, notes, permit numbers…"/>
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-neon flex items-center gap-1.5">
              <Check size={13}/> {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setShowEventForm(false)} className="btn">Cancel</button>
          </div>
        </form>
      )}

      {/* Calendar grid */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-edge">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <div key={d} className="text-center text-[11px] text-muted font-semibold py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({length: firstDay}).map((_,i) => (
            <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-edge opacity-30"/>
          ))}
          {Array.from({length: daysInCal}).map((_,i) => {
            const day = i + 1;
            const isToday = calYear === today.getFullYear() && calMonth === today.getMonth() && day === today.getDate();
            const dayEvents = eventsOnDay(day);
            return (
              <div key={day} className={`min-h-[80px] border-b border-r border-edge p-1 ${isToday ? "bg-neon/5" : ""}`}>
                <div className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full
                  ${isToday ? "bg-neon text-black" : "text-muted"}`}>
                  {day}
                </div>
                {dayEvents.map(ev => (
                  <div key={ev.id} onClick={() => deleteEvent(ev.id)}
                    className={`text-[10px] rounded px-1 py-0.5 mb-0.5 border cursor-pointer truncate
                      ${EVENT_COLOR[ev.event_type] ?? "bg-white/10 border-white/20"}`}
                    title={`${ev.title}${ev.location ? " — "+ev.location : ""}\nClick to remove`}>
                    {ev.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming list */}
      {events.filter(ev => new Date(ev.start_at) >= today && ev.status !== "cancelled").length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-edge font-black text-sm">Upcoming</div>
          <div className="divide-y divide-edge">
            {events
              .filter(ev => new Date(ev.start_at) >= today && ev.status !== "cancelled")
              .slice(0, 10)
              .map(ev => (
                <div key={ev.id} className="flex items-center gap-3 px-4 py-3 group">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${ev.status === "completed" ? "bg-green-400" : "bg-neon"}`}/>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{ev.title}</div>
                    <div className="text-xs text-muted">
                      {new Date(ev.start_at).toLocaleDateString("en-CA", {
                        timeZone:"America/Vancouver", weekday:"short", month:"short", day:"numeric"
                      })}
                      {ev.location && ` · ${ev.location}`}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase ${EVENT_COLOR[ev.event_type]?.split(" ")[0] ? "" : ""} text-muted`}>
                    {ev.event_type}
                  </span>
                  <button onClick={() => deleteEvent(ev.id)}
                    className="btn text-xs py-0.5 px-2 text-red-400 opacity-0 group-hover:opacity-100 transition">
                    <Trash2 size={12}/>
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── COMPLIANCE / DOCS TAB ─────────────────────────────────────────────────

  const docsGrouped = DOC_TYPES.map(dt => ({
    type: dt, items: docs.filter(d => d.doc_type === dt),
  })).filter(g => g.items.length > 0);

  const DocsTab = (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted">
          Canadian film production compliance — T4 slips, WorkSafe BC, contracts, permits.
        </div>
        <button onClick={() => setShowDocForm(true)} className="btn btn-neon flex items-center gap-1.5 text-sm">
          <Plus size={14}/> Add document
        </button>
      </div>

      {showDocForm && (
        <form onSubmit={saveDoc} className="card p-5 flex flex-col gap-4 border border-neon/30">
          <div className="font-black">Add compliance document</div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Document type *</span>
              <select className="field-input" value={docForm.doc_type} required
                onChange={e => setDocForm(f=>({...f, doc_type:e.target.value}))}>
                {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Crew member</span>
              <select className="field-input" value={docForm.crew_id}
                onChange={e => setDocForm(f=>({...f, crew_id:e.target.value}))}>
                <option value="">— whole production —</option>
                {crew.map(c => <option key={c.id} value={c.id}>{c.name} ({c.role})</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Status</span>
              <select className="field-input" value={docForm.status}
                onChange={e => setDocForm(f=>({...f, status:e.target.value}))}>
                <option value="pending">Pending</option>
                <option value="issued">Issued</option>
                <option value="signed">Signed</option>
                <option value="filed">Filed</option>
                <option value="expired">Expired</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">Due date</span>
              <input className="field-input" type="date" value={docForm.due_at}
                onChange={e => setDocForm(f=>({...f, due_at:e.target.value}))}/>
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted uppercase tracking-wide">Reference / notes</span>
            <input className="field-input" value={docForm.notes}
              onChange={e => setDocForm(f=>({...f, notes:e.target.value}))} placeholder="File #, issuer, notes…"/>
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-neon flex items-center gap-1.5">
              <Check size={13}/> {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setShowDocForm(false)} className="btn">Cancel</button>
          </div>
        </form>
      )}

      {/* Quick compliance overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:"SIN on file", val:`${crew.filter(c=>c.sin_on_file).length}/${crew.length}`, ok: crew.length > 0 && crew.every(c=>c.sin_on_file) },
          { label:"Contracts signed", val:`${crew.filter(c=>c.contract_status==="signed").length}/${crew.length}`, ok: crew.length > 0 && crew.every(c=>c.contract_status==="signed") },
          { label:"WorkSafe BC active", val:`${crew.filter(c=>c.worksafe_bc==="active"||c.worksafe_bc==="exempt").length}/${crew.length}`, ok: crew.length > 0 && crew.every(c=>c.worksafe_bc==="active"||c.worksafe_bc==="exempt") },
          { label:"Docs overdue", val:`${docs.filter(d=>d.due_at && new Date(d.due_at)<today && d.status!=="filed").length}`, ok: docs.filter(d=>d.due_at && new Date(d.due_at)<today && d.status!=="filed").length===0 },
        ].map(s => (
          <div key={s.label} className={`card px-4 py-3 border ${s.ok ? "border-green-500/20" : "border-yellow-500/20"}`}>
            <div className={`text-2xl font-black ${s.ok ? "text-green-400" : "text-yellow-400"}`}>{s.val}</div>
            <div className="text-xs text-muted mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {docs.length === 0 ? (
        <div className="card px-5 py-10 text-center text-muted text-sm">
          No documents tracked yet. Add contracts, T4s, WorkSafe BC registration, and permits here.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {docsGrouped.map(({ type, items }) => (
            <div key={type} className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-edge flex items-center gap-2">
                <span className="font-black text-sm">{type}</span>
                <span className="pill text-[10px] py-0">{items.length}</span>
              </div>
              <div className="divide-y divide-edge">
                {items.map(d => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 group">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold">{d.crew_name || "Production"}</span>
                      {d.notes && <span className="text-xs text-muted ml-2">{d.notes}</span>}
                      {d.due_at && (
                        <span className={`text-xs ml-2 ${new Date(d.due_at)<today && d.status!=="filed" ? "text-red-400" : "text-muted"}`}>
                          due {new Date(d.due_at).toLocaleDateString("en-CA")}
                        </span>
                      )}
                    </div>
                    <select value={d.status} onChange={e => patchDoc(d.id, e.target.value)}
                      className={`text-xs font-semibold border-0 bg-transparent cursor-pointer ${STATUS_COLOR[d.status] ?? "text-muted"}`}>
                      <option value="pending">Pending</option>
                      <option value="issued">Issued</option>
                      <option value="signed">Signed</option>
                      <option value="filed">Filed</option>
                      <option value="expired">Expired</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── COMMS TAB ─────────────────────────────────────────────────────────────

  const CommsTab = (
    <div className="card px-5 py-8 text-center text-muted text-sm flex flex-col items-center gap-3">
      <MessageSquare size={32} className="opacity-30"/>
      <div>
        <div className="font-semibold text-foreground mb-1">Crew communications</div>
        Production team messages and follow-ups are tracked in the main{" "}
        <a href="/admin/inbox" className="text-neon hover:underline">Inbox</a>.
        Crew emails auto-match to their roster record when they reply.
      </div>
      <a href="/admin/inbox" className="btn btn-neon text-sm">Open Inbox</a>
    </div>
  );

  // ─── Final render ─────────────────────────────────────────────────────────

  return (
    <div>
      {TAB_BAR}
      {tab === "crew"     && CrewTab}
      {tab === "schedule" && ScheduleTab}
      {tab === "docs"     && DocsTab}
      {tab === "comms"    && CommsTab}
    </div>
  );
}
