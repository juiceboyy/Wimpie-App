const { google } = require('googleapis');
const { auth } = require('./google');

/**
 * Normaliseert en ontleedt een factuurnummer in jaar (4 cijfers) en volgnummer.
 * Werkt betrouwbaar met duizendtal-separatoren (bijv. 2.026.045), komma's, spaties en ongepadde invoer.
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

async function getNextInvoiceNumberAndLog(organisatie, bedrag, omschrijvingInput) {
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  const spreadsheetId = '1ygzfQoR19DjWF4-pDYOmT3GT-DkQRNk52S5lBWFuVP0';
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = new Date().getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);
  const targetSheet = `Q${currentQuarter} Verkoop`;

  // 1. Haal NU Kolom A t/m C (Datum, Factuurnummer, Omschrijving) op uit ALLE Verkoop tabbladen
  const ranges = ['Q1 Verkoop!A:C', 'Q2 Verkoop!A:C', 'Q3 Verkoop!A:C', 'Q4 Verkoop!A:C'];
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
        const invoiceStr = row[1] ? String(row[1]).trim() : '';
        const omschrijving = row[2] ? String(row[2]).trim() : '';

        const hasDatum = datum !== '';
        const hasOmschrijving = omschrijving !== '';

        if (hasDatum && hasOmschrijving) {
          const parsed = parseInvoiceString(invoiceStr);
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
  const newFactuurNummer = `${currentYear}.${newNumberStr}`;

  // 4. Bepaal de EXACTE lege of voorgeprogrammeerde rij voor het huidige kwartaal
  const currentQuarterIndex = currentQuarter - 1;
  const currentQuarterData = valueRanges[currentQuarterIndex] ? valueRanges[currentQuarterIndex].values || [] : [];
  
  let nextRow = currentQuarterData.length > 0 ? currentQuarterData.length + 1 : 2;

  // Zoek of het nieuw berekende factuurnummer al gereserveerd is in een rij
  const targetParsed = parseInvoiceString(newFactuurNummer);
  const existingRowIndex = currentQuarterData.findIndex(row => {
    const invoiceStr = row[1] ? String(row[1]).trim() : '';
    const parsed = parseInvoiceString(invoiceStr);
    return parsed && targetParsed && parsed.year === targetParsed.year && parsed.seq === targetParsed.seq;
  });

  if (existingRowIndex !== -1) {
    nextRow = existingRowIndex + 1; // Google Sheets is 1-indexed, en index 0 is rij 1 (header)
  }

  // 5. Maak de nieuwe rij op met de 12-koloms indeling
  const datum = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const omschrijving = omschrijvingInput || "Muziekdagbesteding";

  const rowData = [
    datum,              // Kolom A: datum
    newFactuurNummer,   // Kolom B: factuur nummer
    omschrijving,       // Kolom C: Omschrijving
    organisatie,        // Kolom D: Naam klant
    bedrag,             // Kolom E: Factuurbedrag
    '',                 // Kolom F: BTW L
    '',                 // Kolom G: BTW H
    '',                 // Kolom H: Vergoeding L (9%)
    '',                 // Kolom I: Vergoeding H (21%)
    bedrag,             // Kolom J: Vergoeding 0 (0%) - Zorg is vrijgesteld
    '',                 // Kolom K: Betaald (betaaldatum)
    ''                  // Kolom L: opmerkingen
  ];

  // 6. Schrijf de nieuwe factuur weg via UPDATE (Sniper methode)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${targetSheet}!A${nextRow}:L${nextRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [rowData]
    }
  });

  return newFactuurNummer;
}

module.exports = { getNextInvoiceNumberAndLog };