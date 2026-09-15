import React, { useState, useEffect, useMemo, useCallback } from "react";
import { storage } from "./storage.js";
import {
  Wallet, TrendingUp, Plane, Settings, ChevronLeft, ChevronRight,
  Check, AlertTriangle, PiggyBank, Home, RotateCcw, Landmark, ShoppingCart, Activity,
} from "lucide-react";
import Papa from "papaparse";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// ---------- constants & helpers ----------

const MONTH_NAMES = [
  "januari","februari","maart","april","mei","juni",
  "juli","augustus","september","oktober","november","december"
];

const fmt = (n) => {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
};
const fmt2 = (n) => {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
// Loonperiode: loopt van de instelbare uitbetalingsdag t/m de dag ervoor in de volgende maand.
// De key van een periode is altijd de kalendermaand waarin die periode start.
const payPeriodKeyForDate = (d, startDay = 25) => {
  let y = d.getFullYear();
  let m = d.getMonth(); // 0-indexed
  if (d.getDate() < startDay) {
    m -= 1;
    if (m < 0) { m = 11; y -= 1; }
  }
  return `${y}-${String(m + 1).padStart(2, "0")}`;
};
const periodLabel = (key, startDay = 25) => {
  const [y, m] = key.split("-").map(Number);
  const start = new Date(y, m - 1, startDay);
  const end = new Date(y, m, startDay - 1);
  const short = (d) => `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
  return `${short(start)} – ${short(end)} ${end.getFullYear()}`;
};
const addMonths = (key, n) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthKey(d);
};
const monthsBetween = (fromDateStr, toDateStr) => {
  const from = new Date(fromDateStr);
  const to = new Date(toDateStr);
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
};
const addMonthsToDate = (dateStr, n) => {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};
const cycleMonths = (frequentiePerJaar) => Math.max(1, Math.round(12 / (frequentiePerJaar || 1)));

const DEFAULT_VARIABLE = [
  { id: "boodschappen", naam: "Boodschappen", budget: 330, keywords: ["albert heijn", "jumbo", "lidl", "aldi", "dirk", "plus supermarkt"] },
  { id: "reizen", naam: "Reizen", budget: 70, keywords: ["ns ", "ov-chipkaart", "gvb", "ret ", "shell", "esso", "tango"] },
  { id: "kleding", naam: "Kleding", budget: 60, keywords: ["zalando", "h&m", "primark", "zara"] },
  { id: "verzorging", naam: "Verzorging", budget: 40, keywords: ["kruidvat", "etos", "ici paris"] },
  { id: "huishouden", naam: "Huishouden", budget: 40, keywords: ["action", "ikea", "hema"] },
  { id: "horeca", naam: "Uitgaan / Horeca", budget: 120, keywords: ["thuisbezorgd", "uber eats", "cafe", "restaurant"] },
  { id: "uitjes", naam: "Uitjes / Sport", budget: 80, keywords: ["bioscoop", "sportschool"] },
  { id: "abonnementen", naam: "Abonnementen (overig)", budget: 15, keywords: [] },
  { id: "buffer", naam: "Overig / buffer", budget: 67.55, keywords: [] },
];

const DEFAULT_VASTE_MAANDELIJKS = [
  { id: "huur", naam: "Huur", bedrag: 906 },
  { id: "zorg", naam: "Zorgverzekering", bedrag: 160 },
  { id: "beleggen", naam: "Beleggen", bedrag: 150 },
  { id: "duo", naam: "DUO", bedrag: 20 },
  { id: "streaming", naam: "Videoland + Netflix", bedrag: 11.99 },
  { id: "verzekeringen", naam: "Verzekeringen", bedrag: 11 },
  { id: "boksen", naam: "Boksen", bedrag: 87 },
  { id: "belastingdienst", naam: "Terugbetaling Belastingdienst", bedrag: 134 },
  { id: "lening", naam: "Lening aflossing (optioneel)", bedrag: 0 },
];

const DEFAULT_VASTE_JAARLIJKS = [
  { id: "reisverzekering", naam: "Reisverzekering", bedrag: 122.55, verwachteDatum: "2027-01-15", gespaard: 0, frequentiePerJaar: 1 },
  { id: "waterschap", naam: "Waterschapsbelasting", bedrag: 551, verwachteDatum: "2027-01-15", gespaard: 0, frequentiePerJaar: 1 },
  { id: "eigenrisico", naam: "Eigen risico", bedrag: 385, verwachteDatum: "2027-01-15", gespaard: 0, frequentiePerJaar: 1 },
  { id: "zvu", naam: "ZVU", bedrag: 450, verwachteDatum: "2027-01-15", gespaard: 0, frequentiePerJaar: 1 },
  { id: "ah", naam: "AH", bedrag: 15, verwachteDatum: "2027-01-15", gespaard: 0, frequentiePerJaar: 1 },
  { id: "lenzen", naam: "Lenzen", bedrag: 200, verwachteDatum: "2027-01-15", gespaard: 0, frequentiePerJaar: 2 },
  { id: "tandarts", naam: "Tandarts", bedrag: 75, verwachteDatum: "2027-01-15", gespaard: 0, frequentiePerJaar: 2 },
];

const DEFAULT_GOALS = [
  { id: "vak1", naam: "Vakantie 1", doel: 500, algespaard: 0, deadline: "2027-02-01" },
  { id: "vak2", naam: "Vakantie 2", doel: 7000, algespaard: 2500, deadline: "2027-04-01" },
  { id: "vak3", naam: "Vakantie 3", doel: 1500, algespaard: 0, deadline: "2027-08-01" },
];

const DEFAULT_INCOME = [
  { id: "salarisHoofd", naam: "Salaris (hoofdbaan)", bedrag: 2670 },
  { id: "salarisTweede", naam: "Salaris (2e baan)", bedrag: 0 },
  { id: "abonnementenTeruggaaf", naam: "Teruggaven gedeelde abonnementen", bedrag: 9.5 },
];

const DEFAULT_SAVINGS_ACCOUNTS = [
  { id: "oranje", naam: "Oranje Spaarrekening", saldo: 0 },
];

const DEFAULT_WENSLIJST = [];

const STORAGE_KEY = "budget-tracker-v2";

const defaultState = () => ({
  income: DEFAULT_INCOME,
  variable: DEFAULT_VARIABLE,
  vasteMaandelijks: DEFAULT_VASTE_MAANDELIJKS,
  vasteJaarlijks: DEFAULT_VASTE_JAARLIJKS,
  goals: DEFAULT_GOALS,
  savingsAccounts: DEFAULT_SAVINGS_ACCOUNTS,
  wenslijst: DEFAULT_WENSLIJST,
  payPeriodStartDay: 25,
  // { "2026-09": { spent: {...}, jaarlijkseBetalingen: [...], jaarlijkseStortingen: [...], geplandeUitgaven: [...] } }
  monthly: {},
});

const OLD_COMBINED_ID = "verzekeringenbelasting";
const OLD_COMBINED_TOTAL = 1523.55;
const SPLIT_REPLACEMENTS = [
  { id: "reisverzekering", naam: "Reisverzekering", bedrag: 122.55 },
  { id: "waterschap", naam: "Waterschapsbelasting", bedrag: 551 },
  { id: "eigenrisico", naam: "Eigen risico", bedrag: 385 },
  { id: "zvu", naam: "ZVU", bedrag: 450 },
  { id: "ah", naam: "AH", bedrag: 15 },
];

function migrateVasteJaarlijks(list) {
  const oldIndex = list.findIndex((v) => v.id === OLD_COMBINED_ID);
  if (oldIndex === -1) return list;
  const old = list[oldIndex];
  const oldGespaard = Number(old.gespaard) || 0;
  const replacements = SPLIT_REPLACEMENTS.map((r) => ({
    id: r.id,
    naam: r.naam,
    bedrag: r.bedrag,
    verwachteDatum: old.verwachteDatum || "2027-01-15",
    gespaard: Math.round(((r.bedrag / OLD_COMBINED_TOTAL) * oldGespaard) * 100) / 100,
  }));
  const next = [...list];
  next.splice(oldIndex, 1, ...replacements);
  return next;
}

function migrateIncome(income) {
  if (Array.isArray(income)) return income;
  if (income && typeof income === "object") {
    return DEFAULT_INCOME.map((d) => ({ ...d, bedrag: typeof income[d.id] === "number" ? income[d.id] : d.bedrag }));
  }
  return DEFAULT_INCOME;
}

function safeMergeState(parsed) {
  const d = defaultState();
  const vasteJaarlijksRaw = Array.isArray(parsed.vasteJaarlijks) ? parsed.vasteJaarlijks : d.vasteJaarlijks;
  const variableRaw = Array.isArray(parsed.variable) ? parsed.variable : d.variable;
  const wenslijstRaw = Array.isArray(parsed.wenslijst) ? parsed.wenslijst : d.wenslijst;
  return {
    income: migrateIncome(parsed.income),
    variable: variableRaw.map((c) => ({ keywords: [], ...c })),
    vasteMaandelijks: Array.isArray(parsed.vasteMaandelijks) ? parsed.vasteMaandelijks : d.vasteMaandelijks,
    vasteJaarlijks: migrateVasteJaarlijks(vasteJaarlijksRaw),
    goals: Array.isArray(parsed.goals) ? parsed.goals : d.goals,
    savingsAccounts: Array.isArray(parsed.savingsAccounts) ? parsed.savingsAccounts : d.savingsAccounts,
    wenslijst: wenslijstRaw.map((w) => ({ prioriteit: "gemiddeld", label: "", gekocht: false, ...w })),
    payPeriodStartDay: typeof parsed.payPeriodStartDay === "number" ? parsed.payPeriodStartDay : d.payPeriodStartDay,
    monthly: parsed.monthly && typeof parsed.monthly === "object" ? parsed.monthly : {},
  };
}

// som van alle variabele uitgaven (handmatig ingevoerd + geplande wenslijst-aankopen) in een maand
const maandVariabelTotaal = (entry) => {
  const spentSom = Object.values(entry?.spent || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  const geplandSom = (entry?.geplandeUitgaven || []).reduce((a, e) => a + (Number(e.bedrag) || 0), 0);
  return spentSom + geplandSom;
};

// ---------- import & auto-categorisering van banktransacties ----------

function parseDutchAmount(str) {
  if (str == null) return NaN;
  let s = String(str).trim();
  if (!s) return NaN;
  s = s.replace(/[^0-9,.\-]/g, "");
  if (!s) return NaN;
  if (s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,(?=\d{3}(\D|$))/g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

function detectColumn(headers, candidates) {
  const lower = headers.map((h) => h.toLowerCase());
  for (const cand of candidates) {
    const idx = lower.findIndex((h) => h.includes(cand));
    if (idx !== -1) return headers[idx];
  }
  return null;
}

// Probeert een bank-CSV te herkennen (ING/ABN/Rabobank-achtige exports). Geeft null terug als dat niet lukt.
function parseBankCSV(text) {
  for (const delim of [";", ",", "\t"]) {
    let result;
    try {
      result = Papa.parse(text, { header: true, delimiter: delim, skipEmptyLines: true });
    } catch (e) {
      continue;
    }
    const headers = result.meta && result.meta.fields;
    if (result.data && result.data.length > 0 && headers && headers.length > 1) {
      const amountCol = detectColumn(headers, ["bedrag", "amount", "value"]);
      const descCol = detectColumn(headers, ["omschrijving", "mededeling", "naam", "description", "tegenpartij", "tegenrekening"]);
      const dateCol = detectColumn(headers, ["datum", "date"]);
      const afbijCol = detectColumn(headers, ["af bij", "af/bij", "af_bij"]);
      if (amountCol) {
        const rows = result.data
          .map((row) => {
            let bedrag = parseDutchAmount(row[amountCol]);
            if (afbijCol && row[afbijCol]) {
              const waarde = String(row[afbijCol]).toLowerCase();
              const isAf = waarde.includes("af") && !waarde.includes("bij");
              bedrag = Math.abs(bedrag) * (isAf ? -1 : 1);
            }
            return {
              datum: dateCol ? row[dateCol] : "",
              omschrijving: descCol ? row[descCol] : Object.values(row).filter(Boolean).join(" "),
              bedrag,
            };
          })
          .filter((r) => Number.isFinite(r.bedrag));
        if (rows.length > 0) return rows;
      }
    }
  }
  return null;
}

// Fallback: platte tekst (bv. geplakt uit een PDF-afschrift), één transactie per regel,
// waarbij het bedrag aan het eind van de regel staat.
function parsePlainText(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/(-?[\d.,]+)\s*(?:eur|€)?\s*$/i);
      if (!match) return null;
      const bedrag = parseDutchAmount(match[1]);
      if (!Number.isFinite(bedrag)) return null;
      const omschrijving = line.slice(0, match.index).trim() || line;
      return { datum: "", omschrijving, bedrag: -Math.abs(bedrag) };
    })
    .filter(Boolean);
}

function matchCategorie(omschrijving, variable) {
  const text = (omschrijving || "").toLowerCase();
  for (const cat of variable) {
    const kws = cat.keywords || [];
    if (kws.some((k) => k && text.includes(String(k).toLowerCase()))) return cat.id;
  }
  return "";
}

// ---------- achterstand-detectie voor jaarpotjes en spaardoelen ----------

function jaarpotStatus(item, today) {
  const cyclusMaanden = cycleMonths(item.frequentiePerJaar || 1);
  const cyclusStart = addMonthsToDate(item.verwachteDatum, -cyclusMaanden);
  const verstreken = Math.min(cyclusMaanden, Math.max(0, monthsBetween(cyclusStart, today)));
  const verwachtPct = cyclusMaanden > 0 ? (verstreken / cyclusMaanden) * 100 : 0;
  const bedrag = Number(item.bedrag) || 0;
  const gespaard = Number(item.gespaard) || 0;
  const actueelPct = bedrag > 0 ? (gespaard / bedrag) * 100 : 100;
  const verwachtBedrag = bedrag * (cyclusMaanden > 0 ? verstreken / cyclusMaanden : 0);
  const tekort = Math.max(0, verwachtBedrag - gespaard);
  const achterstand = bedrag > 0 && actueelPct < verwachtPct - 8;
  return { verwachtPct, actueelPct, tekort, achterstand };
}

function goalStatus(goal, gemSparen, today) {
  const doel = Number(goal.doel) || 0;
  const algespaard = Number(goal.algespaard) || 0;
  const resterend = Math.max(0, doel - algespaard);
  const maanden = Math.max(0, monthsBetween(today, goal.deadline));
  const benodigdPerMaand = maanden > 0 ? resterend / maanden : resterend;
  const opSchema = gemSparen >= benodigdPerMaand;
  return { resterend, maanden, benodigdPerMaand, opSchema };
}

// ---------- small UI atoms ----------

function ProgressBar({ pct, tone }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color = tone === "over" ? "#B3492A" : tone === "warn" ? "#C08A2E" : "#2F7A5C";
  return (
    <div style={{ height: 8, borderRadius: 999, background: "#E7E1D4", overflow: "hidden" }}>
      <div style={{ width: `${clamped}%`, height: "100%", background: color, borderRadius: 999, transition: "width 300ms ease" }} />
    </div>
  );
}

function DottedRow({ left, right, bold }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontWeight: bold ? 700 : 400 }}>
      <span style={{ whiteSpace: "nowrap", color: "#3A362E" }}>{left}</span>
      <span style={{ flex: 1, borderBottom: "1px dotted #B8AF9C", transform: "translateY(-3px)" }} />
      <span style={{ whiteSpace: "nowrap", fontFamily: "'IBM Plex Mono', monospace", color: "#1F2937" }}>{right}</span>
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E4DFD6", borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 2px rgba(31,41,55,0.04)", ...style }}>
      {children}
    </div>
  );
}

function SummaryStat({ label, value, sub, color }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "#8A8171", marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 600, color }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: "#B8AF9C" }}>{sub}</div>}
    </div>
  );
}

// ---------- main app ----------

export default function App() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [notConfigured, setNotConfigured] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(payPeriodKeyForDate(new Date()));
  const [tab, setTab] = useState("maand");

  useEffect(() => {
    if (!storage.isConfigured()) {
      setNotConfigured(true);
      setState(defaultState());
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await storage.get(STORAGE_KEY);
        if (res && res.value) {
          setState(safeMergeState(JSON.parse(res.value)));
        } else {
          setState(defaultState());
        }
      } catch (e) {
        console.error(e);
        setState(defaultState());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!state || loading || notConfigured) return;
    setSaveStatus("saving");
    const t = setTimeout(async () => {
      try {
        const result = await storage.set(STORAGE_KEY, JSON.stringify(state));
        setSaveStatus(result ? "saved" : "error");
      } catch (e) {
        console.error(e);
        setSaveStatus("error");
      }
    }, 500);
    return () => clearTimeout(t);
  }, [state, loading]);

  const monthData = useMemo(() => {
    if (!state) return { spent: {} };
    return state.monthly[currentMonth] || { spent: {} };
  }, [state, currentMonth]);

  const setSpent = useCallback((catId, value) => {
    setState((prev) => {
      const next = { ...prev, monthly: { ...prev.monthly } };
      const existing = next.monthly[currentMonth] || { spent: {} };
      next.monthly[currentMonth] = { ...existing, spent: { ...existing.spent, [catId]: value } };
      return next;
    });
  }, [currentMonth]);

  // ---- generieke CRUD helpers voor lijsten met {id, naam, bedrag/budget} ----
  const updateListItem = useCallback((listKey, id, field, value) => {
    setState((prev) => ({ ...prev, [listKey]: prev[listKey].map((item) => (item.id === id ? { ...item, [field]: value } : item)) }));
  }, []);
  const addListItem = useCallback((listKey, factory) => {
    setState((prev) => ({ ...prev, [listKey]: [...prev[listKey], factory()] }));
  }, []);
  const removeListItem = useCallback((listKey, id) => {
    setState((prev) => ({ ...prev, [listKey]: prev[listKey].filter((item) => item.id !== id) }));
  }, []);
  const newId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const updateVariable = (id, field, value) => updateListItem("variable", id, field, value);
  const addVariable = () => addListItem("variable", () => ({ id: newId("var"), naam: "Nieuwe categorie", budget: 0 }));
  const removeVariable = (id) => removeListItem("variable", id);

  const updateVasteMaandelijks = (id, field, value) => updateListItem("vasteMaandelijks", id, field, value);
  const addVasteMaandelijks = () => addListItem("vasteMaandelijks", () => ({ id: newId("vm"), naam: "Nieuwe vaste last", bedrag: 0 }));
  const removeVasteMaandelijks = (id) => removeListItem("vasteMaandelijks", id);

  const updateVasteJaarlijks = (id, field, value) => updateListItem("vasteJaarlijks", id, field, value);
  const addVasteJaarlijks = () =>
    addListItem("vasteJaarlijks", () => ({ id: newId("vj"), naam: "Nieuwe jaarlijkse last", bedrag: 0, verwachteDatum: today, gespaard: 0, frequentiePerJaar: 1 }));
  const removeVasteJaarlijks = (id) => removeListItem("vasteJaarlijks", id);

  const updateIncome = (id, field, value) => updateListItem("income", id, field, value);
  const addIncome = () => addListItem("income", () => ({ id: newId("inc"), naam: "Nieuwe inkomstenbron", bedrag: 0 }));
  const removeIncome = (id) => removeListItem("income", id);

  const updateSavingsAccount = (id, field, value) => updateListItem("savingsAccounts", id, field, value);
  const addSavingsAccount = () => addListItem("savingsAccounts", () => ({ id: newId("sav"), naam: "Nieuwe spaarrekening", saldo: 0 }));
  const removeSavingsAccount = (id) => removeListItem("savingsAccounts", id);

  const markJaarlijksBetaald = (id) =>
    setState((prev) => ({
      ...prev,
      vasteJaarlijks: prev.vasteJaarlijks.map((v) =>
        v.id === id ? { ...v, gespaard: 0, verwachteDatum: addMonthsToDate(v.verwachteDatum, cycleMonths(v.frequentiePerJaar)) } : v
      ),
    }));

  const addJaarlijkseBetalingDezeMaand = useCallback((itemId, naam, bedrag) => {
    setState((prev) => {
      const item = prev.vasteJaarlijks.find((v) => v.id === itemId);
      const uitPot = item ? Math.min(item.gespaard, bedrag) : 0;
      const tekort = Math.max(0, bedrag - uitPot);

      const nextVasteJaarlijks = item
        ? prev.vasteJaarlijks.map((v) => (v.id === itemId ? { ...v, gespaard: Math.max(0, v.gespaard - bedrag) } : v))
        : prev.vasteJaarlijks;

      const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, itemId: itemId || null, naam, bedrag, uitPot, tekort };
      const existing = prev.monthly[currentMonth] || { spent: {} };
      const betalingen = [...(existing.jaarlijkseBetalingen || []), entry];

      return {
        ...prev,
        vasteJaarlijks: nextVasteJaarlijks,
        monthly: { ...prev.monthly, [currentMonth]: { ...existing, jaarlijkseBetalingen: betalingen } },
      };
    });
  }, [currentMonth]);

  const removeJaarlijkseBetalingDezeMaand = useCallback((entryId) => {
    setState((prev) => {
      const existing = prev.monthly[currentMonth] || { spent: {} };
      const betalingen = existing.jaarlijkseBetalingen || [];
      const entry = betalingen.find((b) => b.id === entryId);
      if (!entry) return prev;

      const nextVasteJaarlijks = entry.itemId
        ? prev.vasteJaarlijks.map((v) => (v.id === entry.itemId ? { ...v, gespaard: v.gespaard + entry.uitPot } : v))
        : prev.vasteJaarlijks;

      return {
        ...prev,
        vasteJaarlijks: nextVasteJaarlijks,
        monthly: {
          ...prev.monthly,
          [currentMonth]: { ...existing, jaarlijkseBetalingen: betalingen.filter((b) => b.id !== entryId) },
        },
      };
    });
  }, [currentMonth]);

  // ---- NIEUW: zelf bijhouden hoeveel je deze maand opzij zet voor de jaarpotjes ----
  const addStorting = useCallback((itemId, bedrag) => {
    if (!(bedrag > 0)) return;
    setState((prev) => {
      const item = prev.vasteJaarlijks.find((v) => v.id === itemId);
      if (!item) return prev;
      const vasteJaarlijks = prev.vasteJaarlijks.map((v) =>
        v.id === itemId ? { ...v, gespaard: (Number(v.gespaard) || 0) + bedrag } : v
      );
      const existing = prev.monthly[currentMonth] || { spent: {} };
      const entry = { id: newId("storting"), itemId, naam: item.naam, bedrag };
      const stortingen = [...(existing.jaarlijkseStortingen || []), entry];
      return {
        ...prev,
        vasteJaarlijks,
        monthly: { ...prev.monthly, [currentMonth]: { ...existing, jaarlijkseStortingen: stortingen } },
      };
    });
  }, [currentMonth]);

  const removeStorting = useCallback((entryId) => {
    setState((prev) => {
      const existing = prev.monthly[currentMonth] || { spent: {} };
      const stortingen = existing.jaarlijkseStortingen || [];
      const entry = stortingen.find((s) => s.id === entryId);
      if (!entry) return prev;
      const vasteJaarlijks = prev.vasteJaarlijks.map((v) =>
        v.id === entry.itemId ? { ...v, gespaard: Math.max(0, (Number(v.gespaard) || 0) - entry.bedrag) } : v
      );
      return {
        ...prev,
        vasteJaarlijks,
        monthly: {
          ...prev.monthly,
          [currentMonth]: { ...existing, jaarlijkseStortingen: stortingen.filter((s) => s.id !== entryId) },
        },
      };
    });
  }, [currentMonth]);

  // ---- NIEUW: wenslijst met inplanbare uitgaven ----
  const addWishItem = () =>
    setState((prev) => ({
      ...prev,
      wenslijst: [
        ...prev.wenslijst,
        {
          id: newId("wish"), naam: "Nieuwe wens", bedrag: 0, categorieId: prev.variable[0]?.id || "",
          geplandInMaand: null, prioriteit: "gemiddeld", label: "", gekocht: false,
        },
      ],
    }));
  const updateWishItem = (id, field, value) => updateListItem("wenslijst", id, field, value);
  const toggleGekocht = useCallback((id) => {
    setState((prev) => ({
      ...prev,
      wenslijst: prev.wenslijst.map((w) => (w.id === id ? { ...w, gekocht: !w.gekocht } : w)),
    }));
  }, []);
  const removeWishItem = useCallback((id) => {
    setState((prev) => {
      const monthly = { ...prev.monthly };
      Object.keys(monthly).forEach((k) => {
        if ((monthly[k].geplandeUitgaven || []).some((e) => e.wishId === id)) {
          monthly[k] = { ...monthly[k], geplandeUitgaven: monthly[k].geplandeUitgaven.filter((e) => e.wishId !== id) };
        }
      });
      return { ...prev, monthly, wenslijst: prev.wenslijst.filter((w) => w.id !== id) };
    });
  }, []);

  const toggleWishPlanning = useCallback((item) => {
    setState((prev) => {
      const monthly = { ...prev.monthly };
      if (item.geplandInMaand && monthly[item.geplandInMaand]) {
        monthly[item.geplandInMaand] = {
          ...monthly[item.geplandInMaand],
          geplandeUitgaven: (monthly[item.geplandInMaand].geplandeUitgaven || []).filter((e) => e.wishId !== item.id),
        };
      }
      let wenslijst;
      if (item.geplandInMaand === currentMonth) {
        wenslijst = prev.wenslijst.map((w) => (w.id === item.id ? { ...w, geplandInMaand: null } : w));
      } else {
        const existing = monthly[currentMonth] || { spent: {} };
        const entry = { id: newId("plan"), wishId: item.id, naam: item.naam, bedrag: Number(item.bedrag) || 0, categorieId: item.categorieId || null };
        monthly[currentMonth] = { ...existing, geplandeUitgaven: [...(existing.geplandeUitgaven || []), entry] };
        wenslijst = prev.wenslijst.map((w) => (w.id === item.id ? { ...w, geplandInMaand: currentMonth } : w));
      }
      return { ...prev, monthly, wenslijst };
    });
  }, [currentMonth]);

  // ---- NIEUW: bank-import in bulk verwerken + trefwoorden onthouden ----
  const importSpentBulk = useCallback((sumsByCat) => {
    setState((prev) => {
      const existing = prev.monthly[currentMonth] || { spent: {} };
      const nextSpent = { ...existing.spent };
      Object.entries(sumsByCat).forEach(([catId, bedrag]) => {
        nextSpent[catId] = (Number(nextSpent[catId]) || 0) + (Number(bedrag) || 0);
      });
      return { ...prev, monthly: { ...prev.monthly, [currentMonth]: { ...existing, spent: nextSpent } } };
    });
  }, [currentMonth]);

  const addKeywordToCategorie = useCallback((catId, keyword) => {
    const kw = (keyword || "").trim().toLowerCase();
    if (!kw) return;
    setState((prev) => ({
      ...prev,
      variable: prev.variable.map((c) =>
        c.id === catId ? { ...c, keywords: Array.from(new Set([...(c.keywords || []), kw])) } : c
      ),
    }));
  }, []);

  const updateGoal = (id, field, value) =>
    setState((prev) => ({ ...prev, goals: prev.goals.map((g) => (g.id === id ? { ...g, [field]: value } : g)) }));

  const addGoal = () =>
    setState((prev) => ({
      ...prev,
      goals: [
        ...prev.goals,
        { id: `goal-${Date.now()}`, naam: "Nieuw spaardoel", doel: 0, algespaard: 0, deadline: today },
      ],
    }));

  const removeGoal = (id) =>
    setState((prev) => ({ ...prev, goals: prev.goals.filter((g) => g.id !== id) }));

  const updatePayPeriodStartDay = (value) =>
    setState((prev) => ({ ...prev, payPeriodStartDay: Math.min(28, Math.max(1, value)) }));

  if (loading || !state) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, fontFamily: "Inter, sans-serif", color: "#6B6353" }}>
        Budget laden…
      </div>
    );
  }

  const totaalInkomen = state.income.reduce((s, i) => s + (Number(i.bedrag) || 0), 0);
  const vasteMaandelijksTotaal = state.vasteMaandelijks.reduce((s, v) => s + (Number(v.bedrag) || 0), 0);

  const today = new Date().toISOString().slice(0, 10);
  const jaarlijksReservering = (item) => {
    const resterend = Math.max(0, (Number(item.bedrag) || 0) - (Number(item.gespaard) || 0));
    const maanden = Math.max(1, monthsBetween(today, item.verwachteDatum));
    return resterend / maanden;
  };
  const jaarlijksPotTotaal = state.vasteJaarlijks.reduce((s, v) => s + jaarlijksReservering(v), 0);

  const vasteTotaal = vasteMaandelijksTotaal + jaarlijksPotTotaal;

  const variabelBudgetTotaal = state.variable.reduce((s, c) => s + (Number(c.budget) || 0), 0);
  const variabelBestedTotaal = maandVariabelTotaal(monthData);
  const jaarlijkseTekortDezeMaand = (monthData.jaarlijkseBetalingen || []).reduce((s, b) => s + (Number(b.tekort) || 0), 0);
  const jaarlijksGestortDezeMaand = (monthData.jaarlijkseStortingen || []).reduce((s, e) => s + (Number(e.bedrag) || 0), 0);
  const sparenDezeMaand = totaalInkomen - vasteTotaal - variabelBestedTotaal - jaarlijkseTekortDezeMaand;

  const monthsWithData = Object.keys(state.monthly).filter(
    (k) =>
      Object.keys(state.monthly[k].spent || {}).length > 0 ||
      (state.monthly[k].jaarlijkseBetalingen || []).length > 0 ||
      (state.monthly[k].geplandeUitgaven || []).length > 0
  );
  const gemSparen =
    monthsWithData.length > 0
      ? monthsWithData.reduce((sum, k) => {
          const variabelSom = maandVariabelTotaal(state.monthly[k]);
          const tekortSom = (state.monthly[k].jaarlijkseBetalingen || []).reduce((a, b) => a + (Number(b.tekort) || 0), 0);
          return sum + (totaalInkomen - vasteTotaal - variabelSom - tekortSom);
        }, 0) / monthsWithData.length
      : sparenDezeMaand;

  const maandenMetStorting = Object.keys(state.monthly).filter((k) => (state.monthly[k].jaarlijkseStortingen || []).length > 0);
  const gemStortingPerMaand =
    maandenMetStorting.length > 0
      ? maandenMetStorting.reduce(
          (sum, k) => sum + (state.monthly[k].jaarlijkseStortingen || []).reduce((a, e) => a + (Number(e.bedrag) || 0), 0),
          0
        ) / maandenMetStorting.length
      : 0;

  const trendData = Object.keys(state.monthly)
    .sort()
    .map((k) => {
      const entry = state.monthly[k];
      const variabelSom = maandVariabelTotaal(entry);
      const tekortSom = (entry.jaarlijkseBetalingen || []).reduce((a, b) => a + (Number(b.tekort) || 0), 0);
      const gestortSom = (entry.jaarlijkseStortingen || []).reduce((a, e) => a + (Number(e.bedrag) || 0), 0);
      const sparen = totaalInkomen - vasteTotaal - variabelSom - tekortSom;
      return {
        maand: periodLabel(k, state.payPeriodStartDay).split(" – ")[0],
        key: k,
        uitgaven: Math.round(variabelSom * 100) / 100,
        sparen: Math.round(sparen * 100) / 100,
        gestort: Math.round(gestortSom * 100) / 100,
      };
    });

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#F7F5F0", minHeight: "100%", padding: "20px 16px 60px", color: "#1F2937" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; }
        .btab { cursor:pointer; border:none; background:transparent; font-family:'Inter',sans-serif; }
        .btab:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid #0F5C52; outline-offset: 2px; }
        .num-input {
          font-family: 'IBM Plex Mono', monospace;
          border: 1px solid #D8D2C4;
          border-radius: 8px;
          padding: 6px 8px;
          width: 96px;
          text-align: right;
          font-size: 14px;
          background: #FBFAF6;
        }
        .num-input:focus { border-color:#0F5C52; }
        .date-input {
          border: 1px solid #D8D2C4;
          border-radius: 8px;
          padding: 5px 7px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12px;
          background: #FBFAF6;
        }
      `}</style>

      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 26, letterSpacing: -0.5 }}>Huishoudboekje</div>
            <div style={{ fontSize: 12.5, color: notConfigured || saveStatus === "error" ? "#B3492A" : "#8A8171", marginTop: 2 }}>
              {notConfigured ? "niet opgeslagen — alleen in deze sessie onthouden" : saveStatus === "saving" ? "opslaan…" : saveStatus === "error" ? "opslaan mislukt" : "opgeslagen"}
            </div>
          </div>
          <Wallet size={26} color="#0F5C52" strokeWidth={1.6} />
        </div>

        {notConfigured && (
          <div style={{ background: "#FBEAE3", border: "1px solid #E8C4B3", borderRadius: 12, padding: "12px 14px", marginBottom: 18, fontSize: 12.5, color: "#7A3A22" }}>
            <strong>Opslag nog niet beschikbaar.</strong> Je gegevens worden nu alleen in deze sessie onthouden en zijn weg na het herladen.
          </div>
        )}

        <div style={{ display: "flex", gap: 4, marginBottom: 18, background: "#EFEAE0", padding: 4, borderRadius: 12, flexWrap: "wrap" }}>
          {[
            { id: "maand", label: "Deze maand", icon: TrendingUp },
            { id: "wenslijst", label: "Wenslijst", icon: ShoppingCart },
            { id: "overzicht", label: "Overzicht", icon: Activity },
            { id: "doelen", label: "Spaardoelen", icon: Plane },
            { id: "rekeningen", label: "Spaarrekeningen", icon: Landmark },
            { id: "vast", label: "Vaste lasten", icon: Home },
            { id: "instellingen", label: "Instellingen", icon: Settings },
          ].map((t) => (
            <button
              key={t.id}
              className="btab"
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, minWidth: 88, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "9px 6px", borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                color: tab === t.id ? "#FFFFFF" : "#6B6353",
                background: tab === t.id ? "#0F5C52" : "transparent",
                transition: "all 150ms ease",
              }}
            >
              <t.icon size={14} />
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
        </div>

        {tab === "maand" && (
          <MaandTab
            state={state}
            currentMonth={currentMonth}
            setCurrentMonth={setCurrentMonth}
            monthData={monthData}
            setSpent={setSpent}
            vasteTotaal={vasteTotaal}
            totaalInkomen={totaalInkomen}
            variabelBudgetTotaal={variabelBudgetTotaal}
            variabelBestedTotaal={variabelBestedTotaal}
            sparenDezeMaand={sparenDezeMaand}
            jaarlijkseTekortDezeMaand={jaarlijkseTekortDezeMaand}
            jaarlijksGestortDezeMaand={jaarlijksGestortDezeMaand}
            jaarlijksPotTotaal={jaarlijksPotTotaal}
            jaarlijksReservering={jaarlijksReservering}
            addJaarlijkseBetalingDezeMaand={addJaarlijkseBetalingDezeMaand}
            removeJaarlijkseBetalingDezeMaand={removeJaarlijkseBetalingDezeMaand}
            addStorting={addStorting}
            removeStorting={removeStorting}
            wenslijst={state.wenslijst}
            toggleWishPlanning={toggleWishPlanning}
            importSpentBulk={importSpentBulk}
            addKeywordToCategorie={addKeywordToCategorie}
          />
        )}

        {tab === "wenslijst" && (
          <WenslijstTab
            wenslijst={state.wenslijst}
            variable={state.variable}
            currentMonth={currentMonth}
            payPeriodStartDay={state.payPeriodStartDay}
            addWishItem={addWishItem}
            updateWishItem={updateWishItem}
            removeWishItem={removeWishItem}
            toggleWishPlanning={toggleWishPlanning}
            toggleGekocht={toggleGekocht}
          />
        )}

        {tab === "overzicht" && (
          <OverzichtTab
            trendData={trendData}
            vasteJaarlijks={state.vasteJaarlijks}
            goals={state.goals}
            gemSparen={gemSparen}
            today={today}
          />
        )}

        {tab === "doelen" && <DoelenTab goals={state.goals} updateGoal={updateGoal} gemSparen={gemSparen} today={today} />}

        {tab === "rekeningen" && (
          <RekeningenTab
            savingsAccounts={state.savingsAccounts}
            updateSavingsAccount={updateSavingsAccount}
            addSavingsAccount={addSavingsAccount}
            removeSavingsAccount={removeSavingsAccount}
          />
        )}

        {tab === "vast" && (
          <VastTab
            vasteMaandelijks={state.vasteMaandelijks}
            vasteMaandelijksTotaal={vasteMaandelijksTotaal}
            vasteJaarlijks={state.vasteJaarlijks}
            jaarlijksReservering={jaarlijksReservering}
            jaarlijksPotTotaal={jaarlijksPotTotaal}
            gemStortingPerMaand={gemStortingPerMaand}
            totaalInkomen={totaalInkomen}
            variabelBudgetTotaal={variabelBudgetTotaal}
            today={today}
          />
        )}

        {tab === "instellingen" && (
          <InstellingenTab
            state={state}
            updateIncome={updateIncome}
            addIncome={addIncome}
            removeIncome={removeIncome}
            updateVariable={updateVariable}
            addVariable={addVariable}
            removeVariable={removeVariable}
            updateVasteMaandelijks={updateVasteMaandelijks}
            addVasteMaandelijks={addVasteMaandelijks}
            removeVasteMaandelijks={removeVasteMaandelijks}
            updateVasteJaarlijks={updateVasteJaarlijks}
            addVasteJaarlijks={addVasteJaarlijks}
            removeVasteJaarlijks={removeVasteJaarlijks}
            markJaarlijksBetaald={markJaarlijksBetaald}
            updatePayPeriodStartDay={updatePayPeriodStartDay}
            updateGoal={updateGoal}
            addGoal={addGoal}
            removeGoal={removeGoal}
            today={today}
          />
        )}
      </div>
    </div>
  );
}

