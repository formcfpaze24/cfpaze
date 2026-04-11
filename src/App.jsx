import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { supabase } from "./supabase";
import { cfpaHeader } from "./assets/cfpaHeader.js";

// ─── Design System ────────────────────────────────────────────────────────────
const DS = {
  bg:"#f1f5f9", surface:"#ffffff", surfaceAlt:"#f8fafc",
  border:"#e2e8f0", borderFocus:"#3b82f6",
  sidebar:"#0f172a",
  primary:"#2563eb", primaryHover:"#1d4ed8", primaryLight:"#eff6ff",
  success:"#059669", successLight:"#f0fdf4",
  warning:"#d97706", warningLight:"#fffbeb",
  danger:"#dc2626",  dangerLight:"#fef2f2",
  purple:"#7c3aed",  purpleLight:"#f5f3ff",
  teal:"#0891b2",    tealLight:"#f0fdfa",
  text:"#0f172a", textMid:"#475569", textLight:"#94a3b8",
  navy:"#1e3a8a",
  shadow:"0 1px 3px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.04)",
  shadowMd:"0 4px 6px rgba(0,0,0,0.07),0 2px 4px rgba(0,0,0,0.04)",
  shadowLg:"0 10px 25px rgba(0,0,0,0.1),0 4px 10px rgba(0,0,0,0.05)",
  radius:"10px", radiusSm:"7px", radiusLg:"14px",
};

const PALETTE = ["#2563eb","#7c3aed","#059669","#d97706","#dc2626","#0891b2","#db2777","#65a30d","#ea580c","#0284c7"];
const ANNEES  = ["2025–2026","2026–2027","2027–2028","2028–2029","2029–2030","2030–2031","2031–2032","2032–2033","2033–2034","2034–2035","2035–2036"];
const SESSIONS = ["1ère Session","2ème Session"];
const NIVEAUX  = ["Niveau 1","Niveau 2","Niveau 3"];
const NOM_CENTRE = "Centre de Formation Professionnelle et d'Apprentissage de Zé";
const NOM_COURT  = "CFPA-Zé";

const METIERS_DEF = [
  {id:"t1",nom:"Électricité Bâtiment",description:"Installation et maintenance électrique"},
  {id:"t2",nom:"IME",description:"Systèmes informatiques et réseaux"},
  {id:"t3",nom:"Maçonnerie",description:"Construction et gros œuvre"},
  {id:"t4",nom:"Coupe Couture",description:"Création et confection vestimentaire"},
];
const MODULES_DEF = [
  {id:"m1",nom:"Mathématiques",coefficient:2,metierId:""},
  {id:"m2",nom:"Français",coefficient:2,metierId:""},
  {id:"m3",nom:"Sciences Physiques",coefficient:2,metierId:""},
  {id:"m4",nom:"Technologie",coefficient:3,metierId:""},
  {id:"m5",nom:"Pratique Professionnelle",coefficient:4,metierId:""},
  {id:"m6",nom:"Éducation Civique",coefficient:1,metierId:""},
];

// ─── Utils ────────────────────────────────────────────────────────────────────
const uid   = () => "x" + Math.random().toString(36).slice(2, 9);
const cleS  = (s) => s === "1ère Session" ? "S1" : "S2";
const cle   = (ann, ses) => ann.replace(/\s|–/g,"") + "_" + cleS(ses);

/** Hash fiable et simple — ne dépend pas d'encodeURIComponent */
function hashPwd(password) {
  const str = password + "||cfpaze_salt_2025||";
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = (4294967296 * (2097151 & h2) + (h1 >>> 0));
  return "h" + Math.abs(n).toString(36).padStart(12, "0");
}

function calcMoy(notes, mods) {
  let t = 0, c = 0;
  (mods || []).forEach(m => {
    const n = notes?.[m.id];
    if (n !== undefined && n !== "") { t += parseFloat(n) * m.coefficient; c += m.coefficient; }
  });
  return c === 0 ? null : +(t / c).toFixed(2);
}

function getMention(moy) {
  if (moy === null) return { label:"—",          color:DS.textLight, bg:DS.surfaceAlt };
  const m = parseFloat(moy);
  if (m >= 18) return { label:"Excellent",     color:DS.navy,    bg:DS.primaryLight };
  if (m >= 16) return { label:"Très Bien",    color:DS.success,  bg:DS.successLight };
  if (m >= 14) return { label:"Bien",          color:DS.primary,  bg:DS.primaryLight };
  if (m >= 12) return { label:"Assez Bien",    color:DS.purple,   bg:DS.purpleLight  };
  if (m >= 10) return { label:"Passable",      color:DS.teal,     bg:DS.tealLight    };
  if (m >= 8) return { label:"Insuffisant",   color:DS.warning,  bg:DS.warningLight  };
  return              { label:"Médiocre",   color:DS.danger,   bg:DS.dangerLight  };
}

function useIsMobile() {
  const [v, setV] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setV(window.innerWidth < 768);
    window.addEventListener("resize", h); return () => window.removeEventListener("resize", h);
  }, []);
  return v;
}
function useOutsideClick(ref, cb) {
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) cb(); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [cb]);
}

