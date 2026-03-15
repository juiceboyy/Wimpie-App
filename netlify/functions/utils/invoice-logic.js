const { google } = require('googleapis');
const { auth } = require('./google');

async function getNextInvoiceNumberAndLog(organisatie, bedrag, omschrijvingInput) {
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  const spreadsheetId = '1ygzfQoR19DjWF4-pDYOmT3GT-DkQRNk52S5lBWFuVP0';
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = new Date().getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);
  const targetSheet = `Q${currentQuarter} Verkoop`;

  // 1. Haal NU Kolom B (Factuurnummers) op uit ALLE Verkoop tabbladen
  const ranges = ['Q1 Verkoop!B:B', 'Q2 Verkoop!B:B', 'Q3 Verkoop!B:B', 'Q4 Verkoop!B:B'];
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
  });

  let maxNumber = 0;
  const valueRanges = response.data.valueRanges || [];

  // 2. Zoek het hoogste volgnummer
  valueRanges.forEach(vr => {
    if (vr.values) {
      vr.values.forEach(row => {
        const invoiceStr = row[0]; // row[0] is hier kolom B, omdat we alleen B ophalen
        if (invoiceStr && invoiceStr.startsWith(`${currentYear}.`)) {
          const numPart = parseInt(invoiceStr.split('.')[1], 10);
          if (!isNaN(numPart) && numPart > maxNumber) {
            maxNumber = numPart;
          }
        }
      });
    }
  });

  // 3. Bereken het nieuwe nummer
  const newNumberStr = (maxNumber + 1).toString().padStart(3, '0');
  const newFactuurNummer = `${currentYear}.${newNumberStr}`;

  // 4. Bepaal de EXACTE lege rij voor het huidige kwartaal
  const currentQuarterIndex = currentQuarter - 1;
  const currentQuarterData = valueRanges[currentQuarterIndex] ? valueRanges[currentQuarterIndex].values || [] : [];
  // Als de lijst 3 rijen lang is (1 header, 2 facturen), moet de volgende op rij 4.
  // Als de lijst leeg is (lengte 0), beginnen we op rij 2.
  const nextRow = currentQuarterData.length > 0 ? currentQuarterData.length + 1 : 2;

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