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

async function uploadToDrive(filename, base64Data) {
  try {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID is niet ingesteld!");

    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });

    const buffer = Buffer.from(base64Data, 'base64');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const response = await drive.files.create({
      requestBody: { name: filename, parents: [folderId] },
      media: { 
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
        body: stream 
      },
    });
    console.log(`Bestand succesvol geüpload naar Drive met ID: ${response.data.id}`);
  } catch (error) {
    console.error("Fout tijdens Drive upload:", error.message || error);
    throw error; // Gooi de fout door zodat de aanroeper (api.js) hem ook ziet
  }
}

module.exports = { getSheetData, updateSheetData, appendSheetData, clearSheetData, uploadToDrive };
