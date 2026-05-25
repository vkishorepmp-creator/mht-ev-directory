import { useState, useEffect, useRef } from "react";

// ─── Supabase Config ──────────────────────────────────────────────────────────
const SUPABASE_URL = "https://krcaijliviwxempwqxrz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyY2Fpamxpdml3eGVtcHdxeHJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzI2MTIsImV4cCI6MjA5NTIwODYxMn0.tSqjzLCE4PtQWFvjFSCdEk9R7LQOAnnjz5fcBg1aQR4";
const TABLE = "ev_records";

const headers = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Prefer": "return=representation",
};

// ─── Supabase API helpers ─────────────────────────────────────────────────────
async function sbFetch() {
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?select=*&order=created_at.asc`, { headers });
  } catch (netErr) {
    throw new Error("Network error — " + netErr.message);
  }
  if (!res.ok) {
    let msg = res.statusText;
    try { const b = await res.json(); msg = b.message || b.hint || b.error || msg; } catch {}
    throw new Error(`HTTP ${res.status} — ${msg}`);
  }
  const data = await res.json();
  // Normalize snake_case → camelCase
  return data.map(r => ({
    id: r.id,
    vehicleNumber: r.vehicle_number,
    ownerName: r.owner_name,
    tower: r.tower,
    flat: r.flat,
    phone: r.phone,
    email: r.email || "",
    manufacturer: r.manufacturer || "",
    vehicleModel: r.vehicle_model || "",
  }));
}

async function sbInsert(rec) {
  const body = {
    vehicle_number: rec.vehicleNumber,
    owner_name: rec.ownerName,
    tower: rec.tower,
    flat: rec.flat,
    phone: rec.phone,
    email: rec.email || "",
    manufacturer: rec.manufacturer || "",
    vehicle_model: rec.vehicleModel || "",
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
    method: "POST", headers, body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { const b = await res.json(); msg = b.message || b.hint || b.error || msg; } catch {}
    throw new Error(`HTTP ${res.status} — ${msg}`);
  }
  const data = await res.json();
  const r = data[0];
  return { id: r.id, vehicleNumber: r.vehicle_number, ownerName: r.owner_name, tower: r.tower, flat: r.flat, phone: r.phone, email: r.email || "", manufacturer: r.manufacturer || "", vehicleModel: r.vehicle_model || "" };
}

async function sbUpdate(id, rec) {
  const body = {
    vehicle_number: rec.vehicleNumber,
    owner_name: rec.ownerName,
    tower: rec.tower,
    flat: rec.flat,
    phone: rec.phone,
    email: rec.email || "",
    manufacturer: rec.manufacturer || "",
    vehicle_model: rec.vehicleModel || "",
  };
  console.log("sbUpdate called with:", { id, body });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}`, {
    method: "PATCH", headers, body: JSON.stringify(body),
  });
  console.log("sbUpdate response status:", res.status, res.statusText);
  if (!res.ok) {
    let msg = res.statusText;
    let errorDetails = null;
    try { 
      const b = await res.json(); 
      errorDetails = b;
      msg = b.message || b.hint || b.error || b.details || msg;
      console.error("sbUpdate error details:", errorDetails);
      console.error("Full error object:", JSON.stringify(b, null, 2));
    } catch (e) {
      console.error("Failed to parse error response:", e);
    }
    throw new Error(`HTTP ${res.status} — ${msg}`);
  }
  console.log("sbUpdate successful");
}

