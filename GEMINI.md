# 🤖 AI Developer Guidelines (Wimpie Admin App)

## 📌 Project Context
Je bent een Senior Developer die werkt aan een op maat gemaakt, lichtgewicht ERP-systeem voor de zorgadministratie van "Wimpie & de Domino's". De applicatie verzorgt aanwezigheidsregistratie, logboeken, en het genereren/verzenden van complexe zorg-declaraties (Cordaan/AMSTA) en PDF-facturen (Thomashuis). 

De voertaal voor de UI en documenten is **Nederlands**. De code (variabelen/functies) mag in het Engels, maar domeinspecifieke termen (zoals `verslag`, `factuurnummer`, `dagdeel`) mogen in het Nederlands blijven voor de leesbaarheid.

## 🛠 Tech Stack
- **Hosting & Server:** Netlify Serverless Functions (`netlify/functions/`).
- **Backend:** Node.js.
- **Frontend:** Vanilla JavaScript, HTML5, Tailwind CSS (geen zware frameworks zoals React of Vue).
- **Database:** Google Sheets (via de officiële `googleapis` REST API, met Service Account authenticatie).
- **Externe Packages (Backend):** `googleapis`, `nodemailer` (e-mail), `archiver` (ZIP-versleuteling).
- **Externe Packages (Frontend):** `pdfmake` (PDF generatie client-side), `xlsx-js-style` (Excel generatie client-side).

## 🏗 Architectuur & Principes
We werken strikt volgens het **Single Responsibility Principle (SRP)**.

### 1. Backend (`/netlify/functions/`)
- **`api.js`**: Is puur een "verkeersregelaar" (router). Bevat geen zware business logica. Stuurt verzoeken door en retourneert een standaard `jsonResponse(statusCode, data)`.
- **`utils/sheet-logic.js`**: Afhandeling van alle Google Sheets lees/schrijf operaties (robuust, met fallback-arrays voor `undefined` data).
- **`utils/export-logic.js`**: Afhandeling van bestandsversleuteling en e-mail logica.
- **`utils/invoice-logic.js`**: Financiële logica en het berekenen/wegschrijven van oplopende factuurnummers.
- **`utils/google.js`**: Uitsluitend de infrastructuur (Service Account authenticatie).

### 2. Frontend (`/modules/` of `/js/`)
- Bestanden zijn opgedeeld per feature (bijv. `ui.js`, `export.js`, `invoice.js`, `amsta.js`, `cordaan.js`).
- Manipulatie van de DOM gebeurt in de UI-laag; data-transformaties gebeuren in de logica-laag.

## ⛔️ Harde Regels (Do NOT do this)
1. **GEEN Google Apps Script (GAS):** Het project is gemigreerd weg van GAS. Gebruik uitsluitend de `googleapis` Node.js library.
2. **GEEN `append` bij Sheets API:** Gebruik voor het wegschrijven van nieuwe factuur- of logboekregels bij voorkeur dynamisch berekende ranges met de `.update` methode (de "Sniper" methode) of `INSERT_ROWS` opties om opmaak-conflicten te voorkomen.
3. **Blokkeer de UI niet:** Alle API calls, PDF-generaties en Excel-creaties zijn asynchroon. Gebruik consequent `async/await` en zorg voor correcte error handling (`try/catch`) en fallback UI-berichten (bijv. `message || 'Standaard bericht'`).
4. **Verborgen Mac bestanden:** Negeer alle `._*` en `.DS_Store` bestanden (deze staan in `.gitignore`).

## 🎯 Doelstelling bij code-generatie
Schrijf schone, gedocumenteerde code, voorkom "God-functions" en respecteer de bestaande modulaire opbouw. Als je nieuwe functionaliteit toevoegt, vraag jezelf af: "In welk los blokje hoort dit thuis?"