// ---------- tabs ----------

function JaarpotSparenCard({ vasteJaarlijks, jaarlijksReservering, jaarlijksPotTotaal, jaarlijksGestortDezeMaand, stortingen, addStorting, removeStorting }) {
  const [openId, setOpenId] = useState(null);
  const [bedragInput, setBedragInput] = useState("");

  const openFor = (item) => {
    setOpenId(item.id);
    const aanbevolen = jaarlijksReservering(item);
    setBedragInput(String(Math.round(aanbevolen * 100) / 100));
  };

  const handleAdd = (itemId) => {
    const bedrag = parseFloat(bedragInput) || 0;
    if (bedrag <= 0) return;
    addStorting(itemId, bedrag);
    setOpenId(null);
    setBedragInput("");
  };

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 20px 4px" }}>
        <PiggyBank size={16} color="#0F5C52" />
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15 }}>Sparen voor jaarlijkse lasten</div>
      </div>
      <div style={{ fontSize: 11.5, color: "#8A8171", padding: "0 20px 10px" }}>
        Houd hier zelf bij hoeveel je deze maand opzij zet. De aanbevolen reservering is een richtlijn op basis van bedrag, datum en frequentie — jij bepaalt wat je daadwerkelijk stort.
      </div>
      <div>
        {vasteJaarlijks.map((v) => {
          const aanbevolen = jaarlijksReservering(v);
          const pct = v.bedrag > 0 ? (v.gespaard / v.bedrag) * 100 : 0;
          return (
            <div key={v.id} style={{ padding: "10px 20px", borderTop: "1px solid #EEE9DD" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{v.naam}</div>
                <div style={{ fontSize: 11.5, color: "#8A8171", fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(v.gespaard)} / {fmt(v.bedrag)}</div>
              </div>
              <div style={{ marginTop: 6 }}>
                <ProgressBar pct={pct} tone={pct >= 100 ? "ok" : "warn"} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <span style={{ fontSize: 11, color: "#8A8171" }}>aanbevolen: {fmt2(aanbevolen)}/mnd</span>
                {openId !== v.id && (
                  <button className="btab" onClick={() => openFor(v)} style={{ fontSize: 11, fontWeight: 600, color: "#0F5C52", border: "1px solid #CFE3DC", borderRadius: 8, padding: "4px 9px" }}>
                    + zet apart
                  </button>
                )}
              </div>
              {openId === v.id && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <input className="num-input" style={{ width: 84 }} type="number" value={bedragInput} onChange={(e) => setBedragInput(e.target.value)} />
                  <button className="btab" onClick={() => handleAdd(v.id)} style={{ fontSize: 12, fontWeight: 600, color: "#FFFFFF", background: "#0F5C52", borderRadius: 8, padding: "6px 11px" }}>
                    Bewaren
                  </button>
                  <button className="btab" onClick={() => setOpenId(null)} style={{ fontSize: 11.5, color: "#8A8171" }}>
                    annuleer
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {vasteJaarlijks.length === 0 && <div style={{ padding: "0 20px 14px", fontSize: 12, color: "#B8AF9C" }}>Nog geen jaarlijkse lasten ingesteld.</div>}
      </div>
      <div style={{ borderTop: "1px solid #EEE9DD", padding: "10px 20px", display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
        <span>Gestort deze maand</span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: jaarlijksGestortDezeMaand >= jaarlijksPotTotaal ? "#2F7A5C" : "#C08A2E" }}>
          {fmt2(jaarlijksGestortDezeMaand)} / {fmt2(jaarlijksPotTotaal)}
        </span>
      </div>
      {stortingen.length > 0 && (
        <div style={{ borderTop: "1px solid #EEE9DD" }}>
          {stortingen.map((s) => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 20px", borderBottom: "1px solid #EEE9DD" }}>
              <span style={{ fontSize: 12.5 }}>{s.naam} · {fmt2(s.bedrag)}</span>
              <button className="btab" onClick={() => removeStorting(s.id)} style={{ fontSize: 11, color: "#8A8171" }}>
                verwijder
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function GeplandeUitgavenCard({ entries, wenslijst, toggleWishPlanning, variable }) {
  if (!entries || entries.length === 0) return null;
  const categorieNaam = (id) => variable.find((c) => c.id === id)?.naam;
  const totaal = entries.reduce((s, e) => s + (Number(e.bedrag) || 0), 0);
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 20px 6px" }}>
        <ShoppingCart size={16} color="#0F5C52" />
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15, flex: 1 }}>Geplande uitgaven deze maand</div>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: "#8A8171" }}>{fmt2(totaal)}</span>
      </div>
      <div style={{ fontSize: 11, color: "#8A8171", padding: "0 20px 8px" }}>
        Vanuit je wenslijst ingepland — telt automatisch mee bij je uitgaven per categorie hieronder.
      </div>
      <div>
        {entries.map((e) => (
          <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderTop: "1px solid #EEE9DD" }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{e.naam}</div>
              <div style={{ fontSize: 11, color: "#8A8171" }}>
                {fmt2(e.bedrag)}{e.categorieId ? ` · ${categorieNaam(e.categorieId) || "categorie"}` : " · geen categorie"}
              </div>
            </div>
            <button
              className="btab"
              onClick={() => {
                const wish = wenslijst.find((w) => w.id === e.wishId);
                if (wish) toggleWishPlanning(wish);
              }}
              style={{ fontSize: 11, color: "#8A8171" }}
            >
              annuleer
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ImportUitgavenCard({ variable, currentMonth, payPeriodStartDay, importSpentBulk, addKeywordToCategorie }) {
  const [open, setOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setRawText(String(reader.result || ""));
    reader.readAsText(file);
  };

  const analyseer = () => {
    if (!rawText.trim()) return;
    let parsed = parseBankCSV(rawText);
    if (!parsed || parsed.length === 0) parsed = parsePlainText(rawText);
    const uitgaven = (parsed || []).filter((r) => r.bedrag < 0);
    setRows(
      uitgaven.map((r, i) => ({
        id: `imp-${i}`,
        datum: r.datum,
        omschrijving: r.omschrijving,
        bedrag: Math.abs(r.bedrag),
        categorieId: matchCategorie(r.omschrijving, variable),
        include: true,
      }))
    );
  };

  const updateRow = (id, field, value) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const totalenPerCategorie = useMemo(() => {
    if (!rows) return {};
    const sums = {};
    rows.filter((r) => r.include && r.categorieId).forEach((r) => {
      sums[r.categorieId] = (sums[r.categorieId] || 0) + (Number(r.bedrag) || 0);
    });
    return sums;
  }, [rows]);

  const verwerk = () => {
    if (!rows) return;
    importSpentBulk(totalenPerCategorie);
    setRows(null);
    setRawText("");
    setFileName("");
    setOpen(false);
  };

  const categorieNaam = (id) => variable.find((c) => c.id === id)?.naam;

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 6px" }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15 }}>Bank-uitgaven importeren</div>
        <button className="btab" onClick={() => setOpen((o) => !o)} style={{ fontSize: 12, fontWeight: 600, color: "#0F5C52", border: "1px solid #CFE3DC", borderRadius: 8, padding: "5px 10px" }}>
          {open ? "Sluiten" : "+ Importeren"}
        </button>
      </div>
      {!open && (
        <div style={{ padding: "0 20px 16px", fontSize: 11.5, color: "#8A8171" }}>
          Upload een CSV-export van je bank, of plak transacties — ook gekopieerd uit een PDF-afschrift — en de app koppelt ze automatisch aan een categorie.
        </div>
      )}
      {open && (
        <div style={{ padding: "6px 20px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {!rows && (
            <>
              <div style={{ fontSize: 11.5, color: "#8A8171" }}>
                Kies een CSV-bestand van je bank, of plak losse transactieregels. Elke regel eindigt met een bedrag; de rest wordt gezien als omschrijving.
              </div>
              <input type="file" accept=".csv,text/csv,text/plain" onChange={handleFile} style={{ fontSize: 12 }} />
              {fileName && <div style={{ fontSize: 11, color: "#8A8171" }}>{fileName} geladen</div>}
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={"Of plak hier transacties, bijv.:\nAlbert Heijn 1234        23,45\nNS Groningen             12,00"}
                rows={5}
                style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, border: "1px solid #D8D2C4", borderRadius: 8, padding: 8, background: "#FBFAF6" }}
              />
              <button
                className="btab"
                onClick={analyseer}
                disabled={!rawText.trim()}
                style={{ alignSelf: "flex-start", fontSize: 12.5, fontWeight: 600, color: "#FFFFFF", background: rawText.trim() ? "#0F5C52" : "#B8AF9C", borderRadius: 8, padding: "7px 14px" }}
              >
                Analyseer transacties
              </button>
            </>
          )}

          {rows && (
            <>
              <div style={{ fontSize: 11.5, color: "#8A8171" }}>
                {rows.length} uitgaven gevonden. Controleer de categorie per transactie voordat je ze verwerkt in {periodLabel(currentMonth, payPeriodStartDay)}.
              </div>
              <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #EEE9DD", borderRadius: 8 }}>
                {rows.map((r) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderBottom: "1px solid #EEE9DD" }}>
                    <input type="checkbox" checked={r.include} onChange={(e) => updateRow(r.id, "include", e.target.checked)} style={{ accentColor: "#0F5C52" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.omschrijving}</div>
                      <div style={{ fontSize: 10.5, color: "#8A8171" }}>{fmt2(r.bedrag)}{r.datum ? ` · ${r.datum}` : ""}</div>
                    </div>
                    <select
                      value={r.categorieId || ""}
                      onChange={(e) => updateRow(r.id, "categorieId", e.target.value)}
                      style={{ fontSize: 11.5, border: "1px solid #D8D2C4", borderRadius: 6, padding: "4px 6px", background: "#FBFAF6" }}
                    >
                      <option value="">geen categorie</option>
                      {variable.map((c) => (
                        <option key={c.id} value={c.id}>{c.naam}</option>
                      ))}
                    </select>
                    {r.categorieId && (
                      <button
                        className="btab"
                        title="Onthoud dit trefwoord voor deze categorie"
                        onClick={() => addKeywordToCategorie(r.categorieId, r.omschrijving.split(/\s+/).slice(0, 2).join(" "))}
                        style={{ fontSize: 10.5, color: "#0F5C52" }}
                      >
                        onthoud
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 12, color: "#3A362E" }}>
                {Object.entries(totalenPerCategorie).map(([catId, bedrag]) => (
                  <div key={catId} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{categorieNaam(catId) || "onbekend"}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{fmt2(bedrag)}</span>
                  </div>
                ))}
                {Object.keys(totalenPerCategorie).length === 0 && (
                  <div style={{ color: "#B8AF9C" }}>Nog geen transacties met een categorie geselecteerd.</div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btab" onClick={verwerk} style={{ fontSize: 12.5, fontWeight: 600, color: "#FFFFFF", background: "#0F5C52", borderRadius: 8, padding: "7px 14px" }}>
                  Verwerk in {periodLabel(currentMonth, payPeriodStartDay)}
                </button>
                <button className="btab" onClick={() => setRows(null)} style={{ fontSize: 12, color: "#8A8171" }}>
                  opnieuw
                </button>
              </div>
              <div style={{ fontSize: 10.5, color: "#8A8171" }}>
                Bedragen worden opgeteld bij wat je al had ingevuld bij "Budget per categorie" — vul dezelfde uitgaven dus niet nogmaals handmatig in.
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function OverzichtTab({ trendData, vasteJaarlijks, goals, gemSparen, today }) {
  const jaarpotWaarschuwingen = vasteJaarlijks
    .map((v) => ({ item: v, status: jaarpotStatus(v, today) }))
    .filter((x) => x.status.achterstand);
  const goalWaarschuwingen = goals
    .map((g) => ({ goal: g, status: goalStatus(g, gemSparen, today) }))
    .filter((x) => !x.status.opSchema);
  const geenWaarschuwingen = jaarpotWaarschuwingen.length === 0 && goalWaarschuwingen.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {!geenWaarschuwingen && (
        <Card style={{ borderColor: "#E8C4B3" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <AlertTriangle size={18} color="#B3492A" />
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16 }}>Waarschuwingen</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {jaarpotWaarschuwingen.map(({ item, status }) => (
              <div key={item.id} style={{ fontSize: 12.5, color: "#7A3A22", background: "#FBEAE3", borderRadius: 8, padding: "9px 11px" }}>
                <strong>{item.naam}</strong> loopt achter: {status.actueelPct.toFixed(0)}% gespaard, verwacht was ~{status.verwachtPct.toFixed(0)}%. Nog {fmt2(status.tekort)} in te halen.
              </div>
            ))}
            {goalWaarschuwingen.map(({ goal, status }) => (
              <div key={goal.id} style={{ fontSize: 12.5, color: "#7A3A22", background: "#FBEAE3", borderRadius: 8, padding: "9px 11px" }}>
                <strong>{goal.naam}</strong> ligt niet op schema: nodig is {fmt2(status.benodigdPerMaand)}/mnd, je spaart gemiddeld {fmt2(gemSparen)}/mnd.
              </div>
            ))}
          </div>
        </Card>
      )}
      {geenWaarschuwingen && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Check size={16} color="#2F7A5C" />
            <div style={{ fontSize: 13 }}>Je jaarpotjes en spaardoelen liggen op schema.</div>
          </div>
        </Card>
      )}

      <Card>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Trend: uitgaven &amp; sparen per maand</div>
        <div style={{ fontSize: 11.5, color: "#8A8171", marginBottom: 10 }}>Gebaseerd op de maanden waarin je gegevens hebt ingevuld.</div>
        {trendData.length === 0 ? (
          <div style={{ fontSize: 12, color: "#B8AF9C" }}>Nog geen gegevens. Vul eerst een paar maanden in bij "Deze maand".</div>
        ) : (
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEE9DD" />
                <XAxis dataKey="maand" tick={{ fontSize: 10, fill: "#8A8171" }} />
                <YAxis tick={{ fontSize: 10, fill: "#8A8171" }} />
                <Tooltip formatter={(v) => fmt2(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="uitgaven" name="Variabele uitgaven" stroke="#B3492A" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="sparen" name="Gespaard" stroke="#2F7A5C" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="gestort" name="Gestort jaarpotjes" stroke="#0F5C52" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}

function MaandTab({
  state, currentMonth, setCurrentMonth, monthData, setSpent, vasteTotaal, totaalInkomen,
  variabelBudgetTotaal, variabelBestedTotaal, sparenDezeMaand, jaarlijkseTekortDezeMaand,
  jaarlijksGestortDezeMaand, jaarlijksPotTotaal, jaarlijksReservering,
  addJaarlijkseBetalingDezeMaand, removeJaarlijkseBetalingDezeMaand,
  addStorting, removeStorting, wenslijst, toggleWishPlanning,
  importSpentBulk, addKeywordToCategorie,
}) {
  const pctVariabel = variabelBudgetTotaal > 0 ? (variabelBestedTotaal / variabelBudgetTotaal) * 100 : 0;
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState(state.vasteJaarlijks[0]?.id || "custom");
  const [customNaam, setCustomNaam] = useState("");
  const [bedragInput, setBedragInput] = useState("");

  const selectedItem = state.vasteJaarlijks.find((v) => v.id === selectedId);

  useEffect(() => {
    if (selectedItem) {
      setBedragInput(String(Math.round(selectedItem.bedrag * 100) / 100));
    } else {
      setBedragInput("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleAdd = () => {
    const bedrag = parseFloat(bedragInput) || 0;
    if (bedrag <= 0) return;
    const naam = selectedId === "custom" ? (customNaam.trim() || "Overige jaarlijkse last") : selectedItem?.naam || "Jaarlijkse last";
    addJaarlijkseBetalingDezeMaand(selectedId === "custom" ? null : selectedId, naam, bedrag);
    setShowAdd(false);
    setCustomNaam("");
  };

  const betalingen = monthData.jaarlijkseBetalingen || [];
  const geplandeUitgaven = monthData.geplandeUitgaven || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button className="btab" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))} style={{ padding: 8, borderRadius: 8, color: "#0F5C52" }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600 }}>{periodLabel(currentMonth, state.payPeriodStartDay)}</div>
          <div style={{ fontSize: 10.5, color: "#B8AF9C" }}>loonperiode (25e t/m 24e)</div>
        </div>
        <button className="btab" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} style={{ padding: 8, borderRadius: 8, color: "#0F5C52" }}>
          <ChevronRight size={20} />
        </button>
      </div>

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <SummaryStat label="Inkomen" value={fmt(totaalInkomen)} color="#1F2937" />
          <SummaryStat label="Vaste lasten (incl. jaarpotjes)" value={fmt2(vasteTotaal)} color="#6B6353" />
          <SummaryStat
            label="Variabel besteed"
            value={fmt2(variabelBestedTotaal)}
            sub={`van ${fmt(variabelBudgetTotaal)} budget`}
            color={variabelBestedTotaal > variabelBudgetTotaal ? "#B3492A" : "#1F2937"}
          />
          <SummaryStat
            label={sparenDezeMaand >= 0 ? "Sparen deze maand" : "Tekort deze maand"}
            value={fmt2(Math.abs(sparenDezeMaand))}
            color={sparenDezeMaand >= 0 ? "#2F7A5C" : "#B3492A"}
          />
          <SummaryStat
            label="Gestort jaarpotjes"
            value={fmt2(jaarlijksGestortDezeMaand)}
            sub={`aanbevolen ${fmt2(jaarlijksPotTotaal)}`}
            color={jaarlijksGestortDezeMaand >= jaarlijksPotTotaal ? "#2F7A5C" : "#C08A2E"}
          />
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#8A8171", marginBottom: 4 }}>
            <span>Totaal variabel budget</span>
            <span>{pctVariabel.toFixed(0)}%</span>
          </div>
          <ProgressBar pct={pctVariabel} tone={pctVariabel > 100 ? "over" : pctVariabel > 85 ? "warn" : "ok"} />
        </div>
        {jaarlijkseTekortDezeMaand > 0.005 && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#B3492A", display: "flex", alignItems: "center", gap: 4 }}>
            <AlertTriangle size={12} /> {fmt2(jaarlijkseTekortDezeMaand)} extra uit deze maand betaald (potje was niet vol)
          </div>
        )}
      </Card>

      <JaarpotSparenCard
        vasteJaarlijks={state.vasteJaarlijks}
        jaarlijksReservering={jaarlijksReservering}
        jaarlijksPotTotaal={jaarlijksPotTotaal}
        jaarlijksGestortDezeMaand={jaarlijksGestortDezeMaand}
        stortingen={monthData.jaarlijkseStortingen || []}
        addStorting={addStorting}
        removeStorting={removeStorting}
      />

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 6px" }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15 }}>Jaarlijkse vaste last deze maand</div>
          <button
            className="btab"
            onClick={() => setShowAdd((s) => !s)}
            style={{ fontSize: 12, fontWeight: 600, color: "#0F5C52", border: "1px solid #CFE3DC", borderRadius: 8, padding: "5px 10px" }}
          >
            {showAdd ? "Sluiten" : "+ Toevoegen"}
          </button>
        </div>

        {showAdd && (
          <div style={{ padding: "6px 20px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, border: "1px solid #D8D2C4", borderRadius: 8, padding: "7px 8px", background: "#FBFAF6" }}
            >
              {state.vasteJaarlijks.map((v) => (
                <option key={v.id} value={v.id}>{v.naam} (potje: {fmt(v.gespaard)})</option>
              ))}
              <option value="custom">Andere / eenmalige jaarlijkse last…</option>
            </select>

            {selectedId === "custom" && (
              <input
                type="text"
                placeholder="Naam"
                value={customNaam}
                onChange={(e) => setCustomNaam(e.target.value)}
                style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, border: "1px solid #D8D2C4", borderRadius: 8, padding: "7px 8px", background: "#FBFAF6" }}
              />
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12.5, color: "#8A8171" }}>Bedrag</span>
              <input className="num-input" type="number" value={bedragInput} onChange={(e) => setBedragInput(e.target.value)} />
              <button
                className="btab"
                onClick={handleAdd}
                style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 600, color: "#FFFFFF", background: "#0F5C52", borderRadius: 8, padding: "7px 12px" }}
              >
                Toevoegen
              </button>
            </div>
            {selectedItem && (
              <div style={{ fontSize: 11, color: "#8A8171" }}>
                Er zit {fmt(selectedItem.gespaard)} in dit potje — {parseFloat(bedragInput) > selectedItem.gespaard ? `${fmt2(parseFloat(bedragInput || 0) - selectedItem.gespaard)} komt boven op je budget deze maand.` : "dit past volledig binnen het potje."}
              </div>
            )}
          </div>
        )}

        {betalingen.length > 0 && (
          <div style={{ borderTop: "1px solid #EEE9DD" }}>
            {betalingen.map((b) => (
              <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderBottom: "1px solid #EEE9DD" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{b.naam}</div>
                  <div style={{ fontSize: 11, color: b.tekort > 0.005 ? "#B3492A" : "#8A8171" }}>
                    {fmt2(b.bedrag)} betaald{b.uitPot > 0.005 ? ` · ${fmt2(b.uitPot)} uit potje` : ""}{b.tekort > 0.005 ? ` · ${fmt2(b.tekort)} extra` : ""}
                  </div>
                </div>
                <button className="btab" onClick={() => removeJaarlijkseBetalingDezeMaand(b.id)} style={{ fontSize: 11, color: "#8A8171" }}>
                  verwijder
                </button>
              </div>
            ))}
          </div>
        )}
        {betalingen.length === 0 && !showAdd && (
          <div style={{ padding: "0 20px 16px", fontSize: 12, color: "#B8AF9C" }}>Geen jaarlijkse lasten gelogd deze maand.</div>
        )}
      </Card>

      <GeplandeUitgavenCard entries={geplandeUitgaven} wenslijst={wenslijst} toggleWishPlanning={toggleWishPlanning} variable={state.variable} />

      <ImportUitgavenCard
        variable={state.variable}
        currentMonth={currentMonth}
        payPeriodStartDay={state.payPeriodStartDay}
        importSpentBulk={importSpentBulk}
        addKeywordToCategorie={addKeywordToCategorie}
      />

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px 6px", fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15 }}>Budget per categorie</div>
        <div>
          {state.variable.map((cat) => {
            const handmatig = Number(monthData.spent[cat.id]) || 0;
            const gepland = geplandeUitgaven.filter((e) => e.categorieId === cat.id).reduce((a, e) => a + (Number(e.bedrag) || 0), 0);
            const spent = handmatig + gepland;
            const pct = cat.budget > 0 ? (spent / cat.budget) * 100 : 0;
            const tone = pct > 100 ? "over" : pct > 85 ? "warn" : "ok";
            const over = spent - cat.budget;
            return (
              <div key={cat.id} style={{ padding: "12px 20px", borderTop: "1px solid #EEE9DD" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{cat.naam}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#8A8171" }}>/ {fmt(cat.budget)}</span>
                    <input
                      className="num-input"
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={monthData.spent[cat.id] ?? ""}
                      placeholder="0"
                      onChange={(e) => setSpent(cat.id, e.target.value === "" ? 0 : parseFloat(e.target.value))}
                    />
                  </div>
                </div>
                <ProgressBar pct={pct} tone={tone} />
                {gepland > 0.005 && (
                  <div style={{ fontSize: 10.5, color: "#8A8171", marginTop: 4 }}>waarvan {fmt2(gepland)} gepland (wenslijst)</div>
                )}
                {over > 0.005 && (
                  <div style={{ fontSize: 11.5, color: "#B3492A", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                    <AlertTriangle size={11} /> {fmt2(over)} boven budget
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

const PRIORITEIT_LABELS = { hoog: "Moet", gemiddeld: "Leuk", laag: "Kan wachten" };
const PRIORITEIT_KLEUR = { hoog: { bg: "#FBEAE3", fg: "#B3492A" }, gemiddeld: { bg: "#FCF3DC", fg: "#8A6A1F" }, laag: { bg: "#EFEAE0", fg: "#6B6353" } };
const PRIORITEIT_RANG = { hoog: 0, gemiddeld: 1, laag: 2 };

function WenslijstTab({ wenslijst, variable, currentMonth, payPeriodStartDay, addWishItem, updateWishItem, removeWishItem, toggleWishPlanning, toggleGekocht }) {
  const [filter, setFilter] = useState("alles");
  const totaal = wenslijst.reduce((s, w) => s + (Number(w.bedrag) || 0), 0);
  const gepandDezeMaand = wenslijst.filter((w) => w.geplandInMaand === currentMonth).reduce((s, w) => s + (Number(w.bedrag) || 0), 0);

  const gefilterd = wenslijst
    .filter((w) => {
      if (filter === "open") return !w.gekocht && w.geplandInMaand !== currentMonth;
      if (filter === "gepland") return !w.gekocht && w.geplandInMaand === currentMonth;
      if (filter === "gekocht") return w.gekocht;
      return true;
    })
    .slice()
    .sort((a, b) => (PRIORITEIT_RANG[a.prioriteit] ?? 1) - (PRIORITEIT_RANG[b.prioriteit] ?? 1));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShoppingCart size={20} color="#0F5C52" />
          <div>
            <div style={{ fontSize: 12.5, color: "#8A8171" }}>Totale waarde wenslijst</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 19, fontWeight: 600 }}>{fmt2(totaal)}</div>
            <div style={{ fontSize: 11, color: "#8A8171", marginTop: 2 }}>
              waarvan {fmt2(gepandDezeMaand)} ingepland voor {periodLabel(currentMonth, payPeriodStartDay)}
            </div>
          </div>
        </div>
      </Card>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[
          { id: "alles", label: "Alles" },
          { id: "open", label: "Nog te plannen" },
          { id: "gepland", label: "Gepland" },
          { id: "gekocht", label: "Gekocht" },
        ].map((f) => (
          <button
            key={f.id}
            className="btab"
            onClick={() => setFilter(f.id)}
            style={{
              fontSize: 12, fontWeight: 600, borderRadius: 999, padding: "6px 12px",
              color: filter === f.id ? "#FFFFFF" : "#6B6353",
              background: filter === f.id ? "#0F5C52" : "#EFEAE0",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 6px" }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15 }}>Dingen die ik wil kopen</div>
          <button
            className="btab"
            onClick={addWishItem}
            style={{ fontSize: 12, fontWeight: 600, color: "#0F5C52", border: "1px solid #CFE3DC", borderRadius: 8, padding: "5px 10px" }}
          >
            + Toevoegen
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: "#8A8171", padding: "0 20px 10px" }}>
          "Gepland" telt mee als uitgave in de huidige maand. "Gekocht" is los daarvan gewoon een persoonlijk vinkje dat je het al hebt aangeschaft.
        </div>
        <div>
          {gefilterd.map((w) => {
            const gepland = w.geplandInMaand === currentMonth;
            const geplandElders = w.geplandInMaand && w.geplandInMaand !== currentMonth;
            const kleur = PRIORITEIT_KLEUR[w.prioriteit] || PRIORITEIT_KLEUR.gemiddeld;
            return (
              <div key={w.id} style={{ padding: "12px 20px", borderTop: "1px solid #EEE9DD" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="text"
                    value={w.naam}
                    onChange={(e) => updateWishItem(w.id, "naam", e.target.value)}
                    style={{
                      fontFamily: "'Inter', sans-serif", fontSize: 13.5, border: "1px solid #D8D2C4", borderRadius: 8,
                      padding: "6px 8px", background: "#FBFAF6", flex: 1, minWidth: 0,
                      textDecoration: w.gekocht ? "line-through" : "none", color: w.gekocht ? "#8A8171" : "#1F2937",
                    }}
                  />
                  <input
                    className="num-input"
                    style={{ width: 80 }}
                    type="number"
                    value={w.bedrag}
                    onChange={(e) => updateWishItem(w.id, "bedrag", parseFloat(e.target.value) || 0)}
                  />
                  <button className="btab" onClick={() => removeWishItem(w.id)} style={{ fontSize: 11, color: "#B3492A", whiteSpace: "nowrap" }}>
                    verwijder
                  </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 9, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#3A362E" }}>
                    <input type="checkbox" checked={gepland} onChange={() => toggleWishPlanning(w)} style={{ width: 16, height: 16, accentColor: "#0F5C52" }} />
                    gepland deze maand
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#3A362E" }}>
                    <input type="checkbox" checked={!!w.gekocht} onChange={() => toggleGekocht(w.id)} style={{ width: 16, height: 16, accentColor: "#0F5C52" }} />
                    gekocht
                  </label>
                  <select
                    value={w.prioriteit || "gemiddeld"}
                    onChange={(e) => updateWishItem(w.id, "prioriteit", e.target.value)}
                    style={{
                      fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600, border: "none", borderRadius: 999,
                      padding: "4px 10px", background: kleur.bg, color: kleur.fg,
                    }}
                  >
                    <option value="hoog">Moet</option>
                    <option value="gemiddeld">Leuk</option>
                    <option value="laag">Kan wachten</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                  <label style={{ fontSize: 11, color: "#8A8171" }}>
                    categorie{" "}
                    <select
                      value={w.categorieId || ""}
                      onChange={(e) => updateWishItem(w.id, "categorieId", e.target.value || null)}
                      style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, border: "1px solid #D8D2C4", borderRadius: 8, padding: "4px 6px", background: "#FBFAF6" }}
                    >
                      <option value="">geen categorie</option>
                      {variable.map((c) => (
                        <option key={c.id} value={c.id}>{c.naam}</option>
                      ))}
                    </select>
                  </label>
                  <input
                    type="text"
                    value={w.label || ""}
                    onChange={(e) => updateWishItem(w.id, "label", e.target.value)}
                    placeholder="label (optioneel, bv. verjaardag)"
                    style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, border: "1px solid #D8D2C4", borderRadius: 8, padding: "4px 8px", background: "#FBFAF6", flex: 1, minWidth: 140 }}
                  />
                </div>

                <div style={{ marginTop: 6 }}>
                  {gepland && <span style={{ fontSize: 11, fontWeight: 600, color: "#2F7A5C" }}>✓ ingepland deze maand</span>}
                  {geplandElders && (
                    <span style={{ fontSize: 11, color: "#C08A2E" }}>eerder gepland voor {periodLabel(w.geplandInMaand, payPeriodStartDay)}</span>
                  )}
                </div>
              </div>
            );
          })}
          {gefilterd.length === 0 && (
            <div style={{ padding: "0 20px 16px", fontSize: 12, color: "#B8AF9C" }}>
              {wenslijst.length === 0 ? "Nog niets op je wenslijst. Voeg iets toe met de knop hierboven." : "Niets gevonden voor dit filter."}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function RekeningenTab({ savingsAccounts, updateSavingsAccount, addSavingsAccount, removeSavingsAccount }) {
  const totaal = savingsAccounts.reduce((s, a) => s + (Number(a.saldo) || 0), 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Landmark size={20} color="#0F5C52" />
          <div>
            <div style={{ fontSize: 12.5, color: "#8A8171" }}>Totaal op je spaarrekeningen</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 19, fontWeight: 600 }}>{fmt2(totaal)}</div>
          </div>
        </div>
      </Card>

      <EditableListCard
        title="Spaarrekeningen"
        subtitle="Houd hier bij welke spaarrekeningen je hebt en wat de actuele stand is. Werk het saldo bij wanneer het verandert."
        items={savingsAccounts}
        amountField="saldo"
        onUpdate={updateSavingsAccount}
        onAdd={addSavingsAccount}
        onRemove={removeSavingsAccount}
        newLabel="+ Rekening toevoegen"
      />
    </div>
  );
}

function VastTab({ vasteMaandelijks, vasteMaandelijksTotaal, vasteJaarlijks, jaarlijksReservering, jaarlijksPotTotaal, gemStortingPerMaand, totaalInkomen, variabelBudgetTotaal, today }) {
  const vasteTotaal = vasteMaandelijksTotaal + jaarlijksPotTotaal;
  const sparenGepland = totaalInkomen - vasteTotaal - variabelBudgetTotaal;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16, marginBottom: 10 }}>Maandelijkse vaste lasten</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {vasteMaandelijks.map((v) => <DottedRow key={v.id} left={v.naam} right={fmt2(v.bedrag)} />)}
        </div>
        <div style={{ borderTop: "1px solid #EEE9DD", marginTop: 10, paddingTop: 10 }}>
          <DottedRow left="Totaal maandelijks" right={fmt2(vasteMaandelijksTotaal)} bold />
        </div>
      </Card>

      <Card>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Jaarlijkse vaste lasten</div>
        <div style={{ fontSize: 11.5, color: "#8A8171", marginBottom: 10 }}>
          Er wordt maandelijks automatisch geld gereserveerd zodat het potje op de verwachte datum vol zit. Wat je daadwerkelijk stort, log je zelf op het tabblad "Deze maand".
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {vasteJaarlijks.map((v) => {
            const pct = v.bedrag > 0 ? (v.gespaard / v.bedrag) * 100 : 0;
            const maanden = Math.max(0, monthsBetween(today, v.verwachteDatum));
            const perMaand = jaarlijksReservering(v);
            const status = jaarpotStatus(v, today);
            return (
              <div key={v.id}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 500, marginBottom: 4 }}>
                  <span>{v.naam} <span style={{ fontWeight: 400, color: "#B8AF9C" }}>({v.frequentiePerJaar || 1}x/jaar)</span></span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: "#8A8171" }}>{fmt(v.gespaard)} / {fmt(v.bedrag)}</span>
                </div>
                <ProgressBar pct={pct} tone={status.achterstand ? "over" : pct >= 100 ? "ok" : "warn"} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "#8A8171" }}>
                  <span>verwacht over {maanden} mnd</span>
                  <span>reservering: {fmt2(perMaand)} /mnd</span>
                </div>
                {status.achterstand && (
                  <div style={{ marginTop: 4, fontSize: 11, color: "#B3492A", display: "flex", alignItems: "center", gap: 4 }}>
                    <AlertTriangle size={11} /> loopt achter — nog {fmt2(status.tekort)} in te halen
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ borderTop: "1px solid #EEE9DD", marginTop: 12, paddingTop: 10 }}>
          <DottedRow left="Totaal maandelijkse reservering" right={fmt2(jaarlijksPotTotaal)} bold />
          <div style={{ marginTop: 6 }}>
            <DottedRow
              left="Gemiddeld daadwerkelijk gestort/mnd"
              right={fmt2(gemStortingPerMaand)}
            />
          </div>
          {gemStortingPerMaand < jaarlijksPotTotaal - 0.01 && (
            <div style={{ marginTop: 8, fontSize: 11.5, color: "#C08A2E", display: "flex", alignItems: "center", gap: 4 }}>
              <AlertTriangle size={12} /> Je zet gemiddeld minder opzij dan de aanbevolen reservering.
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Geplande verdeling van inkomen</div>
        <div style={{ fontSize: 11.5, color: "#8A8171", marginBottom: 10 }}>
          Dit is geen optelsom van wat je al hebt uitgegeven, maar wat er overblijft als je je exact aan al je budgetten houdt — dus je inkomen minus je vaste lasten, minus de reservering voor je jaarpotjes, minus je volledige variabele budget. Het laat zien hoeveel ruimte er in theorie is om te sparen.
        </div>
        <DottedRow left="Inkomen" right={fmt2(totaalInkomen)} />
        <DottedRow left="− Vaste lasten (maandelijks)" right={fmt2(vasteMaandelijksTotaal)} />
        <DottedRow left="− Reservering jaarpotjes" right={fmt2(jaarlijksPotTotaal)} />
        <DottedRow left="− Variabel budget" right={fmt2(variabelBudgetTotaal)} />
        <div style={{ borderTop: "1px solid #EEE9DD", marginTop: 8, paddingTop: 8 }}>
          <DottedRow left="= Gepland sparen" right={fmt2(sparenGepland)} bold />
        </div>
      </Card>
    </div>
  );
}

function EditableListCard({ title, subtitle, items, amountField, onUpdate, onAdd, onRemove, newLabel, tip }) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: subtitle ? 4 : 10 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16 }}>{title}</div>
        <button
          className="btab"
          onClick={onAdd}
          style={{ fontSize: 12, fontWeight: 600, color: "#0F5C52", border: "1px solid #CFE3DC", borderRadius: 8, padding: "5px 10px" }}
        >
          {newLabel || "+ Toevoegen"}
        </button>
      </div>
      {subtitle && <div style={{ fontSize: 11.5, color: "#8A8171", marginBottom: 10 }}>{subtitle}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="text"
              value={item.naam}
              onChange={(e) => onUpdate(item.id, "naam", e.target.value)}
              style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, border: "1px solid #D8D2C4", borderRadius: 8, padding: "6px 8px", background: "#FBFAF6", flex: 1, minWidth: 0 }}
            />
            <input
              className="num-input"
              style={{ width: 90 }}
              type="number"
              value={item[amountField]}
              onChange={(e) => onUpdate(item.id, amountField, parseFloat(e.target.value) || 0)}
            />
            <button className="btab" onClick={() => onRemove(item.id)} style={{ fontSize: 11, color: "#B3492A", whiteSpace: "nowrap" }}>
              verwijder
            </button>
          </div>
        ))}
        {items.length === 0 && <div style={{ fontSize: 12, color: "#B8AF9C" }}>Nog niets toegevoegd.</div>}
      </div>
      {tip && <div style={{ fontSize: 11, color: "#8A8171", marginTop: 10 }}>{tip}</div>}
    </Card>
  );
}

function InstellingenTab({
  state,
  updateIncome, addIncome, removeIncome,
  updateVariable, addVariable, removeVariable,
  updateVasteMaandelijks, addVasteMaandelijks, removeVasteMaandelijks,
  updateVasteJaarlijks, addVasteJaarlijks, removeVasteJaarlijks, markJaarlijksBetaald,
  updatePayPeriodStartDay, updateGoal, addGoal, removeGoal, today,
}) {
  const totaalInkomen = state.income.reduce((s, i) => s + (Number(i.bedrag) || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16, marginBottom: 10 }}>Loonperiode</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14 }}>Uitbetalingsdag van de maand</span>
          <input
            className="num-input"
            style={{ width: 70 }}
            type="number"
            min={1}
            max={28}
            value={state.payPeriodStartDay}
            onChange={(e) => updatePayPeriodStartDay(parseInt(e.target.value, 10) || 25)}
          />
        </div>
        <div style={{ fontSize: 11, color: "#8A8171", marginTop: 8 }}>
          "Deze maand" volgt vanaf nu jouw loonperiode: van deze dag tot en met de dag ervoor in de volgende kalendermaand.
        </div>
      </Card>

      <EditableListCard
        title="Inkomen"
        items={state.income}
        amountField="bedrag"
        onUpdate={updateIncome}
        onAdd={addIncome}
        onRemove={removeIncome}
        newLabel="+ Inkomen toevoegen"
      />
      <Card style={{ marginTop: -6 }}>
        <DottedRow left="Totaal inkomen" right={fmt2(totaalInkomen)} bold />
      </Card>

      <EditableListCard
        title="Variabele budgetten"
        items={state.variable}
        amountField="budget"
        onUpdate={updateVariable}
        onAdd={addVariable}
        onRemove={removeVariable}
        newLabel="+ Budget toevoegen"
      />

      <Card>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Automatische categorisering</div>
        <div style={{ fontSize: 11.5, color: "#8A8171", marginBottom: 10 }}>
          Trefwoorden die gebruikt worden om bank-transacties bij "Bank-uitgaven importeren" automatisch aan een categorie te koppelen. Gescheiden door komma's.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {state.variable.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, width: 130, flexShrink: 0 }}>{c.naam}</div>
              <input
                type="text"
                value={(c.keywords || []).join(", ")}
                onChange={(e) => updateVariable(c.id, "keywords", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                placeholder="bijv. albert heijn, jumbo"
                style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, border: "1px solid #D8D2C4", borderRadius: 8, padding: "6px 8px", background: "#FBFAF6", flex: 1, minWidth: 0 }}
              />
            </div>
          ))}
        </div>
      </Card>

      <EditableListCard
        title="Maandelijkse vaste lasten"
        items={state.vasteMaandelijks}
        amountField="bedrag"
        onUpdate={updateVasteMaandelijks}
        onAdd={addVasteMaandelijks}
        onRemove={removeVasteMaandelijks}
        newLabel="+ Vaste last toevoegen"
        tip='Tip: zet "Lening aflossing" op €160 als je de lening van €4.000 aangaat.'
      />

      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16 }}>Jaarlijkse vaste lasten</div>
          <button
            className="btab"
            onClick={addVasteJaarlijks}
            style={{ fontSize: 12, fontWeight: 600, color: "#0F5C52", border: "1px solid #CFE3DC", borderRadius: 8, padding: "5px 10px" }}
          >
            + Toevoegen
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: "#8A8171", marginBottom: 10 }}>Stel de naam, het bedrag per keer, hoe vaak per jaar, de eerstvolgende verwachte datum en (optioneel) wat er al gespaard is in.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {state.vasteJaarlijks.map((v) => (
            <div key={v.id} style={{ borderBottom: "1px solid #EEE9DD", paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  value={v.naam}
                  onChange={(e) => updateVasteJaarlijks(v.id, "naam", e.target.value)}
                  style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 13.5, border: "1px solid #D8D2C4", borderRadius: 8, padding: "6px 8px", background: "#FBFAF6", flex: 1, minWidth: 0 }}
                />
                <button className="btab" onClick={() => removeVasteJaarlijks(v.id)} style={{ fontSize: 11, color: "#B3492A", whiteSpace: "nowrap" }}>
                  verwijder
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <label style={{ fontSize: 11, color: "#8A8171" }}>
                  bedrag per keer
                  <br />
                  <input className="num-input" type="number" value={v.bedrag} onChange={(e) => updateVasteJaarlijks(v.id, "bedrag", parseFloat(e.target.value) || 0)} />
                </label>
                <label style={{ fontSize: 11, color: "#8A8171" }}>
                  keer per jaar
                  <br />
                  <select
                    value={v.frequentiePerJaar || 1}
                    onChange={(e) => updateVasteJaarlijks(v.id, "frequentiePerJaar", parseInt(e.target.value, 10))}
                    style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, border: "1px solid #D8D2C4", borderRadius: 8, padding: "6px 8px", background: "#FBFAF6" }}
                  >
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                    <option value={3}>3x</option>
                    <option value={4}>4x</option>
                    <option value={6}>6x</option>
                    <option value={12}>12x</option>
                  </select>
                </label>
                <label style={{ fontSize: 11, color: "#8A8171" }}>
                  eerstvolgende datum
                  <br />
                  <input className="date-input" type="date" value={v.verwachteDatum} onChange={(e) => updateVasteJaarlijks(v.id, "verwachteDatum", e.target.value)} />
                </label>
                <label style={{ fontSize: 11, color: "#8A8171" }}>
                  al gespaard
                  <br />
                  <input className="num-input" type="number" value={v.gespaard} onChange={(e) => updateVasteJaarlijks(v.id, "gespaard", parseFloat(e.target.value) || 0)} />
                </label>
                <button
                  className="btab"
                  onClick={() => markJaarlijksBetaald(v.id)}
                  title="Markeer als betaald: potje leegt en datum schuift door met de ingestelde frequentie"
                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#0F5C52", border: "1px solid #CFE3DC", borderRadius: 8, padding: "6px 9px", marginTop: 14 }}
                >
                  <RotateCcw size={12} /> betaald
                </button>
              </div>
            </div>
          ))}
          {state.vasteJaarlijks.length === 0 && <div style={{ fontSize: 12, color: "#B8AF9C" }}>Nog geen jaarlijkse lasten. Voeg er een toe met de knop hierboven.</div>}
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16 }}>Spaardoelen</div>
          <button
            className="btab"
            onClick={addGoal}
            style={{ fontSize: 12, fontWeight: 600, color: "#0F5C52", border: "1px solid #CFE3DC", borderRadius: 8, padding: "5px 10px" }}
          >
            + Doel toevoegen
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: "#8A8171", marginBottom: 10 }}>Pas de naam, het streefbedrag, de streefdatum en wat je al hebt gespaard aan, of verwijder een doel.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {state.goals.map((g) => (
            <div key={g.id} style={{ borderBottom: "1px solid #EEE9DD", paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  value={g.naam}
                  onChange={(e) => updateGoal(g.id, "naam", e.target.value)}
                  style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 13.5, border: "1px solid #D8D2C4", borderRadius: 8, padding: "6px 8px", background: "#FBFAF6", flex: 1 }}
                />
                <button className="btab" onClick={() => removeGoal(g.id)} style={{ fontSize: 11, color: "#B3492A" }}>
                  verwijder
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <label style={{ fontSize: 11, color: "#8A8171" }}>
                  streefbedrag
                  <br />
                  <input className="num-input" type="number" value={g.doel} onChange={(e) => updateGoal(g.id, "doel", parseFloat(e.target.value) || 0)} />
                </label>
                <label style={{ fontSize: 11, color: "#8A8171" }}>
                  al gespaard
                  <br />
                  <input className="num-input" type="number" value={g.algespaard} onChange={(e) => updateGoal(g.id, "algespaard", parseFloat(e.target.value) || 0)} />
                </label>
                <label style={{ fontSize: 11, color: "#8A8171" }}>
                  streefdatum
                  <br />
                  <input className="date-input" type="date" value={g.deadline} onChange={(e) => updateGoal(g.id, "deadline", e.target.value)} />
                </label>
              </div>
            </div>
          ))}
          {state.goals.length === 0 && <div style={{ fontSize: 12, color: "#B8AF9C" }}>Nog geen spaardoelen. Voeg er een toe met de knop hierboven.</div>}
        </div>
      </Card>
    </div>
  );
}

