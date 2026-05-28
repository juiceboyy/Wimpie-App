import * as API from './api.js';
import { runSafe } from './utils.js';
import { setButtonState } from './ui.js';

let activePerformances = [];

/**
 * Laadt de optredens voor de geselecteerde datum en rendert ze in de UI.
 */
export async function loadPerformancesForDate() {
  const dateInput = document.getElementById('performancesDate');
  if (!dateInput) return;
  const datum = dateInput.value;
  if (!datum) return;

  const container = document.getElementById('performancesList');
  container.innerHTML = `
    <div class="flex items-center justify-center py-8 text-slate-400">
      <span class="animate-spin mr-3">⏳</span>
      <span class="text-sm font-medium">Communicatiegegevens laden...</span>
    </div>
  `;

  setButtonState('btn-save-performances', 'loading', { text: 'Gegevens ophalen...', disabled: true });

  const data = await runSafe(
    () => API.fetchPerformances(datum),
    (e) => {
      container.innerHTML = `<div class="p-4 text-red-500 rounded-lg bg-red-50 border border-red-200 text-sm">Kan communicatiegegevens niet laden: ${e.message || e}</div>`;
      setButtonState('btn-save-performances', 'error', { text: 'Laden mislukt', disabled: false });
    }
  );

  if (data) {
    activePerformances = data;
    renderPerformances(data);
    setButtonState('btn-save-performances', 'default', { text: 'Opslaan', icon: 'save', disabled: false });
  }
}

/**
 * Rendert de lijst met iOS-stijl kaarten voor alle deelnemers.
 */
