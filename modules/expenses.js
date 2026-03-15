import * as API from './api.js';

export async function calculateAndRenderExpenses() {
    const maandInput = document.getElementById('exportMonth').value;
    if (!maandInput) return alert("Selecteer eerst een maand om de uitgaven te berekenen.");

    const btn = document.getElementById('btn-calc-expenses');
    if (btn) btn.innerHTML = "Berekenen...";

    try {
        // Haal export data op (deze is in de backend al gefilterd op aanwezig = 'Ja')
        const data = await API.fetchExport(maandInput);
        
        // Haal alle unieke datums uit de dataset waarop minstens één deelnemer aanwezig was
        const uniqueDays = new Set();
        data.forEach(row => {
            if (row.datum) {
                uniqueDays.add(row.datum);
            }
        });

        const activeDays = uniqueDays.size;
        const totalAmount = activeDays * 50;

        renderExpenseUI(activeDays, totalAmount, maandInput);
    } catch (e) {
        console.error(e);
        alert("Fout bij berekenen uitgaven: " + e.message);
    } finally {
        if (btn) btn.innerHTML = "Bereken Huur Oefenruimte";
    }
}

function renderExpenseUI(activeDays, totalAmount, maandInput) {
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

    const [jaar, maand] = maandInput.split('-');
    const maandNamen = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
    const maandNaam = maandNamen[parseInt(maand, 10) - 1];

    const bunqLink = `https://bunq.me/JouwBunqLink/${totalAmount}/Oefenruimte%20${maandNaam}`;

    container.innerHTML = `
        <h3 class="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2"><i data-lucide="calculator" class="w-5 h-5"></i> Uitgaven / Oefenruimte</h3>
        <p class="text-slate-600 mb-4">
            Aantal actieve dagen in ${maandNaam}: <strong>${activeDays}</strong>.<br>
            Totaalbedrag: <strong>€ ${totalAmount},-</strong> (Vrijgesteld van BTW)
        </p>
        <div class="flex flex-wrap gap-3 items-center">
            <a href="${bunqLink}" target="_blank" class="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded shadow transition-colors inline-flex items-center gap-2">
                <i data-lucide="credit-card" class="w-4 h-4"></i> Betaal via Bunq
            </a>
            <button id="btn-book-expense" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded shadow transition-colors inline-flex items-center gap-2">
                <i data-lucide="book-check" class="w-4 h-4"></i> Goedkeuren en Boek in Administratie
            </button>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Koppel de boeking-logic aan de knop
    document.getElementById('btn-book-expense').onclick = async function() {
        this.disabled = true;
        this.innerHTML = `<span class="animate-spin mr-2">⏳</span> Bezig met boeken...`;
        try {
            const omschrijving = `Huur oefenruimte ${maandNaam} ${jaar}`;
            const result = await API.bookExpense(omschrijving, totalAmount);
            
            alert(`Succes! Bon ${result.bonnummer} is geboekt in het Inkoop tabblad.`);
            this.innerHTML = `<i data-lucide="check" class="w-4 h-4 mr-2"></i> Geboekt (Bon: ${result.bonnummer})`;
            this.classList.replace('bg-green-600', 'bg-slate-400');
            this.classList.replace('hover:bg-green-700', 'hover:bg-slate-400');
            if (window.lucide) window.lucide.createIcons();
        } catch (e) {
            console.error(e);
            alert("Fout bij boeken: " + e.message);
            this.disabled = false;
            this.innerHTML = `<i data-lucide="alert-circle" class="w-4 h-4 mr-2"></i> Probeer opnieuw`;
            if (window.lucide) window.lucide.createIcons();
        }
    };
}