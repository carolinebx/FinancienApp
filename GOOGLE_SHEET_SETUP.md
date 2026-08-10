# Google Sheet koppelen (5 minuten)

De app slaat al je gegevens op als één stukje tekst (JSON) in een Google Sheet, via een
gratis "Web App" die Google zelf host (Apps Script). Je hebt geen Google Cloud-account
of API-sleutel nodig — alleen een gewone Google Sheet.

## Stap 1 — Maak de Sheet

1. Ga naar [sheets.google.com](https://sheets.google.com) en maak een nieuwe, lege sheet.
2. Geef 'm een naam, bijvoorbeeld "Huishoudboekje data".

## Stap 2 — Voeg het script toe

1. Ga in de sheet naar **Extensies → Apps Script**.
2. Verwijder de voorbeeldcode die er staat.
3. Open het bestand `google-apps-script/Code.gs` uit dit project, kopieer de hele inhoud
   en plak die in de Apps Script-editor.
4. Kies zelf een eigen wachtwoord en vervang daarmee de tekst
   `kies-hier-een-eigen-geheim-wachtwoord` op de regel `var TOKEN = ...`.
5. Sla op (het schijfje-icoon of Ctrl/Cmd+S).

## Stap 3 — Publiceer als Web App

1. Klik rechtsboven op **Implementeren → Nieuwe implementatie**.
2. Kies bij "Type selecteren" het tandwiel-icoon → **Webapp**.
3. Instellingen:
   - **Uitvoeren als:** Ik (jouw eigen Google-account)
   - **Toegang:** Iedereen
4. Klik op **Implementeren**. Google vraagt de eerste keer om toestemming — accepteer dit
   (het is jouw eigen script, dat alleen bij deze ene sheet mag).
5. Kopieer de getoonde **Web-app-URL** (ziet er ongeveer uit als
   `https://script.google.com/macros/s/AKfycb.../exec`).

## Stap 4 — Koppel de app

1. Open `src/config.js` in dit project.
2. Plak de URL uit stap 3 bij `SHEET_API_URL`.
3. Vul bij `API_TOKEN` exact hetzelfde wachtwoord in dat je in Stap 2.4 hebt gekozen.
4. Sla op.

Dat is alles — de app leest en schrijft nu naar een tabblad "storage" dat automatisch
in je sheet wordt aangemaakt zodra de app voor het eerst iets opslaat.

## Belangrijk om te weten

- Iedereen die de `SHEET_API_URL` én het juiste `API_TOKEN` heeft, kan bij je data. Dit is
  een simpele bescherming, geen echte beveiliging — deel deze URL dus niet.
- Als je later een update wilt doorvoeren aan het script (`Code.gs`), moet je opnieuw
  **Implementeren → Nieuwe implementatie** doen (of een bestaande implementatie beheren
  via "Implementaties beheren") om de wijziging live te zetten.
- Wil je de data zelf ooit inzien of aanpassen? Open het tabblad "storage" in je sheet —
  kolom A is de sleutel (altijd `budget-tracker-v2`), kolom B is de volledige JSON-inhoud
  van je budget. Handmatig bewerken kan, maar wees voorzichtig: de app verwacht geldige JSON.
