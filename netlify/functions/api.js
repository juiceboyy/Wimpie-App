const { verstuurVerslagEmail, verstuurExportEmail } = require('./utils/mailer');
const { getSheetData, updateSheetData, appendSheetData, clearSheetData } = require('./utils/google');
const archiver = require('archiver');
archiver.registerFormat('zip-encrypted', require('archiver-zip-encrypted'));

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function jsonResponse(body, statusCode = 200) {
  return {
    statusCode,
    headers: HEADERS,
    body: JSON.stringify(body),
  };
}

exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
      return await handleGet(event.queryStringParameters || {});
    }
    if (event.httpMethod === 'POST') {
      return await handlePost(JSON.parse(event.body));
    }
    return { statusCode: 405, headers: HEADERS, body: 'Method Not Allowed' };
  } catch (error) {
    console.error('API Error:', error);
    return jsonResponse({ error: error.message || 'Server error' }, 500);
  }
};

async function handleGet(params) {
  const { type, maand, datum, naam } = params;

  if (datum && !type) return await getAttendance(datum);

  switch (type) {
    case 'verslag': return await getReport(datum, naam);
    case 'verslag_historie': return await getReportHistory(naam);
    case 'export': return await getExportData(maand);
    default: return await getParticipants();
  }
}

async function handlePost(payload) {
  switch (payload.type) {
    case 'registratie': return await saveRegistration(payload);
    case 'verslag': return await saveReport(payload);
    case 'email_export': return await sendExport(payload);
    default: throw new Error(`Onbekend type: ${payload.type}`);
  }
}

async function getAttendance(datum) {
  const rows = await getSheetData('Registraties!A:D');
  const attendance = rows.slice(1)
    .filter(row => row[0] && row[0].startsWith(datum))
    .map(row => ({
      naam: row[1],
      dagdelen: row[2],
      aanwezig: row[3]
    }));
  return jsonResponse(attendance);
}

async function getReport(datum, naam) {
  const rows = await getSheetData('Verslagen!A:C');
  const foundRow = rows.find(row => row[0] === datum && row[1] === naam);
  return jsonResponse({ tekst: foundRow ? foundRow[2] : "" });
}

async function getReportHistory(naam) {
  const rows = await getSheetData('Verslagen!A:C');
  const history = rows.slice(1)
    .filter(row => row[1] === naam)
    .map(row => row[0])
    .sort((a, b) => new Date(b) - new Date(a));
  return jsonResponse(history);
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
      };
    }
  });

  const exportData = registraties.slice(1)
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
        activiteit_omschrijving: legendaMap[code] || code,
      };
    });

  return jsonResponse(exportData);
}

async function getParticipants() {
  const rows = await getSheetData('Deelnemers!A:F');
  const participants = rows.slice(1)
    .filter(row => row[5] === 'Ja')
    .map(row => ({
      naam: row[0],
      organisatie: row[1],
      bsn: row[2],
      code: row[3],
      tarief: row[4]
    }));
  return jsonResponse(participants);
}

async function saveRegistration(payload) {
  const range = 'Registraties!A:D';
  const rows = await getSheetData(range);
  
  const targetDate = payload.entries[0]?.datum;
  if (!targetDate) throw new Error("Geen datum gevonden in payload");

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
  return jsonResponse({ message: "Opgeslagen" });
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
    const deelnemersRows = await getSheetData('Deelnemers!A:G');
    const deelnemer = deelnemersRows.find(row => row[0] === payload.naam);
    if (deelnemer && deelnemer[6] && deelnemer[6].includes('@')) {
      await verstuurVerslagEmail(payload.naam, payload.datum, payload.tekst, deelnemer[6]);
    }
  } catch (mailError) {
    console.error('Mail error:', mailError);
  }

  return jsonResponse({ message: 'Verslag succesvol opgeslagen en verzonden.' });
}

async function sendExport(payload) {
  const maanden = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  const [jaar, maandNummer] = payload.maand.split('-');
  const maandNaam = maanden[parseInt(maandNummer, 10) - 1];

  let targetEmail = '';
  let orgNaam = '';
  if (payload.organisatie === 'amsta') {
    targetEmail = 'crediteuren@amsta.nl'; // TODO: Vul echte AMSTA adres in
    orgNaam = 'AMSTA';
  } else {
    // Fallback / Standaard is Cordaan
    targetEmail = 'declaratieonderaannemers@cordaan.nl';
    orgNaam = 'Cordaan';
  }

  // TODO: TESTMODUS - Verander pas naar echte adressen als ALLES 100% is goedgekeurd!
  const toEmail = 'halfhide@gmail.com'; // TODO: Verander dit later naar targetEmail
  const ccEmail = ''; // TODO: Verander dit later naar 'auckboersma@gmail.com'

  const subject = 'Declaratiebestand ' + payload.filename;
  let textBody = `Beste urenadministratie,

In de bijlage sturen wij het ingevulde uren-importbestand van Wimpie & de Domino's over de maand ${maandNaam} ${jaar}.

Het betreft de geleverde muziekdagbesteding voor onze deelnemers via ${orgNaam}.`;

  if (payload.organisatie === 'amsta') {
    textBody += `\n\nLet op: in verband met de AVG en privacy is de bijlage veilig ingepakt in een versleuteld ZIP-bestand. U ontvangt het benodigde wachtwoord om dit bestand te openen direct hierna in een aparte e-mail.`;
  }

  textBody += `\n\nGraag ontvangen wij een akkoord op deze uren, zodat wij de factuur volgens protocol kunnen indienen.

Mochten er onduidelijkheden zijn, dan hoor ik het graag.

Met vriendelijke groet,
Ronald van Holst / Auck Boersma
Wimpie & de Domino's`;

  if (payload.organisatie === 'amsta') {
    const password = 'AMSTA-' + Math.floor(1000 + Math.random() * 9000);
    const zipBase64 = await createEncryptedZip(payload.base64Data, payload.filename, password);
    const zipFilename = payload.filename.replace('.xlsx', '.zip');

    // Mail 1: ZIP
    await verstuurExportEmail(toEmail, ccEmail, subject, textBody, zipFilename, zipBase64);

    // Mail 2: Wachtwoord
    const passwordBody = `Beste urenadministratie,\n\nHet wachtwoord voor het beveiligde ZIP-bestand van de zojuist verzonden declaratie is: ${password}\n\nMet vriendelijke groet.`;
    await verstuurExportEmail(toEmail, ccEmail, 'Wachtwoord declaratiebestand', passwordBody, null, null);
  } else {
    await verstuurExportEmail(toEmail, ccEmail, subject, textBody, payload.filename, payload.base64Data);
  }

  return jsonResponse({ message: 'Export succesvol verzonden.' });
}

function createEncryptedZip(base64Data, filename, password) {
  return new Promise((resolve, reject) => {
    const archive = archiver.create('zip-encrypted', { zlib: { level: 8 }, encryptionMethod: 'aes256', password: password });
    const buffers = [];

    archive.on('data', data => buffers.push(data));
    archive.on('end', () => resolve(Buffer.concat(buffers).toString('base64')));
    archive.on('error', err => reject(err));

    const buffer = Buffer.from(base64Data, 'base64');
    archive.append(buffer, { name: filename });
    archive.finalize();
  });
}