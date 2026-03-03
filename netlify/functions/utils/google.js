const { google } = require('googleapis');
const { Readable } = require('stream');

let formattedPrivateKey = process.env.GOOGLE_PRIVATE_KEY || '';
if (formattedPrivateKey.startsWith('"') && formattedPrivateKey.endsWith('"')) {
  formattedPrivateKey = formattedPrivateKey.slice(1, -1);
}
formattedPrivateKey = formattedPrivateKey.replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: formattedPrivateKey,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'],
});

const sheets = google.sheets({ version: 'v4', auth });
const spreadsheetId = process.env.SPREADSHEET_ID;

async function getSheetData(range) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return response.data.values || [];
}

async function updateSheetData(range, values) {
  return await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

async function appendSheetData(range, values) {
  return await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

async function clearSheetData(range) {
  return await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range,
  });
}

module.exports = { getSheetData, updateSheetData, appendSheetData, clearSheetData, uploadToDrive };
