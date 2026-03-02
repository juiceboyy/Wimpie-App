const { google } = require('googleapis');

exports.handler = async function(event, context) {
  // Alleen reageren op GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
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
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    // Google Sheets client initialiseren
    const sheets = google.sheets({ version: 'v4', auth });

    // Data ophalen uit de sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'Deelnemers!A:F',
    });

    // Succesvolle response met de data
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(response.data.values || []),
    };

  } catch (error) {
    console.error('Fout bij ophalen data:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Er is een fout opgetreden bij het ophalen van de data.' }),
    };
  }
};