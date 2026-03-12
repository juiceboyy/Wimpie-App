import { sendExportEmail } from './api.js';
import { renderExportPreview } from './ui.js';

export function generateAmstaExcel(data, month, filename) {
    // 1. Filteren op Amsta
    const amstaData = data.filter(d => d.organisatie && d.organisatie.toLowerCase() === 'amsta');

    if (amstaData.length === 0) {
        throw new Error(`Geen data gevonden voor Amsta in ${month}`);
    }

    // Sorteren op datum
    amstaData.sort((a, b) => new Date(a.datum) - new Date(b.datum));

    // 2. Mappen naar Amsta format
    const amstaRows = amstaData.map(row => {
        // Datum omzetten van YYYY-MM-DD naar DD-mmm-YYYY (bijv 12-jan-2026)
        const dateParts = row.datum.split('-');
        const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
        const formattedDate = dateObj.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');
        
        return {
            "Naam Cliënt": row.naam,
            "Geboortedatum": row.geboortedatum || "22-02-1983", // Fallback
            "Product/Zorgprestatie": "Dagbesteding Muziek",
            "Datum": formattedDate,
            "Tijd van": "10:00",
            "Tijd tot": "16:00",
            "Locatie": "Boomkerk",
            "Dagdelen": row.dagdelen || 2,
            "Opmerkingen": "Maandag repetitie"
        };
    });

    // 3. Preview tonen
    renderExportPreview(amstaRows, filename, month, async () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(amstaRows);

        // Header dikgedrukt maken
        if (ws['!ref']) {
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ r: 0, c: C });
                if (ws[cellRef]) {
                    if (!ws[cellRef].s) ws[cellRef].s = {};
                    ws[cellRef].s.font = { bold: true };
                }
            }
        }

        // Kolombreedtes
        ws['!cols'] = [{wch: 20}, {wch: 15}, {wch: 25}, {wch: 15}, {wch: 10}, {wch: 10}, {wch: 15}, {wch: 10}, {wch: 20}];

        XLSX.utils.book_append_sheet(wb, ws, "Blad1");

        // Base64 genereren en versturen
        const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        await sendExportEmail({ filename, base64Data, maand: month, organisatie: 'amsta' });
    });
}