function renderPerformances(entries) {
  const container = document.getElementById('performancesList');
  container.innerHTML = '';

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-100 shadow-sm">
        Geen actieve deelnemers gevonden. Voeg eerst deelnemers toe in Google Sheets.
      </div>
    `;
    return;
  }

  entries.forEach((entry, index) => {
    const isVrijBenaderd = entry.vrijhoudenBenaderd === 'Ja';
    const isVervoerBenaderd = entry.vervoerBenaderd === 'Ja';

    const cardHtml = `
      <div class="ios-card p-4 space-y-4 border border-slate-100 hover:shadow-md transition-all duration-200">
        <!-- Deelnemer header -->
        <div class="flex justify-between items-center pb-2 border-b border-slate-100">
          <div>
            <div class="font-bold text-slate-800 text-base leading-tight">${entry.naam}</div>
            <div class="text-xs font-semibold text-indigo-500 mt-0.5">${entry.organisatie}</div>
          </div>
          <div class="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
            PB Communicatie
          </div>
        </div>

        <!-- Twee kolommen voor Vrijhouden en Vervoer -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Sectie 1: Datum Vrijhouden -->
          <div class="space-y-2 p-3 bg-indigo-50/40 rounded-xl border border-indigo-100/50">
            <span class="block text-xs font-bold text-indigo-950 uppercase tracking-wide">1. Datum Vrijhouden</span>
            <div class="flex items-center gap-2">
              <!-- Custom Toggle Benaderd -->
              <button type="button" onclick="window.togglePerformanceField(${index}, 'vrijhouden')" 
                id="btn-vrijhouden-benaderd-${index}"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-250 ${isVrijBenaderd ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}">
                <span id="icon-vrijhouden-${index}">${isVrijBenaderd ? '✓' : '✗'}</span>
                <span>Benaderd</span>
              </button>
              <input type="hidden" id="vrijhouden-benaderd-${index}" value="${entry.vrijhoudenBenaderd}">

              <!-- Status Dropdown -->
              <select id="vrijhouden-status-${index}" onchange="window.updatePerformanceSelectColor(this)"
                class="flex-1 rounded-lg text-xs font-semibold p-1.5 outline-none border transition-all duration-200">
                <option value="Open" ${entry.vrijhoudenStatus === 'Open' ? 'selected' : ''}>Open</option>
                <option value="OK" ${entry.vrijhoudenStatus === 'OK' ? 'selected' : ''}>OK</option>
                <option value="NIET OK" ${entry.vrijhoudenStatus === 'NIET OK' ? 'selected' : ''}>NIET OK</option>
              </select>
            </div>
          </div>

          <!-- Sectie 2: Vervoer Regelen -->
          <div class="space-y-2 p-3 bg-indigo-50/40 rounded-xl border border-indigo-100/50">
            <span class="block text-xs font-bold text-indigo-950 uppercase tracking-wide">2. Vervoer Regelen</span>
            <div class="flex items-center gap-2">
              <!-- Custom Toggle Benaderd -->
              <button type="button" onclick="window.togglePerformanceField(${index}, 'vervoer')" 
                id="btn-vervoer-benaderd-${index}"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-250 ${isVervoerBenaderd ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}">
                <span id="icon-vervoer-${index}">${isVervoerBenaderd ? '✓' : '✗'}</span>
                <span>Benaderd</span>
              </button>
              <input type="hidden" id="vervoer-benaderd-${index}" value="${entry.vervoerBenaderd}">

              <!-- Status Dropdown -->
              <select id="vervoer-status-${index}" onchange="window.updatePerformanceSelectColor(this)"
                class="flex-1 rounded-lg text-xs font-semibold p-1.5 outline-none border transition-all duration-200">
                <option value="Open" ${entry.vervoerStatus === 'Open' ? 'selected' : ''}>Open</option>
                <option value="OK" ${entry.vervoerStatus === 'OK' ? 'selected' : ''}>OK</option>
                <option value="NIET OK" ${entry.vervoerStatus === 'NIET OK' ? 'selected' : ''}>NIET OK</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Opmerkingen veld -->
        <div class="space-y-1.5">
          <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wide">Eventuele opmerkingen</label>
          <input type="text" id="opmerkingen-${index}" value="${entry.opmerkingen || ''}"
            placeholder="Bijv. Wacht nog op reactie PB'er, kan alleen heenweg..."
            class="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 rounded-xl p-2.5 outline-none text-xs text-slate-700 focus:ring-2 focus:ring-indigo-100 transition-all duration-200">
        </div>
      </div>
    `;
    container.innerHTML += cardHtml;
  });

  // Pas kleurcodering direct toe op alle select-elementen
  document.querySelectorAll('#performancesList select').forEach(select => {
    updateSelectColor(select);
  });
}

/**
 * Knoppen interactie: toggelt de 'Benaderd' status tussen Ja/Nee en updatet de visuals.
 */
export function toggleField(index, type) {
  const hiddenInput = document.getElementById(`${type}-benaderd-${index}`);
  const btn = document.getElementById(`btn-${type}-benaderd-${index}`);
  const icon = document.getElementById(`icon-${type}-${index}`);
  if (!hiddenInput || !btn) return;

  const currentVal = hiddenInput.value;
  const newVal = currentVal === 'Ja' ? 'Nee' : 'Ja';
  hiddenInput.value = newVal;

  if (newVal === 'Ja') {
    btn.className = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-250 bg-indigo-600 text-white shadow-sm shadow-indigo-100";
    icon.innerText = '✓';
  } else {
    btn.className = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-250 bg-slate-200 text-slate-600 hover:bg-slate-300";
    icon.innerText = '✗';
  }
}

/**
 * Kleurt de dropdowns in op basis van hun geselecteerde waarde (OK: groen, NIET OK: rood, Open: grijs).
 */
export function updateSelectColor(selectEl) {
  if (!selectEl) return;
  const val = selectEl.value;

  selectEl.classList.remove(
    'bg-emerald-50', 'text-emerald-700', 'border-emerald-200',
    'bg-rose-50', 'text-rose-700', 'border-rose-200',
    'bg-slate-50', 'text-slate-600', 'border-slate-200'
  );

  if (val === 'OK') {
    selectEl.classList.add('bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
  } else if (val === 'NIET OK') {
    selectEl.classList.add('bg-rose-50', 'text-rose-700', 'border-rose-200');
  } else {
    selectEl.classList.add('bg-slate-50', 'text-slate-600', 'border-slate-200');
  }
}

/**
 * Verzamelt alle ingevoerde gegevens uit de DOM en stuurt ze naar de API om opgeslagen te worden.
 */
export async function savePerformances() {
  const dateInput = document.getElementById('performancesDate');
  if (!dateInput) return;
  const datum = dateInput.value;
  if (!datum) return alert("Selecteer een geldige datum.");

  if (activePerformances.length === 0) {
    return alert("Er zijn geen actieve deelnemers om op te slaan.");
  }

  const entries = activePerformances.map((p, index) => {
    const vrijhoudenBenaderd = document.getElementById(`vrijhouden-benaderd-${index}`)?.value || 'Nee';
    const vrijhoudenStatus = document.getElementById(`vrijhouden-status-${index}`)?.value || 'Open';
    const vervoerBenaderd = document.getElementById(`vervoer-benaderd-${index}`)?.value || 'Nee';
    const vervoerStatus = document.getElementById(`vervoer-status-${index}`)?.value || 'Open';
    const opmerkingen = document.getElementById(`opmerkingen-${index}`)?.value || '';

    return {
      naam: p.naam,
      vrijhoudenBenaderd,
      vrijhoudenStatus,
      vervoerBenaderd,
      vervoerStatus,
      opmerkingen
    };
  });

  const resetBtn = () => setButtonState('btn-save-performances', 'default', { text: 'Opslaan', icon: 'save', disabled: false });

  setButtonState('btn-save-performances', 'loading', { text: 'Bezig met opslaan...', disabled: true });

  const result = await runSafe(
    () => API.postPerformances(datum, entries),
    (e) => {
      alert("Fout bij opslaan van optredens-communicatie: " + (e.message || e));
      setButtonState('btn-save-performances', 'error', { text: 'Fout bij opslaan', disabled: false });
      setTimeout(resetBtn, 2000);
    }
  );

  if (result) {
    setButtonState('btn-save-performances', 'success', { text: 'Succesvol Opgeslagen!' });
    setTimeout(resetBtn, 2000);
  }
}