function DoelenTab({ goals, updateGoal, gemSparen, today }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PiggyBank size={20} color="#0F5C52" />
          <div>
            <div style={{ fontSize: 12.5, color: "#8A8171" }}>Gemiddeld sparen per maand (op basis van ingevoerde maanden)</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 17, fontWeight: 600 }}>{fmt2(gemSparen)}</div>
          </div>
        </div>
      </Card>

      {goals.map((g) => {
        const pct = g.doel > 0 ? (g.algespaard / g.doel) * 100 : 0;
        const { maanden, benodigdPerMaand, opSchema } = goalStatus(g, gemSparen, today);
        return (
          <Card key={g.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16 }}>{g.naam}</div>
                <div style={{ fontSize: 11.5, color: "#8A8171", display: "flex", alignItems: "center", gap: 4 }}>
                  streefdatum
                  <input className="date-input" type="date" value={g.deadline} onChange={(e) => updateGoal(g.id, "deadline", e.target.value)} />
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999, background: opSchema ? "#E4F0EA" : "#FBEAE3", color: opSchema ? "#2F7A5C" : "#B3492A", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                {opSchema ? <Check size={12} /> : <AlertTriangle size={12} />}
                {opSchema ? "op schema" : "achterstand"}
              </div>
            </div>

            <ProgressBar pct={pct} tone={pct >= 100 ? "ok" : "warn"} />

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12.5 }}>
              <span style={{ color: "#8A8171" }}>
                <input className="num-input" style={{ width: 84 }} type="number" value={g.algespaard} onChange={(e) => updateGoal(g.id, "algespaard", parseFloat(e.target.value) || 0)} /> / {fmt(g.doel)}
              </span>
              <span style={{ color: "#8A8171" }}>nog {maanden} mnd</span>
            </div>

            <DottedRow left="Nodig per maand" right={fmt2(benodigdPerMaand)} />
          </Card>
        );
      })}
    </div>
  );
}
