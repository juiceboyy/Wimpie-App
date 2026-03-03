const { google } = require('googleapis');
const nodemailer = require('nodemailer');

exports.handler = async function(event, context) {
  // CORS headers instellen voor alle responses
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // Preflight request (OPTIONS) afhandelen
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    // Authenticatie configureren met environment variables
    // De replace zorgt ervoor dat \n in de environment variable correct wordt geïnterpreteerd
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      },
      // Scope aangepast naar volledig toegang (niet alleen readonly) voor POST acties
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // Google Sheets client initialiseren
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // --- GET REQUEST ---
    if (event.httpMethod === 'GET') {
      const { type, maand, datum, naam } = event.queryStringParameters || {};

      // 1. AANWEZIGHEID OPHALEN
      if (datum && !type) {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: 'Registraties!A:D',
        });
        const rows = response.data.values || [];
        const attendance = rows.slice(1)
          .filter(row => row[0] && row[0].startsWith(datum))
          .map(row => ({
            naam: row[1],
            dagdelen: row[2],
            aanwezig: row[3]
          }));

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(attendance),
        };
      }

      // 2. BESTAAND VERSLAG OPHALEN
      if (type === 'verslag') {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: 'Verslagen!A:C',
        });
        const rows = response.data.values || [];
        const foundRow = rows.find(row => row[0] === datum && row[1] === naam);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ tekst: foundRow ? foundRow[2] : "" }),
        };
      }

      // 3. VERSLAG HISTORIE OPHALEN
      if (type === 'verslag_historie') {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: 'Verslagen!A:C',
        });
        const rows = response.data.values || [];
        const history = rows.slice(1)
          .filter(row => row[1] === naam)
          .map(row => row[0])
          .sort((a, b) => new Date(b) - new Date(a));

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(history),
        };
      }

      // EXPORT LOGICA
      if (type === 'export') {
        if (!maand) throw new Error('Geen maand opgegeven voor export.');

        // Data ophalen uit beide sheets
        const [registratiesRes, deelnemersRes] = await Promise.all([
          sheets.spreadsheets.values.get({ spreadsheetId, range: 'Registraties!A:D' }),
          sheets.spreadsheets.values.get({ spreadsheetId, range: 'Deelnemers!A:F' }),
        ]);

        const registraties = registratiesRes.data.values || [];
        const deelnemers = deelnemersRes.data.values || [];

        // Mapping maken van deelnemers (Naam -> Info)
        // Aanname kolommen Deelnemers: A=Naam, B=Organisatie, C=BSN, D=Activiteit
        const deelnemerMap = {};
        deelnemers.slice(1).forEach(row => {
          if (row[0]) {
            deelnemerMap[row[0]] = {
              organisatie: row[1] || '',
              bsn: row[2] || '',
              activiteit: row[3] || '',
            };
          }
        });

        // Registraties filteren en verrijken
        // Prompt vereiste: Datum=Kolom A (index 0), Aanwezig=Kolom D (index 3)
        // Impliciet: Naam=Kolom B (index 1), Dagdelen=Kolom C (index 2)
        const exportData = registraties.slice(1)
          .filter(row => {
            const datum = row[0];
            const aanwezig = row[3];
            return aanwezig === 'Ja' && datum && datum.startsWith(maand);
          })
          .map(row => {
            const naam = row[1];
            const info = deelnemerMap[naam] || {};
            return {
              datum: row[0],
              naam: naam,
              dagdelen: row[2],
              organisatie: info.organisatie || '',
              bsn: info.bsn || '',
              activiteit: info.activiteit || '',
            };
          });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(exportData),
        };
      }

      // STANDAARD GET (Deelnemers ophalen)
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Deelnemers!A:F',
      });

      const rows = response.data.values || [];
      const participants = rows.slice(1)
        .filter(row => row[5] === 'Ja')
        .map(row => ({
          naam: row[0],
          organisatie: row[1],
          bsn: row[2],
          code: row[3],
          tarief: row[4]
        }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(participants),
      };
    }

    // --- POST REQUEST ---
    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body);

      // SCENARIO A: Registratie
      if (payload.type === 'registratie') {
        const range = 'Registraties!A:D';
        
        // 1. Bestaande data ophalen
        const getRes = await sheets.spreadsheets.values.get({ spreadsheetId, range });
        const rows = getRes.data.values || [];
        
        // Datum uit payload halen
        const targetDate = payload.entries[0]?.datum;
        if (!targetDate) throw new Error("Geen datum gevonden in payload");

        // 2. Filter oude registraties van deze datum eruit (Aanname: Datum staat in kolom B, index 1)
        const filteredRows = rows.filter(row => row[1] !== targetDate);

        // 3. Nieuwe entries toevoegen
        const newRows = payload.entries
          .filter(e => e.naam !== 'DELETE_SIGNAL')
          .map(e => [e.naam, e.datum, e.status, e.opmerking || '']);

        const finalRows = [...filteredRows, ...newRows];

        // 4. Sheet leegmaken en updaten
        await sheets.spreadsheets.values.clear({ spreadsheetId, range });
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: finalRows },
        });

        return { statusCode: 200, headers, body: JSON.stringify({ message: "Opgeslagen" }) };
      }

      // SCENARIO B: Verslag
      if (payload.type === 'verslag') {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });

        const verslagenRange = 'Verslagen!A:C'; // A=Datum, B=Naam, C=Verslag
        const getVerslagen = await sheets.spreadsheets.values.get({ spreadsheetId, range: verslagenRange });
        const verslagenRows = getVerslagen.data.values || [];

        // Zoek bestaand verslag (Datum op index 0, Naam op index 1)
        const rowIndex = verslagenRows.findIndex(row => row[0] === payload.datum && row[1] === payload.naam);

        if (rowIndex !== -1) {
          // Update bestaande cel (Verslagen!C...)
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Verslagen!C${rowIndex + 1}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[payload.tekst]] },
          });
        } else {
          // Nieuwe rij toevoegen
          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: verslagenRange,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[payload.datum, payload.naam, payload.tekst]] },
          });
        }

        // Email logica
        let mailStatus = '';
        try {
          const deelnemersRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Deelnemers!A:G' });
          const deelnemer = (deelnemersRes.data.values || []).find(row => row[0] === payload.naam);
          
          // Check kolom G (index 6) voor email
          if (deelnemer && deelnemer[6] && deelnemer[6].includes('@')) {
            const [y, m, d] = payload.datum.split('-');
            await transporter.sendMail({
              from: process.env.SMTP_USER,
              to: deelnemer[6],
              subject: `Verslag Wimpie & de Domino's: ${payload.naam}`,
              text: payload.tekst,
            });
            mailStatus = 'Mail verstuurd.';
          }
        } catch (mailError) {
          console.error('Mail error:', mailError);
          mailStatus = 'Mail mislukt.';
        }

        return { statusCode: 200, headers, body: JSON.stringify({ message: `Verslag opgeslagen. ${mailStatus}` }) };
      }
    }

  } catch (error) {
    console.error('Fout bij ophalen data:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Er is een fout opgetreden bij het ophalen van de data.' }),
    };
  }
};