async function sbDelete(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}`, {
    method: "DELETE", headers,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { const b = await res.json(); msg = b.message || b.hint || b.error || msg; } catch {}
    throw new Error(`HTTP ${res.status} — ${msg}`);
  }
}

async function sbBulkInsert(recs) {
  const body = recs.map(rec => ({
    vehicle_number: rec.vehicleNumber,
    owner_name: rec.ownerName,
    tower: rec.tower,
    flat: rec.flat,
    phone: rec.phone,
    email: rec.email || "",
    manufacturer: rec.manufacturer || "",
    vehicle_model: rec.vehicleModel || "",
  }));
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
    method: "POST", headers, body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { const b = await res.json(); msg = b.message || b.hint || b.error || msg; } catch {}
    throw new Error(`HTTP ${res.status} — ${msg}`);
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PW_KEY      = "mht_admin_pw";
const RESET_Q_KEY = "mht_reset_q";
const RESET_A_KEY = "mht_reset_a";
const DEFAULT_PW  = "admin123";

const SECURITY_QUESTIONS = [
  "What is the name of your society?",
  "What is the street/road name of your society?",
  "In which city is your society located?",
  "What is your society registration number?",
  "What is the name of the society chairman?",
];

const EV_MAKERS = [
  { name: "Tata Motors",            models: ["Tiago EV","Tigor EV","Punch EV","Nexon EV","Curvv EV"] },
  { name: "JSW MG Motor India",     models: ["Comet EV","Windsor EV","ZS EV"] },
  { name: "Mahindra & Mahindra",    models: ["XUV400","BE 6","XEV 9e"] },
  { name: "Hyundai Motor India",    models: ["Creta EV","Ioniq 5"] },
  { name: "BYD India",              models: ["e6/M6","Atto 3","Seal"] },
  { name: "BMW India",              models: ["iX1","i4","i5","iX","i7"] },
  { name: "Mercedes-Benz India",    models: ["EQA","EQB","EQE SUV","EQS Sedan"] },
  { name: "Audi India",             models: ["Q4 e-tron","Q8 e-tron","Q8 e-tron Sportback","e-tron GT","RS e-tron GT"] },
  { name: "Volvo & Polestar India", models: ["XC40 Recharge (EX40)","C40 Recharge (EC40)","EX90"] },
  { name: "Kia India",              models: ["EV6","EV9"] },
  { name: "Maruti Suzuki",          models: ["e Vitara"] },
  { name: "VinFast India",          models: ["VF e34","VF 5"] },
  { name: "Porsche India",          models: ["Taycan","Taycan Cross Turismo","Macan Electric"] },
  { name: "Jaguar Land Rover",      models: ["Jaguar I-Pace"] },
  { name: "Rolls-Royce Motor Cars", models: ["Spectre"] },
];

const TOWERS = [1,2,3,4,5,6,7,8,9];
const EMPTY_FORM = { vehicleNumber:"", ownerName:"", tower:"", flat:"", phone:"", email:"", manufacturer:"", vehicleModel:"" };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getAdminPw() { return localStorage.getItem(PW_KEY) || DEFAULT_PW; }
function getResetQ()  { return localStorage.getItem(RESET_Q_KEY) || ""; }
function getResetA()  { return localStorage.getItem(RESET_A_KEY) || ""; }

function validateVN(v) {
  if (!v) return "Vehicle number is required.";
  if (v.length < 5) return "Vehicle number is too short.";
  if (!/\d{4}$/.test(v)) return "Last 4 characters must be digits (e.g. MH12AB1234).";
  return "";
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
function IcoBolt()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>; }
function IcoSearch() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function IcoUpload() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>; }
function IcoEdit()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function IcoDelete() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>; }
function IcoClose()  { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IcoCar()    { return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><rect x="7" y="17" width="10" height="4" rx="2"/><path d="M5 7l1.5-4h11L19 7"/></svg>; }
function IcoLock()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>; }
function IcoPlus()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IcoCheck()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>; }
function IcoKey()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>; }
function IcoEye()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>; }
function IcoEyeOff() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>; }
function IcoList()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>; }
function IcoRefresh(){ return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>; }

// ─── Vehicle Form ─────────────────────────────────────────────────────────────
function VehicleForm({ form, onChange, onManufacturerChange, vnErr, setVnErr }) {
  const models = form.manufacturer ? (EV_MAKERS.find(m => m.name === form.manufacturer)?.models || []) : [];

  function handleVnInput(e) {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    onChange({ ...form, vehicleNumber: val });
    setVnErr(validateVN(val));
  }

  return (
    <div className="form-grid">
      <div className="sec-label">Owner Details</div>
      <div className="fg full">
        <label>Vehicle Number <span className="req">*</span></label>
        <input className={"fi" + (vnErr ? " fi-err" : "")}
          style={{ textTransform:"uppercase", letterSpacing:"2px" }}
          value={form.vehicleNumber} maxLength={12}
          onChange={handleVnInput} placeholder="e.g. MH12AB1234" />
        <span className={"field-hint" + (vnErr ? " hint-err" : "")}>
          {vnErr || "Last 4 characters must be digits — e.g. MH12AB1234"}
        </span>
      </div>
      <div className="fg full">
        <label>Owner Name <span className="req">*</span></label>
        <input className="fi" value={form.ownerName}
          onChange={e => onChange({ ...form, ownerName: e.target.value })}
          placeholder="Full name of owner" />
      </div>
      <div className="fg">
        <label>Phone <span className="req">*</span></label>
        <input className="fi" value={form.phone}
          onChange={e => onChange({ ...form, phone: e.target.value })}
          placeholder="10-digit mobile" />
      </div>
      <div className="fg">
        <label>Email</label>
        <input className="fi" value={form.email}
          onChange={e => onChange({ ...form, email: e.target.value })}
          placeholder="Optional" />
      </div>
      <hr className="form-divider" />
      <div className="sec-label">Location</div>
      <div className="fg">
        <label>Tower <span className="req">*</span></label>
        <select className="fs" value={form.tower}
          onChange={e => onChange({ ...form, tower: e.target.value })}>
          <option value="">— Select Tower —</option>
          {TOWERS.map(t => <option key={t} value={t}>Tower {t}</option>)}
        </select>
      </div>
      <div className="fg">
        <label>Flat No. <span className="req">*</span></label>
        <input className="fi" value={form.flat}
          onChange={e => onChange({ ...form, flat: e.target.value })}
          placeholder="e.g. 304" />
      </div>
      <hr className="form-divider" />
      <div className="sec-label">Vehicle Details</div>
      <div className="fg full">
        <label>Manufacturer <span className="req">*</span></label>
        <select className="fs" value={form.manufacturer}
          onChange={e => onManufacturerChange(e.target.value)}>
          <option value="">— Select Manufacturer —</option>
          {EV_MAKERS.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
        </select>
      </div>
      <div className="fg full">
        <label>Vehicle Model <span className="req">*</span></label>
        <select className="fs" value={form.vehicleModel}
          onChange={e => onChange({ ...form, vehicleModel: e.target.value })}
          disabled={!form.manufacturer}>
          <option value="">{form.manufacturer ? "— Select Model —" : "— Select manufacturer first —"}</option>
          {models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </div>
  );
}

// ─── Vehicle Table ────────────────────────────────────────────────────────────
function VehicleTable({ records, showActions, onEdit, onDelete }) {
  const [search, setSearch] = useState("");
  const filtered = records.filter(r =>
    !search || [r.vehicleNumber, r.ownerName, r.tower, r.flat, r.phone, r.manufacturer, r.vehicleModel]
      .some(v => v && v.toLowerCase().includes(search.toLowerCase()))
  );
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12, marginBottom:16 }}>
        <div>
          <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:18, color:"#fff", marginBottom:2 }}>
            Registered Vehicles
          </div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>
            {records.length} EV{records.length !== 1 ? "s" : ""} registered
            {!showActions && " · Check before adding yours"}
          </div>
        </div>
        <input className="adm-search" style={{ maxWidth:280, flex:"none" }}
          placeholder="Search vehicle, name, tower…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="tbl-wrap">
        {filtered.length === 0
          ? <div className="empty">{search ? "No records match." : "No vehicles registered yet."}</div>
          : <table>
              <thead>
                <tr>
                  <th>Vehicle No.</th><th>Owner</th><th>Tower</th><th>Flat</th>
                  <th>Phone</th><th>Manufacturer</th><th>Model</th>
                  {showActions && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td className="vn">{r.vehicleNumber}</td>
                    <td>{r.ownerName}</td>
                    <td><span className="badge">{r.tower}</span></td>
                    <td>{r.flat}</td>
                    <td>{r.phone}</td>
                    <td style={{ color:"rgba(255,255,255,0.45)", fontSize:12 }}>{r.manufacturer || "—"}</td>
                    <td style={{ color:"rgba(255,255,255,0.55)", fontSize:12 }}>{r.vehicleModel || "—"}</td>
                    {showActions && (
                      <td>
                        <div className="acts">
                          <button className="ico-btn" onClick={() => onEdit(r)} title="Edit"><IcoEdit /></button>
                          <button className="ico-btn del" onClick={() => onDelete(r.id)} title="Delete"><IcoDelete /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Outfit:wght@700;800;900&display=swap');
* { box-sizing:border-box; margin:0; padding:0; }

.hdr { background:#080d1a; border-bottom:1px solid rgba(74,222,128,0.12); padding:0 36px; position:sticky; top:0; z-index:50; }
.hdr-inner { display:flex; align-items:center; max-width:1200px; margin:0 auto; }
.logo-block { display:flex; align-items:center; gap:10px; padding:16px 0; flex:1; min-width:0; }
.logo-icon { width:34px; height:34px; border-radius:9px; background:linear-gradient(135deg,#22c55e,#16a34a); display:flex; align-items:center; justify-content:center; color:#fff; box-shadow:0 0 18px rgba(34,197,94,.35); flex-shrink:0; }
.logo-main { font-family:'Outfit',sans-serif; font-weight:900; font-size:17px; background:linear-gradient(90deg,#fff 40%,#4ade80); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; line-height:1; }
.logo-sub { font-size:9px; color:rgba(74,222,128,.5); letter-spacing:3px; text-transform:uppercase; }
.tabs { display:flex; flex-shrink:0; }
.tab-btn { padding:0 16px; height:62px; background:none; border:none; cursor:pointer; font-family:'DM Mono',monospace; font-size:11px; letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,.35); border-bottom:2px solid transparent; transition:all .2s; position:relative; top:1px; white-space:nowrap; }
.tab-btn:hover { color:rgba(255,255,255,.65); }
.tab-btn.active { color:#4ade80; border-bottom-color:#4ade80; }
.tab-btn.admin-tab { color:rgba(250,204,21,.4); }
.tab-btn.admin-tab:hover { color:rgba(250,204,21,.75); }
.tab-btn.admin-tab.active { color:#facc15; border-bottom-color:#facc15; }

.page { padding:40px 36px; max-width:1200px; margin:0 auto; }

.db-banner { display:flex; align-items:center; gap:8px; background:rgba(74,222,128,.06); border:1px solid rgba(74,222,128,.15); border-radius:8px; padding:10px 16px; margin-bottom:24px; font-size:11px; color:rgba(74,222,128,.7); letter-spacing:.5px; }
.db-dot { width:7px; height:7px; border-radius:50%; background:#4ade80; box-shadow:0 0 8px rgba(74,222,128,.6); animation:pulse 2s infinite; flex-shrink:0; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

.loading-wrap { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:80px 20px; gap:16px; }
.spinner { width:36px; height:36px; border:3px solid rgba(74,222,128,.15); border-top-color:#4ade80; border-radius:50%; animation:spin .7s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
.loading-txt { font-size:12px; color:rgba(255,255,255,.3); letter-spacing:2px; text-transform:uppercase; }

.lookup-hero { text-align:center; padding:16px 0 36px; }
.eyebrow { font-size:10px; letter-spacing:4px; text-transform:uppercase; color:rgba(74,222,128,.55); margin-bottom:14px; display:flex; align-items:center; justify-content:center; gap:8px; }
.eyebrow::before,.eyebrow::after { content:''; flex:1; max-width:60px; height:1px; background:rgba(74,222,128,.2); }
.lookup-h1 { font-family:'Outfit',sans-serif; font-size:36px; font-weight:900; color:#fff; letter-spacing:-1px; margin-bottom:10px; line-height:1.1; }
.lookup-h1 span { color:#4ade80; }
.lookup-p { font-size:13px; color:rgba(255,255,255,.35); }
.search-box { display:flex; gap:10px; max-width:500px; margin:28px auto 0; }
.search-inp { flex:1; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-radius:10px; padding:14px 18px; font-family:'DM Mono',monospace; font-size:15px; color:#fff; letter-spacing:2px; text-transform:uppercase; outline:none; transition:border-color .2s,box-shadow .2s; }
.search-inp::placeholder { text-transform:none; letter-spacing:0; color:rgba(255,255,255,.2); font-size:13px; }
.search-inp:focus { border-color:rgba(74,222,128,.4); box-shadow:0 0 0 3px rgba(74,222,128,.07); }
.result-card { max-width:500px; margin:28px auto 0; background:rgba(34,197,94,.05); border:1px solid rgba(34,197,94,.18); border-radius:16px; padding:28px 30px; animation:up .3s ease; }
.result-vn { font-family:'Outfit',sans-serif; font-size:22px; font-weight:900; color:#4ade80; letter-spacing:2px; margin-bottom:20px; display:flex; align-items:center; gap:10px; }
.result-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.rf label { display:block; font-size:9px; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,.3); margin-bottom:4px; }
.rf span { font-size:14px; color:#fff; }
.rf.full { grid-column:1/-1; }
.result-notfound { max-width:500px; margin:28px auto 0; background:rgba(239,68,68,.05); border:1px solid rgba(239,68,68,.18); border-radius:16px; padding:24px 30px; text-align:center; color:rgba(252,165,165,.8); font-size:13px; line-height:1.7; animation:up .3s ease; }

.reg-wrap { max-width:600px; margin:0 auto; }
.reg-header { margin-bottom:24px; }
.reg-header h2 { font-family:'Outfit',sans-serif; font-size:26px; font-weight:900; color:#fff; margin-bottom:6px; }
.reg-header p { font-size:13px; color:rgba(255,255,255,.35); }
.reg-notice { display:flex; align-items:flex-start; gap:10px; background:rgba(74,222,128,.06); border:1px solid rgba(74,222,128,.15); border-radius:10px; padding:14px 16px; margin-bottom:24px; font-size:12px; color:rgba(74,222,128,.75); line-height:1.6; }
.success-panel { text-align:center; padding:56px 20px; animation:up .4s ease; }
.success-icon { width:64px; height:64px; border-radius:50%; background:rgba(34,197,94,.12); border:2px solid rgba(34,197,94,.3); display:flex; align-items:center; justify-content:center; margin:0 auto 20px; color:#4ade80; }
.success-panel h3 { font-family:'Outfit',sans-serif; font-size:22px; font-weight:900; color:#fff; margin-bottom:8px; }
.success-panel p { font-size:13px; color:rgba(255,255,255,.4); margin-bottom:24px; }

.login-card { max-width:360px; margin:56px auto; background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.07); border-radius:16px; padding:40px; text-align:center; }
.login-icon { font-size:36px; margin-bottom:14px; }
.login-card h2 { font-family:'Outfit',sans-serif; font-size:20px; font-weight:800; color:#fff; margin-bottom:6px; }
.login-card p { font-size:12px; color:rgba(255,255,255,.3); margin-bottom:22px; }
.pw-wrap { position:relative; margin-bottom:12px; }
.pw-inp { width:100%; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-radius:8px; padding:12px 44px 12px 16px; font-family:'DM Mono',monospace; font-size:14px; color:#fff; outline:none; transition:border-color .2s; }
.pw-inp:focus { border-color:rgba(74,222,128,.4); }
.pw-inp.err { border-color:rgba(239,68,68,.5); }
.eye-btn { position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:rgba(255,255,255,.35); display:flex; transition:color .15s; padding:0; }
.eye-btn:hover { color:rgba(255,255,255,.7); }
.pw-err { font-size:11px; color:rgba(252,165,165,.8); margin-bottom:12px; text-align:left; }
.hint { margin-top:12px; font-size:10px; color:rgba(255,255,255,.18); }
.forgot-link { background:none; border:none; cursor:pointer; font-family:'DM Mono',monospace; font-size:11px; color:rgba(74,222,128,.55); letter-spacing:1px; text-decoration:underline; margin-top:10px; transition:color .15s; padding:0; }
.forgot-link:hover { color:#4ade80; }
.step-indicator { display:flex; gap:6px; justify-content:center; margin-bottom:22px; }
.step-dot { width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,.12); transition:all .2s; }
.step-dot.done { background:#4ade80; }
.step-dot.active { background:#4ade80; box-shadow:0 0 8px rgba(74,222,128,.5); }
.forgot-title { font-family:'Outfit',sans-serif; font-size:16px; font-weight:800; color:#fff; margin-bottom:4px; }
.forgot-desc { font-size:12px; color:rgba(255,255,255,.3); margin-bottom:20px; line-height:1.6; }
.sf-form { display:flex; flex-direction:column; gap:14px; }
.sf-label { font-size:9px; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,.32); margin-bottom:5px; }
.step-err { font-size:11px; color:rgba(252,165,165,.85); }

.stat-row { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:24px; }
.stat-chip { background:rgba(34,197,94,.07); border:1px solid rgba(34,197,94,.15); border-radius:9px; padding:10px 20px; display:flex; align-items:baseline; gap:8px; }
.stat-num { font-family:'Outfit',sans-serif; font-size:24px; font-weight:900; color:#4ade80; }
.stat-lbl { font-size:11px; color:rgba(74,222,128,.5); letter-spacing:1px; }
.toolbar { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:10px; }
.adm-search { flex:1; min-width:180px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.09); border-radius:8px; padding:10px 16px; font-family:'DM Mono',monospace; font-size:13px; color:#fff; outline:none; transition:border-color .2s; }
.adm-search::placeholder { color:rgba(255,255,255,.22); }
.adm-search:focus { border-color:rgba(74,222,128,.35); }
.csv-hint { font-size:11px; color:rgba(255,255,255,.2); margin-bottom:16px; }
.csv-hint span { color:rgba(74,222,128,.45); }
.msg { border-radius:8px; padding:10px 16px; font-size:12px; margin-bottom:14px; border:1px solid; }
.msg.ok  { background:rgba(34,197,94,.06); border-color:rgba(34,197,94,.2); color:rgba(74,222,128,.9); }
.msg.bad { background:rgba(239,68,68,.06); border-color:rgba(239,68,68,.2); color:rgba(252,165,165,.9); }
.admin-badge { display:inline-flex; align-items:center; gap:5px; background:rgba(250,204,21,.1); border:1px solid rgba(250,204,21,.2); border-radius:6px; padding:4px 10px; font-size:10px; color:rgba(250,204,21,.8); letter-spacing:1px; text-transform:uppercase; }

.tbl-wrap { border:1px solid rgba(255,255,255,.07); border-radius:12px; overflow:hidden; }
table { width:100%; border-collapse:collapse; }
thead tr { background:rgba(255,255,255,.03); border-bottom:1px solid rgba(255,255,255,.07); }
th { padding:11px 14px; text-align:left; font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:rgba(255,255,255,.28); font-weight:500; }
tbody tr { border-bottom:1px solid rgba(255,255,255,.04); transition:background .15s; }
tbody tr:last-child { border-bottom:none; }
tbody tr:hover { background:rgba(255,255,255,.025); }
td { padding:12px 14px; font-size:13px; color:rgba(255,255,255,.7); }
.vn { color:#4ade80; font-weight:500; letter-spacing:1px; }
.badge { display:inline-flex; align-items:center; background:rgba(34,197,94,.1); border:1px solid rgba(34,197,94,.2); border-radius:5px; padding:1px 8px; font-size:11px; color:#4ade80; }
.acts { display:flex; gap:6px; }
.ico-btn { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.09); border-radius:6px; padding:6px 7px; cursor:pointer; color:rgba(255,255,255,.4); transition:all .15s; display:flex; align-items:center; }
.ico-btn:hover { background:rgba(74,222,128,.1); border-color:rgba(74,222,128,.3); color:#4ade80; }
.ico-btn.del:hover { background:rgba(239,68,68,.1); border-color:rgba(239,68,68,.3); color:rgba(252,165,165,.9); }
.empty { text-align:center; padding:52px 20px; color:rgba(255,255,255,.22); font-size:13px; }

.overlay { position:fixed; inset:0; background:rgba(0,0,0,.78); backdrop-filter:blur(5px); display:flex; align-items:center; justify-content:center; z-index:100; padding:20px; animation:fi .2s ease; }
.modal { background:#0d1525; border:1px solid rgba(255,255,255,.09); border-radius:16px; padding:30px; width:100%; max-width:560px; max-height:92vh; overflow-y:auto; animation:up .25s ease; }
.modal-sm { max-width:420px; }
.modal-hdr { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
.modal-title { font-family:'Outfit',sans-serif; font-size:18px; font-weight:800; color:#fff; }
.modal-sub { font-size:11px; color:rgba(255,255,255,.3); margin-top:2px; }
.x-btn { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.09); border-radius:7px; padding:5px; cursor:pointer; color:rgba(255,255,255,.4); transition:all .15s; display:flex; flex-shrink:0; margin-left:12px; }
.x-btn:hover { color:#fff; background:rgba(255,255,255,.08); }

.form-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.fg { display:flex; flex-direction:column; gap:5px; }
.fg.full { grid-column:1/-1; }
.fg label { font-size:9px; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,.32); }
.req { color:rgba(239,68,68,.7); margin-left:2px; }
.fi,.fs { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.09); border-radius:8px; padding:10px 13px; font-family:'DM Mono',monospace; font-size:13px; color:#fff; outline:none; transition:border-color .2s; width:100%; }
.fi:focus,.fs:focus { border-color:rgba(74,222,128,.4); }
.fi.fi-err { border-color:rgba(239,68,68,.5); }
.fi:disabled,.fs:disabled { opacity:.35; cursor:not-allowed; }
.fs option { background:#0d1525; }
.field-hint { font-size:10px; color:rgba(255,255,255,.28); line-height:1.5; }
.hint-err { color:rgba(252,165,165,.85); }
.form-divider { grid-column:1/-1; border:none; border-top:1px solid rgba(255,255,255,.07); margin:4px 0; }
.sec-label { grid-column:1/-1; font-size:9px; letter-spacing:3px; text-transform:uppercase; color:rgba(74,222,128,.45); padding-bottom:2px; }
.f-err { font-size:11px; color:rgba(252,165,165,.85); margin-top:4px; }
.f-actions { display:flex; gap:10px; justify-content:flex-end; margin-top:8px; }

.btn-green { background:linear-gradient(135deg,#22c55e,#16a34a); border:none; border-radius:10px; padding:12px 20px; cursor:pointer; display:flex; align-items:center; gap:7px; font-family:'DM Mono',monospace; font-size:11px; font-weight:500; color:#fff; letter-spacing:1.5px; text-transform:uppercase; transition:all .2s; box-shadow:0 4px 18px rgba(34,197,94,.25); white-space:nowrap; }
.btn-green:hover { transform:translateY(-1px); box-shadow:0 6px 24px rgba(34,197,94,.4); }
.btn-green:active { transform:none; }
.btn-green:disabled { opacity:.5; cursor:not-allowed; transform:none; }
.btn-ghost { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-radius:8px; padding:10px 16px; cursor:pointer; display:flex; align-items:center; gap:7px; font-family:'DM Mono',monospace; font-size:11px; color:rgba(255,255,255,.5); letter-spacing:1px; text-transform:uppercase; transition:all .2s; white-space:nowrap; }
.btn-ghost:hover { border-color:rgba(74,222,128,.3); color:#4ade80; background:rgba(74,222,128,.05); }
.btn-yellow { background:rgba(250,204,21,.1); border:1px solid rgba(250,204,21,.25); border-radius:8px; padding:10px 16px; cursor:pointer; display:flex; align-items:center; gap:7px; font-family:'DM Mono',monospace; font-size:11px; color:rgba(250,204,21,.8); letter-spacing:1px; text-transform:uppercase; transition:all .2s; white-space:nowrap; }
.btn-yellow:hover { border-color:rgba(250,204,21,.5); color:#facc15; background:rgba(250,204,21,.15); }
.btn-cancel { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-radius:8px; padding:10px 20px; cursor:pointer; font-family:'DM Mono',monospace; font-size:11px; color:rgba(255,255,255,.4); letter-spacing:1px; text-transform:uppercase; transition:all .2s; }
.btn-cancel:hover { color:#fff; border-color:rgba(255,255,255,.22); }

.toast { position:fixed; bottom:28px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,.9); border:1px solid rgba(34,197,94,.35); border-radius:10px; padding:11px 22px; font-size:13px; color:#4ade80; z-index:200; animation:up .3s ease; white-space:nowrap; box-shadow:0 8px 30px rgba(0,0,0,.5); }
.toast.err { border-color:rgba(239,68,68,.35); color:rgba(252,165,165,.9); }

@keyframes up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
@keyframes fi  { from { opacity:0; } to { opacity:1; } }

@media (max-width:700px) {
  .page { padding:24px 16px; }
  .hdr { padding:0 14px; }
  .tab-btn { padding:0 10px; font-size:10px; }
  .form-grid { grid-template-columns:1fr; }
  .fg.full { grid-column:1; }
  .form-divider,.sec-label { grid-column:1; }
  .result-grid { grid-template-columns:1fr; }
  .rf.full { grid-column:1; }
  .lookup-h1 { font-size:26px; }
  th:nth-child(n+6), td:nth-child(n+6) { display:none; }
}
`;

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function MHTEVDirectory() {
  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [dbError, setDbError]   = useState("");
  const [tab, setTab]           = useState("lookup");
  const [isAdmin, setIsAdmin]   = useState(false);
  const [toast, setToast]       = useState({ msg:"", type:"ok" });

  // ── Admin login
  const [loginView, setLoginView] = useState("login");
  const [adminPw, setAdminPw]     = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [pwError, setPwError]     = useState("");

  // ── Forgot password
  const [fStep, setFStep]       = useState(1);
  const [fAnswer, setFAnswer]   = useState("");
  const [fNewPw, setFNewPw]     = useState("");
  const [fConfirm, setFConfirm] = useState("");
  const [fErr, setFErr]         = useState("");
  const [fShowPw, setFShowPw]   = useState(false);

  // ── Reset password modal
  const [showReset, setShowReset] = useState(false);
  const [rStep, setRStep]         = useState(1);
  const [rCurrent, setRCurrent]   = useState("");
  const [rNew, setRNew]           = useState("");
  const [rConfirm, setRConfirm]   = useState("");
  const [rQ, setRQ]               = useState("");
  const [rA, setRA]               = useState("");
  const [rErr, setRErr]           = useState("");
  const [rShowPw, setRShowPw]     = useState(false);

  // ── Lookup
  const [query, setQuery]               = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupDone, setLookupDone]     = useState(false);

  // ── Register
  const [regForm, setRegForm]       = useState(EMPTY_FORM);
  const [regVnErr, setRegVnErr]     = useState("");
  const [regError, setRegError]     = useState("");
  const [regSuccess, setRegSuccess] = useState(false);
  const [regSaving, setRegSaving]   = useState(false);

  // ── Admin edit
  const [editRec, setEditRec]     = useState(null);
  const [editForm, setEditForm]   = useState(EMPTY_FORM);
  const [editVnErr, setEditVnErr] = useState("");
  const [editError, setEditError] = useState("");
  const [showEdit, setShowEdit]   = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // ── CSV
  const [csvMsg, setCsvMsg] = useState("");
  const fileRef = useRef();

  // ── Load from Supabase on mount
  useEffect(() => { loadRecords(); }, []);

  async function loadRecords() {
    setLoading(true); setDbError("");
    try {
      const data = await sbFetch();
      console.log("Loaded records:", data.length);
      console.log("Sample record structure:", data.length > 0 ? data[0] : "No records");
      console.log("All record IDs:", data.map(r => ({ id: r.id, vehicleNumber: r.vehicleNumber })));
      setRecords(data);
    } catch (err) {
      setDbError("Could not connect to database — " + (err.message || "unknown error") + ". Check your internet connection and Supabase RLS settings.");
    } finally {
      setLoading(false);
    }
  }

  function flash(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg:"", type:"ok" }), 3500);
  }

  // ── Lookup
  function handleLookup() {
    const q = query.trim().toUpperCase();
    if (!q) return;
    setLookupResult(records.find(r => r.vehicleNumber.toUpperCase() === q) || null);
    setLookupDone(true);
  }

  // ── Admin login
  function handleLogin() {
    if (adminPw === getAdminPw()) {
      setIsAdmin(true); setAdminPw(""); setPwError(""); setLoginView("login");
    } else {
      setPwError("Incorrect password. Try again.");
    }
  }

  // ── Forgot password
  function startForgot() {
    setFStep(1); setFAnswer(""); setFNewPw(""); setFConfirm(""); setFErr(""); setFShowPw(false);
    setLoginView("forgot");
  }
  function forgotNext1() {
    if (!getResetQ()) { setFErr("No security question set. Contact the society secretary."); return; }
    setFErr(""); setFStep(2);
  }
  function forgotNext2() {
    if (!fAnswer.trim()) { setFErr("Please enter your answer."); return; }
    if (fAnswer.trim().toLowerCase() !== getResetA().toLowerCase()) { setFErr("Answer is incorrect."); return; }
    setFErr(""); setFStep(3);
  }
  function forgotFinish() {
    if (!fNewPw) { setFErr("New password is required."); return; }
    if (fNewPw.length < 6) { setFErr("Password must be at least 6 characters."); return; }
    if (fNewPw !== fConfirm) { setFErr("Passwords do not match."); return; }
    localStorage.setItem(PW_KEY, fNewPw);
    setLoginView("login"); setAdminPw("");
    flash("Password reset. Please log in with your new password.");
  }

  // ── Reset password (logged in)
  function openReset() {
    setRStep(1); setRCurrent(""); setRNew(""); setRConfirm("");
    setRQ(getResetQ()); setRA(""); setRErr(""); setRShowPw(false);
    setShowReset(true);
  }
  function resetNext1() {
    if (!rCurrent) { setRErr("Enter your current password."); return; }
    if (rCurrent !== getAdminPw()) { setRErr("Current password is incorrect."); return; }
    setRErr(""); setRStep(2);
  }
  function resetSave() {
    if (!rNew) { setRErr("New password is required."); return; }
    if (rNew.length < 6) { setRErr("Password must be at least 6 characters."); return; }
    if (rNew !== rConfirm) { setRErr("Passwords do not match."); return; }
    if (!rQ) { setRErr("Please choose a security question."); return; }
    if (!rA.trim()) { setRErr("Please provide an answer to the security question."); return; }
    localStorage.setItem(PW_KEY, rNew);
    localStorage.setItem(RESET_Q_KEY, rQ);
    localStorage.setItem(RESET_A_KEY, rA.trim().toLowerCase());
    setShowReset(false);
    flash("Password & security question updated.");
  }

  // ── Validate form
  function validateForm(form, excludeId) {
    const vnE = validateVN(form.vehicleNumber);
    if (vnE) return vnE;
    if (!form.ownerName.trim()) return "Owner name is required.";
    if (!form.tower)            return "Tower is required.";
    if (!form.flat.trim())      return "Flat number is required.";
    if (!form.phone.trim())     return "Phone number is required.";
    if (!form.manufacturer)     return "Manufacturer is required.";
    if (!form.vehicleModel)     return "Vehicle model is required.";
    const dup = records.find(r =>
      r.vehicleNumber.toUpperCase() === form.vehicleNumber.toUpperCase() && r.id !== excludeId
    );
    if (dup) return "This vehicle number is already registered.";
    return "";
  }

  // ── Register (public — can add but NOT delete)
  async function handleRegister() {
    const err = validateForm(regForm, null);
    if (err) { setRegError(err); return; }
    setRegSaving(true); setRegError("");
    try {
      const newRec = await sbInsert({ ...regForm, vehicleNumber: regForm.vehicleNumber.toUpperCase() });
      setRecords(prev => [...prev, newRec]);
      setRegSuccess(true); setRegForm(EMPTY_FORM); setRegVnErr("");
    } catch (error) {
      setRegError(error.message || "Failed to save. Please check your connection and try again.");
    } finally {
      setRegSaving(false);
    }
  }

  // ── Admin edit (can edit AND delete)
  function openEdit(r) {
    if (!r || !r.id) {
      console.error("Cannot edit record: missing ID", r);
      flash("Cannot edit this record - missing ID", "err");
      return;
    }
    console.log("Opening edit for record:", r.id, r);
    setEditRec(r); setEditForm({ ...r }); setEditVnErr(""); setEditError(""); setShowEdit(true);
  }
  async function handleEditSave() {
    if (!editRec || !editRec.id) {
      setEditError("Cannot save: missing record ID");
      return;
    }
    const err = validateForm(editForm, editRec.id);
    if (err) { setEditError(err); return; }
    setEditSaving(true); setEditError("");
    try {
      console.log("Attempting to update record:", editRec.id, editForm);
      await sbUpdate(editRec.id, { ...editForm, vehicleNumber: editForm.vehicleNumber.toUpperCase() });
      console.log("Update successful");
      setRecords(prev => prev.map(r =>
        r.id === editRec.id ? { ...editForm, id: r.id, vehicleNumber: editForm.vehicleNumber.toUpperCase() } : r
      ));
      setShowEdit(false); flash("Record updated.");
    } catch (error) {
      console.error("Update failed with error:", error);
      const errorMessage = error?.message || error?.toString() || "Failed to save. Please try again.";
      setEditError(errorMessage);
    } finally {
      setEditSaving(false);
    }
  }

  // ── Admin delete ONLY
  async function handleDelete(id) {
    if (!window.confirm("Permanently delete this record?")) return;
    try {
      await sbDelete(id);
      setRecords(prev => prev.filter(r => r.id !== id));
      flash("Record deleted.");
    } catch (error) {
      flash(error.message || "Delete failed. Please try again.", "err");
    }
  }

  // ── CSV import (admin only)
  function handleCSV(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const lines = ev.target.result.split("\n").map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) { setCsvMsg("CSV has no data rows."); return; }

        // Parse headers — accept any column names, map known ones
        const hdrs = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g,""));

        // Column name aliases for flexibility
        const col = name => {
          const aliases = {
            vehiclenumber: ["vehiclenumber","vehicle_number","vehno","reg","regnumber","registrationnumber","vno","vehicleno"],
            ownername:     ["ownername","owner_name","name","owner","fullname"],
            tower:         ["tower","block","wing"],
            flat:          ["flat","flatno","flat_no","unit","unitno","apartment","aptno"],
            phone:         ["phone","mobile","contact","mobileno","phoneno","contactno","ph"],
            email:         ["email","emailid","email_id","mail"],
            manufacturer:  ["manufacturer","make","brand","company","carmaker"],
            vehiclemodel:  ["vehiclemodel","vehicle_model","model","carmodel","evmodel"],
          };
          const list = aliases[name] || [name];
          const idx = hdrs.findIndex(h => list.includes(h));
          return idx;
        };

        let skipped = 0, dupSkipped = 0;
        const newRecs = [];

        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(",").map(v => v.trim());

          const get = key => {
            const idx = col(key);
            return idx >= 0 ? (vals[idx] || "") : "";
          };

          // Build record — all fields optional except we need at least one non-empty value
          const rec = {
            vehicleNumber: get("vehiclenumber").toUpperCase(),
            ownerName:     get("ownername"),
            tower:         get("tower"),
            flat:          get("flat"),
            phone:         get("phone"),
            email:         get("email"),
            manufacturer:  get("manufacturer"),
            vehicleModel:  get("vehiclemodel"),
          };

          // Skip if every field is empty (completely blank row)
          const hasAnyData = Object.values(rec).some(v => v !== "");
          if (!hasAnyData) { skipped++; continue; }

          // If vehicle number is present and is a duplicate, skip
          if (rec.vehicleNumber) {
            if (records.some(r => r.vehicleNumber === rec.vehicleNumber) ||
                newRecs.some(r => r.vehicleNumber === rec.vehicleNumber)) {
              dupSkipped++; continue;
            }
          }

          newRecs.push(rec);
        }

        if (newRecs.length === 0) {
          const why = dupSkipped ? ` (${dupSkipped} duplicate vehicle number${dupSkipped>1?"s":""})` : "";
          setCsvMsg(`No new records to import${why}.`);
          return;
        }

        await sbBulkInsert(newRecs);
        await loadRecords();

        const parts = [`✓ Imported ${newRecs.length} record${newRecs.length !== 1 ? "s" : ""}`];
        if (dupSkipped) parts.push(`${dupSkipped} duplicate${dupSkipped>1?"s":""} skipped`);
        if (skipped)    parts.push(`${skipped} blank row${skipped>1?"s":""} skipped`);
        setCsvMsg(parts.join(" · "));
        setTimeout(() => setCsvMsg(""), 7000);
      } catch (error) { setCsvMsg(error.message || "Failed to import CSV. Check format or connection."); }
      e.target.value = "";
    };
    reader.readAsText(file);
  }

  // ── Loading state
  if (loading) {
    return (
      <div style={{ minHeight:"100vh", background:"#080d1a", fontFamily:"'DM Mono','Courier New',monospace", color:"#e8eaf0", display:"flex", flexDirection:"column" }}>
        <style>{CSS}</style>
        <div className="loading-wrap" style={{ flex:1 }}>
          <div className="spinner" />
          <div className="loading-txt">Connecting to database…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:"#080d1a", fontFamily:"'DM Mono','Courier New',monospace", color:"#e8eaf0" }}>
      <style>{CSS}</style>

      {/* ── Header ── */}
      <header className="hdr">
        <div className="hdr-inner">
          <div className="logo-block">
            <div className="logo-icon"><IcoBolt /></div>
            <div>
              <div className="logo-main">MHT EV Users Directory</div>
              <div className="logo-sub">Society EV Registry</div>
            </div>
          </div>
          <div className="tabs">
            <button className={"tab-btn" + (tab==="lookup"   ? " active" : "")} onClick={() => setTab("lookup")}>Lookup</button>
            <button className={"tab-btn" + (tab==="vehicles" ? " active" : "")} onClick={() => setTab("vehicles")}>
              <span style={{ display:"flex", alignItems:"center", gap:5 }}><IcoList /> All Vehicles</span>
            </button>
            <button className={"tab-btn" + (tab==="register" ? " active" : "")} onClick={() => setTab("register")}>Register</button>
            <button className={"tab-btn admin-tab" + (tab==="admin" ? " active" : "")} onClick={() => setTab("admin")}>
              <span style={{ display:"flex", alignItems:"center", gap:5 }}><IcoLock /> Admin</span>
            </button>
          </div>
        </div>
      </header>

      <div className="page">

        {/* DB error banner */}
        {dbError && (
          <div style={{ marginBottom:24 }}>
            <div className="msg bad">⚠ {dbError}</div>
            <div style={{ marginTop:8, display:"flex", gap:8, alignItems:"center" }}>
              <button className="btn-ghost" style={{ fontSize:11 }} onClick={async () => {
                setDbError("Testing connection…");
                try {
                  const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?select=*&limit=1`, {
                    headers: {
                      "apikey": SUPABASE_KEY,
                      "Authorization": `Bearer ${SUPABASE_KEY}`,
                    }
                  });
                  const txt = await r.text();
                  setDbError(`HTTP ${r.status} — ${txt.slice(0, 300)}`);
                } catch(e) {
                  setDbError("Network error — " + e.message);
                }
              }}>🔍 Run Diagnostic</button>
              <button className="btn-ghost" style={{ fontSize:11 }} onClick={loadRecords}><IcoRefresh /> Retry</button>
            </div>
          </div>
        )}

        {/* Live DB indicator */}
        {!dbError && (
          <div className="db-banner">
            <div className="db-dot" />
            Live database · {records.length} record{records.length !== 1 ? "s" : ""} · All changes sync instantly across all devices
          </div>
        )}

        {/* ══════ LOOKUP ══════ */}
        {tab === "lookup" && (
          <div>
            <div className="lookup-hero">
              <div className="eyebrow">Quick Vehicle Search</div>
              <h1 className="lookup-h1">Find an <span>EV Owner</span></h1>
              <p className="lookup-p">Enter a vehicle registration number to get owner & location details instantly</p>
            </div>
            <div className="search-box">
              <input className="search-inp" placeholder="Enter vehicle number…" value={query}
                onChange={e => { setQuery(e.target.value); setLookupDone(false); }}
                onKeyDown={e => e.key === "Enter" && handleLookup()} />
              <button className="btn-green" onClick={handleLookup}><IcoSearch /> Search</button>
            </div>
            {lookupDone && lookupResult && (
              <div className="result-card">
                <div className="result-vn"><IcoCar /> {lookupResult.vehicleNumber}</div>
                <div className="result-grid">
                  <div className="rf full"><label>Owner Name</label><span>{lookupResult.ownerName}</span></div>
                  <div className="rf"><label>Manufacturer</label><span>{lookupResult.manufacturer || "—"}</span></div>
                  <div className="rf"><label>Model</label><span>{lookupResult.vehicleModel || "—"}</span></div>
                  <div className="rf"><label>Tower</label><span>{lookupResult.tower}</span></div>
                  <div className="rf"><label>Flat No.</label><span>{lookupResult.flat}</span></div>
                  <div className="rf"><label>Phone</label><span>{lookupResult.phone}</span></div>
                  {lookupResult.email && <div className="rf"><label>Email</label><span>{lookupResult.email}</span></div>}
                </div>
              </div>
            )}
            {lookupDone && !lookupResult && (
              <div className="result-notfound">
                No record found for "<strong>{query.toUpperCase()}</strong>"<br />
                <span style={{ fontSize:11, color:"rgba(255,255,255,.25)" }}>
                  Check the <strong style={{ color:"rgba(74,222,128,.5)" }}>All Vehicles</strong> tab or use <strong style={{ color:"rgba(74,222,128,.5)" }}>Register</strong> to add yours.
                </span>
              </div>
            )}
          </div>
        )}

        {/* ══════ ALL VEHICLES (public) ══════ */}
        {tab === "vehicles" && (
          <div>
            <div className="lookup-hero" style={{ paddingBottom:8 }}>
              <div className="eyebrow">Society Directory</div>
              <h1 className="lookup-h1" style={{ fontSize:30 }}>Registered <span>EVs</span></h1>
              <p className="lookup-p">Browse all registered vehicles. Check before registering to avoid duplicates.</p>
            </div>
            <div style={{ marginTop:28 }}>
              <VehicleTable records={records} showActions={false} onEdit={null} onDelete={null} />
            </div>
          </div>
        )}

        {/* ══════ REGISTER (public — add & edit, NO delete) ══════ */}
        {tab === "register" && (
          <div className="reg-wrap">
            {regSuccess ? (
              <div className="success-panel">
                <div className="success-icon"><IcoCheck /></div>
                <h3>Vehicle Registered!</h3>
                <p>Your EV has been added to the MHT directory and is visible to everyone instantly.</p>
                <button className="btn-green" style={{ margin:"0 auto" }}
                  onClick={() => { setRegSuccess(false); setRegForm(EMPTY_FORM); setRegError(""); setRegVnErr(""); }}>
                  <IcoPlus /> Register Another
                </button>
              </div>
            ) : (
              <div>
                <div className="reg-header">
                  <h2>Register Your Vehicle</h2>
                  <p>Add your EV to the MHT society directory. All fields marked * are required.</p>
                </div>
                <div className="reg-notice">
                  <span style={{ flexShrink:0 }}>ℹ</span>
                  <span>Only the <strong>Admin</strong> can delete records. Check the <strong>All Vehicles</strong> tab first to avoid duplicates.</span>
                </div>
                <VehicleForm
                  form={regForm}
                  onChange={setRegForm}
                  onManufacturerChange={v => setRegForm(f => ({ ...f, manufacturer: v, vehicleModel: "" }))}
                  vnErr={regVnErr}
                  setVnErr={setRegVnErr}
                />
                {regError && <div className="f-err" style={{ marginTop:12 }}>⚠ {regError}</div>}
                <div className="f-actions" style={{ marginTop:16 }}>
                  <button className="btn-cancel" onClick={() => { setRegForm(EMPTY_FORM); setRegError(""); setRegVnErr(""); }}>Clear</button>
                  <button className="btn-green" onClick={handleRegister} disabled={regSaving}>
                    {regSaving ? "Saving…" : <><IcoPlus /> Register Vehicle</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════ ADMIN — login gate ══════ */}
        {tab === "admin" && !isAdmin && loginView === "login" && (
          <div className="login-card">
            <div className="login-icon">🔒</div>
            <h2>Admin Access</h2>
            <p>Enter your password to manage the directory</p>
            <div className="pw-wrap">
              <input type={showPw ? "text" : "password"} className={"pw-inp" + (pwError ? " err" : "")}
                placeholder="Password" value={adminPw}
                onChange={e => { setAdminPw(e.target.value); setPwError(""); }}
                onKeyDown={e => e.key === "Enter" && handleLogin()} />
              <button className="eye-btn" onClick={() => setShowPw(p => !p)}>
                {showPw ? <IcoEyeOff /> : <IcoEye />}
              </button>
            </div>
            {pwError && <div className="pw-err">{pwError}</div>}
            <button className="btn-green" style={{ width:"100%", justifyContent:"center" }} onClick={handleLogin}>Unlock</button>
            <div><button className="forgot-link" onClick={startForgot}>Forgot password?</button></div>
            <div className="hint">Default: admin123</div>
          </div>
        )}

        {/* ══════ ADMIN — forgot password ══════ */}
        {tab === "admin" && !isAdmin && loginView === "forgot" && (
          <div className="login-card" style={{ maxWidth:400 }}>
            <div className="login-icon">🔑</div>
            <div className="forgot-title">Reset Password</div>
            <div className="step-indicator">
              {[1,2,3].map(s => (
                <div key={s} className={"step-dot" + (fStep === s ? " active" : fStep > s ? " done" : "")} />
              ))}
            </div>
            {fStep === 1 && (
              <div>
                <p className="forgot-desc">We'll verify your identity using the security question set by the admin.</p>
                {!getResetQ()
                  ? <div className="pw-err">No security question configured. Contact the society secretary.</div>
                  : <div style={{ background:"rgba(74,222,128,.06)", border:"1px solid rgba(74,222,128,.15)", borderRadius:8, padding:"12px 14px", fontSize:12, color:"rgba(74,222,128,.8)", marginBottom:14, textAlign:"left", lineHeight:1.6 }}>
                      Security question is set. Click Continue to proceed.
                    </div>
                }
                {fErr && <div className="pw-err">{fErr}</div>}
                <button className="btn-green" style={{ width:"100%", justifyContent:"center" }} onClick={forgotNext1}>Continue</button>
              </div>
            )}
            {fStep === 2 && (
              <div className="sf-form">
                <div>
                  <div className="sf-label">Security Question</div>
                  <div style={{ background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)", borderRadius:8, padding:"10px 13px", fontSize:13, color:"rgba(255,255,255,.7)", lineHeight:1.5 }}>
                    {getResetQ()}
                  </div>
                </div>
                <div>
                  <div className="sf-label">Your Answer</div>
                  <input className="pw-inp" style={{ marginBottom:0 }} placeholder="Type your answer"
                    value={fAnswer} onChange={e => { setFAnswer(e.target.value); setFErr(""); }}
                    onKeyDown={e => e.key === "Enter" && forgotNext2()} />
                </div>
                {fErr && <div className="step-err">{fErr}</div>}
                <button className="btn-green" style={{ width:"100%", justifyContent:"center" }} onClick={forgotNext2}>Verify Answer</button>
              </div>
            )}
            {fStep === 3 && (
              <div className="sf-form">
                <p className="forgot-desc">Identity verified. Set your new password below.</p>
                <div>
                  <div className="sf-label">New Password</div>
                  <div className="pw-wrap" style={{ marginBottom:0 }}>
                    <input type={fShowPw ? "text" : "password"} className="pw-inp" style={{ marginBottom:0 }}
                      placeholder="Min. 6 characters" value={fNewPw}
                      onChange={e => { setFNewPw(e.target.value); setFErr(""); }} />
                    <button className="eye-btn" onClick={() => setFShowPw(p => !p)}>
                      {fShowPw ? <IcoEyeOff /> : <IcoEye />}
                    </button>
                  </div>
                </div>
                <div>
                  <div className="sf-label">Confirm Password</div>
                  <input type={fShowPw ? "text" : "password"} className="pw-inp" style={{ marginBottom:0 }}
                    placeholder="Repeat password" value={fConfirm}
                    onChange={e => { setFConfirm(e.target.value); setFErr(""); }}
                    onKeyDown={e => e.key === "Enter" && forgotFinish()} />
                </div>
                {fErr && <div className="step-err">{fErr}</div>}
                <button className="btn-green" style={{ width:"100%", justifyContent:"center" }} onClick={forgotFinish}>
                  <IcoCheck /> Set New Password
                </button>
              </div>
            )}
            <div style={{ marginTop:16 }}>
              <button className="forgot-link" onClick={() => { setLoginView("login"); setFErr(""); }}>← Back to login</button>
            </div>
          </div>
        )}

        {/* ══════ ADMIN — panel (full access: add + edit + DELETE) ══════ */}
        {tab === "admin" && isAdmin && (
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12, marginBottom:20 }}>
              <div className="admin-badge"><IcoLock /> Admin Mode — Full Access</div>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn-ghost" onClick={loadRecords}><IcoRefresh /> Refresh</button>
                <button className="btn-yellow" onClick={openReset}><IcoKey /> Reset Password</button>
              </div>
            </div>

            <div className="stat-row">
              <div className="stat-chip"><span className="stat-num">{records.length}</span><span className="stat-lbl">Total EVs</span></div>
              <div className="stat-chip"><span className="stat-num">{[...new Set(records.map(r => r.tower))].filter(Boolean).length}</span><span className="stat-lbl">Towers</span></div>
              <div className="stat-chip"><span className="stat-num">{[...new Set(records.map(r => r.manufacturer))].filter(Boolean).length}</span><span className="stat-lbl">Makes</span></div>
            </div>

            <div className="toolbar">
              <input className="adm-search" placeholder="Filter records…" />
              <button className="btn-ghost" onClick={() => fileRef.current.click()}><IcoUpload /> Upload CSV</button>
              <button className="btn-green" onClick={() => setTab("register")}><IcoPlus /> Add Entry</button>
              <input ref={fileRef} type="file" accept=".csv" style={{ display:"none" }} onChange={handleCSV} />
            </div>

            <div className="csv-hint">CSV columns (all optional — at least one value per row): <span>vehicleNumber, ownerName, tower, flat, phone, email, manufacturer, vehicleModel</span> · Duplicate vehicle numbers are skipped automatically.</div>
            {csvMsg && <div className={"msg " + (csvMsg.startsWith("✓") ? "ok" : "bad")}>{csvMsg}</div>}

            <VehicleTable records={records} showActions={true} onEdit={openEdit} onDelete={handleDelete} />
          </div>
        )}
      </div>

      {/* ══════ EDIT MODAL ══════ */}
      {showEdit && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowEdit(false)}>
          <div className="modal">
            <div className="modal-hdr">
              <div>
                <div className="modal-title">Edit Vehicle Record</div>
                <div className="modal-sub">Update the details below</div>
              </div>
              <button className="x-btn" onClick={() => setShowEdit(false)}><IcoClose /></button>
            </div>
            <VehicleForm
              form={editForm}
              onChange={setEditForm}
              onManufacturerChange={v => setEditForm(f => ({ ...f, manufacturer: v, vehicleModel: "" }))}
              vnErr={editVnErr}
              setVnErr={setEditVnErr}
            />
            {editError && <div className="f-err" style={{ marginTop:12 }}>⚠ {editError}</div>}
            <div className="f-actions" style={{ marginTop:16 }}>
              <button className="btn-cancel" onClick={() => setShowEdit(false)}>Cancel</button>
              <button className="btn-green" onClick={handleEditSave} disabled={editSaving}>
                {editSaving ? "Saving…" : <><IcoCheck /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ RESET PASSWORD MODAL ══════ */}
      {showReset && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowReset(false)}>
          <div className="modal modal-sm">
            <div className="modal-hdr">
              <div>
                <div className="modal-title">Reset Password</div>
                <div className="modal-sub">{rStep === 1 ? "Verify current password" : "Set new password & security question"}</div>
              </div>
              <button className="x-btn" onClick={() => setShowReset(false)}><IcoClose /></button>
            </div>
            <div className="step-indicator" style={{ justifyContent:"flex-start", marginBottom:22 }}>
              {[1,2].map(s => (
                <div key={s} className={"step-dot" + (rStep === s ? " active" : rStep > s ? " done" : "")} />
              ))}
            </div>
            {rStep === 1 && (
              <div className="sf-form">
                <div>
                  <div className="sf-label">Current Password</div>
                  <div className="pw-wrap" style={{ marginBottom:0 }}>
                    <input type={rShowPw ? "text" : "password"} className="pw-inp" style={{ marginBottom:0 }}
                      placeholder="Enter current password" value={rCurrent}
                      onChange={e => { setRCurrent(e.target.value); setRErr(""); }}
                      onKeyDown={e => e.key === "Enter" && resetNext1()} />
                    <button className="eye-btn" onClick={() => setRShowPw(p => !p)}>
                      {rShowPw ? <IcoEyeOff /> : <IcoEye />}
                    </button>
                  </div>
                </div>
                {rErr && <div className="step-err">{rErr}</div>}
                <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                  <button className="btn-cancel" onClick={() => setShowReset(false)}>Cancel</button>
                  <button className="btn-green" onClick={resetNext1}>Continue</button>
                </div>
              </div>
            )}
            {rStep === 2 && (
              <div className="sf-form">
                <div>
                  <div className="sf-label">New Password</div>
                  <div className="pw-wrap" style={{ marginBottom:0 }}>
                    <input type={rShowPw ? "text" : "password"} className="pw-inp" style={{ marginBottom:0 }}
                      placeholder="Min. 6 characters" value={rNew}
                      onChange={e => { setRNew(e.target.value); setRErr(""); }} />
                    <button className="eye-btn" onClick={() => setRShowPw(p => !p)}>
                      {rShowPw ? <IcoEyeOff /> : <IcoEye />}
                    </button>
                  </div>
                </div>
                <div>
                  <div className="sf-label">Confirm New Password</div>
                  <input type={rShowPw ? "text" : "password"} className="pw-inp" style={{ marginBottom:0 }}
                    placeholder="Repeat new password" value={rConfirm}
                    onChange={e => { setRConfirm(e.target.value); setRErr(""); }} />
                </div>
                <hr style={{ border:"none", borderTop:"1px solid rgba(255,255,255,.07)" }} />
                <div>
                  <div className="sf-label">Security Question <span className="req">*</span></div>
                  <select className="fs" value={rQ} onChange={e => { setRQ(e.target.value); setRErr(""); }}>
                    <option value="">— Choose a question —</option>
                    {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                  </select>
                </div>
                <div>
                  <div className="sf-label">Your Answer <span className="req">*</span></div>
                  <input className="fi" placeholder="Answer (not case-sensitive)" value={rA}
                    onChange={e => { setRA(e.target.value); setRErr(""); }} />
                </div>
                {rErr && <div className="step-err">{rErr}</div>}
                <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                  <button className="btn-cancel" onClick={() => setRStep(1)}>Back</button>
                  <button className="btn-green" onClick={resetSave}><IcoCheck /> Save Changes</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {toast.msg && <div className={"toast" + (toast.type === "err" ? " err" : "")}>✓ {toast.msg}</div>}
    </div>
  );
}
