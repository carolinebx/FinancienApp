# Huishoudboekje

Een standalone versie van je budget-app (React + Vite), klaar om te hosten op Netlify,
met een Google Sheet als dataopslag in plaats van Claude's ingebouwde opslag.

## Snelstart

1. **Koppel je Google Sheet** — volg `GOOGLE_SHEET_SETUP.md` (5 minuten).
2. **Zet de app online** — volg `NETLIFY_DEPLOY.md` (2 minuten met de sleep-en-neerzet route).
3. **Zet 'm op je beginscherm** — open je nieuwe Netlify-URL in Safari en kies "Zet op
   beginscherm". Werkt nu wél in één keer, zonder de omweg via claude.ai.

## Lokaal testen (optioneel)

```
npm install
npm run dev
```

Opent op `http://localhost:5173`. Werkt pas met echte dataopslag zodra `src/config.js`
is ingevuld — tot die tijd zie je een banner bovenin en werkt de app alleen tijdens de
sessie (weg na herladen).

## Projectstructuur

```
src/App.jsx        — de volledige app (budgetten, spaardoelen, vaste lasten, rekeningen)
src/storage.js      — praat met je Google Sheet (get/set/delete/list)
src/config.js        — hier vul je je Sheet-URL en wachtwoord in
google-apps-script/  — code om in Google Sheets' Apps Script te plakken
netlify.toml          — build-instellingen voor Netlify
```
