# Op Netlify zetten

Ik kan dit niet voor je klikken (ik heb geen toegang tot jouw Netlify-account), maar met
onderstaande stappen sta je in een paar minuten live. Er zijn twee routes — kies de
makkelijkste voor jou.

## Route A — Slepen en neerzetten (geen account bij GitHub nodig)

Snelst, maar je moet zelf opnieuw builden en uploaden bij elke wijziging.

1. Zorg dat je `src/config.js` hebt ingevuld (zie `GOOGLE_SHEET_SETUP.md`).
2. Open een terminal in dit projectmapje en run:
   ```
   npm install
   npm run build
   ```
   Dit maakt een map `dist/` met de kant-en-klare, statische website.
3. Ga naar [app.netlify.com/drop](https://app.netlify.com/drop) (gratis account nodig,
   aanmelden kan met je Google- of e-mailadres).
4. Sleep de hele `dist`-map in het vak op die pagina.
5. Klaar — je krijgt direct een live URL zoals `https://iets-random.netlify.app`.
6. Optioneel: ga naar **Site settings → Change site name** om een leukere naam te kiezen.

## Route B — Via GitHub (automatisch opnieuw deployen bij elke wijziging)

Iets meer werk om op te zetten, maar daarna hoef je nooit meer handmatig te builden.

1. Zet dit hele projectmapje in een nieuwe GitHub-repository (bijvoorbeeld via
   [github.com/new](https://github.com/new), of met GitHub Desktop als je niet met de
   command line werkt).
2. Ga naar [app.netlify.com](https://app.netlify.com) → **Add new site → Import an
   existing project**.
3. Kies GitHub en selecteer je nieuwe repository.
4. Netlify herkent automatisch de instellingen uit `netlify.toml`
   (build command `npm run build`, publish map `dist`) — je hoeft niets aan te passen.
5. Klik op **Deploy**.

Vanaf nu wordt de site automatisch opnieuw gebouwd zodra je iets naar GitHub pusht.

## Na het deployen: toevoegen aan je beginscherm

Omdat dit nu een "echte" website is (geen claude.ai meer), werkt "Zet op beginscherm" in
Safari eindelijk zoals verwacht: open je Netlify-URL, tik op het deel-icoon, kies "Zet op
beginscherm", en de app opent voortaan schermvullend zonder adresbalk — inclusief het
appicoontje. Het inlog-probleem dat je eerder had met de claude.ai-link speelt hier niet,
want deze site heeft geen Claude-login nodig.
