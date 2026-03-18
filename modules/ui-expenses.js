import { setButtonState } from './ui.js';

export function renderExpenseBlock({ activeDays, totalAmount, maandNaam, omschrijving, onBookCallback }) {
    // Zoek of creëer het uitgaven blok (dynamisch geplaatst in het export overzicht)
    let container = document.getElementById('expenseContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'expenseContainer';
        container.className = 'mt-6 p-5 border border-slate-200 rounded-lg bg-slate-50 shadow-sm';
        
        const exportView = document.getElementById('view-export');
        if (exportView) {
            exportView.appendChild(container);
        } else {
            document.body.appendChild(container);
        }
    }

    const iban = "NL17 INGB 0004 6400 97";
    
    // EPC/SEPA QR-code string opbouwen voor mobiel bankieren apps
    const epcString = `BCD\n002\n1\nSCT\n\nRK Parochie Emmaus\n${iban}\nEUR${totalAmount.toFixed(2)}\n\n\n${omschrijving}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(epcString)}`;

    container.innerHTML = `
        <h3 class="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2"><i data-lucide="calculator" class="w-5 h-5"></i> Uitgaven / Oefenruimte</h3>
        <p class="text-slate-600 mb-4">
            Aantal actieve dagen in ${maandNaam}: <strong>${activeDays}</strong>.<br>
            Totaalbedrag: <strong>€ ${totalAmount},-</strong> (Vrijgesteld van BTW)
        </p>
        
        <div class="mb-5 p-4 bg-white rounded border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-center md:items-start">
            <div class="flex-1 space-y-3 text-sm w-full">
                <h4 class="font-bold text-slate-700 border-b pb-2">Betaalgegevens voor Bunq</h4>
                <div class="grid grid-cols-[100px_1fr] items-center gap-y-3 gap-x-2">
                    <span class="text-slate-500 font-medium">Begunstigde:</span>
                    <span class="font-semibold text-slate-800">RK Parochie Emmaus</span>

                    <span class="text-slate-500 font-medium">IBAN:</span>
                    <span class="font-semibold text-slate-800 font-mono">${iban}</span>

                    <span class="text-slate-500 font-medium">Bedrag:</span>
                    <div class="flex items-center gap-2">
                        <span class="font-semibold text-slate-800">€ ${totalAmount.toFixed(2).replace('.', ',')}</span>
                        <button onclick="navigator.clipboard.writeText('${totalAmount}')" class="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded transition-colors" title="Kopieer Bedrag">
                            <i data-lucide="copy" class="w-4 h-4"></i>
                        </button>
                    </div>

                    <span class="text-slate-500 font-medium">Omschrijving:</span>
                    <div class="flex items-center gap-2">
                        <span class="font-semibold text-slate-800">${omschrijving}</span>
                        <button onclick="navigator.clipboard.writeText('${omschrijving}')" class="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded transition-colors" title="Kopieer Omschrijving">
                            <i data-lucide="copy" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div class="flex flex-col items-center justify-center bg-slate-50 p-3 rounded border border-slate-200 shrink-0">
                <span class="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wider">Scan met app</span>
                <img src="${qrUrl}" alt="SEPA QR Code" class="w-[120px] h-[120px] mix-blend-multiply" />
            </div>
        </div>

        <div class="flex flex-wrap gap-3 items-center">
            <button id="btn-book-expense" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded shadow transition-colors inline-flex items-center gap-2">
                <i data-lucide="book-check" class="w-4 h-4"></i> Goedkeuren en Boek in Administratie
            </button>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    document.getElementById('btn-book-expense').onclick = async function() {
        const btn = this;
        setButtonState(btn, 'loading', { text: 'Bezig met boeken...', disabled: true, spacing: 'mr-2', iconSize: 'w-4 h-4' });

        const result = await onBookCallback();

        if (result) {
            alert(`Succes! Bon ${result.bonnummer} is geboekt in het Inkoop tabblad.`);
            setButtonState(btn, 'success', { text: `Geboekt (Bon: ${result.bonnummer})`, disabled: false, spacing: 'mr-2', iconSize: 'w-4 h-4' });
            btn.classList.replace('bg-green-600', 'bg-slate-400');
            btn.classList.replace('hover:bg-green-700', 'hover:bg-slate-400');
        } else {
            setButtonState(btn, 'error', { text: 'Probeer opnieuw', disabled: false, spacing: 'mr-2', iconSize: 'w-4 h-4' });
        }
    };
}