/** Debounce — évite les sauvegardes Supabase à chaque frappe */
function useDebounce(value, delay) {
  const [dv, setDv] = useState(value);
  useEffect(() => { const t = setTimeout(() => setDv(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return dv;
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────
const sbSave = async (ann, ses, col, id, data) => {
  const pk = cle(ann, ses);
  if (col === "apprenants") {
    const { error } = await supabase.from("apprenants").upsert({ id, periode_key: pk, ...data }, { onConflict: "id" });
    if (error) throw error;
  } else if (col === "notes") {
    const { error } = await supabase.from("notes").upsert(
      { apprenant_id: id, periode_key: pk, data, updated_at: new Date().toISOString() },
      { onConflict: "apprenant_id,periode_key" }
    );
    if (error) throw error;
  } else if (col === "config") {
    const { error } = await supabase.from("config").upsert(
      { periode_key: pk, type: id, ...data },
      { onConflict: "periode_key,type" }
    );
    if (error) throw error;
  }
};
const sbDel = async (ann, ses, col, id) => {
  const pk = cle(ann, ses);
  if (col === "apprenants") {
    const { error } = await supabase.from("apprenants").delete().eq("id", id).eq("periode_key", pk);
    if (error) throw error;
  }
};
const sbUsr    = async (id, data) => { const { error } = await supabase.from("users").upsert({ id, ...data }, { onConflict: "id" }); if (error) throw error; };
const sbDelUsr = async (id)       => { const { error } = await supabase.from("users").delete().eq("id", id); if (error) throw error; };

// Aliases pour compatibilité avec le reste du code
const fbSave   = sbSave;
const fbDel    = sbDel;
const fbUsr    = sbUsr;
const fbDelUsr = sbDelUsr;

// ─── CSS Global ───────────────────────────────────────────────────────────────
const GCSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:16px}
body{margin:0;overflow-x:hidden;background:${DS.bg};font-family:'Inter',sans-serif;color:${DS.text};-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:${DS.bg}}
::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:10px}::-webkit-scrollbar-thumb:hover{background:#94a3b8}
input,select,textarea,button{font-family:inherit;outline:none}a{text-decoration:none;color:inherit}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}
.page-enter{animation:fadeUp 0.2s ease forwards}
.modal-enter{animation:scaleIn 0.18s ease forwards}
.slide-in{animation:slideIn 0.18s ease forwards}
.spin{animation:spin 0.8s linear infinite}
.card{background:${DS.surface};border-radius:${DS.radiusLg};border:1px solid ${DS.border};box-shadow:${DS.shadow};transition:box-shadow 0.2s}
.card-flat{background:${DS.surface};border-radius:${DS.radiusLg};border:1px solid ${DS.border}}
.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap}
.btn{display:inline-flex;align-items:center;gap:6px;border:none;border-radius:${DS.radiusSm};padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.15s;white-space:nowrap}
.btn:disabled{opacity:0.6;cursor:not-allowed}
.btn-primary{background:${DS.primary};color:white}.btn-primary:hover:not(:disabled){background:${DS.primaryHover}}
.btn-success{background:${DS.success};color:white}.btn-success:hover:not(:disabled){opacity:0.88}
.btn-danger{background:${DS.danger};color:white}.btn-danger:hover:not(:disabled){opacity:0.88}
.btn-ghost{background:transparent;color:${DS.textMid};border:1px solid ${DS.border}}.btn-ghost:hover{background:${DS.bg};color:${DS.text}}
.btn-sm{padding:5px 11px;font-size:12px}
.btn-icon{padding:7px;border-radius:${DS.radiusSm};background:transparent;border:1px solid ${DS.border};color:${DS.textMid};cursor:pointer}.btn-icon:hover{background:${DS.bg};color:${DS.text}}
.input-field{width:100%;border:1.5px solid ${DS.border};border-radius:${DS.radiusSm};padding:9px 13px;font-size:13.5px;color:${DS.text};background:${DS.surface};transition:border-color 0.15s,box-shadow 0.15s}
.input-field:focus{border-color:${DS.primary};box-shadow:0 0 0 3px rgba(37,99,235,0.1)}
.input-field::placeholder{color:${DS.textLight}}.input-field:disabled{background:${DS.bg};color:${DS.textMid}}
.table-row:hover{background:${DS.surfaceAlt}}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 14px;border-radius:9px;font-size:13px;font-weight:500;color:rgba(255,255,255,0.6);cursor:pointer;border:none;background:transparent;width:100%;transition:all 0.15s;text-align:left;margin-bottom:2px}
.nav-item:hover{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.9)}
.nav-item.active{background:rgba(59,130,246,0.22);color:white;font-weight:600}
.dropdown{position:absolute;background:white;border:1px solid ${DS.border};border-radius:${DS.radius};box-shadow:${DS.shadowLg};z-index:500;padding:6px}
.dropdown-item{display:flex;align-items:center;gap:9px;padding:8px 12px;border-radius:7px;font-size:13px;cursor:pointer;color:${DS.text};border:none;background:transparent;width:100%;text-align:left}
.dropdown-item:hover{background:${DS.bg}}.dropdown-item.danger{color:${DS.danger}}.dropdown-item.danger:hover{background:${DS.dangerLight}}
.divider{height:1px;background:${DS.border};margin:4px 0}
.progress-bar{height:6px;border-radius:10px;background:#e2e8f0;overflow:hidden}
.progress-fill{height:100%;border-radius:10px;transition:width 0.5s ease}
.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:${DS.sidebar};border-top:1px solid rgba(255,255,255,0.08);z-index:200}
@media(max-width:767px){
  .hide-mobile{display:none!important}.sidebar-desktop{display:none!important}
  .bottom-nav{display:flex!important}.main-pad{padding:14px 12px 80px!important}
  .grid-2{grid-template-columns:1fr!important}.grid-3{grid-template-columns:1fr 1fr!important}
}
@media(min-width:768px){.sidebar-desktop{display:flex!important}.bottom-nav{display:none!important}}
@media print{
  .no-print{display:none!important}
  body{background:white!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  .bcard{page-break-inside:avoid}
}
`;

// ═══════════════════════════════════════════════════════════════════════════════
// ── UI Components ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const Icon = {
  Dashboard:   ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Users:       ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Edit:        ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash:       ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  Plus:        ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  Search:      ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  Print:       ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  ChevronDown: ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>,
  ChevronRight:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>,
  Settings:    ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A9 9 0 1 1 4.93 19.07"/></svg>,
  Lock:        ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  LogOut:      ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Shield:      ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Tool:        ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  Book:        ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  FileText:    ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  TrendingUp:  ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  Award:       ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>,
  Eye:         ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff:      ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  User:        ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Check:       ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X:           ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Menu:        ()=><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  RefreshCw:   ()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  Save:        ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  BarChart:    ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  PieChart:    ()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>,
  Info:        ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  GraduationCap:()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  Import:      ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>,
};

function Spinner({size=20,color=DS.primary}) {
  return <div className="spin" style={{width:size,height:size,border:`2px solid ${color}22`,borderTop:`2px solid ${color}`,borderRadius:"50%",flexShrink:0}}/>;
}
function Avatar({nom,prenom,size=34,color}) {
  const initials = `${(prenom||nom||"?")[0]}${(nom||"")[0]||""}`.toUpperCase();
  const clrs = ["#2563eb","#7c3aed","#059669","#d97706","#0891b2","#db2777"];
  const c = color || clrs[(initials.charCodeAt(0)||0)%clrs.length];
  return <div style={{width:size,height:size,borderRadius:"50%",background:`linear-gradient(135deg,${c},${c}bb)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:Math.floor(size*0.35),fontWeight:700,color:"white",flexShrink:0}}>{initials}</div>;
}
function Badge({children,color=DS.primary,bg,style={}}) {
  return <span className="badge" style={{color,background:bg||color+"18",...style}}>{children}</span>;
}
function Modal({open,onClose,title,children,width=520}) {
  if(!open) return null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.55)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(3px)"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal-enter card-flat" style={{width:"100%",maxWidth:width,maxHeight:"92vh",overflowY:"auto",boxShadow:DS.shadowLg}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 24px",borderBottom:`1px solid ${DS.border}`}}>
          <h3 style={{fontSize:17,fontWeight:700,color:DS.text}}>{title}</h3>
          <button onClick={onClose} className="btn-icon"><Icon.X/></button>
        </div>
        <div style={{padding:"22px 24px"}}>{children}</div>
      </div>
    </div>
  );
}
function ConfirmModal({open,onClose,onConfirm,title,message,danger=true}) {
  if(!open) return null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.55)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(3px)"}}>
      <div className="modal-enter card-flat" style={{width:"100%",maxWidth:380,boxShadow:DS.shadowLg}}>
        <div style={{padding:"26px 24px 20px",textAlign:"center"}}>
          <div style={{width:52,height:52,borderRadius:"50%",background:danger?DS.dangerLight:DS.warningLight,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",fontSize:22}}>{danger?"⚠️":"❓"}</div>
          <h3 style={{fontSize:16,fontWeight:700,color:DS.text,marginBottom:8}}>{title}</h3>
          <p style={{fontSize:13,color:DS.textMid,lineHeight:1.6}}>{message}</p>
        </div>
        <div style={{display:"flex",gap:10,padding:"0 24px 22px",justifyContent:"center"}}>
          <button onClick={onClose} className="btn btn-ghost">Annuler</button>
          <button onClick={onConfirm} className={`btn ${danger?"btn-danger":"btn-primary"}`}>Confirmer</button>
        </div>
      </div>
    </div>
  );
}
function FormField({label,required,error,hint,children}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      {label&&<label style={{fontSize:12,fontWeight:600,color:DS.textMid}}>{label}{required&&<span style={{color:DS.danger,marginLeft:2}}>*</span>}</label>}
      {children}
      {error&&<span style={{fontSize:11,color:DS.danger,display:"flex",alignItems:"center",gap:4}}><Icon.Info/>{error}</span>}
      {hint&&!error&&<span style={{fontSize:11,color:DS.textLight}}>{hint}</span>}
    </div>
  );
}
function PasswordInput({value,onChange,placeholder,name}) {
  const[show,setShow]=useState(false);
  return (
    <div style={{position:"relative"}}>
      <input type={show?"text":"password"} value={value} onChange={onChange}
        placeholder={placeholder||"••••••••"} name={name} autoComplete={name||"current-password"}
        className="input-field" style={{paddingRight:38}}/>
      <button type="button" onClick={()=>setShow(!show)}
        style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:DS.textLight,cursor:"pointer"}}>
        {show?<Icon.EyeOff/>:<Icon.Eye/>}
      </button>
    </div>
  );
}
function ToastContainer({toasts}) {
  return (
    <div style={{position:"fixed",bottom:80,right:18,zIndex:999,display:"flex",flexDirection:"column",gap:8,maxWidth:320}}>
      {toasts.map(t=>(
        <div key={t.id} className="slide-in" style={{display:"flex",alignItems:"center",gap:10,padding:"11px 15px",borderRadius:10,background:"white",boxShadow:DS.shadowLg,border:`1px solid ${DS.border}`,borderLeft:`4px solid ${t.type==="success"?DS.success:t.type==="error"?DS.danger:DS.warning}`}}>
          <span>{t.type==="success"?"✅":t.type==="error"?"❌":"⚠️"}</span>
          <span style={{fontSize:13,color:DS.text,fontWeight:500}}>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
function EmptyState({icon,title,description,action}) {
  return (
    <div style={{textAlign:"center",padding:"48px 24px",color:DS.textMid}}>
      <div style={{fontSize:38,marginBottom:10,opacity:0.5}}>{icon||"📭"}</div>
      <div style={{fontSize:15,fontWeight:600,color:DS.textMid,marginBottom:5}}>{title}</div>
      {description&&<div style={{fontSize:13,color:DS.textLight,marginBottom:action?14:0,lineHeight:1.5}}>{description}</div>}
      {action}
    </div>
  );
}
function PageHeader({title,subtitle,actions}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,gap:14,flexWrap:"wrap"}}>
      <div>
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:DS.text,marginBottom:3}}>{title}</h1>
        {subtitle&&<p style={{fontSize:13,color:DS.textMid}}>{subtitle}</p>}
      </div>
      {actions&&<div style={{display:"flex",gap:9,flexWrap:"wrap",flexShrink:0}}>{actions}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── LOGIN ────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function LoginPage({onLogin}) {
  const[username,setUsername] = useState("");
  const[password,setPassword] = useState("");
  const[error,setError]       = useState("");
  const[submitting,setSubmitting] = useState(false);
  const[users,setUsers]       = useState([]);
  const[usersReady,setUsersReady] = useState(false); // clé du bug : attendre Supabase

  useEffect(() => {
    // Charger les utilisateurs depuis Supabase
    supabase.from("users").select("*").then(({ data, error }) => {
      if (!error && data) {
        setUsers(data);
        // Créer admin par défaut si la plateforme est vierge
        if (data.length === 0) {
          sbUsr("admin_root", {
            username: "admin", password: hashPwd("Admin@2025"),
            role: "admin", nom: "Administrateur", prenom: "Principal",
            created_at: new Date().toISOString()
          }).catch(() => {});
        }
      }
      setUsersReady(true);
    });
  }, []);

  function handleLogin(e) {
    e.preventDefault();
    if(!usersReady) return; // ne pas tenter si Firebase n'a pas encore répondu
    if(!username.trim()||!password) return setError("Veuillez renseigner tous les champs.");
    setSubmitting(true); setError("");
    // Synchrone — pas besoin de setTimeout ni d'async
    const found = users.find(u =>
      u.username === username.trim() && u.password === hashPwd(password)
    );
    if(found) {
      onLogin(found);
    } else {
      setError("Identifiant ou mot de passe incorrect.");
    }
    setSubmitting(false);
  }

  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(135deg,${DS.navy} 0%,#1e40af 55%,#0891b2 100%)`,display:"flex",alignItems:"center",justifyContent:"center",padding:16,position:"relative",overflow:"hidden"}}>
      <style>{GCSS}</style>
      <div style={{position:"absolute",top:-120,right:-120,width:400,height:400,borderRadius:"50%",background:"rgba(255,255,255,0.04)"}}/>
      <div style={{position:"absolute",bottom:-80,left:-80,width:280,height:280,borderRadius:"50%",background:"rgba(255,255,255,0.04)"}}/>
      <div style={{width:"100%",maxWidth:420,position:"relative",zIndex:1}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:68,height:68,borderRadius:18,background:"rgba(255,255,255,0.15)",backdropFilter:"blur(10px)",border:"1px solid rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 16px"}}>🎓</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:"white",marginBottom:6}}>{NOM_COURT}</h1>
          <p style={{fontSize:13,color:"rgba(255,255,255,0.6)"}}>Plateforme de gestion des apprenants</p>
        </div>
        <div style={{background:"white",borderRadius:20,padding:"32px 32px 28px",boxShadow:"0 25px 60px rgba(0,0,0,0.25)"}}>
          <h2 style={{fontSize:17,fontWeight:700,color:DS.text,marginBottom:22}}>Connexion à votre espace</h2>
          <form onSubmit={handleLogin} autoComplete="on">
            <div style={{display:"flex",flexDirection:"column",gap:15,marginBottom:20}}>
              <FormField label="Identifiant">
                <input value={username} onChange={e=>{setUsername(e.target.value);setError("");}}
                  placeholder="Entrez votre identifiant" className="input-field"
                  autoFocus autoComplete="username" name="username"/>
              </FormField>
              <FormField label="Mot de passe">
                <PasswordInput value={password} onChange={e=>{setPassword(e.target.value);setError("");}}
                  placeholder="Entrez votre mot de passe" name="current-password"/>
              </FormField>
            </div>
            {error&&(
              <div style={{display:"flex",alignItems:"center",gap:8,background:DS.dangerLight,border:`1px solid ${DS.danger}33`,borderRadius:8,padding:"10px 13px",marginBottom:14}}>
                <Icon.Info/><span style={{fontSize:13,color:DS.danger}}>{error}</span>
              </div>
            )}
            <button type="submit"
              disabled={submitting||!usersReady}
              className="btn btn-primary"
              style={{width:"100%",justifyContent:"center",padding:"11px",fontSize:14,borderRadius:10}}>
              {!usersReady
                ? <><Spinner size={16} color="white"/>Initialisation…</>
                : submitting
                  ? <><Spinner size={16} color="white"/>Connexion…</>
                  : "Se connecter"}
            </button>
          </form>
          {!usersReady&&(
            <div style={{marginTop:14,padding:"10px 13px",background:"#f0f9ff",borderRadius:8,border:"1px solid #bae6fd",display:"flex",gap:8,alignItems:"center"}}>
              <Spinner size={14} color={DS.teal}/>
              <span style={{fontSize:12,color:DS.teal}}>Connexion à Supabase en cours…</span>
            </div>
          )}
          <div style={{marginTop:16,padding:"10px 13px",background:DS.surfaceAlt,borderRadius:9,border:`1px solid ${DS.border}`}}>
            
          </div>
        </div>
        <p style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:18}}>© {new Date().getFullYear()} {NOM_COURT} · Tous droits réservés</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── APP PRINCIPAL ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const[user,setUser]         = useState(()=>{try{const s=sessionStorage.getItem("cfpaze_user");return s?JSON.parse(s):null;}catch{return null;}});
  const isMobile              = useIsMobile();
  const[page,setPage]         = useState("dashboard");
  const[toasts,setToasts]     = useState([]);
  const[loading,setLoading]   = useState(true);
  const[sidebarOpen,setSidebarOpen] = useState(false);
  const[annee,setAnnee]       = useState(()=>localStorage.getItem("cfpaze_annee")||"2025–2026");
  const[session,setSession]   = useState(()=>localStorage.getItem("cfpaze_session")||"1ère Session");
  const[apprenants,setApprenants] = useState([]);
  const[metiers,setMetiers]   = useState(METIERS_DEF);
  const[modules,setModules]   = useState(MODULES_DEF);
  const[notes,setNotes]       = useState({});
  const[moyennesGenerales,setMoyennesGenerales] = useState({});
  const[notesS1,setNotesS1]   = useState(null);
  const[apprenantsS1,setApprenantsS1] = useState(null);
  const[allUsers,setAllUsers] = useState([]);
  const[showProfile,setShowProfile] = useState(false);
  const[userMenuOpen,setUserMenuOpen] = useState(false);
  const userMenuRef           = useRef(null);
  const isAdmin               = user?.role==="admin";

  useOutsideClick(userMenuRef,()=>setUserMenuOpen(false));

  // Clé Supabase = combinaison Année + Session
  const periodeKey = useMemo(()=>cle(annee,session),[annee,session]);

  useEffect(()=>{
    if(!user) return;
    localStorage.setItem("cfpaze_annee",annee);
    localStorage.setItem("cfpaze_session",session);
    setLoading(true);
    const channels=[];

    // ── Chargement initial ──────────────────────────────────────────
    (async()=>{
      try {
        const [{data:appData},{data:notesData},{data:metiersRow},{data:modulesRow},{data:usersData}] = await Promise.all([
          supabase.from("apprenants").select("*").eq("periode_key",periodeKey).order("nom"),
          supabase.from("notes").select("*").eq("periode_key",periodeKey),
          supabase.from("config").select("items").eq("periode_key",periodeKey).eq("type","metiers").maybeSingle(),
          supabase.from("config").select("items").eq("periode_key",periodeKey).eq("type","modules").maybeSingle(),
          supabase.from("users").select("*"),
        ]);
        setApprenants(appData||[]);
        const nm={};(notesData||[]).forEach(n=>{nm[n.apprenant_id]=n.data||{};});
        setNotes(nm);
        if(metiersRow?.items) setMetiers(metiersRow.items); else setMetiers(METIERS_DEF);
        if(modulesRow?.items) setModules(modulesRow.items); else setModules(MODULES_DEF);
        setAllUsers(usersData||[]);
      } catch(e){console.error(e);}
      finally{setLoading(false);}
    })();

    // ── Temps réel : apprenants ─────────────────────────────────────
    channels.push(
      supabase.channel("ch-app-"+periodeKey)
        .on("postgres_changes",{event:"*",schema:"public",table:"apprenants",filter:"periode_key=eq."+periodeKey},
          ({eventType,new:nw,old:ol})=>{
            if(eventType==="DELETE") setApprenants(p=>p.filter(a=>a.id!==ol.id));
            else if(eventType==="INSERT") setApprenants(p=>[...p,nw].sort((a,b)=>(a.nom||"").localeCompare(b.nom||"")));
            else setApprenants(p=>p.map(a=>a.id===nw.id?nw:a));
          })
        .subscribe()
    );

    // ── Temps réel : notes ──────────────────────────────────────────
    channels.push(
      supabase.channel("ch-notes-"+periodeKey)
        .on("postgres_changes",{event:"*",schema:"public",table:"notes",filter:"periode_key=eq."+periodeKey},
          ({eventType,new:nw,old:ol})=>{
            if(eventType==="DELETE") setNotes(p=>{const n={...p};delete n[ol.apprenant_id];return n;});
            else setNotes(p=>({...p,[nw.apprenant_id]:nw.data||{}}));
          })
        .subscribe()
    );

    return ()=>{ channels.forEach(c=>supabase.removeChannel(c)); };
  },[periodeKey,user]);

  // ── Charger données S1 et calculer moyennes générales ─────────────────────
  useEffect(()=>{
    if(!user || session !== "2ème Session") {
      setNotesS1(null);
      setApprenantsS1(null);
      setMoyennesGenerales({});
      return;
    }

    (async()=>{
      try {
        const pkS1 = cle(annee, "1ère Session");
        const [{data:appS1Data},{data:notesS1Data}] = await Promise.all([
          supabase.from("apprenants").select("*").eq("periode_key",pkS1).order("nom"),
          supabase.from("notes").select("*").eq("periode_key",pkS1),
        ]);
        
        setApprenantsS1(appS1Data||[]);
        const notesS1Map={};
        (notesS1Data||[]).forEach(n=>{notesS1Map[n.apprenant_id]=n.data||{};});
        setNotesS1(notesS1Map);

        // Calculer les moyennes générales pour chaque apprenant en S2
        const moys={};
        apprenants.forEach(a=>{
          const modsFor = modules.filter(m=>m.metierId===a.metierId||!m.metierId);
          let m1 = null;
          let m2 = null;

          // Notes S1 : chercher par ID
          if(notesS1Map[a.id]) {
            m1 = calcMoy(notesS1Map[a.id], modsFor);
          }

          // Notes S2 : données locales
          if(notes[a.id]) {
            m2 = calcMoy(notes[a.id], modsFor);
          }

          // Calcul : (2×S2 + S1) / 3
          if(m1===null && m2===null) {
            moys[a.id] = null;
          } else if(m2===null) {
            moys[a.id] = parseFloat(m1);
          } else if(m1===null) {
            moys[a.id] = parseFloat(m2);
          } else {
            moys[a.id] = +((2*parseFloat(m2)+parseFloat(m1))/3).toFixed(2);
          }
        });
        setMoyennesGenerales(moys);
      } catch(e){
        console.error("Erreur chargement moyennes générales:", e);
      }
    })();
  },[user, session, annee, apprenants, notes, modules]);

  function showToast(msg,type="success") {
    const id=uid();
    setToasts(t=>[...t,{id,msg,type}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3500);
  }
  function login(u){sessionStorage.setItem("cfpaze_user",JSON.stringify(u));setUser(u);setPage(u.role==="admin"?"dashboard":"notes");}
  function logout(){sessionStorage.removeItem("cfpaze_user");setUser(null);}
  function refreshUser(updated){const u={...user,...updated};sessionStorage.setItem("cfpaze_user",JSON.stringify(u));setUser(u);}

  // Sauvegardes optimistes : état local immédiat, Supabase en arrière-plan
  const saveMetiers=(items)=>{
    setMetiers(items);
    sbSave(annee,session,"config","metiers",{items}).catch(()=>showToast("Erreur sync","error"));
  };
  const saveModules=(items)=>{
    setModules(items);
    sbSave(annee,session,"config","modules",{items}).catch(()=>showToast("Erreur sync","error"));
  };

  // Import apprenants depuis une autre période
  async function copierApprenants(srcAnn,srcSes,options={apprenants:true,metiers:true,modules:true}) {
    const srcKey=cle(srcAnn,srcSes);
    const rapport=[];
    try {
      // 1. Apprenants
      if(options.apprenants){
        const {data,error}=await supabase.from("apprenants").select("*").eq("periode_key",srcKey);
        if(error) throw new Error("Apprenants : "+error.message);
        if(data&&data.length>0){
          // Charger les notes de la période source
          const {data:notesData}=await supabase.from("notes").select("*").eq("periode_key",srcKey);
          const notesMap={};
          if(notesData){
            notesData.forEach(n=>{
              if(!notesMap[n.apprenant_id]) notesMap[n.apprenant_id]={};
              notesMap[n.apprenant_id][n.module_id]=n.note;
            });
          }
          
          // ⭐ Charger les MODULES de la période source pour calculer correctement
          const {data:srcModulesRow}=await supabase.from("config").select("items").eq("periode_key",srcKey).eq("type","modules").maybeSingle();
          const srcModules = srcModulesRow?.items || modules;
          
          // Vérifier si on change d'année
          const changeAnnee=srcAnn!==annee;
          
          console.log(`📥 Import apprenants: ${data.length} depuis ${srcKey} vers ${periodeKey}, changeAnnee=${changeAnnee}`);
          
          // Préparer les apprenants à importer avec NOUVEAUX IDs
          const rows=data.map(({id:_,periode_key:__,...rest})=>{
            let newNiveau=rest.niveau;
            
            // SEULEMENT si on change d'année ET moyenne >= 12, passer au niveau supérieur
            if(changeAnnee){
              const appNotes=notesMap[_]||{};
              const moy=calcMoy(appNotes,srcModules); // ⭐ Utiliser srcModules, pas modules cible
              
              if(moy!==null&&moy>=12){
                if(rest.niveau==="Niveau 1") newNiveau="Niveau 2";
                else if(rest.niveau==="Niveau 2") newNiveau="Niveau 3";
                console.log(`⬆️ ${rest.prenom} ${rest.nom}: ${rest.niveau} → ${newNiveau} (moyenne=${moy})`);
              }
            }
            
            // 🔴 GÉNERER UN NOUVEL ID POUR ÉVITER LES CONFLITS
            return {...rest,niveau:newNiveau,id:uid(),periode_key:periodeKey};
          });
          
          // Utiliser INSERT simple (pas d'upsert qui cause des problèmes)
          const {error:e2}=await supabase.from("apprenants").insert(rows);
          if(e2) throw new Error("Import apprenants : "+e2.message);
          console.log(`✅ ${data.length} apprenant(s) importé(s) avec succès`);
          rapport.push(data.length+" apprenant(s)");
        } else {
          showToast("Aucun apprenant dans la période source","warning");
        }
      }
      // 2. Métiers
      if(options.metiers){
        const {data:metiersRow}=await supabase.from("config").select("items").eq("periode_key",srcKey).eq("type","metiers").maybeSingle();
        if(metiersRow?.items){
          // Récupérer les métiers existants de la période cible
          const {data:existingRow}=await supabase.from("config").select("items").eq("periode_key",periodeKey).eq("type","metiers").maybeSingle();
          const existingMetiers=existingRow?.items||[];
          // Fusionner les listes (ajouter les nouveaux, éviter les doublons par ID)
          const mergedMetiers=[...existingMetiers,...metiersRow.items.filter(m=>!existingMetiers.find(e=>e.id===m.id))];
          const {error:e3}=await supabase.from("config").upsert({periode_key:periodeKey,type:"metiers",items:mergedMetiers},{onConflict:"periode_key,type"});
          if(e3) throw new Error("Import métiers : "+e3.message);
          setMetiers(mergedMetiers);
          rapport.push(metiersRow.items.length+" métier(s)");
        }
      }
      // 3. Modules
      if(options.modules){
        const {data:modulesRow}=await supabase.from("config").select("items").eq("periode_key",srcKey).eq("type","modules").maybeSingle();
        if(modulesRow?.items){
          // Récupérer les modules existants de la période cible
          const {data:existingRow}=await supabase.from("config").select("items").eq("periode_key",periodeKey).eq("type","modules").maybeSingle();
          const existingModules=existingRow?.items||[];
          // Fusionner les listes (ajouter les nouveaux, éviter les doublons par ID)
          const mergedModules=[...existingModules,...modulesRow.items.filter(m=>!existingModules.find(e=>e.id===m.id))];
          const {error:e4}=await supabase.from("config").upsert({periode_key:periodeKey,type:"modules",items:mergedModules},{onConflict:"periode_key,type"});
          if(e4) throw new Error("Import modules : "+e4.message);
          setModules(mergedModules);
          rapport.push(modulesRow.items.length+" module(s)");
        }
      }
      if(rapport.length>0) showToast("Importé : "+rapport.join(", ")+" ✓");
      else showToast("Rien à importer dans la période source","warning");
    } catch(err){showToast("Erreur : "+err.message,"error");}
  }

  const navItems=isAdmin?[
    {id:"dashboard", label:"Tableau de bord", icon:<Icon.Dashboard/>},
    {id:"apprenants",label:"Apprenants",       icon:<Icon.Users/>},
    {id:"notes",     label:"Notes",            icon:<Icon.Edit/>},
    {id:"bulletins", label:"Bulletins",        icon:<Icon.FileText/>},
    {id:"metiers",   label:"Métiers",          icon:<Icon.Tool/>},
    {id:"modules",   label:"Modules",          icon:<Icon.Book/>},
    {id:"utilisateurs",label:"Utilisateurs",  icon:<Icon.Shield/>},
    {id:"statistiques", label:"Statistiques",   icon:<Icon.PieChart/>},
  ]:[{id:"notes",label:"Saisie des notes",icon:<Icon.Edit/>}];

  const moyGen=useMemo(()=>{
    if(!apprenants.length) return "—";
    const s=apprenants.reduce((acc,a)=>{
      const m=modules.filter(x=>x.metierId===a.metierId||!x.metierId);
      return acc+parseFloat(calcMoy(notes[a.id],m)||0);
    },0);
    return (s/apprenants.length).toFixed(2);
  },[apprenants,notes,modules]);

  const admis=useMemo(()=>apprenants.filter(a=>{
    const m=modules.filter(x=>x.metierId===a.metierId||!x.metierId);
    return parseFloat(calcMoy(notes[a.id],m))>=12;
  }).length,[apprenants,notes,modules]);

  const avecNotes=useMemo(()=>apprenants.filter(a=>notes[a.id]&&Object.keys(notes[a.id]).length>0).length,[apprenants,notes]);

  if(!user) return <><style>{GCSS}</style><LoginPage onLogin={login}/></>;

  return (
    <div style={{fontFamily:"'Inter',sans-serif",background:DS.bg,minHeight:"100vh",color:DS.text,display:"flex",flexDirection:"column"}}>
      <style>{GCSS}</style>

      {/* ── TOPBAR ── */}
      <header className="no-print" style={{background:DS.sidebar,height:58,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:200,boxShadow:"0 1px 0 rgba(255,255,255,0.06)",padding:"0 18px",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {isMobile&&<button className="btn-icon" style={{background:"rgba(255,255,255,0.1)",borderColor:"transparent",color:"white"}} onClick={()=>setSidebarOpen(!sidebarOpen)}><Icon.Menu/></button>}
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:8,background:"rgba(59,130,246,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🎓</div>
            <div className="hide-mobile">
              <div style={{fontSize:14,fontWeight:700,color:"white"}}>{NOM_COURT}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.45)"}}>Plateforme éducative</div>
            </div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {loading&&<Spinner size={16} color="rgba(255,255,255,0.6)"/>}
          {isAdmin&&(
            <div className="hide-mobile" style={{display:"flex",alignItems:"center",gap:8}}>
              <select value={annee} onChange={e=>setAnnee(e.target.value)} style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:7,padding:"5px 9px",color:"white",fontSize:12,cursor:"pointer"}}>
                {ANNEES.map(a=><option key={a} value={a} style={{color:DS.text,background:"white"}}>{a}</option>)}
              </select>
              <select value={session} onChange={e=>setSession(e.target.value)} style={{background:session==="2ème Session"?"rgba(124,58,237,0.4)":"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:7,padding:"5px 9px",color:"white",fontSize:12,cursor:"pointer",fontWeight:600}}>
                {SESSIONS.map(s=><option key={s} value={s} style={{color:DS.text,background:"white"}}>{s}</option>)}
              </select>
            </div>
          )}
          {/* User menu */}
          <div ref={userMenuRef} style={{position:"relative"}}>
            <button onClick={()=>setUserMenuOpen(!userMenuOpen)} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:9,padding:"5px 10px",cursor:"pointer"}}>
              <Avatar nom={user.nom} prenom={user.prenom||user.nom} size={26} color={isAdmin?"#2563eb":"#059669"}/>
              <div className="hide-mobile" style={{textAlign:"left"}}>
                <div style={{fontSize:12,fontWeight:600,color:"white",lineHeight:1.2}}>{user.nom||user.username}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>{isAdmin?"Administrateur":"Formateur"}</div>
              </div>
              <span style={{color:"rgba(255,255,255,0.5)"}}><Icon.ChevronDown/></span>
            </button>
            {userMenuOpen&&(
              <div className="dropdown slide-in" style={{right:0,top:"calc(100% + 8px)",minWidth:210}}>
                <div style={{padding:"10px 14px 8px",borderBottom:`1px solid ${DS.border}`}}>
                  <div style={{fontSize:13,fontWeight:600,color:DS.text}}>{user.nom||user.username}</div>
                  <div style={{fontSize:11,color:DS.textLight}}>@{user.username} · {isAdmin?"Administrateur":"Formateur"}</div>
                </div>
                <button className="dropdown-item" onClick={()=>{setShowProfile(true);setUserMenuOpen(false);}}>
                  <Icon.Settings/>Paramètres du profil
                </button>
                <div className="divider"/>
                <button className="dropdown-item danger" onClick={logout}>
                  <Icon.LogOut/>Se déconnecter
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={{display:"flex",flex:1,minHeight:0}}>
        {/* ── SIDEBAR ── */}
        {(sidebarOpen||!isMobile)&&(
          <>
            {isMobile&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:150}} onClick={()=>setSidebarOpen(false)}/>}
            <aside className="sidebar-desktop no-print" style={{width:215,background:DS.sidebar,padding:"14px 10px",position:isMobile?"fixed":"sticky",top:58,height:"calc(100vh - 58px)",overflowY:"auto",flexShrink:0,flexDirection:"column",zIndex:isMobile?160:10,boxShadow:isMobile?"4px 0 20px rgba(0,0,0,0.3)":"none"}}>
              <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.3)",letterSpacing:"1px",textTransform:"uppercase",padding:"4px 14px 8px"}}>Navigation</div>
              <nav>
                {navItems.map(item=>(
                  <button key={item.id} className={`nav-item ${page===item.id?"active":""}`} onClick={()=>{setPage(item.id);setSidebarOpen(false);}}>
                    <span style={{flexShrink:0}}>{item.icon}</span>{item.label}
                  </button>
                ))}
              </nav>
              <div style={{marginTop:"auto",padding:"14px 4px 0",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
                {isAdmin&&isMobile&&(
                  <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
                    <select value={annee} onChange={e=>setAnnee(e.target.value)} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,padding:"6px 9px",color:"white",fontSize:11}}>
                      {ANNEES.map(a=><option key={a} value={a} style={{color:DS.text,background:"white"}}>{a}</option>)}
                    </select>
                    <select value={session} onChange={e=>setSession(e.target.value)} style={{background:session==="2ème Session"?"rgba(124,58,237,0.3)":"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:7,padding:"6px 9px",color:"white",fontSize:11,fontWeight:600}}>
                      {SESSIONS.map(s=><option key={s} value={s} style={{color:DS.text,background:"white"}}>{s}</option>)}
                    </select>
                  </div>
                )}
                {/* Indicateur de période active */}
                <div style={{padding:"10px 12px",background:"rgba(59,130,246,0.15)",borderRadius:9,border:"1px solid rgba(59,130,246,0.25)"}}>
                  <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:3}}>Espace actif</div>
                  <div style={{fontSize:12,color:"white",fontWeight:700}}>{annee}</div>
                  <div style={{fontSize:11,color:session==="2ème Session"?"#c4b5fd":"#93c5fd",fontWeight:600,marginTop:1}}>{session}</div>
                  <code style={{fontSize:9,color:"rgba(255,255,255,0.3)",marginTop:4,display:"block"}}>{periodeKey}</code>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 4px 0"}}>
                  <Avatar nom={user.nom} prenom={user.prenom||user.nom} size={28} color={isAdmin?"#2563eb":"#059669"}/>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:"white",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.nom||user.username}</div>
                    <div style={{fontSize:10,color:isAdmin?"#93c5fd":"#6ee7b7"}}>{isAdmin?"👑 Admin":"🔧 Formateur"}</div>
                  </div>
                </div>
              </div>
            </aside>
          </>
        )}

        {/* ── MAIN ── */}
        <main className="main-pad page-enter" style={{flex:1,padding:"24px 24px",overflowY:"auto",minWidth:0}} key={page}>
          {loading&&!apprenants.length&&page!=="notes"?(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:320,gap:14}}>
              <Spinner size={36}/><p style={{color:DS.textMid,fontSize:14}}>Chargement des données…</p>
            </div>
          ):<>
            {page==="dashboard"   &&isAdmin&&<Dashboard apprenants={apprenants} notes={notes} modules={modules} metiers={metiers} admis={admis} avecNotes={avecNotes} setPage={setPage} annee={annee} session={session} copierApprenants={copierApprenants}/>}
            {page==="apprenants"  &&isAdmin&&<Apprenants apprenants={apprenants} setApprenants={setApprenants} annee={annee} session={session} notes={notes} modules={modules} metiers={metiers} showToast={showToast} isMobile={isMobile}/>}
            {page==="notes"       &&<Notes apprenants={apprenants} notes={notes} annee={annee} session={session} modules={modules} metiers={metiers} showToast={showToast} user={user} isAdmin={isAdmin}/>}
            {page==="bulletins"   &&isAdmin&&<Bulletins apprenants={apprenants} notes={notes} modules={modules} metiers={metiers} annee={annee} session={session}/>}
            {page==="metiers"     &&isAdmin&&<MetiersPage metiers={metiers} saveMetiers={saveMetiers} showToast={showToast}/>}
            {page==="modules"     &&isAdmin&&<ModulesPage modules={modules} metiers={metiers} saveModules={saveModules} showToast={showToast}/>}
            {page==="utilisateurs"&&isAdmin&&<UtilisateursPage allUsers={allUsers} setAllUsers={setAllUsers} metiers={metiers} niveaux={NIVEAUX} showToast={showToast} currentUser={user}/>}
            {page==="statistiques"&&isAdmin&&<StatistiquesPage apprenants={apprenants} notes={notes} modules={modules} metiers={metiers} annee={annee} session={session}/>}
          </>}
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="bottom-nav no-print">
        {navItems.slice(0,5).map(item=>(
          <button key={item.id} onClick={()=>setPage(item.id)} style={{flex:1,background:"none",border:"none",borderTop:page===item.id?"2px solid #3b82f6":"2px solid transparent",color:page===item.id?"#93c5fd":"rgba(255,255,255,0.4)",padding:"8px 2px 6px",display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer"}}>
            {item.icon}<span style={{fontSize:9,fontWeight:600,whiteSpace:"nowrap"}}>{item.label}</span>
          </button>
        ))}
      </nav>

      {showProfile&&<ProfileModal user={user} allUsers={allUsers} onClose={()=>setShowProfile(false)} showToast={showToast} refreshUser={refreshUser}/>}
      <ToastContainer toasts={toasts}/>
    </div>
  );
}

