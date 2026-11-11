import React, { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";

// =====================================================================
// Budget: (1) de kaart "Nog te besteden" (vervangt "Uitgegeven & nog te besteden"
// én "Ruimte deze maand") en (2) het uitklapmenu per budgetpotje met de
// transacties waaraan het geld is uitgegeven.
// =====================================================================

const MND = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const num = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);
const eur0 = (n) => num(n).toLocaleString("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = (n) => num(n).toLocaleString("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mono = "'IBM Plex Mono', monospace";
const GROEN = "#2F7A5C", ROOD = "#B3492A", GEEL = "#C08A2E";

const fmtDatum = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return y ? `${d} ${MND[m - 1]}` : "";
};

// Aantal dagen (inclusief vandaag) tot en met de laatste dag van de loonperiode.
// Voorbije periode: 0. Toekomstige periode: de volledige lengte.
export function dagenResterend(periodeKey, startDay, todayIso) {
  const [y, m] = periodeKey.split("-").map(Number);
  const start = new Date(y, m - 1, startDay, 12);
  const eind = new Date(y, m, startDay - 1, 12);
  const [ty, tm, td] = todayIso.split("-").map(Number);
  const t = new Date(ty, tm - 1, td, 12);
  if (t > eind) return 0;
  const vanaf = t < start ? start : t;
  return Math.round((eind - vanaf) / 86400000) + 1;
}

const Kaart = ({ children, style }) => (
  <div style={{ background: "#FFFFFF", border: "1px solid #E4DFD6", borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 2px rgba(31,41,55,0.04)", ...style }}>{children}</div>
);
const Balk = ({ pct, kleur }) => (
  <div style={{ height: 8, borderRadius: 999, background: "#E7E1D4", overflow: "hidden" }}>
    <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: kleur, borderRadius: 999, transition: "width 300ms ease" }} />
  </div>
);
const toonKleur = (pct) => (pct > 100 ? ROOD : pct > 85 ? GEEL : GROEN);

function Rij({ label, sub, waarde, kleur, vet }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontWeight: vet ? 600 : 400 }}>
        <span style={{ flex: 1, minWidth: 0, color: "#3A362E", fontSize: 13 }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: 13, whiteSpace: "nowrap", color: kleur || "#1F2937" }}>{waarde}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: "#8A8171", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------
