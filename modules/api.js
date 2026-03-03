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
    return fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ ...payload, type: 'verslag' })
    });
}

export async function fetchExport(month) {
    const response = await fetch(`${SCRIPT_URL}?type=export&maand=${month}`);
    return response.json();
}