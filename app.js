import * as API from './modules/api.js';
import { handleExportAction } from './modules/export.js';
import { verifyAccess } from './modules/auth.js';
import { switchTab, renderParticipants, fillSelect, renderHistoryList, updateReportView, updatePresenceVisuals, setupDynamicUI, setButtonState } from './modules/ui.js';
import * as State from './modules/state.js';
import { calculateAndRenderExpenses } from './modules/expenses.js';
import { controleerAanmaningen } from './modules/aanmaning.js';
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
    validateAIBtn();
}

function setupEventListeners() {
    document.getElementById('presenceDate').addEventListener('change', loadAttendanceForDate);
    document.getElementById('reportDate').addEventListener('change', loadExistingReport);
    document.getElementById('reportParticipant').addEventListener('change', () => {
        loadReportHistory();
        loadExistingReport();
    });
    document.getElementById('reportText').addEventListener('input', validateAIBtn);
}

function validateAIBtn() {
    const naam = document.getElementById('reportParticipant').value;
    const text = document.getElementById('reportText').value.trim();
    const btn = document.getElementById('btn-ai-improve');
    if (btn) btn.disabled = (naam === 'Selecteer...' || text.length === 0 || text.length > 1000);
}

// Functies beschikbaar maken voor HTML onclick attributes
function exposeGlobals() {
    window.switchTab = switchTab;
    window.saveAttendance = saveAttendance;
    window.saveReport = saveReport;
    window.downloadExport = handleExport;
    window.togglePresence = togglePresence;
    window.calculateExpenses = calculateAndRenderExpenses;
    window.controleerAanmaningen = controleerAanmaningen;
    window.improveReportWithAI = improveReportWithAI;
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

    setButtonState('btn-save-attendance', 'loading', { text: 'Gegevens ophalen...', disabled: true });

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

    setButtonState('btn-save-attendance', 'default', { text: 'Opslaan', icon: 'save', disabled: false });
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
        validateAIBtn();
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
    setButtonState('btn-save-attendance', 'loading', { text: 'Bezig met bijwerken...', disabled: true });

    if (entries.length === 0) entries.push({ datum: datum, naam: "DELETE_SIGNAL", dagdelen: 0, aanwezig: "Nee" });

    const result = await runSafe(
        () => API.postRegistration(entries),
        () => setButtonState('btn-save-attendance', 'error', { text: 'Fout bij opslaan', disabled: false })
    );

    if (result) {
        setButtonState('btn-save-attendance', 'success', { text: 'Succesvol Bijgewerkt!' });
    }
    
    setTimeout(() => { 
        setButtonState('btn-save-attendance', 'default', { text: 'Opslaan', icon: 'save', disabled: false });
    }, 2000);
}

async function saveReport() {
    const datum = document.getElementById('reportDate').value;
    const naam = document.getElementById('reportParticipant').value;
    const tekst = document.getElementById('reportText').value;

    if (naam === 'Selecteer...' || !tekst) return alert("Vul alles in.");

    const resetBtn = () => setButtonState('btn-save-report', 'default', { text: 'Verslag Versturen', icon: 'send', disabled: false });

    setButtonState('btn-save-report', 'loading', { text: 'Versturen...', disabled: true });

    try {
        const result = await runSafe(
            () => API.postReport({ datum, naam, tekst }),
            (e) => {
                alert("Fout bij opslaan: " + (e.message || e));
                setButtonState('btn-save-report', 'error', { text: 'Fout bij opslaan', disabled: false });
            }
        );

        if (result) {
            alert(result.message || 'Succes! Het verslag is verwerkt en verzonden.');
            setButtonState('btn-save-report', 'success', { text: 'Verslag Opgeslagen!' });
        }
    } finally {
        setTimeout(resetBtn, 2000);
    }
}

async function improveReportWithAI() {
    const naam = document.getElementById('reportParticipant').value;
    const steekwoorden = document.getElementById('reportText').value.trim();

    if (naam === 'Selecteer...' || !steekwoorden || steekwoorden.length > 1000) return;

    const resetBtn = () => setButtonState('btn-ai-improve', 'default', { text: 'AI Verbetering', icon: 'sparkles', disabled: false, iconSize: 'w-4 h-4', spacing: 'mr-2' });

    setButtonState('btn-ai-improve', 'loading', { text: 'AI schrijft...', disabled: true, iconSize: 'w-4 h-4', spacing: 'mr-2' });

    const historyDates = await runSafe(() => API.fetchReportHistory(naam), () => []);
    let historieText = "";

    if (historyDates && historyDates.length > 0) {
        const currentDate = document.getElementById('reportDate').value;
        const pastDates = historyDates.filter(d => d !== currentDate).slice(0, 3);
        const reports = await Promise.all(pastDates.map(d => runSafe(() => API.fetchReport(d, naam), () => null)));
        historieText = reports.filter(r => r && r.tekst).map((r, i) => `Verslag ${i+1}: ${r.tekst}`).join(' | ');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const result = await runSafe(
        () => API.improveReportWithAI(naam, steekwoorden, historieText, controller.signal),
        (e) => {
            clearTimeout(timeoutId);
            if (e.name === 'AbortError') {
                alert("De AI doet er onverwacht lang over, probeer het zo nog eens.");
            } else {
                alert("Fout bij AI generatie: " + (e.message || e));
            }
            resetBtn();
        }
    );

    clearTimeout(timeoutId);

    if (result && result.verbeterdVerslag) {
        document.getElementById('reportText').value = result.verbeterdVerslag;
        validateAIBtn();
        setButtonState('btn-ai-improve', 'success', { text: 'Verbeterd!', disabled: false, iconSize: 'w-4 h-4', spacing: 'mr-2' });
        setTimeout(resetBtn, 3000);
    } else if (result) {
        // Onverwacht serverantwoord zonder verbeterdVerslag
        alert("Onverwacht antwoord van de server, probeer het opnieuw.");
        resetBtn();
    }
    // result === null: error callback heeft al resetBtn aangeroepen
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