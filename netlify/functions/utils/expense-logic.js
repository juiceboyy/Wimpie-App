const { google } = require('googleapis');
const { auth } = require('./google');

async function bookExpenseAndLog(omschrijving, bedrag) {
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  const spreadsheetId = '1ygzfQoR19DjWF4-pDYOmT3GT-DkQRNk52S5lBWFuVP0'; // Zelfde ID als bij invoice-logic
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = new Date().getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);
  const targetSheet = `Q${currentQuarter} Inkoop`;

  // 1. Haal NU Kolom B (Bonnummers) op uit ALLE Inkoop tabbladen
  const ranges = ['Q1 Inkoop!B:B', 'Q2 Inkoop!B:B', 'Q3 Inkoop!B:B', 'Q4 Inkoop!B:B'];
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
        const bonStr = row[0]; // row[0] is hier kolom B, omdat we alleen B ophalen
        if (bonStr && bonStr.startsWith(`${currentYear}.`)) {
          const numPart = parseInt(bonStr.split('.')[1], 10);
          if (!isNaN(numPart) && numPart > maxNumber) {
            maxNumber = numPart;
          }
        }
      });
    }
  });

  // 3. Bereken het nieuwe nummer
  const newNumberStr = (maxNumber + 1).toString().padStart(3, '0');
  const newBonNummer = `${currentYear}.${newNumberStr}`;

  // 4. Bepaal de EXACTE lege rij voor het huidige kwartaal
  const currentQuarterIndex = currentQuarter - 1;
  const currentQuarterData = valueRanges[currentQuarterIndex] ? valueRanges[currentQuarterIndex].values || [] : [];
  // Als de lijst items heeft (1 header is lengte 1), tellen we dat en doen we + 1 = volgende regel.
  // Is de lijst leeg, starten we op rij 2.
  const nextRow = currentQuarterData.length > 0 ? currentQuarterData.length + 1 : 2;

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