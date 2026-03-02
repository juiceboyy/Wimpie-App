import * as API from './modules/api.js';
import { generateAndDownloadCsv } from './modules/export.js';
const TOEGANGSCODE = '1055';

let participantsData = [];
let presenceState = {};

// INIT
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    setTimeout(checkToegang, 500);
    setupEventListeners();
    exposeGlobals();
});

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

function checkToegang() {
    const invoer = prompt("Wat is de toegangscode voor Wimpie?");
    if (invoer === TOEGANGSCODE) {
        document.getElementById('presenceDate').valueAsDate = new Date();
        document.getElementById('reportDate').valueAsDate = new Date();
        fetchParticipants();
    } else {
        document.body.innerHTML = '<div class="flex h-screen items-center justify-center bg-red-50"><div class="text-center p-10"><h1 class="text-2xl font-bold text-red-600 mb-2">Geen Toegang</h1><p class="text-slate-600">Herlaad de pagina.</p></div></div>';
    }
}
function switchTab(tab) {
    ['presence', 'reports', 'export'].forEach(t => {
        document.getElementById(`view-${t}`).classList.add('hidden');
        document.getElementById(`tab-${t}`).classList.remove('bg-white', 'shadow-sm', 'text-slate-800');
        document.getElementById(`tab-${t}`).classList.add('text-slate-500');
    });
    document.getElementById(`view-${tab}`).classList.remove('hidden');
    document.getElementById(`tab-${tab}`).classList.add('bg-white', 'shadow-sm', 'text-slate-800');
    document.getElementById(`tab-${tab}`).classList.remove('text-slate-500');
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
        alert("Check je URL.");
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

// --- UI HELPERS ---
function renderParticipants() {
    const container = document.getElementById('participantsList');
    container.innerHTML = '';
    participantsData.forEach((p, index) => {
        const isActive = presenceState[index];
        const activeClass = isActive ? 'ring-2 ring-blue-500' : '';
        const btnColor = isActive ? 'bg-blue-500' : 'bg-slate-200';

        const html = `
        <div class="ios-card p-4 flex items-center justify-between transition-all cursor-pointer ${activeClass}" id="card-${index}" onclick="togglePresence(${index})">
            <div>
                <div class="font-bold text-slate-800">${p.naam}</div>
                <div class="text-xs text-slate-500">${p.organisatie}</div>
            </div>
            <div class="flex items-center gap-3">
                <select id="dagdelen-${index}" onclick="event.stopPropagation()" class="bg-slate-100 rounded text-sm p-2 outline-none">
                    <option value="2">2 Dagdelen</option>
                    <option value="1">1 Dagdeel</option>
                </select>
                <div id="btn-${index}" 
                    class="w-10 h-10 rounded-full ${btnColor} flex items-center justify-center transition-colors">
                    <i data-lucide="check" class="w-5 h-5 text-white"></i>
                </div>
            </div>
        </div>`;
        container.innerHTML += html;
    });
    lucide.createIcons();
}

function fillSelect() {
    const select = document.getElementById('reportParticipant');
    select.innerHTML = '<option>Selecteer...</option>';
    participantsData.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.naam;
        opt.innerText = p.naam;
        select.appendChild(opt);
    });
}