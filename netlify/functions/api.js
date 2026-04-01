const { getNextInvoiceNumberAndLog } = require('./utils/invoice-logic');
const { bookExpenseAndLog } = require('./utils/expense-logic');
const { getAttendance, getReport, getReportHistory, getParticipants, getExportData, saveRegistration, saveReport } = require('./utils/sheet-logic');
const { sendExport } = require('./utils/export-logic');
const { getOpenstaandeFacturen, stuurAanmaning } = require('./utils/aanmaning-logic');

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

  if (datum && !type) return jsonResponse(await getAttendance(datum));

  switch (type) {
    case 'verslag': return jsonResponse(await getReport(datum, naam));
    case 'verslag_historie': return jsonResponse(await getReportHistory(naam));
    case 'export': return jsonResponse(await getExportData(maand));
    case 'aanmaningen': return jsonResponse(await getOpenstaandeFacturen());
    case 'aanmaningen_debug': return jsonResponse(await getOpenstaandeFacturen({ debug: true }));
    default: return jsonResponse(await getParticipants());
  }
}

async function handlePost(payload) {
  switch (payload.type) {
    case 'registratie': return jsonResponse(await saveRegistration(payload));
    case 'verslag': 
      const reportResult = await saveReport(payload);
      return jsonResponse({ ...reportResult, message: reportResult.message || 'Het verslag is succesvol verstuurd en opgeslagen.' });
    case 'email_export': return jsonResponse(await sendExport(payload));
    case 'generate_invoice_number':
      try {
        const invoiceNumber = await getNextInvoiceNumberAndLog(payload.organisatie, payload.bedrag, payload.omschrijving);
        return jsonResponse({ success: true, invoiceNumber: invoiceNumber });
      } catch (error) {
        console.error("Fout bij ophalen factuurnummer:", error);
        return jsonResponse({ error: 'Kon factuurnummer niet genereren.' }, 500);
      }
    case 'book_expense':
      try {
        const bonnummer = await bookExpenseAndLog(payload.omschrijving, payload.bedrag);
        return jsonResponse({ success: true, bonnummer: bonnummer });
      } catch (error) {
        console.error("Fout bij boeken uitgave:", error);
        return jsonResponse({ error: 'Kon uitgave niet boeken.' }, 500);
      }
    case 'stuur_aanmaning':
      try {
        return jsonResponse(await stuurAanmaning(payload));
      } catch (error) {
        console.error("Fout bij versturen aanmaning:", error);
        return jsonResponse({ error: error.message }, 500);
      }
    default: throw new Error(`Onbekend type: ${payload.type}`);
  }
}