# 🤖 AI Developer Guidelines (Wimpie Admin App)

## 📌 Project Context
Je bent een Senior Developer die werkt aan een op maat gemaakt, lichtgewicht ERP-systeem voor de zorgadministratie van **"Wimpie & de Domino's"**. De applicatie verzorgt aanwezigheidsregistratie, logboeken, het verwerken van onkosten/declaraties (Cordaan/AMSTA), betalingsherinneringen (aanmaningen) en het genereren/verzenden van PDF-facturen (Thomashuis).

* **Voertaal UI & Documenten:** Nederlands.
* **Code Conventies:** Variabelen/functies in het Engels, maar domeinspecifieke termen (zoals `verslag`, `factuurnummer`, `dagdeel`, `aanmaning`) mogen in het Nederlands blijven voor de leesbaarheid.

---

## 🛠 Tech Stack & Dev Commands

### Tech Stack
* **Hosting & Server:** Netlify Serverless Functions (`netlify/functions/`).
* **Backend:** Node.js.
* **Frontend:** Vanilla JavaScript (ES modules), HTML5, Tailwind CSS (geen zware frameworks zoals React of Vue).
* **Database:** Google Sheets via de officiële `googleapis` REST API (met Service Account authenticatie).
* **Backend Packages:** `googleapis`, `nodemailer` (e-mail), `archiver` (ZIP-versleuteling).
* **Frontend Packages:** `pdfmake` (PDF-generatie client-side), `xlsx-js-style` (Excel-generatie client-side).

### Commands
```bash
# Dependencies installeren
npm install

# Lokale dev server starten met Netlify Functions
npx netlify dev

# Deployen naar Netlify Production
npx netlify deploy --prod
```
> *Opmerking: Er zijn op dit moment geen geautomatiseerde tests geconfigureerd.*

---

## 🏗 Architectuur & Principes
We werken strikt volgens het **Single Responsibility Principle (SRP)**. Voorkom "God-functions" en respecteer de bestaande modulaire opbouw. Als je nieuwe functionaliteit toevoegt, vraag jezelf af: *"In welk los module-blokje hoort dit thuis?"*

### 1. Frontend (`/modules/` of `/js/`)
`app.js` is het entry point — initialiseert auth, event listeners en stelt globals beschikbaar aan HTML `onclick` attributen via `window.*`.
DOM-manipulatie gebeurt uitsluitend in de UI-laag; data-transformaties gebeuren in de logica-laag.

* **Kern & Auth:** `app.js`, `state.js` (gedeelde applicatiestatus), `auth.js` (toegangscontrole), `utils.js` (gedeelde hulpmiddelen zoals `runSafe`).
* **UI & API:** `ui.js` (DOM/tab-rendering), `api.js` (alle `fetch`-calls naar de Netlify backend).
* **Features & Declaraties:**
  * `export.js` / `ui-export.js` — Export orchestratie & UI.
  * `expenses.js` / `ui-expenses.js` — Onkostenberekening & UI.
  * `amsta.js` / `amsta-invoice.js` — AMSTA-declaratielogica & factuur-generatie.
  * `cordaan.js` / `cordaan-invoice.js` — Cordaan-declaratielogica & factuur-generatie.
  * `thomashuis.js` — Thomashuis-specifieke factuurlogica.
  * `aanmaning.js` — Betalingsherinneringen / aanmaningslogica.

### 2. Backend (`/netlify/functions/`)
* **`api.js`**: Puur een "verkeersregelaar" (router). Bevat geen zware business logica. Stuurt verzoeken door en retourneert een standaard `jsonResponse(statusCode, data)`.
* **`ai-writer.js`**: Endpoint voor AI-tekstverbetering.
* **`utils/google.js`**: Uitsluitend infrastructuur en authenticatie (Service Account).
* **`utils/sheet-logic.js`**: Afhandeling van alle Google Sheets lees/schrijf operaties (robuust, met fallback-arrays voor `undefined` data).
* **`utils/invoice-logic.js`**: Financiële logica en het berekenen/wegschrijven van opeenvolgende factuurnummers.
* **`utils/export-logic.js`**: Bestandsversleuteling en e-mail orchestratie.
* **`utils/mailer.js`**: E-mail verzending via `nodemailer`.
* **`utils/aanmaning-logic.js`**: Business logica voor betalingsherinneringen.
* **`utils/expense-logic.js`**: Business logica voor onkostenberekening.

---

## ⛔️ Harde Regels (Do NOT do this)

1. **GEEN Google Apps Script (GAS):** Het project is gemigreerd weg van GAS. Gebruik uitsluitend de `googleapis` Node.js library.
2. **GEEN `append` bij Sheets API:** Gebruik voor het wegschrijven van nieuwe factuur- of logboekregels dynamisch berekende ranges met de `.update` methode (de "Sniper" methode) of `INSERT_ROWS` opties om opmaak-conflicten te voorkomen.
3. **Blokkeer de UI niet (Async everywhere):** Alle API calls, PDF- en Excel-generaties zijn asynchroon. Gebruik consequent `async/await`, zorg voor correcte error handling (`try/catch`) en gebruik fallback UI-berichten (bijv. `message || 'Standaard bericht'`).
4. **Verborgen Mac bestanden:** Negeer alle `._*` en `.DS_Store` bestanden (deze staan in `.gitignore`).
5. **GEEN spin-buttons (pijltjes) bij getal-invoervelden:** Verberg standaard altijd de omhoog/omlaag pijltjes bij getal-invoervelden (`input[type=number]`) via CSS (`styles.css`) om de UI strak, minimalistisch en iOS-stijl uniform te houden.
