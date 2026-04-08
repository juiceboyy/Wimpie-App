# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

Lichtgewicht, op maat gemaakt ERP-systeem voor de zorgadministratie van "Wimpie & de Domino's". Verzorgt aanwezigheidsregistratie, logboeken, en het genereren/verzenden van zorg-declaraties (Cordaan/AMSTA) en PDF-facturen (Thomashuis).

- **UI-taal:** Nederlands. Code (variabelen/functies) in het Engels, maar domeinspecifieke termen (`verslag`, `factuurnummer`, `dagdeel`) mogen Nederlands blijven.
- **Hosting:** Netlify Serverless Functions

## Tech Stack

- **Frontend:** Vanilla JavaScript (ES modules), HTML5, Tailwind CSS, `pdfmake` (PDF), `xlsx-js-style` (Excel)
- **Backend:** Node.js Netlify Functions
- **Database:** Google Sheets via `googleapis` REST API (Service Account auth)
- **Backend packages:** `googleapis`, `nodemailer`, `archiver`

## Development Commands

```bash
# Install dependencies
npm install

# Run local dev server with Netlify Functions
npx netlify dev

# Deploy to Netlify
npx netlify deploy --prod
```

There are no automated tests configured.

## Architecture

### Frontend (`/modules/`)

`app.js` is the entry point — initializes auth, event listeners, and exposes globals to HTML `onclick` attributes via `window.*`. Frontend modules follow feature-based separation:

- `state.js` — shared application state
- `auth.js` — access verification
- `ui.js` — DOM manipulation, tab switching, rendering
- `api.js` — all fetch calls to backend Netlify Functions
- `export.js` / `ui-export.js` — export orchestration and its UI
- `expenses.js` / `ui-expenses.js` — expenses calculation and its UI
- `amsta.js` / `amsta-invoice.js` — AMSTA declaration logic and invoice generation
- `cordaan.js` / `cordaan-invoice.js` — Cordaan declaration logic and invoice generation
- `thomashuis.js` — Thomashuis-specific invoice logic
- `aanmaning.js` — payment reminder (aanmaning) logic
- `utils.js` — shared utilities (`runSafe`, etc.)

### Backend (`/netlify/functions/`)

- `api.js` — pure router/traffic controller, no business logic. Returns `jsonResponse(statusCode, data)`.
- `ai-writer.js` — AI text improvement endpoint
- `utils/google.js` — Service Account auth infrastructure only
- `utils/sheet-logic.js` — all Google Sheets read/write operations
- `utils/invoice-logic.js` — financial logic, sequential invoice number calculation
- `utils/export-logic.js` — file encryption and email logic
- `utils/mailer.js` — email sending via nodemailer
- `utils/aanmaning-logic.js` — payment reminder business logic
- `utils/expense-logic.js` — expense calculation logic

## Hard Rules

1. **GEEN Google Apps Script (GAS):** Gebruik uitsluitend de `googleapis` Node.js library.
2. **GEEN `append` bij Sheets API:** Gebruik `.update` met dynamisch berekende ranges of `INSERT_ROWS` om opmaak-conflicten te voorkomen.
3. **Async everywhere:** Alle API calls, PDF- en Excel-generaties zijn asynchroon. Gebruik `async/await` + `try/catch` + fallback UI-berichten (`message || 'Standaard bericht'`).
4. **Single Responsibility:** Geen "God-functions". Bij nieuwe functionaliteit: bepaal in welk bestaand module-blokje het thuishoort.