// Kaart "Nog te besteden"
// ---------------------------------------------------------------------
export function RuimteKaart({
  variable, monthData, geplandeUitgaven, effectiefBudget,
  variabelBudgetTotaal, variabelBestedTotaal, variabelOver,
  sparenDezeMaand, sparenVolledigBudget, gemSparen, bufferBedrag,
  extraRuimte, extra, currentMonth, startDay, today,
}) {
  const [alle, setAlle] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);

  const pct = variabelBudgetTotaal > 0 ? (variabelBestedTotaal / variabelBudgetTotaal) * 100 : 0;
  const dagen = dagenResterend(currentMonth, startDay, today);
  const perDag = dagen > 0 && variabelOver > 0 ? variabelOver / dagen : null;

  const rijen = variable
    .map((cat) => {
      const gepland = geplandeUitgaven.filter((e) => e.categorieId === cat.id).reduce((a, e) => a + num(e.bedrag), 0);
      const spent = num(monthData.spent && monthData.spent[cat.id]) + gepland;
      const budget = effectiefBudget(cat);
      const gebruikt = budget > 0 ? spent / budget : spent > 0 ? Infinity : 0;
      return { id: cat.id, naam: cat.naam, spent, budget, over: budget - spent, gebruikt };
    })
    .sort((a, b) => b.gebruikt - a.gebruikt);
  const zichtbaar = alle ? rijen : rijen.slice(0, 4);
  const overschreden = rijen.filter((r) => r.over < -0.005);

  return (
    <Kaart>
      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16, marginBottom: 12 }}>Nog te besteden</div>

      <div style={{ fontFamily: mono, fontSize: 28, fontWeight: 600, lineHeight: 1.1, color: variabelOver >= 0 ? GROEN : ROOD }}>
        {variabelOver >= 0 ? eur2(variabelOver) : `−${eur2(Math.abs(variabelOver))}`}
      </div>
      <div style={{ fontSize: 12.5, color: "#6B6353", marginTop: 4 }}>
        {variabelOver >= 0 ? "nog binnen je budgetten" : "boven je totale budget"} · {eur2(variabelBestedTotaal)} uitgegeven van {eur0(variabelBudgetTotaal)}
      </div>
      <div style={{ marginTop: 10 }}><Balk pct={pct} kleur={toonKleur(pct)} /></div>
      {perDag !== null && (
        <div style={{ fontSize: 12.5, color: "#3A362E", marginTop: 8 }}>
          Dat is ongeveer <strong style={{ fontFamily: mono }}>{eur2(perDag)}</strong> per dag voor de nog {dagen} {dagen === 1 ? "dag" : "dagen"} van deze periode.
        </div>
      )}
      {overschreden.length > 0 && (
        <div style={{ fontSize: 12, color: ROOD, marginTop: 8, display: "flex", gap: 5, alignItems: "flex-start" }}>
          <AlertTriangle size={12} style={{ marginTop: 2, flexShrink: 0 }} />
          <span>Over budget: {overschreden.map((r) => `${r.naam} (${eur0(-r.over)})`).join(", ")}. Dat gaat ten koste van je sparen.</span>
        </div>
      )}

      <div style={{ marginTop: 16, borderTop: "1px solid #EEE9DD", paddingTop: 12 }}>
        <div style={{ fontSize: 12, color: "#8A8171", marginBottom: 8 }}>{alle ? "Alle budgetten" : "Meest gebruikt"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {zichtbaar.map((r) => {
            const p = r.budget > 0 ? (r.spent / r.budget) * 100 : r.spent > 0 ? 100 : 0;
            return (
              <div key={r.id}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 13 }}>
                  <span style={{ flex: 1, minWidth: 0, color: "#3A362E" }}>{r.naam}</span>
                  <span style={{ fontFamily: mono, fontSize: 11.5, color: "#8A8171", whiteSpace: "nowrap" }}>{eur0(r.spent)} / {eur0(r.budget)}</span>
                  <span style={{ fontFamily: mono, fontWeight: 600, fontSize: 12.5, minWidth: 74, textAlign: "right", whiteSpace: "nowrap", color: r.over >= 0 ? GROEN : ROOD }}>
                    {r.over >= 0 ? `nog ${eur0(r.over)}` : `−${eur0(-r.over)}`}
                  </span>
                </div>
                <div style={{ marginTop: 3 }}><Balk pct={p} kleur={toonKleur(p)} /></div>
              </div>
            );
          })}
        </div>
        {rijen.length > 4 && (
          <button className="btab" onClick={() => setAlle((a) => !a)} style={{ fontSize: 12, fontWeight: 600, color: "#0F5C52", marginTop: 10 }}>
            {alle ? "Minder tonen" : `Alle ${rijen.length} budgetten tonen`}
          </button>
        )}
      </div>

      <div style={{ marginTop: 16, borderTop: "1px solid #EEE9DD", paddingTop: 12 }}>
        <div style={{ fontSize: 12, color: "#8A8171", marginBottom: 8 }}>Wat dit voor je sparen betekent</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <Rij label="Over op dit moment" sub="inkomen min vaste lasten en wat je al hebt uitgegeven"
            waarde={eur2(sparenDezeMaand)} kleur={sparenDezeMaand >= 0 ? GROEN : ROOD} vet />
          <Rij label="Verwacht over als je je hele budget uitgeeft" waarde={eur2(sparenVolledigBudget)} />
          <Rij label="Gemiddeld per maand" waarde={eur2(gemSparen)} />
          {bufferBedrag > 0.005 && <Rij label="Buffer" sub="gereserveerd, niet beschikbaar als extra" waarde={eur2(bufferBedrag)} />}
        </div>
      </div>

      {extra && (
        <div style={{ marginTop: 14, borderTop: "1px solid #EEE9DD", paddingTop: 10 }}>
          <button className="btab" onClick={() => setExtraOpen((o) => !o)}
            style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#0F5C52" }}>
            {extraOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            <span style={{ flex: 1 }}>Ruimte voor iets extra's</span>
            <span style={{ fontFamily: mono, fontSize: 12.5 }}>{eur2(extraRuimte)}</span>
          </button>
          {extraOpen && extra}
        </div>
      )}
    </Kaart>
  );
}

