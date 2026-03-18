export function switchTab(tab) {
    ['presence', 'reports', 'export'].forEach(t => {
        document.getElementById(`view-${t}`).classList.add('hidden');
        document.getElementById(`tab-${t}`).classList.remove('bg-white', 'shadow-sm', 'text-slate-800');
        document.getElementById(`tab-${t}`).classList.add('text-slate-500');
    });
    document.getElementById(`view-${tab}`).classList.remove('hidden');
    document.getElementById(`tab-${tab}`).classList.add('bg-white', 'shadow-sm', 'text-slate-800');
    document.getElementById(`tab-${tab}`).classList.remove('text-slate-500');
}

export function renderParticipants(data, presenceState) {
    const container = document.getElementById('participantsList');
    container.innerHTML = '';
    
    data.forEach((p, index) => {
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
    
    if (window.lucide) window.lucide.createIcons();
}

export function updatePresenceVisuals(index, isPresent) {
    const btn = document.getElementById(`btn-${index}`);
    const card = document.getElementById(`card-${index}`);

    if (!isPresent) {
        btn.classList.remove('bg-blue-500');
        btn.classList.add('bg-slate-200');
        card.classList.remove('ring-2', 'ring-blue-500');
    } else {
        btn.classList.remove('bg-slate-200');
        btn.classList.add('bg-blue-500');
        card.classList.add('ring-2', 'ring-blue-500');
    }
}

export function fillSelect(data) {
    const select = document.getElementById('reportParticipant');
    select.innerHTML = '<option>Selecteer...</option>';
    data.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.naam;
        opt.innerText = p.naam;
        select.appendChild(opt);
    });
}

export function renderHistoryList(datums, onSelectCallback) {
    const list = document.getElementById('historyList');
    list.innerHTML = '';

    if (datums.length === 0) {
        list.innerHTML = '<span class="text-xs text-slate-400">Nog geen verslagen.</span>';
    } else {
        datums.forEach(d => {
            const delen = d.split('-');
            const nlDatum = `${delen[2]}-${delen[1]}`;

            const badge = document.createElement('button');
            badge.className = "px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-full text-xs font-medium text-slate-700 transition-colors";
            badge.innerText = nlDatum;
            badge.onclick = () => onSelectCallback(d);
            list.appendChild(badge);
        });
    }
}

export function updateReportView(text, placeholder, isLoading) {
    const textarea = document.getElementById('reportText');
    const loader = document.getElementById('reportLoading');

    if (isLoading) {
        textarea.value = "";
        textarea.placeholder = placeholder || "Laden...";
        textarea.disabled = true;
        loader.classList.remove('hidden');
    } else {
        textarea.value = text || "";
        textarea.placeholder = placeholder || "Typ hier je verslag...";
        textarea.disabled = false;
        loader.classList.add('hidden');
        textarea.focus();
    }
}

export function renderExportPreview(excelRows, filename, yearMonth, onConfirmCallback, onInvoiceCallback) {
    // Bestaande modal verwijderen indien aanwezig
    const existingModal = document.getElementById('exportModal');
    if (existingModal) existingModal.remove();

    // Modal container
    const modal = document.createElement('div');
    modal.id = 'exportModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';

    // Tabel headers genereren
    const headers = excelRows.length > 0 ? Object.keys(excelRows[0]) : [];
    const headerHtml = headers.map(h => `<th class="border p-2 bg-slate-100 text-left text-xs font-bold">${h}</th>`).join('');

    // Tabel rijen genereren
    const rowsHtml = excelRows.map(row => {
        // Check voor subtotaal of lege rij voor styling
        const isSubtotal = row['Naam'] && String(row['Naam']).startsWith('Subtotaal');
        const isEmpty = Object.keys(row).length === 0;
        const bgClass = isSubtotal ? 'bg-slate-100 font-bold' : (isEmpty ? 'bg-white' : 'bg-white');
        
        const cells = headers.map(h => {
            let val = row[h] !== undefined ? row[h] : '';
            // Simpele valuta weergave voor preview
            if ((h === 'Tarief' || h === 'Bedrag') && val !== '' && !isNaN(val)) {
                val = '€ ' + parseFloat(val).toFixed(2);
            }
            return `<td class="border p-2 text-xs whitespace-nowrap">${val}</td>`;
        }).join('');
        return `<tr class="${bgClass}">${cells}</tr>`;
    }).join('');

    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div class="p-4 border-b flex justify-between items-center bg-slate-50">
                <div>
                    <h3 class="font-bold text-lg text-slate-800">Export Voorbeeld</h3>
                    <p class="text-sm text-slate-500">${filename}</p>
                </div>
                <button id="closeExportModal" class="text-slate-400 hover:text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            
            <div class="overflow-auto flex-1 p-4">
                <table class="w-full border-collapse">
                    <thead><tr>${headerHtml}</tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>

            <div class="p-4 border-t bg-slate-50 flex justify-end gap-3">
                <button id="cancelExportBtn" class="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded transition-colors">Annuleren</button>
                ${onInvoiceCallback ? `<button id="invoiceExportBtn" class="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded shadow transition-colors flex items-center gap-2"><i data-lucide="file-text" class="w-4 h-4"></i> Factuur (PDF)</button>` : ''}
                <button id="confirmExportBtn" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded shadow transition-colors flex items-center gap-2">
                    <i data-lucide="send" class="w-4 h-4"></i>
                    Akkoord: Verstuur per e-mail
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    if (window.lucide) window.lucide.createIcons();

    // Event Listeners
    const close = () => modal.remove();
    document.getElementById('closeExportModal').onclick = close;
    document.getElementById('cancelExportBtn').onclick = close;

    document.getElementById('confirmExportBtn').onclick = async function() {
        const btn = this;
        btn.disabled = true;
        btn.innerHTML = `<span class="animate-spin mr-2">⏳</span> Bezig met uploaden en mailen...`;
        
        try {
            await onConfirmCallback();
            alert("Succes! Het bestand is succesvol gemaild.");
            close();
        } catch (e) {
            console.error(e);
            alert("Er ging iets mis: " + e.message);
            btn.disabled = false;
            btn.innerHTML = `Opnieuw proberen`;
        }
    };

    if (onInvoiceCallback) {
        document.getElementById('invoiceExportBtn').onclick = async function() {
            const btn = this;
            btn.disabled = true;
            btn.innerHTML = `<span class="animate-spin mr-2">⏳</span> Genereren...`;
            try {
                await onInvoiceCallback();
                btn.innerHTML = `<i data-lucide="check" class="w-4 h-4 mr-2"></i> Gedownload`;
            } catch (e) {
                console.error(e);
                alert("Fout bij genereren factuur: " + e.message);
                btn.innerHTML = `Opnieuw proberen`;
                btn.disabled = false;
            }
        };
    }
}

export function setupDynamicUI() {
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
    }

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