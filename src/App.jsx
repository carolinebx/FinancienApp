import React, { useState, useEffect, useMemo, useCallback } from "react";
import { storage } from "./storage.js";
import {
  Wallet, TrendingUp, Plane, Settings, ChevronLeft, ChevronRight,
  Check, AlertTriangle, PiggyBank, Home, RotateCcw, Landmark
} from "lucide-react";

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
const addYears = (dateStr, n) => {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
};
const addMonthsToDate = (dateStr, n) => {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};
const cycleMonths = (frequentiePerJaar) => Math.max(1, Math.round(12 / (frequentiePerJaar || 1)));

const DEFAULT_VARIABLE = [
  { id: "boodschappen", naam: "Boodschappen", budget: 330 },
  { id: "reizen", naam: "Reizen", budget: 70 },
  { id: "kleding", naam: "Kleding", budget: 60 },
  { id: "verzorging", naam: "Verzorging", budget: 40 },
  { id: "huishouden", naam: "Huishouden", budget: 40 },
  { id: "horeca", naam: "Uitgaan / Horeca", budget: 120 },
  { id: "uitjes", naam: "Uitjes / Sport", budget: 80 },
  { id: "abonnementen", naam: "Abonnementen (overig)", budget: 15 },
  { id: "buffer", naam: "Overig / buffer", budget: 67.55 },
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

const STORAGE_KEY = "budget-tracker-v2";

const defaultState = () => ({
  income: DEFAULT_INCOME,
  variable: DEFAULT_VARIABLE,
  vasteMaandelijks: DEFAULT_VASTE_MAANDELIJKS,
  vasteJaarlijks: DEFAULT_VASTE_JAARLIJKS,
  goals: DEFAULT_GOALS,
  savingsAccounts: DEFAULT_SAVINGS_ACCOUNTS,
  payPeriodStartDay: 25,
  monthly: {}, // { "2026-09": { spent: { boodschappen: 12.3, ... } } }
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
  return {
    income: migrateIncome(parsed.income),
    variable: Array.isArray(parsed.variable) ? parsed.variable : d.variable,
    vasteMaandelijks: Array.isArray(parsed.vasteMaandelijks) ? parsed.vasteMaandelijks : d.vasteMaandelijks,
    vasteJaarlijks: migrateVasteJaarlijks(vasteJaarlijksRaw),
    goals: Array.isArray(parsed.goals) ? parsed.goals : d.goals,
    savingsAccounts: Array.isArray(parsed.savingsAccounts) ? parsed.savingsAccounts : d.savingsAccounts,
    payPeriodStartDay: typeof parsed.payPeriodStartDay === "number" ? parsed.payPeriodStartDay : d.payPeriodStartDay,
    monthly: parsed.monthly && typeof parsed.monthly === "object" ? parsed.monthly : {},
  };
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
        await storage.set(STORAGE_KEY, JSON.stringify(state));
        setSaveStatus("saved");
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
  const variabelBestedTotaal = state.variable.reduce((s, c) => s + (Number(monthData.spent[c.id]) || 0), 0);
  const jaarlijkseTekortDezeMaand = (monthData.jaarlijkseBetalingen || []).reduce((s, b) => s + (Number(b.tekort) || 0), 0);
  const sparenDezeMaand = totaalInkomen - vasteTotaal - variabelBestedTotaal - jaarlijkseTekortDezeMaand;

  const monthsWithData = Object.keys(state.monthly).filter(
    (k) => Object.keys(state.monthly[k].spent || {}).length > 0 || (state.monthly[k].jaarlijkseBetalingen || []).length > 0
  );
  const gemSparen =
    monthsWithData.length > 0
      ? monthsWithData.reduce((sum, k) => {
          const spentSum = Object.values(state.monthly[k].spent || {}).reduce((a, b) => a + (Number(b) || 0), 0);
          const tekortSum = (state.monthly[k].jaarlijkseBetalingen || []).reduce((a, b) => a + (Number(b.tekort) || 0), 0);
          return sum + (totaalInkomen - vasteTotaal - spentSum - tekortSum);
        }, 0) / monthsWithData.length
      : sparenDezeMaand;

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
              {notConfigured ? "niet opgeslagen — Sheet nog niet gekoppeld" : saveStatus === "saving" ? "opslaan…" : saveStatus === "error" ? "opslaan mislukt" : "opgeslagen"}
            </div>
          </div>
          <Wallet size={26} color="#0F5C52" strokeWidth={1.6} />
        </div>

        {notConfigured && (
          <div style={{ background: "#FBEAE3", border: "1px solid #E8C4B3", borderRadius: 12, padding: "12px 14px", marginBottom: 18, fontSize: 12.5, color: "#7A3A22" }}>
            <strong>Google Sheet nog niet gekoppeld.</strong> Je gegevens worden nu alleen in deze sessie onthouden en zijn weg na het herladen. Vul <code>SHEET_API_URL</code> en <code>API_TOKEN</code> in bij <code>src/config.js</code> — zie <code>GOOGLE_SHEET_SETUP.md</code> voor de stappen.
          </div>
        )}

        <div style={{ display: "flex", gap: 4, marginBottom: 18, background: "#EFEAE0", padding: 4, borderRadius: 12 }}>
          {[
            { id: "maand", label: "Deze maand", icon: TrendingUp },
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
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
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
            addJaarlijkseBetalingDezeMaand={addJaarlijkseBetalingDezeMaand}
            removeJaarlijkseBetalingDezeMaand={removeJaarlijkseBetalingDezeMaand}
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

function MaandTab({
  state, currentMonth, setCurrentMonth, monthData, setSpent, vasteTotaal, totaalInkomen,
  variabelBudgetTotaal, variabelBestedTotaal, sparenDezeMaand, jaarlijkseTekortDezeMaand,
  addJaarlijkseBetalingDezeMaand, removeJaarlijkseBetalingDezeMaand,
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

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px 6px", fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15 }}>Budget per categorie</div>
        <div>
          {state.variable.map((cat, i) => {
            const spent = Number(monthData.spent[cat.id]) || 0;
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
        const resterend = Math.max(0, g.doel - g.algespaard);
        const maanden = Math.max(0, monthsBetween(today, g.deadline));
        const benodigdPerMaand = maanden > 0 ? resterend / maanden : resterend;
        const opSchema = gemSparen >= benodigdPerMaand;
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

function VastTab({ vasteMaandelijks, vasteMaandelijksTotaal, vasteJaarlijks, jaarlijksReservering, jaarlijksPotTotaal, totaalInkomen, variabelBudgetTotaal, today }) {
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
          Er wordt maandelijks automatisch geld gereserveerd zodat het potje op de verwachte datum vol zit.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {vasteJaarlijks.map((v) => {
            const pct = v.bedrag > 0 ? (v.gespaard / v.bedrag) * 100 : 0;
            const maanden = Math.max(0, monthsBetween(today, v.verwachteDatum));
            const perMaand = jaarlijksReservering(v);
            return (
              <div key={v.id}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 500, marginBottom: 4 }}>
                  <span>{v.naam} <span style={{ fontWeight: 400, color: "#B8AF9C" }}>({v.frequentiePerJaar || 1}x/jaar)</span></span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: "#8A8171" }}>{fmt(v.gespaard)} / {fmt(v.bedrag)}</span>
                </div>
                <ProgressBar pct={pct} tone={pct >= 100 ? "ok" : "warn"} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "#8A8171" }}>
                  <span>verwacht over {maanden} mnd</span>
                  <span>reservering: {fmt2(perMaand)} /mnd</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ borderTop: "1px solid #EEE9DD", marginTop: 12, paddingTop: 10 }}>
          <DottedRow left="Totaal maandelijkse reservering" right={fmt2(jaarlijksPotTotaal)} bold />
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
