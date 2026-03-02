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
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Deelnemers!A:F',
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(response.data.values || []),
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