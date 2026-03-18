import * as API from './modules/api.js';
import { handleExportAction } from './modules/export.js';
import { verifyAccess } from './modules/auth.js';
import { switchTab, renderParticipants, fillSelect, renderHistoryList, updateReportView, updatePresenceVisuals } from './modules/ui.js';
import * as State from './modules/state.js';
import { calculateAndRenderExpenses } from './modules/expenses.js';

// INIT
function init() {
    if (!verifyAccess()) return;

    exposeGlobals();
    setupEventListeners();

    document.getElementById('presenceDate').valueAsDate = new Date();
    document.getElementById('reportDate').valueAsDate = new Date();
    lucide.createIcons();
    fetchParticipants();
    applyUniformButtonDesign();

    // Taak 2 & 3: Verberg bestaande AMSTA Excel knop en voeg AMSTA PDF knop toe
    const amstaExcelBtn = document.querySelector('button[onclick="downloadExport(\'amsta\')"]');
    if (amstaExcelBtn) {
        amstaExcelBtn.style.display = 'none'; // Verberg de oude
        
        // Maak de nieuwe AMSTA factuur knop
        const newAmstaPdfBtn = document.createElement('button');
        // Uniform Design Systeem: Paars
        newAmstaPdfBtn.className = 'flex items-center justify-start text-left p-4 w-full border-2 rounded-lg transition-all bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 font-semibold';
        newAmstaPdfBtn.innerHTML = '<i data-lucide="file-text" class="w-5 h-5 mr-3"></i> Genereer AMSTA Factuur (PDF)';
        newAmstaPdfBtn.onclick = () => window.downloadExport('amsta-factuur');
        
        amstaExcelBtn.parentNode.insertBefore(newAmstaPdfBtn, amstaExcelBtn.nextSibling);
        if (window.lucide) window.lucide.createIcons();
    }
}

function applyUniformButtonDesign() {
    // 1. Cordaan (Oranje)
    const cordaanBtn = document.querySelector('button[onclick="downloadExport(\'cordaan\')"]');
    if (cordaanBtn) {
        cordaanBtn.className = 'flex items-center justify-start text-left p-4 w-full border-2 rounded-lg transition-all bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 font-semibold';
        cordaanBtn.innerHTML = '<i data-lucide="file-spreadsheet" class="w-5 h-5 mr-3"></i> Genereer Cordaan Urendeclaratie (Excel)';
    }

    // 2. Thomashuis (Geel/Goud)
    const thomashuisBtn = document.querySelector('button[onclick="downloadExport(\'thomashuis\')"]');
    if (thomashuisBtn) {
        thomashuisBtn.className = 'flex items-center justify-start text-left p-4 w-full border-2 rounded-lg transition-all bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100 font-semibold';
        thomashuisBtn.innerHTML = '<i data-lucide="file-text" class="w-5 h-5 mr-3"></i> Genereer Thomashuis Factuur (PDF)';
    }

    // 3. Oefenruimte (Blauw/Grijs - Slate)
    const expenseBtn = document.getElementById('btn-calc-expenses');
    if (expenseBtn) {
        expenseBtn.className = 'flex items-center justify-start text-left p-4 w-full border-2 rounded-lg transition-all bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold';
        expenseBtn.innerHTML = '<i data-lucide="calculator" class="w-5 h-5 mr-3"></i> Bereken Huur Oefenruimte';
    }
    
    // 4. Aanwezigheid Opslaan (Blauw)
    const saveAttendanceBtn = document.getElementById('btn-save-attendance');
    if (saveAttendanceBtn) {
        saveAttendanceBtn.className = 'flex items-center justify-center p-4 w-full border-2 rounded-lg transition-all bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 font-semibold';
        saveAttendanceBtn.innerHTML = '<i data-lucide="save" class="w-5 h-5 mr-3"></i> Opslaan';
    }

    // 5. Verslag Versturen (Groen)
    const saveReportBtn = document.getElementById('btn-save-report');
    if (saveReportBtn) {
        saveReportBtn.className = 'flex items-center justify-center p-4 w-full border-2 rounded-lg transition-all bg-green-50 border-green-200 text-green-700 hover:bg-green-100 font-semibold';
        saveReportBtn.innerHTML = '<i data-lucide="send" class="w-5 h-5 mr-3"></i> Verslag Versturen';
    }

    if (window.lucide) window.lucide.createIcons();
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
    try {
        const data = await API.fetchParticipants();
        State.setParticipants(data);
        renderParticipants(State.getParticipants(), State.getPresence());
        fillSelect(State.getParticipants());
        document.getElementById('statusIndicator').classList.replace('bg-red-400', 'bg-green-500');
        loadAttendanceForDate();
    } catch (e) {
        console.error(e);
        State.setParticipants([]);
        document.getElementById('participantsList').innerHTML = '<div class="p-4 text-red-500">Kan data niet laden van de server.</div>';
    }
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

    try {
        const historyData = await API.fetchAttendance(datum);
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
    } catch (e) { console.error(e); }
    finally { 
        btn.innerHTML = '<i data-lucide="save" class="w-5 h-5 mr-3"></i> Opslaan'; 
        btn.disabled = false; 
        if (window.lucide) window.lucide.createIcons();
    }
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
        renderHistoryList(datums, (d) => {
            document.getElementById('reportDate').value = d;
            loadExistingReport();
        });
    } catch (e) {
        console.error(e);
        list.innerHTML = '<span class="text-xs text-red-400">Fout bij laden.</span>';
    }
}

async function loadExistingReport() {
    const datum = document.getElementById('reportDate').value;
    const naam = document.getElementById('reportParticipant').value;

    if (!datum || naam === 'Selecteer...') return;

    updateReportView("", "Zoeken naar bestaand verslag...", true);

    try {
        const data = await API.fetchReport(datum, naam);
        updateReportView(data.tekst, "Typ hier je verslag...", false);
    } catch (e) {
        console.error(e);
        updateReportView("", "Fout bij ophalen.", false);
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

    await API.postRegistration(entries);
    btn.innerHTML = '<i data-lucide="check" class="w-5 h-5 mr-3"></i> Succesvol Bijgewerkt!';
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

    try {
        const result = await API.postReport({ datum, naam, tekst });
        alert(result.message || 'Succes! Het verslag is verwerkt en verzonden.');
        btn.innerHTML = '<i data-lucide="check" class="w-5 h-5 mr-3"></i> Verslag Opgeslagen!';
    } catch (e) {
        alert("Fout bij opslaan: " + e);
        btn.innerHTML = '<i data-lucide="alert-circle" class="w-5 h-5 mr-3"></i> Fout bij opslaan';
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

    try {
        const data = await API.fetchExport(maandInput);
        await handleExportAction(data, organisatie, maandInput);

    } catch (e) {
        console.error(e);
        alert(e.message || "Fout bij ophalen van export data.");
    } finally {
        status.classList.add('hidden');
    }
}

// Start de applicatie
init();