// ─── Profile Modal ────────────────────────────────────────────────────────────
function ProfileModal({user,allUsers,onClose,showToast,refreshUser}) {
  const[tab,setTab]=useState("info");
  const[nom,setNom]=useState(user.nom||"");
  const[prenom,setPrenom]=useState(user.prenom||"");
  const[username,setUsername]=useState(user.username||"");
  const[curPw,setCurPw]=useState("");
  const[newPw,setNewPw]=useState("");
  const[confPw,setConfPw]=useState("");
  const[saving,setSaving]=useState(false);
  const[errors,setErrors]=useState({});

  async function saveInfo() {
    const e={};
    if(!nom.trim()) e.nom="Requis";
    if(!username.trim()) e.username="Requis";
    if(allUsers.find(u=>u.username===username.trim()&&u.id!==user.id)) e.username="Identifiant déjà utilisé";
    if(Object.keys(e).length) return setErrors(e);
    setSaving(true);
    refreshUser({nom:nom.trim(),prenom:prenom.trim(),username:username.trim()});
    showToast("Profil mis à jour !");
    fbUsr(user.id,{nom:nom.trim(),prenom:prenom.trim(),username:username.trim()}).catch(()=>{});
    setSaving(false); setErrors({});
  }
  async function savePw() {
    const e={};
    if(!curPw) e.curPw="Requis";
    else if(user.password!==hashPwd(curPw)) e.curPw="Mot de passe actuel incorrect";
    if(!newPw||newPw.length<6) e.newPw="6 caractères minimum";
    if(newPw!==confPw) e.confPw="Ne correspond pas";
    if(Object.keys(e).length) return setErrors(e);
    setSaving(true);
    const hashed=hashPwd(newPw);
    refreshUser({password:hashed});
    showToast("Mot de passe modifié !");
    fbUsr(user.id,{password:hashed}).catch(()=>{});
    setCurPw("");setNewPw("");setConfPw("");
    setSaving(false); setErrors({});
  }

  const pwStr=(pw)=>{let s=0;if(pw.length>=8)s++;if(/[A-Z]/.test(pw))s++;if(/[0-9]/.test(pw))s++;if(/[^a-zA-Z0-9]/.test(pw))s++;return s;};
  const st=pwStr(newPw);
  const stClr=[DS.textLight,DS.danger,DS.warning,DS.success,DS.success][st];

  return (
    <Modal open onClose={onClose} title="Paramètres du profil" width={480}>
      <div style={{display:"flex",gap:6,marginBottom:20,borderBottom:`1px solid ${DS.border}`,paddingBottom:0}}>
        {[["info","Informations"],["security","Sécurité"]].map(([k,l])=>(
          <button key={k} onClick={()=>{setTab(k);setErrors({});}} style={{padding:"8px 14px",background:"none",border:"none",borderBottom:`2px solid ${tab===k?DS.primary:"transparent"}`,color:tab===k?DS.primary:DS.textMid,fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:-1}}>
            {k==="info"?<><Icon.User/> {l}</>:<><Icon.Lock/> {l}</>}
          </button>
        ))}
      </div>
      {tab==="info"&&(
        <div style={{display:"flex",flexDirection:"column",gap:13}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:6}}><Avatar nom={nom} prenom={prenom||nom} size={60}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <FormField label="Prénom" error={errors.prenom}><input value={prenom} onChange={e=>setPrenom(e.target.value)} className="input-field"/></FormField>
            <FormField label="Nom *" error={errors.nom}><input value={nom} onChange={e=>setNom(e.target.value)} className="input-field"/></FormField>
          </div>
          <FormField label="Identifiant *" error={errors.username} hint="Utilisé pour se connecter">
            <input value={username} onChange={e=>setUsername(e.target.value)} className="input-field"/>
          </FormField>
          <div style={{padding:"9px 12px",background:DS.surfaceAlt,borderRadius:8,border:`1px solid ${DS.border}`}}>
            <div style={{fontSize:11,color:DS.textLight,marginBottom:2}}>Rôle</div>
            <div style={{fontSize:13,fontWeight:600,color:user.role==="admin"?DS.primary:DS.teal}}>{user.role==="admin"?"👑 Administrateur":"🔧 Formateur"}</div>
          </div>
          <button onClick={saveInfo} disabled={saving} className="btn btn-primary" style={{justifyContent:"center"}}>
            {saving?<><Spinner size={14} color="white"/>Sauvegarde…</>:<><Icon.Save/>Enregistrer</>}
          </button>
        </div>
      )}
      {tab==="security"&&(
        <div style={{display:"flex",flexDirection:"column",gap:13}}>
          <div style={{padding:"10px 13px",background:"#fef3c7",borderRadius:8,border:"1px solid #fde68a",display:"flex",gap:8,alignItems:"flex-start",fontSize:12,color:"#92400e"}}><Icon.Info/>Confirmez votre mot de passe actuel avant de le modifier.</div>
          <FormField label="Mot de passe actuel *" error={errors.curPw}><PasswordInput value={curPw} onChange={e=>setCurPw(e.target.value)} name="current-password"/></FormField>
          <FormField label="Nouveau mot de passe *" error={errors.newPw}><PasswordInput value={newPw} onChange={e=>setNewPw(e.target.value)} name="new-password"/></FormField>
          {newPw&&(<div><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,color:DS.textMid}}>Force</span><span style={{fontSize:11,fontWeight:600,color:stClr}}>{["","Faible","Moyen","Fort","Très fort"][st]}</span></div><div className="progress-bar"><div className="progress-fill" style={{width:`${(st/4)*100}%`,background:stClr}}/></div></div>)}
          <FormField label="Confirmer *" error={errors.confPw}><PasswordInput value={confPw} onChange={e=>setConfPw(e.target.value)} name="confirm-password"/></FormField>
          <button onClick={savePw} disabled={saving} className="btn btn-primary" style={{justifyContent:"center"}}>
            {saving?<><Spinner size={14} color="white"/>Modification…</>:<><Icon.Lock/>Modifier le mot de passe</>}
          </button>
        </div>
      )}
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── DASHBOARD ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const Dashboard = memo(function Dashboard({apprenants,notes,modules,metiers,admis,avecNotes,setPage,annee,session,copierApprenants}) {
  const effectifs=useMemo(()=>metiers.map((t,i)=>({...t,count:apprenants.filter(a=>a.metierId===t.id).length,color:PALETTE[i%PALETTE.length]})),[metiers,apprenants]);
  const maxEff=Math.max(...effectifs.map(e=>e.count),1);
  const taux=apprenants.length?Math.round((admis/apprenants.length)*100):0;

  const kpis=[
    {label:"Total Apprenants",value:apprenants.length, icon:<Icon.Users/>,       color:DS.primary, bg:DS.primaryLight,  trend:null},
    {label:"Avec des Notes",   value:avecNotes,         icon:<Icon.Edit/>,        color:DS.teal,    bg:DS.tealLight,     trend:apprenants.length?`${Math.round((avecNotes/apprenants.length)*100)}%`:null},
    {label:"Apprenants Admis", value:admis,             icon:<Icon.Award/>,       color:DS.success, bg:DS.successLight,  trend:`${taux}% de réussite`},
    {label:"Métiers Actifs",   value:metiers.length,    icon:<Icon.Tool/>,        color:DS.purple,  bg:DS.purpleLight,   trend:null},
    {label:"Modules Actifs",   value:modules.length,    icon:<Icon.Book/>,        color:DS.teal,    bg:DS.tealLight,     trend:null},
  ];

  // Import apprenants depuis la session précédente
  const[showImport,setShowImport]=useState(false);
  const[srcAnn,setSrcAnn]=useState(annee);
  const[srcSes,setSrcSes]=useState("1ère Session");
  const[importing,setImporting]=useState(false);
  const[impOpts,setImpOpts]=useState({apprenants:true,metiers:true,modules:true});
  const impRef=useRef();
  useOutsideClick(impRef,()=>setShowImport(false));
  const isSamePeriod=srcAnn===annee&&srcSes===session;
  const nothingSelected=!impOpts.apprenants&&!impOpts.metiers&&!impOpts.modules;

  async function doImport(){
    if(isSamePeriod||nothingSelected) return;
    setImporting(true);
    await copierApprenants(srcAnn,srcSes,impOpts);
    setImporting(false);setShowImport(false);
  }

  return (
    <div>
      <PageHeader title="Tableau de bord" subtitle={`${NOM_CENTRE} · ${annee} · ${session}`}
        actions={
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>window.location.reload()} className="btn btn-ghost btn-sm"><Icon.RefreshCw/>Actualiser</button>
            <div ref={impRef} style={{position:"relative"}}>
              <button onClick={()=>setShowImport(!showImport)} className="btn btn-primary btn-sm"><Icon.Import/>Importer apprenants (S1→S2)</button>
              {showImport&&(
                <div className="dropdown slide-in" style={{right:0,top:"calc(100% + 8px)",width:290,padding:16}}>
                  <div style={{fontSize:13,fontWeight:700,color:DS.text,marginBottom:12}}>📥 Importer vers la période active</div>
                  <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:12}}>
                    <div><label style={{fontSize:11,color:DS.textMid,fontWeight:600,display:"block",marginBottom:4}}>Année source</label>
                      <select value={srcAnn} onChange={e=>setSrcAnn(e.target.value)} className="input-field" style={{fontSize:12,padding:"6px 10px"}}>
                        {ANNEES.map(a=><option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div><label style={{fontSize:11,color:DS.textMid,fontWeight:600,display:"block",marginBottom:4}}>Session source</label>
                      <select value={srcSes} onChange={e=>setSrcSes(e.target.value)} className="input-field" style={{fontSize:12,padding:"6px 10px"}}>
                        {SESSIONS.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{fontSize:11,fontWeight:700,color:DS.textMid,marginBottom:7}}>Que souhaitez-vous importer ?</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
                    {[{key:"apprenants",label:"👤 Apprenants",desc:"La liste des apprenants (sans leurs notes)"},
                      {key:"metiers",label:"🔧 Métiers",desc:"Les filières de formation"},
                      {key:"modules",label:"📚 Modules",desc:"Les matières et coefficients"}
                    ].map(({key,label,desc})=>(
                      <label key={key} style={{display:"flex",alignItems:"flex-start",gap:8,cursor:"pointer",padding:"7px 9px",borderRadius:7,background:impOpts[key]?DS.primaryLight:DS.surfaceAlt,border:`1px solid ${impOpts[key]?DS.primary:DS.border}`,transition:"all 0.15s"}}>
                        <input type="checkbox" checked={impOpts[key]} onChange={e=>setImpOpts(o=>({...o,[key]:e.target.checked}))} style={{marginTop:2,accentColor:DS.primary}}/>
                        <div>
                          <div style={{fontSize:12,fontWeight:600,color:DS.text}}>{label}</div>
                          <div style={{fontSize:10,color:DS.textLight}}>{desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  {isSamePeriod&&<div style={{fontSize:11,color:DS.danger,background:DS.dangerLight,padding:"6px 9px",borderRadius:7,marginBottom:8}}>⚠️ Impossible d'importer depuis la période courante.</div>}
                  {nothingSelected&&<div style={{fontSize:11,color:DS.warning,background:DS.warningLight,padding:"6px 9px",borderRadius:7,marginBottom:8}}>⚠️ Sélectionnez au moins un élément à importer.</div>}
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>setShowImport(false)} className="btn btn-ghost btn-sm" style={{flex:1,justifyContent:"center"}}>Annuler</button>
                    <button onClick={doImport} disabled={importing||isSamePeriod||nothingSelected} className="btn btn-primary btn-sm" style={{flex:1,justifyContent:"center"}}>
                      {importing?<><Spinner size={12} color="white"/>Import…</>:"✅ Importer"}
                    </button>
                  </div>
                  <div style={{fontSize:10,color:DS.textLight,marginTop:8,lineHeight:1.4}}>Les notes ne sont pas importées.</div>
                </div>
              )}
            </div>
          </div>
        }/>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:13,marginBottom:22}}>
        {kpis.map(k=>(
          <div key={k.label} className="card" style={{padding:"14px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div style={{width:36,height:36,borderRadius:10,background:k.bg,display:"flex",alignItems:"center",justifyContent:"center",color:k.color}}>{k.icon}</div>
              {k.trend&&<span style={{fontSize:10,color:k.color,background:k.bg,padding:"2px 7px",borderRadius:20,fontWeight:600}}>{k.trend}</span>}
            </div>
            <div style={{fontSize:11,color:DS.textMid,fontWeight:500,marginBottom:2}}>{k.label}</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:k.color,fontWeight:700}}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}} className="grid-2">
        <div className="card" style={{padding:"16px 15px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <h3 style={{fontSize:14,fontWeight:700,color:DS.text,display:"flex",alignItems:"center",gap:7}}><Icon.BarChart/>Effectif par Métier</h3>
            <Badge color={DS.primary}>{apprenants.length} total</Badge>
          </div>
          <div style={{height:130}}>
            {effectifs.filter(e=>e.count>0).length===0?<EmptyState icon="📊" title="Aucune donnée"/>:(
              <svg viewBox={`0 0 240 120`} style={{width:"100%",height:"100%"}}>
                <defs>{PALETTE.map((c,i)=><linearGradient key={i} id={`bG${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c} stopOpacity="0.9"/><stop offset="100%" stopColor={c} stopOpacity="0.5"/></linearGradient>)}</defs>
                {[0,25,50,75,100].map(p=><line key={p} x1="10" y1={100*(1-p/100)*0.9+4} x2="235" y2={100*(1-p/100)*0.9+4} stroke={DS.border} strokeWidth="0.5" strokeDasharray="3,3"/>)}
                {effectifs.filter(e=>e.count>0).map((e,i,arr)=>{
                  const bw=Math.min(26,200/arr.length-6);
                  const x=14+i*(220/arr.length)+4;
                  const bh=Math.max((e.count/maxEff)*90,3);
                  return(
                    <g key={e.id}>
                      <rect x={x} y={94-bh} width={bw} height={bh} fill={`url(#bG${i%PALETTE.length})`} rx="3"/>
                      <text x={x+bw/2} y={91-bh} textAnchor="middle" fontSize="7" fill={e.color} fontWeight="700">{e.count}</text>
                      <text x={x+bw/2} y={112} textAnchor="middle" fontSize="6" fill={DS.textMid}>{e.nom.split(" ")[0]}</text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>
        <div className="card" style={{padding:"16px 15px"}}>
          <h3 style={{fontSize:14,fontWeight:700,color:DS.text,marginBottom:12,display:"flex",alignItems:"center",gap:7}}><Icon.TrendingUp/>Taux de Réussite par Métier</h3>
          {metiers.filter(t=>apprenants.some(a=>a.metierId===t.id)).length===0?<EmptyState icon="📈" title="Aucune donnée"/>:(
            <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:4}}>
              {metiers.filter(t=>apprenants.some(a=>a.metierId===t.id)).map((t,i)=>{
                const g=apprenants.filter(a=>a.metierId===t.id);
                const adm=g.filter(a=>{const m=modules.filter(x=>x.metierId===t.id||!x.metierId);return parseFloat(calcMoy(notes[a.id],m))>=12;}).length;
                const pct=g.length?Math.round((adm/g.length)*100):0;
                return(
                  <div key={t.id}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:12,color:DS.text,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"65%"}}>{t.nom}</span>
                      <span style={{fontSize:12,fontWeight:700,color:pct>=50?DS.success:DS.danger}}>{pct}% ({adm}/{g.length})</span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{width:`${pct}%`,background:PALETTE[i%PALETTE.length]}}/></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Classement par métier & niveau */}
      <div className="card" style={{padding:"16px 15px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h3 style={{fontSize:14,fontWeight:700,color:DS.text,display:"flex",alignItems:"center",gap:7}}><Icon.Users/>Apprenants par Métier & Niveau</h3>
          <button onClick={()=>setPage("apprenants")} className="btn btn-ghost btn-sm">Voir tout <Icon.ChevronRight/></button>
        </div>
        {apprenants.length===0?<EmptyState icon="👥" title="Aucun apprenant"/>:(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            {metiers.filter(t=>apprenants.some(a=>a.metierId===t.id)).map((t,ti)=>(
              <div key={t.id}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:PALETTE[ti%PALETTE.length]}}/>
                  <span style={{fontWeight:700,color:DS.text,fontSize:14}}>{t.nom}</span>
                  <Badge color={PALETTE[ti%PALETTE.length]}>{apprenants.filter(a=>a.metierId===t.id).length} apprenant(s)</Badge>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(195px,1fr))",gap:10}}>
                  {NIVEAUX.map(niv=>{
                    const g=apprenants.filter(a=>a.metierId===t.id&&a.niveau===niv).map(a=>{
                      const m=modules.filter(x=>x.metierId===t.id||!x.metierId);
                      return{...a,moy:parseFloat(calcMoy(notes[a.id],m)||0)};
                    }).sort((a,b)=>b.moy-a.moy);
                    if(!g.length) return null;
                    const premier=g[0], dernier=g[g.length-1];
                    return(
                      <div key={niv} style={{background:DS.bg,borderRadius:10,border:`1px solid ${DS.border}`,padding:"10px 12px"}}>
                        <div style={{fontSize:11,fontWeight:700,color:PALETTE[ti%PALETTE.length],marginBottom:8,display:"flex",justifyContent:"space-between"}}>
                          <span>{niv}</span><span style={{color:DS.textMid,fontWeight:400}}>{g.length} élève(s)</span>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 8px",background:DS.successLight,borderRadius:7,border:`1px solid ${DS.success}33`}}>
                            <div style={{display:"flex",alignItems:"center",gap:6}}><span>🥇</span><div><div style={{fontSize:12,fontWeight:600,color:DS.text}}>{premier.prenom} {premier.nom}</div><div style={{fontSize:10,color:DS.textLight}}>1er</div></div></div>
                            <span style={{fontFamily:"'Playfair Display',serif",fontSize:13,color:DS.success,fontWeight:700}}>{premier.moy.toFixed(2)}</span>
                          </div>
                          {g.length>1&&(
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 8px",background:DS.warningLight,borderRadius:7,border:`1px solid ${DS.warning}33`}}>
                              <div style={{display:"flex",alignItems:"center",gap:6}}><span>📌</span><div><div style={{fontSize:12,fontWeight:600,color:DS.text}}>{dernier.prenom} {dernier.nom}</div><div style={{fontSize:10,color:DS.textLight}}>Dernier</div></div></div>
                              <span style={{fontFamily:"'Playfair Display',serif",fontSize:13,color:DS.warning,fontWeight:700}}>{dernier.moy.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── APPRENANTS ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const Apprenants = memo(function Apprenants({apprenants,setApprenants,annee,session,notes,modules,metiers,showToast,isMobile}) {
  const empty={nom:"",prenom:"",dateNaissance:"",metierId:"",niveau:"Niveau 1",sexe:"M"};
  const[form,setForm]=useState(empty);
  const[editId,setEditId]=useState(null);
  const[search,setSearch]=useState("");
  const[showForm,setShowForm]=useState(false);
  const[confirmDel,setConfirmDel]=useState(null);
  const[saving,setSaving]=useState(false);
  const[filterM,setFilterM]=useState("");
  const[filterN,setFilterN]=useState("");
  const[sortBy,setSortBy]=useState("nom");
  const[errors,setErrors]=useState({});

  async function save() {
    const e={};
    if(!form.nom.trim()) e.nom="Requis";
    if(!form.prenom.trim()) e.prenom="Requis";
    if(!form.metierId) e.metierId="Sélectionnez un métier";
    
    // Vérifier si un apprenant avec le même nom et prénom existe déjà (sauf si on édite le même)
    if(!editId && apprenants.some(a => a.nom.toLowerCase()===form.nom.toLowerCase().trim() && a.prenom.toLowerCase()===form.prenom.toLowerCase().trim())) {
      e.nom="Un apprenant avec ce nom et prénom existe déjà";
    }
    
    // CORRECTION 1 : Bloquer la modification en S2 si apprenant vient de S1
    if(editId && session==="2ème Session") {
      const appEdit=apprenants.find(a=>a.id===editId);
      if(appEdit && appEdit.nom && appEdit.prenom) { // Si l'apprenant a des données (vient de S1)
        e.nom="Les apprenants importés de S1 ne peuvent pas être modifiés en S2. Modifiez-les en S1.";
      }
    }
    
    if(Object.keys(e).length) return setErrors(e);
    setSaving(true);
    try {
      const id = editId || uid();
      const saveData = {
        nom:      form.nom.trim(),
        prenom:   form.prenom.trim(),
        metierId: form.metierId,
        niveau:   form.niveau,
        sexe:     form.sexe || "M",
      };
      
      setForm(empty); setEditId(null); setShowForm(false); setErrors({});
      showToast(editId ? "Apprenant modifié !" : "Apprenant ajouté !");
      
      // Sauvegarder en base (Supabase recharge automatiquement)
      await fbSave(annee, session, "apprenants", id, saveData);
    } catch(err) {
      showToast("Erreur Supabase : " + err.message, "error");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function del(id) {
    // 1. Suppression locale immédiate
    setApprenants(prev => prev.filter(a => a.id !== id));
    setConfirmDel(null);
    showToast("Apprenant supprimé.");
    // 2. Sync Supabase en arrière-plan (supprimer SEULEMENT dans cette période)
    try {
      const {error:e1}=await supabase.from("apprenants").delete().eq("id",id).eq("periode_key",periodeKey);
      if(e1) throw e1;
      const {error:e2}=await supabase.from("notes").delete().eq("apprenant_id",id).eq("periode_key",periodeKey);
      if(e2) throw e2;
      console.log(`🗑️ Apprenant ${id} supprimé de ${periodeKey} (pas de suppression cascade)`);
    } catch(err) {
      showToast("Erreur Supabase : " + err.message, "error");
      console.error(err);
    }
  }

  const filtered=useMemo(()=>{
    let r=apprenants.filter(a=>{
      const q=`${a.nom} ${a.prenom}`.toLowerCase().includes(search.toLowerCase());
      const fm=filterM?a.metierId===filterM:true;
      const fn=filterN?a.niveau===filterN:true;
      return q&&fm&&fn;
    });
    return [...r].sort((a,b)=>{
      if(sortBy==="moy"){const ma=modules.filter(m=>m.metierId===a.metierId||!m.metierId);const mb=modules.filter(m=>m.metierId===b.metierId||!m.metierId);return parseFloat(calcMoy(notes[b.id],mb)||0)-parseFloat(calcMoy(notes[a.id],ma)||0);}
      return(a[sortBy]||"").localeCompare(b[sortBy]||"");
    });
  },[apprenants,search,filterM,filterN,sortBy,notes,modules]);

  return (
    <div>
      <PageHeader title="Apprenants" subtitle={`${apprenants.length} apprenant(s) · ${annee} · ${session}`}
        actions={<button onClick={()=>{setForm(empty);setEditId(null);setShowForm(true);setErrors({});}} className="btn btn-primary"><Icon.Plus/>Ajouter</button>}/>

      <div className="card" style={{padding:"12px 15px",marginBottom:14}}>
        <div style={{display:"flex",gap:9,flexWrap:"wrap",alignItems:"center"}}>
          <div style={{position:"relative",flex:1,minWidth:180}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:DS.textLight}}><Icon.Search/></span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher…" className="input-field" style={{paddingLeft:32}}/>
          </div>
          <select value={filterM} onChange={e=>setFilterM(e.target.value)} className="input-field" style={{width:"auto",minWidth:140}}>
            <option value="">Tous métiers</option>
            {metiers.map(t=><option key={t.id} value={t.id}>{t.nom}</option>)}
          </select>
          <select value={filterN} onChange={e=>setFilterN(e.target.value)} className="input-field" style={{width:"auto"}}>
            <option value="">Tous niveaux</option>
            {NIVEAUX.map(n=><option key={n}>{n}</option>)}
          </select>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="input-field" style={{width:"auto"}}>
            <option value="nom">Trier: Nom</option>
            <option value="niveau">Trier: Niveau</option>
            <option value="moy">Trier: Moyenne ↓</option>
          </select>
          {(search||filterM||filterN)&&<button onClick={()=>{setSearch("");setFilterM("");setFilterN("");}} className="btn btn-ghost btn-sm"><Icon.X/>Effacer</button>}
          <span style={{fontSize:12,color:DS.textMid,marginLeft:"auto"}}>{filtered.length} résultat(s)</span>
        </div>
      </div>

      <div className="card" style={{overflow:"hidden"}}>
        {filtered.length===0?(
          <EmptyState icon="👥" title="Aucun apprenant" description={search||filterM||filterN?"Modifiez vos critères.":"Ajoutez des apprenants."}
            action={!search&&!filterM&&!filterN&&<button onClick={()=>{setForm(empty);setShowForm(true);}} className="btn btn-primary"><Icon.Plus/>Ajouter</button>}/>
        ):(
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:DS.surfaceAlt,borderBottom:`2px solid ${DS.border}`}}>
                  {["#","Apprenant","Métier","Niveau","Sexe","Moyenne","Mention","Actions"].map(h=>(
                    <th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:11,color:DS.textMid,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.4px",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a,i)=>{
                  const metier=metiers.find(t=>t.id===a.metierId);
                  const mods=modules.filter(m=>m.metierId===a.metierId||!m.metierId);
                  const moy=calcMoy(notes[a.id],mods);
                  const mention=getMention(moy);
                  return(
                    <tr key={a.id} className="table-row" style={{borderBottom:`1px solid ${DS.border}`}}>
                      <td style={{padding:"10px 12px",fontSize:12,color:DS.textLight}}>{i+1}</td>
                      <td style={{padding:"10px 12px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:9}}>
                          <Avatar nom={a.nom} prenom={a.prenom} size={30}/>
                          <div>
                            <div style={{fontSize:13,color:DS.text,fontWeight:600}}>{a.prenom} {a.nom}</div>
                            {a.dateNaissance&&<div style={{fontSize:10,color:DS.textLight}}>Né(e) le {a.dateNaissance}</div>}
                          </div>
                        </div>
                      </td>
                      
                      <td style={{padding:"10px 12px",fontSize:12,color:DS.textMid}}>{metier?.nom||"—"}</td>
                      <td style={{padding:"10px 12px"}}><Badge color={DS.teal}>{a.niveau}</Badge></td>
                      <td style={{padding:"10px 12px",fontSize:12,color:DS.textMid}}>{a.sexe==="F"?"♀":"♂"} {a.sexe==="F"?"Fém.":"Masc."}</td>
                      <td style={{padding:"10px 12px"}}><span style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:mention.color,fontWeight:700}}>{moy??"—"}</span></td>
                      <td style={{padding:"10px 12px"}}><Badge color={mention.color} bg={mention.bg}>{mention.label}</Badge></td>
                      <td style={{padding:"10px 12px"}}>
                        <div style={{display:"flex",gap:5}}>
                          <button onClick={()=>{setForm({nom:a.nom,prenom:a.prenom,dateNaissance:"",metierId:a.metierId||"",niveau:a.niveau||"Niveau 1",sexe:a.sexe||"M"});setEditId(a.id);setShowForm(true);setErrors({});}} className="btn-icon" title="Modifier"><Icon.Edit/></button>
                          <button onClick={()=>setConfirmDel(a.id)} className="btn-icon" style={{color:DS.danger,borderColor:DS.danger+"44"}} title="Supprimer"><Icon.Trash/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showForm} onClose={()=>{setShowForm(false);setErrors({});}} title={editId?"Modifier l'apprenant":"Nouvel apprenant"}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:13}} className="grid-2">
          <FormField label="Prénom *" error={errors.prenom}><input value={form.prenom} onChange={e=>setForm({...form,prenom:e.target.value})} className="input-field" placeholder="Prénom"/></FormField>
          <FormField label="Nom *" error={errors.nom}><input value={form.nom} onChange={e=>setForm({...form,nom:e.target.value})} className="input-field" placeholder="Nom de famille"/></FormField>
          
          <FormField label="Sexe"><select value={form.sexe||"M"} onChange={e=>setForm({...form,sexe:e.target.value})} className="input-field"><option value="M">Masculin</option><option value="F">Féminin</option></select></FormField>
          <FormField label="Niveau *"><select value={form.niveau} onChange={e=>setForm({...form,niveau:e.target.value})} className="input-field">{NIVEAUX.map(n=><option key={n}>{n}</option>)}</select></FormField>
          
          <div style={{gridColumn:"1/-1"}}><FormField label="Métier *" error={errors.metierId}><select value={form.metierId} onChange={e=>setForm({...form,metierId:e.target.value})} className="input-field"><option value="">Sélectionner un métier</option>{metiers.map(t=><option key={t.id} value={t.id}>{t.nom}</option>)}</select></FormField></div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
          <button onClick={()=>{setShowForm(false);setErrors({});}} className="btn btn-ghost">Annuler</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving?<><Spinner size={14} color="white"/>Enregistrement…</>:<><Icon.Save/>{editId?"Enregistrer":"Ajouter"}</>}</button>
        </div>
      </Modal>
      <ConfirmModal open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={()=>del(confirmDel)} title="Supprimer cet apprenant ?" message="Cette action est irréversible. Les notes associées seront supprimées."/>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── NOTES ────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const Notes = memo(function Notes({apprenants,notes,annee,session,modules,metiers,showToast,user,isAdmin}) {
  // Support multi-niveaux : niveaux (array) ou niveau (ancien format string)
  const userNiveaux=Array.isArray(user.niveaux)&&user.niveaux.length?user.niveaux:(user.niveau?[user.niveau]:[]);
  const appFiltered=isAdmin?apprenants:apprenants.filter(a=>a.metierId===user.metierId&&(userNiveaux.length===0||userNiveaux.includes(a.niveau)));
  const[selected,setSelected]=useState(appFiltered[0]?.id||"");
  const[local,setLocal]=useState({});
  const[saving,setSaving]=useState(false);
  const[unsaved,setUnsaved]=useState(false);
  const[filterN,setFilterN]=useState("");
  const[filterM,setFilterM]=useState("");
  const[search,setSearch]=useState("");

  const saveDebounceRef=useRef(null);

  useEffect(()=>{if(!selected&&appFiltered.length)setSelected(appFiltered[0].id);},[appFiltered.length]);
  useEffect(()=>{if(selected){setLocal({...(notes[selected]||{})});setUnsaved(false);}},[selected,notes]);

  const handleChange=useCallback((id,val)=>{
    setLocal(l=>({...l,[id]:val}));
    setUnsaved(true);
  },[]);

  const saveNotes=useCallback(async()=>{
    if(saving) return;
    setSaving(true);
    showToast("Notes enregistrées !");
    setUnsaved(false);
    setSaving(false);
    fbSave(annee,session,"notes",selected,local).catch(()=>showToast("Erreur sync Supabase","error"));
  },[saving,annee,session,selected,local]);

  // Debounce auto-save : sauvegarde 2s après la dernière modification
  useEffect(()=>{
    if(!unsaved) return;
    if(saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    const t=setTimeout(()=>{ if(unsaved) saveNotes(); },2000);
    saveDebounceRef.current=t;
    return()=>clearTimeout(t);
  },[unsaved,saveNotes]);

  const apprenant=useMemo(()=>appFiltered.find(a=>a.id===selected),[appFiltered,selected]);
  const metier=useMemo(()=>metiers.find(t=>t.id===apprenant?.metierId),[metiers,apprenant?.metierId]);
  const mods=useMemo(()=>modules.filter(m=>m.metierId===apprenant?.metierId||!m.metierId),[modules,apprenant?.metierId]);

  const listFilt=useMemo(()=>appFiltered.filter(a=>{
    const q=`${a.nom} ${a.prenom}`.toLowerCase().includes(search.toLowerCase());
    const fn=filterN?a.niveau===filterN:true;
    const fm=filterM?a.metierId===filterM:true;
    return q&&fn&&fm;
  }),[appFiltered,search,filterN,filterM]);

  const moy=useMemo(()=>calcMoy(local,mods),[local,mods]);
  const mention=getMention(moy);
  const stats=useMemo(()=>mods.length>0?{filled:mods.filter(m=>local[m.id]!==undefined&&local[m.id]!=="").length,total:mods.length}:null,[mods,local]);

  return (
    <div>
      <PageHeader title="Saisie des Notes" subtitle={isAdmin?`Tous les apprenants · ${session}`:`Métier : ${metiers.find(t=>t.id===user.metierId)?.nom||"—"} · ${userNiveaux.join(", ")||"—"}`}/>
      <div style={{display:"grid",gridTemplateColumns:"260px 1fr",gap:16,alignItems:"start"}} className="grid-2">
        {/* Liste */}
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <div style={{padding:"12px 13px",borderBottom:`1px solid ${DS.border}`}}>
            <div style={{fontSize:12,fontWeight:700,color:DS.text,marginBottom:8}}>Sélection</div>
            <div style={{position:"relative",marginBottom:7}}>
              <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:DS.textLight}}><Icon.Search/></span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher…" className="input-field" style={{paddingLeft:28,fontSize:12,padding:"7px 9px 7px 28px"}}/>
            </div>
            {isAdmin&&(
              <div style={{display:"flex",gap:5}}>
                <select value={filterM} onChange={e=>setFilterM(e.target.value)} className="input-field" style={{fontSize:11,padding:"5px 7px",flex:1}}>
                  <option value="">Métiers</option>{metiers.map(t=><option key={t.id} value={t.id}>{t.nom.split(" ")[0]}</option>)}
                </select>
                <select value={filterN} onChange={e=>setFilterN(e.target.value)} className="input-field" style={{fontSize:11,padding:"5px 7px",flex:1}}>
                  <option value="">Niveaux</option>{NIVEAUX.map(n=><option key={n}>{n}</option>)}
                </select>
              </div>
            )}
          </div>
          <div style={{maxHeight:420,overflowY:"auto"}}>
            {listFilt.length===0?<EmptyState icon="👥" title="Aucun apprenant"/>:listFilt.map(a=>{
              const m=modules.filter(x=>x.metierId===a.metierId||!x.metierId);
              const mv=calcMoy(notes[a.id],m);
              const mc=getMention(mv);
              const isSel=a.id===selected;
              return(
                <button key={a.id} onClick={()=>setSelected(a.id)} style={{width:"100%",background:isSel?DS.primaryLight:"transparent",border:"none",borderLeft:isSel?`3px solid ${DS.primary}`:"3px solid transparent",padding:"9px 11px",textAlign:"left",cursor:"pointer",borderBottom:`1px solid ${DS.border}`,transition:"all 0.1s"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <Avatar nom={a.nom} prenom={a.prenom} size={26}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,color:isSel?DS.primary:DS.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.prenom} {a.nom}</div>
                      <div style={{fontSize:10,color:DS.textLight,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{metiers.find(t=>t.id===a.metierId)?.nom||"—"} · {a.niveau}</div>
                    </div>
                    {mv!==null&&<span style={{fontSize:11,fontWeight:700,color:mc.color,flexShrink:0}}>{mv}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Zone saisie */}
        <div>
          {!apprenant?(
            <div className="card"><EmptyState icon="👆" title="Sélectionnez un apprenant"/></div>
          ):(
            <>
              <div className="card" style={{padding:"14px 16px",marginBottom:12,borderLeft:`4px solid ${DS.primary}`}}>
                <div style={{display:"flex",flexWrap:"wrap",gap:14,alignItems:"center"}}>
                  <Avatar nom={apprenant.nom} prenom={apprenant.prenom} size={44}/>
                  <div style={{flex:1,minWidth:140}}>
                    <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:DS.text}}>{apprenant.prenom} {apprenant.nom}</div>
                    <div style={{fontSize:12,color:DS.textMid,marginTop:2,display:"flex",flexWrap:"wrap",gap:7}}>
                      <span>{metier?.nom||"—"}</span><span>·</span><Badge color={DS.teal}>{apprenant.niveau}</Badge>
                      <span>·</span><span>{apprenant.sexe==="F"?"♀ Féminin":"♂ Masculin"}</span>
                    </div>
                    
                  </div>
                  <div style={{background:DS.surfaceAlt,borderRadius:9,padding:"8px 13px",textAlign:"center",border:`1px solid ${DS.border}`}}>
                    <div style={{fontSize:10,color:DS.textLight,marginBottom:1}}>Effectif métier</div>
                    <div style={{fontFamily:"'Playfair Display',serif",fontSize:19,color:DS.primary,fontWeight:700}}>{apprenants.filter(a=>a.metierId===apprenant.metierId).length}</div>
                  </div>
                </div>
                {unsaved&&<div style={{marginTop:9,padding:"6px 10px",background:DS.warningLight,borderRadius:7,border:`1px solid ${DS.warning}33`,fontSize:12,color:DS.warning,display:"flex",alignItems:"center",gap:6}}><Icon.Info/>Modifications non sauvegardées</div>}
              </div>

              {mods.length===0?(
                <div className="card"><EmptyState icon="📭" title="Aucun module pour ce métier" description="Ajoutez des modules dans la section Modules."/></div>
              ):(
                <div className="card" style={{overflow:"hidden"}}>
                  <div style={{padding:"10px 14px",background:DS.surfaceAlt,borderBottom:`1px solid ${DS.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:12,color:DS.textMid}}>{mods.length} module(s)</span>
                    {stats&&<div className="progress-bar" style={{width:90}}><div className="progress-fill" style={{width:`${(stats.filled/stats.total)*100}%`,background:DS.primary}}/></div>}
                  </div>
                  <div style={{padding:"14px"}}>
                    <div style={{display:"flex",flexDirection:"column",gap:9}}>
                      {mods.map(m=>{
                        const val=local[m.id]??"";
                        const num=parseFloat(val);
                        const clr=isNaN(num)?DS.textLight:num>=10?DS.success:DS.danger;
                        return(
                          <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 12px",background:DS.bg,borderRadius:9,border:`1px solid ${DS.border}`,flexWrap:"wrap"}}>
                            <div style={{flex:1,minWidth:140}}>
                              <div style={{fontSize:13,color:DS.text,fontWeight:600}}>{m.nom}</div>
                              <div style={{fontSize:10,color:DS.textLight}}>Coef. {m.coefficient}</div>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <input type="number" min="0" max="20" step="0.25" value={val}
                                onChange={e=>handleChange(m.id,e.target.value)} placeholder="—"
                                style={{width:80,border:`2px solid ${val?clr+"66":DS.border}`,borderRadius:8,padding:"6px 7px",color:val?clr:DS.text,fontFamily:"'Playfair Display',serif",fontSize:17,textAlign:"center",background:"white",outline:"none",transition:"border-color 0.15s"}}/>
                              {val&&!isNaN(num)&&<Badge color={clr} bg={clr+"18"}>{num>=12?<><Icon.Check/>Validé</>:<><Icon.X/>Insuffisant</>}</Badge>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{marginTop:13,padding:"13px 15px",background:`linear-gradient(135deg,${DS.navy},${DS.primary})`,borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <div><div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginBottom:2}}>MOYENNE</div>
                          <span style={{fontFamily:"'Playfair Display',serif",fontSize:26,color:"white",fontWeight:700}}>{moy??""}<span style={{fontSize:14,color:"rgba(255,255,255,0.5)"}}>{moy!==null?"/20":""}</span>{moy===null&&<span style={{fontSize:14,color:"rgba(255,255,255,0.4)"}}>—</span>}</span>
                        </div>
                        <Badge color={mention.color} bg="rgba(255,255,255,0.15)" style={{fontSize:13,padding:"4px 12px"}}>{mention.label}</Badge>
                      </div>
                      <button onClick={saveNotes} disabled={saving} className="btn" style={{background:"rgba(255,255,255,0.2)",color:"white",border:"1px solid rgba(255,255,255,0.3)"}}>
                        {saving?<><Spinner size={14} color="white"/>Enregistrement…</>:<><Icon.Save/>Enregistrer</>}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── BULLETINS ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function Bulletins({apprenants,notes,modules,metiers,annee,session}) {
  const[selected,setSelected]=useState(apprenants[0]?.id||"");
  const[filterM,setFilterM]=useState("");
  const[notesS1,setNotesS1]=useState(null); // notes de la 1ère session (pour 2ème session seulement)
  const[apprenantsS1,setApprenantsS1]=useState(null); // apprenants de la 1ère session
  const[modulesS1,setModulesS1]=useState(null); // modules de la 1ère session
  const notesS1CacheRef=useRef({});
  const apprenantsS1CacheRef=useRef({});
  const modulesS1CacheRef=useRef({});
  const is2emeSession=session==="2ème Session";

  // Charger les notes, apprenants et modules de la 1ère session si on est en 2ème session (avec cache)
  useEffect(()=>{
    if(!is2emeSession){setNotesS1(null);setApprenantsS1(null);setModulesS1(null);return;}
    
    const pkS1 = cle(annee,"1ère Session");
    
    // Vérifier le cache d'abord
    if(notesS1CacheRef.current[pkS1] !== undefined && apprenantsS1CacheRef.current[pkS1] !== undefined && modulesS1CacheRef.current[pkS1] !== undefined){
      setNotesS1(notesS1CacheRef.current[pkS1]);
      setApprenantsS1(apprenantsS1CacheRef.current[pkS1]);
      setModulesS1(modulesS1CacheRef.current[pkS1]);
      return;
    }
    
    const t=setTimeout(async ()=>{
      try {
        // Charger les APPRENANTS de S1
        const {data: appsData, error: appsError} = await supabase.from("apprenants").select("*").eq("periode_key", pkS1);
        if(appsError) throw appsError;
        
        const appsMap = {};
        if(appsData && appsData.length > 0){
          appsData.forEach(app => {
            const key = `${app.nom}|${app.prenom}`.toLowerCase();
            appsMap[key] = app;
          });
          console.log("✅ Apprenants S1 chargés:", appsData);
        }
        apprenantsS1CacheRef.current[pkS1] = appsMap;
        setApprenantsS1(appsMap);
        
        // Charger les notes de S1
        const {data: notesData, error: notesError} = await supabase.from("notes").select("*").eq("periode_key", pkS1);
        if(notesError) throw notesError;
        
        const n={};
        if(notesData && notesData.length > 0){
          console.log("✅ Notes S1 chargées:", notesData);
          notesData.forEach(d=>{
            if(d.data && d.apprenant_id) {
              n[d.apprenant_id]=d.data;
            }
          });
        } else {
          console.warn("⚠️ Aucune note S1 trouvée pour", pkS1);
        }
        console.log("📊 notesS1 final:", n);
        notesS1CacheRef.current[pkS1]=n;
        setNotesS1(n);

        // Charger les modules de S1
        const {data: configData, error: configError} = await supabase.from("config").select("items").eq("periode_key", pkS1).eq("type", "modules").single();
        if(configError && configError.code !== 'PGRST116') throw configError; // PGRST116 = no rows found
        
        const m = configData?.items || [];
        modulesS1CacheRef.current[pkS1]=m;
        setModulesS1(m);
      } catch (e) {
        console.error("Erreur chargement S1:", e);
        notesS1CacheRef.current[pkS1]={};
        modulesS1CacheRef.current[pkS1]=[];
        setNotesS1({});
        setModulesS1([]);
      }
    },100);
    return()=>clearTimeout(t);
  },[is2emeSession,annee]);

  const apprenant=useMemo(()=>apprenants.find(a=>a.id===selected),[apprenants,selected]);
  if(!apprenant) return <div className="card"><EmptyState icon="📋" title="Aucun apprenant"/></div>;

  const metier=useMemo(()=>metiers.find(t=>t.id===apprenant.metierId),[metiers,apprenant.metierId]);
  const mods=useMemo(()=>modules.filter(m=>m.metierId===apprenant.metierId||!m.metierId),[modules,apprenant.metierId]);
  const modsS1=useMemo(()=>mods,[mods]); // Utiliser les mêmes modules pour S1 et S2 pour cohérence
  const moy=useMemo(()=>calcMoy(notes[apprenant.id],mods),[notes,apprenant.id,mods]);
  const mention=getMention(moy);
  const groupeMetier=useMemo(()=>apprenants.filter(a=>a.metierId===apprenant.metierId),[apprenants,apprenant.metierId]);
  const rang=useMemo(()=>[...groupeMetier].map(a=>({id:a.id,moy:parseFloat(calcMoy(notes[a.id],mods)||0)})).sort((a,b)=>b.moy-a.moy).findIndex(a=>a.id===apprenant.id)+1,[groupeMetier,notes,mods,apprenant.id]);

  // Calcul bilan annuel (seulement pour 2ème session)
  // Chercher les notes S1 par nom/prénom (car les IDs changent entre sessions)
  let moyS1=null;
  if(is2emeSession && apprenant && notesS1 && apprenantsS1 && Object.keys(notesS1).length > 0) {
    // Créer la clé pour matcher : nom|prénom en minuscules
    const keyApprenant = `${apprenant.nom}|${apprenant.prenom}`.toLowerCase();
    
    // Chercher l'apprenant S1 par nom/prénom
    const appS1 = apprenantsS1[keyApprenant];
    
    if(appS1 && notesS1[appS1.id]) {
      moyS1 = calcMoy(notesS1[appS1.id], modsS1);
      console.log(`✅ Notes S1 trouvées pour ${apprenant.prenom} ${apprenant.nom} (S1 ID: ${appS1.id})`);
    } else {
      console.log(`ℹ️ Notes S1 non trouvées pour ${apprenant.prenom} ${apprenant.nom} - cet apprenant a peut-être été créé directement en S2`);
    }
  }
  const moyS2=moy;
  const moyGenerale=(moyS1!==null&&moyS2!==null)?+((2*parseFloat(moyS2)+parseFloat(moyS1))/3).toFixed(2):null;
  const apprecFinale=moyGenerale!==null?(parseFloat(moyGenerale)>=12?"PASSE EN NIVEAU SUPÉRIEUR":"REDOUBLE"):null;

  const filtList=filterM?apprenants.filter(a=>a.metierId===filterM):apprenants;

  return (
    <div>
      <PageHeader title="Bulletins de Notes" subtitle={`${session} · ${annee}`}
        actions={<button onClick={()=>window.print()} className="btn btn-success no-print"><Icon.Print/>Imprimer</button>}/>

      <div className="card no-print" style={{padding:"13px 15px",marginBottom:16}}>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
          <select value={filterM} onChange={e=>{setFilterM(e.target.value);const f=apprenants.find(a=>!e.target.value||a.metierId===e.target.value);if(f)setSelected(f.id);}} className="input-field" style={{width:"auto",minWidth:160}}>
            <option value="">Tous métiers</option>{metiers.map(t=><option key={t.id} value={t.id}>{t.nom}</option>)}
          </select>
          <select value={selected} onChange={e=>setSelected(e.target.value)} className="input-field" style={{flex:1,minWidth:180}}>
            {filtList.map(a=>{const t=metiers.find(m=>m.id===a.metierId);return<option key={a.id} value={a.id}>{a.prenom} {a.nom} — {t?.nom||"—"} — {a.niveau}</option>;})}
          </select>
          {is2emeSession&&((notesS1===null||modulesS1===null)&&<span style={{fontSize:12,color:DS.textMid,display:"flex",alignItems:"center",gap:6}}><Spinner size={14}/>Chargement notes et modules S1…</span>)}
        </div>
      </div>

      <div style={{overflowX:"auto"}}>
        <div className="bcard" style={{background:"white",borderRadius:14,overflow:"hidden",maxWidth:760,margin:"0 auto",minWidth:320,border:`2px solid ${DS.navy}`,boxShadow:DS.shadowLg}}>

          {/* Header image */}
          <div style={{borderBottom:`3px solid ${DS.navy}`}}>
            <img src={cfpaHeader} alt="CFPA-Zé" style={{width:"100%",display:"block",objectFit:"contain"}}/>
          </div>

          {/* Bandeau titre */}
          <div style={{background:DS.navy,padding:"10px 26px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"white",fontWeight:700,letterSpacing:"0.5px",textTransform:"uppercase"}}>Bulletin de Notes — {session}</div>
            <div style={{fontSize:12,color:"#93c5fd",fontWeight:600}}>{annee}</div>
          </div>


          {/* Infos apprenant */}
          <div style={{padding:"13px 26px",background:DS.surfaceAlt,borderBottom:`2px solid ${DS.border}`,display:"flex",flexWrap:"wrap",gap:15}}>
            {[
              ["Nom & Prénom",`${apprenant.prenom} ${apprenant.nom.toUpperCase()}`,true],
              ["Métier / Spécialité",metier?.nom||"—"],
              ["Niveau",apprenant.niveau],
              ["Sexe",apprenant.sexe==="F"?"Féminin":"Masculin"],
            ].filter(Boolean).map(([l,v,b])=>(
              <div key={l} style={{minWidth:120,flex:b?2:1}}>
                <div style={{fontSize:9,color:DS.textLight,textTransform:"uppercase",letterSpacing:"1px",marginBottom:3,fontWeight:600}}>{l}</div>
                <div style={{fontSize:b?14:12,color:DS.text,fontWeight:700,borderBottom:`1px solid ${DS.border}`,paddingBottom:5}}>{v}</div>
              </div>
            ))}
          </div>

          {/* Tableau notes */}
          <div style={{padding:"4px 20px 0"}}>
            <table style={{width:"100%",borderCollapse:"collapse",border:`1px solid ${DS.border}`}}>
              <thead>
                <tr style={{background:DS.navy}}>
                  {["Module / Matière","Coef.","Note /20","Note pondérée","Appréciation"].map(h=>(
                    <th key={h} style={{padding:"9px 11px",textAlign:h==="Module / Matière"?"left":"center",fontSize:10,color:"white",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.4px",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mods.map((m,i)=>{
                  const note=notes[apprenant.id]?.[m.id];
                  const n=parseFloat(note);
                  const ok=!isNaN(n)&&n>=12;
                  return(
                    <tr key={m.id} style={{background:i%2===0?"white":DS.surfaceAlt,borderBottom:`1px solid ${DS.border}`}}>
                      <td style={{padding:"9px 11px",fontSize:12,color:DS.text,fontWeight:600,borderRight:`1px solid ${DS.border}`}}>{m.nom}</td>
                      <td style={{padding:"9px 11px",textAlign:"center",fontSize:12,color:DS.textMid,borderRight:`1px solid ${DS.border}`}}>{m.coefficient}</td>
                      <td style={{padding:"9px 11px",textAlign:"center",borderRight:`1px solid ${DS.border}`}}>
                        <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:isNaN(n)?DS.textLight:ok?"#15803d":"#dc2626",fontWeight:700}}>{isNaN(n)?"—":n.toFixed(2)}</span>
                      </td>
                      <td style={{padding:"9px 11px",textAlign:"center",fontSize:12,color:DS.textMid,borderRight:`1px solid ${DS.border}`}}>{isNaN(n)?"—":(n*m.coefficient).toFixed(2)}</td>
                      <td style={{padding:"9px 11px",textAlign:"center"}}>
                        {isNaN(n)?<span style={{fontSize:10,color:DS.textLight}}>—</span>:<span style={{fontSize:10,fontWeight:700,color:ok?"#15803d":"#dc2626",background:ok?"#dcfce7":"#fee2e2",padding:"2px 9px",borderRadius:20}}>{ok?"✓ Validé":"✗ Insuffisant"}</span>}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{background:DS.surfaceAlt,borderTop:`2px solid ${DS.border}`}}>
                  <td colSpan={2} style={{padding:"8px 11px",fontSize:11,fontWeight:700,color:DS.text}}>TOTAL</td>
                  <td colSpan={3} style={{padding:"8px 11px",textAlign:"center",fontSize:11,color:DS.textMid}}>
                    Σ coef = {mods.reduce((s,m)=>s+m.coefficient,0)} · Σ pondérée = {mods.reduce((s,m)=>{const n=parseFloat(notes[apprenant.id]?.[m.id]);return s+(isNaN(n)?0:n*m.coefficient);},0).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Résumé session courante */}
          <div style={{margin:"14px 20px",background:`linear-gradient(135deg,${DS.navy},#1d4ed8)`,borderRadius:12,padding:"15px 20px",border:`1px solid ${DS.navy}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:14,flexWrap:"wrap"}}>
              <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
                {[
                  ["Moyenne de la Session",<span style={{fontFamily:"'Playfair Display',serif",fontSize:28,color:mention.color,fontWeight:700}}>{moy??""}<span style={{fontSize:13,color:"rgba(255,255,255,0.4)"}}>{moy!==null?"/20":""}</span>{moy===null&&"—"}</span>],
                  ["Mention",<span style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:mention.color,fontWeight:700}}>{mention.label}</span>],
                  ["Rang",<span style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"white",fontWeight:700}}>{rang}e/{groupeMetier.length}</span>],
                ].map(([l,v])=>(
                  <div key={l}><div style={{fontSize:9,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"1px",marginBottom:4}}>{l}</div>{v}</div>
                ))}
              </div>
              <div style={{background:"rgba(255,255,255,0.12)",borderRadius:10,padding:"11px 16px",textAlign:"center",border:"1px solid rgba(255,255,255,0.2)"}}>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"1px",marginBottom:5}}>Décision</div>
                <div style={{fontWeight:800,fontSize:16,color:parseFloat(moy)>=12?"#4ade80":"#fca5a5"}}>{parseFloat(moy)>=12?"✅ ADMIS(E)":"❌ REFUSÉ(E)"}</div>
              </div>
            </div>
          </div>

          {/* ── BILAN ANNUEL — uniquement sur le bulletin 2ème Session ── */}
          {is2emeSession&&(
            <div style={{margin:"0 20px 14px",padding:"14px 16px",border:`1px solid ${DS.border}`,borderRadius:10,background:"#fafafa"}}>
              <div style={{fontSize:12,fontWeight:700,color:DS.navy,marginBottom:12,textTransform:"uppercase",letterSpacing:"0.5px",display:"flex",alignItems:"center",gap:7}}>
                <Icon.Award/>Bilan Annuel
              </div>
              {notesS1===null||modulesS1===null?(
                <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:DS.textMid}}><Spinner size={14}/>Chargement des notes et modules de la 1ère session…</div>
              ):(
                <>
                  {/* Tableau bilan sans bordure externe */}
                  <table style={{width:"100%",borderCollapse:"collapse",marginBottom:12}}>
                    <thead>
                      <tr style={{borderBottom:`2px solid ${DS.border}`}}>
                        <th style={{padding:"7px 10px",textAlign:"left",fontSize:10,color:DS.textMid,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"}}>Session</th>
                        <th style={{padding:"7px 10px",textAlign:"center",fontSize:10,color:DS.textMid,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"}}>Moyenne</th>
                        <th style={{padding:"7px 10px",textAlign:"center",fontSize:10,color:DS.textMid,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"}}>Mention</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {label:"1ère Session",moy:moyS1,coeff:""},
                        {label:"2ème Session",moy:moyS2,coeff:""},
                        {label:"Moyenne Générale",moy:moyGenerale,coeff:""},
                      ].map(row=>{
                        const mt=getMention(row.moy);
                        return(
                          <tr key={row.label} style={{borderBottom:`1px solid ${DS.border}`,background:row.bold?"#f0f4f8":"white"}}>
                            <td style={{padding:"9px 10px",fontSize:row.bold?13:12,fontWeight:row.bold?700:500,color:DS.text}}>
                              {row.label}
                              {!row.bold&&<span style={{fontSize:10,color:DS.textLight,marginLeft:6}}>{row.coeff}</span>}
                              {row.bold&&<div style={{fontSize:9,color:DS.textLight,fontWeight:400,marginTop:2}}>{row.coeff}</div>}
                            </td>
                            <td style={{padding:"9px 10px",textAlign:"center"}}>
                              <span style={{fontFamily:"'Playfair Display',serif",fontSize:row.bold?18:15,color:mt.color,fontWeight:700}}>{row.moy!==null?`${row.moy}/20`:"—"}</span>
                            </td>
                            <td style={{padding:"9px 10px",textAlign:"center"}}>
                              {row.moy!==null?<Badge color={mt.color} bg={mt.bg}>{mt.label}</Badge>:<span style={{fontSize:11,color:DS.textLight}}>—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Décision finale */}
                  <div style={{padding:"11px 14px",borderRadius:9,background:moyGenerale!==null?(parseFloat(moyGenerale)>=12?"#dcfce7":"#fee2e2"):DS.surfaceAlt,border:`1px solid ${moyGenerale!==null?(parseFloat(moyGenerale)>=12?"#86efac":"#fca5a5"):DS.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:10,color:DS.textMid,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:3}}>Décision du Conseil de Classe</div>
                      <div style={{fontSize:14,fontWeight:800,color:moyGenerale!==null?(parseFloat(moyGenerale)>=12?"#15803d":"#dc2626"):DS.textLight}}>
                        {apprecFinale||"Notes de la 1ère session non disponibles"}
                      </div>
                    </div>
                    {moyGenerale!==null&&<span style={{fontSize:28}}>{parseFloat(moyGenerale)>=12?"🎓":"📚"}</span>}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Appréciation */}
          <div style={{margin:"0 20px 14px",padding:"11px 15px",border:`1px solid ${DS.border}`,borderRadius:9}}>
            <div style={{fontSize:10,color:DS.textMid,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:6}}>Appréciation générale du jury</div>
            <div style={{height:28,borderBottom:`1px dotted ${DS.border}`}}/>
          </div>

          {/* Signatures */}
          <div style={{padding:"10px 20px 20px",display:"flex",justifyContent:"space-between",gap:14,borderTop:`1px solid ${DS.border}`,flexWrap:"wrap"}}>
            {["Chef des Travaux","Signature du Directeur","Signature du Parent / Tuteur"].map(s=>(
              <div key={s} style={{textAlign:"center",flex:1,minWidth:140}}>
                <div style={{height:46,borderBottom:`1px dashed ${DS.border}`,marginBottom:6}}/>
                <div style={{fontSize:10,color:DS.textMid,fontWeight:600}}>{s}</div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{background:DS.navy,padding:"7px 22px",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6}}>
            <span style={{fontSize:9,color:"rgba(255,255,255,0.4)"}}>IFU : 4202271050062</span>
            <span style={{fontSize:9,color:"rgba(255,255,255,0.4)"}}>{NOM_CENTRE}</span>
            <span style={{fontSize:9,color:"rgba(255,255,255,0.4)"}}>cfpaze@gmail.com · +229 56 64 64 43</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── MÉTIERS ──────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function MetiersPage({metiers,saveMetiers,showToast}) {
  const[form,setForm]=useState({nom:"",description:""});
  const[editIdx,setEditIdx]=useState(null);
  const[showForm,setShowForm]=useState(false);
  const[saving,setSaving]=useState(false);
  const[confirmDel,setConfirmDel]=useState(null);
  const[errors,setErrors]=useState({});

  function save() {
    const e={};if(!form.nom.trim()) e.nom="Requis";if(Object.keys(e).length) return setErrors(e);
    const items=editIdx!==null?metiers.map((m,i)=>i===editIdx?{...m,...form}:m):[...metiers,{id:uid(),...form}];
    saveMetiers(items);
    showToast(editIdx!==null?"Métier modifié !":"Métier ajouté !");
    setForm({nom:"",description:""});setEditIdx(null);setShowForm(false);setErrors({});
  }
  function del(idx){saveMetiers(metiers.filter((_,i)=>i!==idx));showToast("Métier supprimé.");setConfirmDel(null);}

  return(
    <div>
      <PageHeader title="Métiers" subtitle="Gérer les spécialités de formation"
        actions={<button onClick={()=>{setForm({nom:"",description:""});setEditIdx(null);setShowForm(true);setErrors({});}} className="btn btn-primary"><Icon.Plus/>Ajouter un métier</button>}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:15}}>
        {metiers.map((t,i)=>(
          <div key={t.id} className="card" style={{padding:"16px 16px 14px",borderTop:`3px solid ${PALETTE[i%PALETTE.length]}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:11}}>
              <div style={{width:40,height:40,borderRadius:11,background:PALETTE[i%PALETTE.length]+"18",display:"flex",alignItems:"center",justifyContent:"center",color:PALETTE[i%PALETTE.length]}}><Icon.Tool/></div>
              <Badge color={PALETTE[i%PALETTE.length]}>Métier</Badge>
            </div>
            <h3 style={{fontSize:14,fontWeight:700,color:DS.text,marginBottom:t.description?5:13}}>{t.nom}</h3>
            {t.description&&<p style={{fontSize:12,color:DS.textMid,lineHeight:1.5,marginBottom:13}}>{t.description}</p>}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setForm({nom:t.nom,description:t.description||""});setEditIdx(i);setShowForm(true);setErrors({});}} className="btn btn-ghost btn-sm" style={{flex:1,justifyContent:"center"}}><Icon.Edit/>Modifier</button>
              <button onClick={()=>setConfirmDel(i)} className="btn btn-sm" style={{background:DS.dangerLight,color:DS.danger,border:"none",flex:1,justifyContent:"center"}}><Icon.Trash/>Supprimer</button>
            </div>
          </div>
        ))}
        {metiers.length===0&&<div className="card" style={{gridColumn:"1/-1"}}><EmptyState icon="🛠️" title="Aucun métier" description="Créez les métiers du centre."/></div>}
      </div>
      <Modal open={showForm} onClose={()=>{setShowForm(false);setErrors({});}} title={editIdx!==null?"Modifier le métier":"Nouveau métier"} width={440}>
        <div style={{display:"flex",flexDirection:"column",gap:13}}>
          <FormField label="Nom *" error={errors.nom}><input value={form.nom} onChange={e=>setForm({...form,nom:e.target.value})} className="input-field" placeholder="Ex: Électricité Bâtiment"/></FormField>
          <FormField label="Description"><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={3} className="input-field" style={{resize:"vertical"}}/></FormField>
        </div>
        <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
          <button onClick={()=>{setShowForm(false);setErrors({});}} className="btn btn-ghost">Annuler</button>
          <button onClick={save} className="btn btn-primary"><Icon.Save/>{editIdx!==null?"Enregistrer":"Ajouter"}</button>
        </div>
      </Modal>
      <ConfirmModal open={confirmDel!==null} onClose={()=>setConfirmDel(null)} onConfirm={()=>del(confirmDel)} title="Supprimer ce métier ?" message="Les apprenants liés ne seront pas supprimés."/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── MODULES ──────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function ModulesPage({modules,metiers,saveModules,showToast}) {
  const[form,setForm]=useState({nom:"",coefficient:2,metierId:""});
  const[editIdx,setEditIdx]=useState(null);
  const[showForm,setShowForm]=useState(false);
  const[confirmDel,setConfirmDel]=useState(null);
  const[filterM,setFilterM]=useState("");
  const[errors,setErrors]=useState({});

  function save() {
    const e={};if(!form.nom.trim())e.nom="Requis";if(!form.coefficient||form.coefficient<1)e.coef="Invalide";
    if(Object.keys(e).length) return setErrors(e);
    const items=editIdx!==null?modules.map((m,i)=>i===editIdx?{...m,...form}:m):[...modules,{id:uid(),...form}];
    saveModules(items);showToast(editIdx!==null?"Module modifié !":"Module ajouté !");
    setForm({nom:"",coefficient:2,metierId:""});setEditIdx(null);setShowForm(false);setErrors({});
  }
  function del(idx){saveModules(modules.filter((_,i)=>i!==idx));showToast("Supprimé.");setConfirmDel(null);}
  const filtered=filterM?modules.filter(m=>m.metierId===filterM||(filterM==="commun"&&!m.metierId)):modules;

  return(
    <div>
      <PageHeader title="Modules" subtitle="Matières et coefficients par métier"
        actions={<button onClick={()=>{setForm({nom:"",coefficient:2,metierId:""});setEditIdx(null);setShowForm(true);setErrors({});}} className="btn btn-primary"><Icon.Plus/>Ajouter</button>}/>
      <div className="card" style={{padding:"11px 14px",marginBottom:15}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:12,color:DS.textMid,fontWeight:600}}>Filtrer :</span>
          {[{id:"",nom:`Tous (${modules.length})`},{id:"commun",nom:"Communs"},...metiers.map((t,i)=>({...t,color:PALETTE[i%PALETTE.length]}))].map(t=>(
            <button key={t.id} onClick={()=>setFilterM(t.id)} style={{padding:"4px 12px",borderRadius:20,border:`1px solid ${filterM===t.id?(t.color||DS.primary):DS.border}`,background:filterM===t.id?(t.color||DS.primary):"white",color:filterM===t.id?"white":DS.textMid,fontSize:12,cursor:"pointer"}}>{t.nom}</button>
          ))}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(235px,1fr))",gap:13}}>
        {filtered.map((m,i)=>{
          const metier=metiers.find(t=>t.id===m.metierId);
          const gi=modules.indexOf(m);
          return(
            <div key={m.id||i} className="card" style={{padding:"15px 15px 13px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:11}}>
                <div style={{width:36,height:36,borderRadius:9,background:DS.primaryLight,display:"flex",alignItems:"center",justifyContent:"center",color:DS.primary}}><Icon.Book/></div>
                <div style={{display:"flex",flexDirection:"column",gap:3,alignItems:"flex-end"}}>
                  <Badge color={DS.primary}>Coef. {m.coefficient}</Badge>
                  <Badge color={metier?DS.warning:DS.textLight} bg={metier?DS.warningLight:DS.surfaceAlt}>{metier?.nom||"Commun"}</Badge>
                </div>
              </div>
              <h3 style={{fontSize:13,fontWeight:700,color:DS.text,marginBottom:11}}>{m.nom}</h3>
              <div style={{display:"flex",gap:7}}>
                <button onClick={()=>{setForm({nom:m.nom,coefficient:m.coefficient,metierId:m.metierId||""});setEditIdx(gi);setShowForm(true);setErrors({});}} className="btn btn-ghost btn-sm" style={{flex:1,justifyContent:"center"}}><Icon.Edit/>Modifier</button>
                <button onClick={()=>setConfirmDel(gi)} className="btn btn-sm" style={{background:DS.dangerLight,color:DS.danger,border:"none",flex:1,justifyContent:"center"}}><Icon.Trash/>Supprimer</button>
              </div>
            </div>
          );
        })}
        {filtered.length===0&&<div className="card" style={{gridColumn:"1/-1"}}><EmptyState icon="📚" title="Aucun module"/></div>}
      </div>
      <Modal open={showForm} onClose={()=>{setShowForm(false);setErrors({});}} title={editIdx!==null?"Modifier":"Nouveau module"} width={420}>
        <div style={{display:"flex",flexDirection:"column",gap:13}}>
          <FormField label="Nom *" error={errors.nom}><input value={form.nom} onChange={e=>setForm({...form,nom:e.target.value})} className="input-field"/></FormField>
          <FormField label="Coefficient *" error={errors.coef} hint="Entre 1 et 10"><input type="number" min="1" max="10" value={form.coefficient} onChange={e=>setForm({...form,coefficient:parseInt(e.target.value)||1})} className="input-field"/></FormField>
          <FormField label="Métier associé" hint="Vide = commun à tous"><select value={form.metierId} onChange={e=>setForm({...form,metierId:e.target.value})} className="input-field"><option value="">Commun</option>{metiers.map(t=><option key={t.id} value={t.id}>{t.nom}</option>)}</select></FormField>
        </div>
        <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
          <button onClick={()=>{setShowForm(false);setErrors({});}} className="btn btn-ghost">Annuler</button>
          <button onClick={save} className="btn btn-primary"><Icon.Save/>{editIdx!==null?"Enregistrer":"Ajouter"}</button>
        </div>
      </Modal>
      <ConfirmModal open={confirmDel!==null} onClose={()=>setConfirmDel(null)} onConfirm={()=>del(confirmDel)} title="Supprimer ce module ?" message="Ce module sera retiré de tous les bulletins."/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── UTILISATEURS ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function UtilisateursPage({allUsers,setAllUsers,metiers,niveaux,showToast,currentUser}) {
  const empty={nom:"",prenom:"",username:"",password:"",role:"formateur",metierId:"",niveaux:[]};
  const[form,setForm]=useState(empty);
  const[editId,setEditId]=useState(null);
  const[showForm,setShowForm]=useState(false);
  const[saving,setSaving]=useState(false);
  const[confirmDel,setConfirmDel]=useState(null);
  const[errors,setErrors]=useState({});
  const[search,setSearch]=useState("");
  const[filterRole,setFilterRole]=useState("");

  async function save() {
    const e={};
    if(!form.nom.trim()) e.nom="Requis";
    if(!form.username.trim()) e.username="Requis";
    if(!editId&&!form.password) e.password="Requis";
    if(form.password&&form.password.length<6) e.password="6 caractères minimum";
    if(allUsers.find(u=>u.username===form.username.trim()&&u.id!==editId)) e.username="Déjà utilisé";
    if(form.role==="formateur"&&!form.metierId) e.metierId="Assignez un métier";
    if(form.role==="formateur"&&(!form.niveaux||form.niveaux.length===0)) e.niveaux="Assignez au moins un niveau";
    if(Object.keys(e).length) return setErrors(e);
    setSaving(true);
    try {
      const id = editId || uid();
      const data = { ...form };
      if(form.password) data.password = hashPwd(form.password);
      else if(editId) {
        const orig = allUsers.find(u => u.id === editId);
        if(orig) data.password = orig.password;
      }
      if(!editId) data.created_at = new Date().toISOString();
      // 1. Mise à jour locale immédiate
      if(editId){
        setAllUsers(prev => prev.map(u => u.id === editId ? {id, ...data} : u));
      } else {
        setAllUsers(prev => [...prev, {id, ...data}]);
      }
      setForm(empty); setEditId(null); setShowForm(false); setErrors({});
      showToast(editId ? "Utilisateur modifié !" : "Utilisateur créé !");

      await fbUsr(id, data);
    } catch(err) {
      showToast("Erreur Supabase : " + err.message, "error");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }
  async function del(id) {
    if(id===currentUser.id) return showToast("Vous ne pouvez pas vous supprimer","error");
    // 1. Suppression locale immédiate
    setAllUsers(prev => prev.filter(u => u.id !== id));
    setConfirmDel(null);
    showToast("Utilisateur supprimé.");
    // 2. Sync Firebase en arrière-plan
    try { await fbDelUsr(id); }
    catch(err) { showToast("Erreur Supabase : " + err.message, "error"); console.error(err); }
  }

  const filtered=allUsers.filter(u=>{
    const q=`${u.nom||""} ${u.username}`.toLowerCase().includes(search.toLowerCase());
    return q&&(filterRole?u.role===filterRole:true);
  });
  const stats={total:allUsers.length,admins:allUsers.filter(u=>u.role==="admin").length,formateurs:allUsers.filter(u=>u.role==="formateur").length};

  return(
    <div>
      <PageHeader title="Utilisateurs" subtitle="Gestion des accès et comptes"
        actions={<button onClick={()=>{setForm(empty);setEditId(null);setShowForm(true);setErrors({});}} className="btn btn-primary"><Icon.Plus/>Créer un utilisateur</button>}/>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:18}} className="grid-3">
        {[{label:"Total",value:stats.total,color:DS.primary,bg:DS.primaryLight},{label:"Admins",value:stats.admins,color:DS.purple,bg:DS.purpleLight},{label:"Formateurs",value:stats.formateurs,color:DS.teal,bg:DS.tealLight}].map(s=>(
          <div key={s.label} className="card" style={{padding:"13px 15px",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:38,height:38,borderRadius:9,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",color:s.color}}><Icon.Users/></div>
            <div><div style={{fontSize:11,color:DS.textMid}}>{s.label}</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:21,color:s.color,fontWeight:700}}>{s.value}</div></div>
          </div>
        ))}
      </div>

      <div className="card" style={{padding:"11px 13px",marginBottom:13}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <div style={{position:"relative",flex:1,minWidth:180}}>
            <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:DS.textLight}}><Icon.Search/></span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher…" className="input-field" style={{paddingLeft:28}}/>
          </div>
          <select value={filterRole} onChange={e=>setFilterRole(e.target.value)} className="input-field" style={{width:"auto"}}>
            <option value="">Tous rôles</option><option value="admin">Administrateur</option><option value="formateur">Formateur</option>
          </select>
        </div>
      </div>

      <div className="card" style={{overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:DS.surfaceAlt,borderBottom:`2px solid ${DS.border}`}}>
                {["Utilisateur","Identifiant","Rôle","Métier / Niveau","Créé le","Actions"].map(h=>(
                  <th key={h} style={{padding:"10px 13px",textAlign:"left",fontSize:11,color:DS.textMid,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.4px"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u=>{
                const metier=metiers.find(t=>t.id===u.metierId);
                const isMe=u.id===currentUser.id;
                return(
                  <tr key={u.id} className="table-row" style={{borderBottom:`1px solid ${DS.border}`,background:isMe?"#f0f9ff":"white"}}>
                    <td style={{padding:"11px 13px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:9}}>
                        <Avatar nom={u.nom} prenom={u.prenom||u.nom} size={30} color={u.role==="admin"?DS.primary:DS.teal}/>
                        <div><div style={{fontSize:13,fontWeight:600,color:DS.text}}>{u.nom||u.username} {isMe&&<Badge color={DS.success}>Moi</Badge>}</div>{u.prenom&&<div style={{fontSize:10,color:DS.textLight}}>{u.prenom}</div>}</div>
                      </div>
                    </td>
                    <td style={{padding:"11px 13px"}}><code style={{fontSize:11,background:DS.surfaceAlt,padding:"2px 6px",borderRadius:5,color:DS.textMid}}>@{u.username}</code></td>
                    <td style={{padding:"11px 13px"}}><Badge color={u.role==="admin"?DS.primary:DS.teal} bg={u.role==="admin"?DS.primaryLight:DS.tealLight}>{u.role==="admin"?"👑 Admin":"🔧 Formateur"}</Badge></td>
                    <td style={{padding:"11px 13px",fontSize:12,color:DS.textMid}}>
                      <div style={{fontWeight:500}}>{metier?.nom||"—"}</div>
                      {(()=>{const niv=Array.isArray(u.niveaux)&&u.niveaux.length?u.niveaux:(u.niveau?[u.niveau]:[]);return niv.length?<div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:4}}>{niv.map(n=><Badge key={n} color={DS.teal}>{n}</Badge>)}</div>:null;})()}
                    </td>
                    <td style={{padding:"11px 13px",fontSize:11,color:DS.textLight}}>{u.createdAt?new Date(u.createdAt).toLocaleDateString("fr-FR"):"—"}</td>
                    <td style={{padding:"11px 13px"}}>
                      <div style={{display:"flex",gap:5}}>
                        <button onClick={()=>{setForm({nom:u.nom||"",prenom:u.prenom||"",username:u.username,password:"",role:u.role,metierId:u.metierId||"",niveaux:Array.isArray(u.niveaux)&&u.niveaux.length?u.niveaux:(u.niveau?[u.niveau]:[])});setEditId(u.id);setShowForm(true);setErrors({});}} className="btn-icon" title="Modifier"><Icon.Edit/></button>
                        {!isMe&&<button onClick={()=>setConfirmDel(u.id)} className="btn-icon" style={{color:DS.danger,borderColor:DS.danger+"44"}} title="Supprimer"><Icon.Trash/></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0&&<tr><td colSpan={6}><EmptyState icon="👤" title="Aucun utilisateur"/></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showForm} onClose={()=>{setShowForm(false);setErrors({});}} title={editId?"Modifier l'utilisateur":"Créer un utilisateur"} width={500}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:13}} className="grid-2">
          <FormField label="Prénom"><input value={form.prenom} onChange={e=>setForm({...form,prenom:e.target.value})} className="input-field"/></FormField>
          <FormField label="Nom *" error={errors.nom}><input value={form.nom} onChange={e=>setForm({...form,nom:e.target.value})} className="input-field"/></FormField>
          <FormField label="Identifiant *" error={errors.username} hint="Pour la connexion"><input value={form.username} onChange={e=>setForm({...form,username:e.target.value})} className="input-field"/></FormField>
          <FormField label={editId?"Nouveau mot de passe":"Mot de passe *"} error={errors.password} hint={editId?"Vide = inchangé":"Min. 6 caractères"}><PasswordInput value={form.password} onChange={e=>setForm({...form,password:e.target.value})} name="new-password"/></FormField>
          <div style={{gridColumn:"1/-1"}}><FormField label="Rôle"><select value={form.role} onChange={e=>setForm({...form,role:e.target.value,metierId:"",niveaux:[]})} className="input-field"><option value="admin">👑 Administrateur</option><option value="formateur">🔧 Formateur</option></select></FormField></div>
          {form.role==="formateur"&&<>
            <FormField label="Métier assigné *" error={errors.metierId}><select value={form.metierId} onChange={e=>setForm({...form,metierId:e.target.value})} className="input-field"><option value="">Choisir un métier</option>{metiers.map(t=><option key={t.id} value={t.id}>{t.nom}</option>)}</select></FormField>
            <FormField label="Niveaux assignés *" error={errors.niveaux} hint="Sélectionnez un ou plusieurs niveaux">
              <div style={{display:"flex",gap:8,flexWrap:"wrap",padding:"10px 12px",border:`1.5px solid ${(errors.niveaux)?DS.danger:DS.border}`,borderRadius:DS.radiusSm,background:DS.surface}}>
                {niveaux.map(n=>{
                  const checked=(form.niveaux||[]).includes(n);
                  return(
                    <label key={n} onClick={()=>{
                      const cur=form.niveaux||[];
                      setForm({...form,niveaux:checked?cur.filter(x=>x!==n):[...cur,n]});
                    }} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:20,cursor:"pointer",border:`1.5px solid ${checked?DS.primary:DS.border}`,background:checked?DS.primaryLight:"white",userSelect:"none",transition:"all 0.15s"}}>
                      <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${checked?DS.primary:DS.border}`,background:checked?DS.primary:"white",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {checked&&<Icon.Check/>}
                      </div>
                      <span style={{fontSize:13,fontWeight:checked?600:400,color:checked?DS.primary:DS.text}}>{n}</span>
                    </label>
                  );
                })}
              </div>
            </FormField>
          </>}
        </div>
        <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
          <button onClick={()=>{setShowForm(false);setErrors({});}} className="btn btn-ghost">Annuler</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving?<><Spinner size={14} color="white"/>Enregistrement…</>:<><Icon.Save/>{editId?"Enregistrer":"Créer"}</>}</button>
        </div>
      </Modal>
      <ConfirmModal open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={()=>del(confirmDel)} title="Supprimer cet utilisateur ?" message="Cette action est irréversible."/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── STATISTIQUES ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function StatistiquesPage({apprenants,notes,modules,metiers,annee,session}) {
  const[tab,setTab]=useState("s1"); // "s1" | "s2" | "globales"
  const[notesS1,setNotesS1]=useState(null);
  const[notesS2,setNotesS2]=useState(null);
  const[apprenantsS1,setApprenantsS1]=useState(null);
  const[apprenantsS2,setApprenantsS2]=useState(null);
  const[loading,setLoading]=useState(true);

  // Charger les deux sessions (S1 et S2) au montage ou quand l'année change
  useEffect(()=>{
    setLoading(true);
    Promise.all([
      supabase.from("apprenants").select("*").eq("periode_key",cle(annee,"1ère Session")).order("nom"),
      supabase.from("notes").select("*").eq("periode_key",cle(annee,"1ère Session")),
      supabase.from("apprenants").select("*").eq("periode_key",cle(annee,"2ème Session")).order("nom"),
      supabase.from("notes").select("*").eq("periode_key",cle(annee,"2ème Session")),
    ]).then(([{data:appS1},{data:d1},{data:appS2},{data:d2}])=>{
      const n1={},n2={};
      (d1||[]).forEach(d=>{n1[d.apprenant_id]=d.data||{};});
      (d2||[]).forEach(d=>{n2[d.apprenant_id]=d.data||{};});
      setApprenantsS1(appS1||[]);
      setNotesS1(n1);
      setApprenantsS2(appS2||[]);
      setNotesS2(n2);
      setLoading(false);
    }).catch(e=>{console.error(e);setLoading(false);});
  },[annee]);

  // Calcul stats pour un set de notes donné
  function calcStats(appList,notesData,modsGetter) {
    return appList.map(a=>{
      const mods=modsGetter(a);
      const moy=calcMoy(notesData[a.id],mods);
      return{...a,moy,evalué:notesData[a.id]&&Object.keys(notesData[a.id]).length>0};
    });
  }

  // Stats d'un groupe d'apprenants enrichis
  function groupStats(enriched) {
    const evalués=enriched.filter(a=>a.evalué);
    const admis=evalués.filter(a=>a.moy!==null&&parseFloat(a.moy)>=10);
    const refusés=evalués.filter(a=>a.moy!==null&&parseFloat(a.moy)<10);
    const filles=enriched.filter(a=>a.sexe==="F");
    const moys=evalués.filter(a=>a.moy!==null).map(a=>parseFloat(a.moy));
    const maxMoy=moys.length?Math.max(...moys):null;
    const minMoy=moys.length?Math.min(...moys):null;
    const plusFort=maxMoy!==null?evalués.filter(a=>parseFloat(a.moy)===maxMoy):[];
    const plusFaible=minMoy!==null?evalués.filter(a=>parseFloat(a.moy)===minMoy):[];
    return{total:enriched.length,filles:filles.length,garcons:enriched.length-filles.length,evalués:evalués.length,admis:admis.length,refusés:refusés.length,maxMoy,minMoy,plusFort,plusFaible};
  }

  // Calc moyenne générale (2×S2 + S1) / 3
  function calcMoyGen(a,n1,n2) {
    const mods=modules.filter(m=>m.metierId===a.metierId||!m.metierId);
    
    // Chercher notes S1 par nom/prénom (car IDs changent)
    let m1=null;
    if(n1 && Object.keys(n1).length > 0) {
      // Essayer d'abord par ID direct (pour compatibilité)
      if(n1[a.id]) {
        m1=calcMoy(n1[a.id],mods);
      } else {
        // Sinon, chercher par nom/prénom
        for(const appId in n1) {
          const notes = n1[appId];
          if(notes && notes.nom && notes.prenom) {
            if(notes.nom.toLowerCase()===a.nom.toLowerCase() && notes.prenom.toLowerCase()===a.prenom.toLowerCase()) {
              m1=calcMoy(notes,mods);
              break;
            }
          }
        }
      }
    }
    
    // Chercher notes S2 par ID (même période, même ID)
    let m2=null;
    if(n2 && n2[a.id]) {
      m2=calcMoy(n2[a.id],mods);
    }
    
    if(m1===null&&m2===null) return null;
    if(m2===null) return parseFloat(m1);
    if(m1===null) return parseFloat(m2);
    return +((2*parseFloat(m2)+parseFloat(m1))/3).toFixed(2);
  }

  const tabs=[
    {id:"s1",label:"Statistiques — S1"},
    {id:"s2",label:"Statistiques — S2"},
    {id:"globales",label:"Statistiques Globales"},
  ];

  return(
    <div>
      <PageHeader title="Statistiques de Rendement" subtitle={`${NOM_CENTRE} · Année ${annee}`}
        actions={<button onClick={()=>window.print()} className="btn btn-success no-print"><Icon.Print/>Imprimer</button>}/>

      {/* Onglets */}
      <div className="no-print" style={{display:"flex",gap:6,marginBottom:20,borderBottom:`1px solid ${DS.border}`,paddingBottom:0}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"9px 18px",background:"none",border:"none",borderBottom:`2px solid ${tab===t.id?DS.primary:"transparent"}`,color:tab===t.id?DS.primary:DS.textMid,fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:-1,whiteSpace:"nowrap"}}>
            {t.label}
          </button>
        ))}
      </div>

      {loading?<div style={{display:"flex",justifyContent:"center",padding:60}}><Spinner size={36}/></div>:<>
        {tab==="s1"&&apprenantsS1&&<StatsSession apprenants={apprenantsS1} notes={notesS1||{}} modules={modules} metiers={metiers} annee={annee} session="1ère Session"/>}
        {tab==="s2"&&apprenantsS2&&<StatsSession apprenants={apprenantsS2} notes={notesS2||{}} modules={modules} metiers={metiers} annee={annee} session="2ème Session"/>}
        {tab==="globales"&&<StatsGlobales apprenants={apprenants} notesS1={notesS1||{}} notesS2={notesS2||{}} modules={modules} metiers={metiers} annee={annee} calcMoyGen={calcMoyGen}/>}
      </>}
    </div>
  );
}

// ── Stats d'une session ───────────────────────────────────────────────────────
function StatsSession({apprenants,notes,modules,metiers,annee,session}){
  function modsFor(a){return modules.filter(m=>m.metierId===a.metierId||!m.metierId);}

  // Enrichir tous les apprenants
  const enriched=apprenants.map(a=>{
    const mods=modsFor(a);
    const moy=calcMoy(notes[a.id],mods);
    return{...a,moy,evalué:notes[a.id]&&Object.keys(notes[a.id]).length>0};
  });

  // Stats globales CFPA
  function groupStats(list){
    const ev=list.filter(a=>a.evalué);
    const ad=ev.filter(a=>a.moyGen!==null&&parseFloat(a.moyGen)>=12);
    const ref=ev.filter(a=>a.moyGen!==null&&parseFloat(a.moyGen)<12);
    const fi=list.filter(a=>a.sexe==="F");
    const moys=ev.filter(a=>a.moyGen!==null).map(a=>parseFloat(a.moyGen)); // ⭐ Utiliser moyGen, pas moy
    const maxM=moys.length?Math.max(...moys):null;
    const minM=moys.length?Math.min(...moys):null;
    return{
      total:list.length,filles:fi.length,garcons:list.length-fi.length,
      evalués:ev.length,admis:ad.length,refusés:ref.length,
      maxMoy:maxM?maxM.toFixed(2):null,minMoy:minM?minM.toFixed(2):null,
      plusFort:maxM!==null?ev.filter(a=>parseFloat(a.moyGen)===maxM):[],
      plusFaible:minM!==null?ev.filter(a=>parseFloat(a.moyGen)===minM):[],
    };
  }

  const globalStats=groupStats(enriched);

  // Stats par métier
  const parMetier=metiers.map(t=>{
    const g=enriched.filter(a=>a.metierId===t.id);
    return{...t,...groupStats(g),apprenants:g};
  }).filter(t=>t.total>0);

  const COL=DS.navy;
  const thStyle={padding:"7px 10px",background:COL,color:"white",fontSize:11,fontWeight:700,textAlign:"center",border:"1px solid white",whiteSpace:"nowrap"};
  const th1Style={...thStyle,textAlign:"left"};
  const tdStyle={padding:"6px 10px",fontSize:12,border:`1px solid ${DS.border}`,textAlign:"center",color:DS.text};
  const td1Style={...tdStyle,textAlign:"left",fontWeight:500,background:DS.surfaceAlt};

  return(
    <div>
      {/* En-tête officielle imprimable */}
      <div style={{marginBottom:16}}>
        <img src={cfpaHeader} alt="CFPA-Zé" style={{width:"100%",display:"block",objectFit:"contain"}}/>
      </div>
      <div style={{textAlign:"center",marginBottom:20,padding:"8px 0",borderBottom:`2px solid ${DS.navy}`}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:DS.navy,textTransform:"uppercase",letterSpacing:"0.5px"}}>
          Statistique de Rendement par Ateliers
        </div>
        <div style={{fontSize:13,color:DS.textMid,marginTop:4}}>{session} · Année {annee}</div>
      </div>

      {/* Tableau par métier */}
      <div style={{overflowX:"auto",marginBottom:28}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
          <thead>
            <tr>
              <th style={{...th1Style,minWidth:200}}>INTITULÉ</th>
              {parMetier.map(t=><th key={t.id} style={thStyle}>{t.nom}</th>)}
              <th style={thStyle}>TOTAL</th>
              <th style={thStyle}>OBSERVATIONS</th>
            </tr>
          </thead>
          <tbody>
            {[
              {label:"Inscrits au registre",    render:t=>t.total,              total:()=>globalStats.total,           bold:false},
              {label:"Effectif de l'atelier",   render:t=>t.evalués||t.total,   total:()=>enriched.length,             bold:false},
              {label:"Nombre de filles",         render:t=>t.filles,             total:()=>globalStats.filles,          bold:false},
              {label:"Nombre de garçons",        render:t=>t.garcons,            total:()=>globalStats.garcons,         bold:false},
              {label:"Apprenants évalués",       render:t=>t.evalués,            total:()=>globalStats.evalués,         bold:false},
              {label:"Moyenne ≥ 12",             render:t=>t.admis,              total:()=>globalStats.admis,           bold:true,color:DS.success},
              {label:"Moyenne < 12",             render:t=>t.refusés,            total:()=>globalStats.refusés,         bold:true,color:DS.danger},
              {label:"Taux de réussite (%)",     render:t=>t.evalués?`${Math.round((t.admis/t.evalués)*100)}%`:"—",total:()=>globalStats.evalués?`${Math.round((globalStats.admis/globalStats.evalués)*100)}%`:"—",bold:false,color:DS.primary},
              {label:"Moyenne la plus forte",    render:t=>t.maxMoy||"—",        total:()=>globalStats.maxMoy||"—",     bold:false},
              {label:"Moyenne la plus faible",   render:t=>t.minMoy||"—",        total:()=>globalStats.minMoy||"—",     bold:false},
            ].map((row,ri)=>(
              <tr key={ri} style={{background:ri%2===0?"white":DS.surfaceAlt}}>
                <td style={{...td1Style,fontWeight:row.bold?700:500,color:row.color||DS.text}}>{row.label}</td>
                {parMetier.map(t=>(
                  <td key={t.id} style={{...tdStyle,fontWeight:row.bold?700:500,color:row.color||DS.text}}>{row.render(t)}</td>
                ))}
                <td style={{...tdStyle,fontWeight:700,color:row.color||DS.navy}}>{row.total()}</td>
                <td style={tdStyle}></td>
              </tr>
            ))}
            {/* Apprenants fort/faible */}
            <tr style={{background:DS.primaryLight}}>
              <td style={td1Style}>Apprenant — Moyenne la plus forte</td>
              {parMetier.map(t=>(
                <td key={t.id} style={{...tdStyle,fontSize:11}}>{t.plusFort.map(a=>`${a.prenom} ${a.nom}`).join(", ")||"—"}</td>
              ))}
              <td style={{...tdStyle,fontSize:11,fontWeight:700}}>{globalStats.plusFort.map(a=>`${a.prenom} ${a.nom}`).join(", ")||"—"}</td>
              <td style={tdStyle}></td>
            </tr>
            <tr>
              <td style={td1Style}>Apprenant — Moyenne la plus faible</td>
              {parMetier.map(t=>(
                <td key={t.id} style={{...tdStyle,fontSize:11}}>{t.plusFaible.map(a=>`${a.prenom} ${a.nom}`).join(", ")||"—"}</td>
              ))}
              <td style={{...tdStyle,fontSize:11,fontWeight:700}}>{globalStats.plusFaible.map(a=>`${a.prenom} ${a.nom}`).join(", ")||"—"}</td>
              <td style={tdStyle}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Récapitulatif global CFPA */}
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:DS.navy,marginBottom:12,textTransform:"uppercase",letterSpacing:"0.5px"}}>
        Récapitulatif Global — Registre du CFPA
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}} className="grid-2">
        <table style={{borderCollapse:"collapse",width:"100%"}}>
          <thead>
            <tr><th style={th1Style}>INTITULÉ</th><th style={{...thStyle,minWidth:120}}>REGISTRE DU CFPA</th><th style={thStyle}>OBSERVATIONS</th></tr>
          </thead>
          <tbody>
            {[
              {label:"Inscrits au registre",         val:globalStats.total},
              {label:"Nombre de filles",              val:globalStats.filles},
              {label:"Nombre de garçons",             val:globalStats.garcons},
              {label:"Apprenants évalués",            val:globalStats.evalués},
              {label:"Moyenne ≥ 12",                  val:globalStats.admis,color:DS.success},
              {label:"Moyenne < 12",                  val:globalStats.refusés,color:DS.danger},
              {label:"Taux de réussite",              val:globalStats.evalués?`${Math.round((globalStats.admis/globalStats.evalués)*100)}%`:"—",color:DS.primary},
              {label:"Moyenne la plus forte",         val:globalStats.maxMoy||"—"},
              {label:"Moyenne la plus faible",        val:globalStats.minMoy||"—"},
              {label:"Apprenant — Moy. la plus forte",val:globalStats.plusFort.map(a=>`${a.prenom} ${a.nom}`).join(", ")||"—"},
              {label:"Apprenant — Moy. la plus faible",val:globalStats.plusFaible.map(a=>`${a.prenom} ${a.nom}`).join(", ")||"—"},
            ].map((row,ri)=>(
              <tr key={ri} style={{background:ri%2===0?"white":DS.surfaceAlt}}>
                <td style={td1Style}>{row.label}</td>
                <td style={{...tdStyle,fontWeight:600,color:row.color||DS.text}}>{row.val}</td>
                <td style={tdStyle}></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Graphique mini */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div className="card" style={{padding:"14px 16px"}}>
            <div style={{fontSize:13,fontWeight:700,color:DS.navy,marginBottom:12}}>Répartition par Métier</div>
            {parMetier.map((t,i)=>{
              const pct=globalStats.total?Math.round((t.total/globalStats.total)*100):0;
              return(
                <div key={t.id} style={{marginBottom:9}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:12,color:DS.text}}>{t.nom}</span>
                    <span style={{fontSize:12,fontWeight:700,color:PALETTE[i%PALETTE.length]}}>{t.admis}/{t.evalués} admis</span>
                  </div>
                  <div className="progress-bar"><div className="progress-fill" style={{width:`${t.evalués?Math.round((t.admis/t.evalués)*100):0}%`,background:PALETTE[i%PALETTE.length]}}/></div>
                </div>
              );
            })}
          </div>
          {/* Résumé KPIs */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[
              {label:"Taux de réussite",val:globalStats.evalués?`${Math.round((globalStats.admis/globalStats.evalués)*100)}%`:"—",color:DS.success,bg:DS.successLight},
              {label:"Total évalués",val:globalStats.evalués,color:DS.primary,bg:DS.primaryLight},
              {label:"Admis",val:globalStats.admis,color:DS.success,bg:DS.successLight},
              {label:"Refusés",val:globalStats.refusés,color:DS.danger,bg:DS.dangerLight},
            ].map(k=>(
              <div key={k.label} style={{padding:"11px 13px",background:k.bg,borderRadius:9,border:`1px solid ${k.color}22`,textAlign:"center"}}>
                <div style={{fontSize:10,color:k.color,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:4}}>{k.label}</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:k.color,fontWeight:700}}>{k.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div style={{marginTop:32,display:"flex",justifyContent:"space-between",gap:20,flexWrap:"wrap"}}>
        {["Établi par","Vérifié par","Le Directeur"].map(s=>(
          <div key={s} style={{flex:1,minWidth:150,textAlign:"center"}}>
            <div style={{height:40,borderBottom:`1px dashed ${DS.border}`,marginBottom:6}}/>
            <div style={{fontSize:11,color:DS.textMid,fontWeight:600}}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stats Globales (S1 + S2 + Moy Générale) ──────────────────────────────────
function StatsGlobales({apprenants,notesS1,notesS2,modules,metiers,annee,calcMoyGen}){
  function modsFor(a){return modules.filter(m=>m.metierId===a.metierId||!m.metierId);}

  // Calcul pour chaque apprenant: moyS1, moyS2, moyGén
  const enriched=apprenants.map(a=>{
    const mods=modsFor(a);
    const m1=calcMoy(notesS1[a.id],mods);
    const m2=calcMoy(notesS2[a.id],mods);
    const mg=calcMoyGen(a,notesS1,notesS2);
    const hasMoyGen=mg!==null;
    return{...a,moyS1:m1,moyS2:m2,moyGen:mg,hasMoyGen};
  });

  // Stats globales CFPA — basées sur la moyenne générale (calculée à partir de S1 + S2)
  function groupStats(list){
    const ev=list.filter(a=>a.hasMoyGen);
    const ad=ev.filter(a=>a.moyGen>=12);
    const ref=ev.filter(a=>a.moyGen<12);
    const fi=list.filter(a=>a.sexe==="F");
    const moys=ev.map(a=>a.moyGen);
    const maxM=moys.length?Math.max(...moys):null;
    const minM=moys.length?Math.min(...moys):null;
    return{
      total:list.length,filles:fi.length,garcons:list.length-fi.length,
      evalués:ev.length,admis:ad.length,refusés:ref.length,
      maxMoy:maxM?maxM.toFixed(2):null,minMoy:minM?minM.toFixed(2):null,
      plusFort:maxM!==null?ev.filter(a=>a.moyGen===maxM):[],
      plusFaible:minM!==null?ev.filter(a=>a.moyGen===minM):[],
    };
  }

  const parMetier=metiers.map(t=>{
    const g=enriched.filter(a=>a.metierId===t.id);
    return{...t,...groupStats(g),apprenants:g};
  }).filter(t=>t.total>0);

  const globalStats=groupStats(enriched);

  const COL=DS.navy;
  const thStyle={padding:"7px 10px",background:COL,color:"white",fontSize:11,fontWeight:700,textAlign:"center",border:"1px solid white",whiteSpace:"nowrap"};
  const th1Style={...thStyle,textAlign:"left"};
  const tdStyle={padding:"6px 10px",fontSize:12,border:`1px solid ${DS.border}`,textAlign:"center",color:DS.text};
  const td1Style={...tdStyle,textAlign:"left",fontWeight:500,background:DS.surfaceAlt};

  return(
    <div>
      {/* En-tête officielle imprimable */}
      <div style={{marginBottom:16}}>
        <img src={cfpaHeader} alt="CFPA-Zé" style={{width:"100%",display:"block",objectFit:"contain"}}/>
      </div>
      <div style={{textAlign:"center",marginBottom:20,padding:"8px 0",borderBottom:`2px solid ${DS.navy}`}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:DS.navy,textTransform:"uppercase",letterSpacing:"0.5px"}}>
          Statistiques Globales — Bilan Annuel
        </div>
        <div style={{fontSize:13,color:DS.textMid,marginTop:4}}>Année {annee} · Moyenne Générale</div>
      </div>

      {/* Tableau par métier */}
      <div style={{overflowX:"auto",marginBottom:28}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
          <thead>
            <tr>
              <th style={{...th1Style,minWidth:200}}>INTITULÉ</th>
              {parMetier.map(t=><th key={t.id} style={thStyle}>{t.nom}</th>)}
              <th style={thStyle}>TOTAL</th>
              <th style={thStyle}>OBSERVATIONS</th>
            </tr>
          </thead>
          <tbody>
            {[
              {label:"Inscrits au registre",    render:t=>t.total,              total:()=>globalStats.total,           bold:false},
              {label:"Effectif de l'atelier",   render:t=>t.total,              total:()=>globalStats.total,             bold:false},
              {label:"Nombre de filles",         render:t=>t.filles,             total:()=>globalStats.filles,          bold:false},
              {label:"Nombre de garçons",        render:t=>t.garcons,            total:()=>globalStats.garcons,         bold:false},
              {label:"Apprenants évalués",       render:t=>t.evalués,            total:()=>globalStats.evalués,         bold:false},
              {label:"Moyenne ≥ 12",             render:t=>t.admis,              total:()=>globalStats.admis,           bold:true,color:DS.success},
              {label:"Moyenne < 12",             render:t=>t.refusés,            total:()=>globalStats.refusés,         bold:true,color:DS.danger},
              {label:"Taux de réussite (%)",     render:t=>t.evalués?`${Math.round((t.admis/t.evalués)*100)}%`:"—",total:()=>globalStats.evalués?`${Math.round((globalStats.admis/globalStats.evalués)*100)}%`:"—",bold:false,color:DS.primary},
              {label:"Moyenne la plus forte",    render:t=>t.maxMoy||"—",        total:()=>globalStats.maxMoy||"—",     bold:false},
              {label:"Moyenne la plus faible",   render:t=>t.minMoy||"—",        total:()=>globalStats.minMoy||"—",     bold:false},
            ].map((row,ri)=>(
              <tr key={ri} style={{background:ri%2===0?"white":DS.surfaceAlt}}>
                <td style={{...td1Style,fontWeight:row.bold?700:500,color:row.color||DS.text}}>{row.label}</td>
                {parMetier.map(t=>(
                  <td key={t.id} style={{...tdStyle,fontWeight:row.bold?700:500,color:row.color||DS.text}}>{row.render(t)}</td>
                ))}
                <td style={{...tdStyle,fontWeight:700,color:row.color||DS.navy}}>{row.total()}</td>
                <td style={tdStyle}></td>
              </tr>
            ))}
            {/* Apprenants fort/faible */}
            <tr style={{background:DS.primaryLight}}>
              <td style={td1Style}>Apprenant — Moyenne la plus forte</td>
              {parMetier.map(t=>(
                <td key={t.id} style={{...tdStyle,fontSize:11}}>{t.plusFort.map(a=>`${a.prenom} ${a.nom}`).join(", ")||"—"}</td>
              ))}
              <td style={{...tdStyle,fontSize:11,fontWeight:700}}>{globalStats.plusFort.map(a=>`${a.prenom} ${a.nom}`).join(", ")||"—"}</td>
              <td style={tdStyle}></td>
            </tr>
            <tr>
              <td style={td1Style}>Apprenant — Moyenne la plus faible</td>
              {parMetier.map(t=>(
                <td key={t.id} style={{...tdStyle,fontSize:11}}>{t.plusFaible.map(a=>`${a.prenom} ${a.nom}`).join(", ")||"—"}</td>
              ))}
              <td style={{...tdStyle,fontSize:11,fontWeight:700}}>{globalStats.plusFaible.map(a=>`${a.prenom} ${a.nom}`).join(", ")||"—"}</td>
              <td style={tdStyle}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Récapitulatif global */}
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:DS.navy,marginBottom:12,textTransform:"uppercase",letterSpacing:"0.5px",marginTop:8}}>
        Récapitulatif Global — Bilan Annuel
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}} className="grid-2">
        <table style={{borderCollapse:"collapse",width:"100%"}}>
          <thead>
            <tr><th style={th1Style}>INTITULÉ</th><th style={{...thStyle,minWidth:140}}>REGISTRE DU CFPA</th></tr>
          </thead>
          <tbody>
            {[
              {label:"Total inscrits",val:globalStats.total},
              {label:"Nombre de filles",val:globalStats.filles},
              {label:"Nombre de garçons",val:globalStats.garcons},
              {label:"Apprenants évalués",val:globalStats.evalués},
              {label:"Admis (Moy. ≥ 12)",val:globalStats.admis,color:DS.success},
              {label:"Ajournés (Moy. < 12)",val:globalStats.refusés,color:DS.danger},
              {label:"Taux de réussite annuel",val:globalStats.evalués?`${Math.round((globalStats.admis/globalStats.evalués)*100)}%`:"—",color:DS.primary},
              {label:"Moyenne générale la plus forte",val:globalStats.maxMoy||"—"},
              {label:"Moyenne générale la plus faible",val:globalStats.minMoy||"—"},
              {label:"Apprenant — Moy. la plus forte",val:globalStats.plusFort.map(a=>`${a.prenom} ${a.nom}`).join(", ")||"—"},
              {label:"Apprenant — Moy. la plus faible",val:globalStats.plusFaible.map(a=>`${a.prenom} ${a.nom}`).join(", ")||"—"},
            ].map((row,ri)=>(
              <tr key={ri} style={{background:ri%2===0?"white":DS.surfaceAlt}}>
                <td style={td1Style}>{row.label}</td>
                <td style={{...tdStyle,fontWeight:600,color:row.color||DS.text}}>{row.val}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div className="card" style={{padding:"14px 16px"}}>
            <div style={{fontSize:13,fontWeight:700,color:DS.navy,marginBottom:12}}>Taux de Réussite Annuel par Métier</div>
            {parMetier.map((t,i)=>{
              const pct=t.evalués?Math.round((t.admis/t.evalués)*100):0;
              return(
                <div key={t.id} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:12,color:DS.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"60%"}}>{t.nom}</span>
                    <span style={{fontSize:12,fontWeight:700,color:pct>=50?DS.success:DS.danger}}>{t.admis}/{t.evalués} ({pct}%)</span>
                  </div>
                  <div className="progress-bar"><div className="progress-fill" style={{width:`${pct}%`,background:PALETTE[i%PALETTE.length]}}/></div>
                </div>
              );
            })}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[
              {label:"Taux réussite annuel",val:globalStats.evalués?`${Math.round((globalStats.admis/globalStats.evalués)*100)}%`:"—",color:DS.success,bg:DS.successLight},
              {label:"Total évalués",val:globalStats.evalués,color:DS.primary,bg:DS.primaryLight},
              {label:"Passent en niv. sup.",val:globalStats.admis,color:DS.success,bg:DS.successLight},
              {label:"Redoublent",val:globalStats.refusés,color:DS.danger,bg:DS.dangerLight},
            ].map(k=>(
              <div key={k.label} style={{padding:"11px 13px",background:k.bg,borderRadius:9,border:`1px solid ${k.color}22`,textAlign:"center"}}>
                <div style={{fontSize:10,color:k.color,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:4}}>{k.label}</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:k.color,fontWeight:700}}>{k.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{marginTop:32,display:"flex",justifyContent:"space-between",gap:20,flexWrap:"wrap"}}>
        {["Établi par","Vérifié par","Le Directeur"].map(s=>(
          <div key={s} style={{flex:1,minWidth:150,textAlign:"center"}}>
            <div style={{height:40,borderBottom:`1px dashed ${DS.border}`,marginBottom:6}}/>
            <div style={{fontSize:11,color:DS.textMid,fontWeight:600}}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}