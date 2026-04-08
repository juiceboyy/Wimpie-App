const SCRIPT_URL = '/.netlify/functions/api';

export async function fetchParticipants() {
    const response = await fetch(SCRIPT_URL);
    if (!response.ok) throw new Error('API gaf een error: ' + response.status);
    return response.json();
}

export async function fetchAttendance(date) {
    const response = await fetch(`${SCRIPT_URL}?datum=${date}`);
    return response.json();
}

export async function fetchReportHistory(name) {
    const response = await fetch(`${SCRIPT_URL}?type=verslag_historie&naam=${encodeURIComponent(name)}`);
    return response.json();
}

export async function fetchReport(date, name) {
    const response = await fetch(`${SCRIPT_URL}?type=verslag&datum=${date}&naam=${encodeURIComponent(name)}`);
    return response.json();
}

export async function postRegistration(entries) {
    return fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ type: 'registratie', entries })
    });
}

export async function postReport(payload) {
    const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ ...payload, type: 'verslag' })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Server error bij opslaan verslag');
    }
    return response.json();
}

export async function fetchExport(month) {
    const response = await fetch(`${SCRIPT_URL}?type=export&maand=${month}`);
    return response.json();
}

export async function sendExportEmail(payload) {
    const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ ...payload, type: 'email_export' })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Server error bij versturen export');
    }
    return response.json();
}

export async function fetchInvoiceNumber(organisatie, bedrag, omschrijving) {
    const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ type: 'generate_invoice_number', organisatie, bedrag, omschrijving })
    });
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    return result.invoiceNumber;
}

export async function bookExpense(omschrijving, bedrag) {
    const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ type: 'book_expense', omschrijving, bedrag })
    });
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    return result;
}

export async function fetchAanmaningen() {
    const response = await fetch(`${SCRIPT_URL}?type=aanmaningen`);
    if (!response.ok) throw new Error('API gaf een error: ' + response.status);
    return response.json();
}

export async function postStuurAanmaning(payload) {
    const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ ...payload, type: 'stuur_aanmaning' })
    });
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    return result;
}

export async function improveReportWithAI(naam, steekwoorden, historie) {
    const response = await fetch('/.netlify/functions/ai-writer', {
        method: 'POST',
        body: JSON.stringify({ naam, steekwoorden, historie })
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Server error bij AI generatie');
    }
    return response.json();
}