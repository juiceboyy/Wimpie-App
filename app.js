import * as API from './modules/api.js';
import { generateAndDownloadCsv } from './modules/export.js';
import { verifyAccess } from './modules/auth.js';

let participantsData = [];
let presenceState = {};

// INIT
function init() {
    if (!verifyAccess()) return;

    exposeGlobals();
    setupEventListeners();

    document.getElementById('presenceDate').valueAsDate = new Date();
    document.getElementById('reportDate').valueAsDate = new Date();
    lucide.createIcons();
    fetchParticipants();
}

function setupEventListeners() {
    document.getElementById('presenceDate').addEventListener('change', loadAttendanceForDate);
    document.getElementById('reportDate').addEventListener('change', loadExistingReport);
    document.getElementById('reportParticipant').addEventListener('change', () => {
        loadReportHistory();
        loadExistingReport();
    });
}

// Functies beschikbaar maken voor HTML onclick attributes
function exposeGlobals() {
    window.switchTab = switchTab;
    window.saveAttendance = saveAttendance;
    window.saveReport = saveReport;
    window.downloadExport = handleExport;
    window.togglePresence = togglePresence;
}

async function fetchParticipants() {
    try {
        participantsData = await API.fetchParticipants();
        renderParticipants();
        fillSelect();
        document.getElementById('statusIndicator').classList.replace('bg-red-400', 'bg-green-500');
        loadAttendanceForDate();
    } catch (e) {
        console.error(e);
            participantsData = [];
            document.getElementById('participantsList').innerHTML = '<div class="p-4 text-red-500">Kan data niet laden van de server.</div>';
    }
}

async function loadAttendanceForDate() {
    const datum = document.getElementById('presenceDate').value;
    if (!datum) return;
    presenceState = {};
    document.querySelectorAll('[id^="dagdelen-"]').forEach(el => el.value = "2");
    renderParticipants();

    const btn = document.getElementById('btn-save-attendance');
    btn.innerText = "Gegevens ophalen...";
    btn.disabled = true;

    try {
        const historyData = await API.fetchAttendance(datum);
        historyData.forEach(entry => {
            const index = participantsData.findIndex(p => p.naam === entry.naam);
            if (index > -1) {
                presenceState[index] = true;
                const select = document.getElementById(`dagdelen-${index}`);
                if (select) select.value = entry.dagdelen;
            }
        });
        renderParticipants();
    } catch (e) { console.error(e); }
    finally { btn.innerText = "Opslaan"; btn.disabled = false; }
}

async function loadReportHistory() {
    const naam = document.getElementById('reportParticipant').value;
    const container = document.getElementById('historyContainer');
    const list = document.getElementById('historyList');

    if (naam === 'Selecteer...') {
        container.classList.add('hidden');
        return;
    }

    list.innerHTML = '<span class="text-xs text-slate-400">Zoeken...</span>';
    container.classList.remove('hidden');

    try {
        const datums = await API.fetchReportHistory(naam);
        list.innerHTML = '';

        if (datums.length === 0) {
            list.innerHTML = '<span class="text-xs text-slate-400">Nog geen verslagen.</span>';
        } else {
            datums.forEach(d => {
                // Maak NL datum van YYYY-MM-DD
                const delen = d.split('-');
                const nlDatum = `${delen[2]}-${delen[1]}`;

                const badge = document.createElement('button');
                badge.className = "px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-full text-xs font-medium text-slate-700 transition-colors";
                badge.innerText = nlDatum;
                badge.onclick = () => {
                    // Zet datum picker en laad verslag
                    document.getElementById('reportDate').value = d;
                    loadExistingReport();
                };
                list.appendChild(badge);
            });
        }
    } catch (e) {
        console.error(e);
        list.innerHTML = '<span class="text-xs text-red-400">Fout bij laden.</span>';
    }
}

async function loadExistingReport() {
    const datum = document.getElementById('reportDate').value;
    const naam = document.getElementById('reportParticipant').value;
    const textarea = document.getElementById('reportText');
    const loader = document.getElementById('reportLoading');

    if (!datum || naam === 'Selecteer...') return;

    textarea.value = "";
    textarea.placeholder = "Zoeken naar bestaand verslag...";
    textarea.disabled = true;
    loader.classList.remove('hidden');

    try {
        const data = await API.fetchReport(datum, naam);
        textarea.value = data.tekst || "";
        textarea.placeholder = "Typ hier je verslag...";
    } catch (e) {
        console.error(e);
        textarea.placeholder = "Fout bij ophalen.";
    } finally {
        textarea.disabled = false;
        loader.classList.add('hidden');
        textarea.focus();
    }
}

function togglePresence(index) {
    const btn = document.getElementById(`btn-${index}`);
    const card = document.getElementById(`card-${index}`);

    if (presenceState[index]) {
        presenceState[index] = false;
        btn.classList.remove('bg-blue-500');
        btn.classList.add('bg-slate-200');
        card.classList.remove('ring-2', 'ring-blue-500');
    } else {
        presenceState[index] = true;
        btn.classList.remove('bg-slate-200');
        btn.classList.add('bg-blue-500');
        card.classList.add('ring-2', 'ring-blue-500');
    }
}

async function saveAttendance() {
    const datum = document.getElementById('presenceDate').value;
    const entries = [];
    participantsData.forEach((p, index) => {
        if (presenceState[index]) {
            entries.push({ datum: datum, naam: p.naam, dagdelen: document.getElementById(`dagdelen-${index}`).value, aanwezig: "Ja" });
        }
    });
    const btn = document.getElementById('btn-save-attendance');
    btn.innerText = "Bezig met bijwerken...";

    if (entries.length === 0) entries.push({ datum: datum, naam: "DELETE_SIGNAL", dagdelen: 0, aanwezig: "Nee" });

    await API.postRegistration(entries);
    btn.innerText = "Succesvol Bijgewerkt!";
    setTimeout(() => { btn.innerText = "Opslaan"; }, 2000);
}

async function saveReport() {
    const datum = document.getElementById('reportDate').value;
    const naam = document.getElementById('reportParticipant').value;
    const tekst = document.getElementById('reportText').value;

    if (naam === 'Selecteer...' || !tekst) return alert("Vul alles in.");

    const btn = document.getElementById('btn-save-report');
    btn.innerText = "Versturen...";

    try {
        const result = await API.postReport({ datum, naam, tekst });
        alert(result.message);
        btn.innerText = "Verslag Opgeslagen!";
    } catch (e) {
        alert("Fout bij opslaan: " + e);
    }
    setTimeout(() => btn.innerText = "Verslag Versturen", 2000);
}

async function handleExport(organisatie) {
    const maandInput = document.getElementById('exportMonth').value; // Formaat: YYYY-MM
    if (!maandInput) return alert("Selecteer eerst een maand.");

    const status = document.getElementById('exportStatus');
    status.classList.remove('hidden');

    try {
        const data = await API.fetchExport(maandInput);
        generateAndDownloadCsv(data, organisatie, maandInput);

    } catch (e) {
        console.error(e);
        alert(e.message || "Fout bij ophalen van export data.");
    } finally {
        status.classList.add('hidden');
    }
}

// Start de applicatie
init();