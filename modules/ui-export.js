import { setButtonState } from './ui.js';

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
        const rowNaam = row['Naam'] ? String(row['Naam']) : '';
        const isSubtotal = rowNaam.startsWith('Subtotaal') || rowNaam.startsWith('--- VERVOER') || rowNaam === 'EINDTOTAAL';
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
        setButtonState(btn, 'loading', { text: 'Bezig met uploaden en mailen...', disabled: true, spacing: 'mr-2', iconSize: 'w-4 h-4' });
        
        try {
            await onConfirmCallback();
            alert("Succes! Het bestand is succesvol gemaild.");
            close();
        } catch (e) {
            console.error(e);
            alert("Er ging iets mis: " + e.message);
            setButtonState(btn, 'default', { text: 'Opnieuw proberen', disabled: false });
        }
    };

    if (onInvoiceCallback) {
        document.getElementById('invoiceExportBtn').onclick = async function() {
            const btn = this;
            setButtonState(btn, 'loading', { text: 'Genereren...', disabled: true, spacing: 'mr-2', iconSize: 'w-4 h-4' });
            try {
                await onInvoiceCallback();
                setButtonState(btn, 'success', { text: 'Gedownload', disabled: false, spacing: 'mr-2', iconSize: 'w-4 h-4' });
            } catch (e) {
                console.error(e);
                alert("Fout bij genereren factuur: " + e.message);
                setButtonState(btn, 'default', { text: 'Opnieuw proberen', disabled: false });
            }
        };
    }
}