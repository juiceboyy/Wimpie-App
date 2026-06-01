const { google } = require('googleapis');
const { auth } = require('./google');

/**
 * Normaliseert en ontleedt een factuur-/bonnummer in jaar (4 cijfers) en volgnummer.
 * Werkt betrouwbaar met duizendtal-separatoren (bijv. 2.026.015), komma's, spaties en ongepadde invoer.
 */
function parseInvoiceString(str) {
  if (!str) return null;
  const digits = String(str).replace(/\D/g, '');
  if (digits.length >= 5) {
    const year = digits.substring(0, 4);
    const seq = parseInt(digits.substring(4), 10);
    return { year, seq };
  }
  return null;
}

async function bookExpenseAndLog(omschrijving, bedrag) {
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  const spreadsheetId = '1ygzfQoR19DjWF4-pDYOmT3GT-DkQRNk52S5lBWFuVP0'; // Zelfde ID als bij invoice-logic
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = new Date().getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);
  const targetSheet = `Q${currentQuarter} Inkoop`;

  // 1. Haal NU Kolom A t/m C (Datum, Bonnummer, Omschrijving) op uit ALLE Inkoop tabbladen
  const ranges = ['Q1 Inkoop!A:C', 'Q2 Inkoop!A:C', 'Q3 Inkoop!A:C', 'Q4 Inkoop!A:C'];
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
  });

  let maxNumber = 0;
  const valueRanges = response.data.valueRanges || [];

  // 2. Zoek het hoogste volgnummer (alleen bij rijen met een datum én omschrijving)
  valueRanges.forEach(vr => {
    if (vr.values) {
      vr.values.forEach(row => {
        const datum = row[0] ? String(row[0]).trim() : '';
        const bonStr = row[1] ? String(row[1]).trim() : '';
        const omschrijvingVal = row[2] ? String(row[2]).trim() : '';

        const hasDatum = datum !== '';
        const hasOmschrijving = omschrijvingVal !== '';

        if (hasDatum && hasOmschrijving) {
          const parsed = parseInvoiceString(bonStr);
          if (parsed && parsed.year === currentYear) {
            if (parsed.seq > maxNumber) {
              maxNumber = parsed.seq;
            }
          }
        }
      });
    }
  });

  // 3. Bereken het nieuwe nummer
  const newNumberStr = (maxNumber + 1).toString().padStart(3, '0');
  const newBonNummer = `${currentYear}.${newNumberStr}`;

  // 4. Bepaal de EXACTE lege of voorgeprogrammeerde rij voor het huidige kwartaal
  const currentQuarterIndex = currentQuarter - 1;
  const currentQuarterData = valueRanges[currentQuarterIndex] ? valueRanges[currentQuarterIndex].values || [] : [];
  
  let nextRow = currentQuarterData.length > 0 ? currentQuarterData.length + 1 : 2;

  // Zoek of het nieuw berekende bonnummer al gereserveerd is in een rij
  const targetParsed = parseInvoiceString(newBonNummer);
  const existingRowIndex = currentQuarterData.findIndex(row => {
    const bonStr = row[1] ? String(row[1]).trim() : '';
    const parsed = parseInvoiceString(bonStr);
    return parsed && targetParsed && parsed.year === targetParsed.year && parsed.seq === targetParsed.seq;
  });

  if (existingRowIndex !== -1) {
    nextRow = existingRowIndex + 1; // Google Sheets is 1-indexed, en index 0 is rij 1 (header)
  }

  // 5. Maak de nieuwe rij op met de gevraagde opmaak
  const datum = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const rowData = [
    datum,                // Kolom A: Datum
    newBonNummer,         // Kolom B: Bonnummer (bv 2026.001)
    omschrijving,         // Kolom C: Omschrijving
    "RK Parochie Emmaus", // Kolom D: Leverancier
    bedrag,               // Kolom E: Totaalbedrag
    '',                   // Kolom F: Lege string (BTW)
    bedrag                // Kolom G: Totaalbedrag
  ];

  // 6. Schrijf de nieuwe bon weg via UPDATE (Sniper methode)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${targetSheet}!A${nextRow}:G${nextRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [rowData]
    }
  });

  return newBonNummer;
}

module.exports = { bookExpenseAndLog };