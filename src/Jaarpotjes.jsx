import React, { useState } from "react";
import { PiggyBank, Check, AlertTriangle } from "lucide-react";

// =====================================================================
// Jaarpotjes: alle logica + het eigen tabblad.
// Gebruikt dezelfde opslagvorm als de bestaande App (vasteJaarlijks.gespaard,
// monthly[periode].jaarlijkseStortingen / jaarlijkseBetalingen), plus nieuw:
// monthly[periode].potCorrecties. Elke mutatie onthoudt wat hij veranderde,
// zodat ongedaan maken het saldo én de vervaldatum terugzet.
// =====================================================================

const MND = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const pad = (n) => String(n).padStart(2, "0");
const eur = (n) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const uid = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export const cycleMonths = (f) => Math.max(1, Math.round(12 / (f || 1)));
export const vandaagIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
// Zonder tijdzone-/zomertijdfouten (de oude versie schoof 15 jan + 6 mnd naar 14 juli).
export const addMonthsToDate = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1 + n, 1);
  const laatsteDag = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(Math.min(d, laatsteDag))}`;
};
const fmtDatum = (iso) => {
  const [y, m, d] = (iso || "").split("-").map(Number);
  return y ? `${d} ${MND[m - 1]} ${y}` : "";
};
const periodKey = (iso, startDay) => {
  let [y, m, d] = iso.split("-").map(Number);
  if (d < startDay) { m -= 1; if (m < 1) { m = 12; y -= 1; } }
  return `${y}-${pad(m)}`;
};
const periodenTussen = (a, b) => {
  const [y1, m1] = a.split("-").map(Number);
  const [y2, m2] = b.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
};

const LIJSTEN = [
  ["jaarlijkseStortingen", "storting"],
  ["jaarlijkseBetalingen", "betaling"],
  ["potCorrecties", "correctie"],
  ["extraWeggezet", "extra"],
];

// ---------- berekening per potje ----------
// Streefbedrag = wat er nog ontbreekt aan het BEGIN van deze loonperiode, gedeeld door het
// aantal loonperiodes tot de vervaldatum. Het beweegt dus niet mee als je deze periode stort.
export function potPlan(item, monthly, { today, startDay = 25 }) {
  const bedrag = Number(item.bedrag) || 0;
  const saldo = Number(item.gespaard) || 0;
  const cyclus = cycleMonths(item.frequentiePerJaar);
  const nu = periodKey(today, startDay);
  const resterend = Math.max(1, periodenTussen(nu, periodKey(item.verwachteDatum, startDay)) + 1);
  const gestort = ((monthly[nu] || {}).jaarlijkseStortingen || [])
    .filter((s) => s.itemId === item.id)
    .reduce((a, s) => a + (Number(s.bedrag) || 0), 0);
  const saldoStart = Math.max(0, saldo - gestort);
  const streef = Math.max(0, bedrag - saldoStart) / resterend;
  const verwachtStart = bedrag * Math.min(1, Math.max(0, 1 - resterend / cyclus));
  return {
    bedrag, saldo, resterend, gestort, saldoStart, streef, verwachtStart,
    nogTeStorten: Math.max(0, streef - gestort),
    gedekt: saldo >= bedrag - 0.005,
    achter: saldo < bedrag - 0.005 && saldoStart < verwachtStart - 1,
  };
}

// Zelfde vorm als de oude jaarpotStatus, dus de bestaande aanroepen blijven werken.
export function jaarpotStatus(item, today, startDay = 25, monthly = {}) {
  const p = potPlan(item, monthly, { today, startDay });
  return {
    verwachtPct: p.bedrag > 0 ? (p.verwachtStart / p.bedrag) * 100 : 0,
    actueelPct: p.bedrag > 0 ? (p.saldoStart / p.bedrag) * 100 : 100,
    tekort: Math.max(0, p.verwachtStart - p.saldoStart),
    achterstand: p.achter,
  };
}

// ---------- acties (pure functies op de volledige state) ----------
// a = { type: "storting" | "betaling" | "correctie", potId, bedrag, nieuwSaldo, herstart, periodeKey, today }
export function potActie(prev, a) {
  if (a.type === "eenmalig") {
    // Eenmalige jaarlijkse last zonder potje: komt volledig uit het maandbudget.
    const b = Number(a.bedrag) || 0;
    if (b <= 0) return prev;
    const e0 = prev.monthly[a.periodeKey] || { spent: {} };
    const entry0 = { id: uid("eenmalig"), itemId: null, naam: (a.naam || "").trim() || "Eenmalige last", bedrag: b, uitPot: 0, tekort: b, delta: 0, datum: a.today };
    return { ...prev, monthly: { ...prev.monthly, [a.periodeKey]: { ...e0, jaarlijkseBetalingen: [...(e0.jaarlijkseBetalingen || []), entry0] } } };
  }
  const item = prev.vasteJaarlijks.find((v) => v.id === a.potId);
  if (!item) return prev;
  const saldo = Number(item.gespaard) || 0;
  const bedrag = Number(a.bedrag) || 0;
  const basis = { id: uid(a.type), itemId: item.id, naam: item.naam, datum: a.today };
  let entry, lijst, patch;

  if (a.type === "storting") {
    if (bedrag <= 0) return prev;
    entry = { ...basis, bedrag, delta: bedrag };
    lijst = "jaarlijkseStortingen";
    patch = { gespaard: saldo + bedrag };
  } else if (a.type === "betaling") {
    if (bedrag <= 0) return prev;
    const uitPot = Math.min(saldo, bedrag);
    let datumNa = item.verwachteDatum;
    if (a.herstart) {
      // Potje opnieuw starten: volgende vervaldatum, en bij te laat betalen door tot na vandaag.
      datumNa = addMonthsToDate(datumNa, cycleMonths(item.frequentiePerJaar));
      for (let g = 0; datumNa < a.today && g < 24; g++) datumNa = addMonthsToDate(datumNa, cycleMonths(item.frequentiePerJaar));
    }
    entry = { ...basis, bedrag, uitPot, tekort: bedrag - uitPot, delta: -uitPot, datumVoor: item.verwachteDatum, datumNa };
    lijst = "jaarlijkseBetalingen";
    patch = { gespaard: saldo - uitPot, verwachteDatum: datumNa };
  } else {
    const nieuw = Math.max(0, Number(a.nieuwSaldo) || 0);
    if (Math.abs(nieuw - saldo) < 0.005) return prev;
    entry = { ...basis, bedrag: nieuw - saldo, delta: nieuw - saldo };
    lijst = "potCorrecties";
    patch = { gespaard: nieuw };
  }

  const e = prev.monthly[a.periodeKey] || { spent: {} };
  return {
    ...prev,
    vasteJaarlijks: prev.vasteJaarlijks.map((v) => (v.id === item.id ? { ...v, ...patch } : v)),
    monthly: { ...prev.monthly, [a.periodeKey]: { ...e, [lijst]: [...(e[lijst] || []), entry] } },
  };
}

export function potUndo(prev, periodeKey, lijst, id) {
  const e = prev.monthly[periodeKey] || {};
  const entry = (e[lijst] || []).find((x) => x.id === id);
  if (!entry) return prev;
  if (lijst === "extraWeggezet") {
    // Extra weggezet naar spaardoel, jaarpotje of spaarrekening: boeking terugdraaien.
    const amt = Number(entry.bedrag) || 0;
    const min = (n) => Math.max(0, (Number(n) || 0) - amt);
    return {
      ...prev,
      goals: entry.type === "doel" ? prev.goals.map((g) => (g.id === entry.targetId ? { ...g, algespaard: min(g.algespaard) } : g)) : prev.goals,
      vasteJaarlijks: entry.type === "jaarpot" ? prev.vasteJaarlijks.map((v) => (v.id === entry.targetId ? { ...v, gespaard: min(v.gespaard) } : v)) : prev.vasteJaarlijks,
      savingsAccounts: entry.type === "rekening" ? prev.savingsAccounts.map((r) => (r.id === entry.targetId ? { ...r, saldo: min(r.saldo) } : r)) : prev.savingsAccounts,
      monthly: { ...prev.monthly, [periodeKey]: { ...e, [lijst]: e[lijst].filter((x) => x.id !== id) } },
    };
  }
  const delta = entry.delta ?? (lijst === "jaarlijkseBetalingen" ? -(Number(entry.uitPot) || 0) : Number(entry.bedrag) || 0);
  return {
    ...prev,
    vasteJaarlijks: prev.vasteJaarlijks.map((v) =>
      v.id !== entry.itemId
        ? v
        : {
            ...v,
            gespaard: Math.max(0, (Number(v.gespaard) || 0) - delta),
            verwachteDatum:
              entry.datumNa && entry.datumVoor && v.verwachteDatum === entry.datumNa ? entry.datumVoor : v.verwachteDatum,
          }
    ),
    monthly: { ...prev.monthly, [periodeKey]: { ...e, [lijst]: e[lijst].filter((x) => x.id !== id) } },
  };
}

// Voor "Maand opnieuw invullen": draait alle potmutaties van die periode terug (saldo en datum).
export function potResetPeriode(prev, periodeKey) {
  let s = prev;
  const e = prev.monthly[periodeKey] || {};
  LIJSTEN.forEach(([lijst]) => [...(e[lijst] || [])].reverse().forEach((x) => { s = potUndo(s, periodeKey, lijst, x.id); }));
  return s;
}

const sorteerNieuwsteEerst = (lijst) =>
  lijst.sort((x, y) => `${y.datum || y.periodeKey}${y.id}`.localeCompare(`${x.datum || x.periodeKey}${x.id}`));

const historie = (monthly, potId) => {
  const out = [];
  Object.entries(monthly).forEach(([pk, e]) =>
    LIJSTEN.forEach(([lijst, soort]) =>
      (e[lijst] || []).forEach((x) => {
        const hoort = lijst === "extraWeggezet" ? x.type === "jaarpot" && x.targetId === potId : x.itemId === potId;
        if (hoort) out.push({ ...x, lijst, soort, periodeKey: pk });
      })
    )
  );
  return sorteerNieuwsteEerst(out);
};

// ---------- UI ----------
const Kaart = ({ children, style }) => (
  <div style={{ background: "#FFFFFF", border: "1px solid #E4DFD6", borderRadius: 14, padding: "16px 18px", boxShadow: "0 1px 2px rgba(31,41,55,0.04)", ...style }}>{children}</div>
);
const Balk = ({ pct, kleur }) => (
  <div style={{ height: 8, borderRadius: 999, background: "#E7E1D4", overflow: "hidden" }}>
    <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: kleur, borderRadius: 999, transition: "width 300ms ease" }} />
  </div>
);
const knop = (primair) => ({
  fontSize: 12, fontWeight: 600, borderRadius: 8, padding: "6px 11px",
  color: primair ? "#FFFFFF" : "#0F5C52", background: primair ? "#0F5C52" : "transparent",
  border: primair ? "none" : "1px solid #CFE3DC",
});
const invoer = { fontFamily: "'Inter', sans-serif", fontSize: 13, border: "1px solid #D8D2C4", borderRadius: 8, padding: "6px 8px", background: "#FBFAF6" };

function PotKaart({ pot, plan, hist, today, doPot, undoPot, updatePot, removePot }) {
  const [paneel, setPaneel] = useState(null); // storten | betaald | corrigeer | bewerk
  const [waarde, setWaarde] = useState("");
  const [herstart, setHerstart] = useState(true);
  const [alleHist, setAlleHist] = useState(false);
  const [wis, setWis] = useState(false);

  const open = (p) => {
    if (paneel === p) return setPaneel(null);
    setPaneel(p);
    setWaarde(String(Math.round((p === "storten" ? plan.nogTeStorten || plan.streef : p === "betaald" ? plan.bedrag : plan.saldo) * 100) / 100));
    setHerstart(true);
  };
  const bewaar = () => {
    if (paneel === "storten") doPot({ type: "storting", potId: pot.id, bedrag: parseFloat(waarde) });
    if (paneel === "betaald") doPot({ type: "betaling", potId: pot.id, bedrag: parseFloat(waarde), herstart });
    if (paneel === "corrigeer") doPot({ type: "correctie", potId: pot.id, nieuwSaldo: parseFloat(waarde) });
    setPaneel(null);
  };

  const pct = plan.bedrag > 0 ? (plan.saldo / plan.bedrag) * 100 : 0;
  const kleur = plan.gedekt ? "#2F7A5C" : plan.achter ? "#B3492A" : "#C08A2E";
  const volgende = addMonthsToDate(pot.verwachteDatum, cycleMonths(pot.frequentiePerJaar));
  const toon = alleHist ? hist : hist.slice(0, 3);
  const label = { storting: "gestort", betaling: "betaald", correctie: "saldo gecorrigeerd", extra: "extra weggezet" };

  return (
    <Kaart>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15.5 }}>
          {pot.naam} <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 11.5, color: "#8A8171" }}>{pot.frequentiePerJaar || 1}x per jaar</span>
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, color: "#3A362E", whiteSpace: "nowrap" }}>{eur(plan.saldo)} / {eur(plan.bedrag)}</div>
      </div>
      <div style={{ margin: "8px 0 6px" }}><Balk pct={pct} kleur={kleur} /></div>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, fontSize: 11.5, color: "#8A8171" }}>
        <span>vervalt {fmtDatum(pot.verwachteDatum)}</span>
        <span style={{ fontWeight: 600, color: kleur, display: "flex", alignItems: "center", gap: 4 }}>
          {plan.gedekt ? <><Check size={12} /> volledig gedekt</> : plan.achter ? <><AlertTriangle size={12} /> loopt achter</> : "op schema"}
        </span>
      </div>

      {!plan.gedekt && (
        <div style={{ marginTop: 8, fontSize: 12.5, color: "#3A362E" }}>
          Streef deze periode: <strong style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{eur(plan.streef)}</strong>
          {" · "}gestort: {eur(plan.gestort)}
          {plan.nogTeStorten > 0.005 ? <> · nog <strong>{eur(plan.nogTeStorten)}</strong></> : <> · <span style={{ color: "#2F7A5C" }}>klaar voor deze periode</span></>}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        <button className="btab" style={knop(paneel === "storten")} onClick={() => open("storten")}>Storten</button>
        <button className="btab" style={knop(paneel === "betaald")} onClick={() => open("betaald")}>Betaald</button>
        <button className="btab" style={knop(paneel === "corrigeer")} onClick={() => open("corrigeer")}>Saldo corrigeren</button>
        <button className="btab" style={knop(paneel === "bewerk")} onClick={() => setPaneel(paneel === "bewerk" ? null : "bewerk")}>Bewerken</button>
      </div>

      {(paneel === "storten" || paneel === "betaald" || paneel === "corrigeer") && (
        <div style={{ marginTop: 10, padding: 10, background: "#FBFAF6", border: "1px solid #EEE9DD", borderRadius: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11.5, color: "#8A8171" }}>
            {paneel === "storten" && "Bedrag dat je deze periode opzij zet."}
            {paneel === "betaald" && `Bedrag dat je hebt betaald. Wat niet in het potje zit, komt uit je maandbudget (${eur(Math.max(0, (parseFloat(waarde) || 0) - plan.saldo))}).`}
            {paneel === "corrigeer" && "Nieuw saldo van dit potje, bijvoorbeeld na vergelijken met je spaarrekening."}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input className="num-input" type="number" step="0.01" inputMode="decimal" value={waarde} onChange={(e) => setWaarde(e.target.value)} />
            <button className="btab" style={knop(true)} onClick={bewaar}>
              {paneel === "storten" ? "Storting bewaren" : paneel === "betaald" ? "Betaling bewaren" : "Saldo bewaren"}
            </button>
          </div>
          {paneel === "betaald" && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#3A362E" }}>
              <input type="checkbox" checked={herstart} onChange={(e) => setHerstart(e.target.checked)} style={{ accentColor: "#0F5C52" }} />
              Potje opnieuw starten, volgende vervaldatum {fmtDatum(volgende)}
            </label>
          )}
        </div>
      )}

      {paneel === "bewerk" && (
        <div style={{ marginTop: 10, padding: 10, background: "#FBFAF6", border: "1px solid #EEE9DD", borderRadius: 10, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <label style={{ fontSize: 11, color: "#8A8171", flex: "1 1 160px" }}>naam<br />
            <input type="text" style={{ ...invoer, width: "100%" }} value={pot.naam} onChange={(e) => updatePot(pot.id, "naam", e.target.value)} />
          </label>
          <label style={{ fontSize: 11, color: "#8A8171" }}>bedrag per keer<br />
            <input className="num-input" type="number" value={pot.bedrag} onChange={(e) => updatePot(pot.id, "bedrag", parseFloat(e.target.value) || 0)} />
          </label>
          <label style={{ fontSize: 11, color: "#8A8171" }}>keer per jaar<br />
            <select style={invoer} value={pot.frequentiePerJaar || 1} onChange={(e) => updatePot(pot.id, "frequentiePerJaar", parseInt(e.target.value, 10))}>
              {[1, 2, 3, 4, 6, 12].map((n) => <option key={n} value={n}>{n}x</option>)}
            </select>
          </label>
          <label style={{ fontSize: 11, color: "#8A8171" }}>volgende vervaldatum<br />
            <input className="date-input" type="date" value={pot.verwachteDatum} onChange={(e) => updatePot(pot.id, "verwachteDatum", e.target.value)} />
          </label>
          <button className="btab" onClick={() => (wis ? removePot(pot.id) : setWis(true))} onBlur={() => setWis(false)}
            style={{ fontSize: 11.5, fontWeight: 600, color: "#B3492A", border: "1px solid #E7B7A6", borderRadius: 8, padding: "6px 10px" }}>
            {wis ? "Zeker weten? Nogmaals klikken" : "Potje verwijderen"}
          </button>
        </div>
      )}

      {hist.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px solid #EEE9DD", paddingTop: 8 }}>
          {toon.map((h) => (
            <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12 }}>
              <span style={{ color: "#3A362E" }}>
                {fmtDatum(h.datum) || h.periodeKey} · {label[h.soort]} {eur(Math.abs(h.bedrag))}
                {h.soort === "betaling" && h.tekort > 0.005 ? ` (waarvan ${eur(h.tekort)} extra uit maandbudget)` : ""}
                {h.datumNa && h.datumNa !== h.datumVoor ? `, nieuwe datum ${fmtDatum(h.datumNa)}` : ""}
              </span>
              <button className="btab" onClick={() => undoPot(h.periodeKey, h.lijst, h.id)} style={{ fontSize: 11, color: "#8A8171", whiteSpace: "nowrap" }}>ongedaan maken</button>
            </div>
          ))}
          {hist.length > 3 && (
            <button className="btab" onClick={() => setAlleHist((a) => !a)} style={{ fontSize: 11.5, color: "#0F5C52", marginTop: 4 }}>
              {alleHist ? "minder tonen" : `alle ${hist.length} mutaties tonen`}
            </button>
          )}
        </div>
      )}
    </Kaart>
  );
}

export function JaarpotjesTab({ vasteJaarlijks, monthly, payPeriodStartDay, today, doPot, undoPot, updatePot, addPot, removePot }) {
  const ctx = { today, startDay: payPeriodStartDay };
  const potten = vasteJaarlijks
    .map((p) => ({ pot: p, plan: potPlan(p, monthly, ctx) }))
    .sort((a, b) => a.pot.verwachteDatum.localeCompare(b.pot.verwachteDatum));
  const totSaldo = potten.reduce((s, x) => s + x.plan.saldo, 0);
  const totStreef = potten.reduce((s, x) => s + x.plan.streef, 0);
  const totGestort = potten.reduce((s, x) => s + x.plan.gestort, 0);
  const totNog = potten.reduce((s, x) => s + x.plan.nogTeStorten, 0);
  const aantalAchter = potten.filter((x) => x.plan.achter).length;
  const stat = (l, v, c) => (
    <div><div style={{ fontSize: 11.5, color: "#8A8171" }}>{l}</div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 17, fontWeight: 600, color: c || "#1F2937" }}>{v}</div></div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Kaart>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <PiggyBank size={18} color="#0F5C52" />
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16 }}>Jaarpotjes</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {stat("Totaal in potjes", eur(totSaldo))}
          {stat("Streef deze periode", eur(totStreef))}
          {stat("Gestort deze periode", eur(totGestort), totGestort >= totStreef - 0.005 ? "#2F7A5C" : "#C08A2E")}
          {stat("Nog te storten", eur(totNog), totNog > 0.005 ? "#C08A2E" : "#2F7A5C")}
        </div>
        {aantalAchter > 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#B3492A", display: "flex", alignItems: "center", gap: 4 }}>
            <AlertTriangle size={12} /> {aantalAchter} {aantalAchter === 1 ? "potje loopt" : "potjes lopen"} achter op schema
          </div>
        )}
      </Kaart>

      {potten.map(({ pot, plan }) => (
        <PotKaart key={pot.id} pot={pot} plan={plan} hist={historie(monthly, pot.id)} today={today}
          doPot={doPot} undoPot={undoPot} updatePot={updatePot} removePot={removePot} />
      ))}
      {potten.length === 0 && <div style={{ fontSize: 12.5, color: "#8A8171" }}>Nog geen jaarpotjes. Voeg je eerste toe.</div>}

      <EenmaligKaart monthly={monthly} doPot={doPot} undoPot={undoPot} />

      <button className="btab" onClick={addPot} style={{ ...knop(false), alignSelf: "flex-start", padding: "8px 14px" }}>+ Potje toevoegen</button>
    </div>
  );
}

// Compacte samenvatting voor het tabblad "Deze maand", met doorverwijzing naar het potjes-tabblad.
export function PotjesMaandKaart({ gestort, streef, tekort, onOpen }) {
  return (
    <Kaart>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15 }}>Jaarpotjes</div>
          <div style={{ fontSize: 12, color: "#8A8171", marginTop: 2 }}>
            Gestort {eur(gestort)} van {eur(streef)}
            {tekort > 0.005 ? ` · ${eur(tekort)} extra betaald uit maandbudget` : ""}
          </div>
        </div>
        <button className="btab" style={knop(false)} onClick={onOpen}>Open potjes</button>
      </div>
    </Kaart>
  );
}

// Eenmalige jaarlijkse lasten zonder eigen potje (bv. een onverwachte aanslag): volledig uit het maandbudget.
function EenmaligKaart({ monthly, doPot, undoPot }) {
  const [open, setOpen] = useState(false);
  const [naam, setNaam] = useState("");
  const [bedrag, setBedrag] = useState("");
  const lijst = [];
  Object.entries(monthly).forEach(([pk, e]) =>
    (e.jaarlijkseBetalingen || []).forEach((x) => { if (!x.itemId) lijst.push({ ...x, periodeKey: pk }); })
  );
  sorteerNieuwsteEerst(lijst);
  const bewaar = () => {
    const b = parseFloat(bedrag);
    if (!(b > 0)) return;
    doPot({ type: "eenmalig", naam, bedrag: b });
    setNaam(""); setBedrag(""); setOpen(false);
  };
  return (
    <Kaart>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15 }}>Eenmalige betalingen</div>
          <div style={{ fontSize: 11.5, color: "#8A8171", marginTop: 2 }}>Een last zonder eigen potje. Het bedrag komt volledig uit je maandbudget.</div>
        </div>
        <button className="btab" style={knop(false)} onClick={() => setOpen((o) => !o)}>{open ? "Sluiten" : "+ Toevoegen"}</button>
      </div>
      {open && (
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input type="text" placeholder="Omschrijving" style={{ ...invoer, flex: "1 1 140px", minWidth: 0 }} value={naam} onChange={(e) => setNaam(e.target.value)} />
          <input className="num-input" type="number" step="0.01" inputMode="decimal" placeholder="0" value={bedrag} onChange={(e) => setBedrag(e.target.value)} />
          <button className="btab" style={knop(true)} onClick={bewaar}>Betaling bewaren</button>
        </div>
      )}
      {lijst.slice(0, 5).map((x) => (
        <div key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "5px 0", marginTop: 4, borderTop: "1px solid #EEE9DD", fontSize: 12 }}>
          <span>{fmtDatum(x.datum) || x.periodeKey} · {x.naam} {eur(x.bedrag)}</span>
          <button className="btab" onClick={() => undoPot(x.periodeKey, "jaarlijkseBetalingen", x.id)} style={{ fontSize: 11, color: "#8A8171", whiteSpace: "nowrap" }}>ongedaan maken</button>
        </div>
      ))}
    </Kaart>
  );
}

// Vervangt JaarplanningCard + buildJaarplanning op het tabblad Overzicht.
// Eerste vervaldatum: echte status van het potje. Latere cycli: neutraal "nog niet gestart".
export function JaarplanningKaart({ vasteJaarlijks, monthly, payPeriodStartDay, today }) {
  const ctx = { today, startDay: payPeriodStartDay };
  const horizon = addMonthsToDate(today, 12);
  const items = [];
  vasteJaarlijks.forEach((v) => {
    const cyclus = cycleMonths(v.frequentiePerJaar);
    let datum = v.verwachteDatum;
    for (let g = 0, eerste = true; datum <= horizon && g < 24; g++, eerste = false) {
      items.push({ key: `${v.id}-${datum}`, naam: v.naam, datum, bedrag: Number(v.bedrag) || 0, cyclus, plan: eerste ? potPlan(v, monthly, ctx) : null });
      datum = addMonthsToDate(datum, cyclus);
    }
  });
  items.sort((a, b) => a.datum.localeCompare(b.datum));
  const groepen = [];
  items.forEach((it) => {
    const k = periodKey(it.datum, payPeriodStartDay);
    let g = groepen.find((x) => x.k === k);
    if (!g) { const [y, m] = k.split("-").map(Number); g = { k, label: `Vanaf ${payPeriodStartDay} ${MND[m - 1]} ${y}`, items: [] }; groepen.push(g); }
    g.items.push(it);
  });

  return (
    <Kaart>
      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Jaarplanning</div>
      <div style={{ fontSize: 11.5, color: "#8A8171", marginBottom: 12 }}>Wanneer elke jaarlijkse last het komende jaar vervalt en hoe het potje ervoor staat.</div>
      {groepen.length === 0 && <div style={{ fontSize: 12, color: "#B8AF9C" }}>Nog geen jaarlijkse lasten ingesteld.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {groepen.map((g) => (
          <div key={g.k}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#0F5C52", marginBottom: 6 }}>{g.label}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {g.items.map((it) => {
                let tekst, kleur = "#8A8171";
                if (it.plan && it.plan.gedekt) { tekst = "volledig gedekt"; kleur = "#2F7A5C"; }
                else if (it.plan && it.datum < today) { tekst = "vervaldatum verstreken: boek de betaling"; kleur = "#B3492A"; }
                else if (it.plan) { tekst = `nog ${eur(Math.max(0, it.bedrag - it.plan.saldo))} te sparen, ${eur(it.plan.streef)} per periode`; kleur = it.plan.achter ? "#B3492A" : "#C08A2E"; }
                else tekst = `nog niet gestart, ca. ${eur(it.bedrag / it.cyclus)} per maand zodra je begint`;
                return (
                  <div key={it.key} style={{ background: "#FBFAF6", border: "1px solid #EEE9DD", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, fontWeight: 500 }}>
                      <span>{it.naam}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#3A362E", whiteSpace: "nowrap" }}>{eur(it.bedrag)}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: kleur, marginTop: 2 }}>{fmtDatum(it.datum)} · {tekst}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Kaart>
  );
}
