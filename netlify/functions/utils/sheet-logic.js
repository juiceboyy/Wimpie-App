const { getSheetData, updateSheetData, appendSheetData, clearSheetData } = require('./google');
const { verstuurVerslagEmail } = require('./mailer');

async function getAttendance(datum) {
  const rows = await getSheetData('Registraties!A:D');
  
  return rows.slice(1)
    .filter(row => row[0] && row[0].startsWith(datum))
    .map(row => ({
      naam: row[1],
      dagdelen: row[2],
      aanwezig: row[3]
    }));
}

async function getReport(datum, naam) {
  const rows = await getSheetData('Verslagen!A:C');
  const foundRow = rows.find(row => row[0] === datum && row[1] === naam);
  return { tekst: foundRow ? foundRow[2] : "" };
}

async function getReportHistory(naam) {
  const rows = await getSheetData('Verslagen!A:C');
  return rows.slice(1)
    .filter(row => row[1] === naam)
    .map(row => row[0])
    .sort((a, b) => new Date(b) - new Date(a));
}

async function getParticipants() {
  const rows = await getSheetData('Deelnemers!A:G');
  return rows.slice(1)
    .filter(row => row[6] === 'Ja')
    .map(row => ({
      naam: row[0],
      organisatie: row[1],
      bsn: row[2],
      code: row[3],
      tarief: row[4]
    }));
}

async function getExportData(maand) {
  if (!maand) throw new Error('Geen maand opgegeven voor export.');
  
  const [registraties, deelnemers, legenda] = await Promise.all([
    getSheetData('Registraties!A:D'),
    getSheetData('Deelnemers!A:F'),
    getSheetData('Legenda!A:B'),
  ]);

  const legendaMap = {};
  (legenda || []).slice(1).forEach(row => {
    if (row[0]) legendaMap[row[0]] = row[1];
  });

  const deelnemerMap = {};
  deelnemers.slice(1).forEach(row => {
    if (row[0]) {
      deelnemerMap[row[0]] = {
        organisatie: row[1] || '',
        bsn: row[2] || '',
        code: row[3] || '',
        tarief: row[4] || '',
        vervoerTarief: parseFloat(String(row[5] || '').replace(',', '.')) || 0,
      };
    }
  });

  return registraties.slice(1)
    .filter(row => {
      const datum = row[0];
      const aanwezig = row[3];
      return aanwezig === 'Ja' && datum && datum.startsWith(maand);
    })
    .map(row => {
      const naam = row[1];
      const info = deelnemerMap[naam] || {};
      const code = info.code || '';
      return {
        datum: row[0],
        naam: naam,
        dagdelen: row[2],
        organisatie: info.organisatie || '',
        bsn: info.bsn || '',
        code: code,
        tarief: info.tarief || '',
        vervoerTarief: info.vervoerTarief || 0,
        activiteit_omschrijving: legendaMap[code] || code,
        vervoerOmschrijving: legendaMap['V'] || 'Vervoer',
      };
    });
}

async function saveRegistration(payload) {
  const targetDate = payload.entries[0]?.datum;
  if (!targetDate) throw new Error("Geen datum gevonden in payload");

  const range = 'Registraties!A:D';
  const rows = await getSheetData(range);

  const filteredRows = rows.filter(row => row[0] !== targetDate);
  const newRows = payload.entries
    .filter(e => e.naam !== 'DELETE_SIGNAL')
    .map(e => [e.datum, e.naam, e.dagdelen, e.aanwezig]);

  const finalRows = [...filteredRows, ...newRows];
  const uniqueRows = [];
  const seen = new Set();

  for (let i = finalRows.length - 1; i >= 0; i--) {
    const row = finalRows[i];
    const key = `${row[0]}_${row[1]}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRows.unshift(row);
    }
  }

  await clearSheetData(range);
  await updateSheetData(range, uniqueRows);
  return { message: "Opgeslagen" };
}

async function saveReport(payload) {
  const verslagenRange = 'Verslagen!A:C';
  const verslagenRows = await getSheetData(verslagenRange);
  const rowIndex = verslagenRows.findIndex(row => row[0] === payload.datum && row[1] === payload.naam);

  if (rowIndex !== -1) {
    await updateSheetData(`Verslagen!C${rowIndex + 1}`, [[payload.tekst]]);
  } else {
    await appendSheetData(verslagenRange, [[payload.datum, payload.naam, payload.tekst]]);
  }

  try {
    const deelnemersRows = await getSheetData('Deelnemers!A:H');
    const deelnemer = deelnemersRows.find(row => row[0] === payload.naam);
    if (deelnemer && deelnemer[7] && deelnemer[7].includes('@')) {
      await verstuurVerslagEmail(payload.naam, payload.datum, payload.tekst, deelnemer[7]);
    }
  } catch (mailError) {
    console.error('Mail error:', mailError);
  }

  return { message: 'Verslag succesvol opgeslagen en verzonden.' };
}

module.exports = {
  getAttendance,
  getReport,
  getReportHistory,
  getParticipants,
  getExportData,
  saveRegistration,
  saveReport
};