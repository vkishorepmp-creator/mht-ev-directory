import { useState, useEffect, useRef } from "react";
import { fetchRecords, insertRecord, updateRecord, deleteRecord, bulkInsert } from "./supabase";
import { signUp, signIn, signOut, getSession, onAuthChange, getMyProfile, listPending, setApproval } from "./auth";

// ─── Constants ────────────────────────────────────────────────────────────────
// Indian-market EV catalogue with battery capacity (kWh). Sourced from public
// spec data (2024-25). Residents can also type a model not listed here.
const EV_MAKERS = [
  { name: "Tata Motors", models: [
    { name: "Tiago EV", battery: [19.2, 24] },
    { name: "Tigor EV", battery: [26] },
    { name: "Punch EV", battery: [25, 35] },
    { name: "Nexon EV", battery: [30, 40.5, 46.08] },
    { name: "Curvv EV", battery: [45, 55] },
  ]},
  { name: "JSW MG Motor India", models: [
    { name: "Comet EV", battery: [17.3] },
    { name: "Windsor EV", battery: [38, 52.9] },
    { name: "ZS EV", battery: [50.3] },
  ]},
  { name: "Mahindra & Mahindra", models: [
    { name: "XUV400", battery: [34.5, 39.4] },
    { name: "BE 6", battery: [59, 79] },
    { name: "XEV 9e", battery: [59, 79] },
  ]},
  { name: "Hyundai Motor India", models: [
    { name: "Creta EV", battery: [42, 51.4] },
    { name: "Ioniq 5", battery: [72.6] },
  ]},
  { name: "BYD India", models: [
    { name: "e6/M6", battery: [71.8, 55.4] },
    { name: "Atto 3", battery: [60.48, 49.92] },
    { name: "Seal", battery: [61.4, 82.5] },
  ]},
  { name: "BMW India", models: [
    { name: "iX1", battery: [64.7] },
    { name: "i4", battery: [81.5] },
    { name: "i5", battery: [81.2] },
    { name: "iX", battery: [76.6, 111.5] },
    { name: "i7", battery: [101.7] },
  ]},
  { name: "Mercedes-Benz India", models: [
    { name: "EQA", battery: [66.5] },
    { name: "EQB", battery: [66.5] },
    { name: "EQE SUV", battery: [90.6] },
    { name: "EQS Sedan", battery: [107.8] },
  ]},
  { name: "Audi India", models: [
    { name: "Q4 e-tron", battery: [82] },
    { name: "Q8 e-tron", battery: [114] },
    { name: "Q8 e-tron Sportback", battery: [114] },
    { name: "e-tron GT", battery: [93.4] },
    { name: "RS e-tron GT", battery: [93.4] },
  ]},
  { name: "Volvo & Polestar India", models: [
    { name: "XC40 Recharge (EX40)", battery: [69, 78] },
    { name: "C40 Recharge (EC40)", battery: [69, 78] },
    { name: "EX90", battery: [111] },
  ]},
  { name: "Kia India", models: [
    { name: "EV6", battery: [77.4, 84] },
    { name: "EV9", battery: [99.8] },
  ]},
  { name: "Maruti Suzuki", models: [
    { name: "e Vitara", battery: [49, 61] },
  ]},
  { name: "VinFast India", models: [
    { name: "VF e34", battery: [42] },
    { name: "VF 5", battery: [37.23] },
  ]},
  { name: "Porsche India", models: [
    { name: "Taycan", battery: [79.2, 93.4, 105] },
    { name: "Taycan Cross Turismo", battery: [93.4, 105] },
    { name: "Macan Electric", battery: [100] },
  ]},
  { name: "Jaguar Land Rover", models: [
    { name: "Jaguar I-Pace", battery: [90] },
  ]},
  { name: "Rolls-Royce Motor Cars", models: [
    { name: "Spectre", battery: [102] },
  ]},
];

