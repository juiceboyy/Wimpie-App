import * as API from './api.js';
import { runSafe } from './utils.js';
import { renderExpenseBlock, setButtonState } from './ui.js';

export async function calculateAndRenderExpenses() {
    const maandInput = document.getElementById('exportMonth').value;
    if (!maandInput) return alert("Selecteer eerst een maand om de uitgaven te berekenen.");

    setButtonState('btn-calc-expenses', 'loading', { text: 'Berekenen...', disabled: true });

    const data = await runSafe(
        () => API.fetchExport(maandInput),
        (e) => { alert("Fout bij berekenen uitgaven: " + e.message); }
    );

    if (data) {
        // Haal alle unieke datums uit de dataset waarop minstens één deelnemer aanwezig was
        const uniqueDays = new Set();
        data.forEach(row => {
            if (row.datum) {
                uniqueDays.add(row.datum);
            }
        });

        const activeDays = uniqueDays.size;
        const totalAmount = activeDays * 50;

        const [jaar, maand] = maandInput.split('-');
        const maandNamen = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
        const maandNaam = maandNamen[parseInt(maand, 10) - 1];
        const omschrijving = `Huur oefenruimte ${maandNaam} ${jaar}`;

        renderExpenseBlock({
            activeDays,
            totalAmount,
            maandNaam,
            omschrijving,
            onBookCallback: async () => {
                return await runSafe(
                    () => API.bookExpense(omschrijving, totalAmount),
                    (e) => { alert("Fout bij boeken: " + e.message); }
                );
            }
        });
    }

    // Wordt altijd uitgevoerd (werkte voorheen als "finally")
    setButtonState('btn-calc-expenses', 'default', { text: 'Bereken Huur Oefenruimte', icon: 'calculator', disabled: false });
}