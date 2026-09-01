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

async function bookExpenseAndLog(omschrijving, bedrag, maandInput) {
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  const spreadsheetId = '1ygzfQoR19DjWF4-pDYOmT3GT-DkQRNk52S5lBWFuVP0';

  let targetYear = new Date().getFullYear().toString();
  let targetQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
  let datum = new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (maandInput && /^\d{4}-\d{2}$/.test(maandInput)) {
    const [y, m] = maandInput.split('-');
    targetYear = y;
    const mNum = parseInt(m, 10);
    targetQuarter = Math.ceil(mNum / 3);
    const lastDay = new Date(parseInt(y, 10), mNum, 0).getDate();
    datum = `${String(lastDay).padStart(2, '0')}-${String(mNum).padStart(2, '0')}-${y}`;
  }

  const targetSheet = `Q${targetQuarter} Inkoop`;

  // 1. Haal Kolom A t/m G op uit ALLE Inkoop tabbladen
  const ranges = ['Q1 Inkoop!A:G', 'Q2 Inkoop!A:G', 'Q3 Inkoop!A:G', 'Q4 Inkoop!A:G'];
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
        const datumVal = row[0] ? String(row[0]).trim() : '';
        const bonStr = row[1] ? String(row[1]).trim() : '';
        const omschrijvingVal = row[2] ? String(row[2]).trim() : '';

        const hasDatum = datumVal !== '';
        const hasOmschrijving = omschrijvingVal !== '';

        if (hasDatum && hasOmschrijving) {
          const parsed = parseInvoiceString(bonStr);
          if (parsed && parsed.year === targetYear) {
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
  const newBonNummer = `${targetYear}.${newNumberStr}`;

  // 4. Bepaal de EXACTE lege rij voor het doelkwartaal (altijd VÓÓR de Totalen-rij)
  const currentQuarterIndex = targetQuarter - 1;
  const currentQuarterData = valueRanges[currentQuarterIndex] ? valueRanges[currentQuarterIndex].values || [] : [];

  // Zoek waar de 'Totalen' rij staat
  let totalenIndex = currentQuarterData.findIndex(row => {
    if (!row) return false;
    const colA = row[0] ? String(row[0]).trim().toLowerCase() : '';
    const colC = row[2] ? String(row[2]).trim().toLowerCase() : '';
    return colA.startsWith('totaal') || colC.startsWith('totaal');
  });

  if (totalenIndex === -1) {
    totalenIndex = currentQuarterData.length > 0 ? currentQuarterData.length : 20;
  }

  // Controleer of er rijen per ongeluk onder de Totalen-rij staan en verplaats ze naar de lege rijen erboven
  if (currentQuarterData.length > totalenIndex + 1) {
    for (let i = totalenIndex + 1; i < currentQuarterData.length; i++) {
      const row = currentQuarterData[i];
      if (!row) continue;
      const dVal = row[0] ? String(row[0]).trim() : '';
      const bVal = row[1] ? String(row[1]).trim() : '';
      const oVal = row[2] ? String(row[2]).trim() : '';
      const parsed = parseInvoiceString(bVal);

      if (dVal && parsed && oVal) {
        // Zoek eerste vrije plek boven Totalen (rij 2 t/m totalenIndex)
        let slotIndex = -1;
        for (let s = 1; s < totalenIndex; s++) {
          const sRow = currentQuarterData[s] || [];
          if (!sRow[0] && !sRow[1] && !sRow[2]) {
            slotIndex = s;
            break;
          }
        }

        if (slotIndex !== -1) {
          const targetRowNumber = slotIndex + 1;
          const oldRowNumber = i + 1;

          const rowToMove = [
            dVal,
            bVal,
            oVal,
            row[3] || 'RK Parochie Emmaus',
            row[4] || '',
            row[5] || '',
            row[6] || row[4] || ''
          ];

          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${targetSheet}!A${targetRowNumber}:G${targetRowNumber}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [rowToMove] }
          });

          await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `${targetSheet}!A${oldRowNumber}:G${oldRowNumber}`
          });

          currentQuarterData[slotIndex] = rowToMove;
          currentQuarterData[i] = [];
        }
      }
    }
  }

  // Zoek of het nieuw berekende bonnummer al gereserveerd is vóór de Totalen-rij
  const targetParsed = parseInvoiceString(newBonNummer);
  let nextRow = null;

  const existingRowIndex = currentQuarterData.slice(0, totalenIndex).findIndex(row => {
    if (!row) return false;
    const bonStr = row[1] ? String(row[1]).trim() : '';
    const parsed = parseInvoiceString(bonStr);
    return parsed && targetParsed && parsed.year === targetParsed.year && parsed.seq === targetParsed.seq;
  });

  if (existingRowIndex !== -1) {
    nextRow = existingRowIndex + 1;
  } else {
    // Zoek de eerste vrije rij tussen rij 2 en de Totalen-rij
    for (let i = 1; i < totalenIndex; i++) {
      const row = currentQuarterData[i] || [];
      const datumVal = row[0] ? String(row[0]).trim() : '';
      const bonVal = row[1] ? String(row[1]).trim() : '';
      const omschrijvingVal = row[2] ? String(row[2]).trim() : '';

      if (!datumVal && !bonVal && !omschrijvingVal) {
        nextRow = i + 1;
        break;
      }
    }

    if (!nextRow) {
      nextRow = totalenIndex; // Fallback als alles vol is net voor de Totalen rij
    }
  }

  // 5. Maak de nieuwe rij op met de 7-koloms indeling
  const rowData = [
    datum,                // Kolom A: Datum
    newBonNummer,         // Kolom B: Bonnummer (bv 2026.021)
    omschrijving,         // Kolom C: Omschrijving
    "RK Parochie Emmaus", // Kolom D: Leverancier
    bedrag,               // Kolom E: Factuurbedrag
    '',                   // Kolom F: Lege string (BTW)
    bedrag                // Kolom G: Vergoeding
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