const TOWERS = [1,2,3,4,5,6,7,8,9];
const EMPTY_FORM = { vehicleNumber:"", ownerName:"", tower:"", flat:"", phone:"", email:"", manufacturer:"", vehicleModel:"", batteryCapacity:"" };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function validateVN(v) {
  if (!v) return "Vehicle number is required.";
  if (!/^[A-Z0-9]+$/.test(v)) return "Vehicle number must be letters and digits only.";
  // Indian registration formats (no spaces — input is already stripped):
  //  Standard: SS DD L(1-3) NNNN   e.g. MH12AB1234, KA01C0001, DL3CAB1234
  //  Bharat:   YY BH NNNN L(1-2)   e.g. 22BH1234AA
  const standard = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/;
  const bharat   = /^\d{2}BH\d{4}[A-Z]{1,2}$/;
  if (!standard.test(v) && !bharat.test(v))
    return "Enter a valid Indian number, e.g. MH12AB1234 or 22BH1234AA.";
  return "";
}
function validatePhone(v) {
  if (!v) return "Phone number is required.";
  if (!/^\d{10}$/.test(v)) return "Phone must be exactly 10 digits.";
  return "";
}
function validateFlat(v) {
  if (!v) return "Flat number is required.";
  if (!/^\d{3,4}$/.test(v)) return "Flat number must be 3 or 4 digits.";
  return "";
}
function validateBattery(v) {
  if (v === "" || v == null) return "Battery capacity is required.";
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "Battery capacity must be a number in kWh.";
  if (n < 5 || n > 250) return "Battery capacity looks off — enter kWh (e.g. 40.5).";
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
function VehicleForm({ form, onChange, onManufacturerChange, vnErr, setVnErr, idPrefix = "f" }) {
  const maker     = EV_MAKERS.find(m => m.name === form.manufacturer);
  const modelList = maker?.models || [];
  const modelEntry = modelList.find(m => m.name === form.vehicleModel);
  const batteryOpts = modelEntry?.battery || [];

  function handleModelChange(v) {
    const me = modelList.find(m => m.name === v);
    // Auto-fill battery only when the model has a single known capacity.
    const battery = me && me.battery.length === 1 ? String(me.battery[0]) : form.batteryCapacity;
    onChange({ ...form, vehicleModel: v, batteryCapacity: battery });
  }

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
          {vnErr || "Letters and digits only — e.g. MH12AB1234"}
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
        <input className={"fi" + (form.phone && validatePhone(form.phone) ? " fi-err" : "")}
          inputMode="numeric" maxLength={10} value={form.phone}
          onChange={e => onChange({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
          placeholder="10-digit mobile" />
        {form.phone && validatePhone(form.phone) &&
          <span className="field-hint hint-err">{validatePhone(form.phone)}</span>}
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
        <input className={"fi" + (form.flat && validateFlat(form.flat) ? " fi-err" : "")}
          inputMode="numeric" maxLength={4} value={form.flat}
          onChange={e => onChange({ ...form, flat: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          placeholder="e.g. 304" />
        {form.flat && validateFlat(form.flat) &&
          <span className="field-hint hint-err">{validateFlat(form.flat)}</span>}
      </div>
      <hr className="form-divider" />
      <div className="sec-label">Vehicle Details</div>
      <div className="fg full">
        <label>Manufacturer <span className="req">*</span></label>
        <input className="fi" list={idPrefix + "-mfr"} value={form.manufacturer}
          onChange={e => onManufacturerChange(e.target.value)}
          placeholder="Select or type manufacturer" />
        <datalist id={idPrefix + "-mfr"}>
          {EV_MAKERS.map(m => <option key={m.name} value={m.name} />)}
        </datalist>
      </div>
      <div className="fg">
        <label>Vehicle Model <span className="req">*</span></label>
        <input className="fi" list={idPrefix + "-model"} value={form.vehicleModel}
          onChange={e => handleModelChange(e.target.value)}
          placeholder="Select or type model" />
        <datalist id={idPrefix + "-model"}>
          {modelList.map(m => <option key={m.name} value={m.name} />)}
        </datalist>
      </div>
      <div className="fg">
        <label>Battery Capacity (kWh) <span className="req">*</span></label>
        <input className="fi" list={idPrefix + "-bat"} inputMode="decimal"
          value={form.batteryCapacity}
          onChange={e => onChange({ ...form, batteryCapacity: e.target.value.replace(/[^\d.]/g, "") })}
          placeholder="e.g. 40.5" />
        <datalist id={idPrefix + "-bat"}>
          {batteryOpts.map(b => <option key={b} value={b} />)}
        </datalist>
        <span className="field-hint">Pick a known capacity or type your own.</span>
      </div>
    </div>
  );
}

// ─── Vehicle Table ────────────────────────────────────────────────────────────
function VehicleTable({ records, isAdmin, currentUserId, onEdit, onDelete }) {
  const [search, setSearch] = useState("");
  const filtered = records.filter(r =>
    !search || [r.vehicleNumber, r.ownerName, r.tower, r.flat, r.phone, r.manufacturer, r.vehicleModel]
      .some(v => v && v.toLowerCase().includes(search.toLowerCase()))
  );
  // A row is editable by an admin, or by the resident who owns it.
  const canEdit = r => isAdmin || (currentUserId && r.userId === currentUserId);
  const showActionsCol = isAdmin || !!currentUserId;
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12, marginBottom:16 }}>
        <div>
          <div style={{ fontFamily:"'Outfit',sans-serif", fontWeight:800, fontSize:18, color:"#fff", marginBottom:2 }}>
            Registered Vehicles
          </div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>
            {records.length} EV{records.length !== 1 ? "s" : ""} registered
            {!isAdmin && " · You can edit your own entry"}
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
                  {showActionsCol && <th></th>}
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
                    {showActionsCol && (
                      <td>
                        <div className="acts">
                          {canEdit(r) && <button className="ico-btn" onClick={() => onEdit(r)} title="Edit"><IcoEdit /></button>}
                          {isAdmin && <button className="ico-btn del" onClick={() => onDelete(r.id)} title="Delete"><IcoDelete /></button>}
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

// ─── Dashboard ────────────────────────────────────────────────────────────────
function countBy(records, keyFn) {
  const map = new Map();
  for (const r of records) {
    const k = keyFn(r);
    if (k === "" || k == null) continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function BarList({ title, rows, total, unit = "" }) {
  const max = rows.length ? Math.max(...rows.map(r => r[1])) : 1;
  return (
    <div className="dash-card">
      <div className="dash-card-title">{title}</div>
      {rows.length === 0
        ? <div className="csv-hint">No data yet.</div>
        : rows.map(([label, n]) => (
            <div key={label} className="bar-row">
              <div className="bar-label">{label}{unit}</div>
              <div className="bar-track"><div className="bar-fill" style={{ width: (n / max * 100) + "%" }} /></div>
              <div className="bar-num">{n}</div>
            </div>
          ))
      }
    </div>
  );
}

function Dashboard({ records }) {
  const byBrand   = countBy(records, r => r.manufacturer);
  const byModel   = countBy(records, r => r.vehicleModel);
  const byBattery = countBy(records, r => r.batteryCapacity !== "" && r.batteryCapacity != null ? String(r.batteryCapacity) : "")
    .map(([k, n]) => [k + " kWh", n]);
  const totalKwh  = records.reduce((s, r) => s + (Number(r.batteryCapacity) || 0), 0);
  const recent    = [...records]
    .filter(r => r.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  return (
    <div>
      <div className="lookup-hero" style={{ paddingBottom:8 }}>
        <div className="eyebrow">Community Insights</div>
        <h1 className="lookup-h1" style={{ fontSize:30 }}>EV Ownership <span>Dashboard</span></h1>
        <p className="lookup-p">How the society's EV fleet breaks down by brand, model, and battery size.</p>
      </div>
      <div className="stat-row" style={{ marginTop:24 }}>
        <div className="stat-chip"><span className="stat-num">{records.length}</span><span className="stat-lbl">Total EVs</span></div>
        <div className="stat-chip"><span className="stat-num">{byBrand.length}</span><span className="stat-lbl">Brands</span></div>
        <div className="stat-chip"><span className="stat-num">{byModel.length}</span><span className="stat-lbl">Models</span></div>
        <div className="stat-chip"><span className="stat-num">{Math.round(totalKwh)}</span><span className="stat-lbl">Total kWh</span></div>
      </div>
      <div className="dash-grid">
        <BarList title="By Brand" rows={byBrand} />
        <BarList title="By Model" rows={byModel} />
        <BarList title="By Battery Capacity" rows={byBattery} />
      </div>
      <div className="dash-card" style={{ marginTop:16 }}>
        <div className="dash-card-title">🔌 Newest EVs in the community</div>
        {recent.length === 0
          ? <div className="csv-hint">No registrations yet.</div>
          : recent.map(r => (
              <div key={r.id} className="eti-row" style={{ marginBottom:10 }}>
                <span className="eti-ico ok">⚡</span>
                <span>
                  <strong style={{ color:"#fff" }}>{r.manufacturer} {r.vehicleModel}</strong>
                  {" — Tower "}{r.tower}{r.flat ? `, Flat ${r.flat}` : ""}
                  {r.createdAt && <span style={{ color:"rgba(255,255,255,.3)", fontSize:11 }}>{"  ·  "}{new Date(r.createdAt).toLocaleDateString()}</span>}
                </span>
              </div>
            ))
        }
      </div>
    </div>
  );
}

// ─── Charging Etiquette ───────────────────────────────────────────────────────
const CHARGING_DOS = [
  "Move your car once it's charged — free the point for the next resident.",
  "Unplug gently and coil the cable back on the holster, off the ground.",
  "Charge to ~80% for daily use; leave the last 20% for someone who needs a top-up.",
  "Note your start time; if there's a shared log or WhatsApp group, post when you plug in and unplug.",
  "Report a faulty charger or damaged cable to the society office immediately.",
  "Use a timer or app reminder so you don't occupy the bay longer than needed.",
];
const CHARGING_DONTS = [
  "Don't leave the car parked at the charger after it's full ('ICE-ing' the EV bay).",
  "Don't unplug someone else's charging car unless there's an agreed, posted rule.",
  "Don't run a cable across a walkway or from your flat — it's a trip and fire hazard.",
  "Don't use a damaged charger or cable; stop and report it.",
  "Don't hog the fast charger for an overnight slow charge — use it for quick top-ups.",
  "Don't block the bay with a non-EV or a fully charged car.",
];

function ChargingEtiquette() {
  return (
    <div>
      <div className="lookup-hero" style={{ paddingBottom:8 }}>
        <div className="eyebrow">Shared Charger Etiquette</div>
        <h1 className="lookup-h1" style={{ fontSize:30 }}>Charging <span>Do's & Don'ts</span></h1>
        <p className="lookup-p">A few shared courtesies keep the community chargers fair and available for everyone.</p>
      </div>
      <div className="dash-grid" style={{ marginTop:24 }}>
        <div className="dash-card">
          <div className="dash-card-title" style={{ color:"#4ade80" }}>✓ Do</div>
          {CHARGING_DOS.map((t, i) => (
            <div key={i} className="eti-row"><span className="eti-ico ok">✓</span><span>{t}</span></div>
          ))}
        </div>
        <div className="dash-card">
          <div className="dash-card-title" style={{ color:"rgba(252,165,165,.9)" }}>✕ Don't</div>
          {CHARGING_DONTS.map((t, i) => (
            <div key={i} className="eti-row"><span className="eti-ico bad">✕</span><span>{t}</span></div>
          ))}
        </div>
      </div>
      <div className="reg-notice" style={{ marginTop:20 }}>
        <span style={{ flexShrink:0 }}>ℹ</span>
        <span>Society charging rules vary. If the management committee has posted specific timings or booking rules, those take precedence over this general guidance.</span>
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

.contact-row { display:flex; gap:10px; margin-top:20px; flex-wrap:wrap; }
.contact-btn { text-decoration:none; padding:9px 18px; border-radius:8px; font-family:'DM Mono',monospace; font-size:11px; letter-spacing:1px; text-transform:uppercase; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.12); color:rgba(255,255,255,.7); transition:all .2s; }
.contact-btn:hover { border-color:rgba(74,222,128,.4); color:#4ade80; }
.contact-btn.wa { border-color:rgba(74,222,128,.3); color:#4ade80; }
.dash-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:16px; margin-top:8px; }
.dash-card { background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.07); border-radius:14px; padding:20px 22px; }
.dash-card-title { font-family:'Outfit',sans-serif; font-weight:800; font-size:15px; color:#fff; margin-bottom:16px; }
.bar-row { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.bar-label { flex:0 0 38%; font-size:12px; color:rgba(255,255,255,.6); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bar-track { flex:1; height:8px; background:rgba(255,255,255,.05); border-radius:5px; overflow:hidden; }
.bar-fill { height:100%; background:linear-gradient(90deg,#22c55e,#4ade80); border-radius:5px; }
.bar-num { flex:0 0 28px; text-align:right; font-size:12px; color:#4ade80; font-weight:500; }
.eti-row { display:flex; align-items:flex-start; gap:10px; font-size:13px; color:rgba(255,255,255,.7); line-height:1.55; margin-bottom:12px; }
.eti-ico { flex-shrink:0; width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; margin-top:1px; }
.eti-ico.ok { background:rgba(34,197,94,.12); color:#4ade80; }
.eti-ico.bad { background:rgba(239,68,68,.12); color:rgba(252,165,165,.9); }

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
  const [toast, setToast]       = useState({ msg:"", type:"ok" });

  // ── Auth / profile (the React flags are presentation only; RLS enforces)
  const [session, setSession]         = useState(null);
  const [profile, setProfile]         = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const isAdmin    = profile?.role === "admin";
  const isApproved = isAdmin || profile?.status === "approved";

  // ── Auth form
  const [authMode, setAuthMode]     = useState("login"); // "login" | "signup"
  const [authEmail, setAuthEmail]   = useState("");
  const [authPw, setAuthPw]         = useState("");
  const [authName, setAuthName]     = useState("");
  const [authFlat, setAuthFlat]     = useState("");
  const [authErr, setAuthErr]       = useState("");
  const [authBusy, setAuthBusy]     = useState(false);
  const [showPw, setShowPw]         = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  // ── Admin approvals
  const [pendingList, setPendingList] = useState([]);

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

  // ── Edit (admin: any record; resident: own record)
  const [editRec, setEditRec]     = useState(null);
  const [editForm, setEditForm]   = useState(EMPTY_FORM);
  const [editVnErr, setEditVnErr] = useState("");
  const [editError, setEditError] = useState("");
  const [showEdit, setShowEdit]   = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // ── CSV
  const [csvMsg, setCsvMsg] = useState("");
  const fileRef = useRef();

  // ── Auth bootstrap: read session once, then subscribe to changes
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      setSession(await getSession());
      setAuthChecked(true);
      unsub = onAuthChange(s => setSession(s));
    })();
    return () => unsub();
  }, []);

  // When the session changes, (re)load profile and — if approved — records
  useEffect(() => {
    if (!session) { setProfile(null); setRecords([]); setLoading(false); return; }
    (async () => {
      try {
        const p = await getMyProfile();
        setProfile(p);
        if (p && (p.status === "approved" || p.role === "admin")) {
          await loadRecords();
        } else {
          setLoading(false);
        }
      } catch (err) {
        setDbError(err.message || "Could not load your profile.");
        setLoading(false);
      }
    })();
  }, [session]);

  async function loadRecords() {
    setLoading(true); setDbError("");
    try {
      setRecords(await fetchRecords());
    } catch (err) {
      setDbError("Could not load records — " + (err.message || "unknown error") + ".");
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
    const q = query.trim().toLowerCase();
    if (!q) return;
    // Forgiving match: exact vehicle number wins; else first substring hit
    // across vehicle number, owner name, or flat (parity with All Vehicles).
    const exact = records.find(r => r.vehicleNumber.toLowerCase() === q);
    const hit = exact || records.find(r =>
      [r.vehicleNumber, r.ownerName, r.flat].some(v => v && v.toLowerCase().includes(q))
    );
    setLookupResult(hit || null);
    setLookupDone(true);
  }

  // ── Auth actions
  async function handleAuth() {
    setAuthErr(""); setAuthBusy(true);
    try {
      if (authMode === "signup") {
        if (!authName.trim()) throw new Error("Please enter your name.");
        const flatE = validateFlat(authFlat.trim());
        if (flatE) throw new Error(flatE);
        if (authPw.length < 6) throw new Error("Password must be at least 6 characters.");
        await signUp({ email: authEmail.trim(), password: authPw, fullName: authName.trim(), flat: authFlat.trim() });
        setSignupDone(true);
      } else {
        await signIn({ email: authEmail.trim(), password: authPw });
        // session updates via onAuthChange → profile + records load
      }
      setAuthPw("");
    } catch (err) {
      setAuthErr(err.message || "Authentication failed.");
    } finally {
      setAuthBusy(false);
    }
  }
  async function handleSignOut() {
    await signOut();
    setProfile(null); setTab("lookup"); setLookupResult(null); setLookupDone(false);
  }

  // ── Admin approvals
  async function loadPending() {
    try { setPendingList(await listPending()); }
    catch (err) { flash(err.message || "Could not load pending list.", "err"); }
  }
  async function decide(id, status) {
    try {
      await setApproval(id, status);
      setPendingList(prev => prev.filter(p => p.id !== id));
      flash(status === "approved" ? "Resident approved." : "Signup rejected.");
    } catch (err) {
      flash(err.message || "Action failed.", "err");
    }
  }

  // ── Validate form
  function validateForm(form, excludeId) {
    const vnE = validateVN(form.vehicleNumber);
    if (vnE) return vnE;
    if (!form.ownerName.trim()) return "Owner name is required.";
    if (!form.tower)            return "Tower is required.";
    const flatE = validateFlat(form.flat.trim());
    if (flatE) return flatE;
    const phoneE = validatePhone(form.phone.trim());
    if (phoneE) return phoneE;
    if (!form.manufacturer.trim()) return "Manufacturer is required.";
    if (!form.vehicleModel.trim()) return "Vehicle model is required.";
    const batE = validateBattery(form.batteryCapacity);
    if (batE) return batE;
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
      const newRec = await insertRecord({ ...regForm, vehicleNumber: regForm.vehicleNumber.toUpperCase() }, session?.user?.id);
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
      flash("Cannot edit this record - missing ID", "err");
      return;
    }
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
      await updateRecord(editRec.id, { ...editForm, vehicleNumber: editForm.vehicleNumber.toUpperCase() });
      setRecords(prev => prev.map(r =>
        r.id === editRec.id ? { ...editForm, id: r.id, vehicleNumber: editForm.vehicleNumber.toUpperCase() } : r
      ));
      setShowEdit(false); flash("Record updated.");
    } catch (error) {
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
      await deleteRecord(id);
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
            batterycapacity: ["batterycapacity","battery","battery_capacity","kwh","batterykwh","capacity"],
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
            batteryCapacity: get("batterycapacity"),
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

        await bulkInsert(newRecs);
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

  const Shell = ({ children }) => (
    <div style={{ minHeight:"100vh", background:"#080d1a", fontFamily:"'DM Mono','Courier New',monospace", color:"#e8eaf0", display:"flex", flexDirection:"column" }}>
      <style>{CSS}</style>
      {children}
    </div>
  );

  // ── Loading / auth-check state
  if (!authChecked || loading) {
    return (
      <Shell>
        <div className="loading-wrap" style={{ flex:1 }}>
          <div className="spinner" />
          <div className="loading-txt">Loading…</div>
        </div>
      </Shell>
    );
  }

  // ── Not signed in → login / signup
  if (!session) {
    return (
      <Shell>
        <div className="login-card" style={{ maxWidth:400 }}>
          <div className="login-icon">⚡</div>
          <h2>MHT EV Directory</h2>
          <p>{authMode === "login" ? "Sign in to view the resident directory" : "Create a resident account"}</p>
          {signupDone ? (
            <div style={{ background:"rgba(74,222,128,.06)", border:"1px solid rgba(74,222,128,.15)", borderRadius:8, padding:"14px 16px", fontSize:12.5, color:"rgba(74,222,128,.85)", lineHeight:1.6, textAlign:"left" }}>
              Account created. If email confirmation is enabled, confirm via the link we sent.
              Your account then needs <strong>admin approval</strong> before you can see the directory.
              <div style={{ marginTop:12 }}>
                <button className="forgot-link" onClick={() => { setSignupDone(false); setAuthMode("login"); }}>← Back to sign in</button>
              </div>
            </div>
          ) : (
            <div className="sf-form">
              {authMode === "signup" && (
                <>
                  <input className="pw-inp" style={{ marginBottom:0 }} placeholder="Full name"
                    value={authName} onChange={e => { setAuthName(e.target.value); setAuthErr(""); }} />
                  <input className="pw-inp" style={{ marginBottom:0 }} placeholder="Flat no. (3–4 digits)"
                    inputMode="numeric" maxLength={4} value={authFlat}
                    onChange={e => { setAuthFlat(e.target.value.replace(/\D/g, "").slice(0,4)); setAuthErr(""); }} />
                </>
              )}
              <input className="pw-inp" style={{ marginBottom:0 }} placeholder="Email" type="email"
                value={authEmail} onChange={e => { setAuthEmail(e.target.value); setAuthErr(""); }} />
              <div className="pw-wrap" style={{ marginBottom:0 }}>
                <input type={showPw ? "text" : "password"} className="pw-inp" style={{ marginBottom:0 }}
                  placeholder="Password (min. 6 chars)" value={authPw}
                  onChange={e => { setAuthPw(e.target.value); setAuthErr(""); }}
                  onKeyDown={e => e.key === "Enter" && handleAuth()} />
                <button className="eye-btn" onClick={() => setShowPw(p => !p)}>
                  {showPw ? <IcoEyeOff /> : <IcoEye />}
                </button>
              </div>
              {authErr && <div className="step-err">{authErr}</div>}
              <button className="btn-green" style={{ width:"100%", justifyContent:"center" }} onClick={handleAuth} disabled={authBusy}>
                {authBusy ? "Please wait…" : (authMode === "login" ? "Sign In" : "Create Account")}
              </button>
              <button className="forgot-link" onClick={() => { setAuthMode(m => m === "login" ? "signup" : "login"); setAuthErr(""); }}>
                {authMode === "login" ? "New resident? Create an account" : "Have an account? Sign in"}
              </button>
            </div>
          )}
        </div>
      </Shell>
    );
  }

  // ── Signed in but not approved yet
  if (!isApproved) {
    return (
      <Shell>
        <div className="login-card" style={{ maxWidth:400 }}>
          <div className="login-icon">⏳</div>
          <h2>Awaiting Approval</h2>
          <p>Your account is pending approval by the society admin. You'll get access to the directory once approved.</p>
          <button className="btn-ghost" style={{ margin:"8px auto 0" }} onClick={handleSignOut}>Sign out</button>
        </div>
      </Shell>
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
            <button className={"tab-btn" + (tab==="dashboard" ? " active" : "")} onClick={() => setTab("dashboard")}>Dashboard</button>
            <button className={"tab-btn" + (tab==="charging" ? " active" : "")} onClick={() => setTab("charging")}>Charging</button>
            <button className={"tab-btn" + (tab==="register" ? " active" : "")} onClick={() => setTab("register")}>Register</button>
            {isAdmin && (
              <button className={"tab-btn admin-tab" + (tab==="admin" ? " active" : "")}
                onClick={() => { setTab("admin"); loadPending(); }}>
                <span style={{ display:"flex", alignItems:"center", gap:5 }}><IcoLock /> Admin</span>
              </button>
            )}
            <button className="tab-btn" onClick={handleSignOut} title="Sign out">Sign out</button>
          </div>
        </div>
      </header>

      <div className="page">

        {/* DB error banner */}
        {dbError && (
          <div style={{ marginBottom:24 }}>
            <div className="msg bad">⚠ {dbError}</div>
            <div style={{ marginTop:8, display:"flex", gap:8, alignItems:"center" }}>
              <button className="btn-ghost" style={{ fontSize:11 }} onClick={loadRecords}><IcoRefresh /> Retry</button>
            </div>
          </div>
        )}

        {/* Live DB indicator */}
        {!dbError && (
          <div className="db-banner">
            <div className="db-dot" />
            Resident directory · {records.length} record{records.length !== 1 ? "s" : ""} · Visible only to approved residents
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
              <input className="search-inp" placeholder="Vehicle number, owner name, or flat…" value={query}
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
                  <div className="rf"><label>Battery</label><span>{lookupResult.batteryCapacity ? lookupResult.batteryCapacity + " kWh" : "—"}</span></div>
                  <div className="rf"><label>Tower</label><span>{lookupResult.tower}</span></div>
                  <div className="rf"><label>Flat No.</label><span>{lookupResult.flat}</span></div>
                  <div className="rf"><label>Phone</label><span>{lookupResult.phone}</span></div>
                  {lookupResult.email && <div className="rf"><label>Email</label><span>{lookupResult.email}</span></div>}
                </div>
                <div className="contact-row">
                  {lookupResult.phone && <a className="contact-btn" href={`tel:${lookupResult.phone}`}>Call</a>}
                  {lookupResult.phone && <a className="contact-btn wa" href={`https://wa.me/91${lookupResult.phone}`} target="_blank" rel="noreferrer">WhatsApp</a>}
                  {lookupResult.email && <a className="contact-btn" href={`mailto:${lookupResult.email}`}>Email</a>}
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
              <VehicleTable records={records} isAdmin={isAdmin} currentUserId={session.user.id} onEdit={openEdit} onDelete={handleDelete} />
            </div>
          </div>
        )}

        {/* ══════ DASHBOARD ══════ */}
        {tab === "dashboard" && <Dashboard records={records} />}

        {/* ══════ CHARGING ETIQUETTE ══════ */}
        {tab === "charging" && <ChargingEtiquette />}

        {/* ══════ REGISTER (public — add & edit, NO delete) ══════ */}
        {tab === "register" && (
          <div className="reg-wrap">
            {regSuccess ? (
              <div className="success-panel">
                <div className="success-icon"><IcoCheck /></div>
                <h3>Vehicle Registered!</h3>
                <p>Your EV has been added to the MHT directory and is visible to approved residents.</p>
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
                  onManufacturerChange={v => setRegForm(f => ({ ...f, manufacturer: v, vehicleModel: "", batteryCapacity: "" }))}
                  vnErr={regVnErr}
                  setVnErr={setRegVnErr}
                  idPrefix="reg"
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

        {/* ══════ ADMIN — panel (full access: approvals + add + edit + DELETE) ══════ */}
        {tab === "admin" && isAdmin && (
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12, marginBottom:20 }}>
              <div className="admin-badge"><IcoLock /> Admin Mode — Full Access</div>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn-ghost" onClick={() => { loadRecords(); loadPending(); }}><IcoRefresh /> Refresh</button>
              </div>
            </div>

            {/* Pending approvals */}
            <div style={{ marginBottom:24 }}>
              <div className="sec-label" style={{ marginBottom:10 }}>Pending Approvals ({pendingList.length})</div>
              {pendingList.length === 0
                ? <div className="csv-hint">No residents awaiting approval.</div>
                : <div className="tbl-wrap">
                    <table>
                      <thead><tr><th>Name</th><th>Email</th><th>Flat</th><th></th></tr></thead>
                      <tbody>
                        {pendingList.map(p => (
                          <tr key={p.id}>
                            <td>{p.full_name || "—"}</td>
                            <td style={{ color:"rgba(255,255,255,.55)", fontSize:12 }}>{p.email || "—"}</td>
                            <td>{p.flat || "—"}</td>
                            <td>
                              <div className="acts">
                                <button className="btn-green" style={{ padding:"6px 12px" }} onClick={() => decide(p.id, "approved")}><IcoCheck /> Approve</button>
                                <button className="ico-btn del" onClick={() => decide(p.id, "rejected")} title="Reject"><IcoClose /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              }
            </div>

            <div className="stat-row">
              <div className="stat-chip"><span className="stat-num">{records.length}</span><span className="stat-lbl">Total EVs</span></div>
              <div className="stat-chip"><span className="stat-num">{[...new Set(records.map(r => r.tower))].filter(Boolean).length}</span><span className="stat-lbl">Towers</span></div>
              <div className="stat-chip"><span className="stat-num">{[...new Set(records.map(r => r.manufacturer))].filter(Boolean).length}</span><span className="stat-lbl">Makes</span></div>
            </div>

            <div className="toolbar">
              <button className="btn-ghost" onClick={() => fileRef.current.click()}><IcoUpload /> Upload CSV</button>
              <button className="btn-green" onClick={() => setTab("register")}><IcoPlus /> Add Entry</button>
              <input ref={fileRef} type="file" accept=".csv" style={{ display:"none" }} onChange={handleCSV} />
            </div>

            <div className="csv-hint">CSV columns (all optional — at least one value per row): <span>vehicleNumber, ownerName, tower, flat, phone, email, manufacturer, vehicleModel, batteryCapacity</span> · Duplicate vehicle numbers are skipped automatically.</div>
            {csvMsg && <div className={"msg " + (csvMsg.startsWith("✓") ? "ok" : "bad")}>{csvMsg}</div>}

            <VehicleTable records={records} isAdmin={isAdmin} currentUserId={session.user.id} onEdit={openEdit} onDelete={handleDelete} />
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
              onManufacturerChange={v => setEditForm(f => ({ ...f, manufacturer: v, vehicleModel: "", batteryCapacity: "" }))}
              vnErr={editVnErr}
              setVnErr={setEditVnErr}
              idPrefix="edit"
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

      {toast.msg && <div className={"toast" + (toast.type === "err" ? " err" : "")}>✓ {toast.msg}</div>}
    </div>
  );
}
