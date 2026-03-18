import * as API from './modules/api.js';
import { handleExportAction } from './modules/export.js';
import { verifyAccess } from './modules/auth.js';
import { switchTab, renderParticipants, fillSelect, renderHistoryList, updateReportView, updatePresenceVisuals, setupDynamicUI } from './modules/ui.js';
import * as State from './modules/state.js';
import { calculateAndRenderExpenses } from './modules/expenses.js';
import { runSafe } from './modules/utils.js';

// INIT
function init() {
    if (!verifyAccess()) return;

    exposeGlobals();
    setupEventListeners();

    document.getElementById('presenceDate').valueAsDate = new Date();
    document.getElementById('reportDate').valueAsDate = new Date();
    lucide.createIcons();
    setupDynamicUI();
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
    window.calculateExpenses = calculateAndRenderExpenses;
}

async function fetchParticipants() {
    const data = await runSafe(
        () => API.fetchParticipants(),
        () => {
            State.setParticipants([]);
            document.getElementById('participantsList').innerHTML = '<div class="p-4 text-red-500">Kan data niet laden van de server.</div>';
        }
    );

    if (!data) return;

    State.setParticipants(data);
    renderParticipants(State.getParticipants(), State.getPresence());
    fillSelect(State.getParticipants());
    document.getElementById('statusIndicator').classList.replace('bg-red-400', 'bg-green-500');
    loadAttendanceForDate();
}

async function loadAttendanceForDate() {
    const datum = document.getElementById('presenceDate').value;
    if (!datum) return;
    State.resetPresence();
    document.querySelectorAll('[id^="dagdelen-"]').forEach(el => el.value = "2");
    renderParticipants(State.getParticipants(), State.getPresence());

    const btn = document.getElementById('btn-save-attendance');
    btn.innerHTML = '<span class="animate-spin mr-3">⏳</span> Gegevens ophalen...';
    btn.disabled = true;

    const historyData = await runSafe(
        () => API.fetchAttendance(datum),
        () => { /* Fout wordt stil gelogd in runSafe */ }
    );

    if (historyData) {
        const participants = State.getParticipants();
        historyData.forEach(entry => {
            const index = participants.findIndex(p => p.naam === entry.naam);
            if (index > -1) {
                State.setPresence(index, true);
                const select = document.getElementById(`dagdelen-${index}`);
                if (select) select.value = entry.dagdelen;
            }
        });
        renderParticipants(State.getParticipants(), State.getPresence());
    }

    btn.innerHTML = '<i data-lucide="save" class="w-5 h-5 mr-3"></i> Opslaan'; 
    btn.disabled = false; 
    if (window.lucide) window.lucide.createIcons();
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

    const datums = await runSafe(
        () => API.fetchReportHistory(naam),
        () => { list.innerHTML = '<span class="text-xs text-red-400">Fout bij laden.</span>'; }
    );

    if (!datums) return;

    list.innerHTML = '';
    renderHistoryList(datums, (d) => {
        document.getElementById('reportDate').value = d;
        loadExistingReport();
    });
}

async function loadExistingReport() {
    const datum = document.getElementById('reportDate').value;
    const naam = document.getElementById('reportParticipant').value;

    if (!datum || naam === 'Selecteer...') return;

    updateReportView("", "Zoeken naar bestaand verslag...", true);

    const data = await runSafe(
        () => API.fetchReport(datum, naam),
        () => updateReportView("", "Fout bij ophalen.", false)
    );

    if (data) {
        updateReportView(data.tekst, "Typ hier je verslag...", false);
    }
}

function togglePresence(index) {
    const newState = State.togglePresence(index);
    updatePresenceVisuals(index, newState);
}

async function saveAttendance() {
    const datum = document.getElementById('presenceDate').value;
    const entries = [];
    const currentPresence = State.getPresence();
    State.getParticipants().forEach((p, index) => {
        if (currentPresence[index]) {
            entries.push({ datum: datum, naam: p.naam, dagdelen: document.getElementById(`dagdelen-${index}`).value, aanwezig: "Ja" });
        }
    });
    const btn = document.getElementById('btn-save-attendance');
    btn.innerHTML = '<span class="animate-spin mr-3">⏳</span> Bezig met bijwerken...';

    if (entries.length === 0) entries.push({ datum: datum, naam: "DELETE_SIGNAL", dagdelen: 0, aanwezig: "Nee" });

    const result = await runSafe(
        () => API.postRegistration(entries),
        () => { btn.innerHTML = '<i data-lucide="alert-circle" class="w-5 h-5 mr-3"></i> Fout bij opslaan'; }
    );

    if (result) {
        btn.innerHTML = '<i data-lucide="check" class="w-5 h-5 mr-3"></i> Succesvol Bijgewerkt!';
    }
    if (window.lucide) window.lucide.createIcons();
    
    setTimeout(() => { 
        btn.innerHTML = '<i data-lucide="save" class="w-5 h-5 mr-3"></i> Opslaan'; 
        if (window.lucide) window.lucide.createIcons();
    }, 2000);
}

async function saveReport() {
    const datum = document.getElementById('reportDate').value;
    const naam = document.getElementById('reportParticipant').value;
    const tekst = document.getElementById('reportText').value;

    if (naam === 'Selecteer...' || !tekst) return alert("Vul alles in.");

    const btn = document.getElementById('btn-save-report');
    btn.innerHTML = '<span class="animate-spin mr-3">⏳</span> Versturen...';

    const result = await runSafe(
        () => API.postReport({ datum, naam, tekst }),
        (e) => {
            alert("Fout bij opslaan: " + (e.message || e));
            btn.innerHTML = '<i data-lucide="alert-circle" class="w-5 h-5 mr-3"></i> Fout bij opslaan';
        }
    );

    if (result) {
        alert(result.message || 'Succes! Het verslag is verwerkt en verzonden.');
        btn.innerHTML = '<i data-lucide="check" class="w-5 h-5 mr-3"></i> Verslag Opgeslagen!';
    }

    if (window.lucide) window.lucide.createIcons();
    
    setTimeout(() => { 
        btn.innerHTML = '<i data-lucide="send" class="w-5 h-5 mr-3"></i> Verslag Versturen'; 
        if (window.lucide) window.lucide.createIcons();
    }, 2000);
}

async function handleExport(organisatie) {
    const maandInput = document.getElementById('exportMonth').value; // Formaat: YYYY-MM
    if (!maandInput) return alert("Selecteer eerst een maand.");

    const status = document.getElementById('exportStatus');
    status.classList.remove('hidden');

    await runSafe(async () => {
        const data = await API.fetchExport(maandInput);
        await handleExportAction(data, organisatie, maandInput);
    });

    status.classList.add('hidden');
}

// Start de applicatie
init();