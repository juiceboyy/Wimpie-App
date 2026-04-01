const { google } = require('googleapis');
const { auth } = require('./google');
const { verstuurExportEmail } = require('./mailer');

const SPREADSHEET_ID = '1ygzfQoR19DjWF4-pDYOmT3GT-DkQRNk52S5lBWFuVP0';

const BETALINGSTERMIJNEN = {
  'Cordaan': 30,
  'AMSTA': 30,
  'Thomashuis Lisse': 14,
};

const EMAIL_ADRESSEN = {
  'Cordaan': 'declaratieonderaannemers@cordaan.nl',
  'AMSTA': 'crediteuren@amsta.nl',
};

function parseDutchDate(dateStr) {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

function formatDutchDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

async function getOpenstaandeFacturen() {
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  const ranges = ['Q1 Verkoop!A:L', 'Q2 Verkoop!A:L', 'Q3 Verkoop!A:L', 'Q4 Verkoop!A:L'];
  const response = await sheets.spreadsheets.values.batchGet({ spreadsheetId: SPREADSHEET_ID, ranges });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const resultaat = [];
  const valueRanges = response.data.valueRanges || [];

  valueRanges.forEach(vr => {
    const rows = vr.values || [];
    // Sla header-rij over
    rows.slice(1).forEach(row => {
      const betaald = row[10];
      if (betaald !== undefined && betaald !== '') return; // al betaald

      const datumStr = row[0];
      const factuurnummer = row[1];
      const omschrijving = row[2];
      const klant_naam = row[3];
      const bedrag = row[4];

      if (!datumStr || !factuurnummer || !klant_naam) return;

      const factuurDatum = parseDutchDate(datumStr);
      if (!factuurDatum) return;

      const termijnDagen = BETALINGSTERMIJNEN[klant_naam] ?? 30;
      const vervalDatum = new Date(factuurDatum);
      vervalDatum.setDate(vervalDatum.getDate() + termijnDagen);

      const dagenTeLaat = Math.floor((today - vervalDatum) / (1000 * 60 * 60 * 24));
      if (dagenTeLaat <= 0) return;

      resultaat.push({
        factuurnummer,
        klant_naam,
        bedrag: bedrag || '0',
        omschrijving: omschrijving || 'Muziekdagbesteding',
        datumFactuur: datumStr,
        vervalDatumStr: formatDutchDate(vervalDatum),
        dagenTeLaat,
        heeftEmail: klant_naam in EMAIL_ADRESSEN,
      });
    });
  });

  return resultaat;
}

async function stuurAanmaning(payload) {
  const { factuurnummer, klant_naam, bedrag, omschrijving, datumFactuur, vervalDatumStr } = payload;

  const toEmail = EMAIL_ADRESSEN[klant_naam];
  if (!toEmail) {
    throw new Error(`Geen e-mailadres beschikbaar voor ${klant_naam}`);
  }

  const subject = `Betalingsherinnering factuur ${factuurnummer}`;

  const body = `Beste financiële administratie,

Hierbij sturen wij u vriendelijk een betalingsherinnering voor onderstaande factuur, welke inmiddels de betalingstermijn heeft overschreden.

Factuurnummer : ${factuurnummer}
Datum         : ${datumFactuur}
Omschrijving  : ${omschrijving}
Factuurbedrag : € ${bedrag}
Vervaldatum   : ${vervalDatumStr}

Wij verzoeken u vriendelijk het openstaande bedrag zo spoedig mogelijk over te maken op rekeningnummer NL17 INGB 0004 6400 97 ten name van VOF Wimpie & de Domino's, onder vermelding van het bovenstaande factuurnummer.

Indien u reeds betaald heeft of er sprake is van een misverstand, dan vernemen wij dit graag.

Met vriendelijke groet,
Ronald van Holst / Auck Boersma
VOF Wimpie & de Domino's
Tel: 06-28143815`;

  await verstuurExportEmail(toEmail, 'auckboersma@gmail.com', subject, body, null, null);
  return { success: true, message: 'Aanmaning verstuurd.' };
}

module.exports = { getOpenstaandeFacturen, stuurAanmaning };