// ---------------------------------------------------------------------
// Uitklapmenu per budgetpotje: waaraan is het uitgegeven?
// ---------------------------------------------------------------------
export function CategorieUitklap({ cat, monthData, gepland, variable, addTransactie, removeTransactie, moveTransactie }) {
  const [open, setOpen] = useState(false);
  const [omschr, setOmschr] = useState("");
  const [bedrag, setBedrag] = useState("");

  const tx = (monthData.transacties || [])
    .filter((t) => t.categorieId === cat.id)
    .sort((a, b) => `${b.datum || ""}${b.id}`.localeCompare(`${a.datum || ""}${a.id}`));
  const somTx = tx.reduce((a, t) => a + num(t.bedrag), 0);
  const rest = num(monthData.spent && monthData.spent[cat.id]) - somTx;
  const aantal = tx.length + gepland.length + (Math.abs(rest) > 0.005 ? 1 : 0);

  const voegToe = () => {
    const b = parseFloat(bedrag);
    if (!(b > 0)) return;
    addTransactie(cat.id, omschr, b);
    setOmschr(""); setBedrag("");
  };
  const invoer = { fontFamily: "'Inter', sans-serif", fontSize: 12.5, border: "1px solid #D8D2C4", borderRadius: 8, padding: "5px 8px", background: "#FBFAF6" };

  return (
    <div style={{ marginTop: 8 }}>
      <button className="btab" onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#0F5C52" }}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Waar aan uitgegeven{aantal > 0 ? ` (${aantal})` : ""}
      </button>

      {open && (
        <div style={{ marginTop: 6, padding: "8px 10px", background: "#FBFAF6", border: "1px solid #EEE9DD", borderRadius: 10 }}>
          {aantal === 0 && <div style={{ fontSize: 12, color: "#B8AF9C", padding: "2px 0 6px" }}>Nog geen uitgaven in deze categorie. Importeer een bankexport of voeg hieronder een uitgave toe.</div>}

          {tx.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "6px 0", borderBottom: "1px solid #EEE9DD" }}>
              <div style={{ flex: "1 1 150px", minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.omschrijving}</div>
                <div style={{ fontSize: 10.5, color: "#8A8171" }}>{fmtDatum(t.datum)}{t.datum ? " · " : ""}{t.bron === "import" ? "bankimport" : "handmatig"}</div>
              </div>
              <span style={{ fontFamily: mono, fontSize: 12.5, whiteSpace: "nowrap" }}>{eur2(t.bedrag)}</span>
              <select value="" onChange={(e) => e.target.value && moveTransactie(t.id, e.target.value)}
                style={{ ...invoer, fontSize: 11, padding: "3px 4px", maxWidth: 104 }} aria-label="Verplaats naar andere categorie">
                <option value="">verplaats…</option>
                {variable.filter((c) => c.id !== cat.id).map((c) => <option key={c.id} value={c.id}>{c.naam}</option>)}
              </select>
              <button className="btab" onClick={() => removeTransactie(t.id)} style={{ fontSize: 11, color: "#8A8171" }}>verwijder</button>
            </div>
          ))}

          {gepland.map((g) => (
            <div key={g.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid #EEE9DD" }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{g.naam}</div>
                <div style={{ fontSize: 10.5, color: "#8A8171" }}>gepland vanuit je wenslijst</div>
              </div>
              <span style={{ fontFamily: mono, fontSize: 12.5 }}>{eur2(g.bedrag)}</span>
            </div>
          ))}

          {Math.abs(rest) > 0.005 && (
            <div style={{ padding: "6px 0", borderBottom: "1px solid #EEE9DD" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>{rest > 0 ? "Overig, zelf ingevuld" : "Aanpassing"}</span>
                <span style={{ fontFamily: mono, fontSize: 12.5 }}>{rest < 0 ? "−" : ""}{eur2(Math.abs(rest))}</span>
              </div>
              <div style={{ fontSize: 10.5, color: "#8A8171" }}>
                {rest > 0 ? "Bedrag uit het invulveld dat niet bij een transactie hoort." : "Het invulveld staat lager dan de som van de transacties."}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
            <input type="text" placeholder="Omschrijving" value={omschr} onChange={(e) => setOmschr(e.target.value)} style={{ ...invoer, flex: "1 1 120px", minWidth: 0 }} />
            <input className="num-input" style={{ width: 80 }} type="number" step="0.01" inputMode="decimal" placeholder="0" value={bedrag} onChange={(e) => setBedrag(e.target.value)} />
            <button className="btab" onClick={voegToe}
              style={{ fontSize: 12, fontWeight: 600, color: "#FFFFFF", background: "#0F5C52", borderRadius: 8, padding: "6px 11px" }}>
              Uitgave toevoegen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
