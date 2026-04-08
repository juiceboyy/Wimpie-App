import { sendExportEmail } from './api.js';
import { renderExportPreview } from './ui-export.js';
import { generateCordaanInvoicePDF } from './cordaan-invoice.js';

export function generateCordaanExcel(data, yearMonth) {
    // 1. Filteren op Cordaan
    const cordaanData = data.filter(d => d.organisatie && d.organisatie.toLowerCase().includes('cordaan') && d.bsn && String(d.bsn).trim() !== '');

    if (cordaanData.length === 0) {
        throw new Error(`Geen data gevonden voor Cordaan in ${yearMonth}`);
    }

    // 2. Sorteren: Alfabetisch op Naam, daarna Chronologisch op Datum
    cordaanData.sort((a, b) => {
        if (a.naam < b.naam) return -1;
        if (a.naam > b.naam) return 1;
        return new Date(a.datum) - new Date(b.datum);
    });

    // 3. Data Transformatie & Subtotalen
    const excelRows = [];
    let subMinuten = 0;
    let subDagdelen = 0;
    let subBedrag = 0;
    let totaalUrenBedrag = 0;

    for (let i = 0; i < cordaanData.length; i++) {
        const row = cordaanData[i];

        // Datum conversie YYYY-MM-DD -> D/M/YYYY
        const [y, m, d] = row.datum.split('-');
        const formattedDate = `${parseInt(d)}-${parseInt(m)}-${y}`;

        // Tarief opschonen (€ weghalen, komma naar punt)
        const cleanTarief = String(row.tarief || '').replace(/[^0-9,.-]/g, '').replace(',', '.');
        const tarief = parseFloat(cleanTarief) || 0;

        const dagdelen = parseFloat(row.dagdelen) || 0;
        const minuten = dagdelen * 240;
        const bedrag = dagdelen * tarief;

        // Rij toevoegen
        excelRows.push({
            "Naam": row.naam,
            "BSN": row.bsn,
            "Medewerkernummer": "9125107",
            "Activiteit": row.activiteit_omschrijving || row.code, // Gebruik omschrijving uit legenda, fallback op code
            "Begindatum": formattedDate,
            "Minuten": minuten,
            "Dagdelen": dagdelen,
            "VG": row.code, // Code komt in kolom VG
            "Tarief": tarief,
            "Bedrag": bedrag
        });

        // Subtotalen bijwerken
        subMinuten += minuten;
        subDagdelen += dagdelen;
        subBedrag += bedrag;

        // Control Break: Check of volgende rij een andere naam heeft of dat dit de laatste rij is
        const nextRow = cordaanData[i + 1];
        if (!nextRow || nextRow.naam !== row.naam) {
            excelRows.push({
                "Naam": "Subtotaal " + row.naam,
                "BSN": "",
                "Medewerkernummer": "",
                "Activiteit": "",
                "Begindatum": "",
                "Minuten": subMinuten,
                "Dagdelen": subDagdelen,
                "VG": "",
                "Tarief": "",
                "Bedrag": subBedrag
            });

            // Lege regel toevoegen voor leesbaarheid
            excelRows.push({});

            // Totaal uren bedrag bijhouden
            totaalUrenBedrag += subBedrag;

            // Reset tellers
            subMinuten = 0;
            subDagdelen = 0;
            subBedrag = 0;
        }
    }

    // 3b. Vervoerskosten blok
    const vervoerPerPersoon = {};
    cordaanData.forEach(row => {
        if (row.vervoerTarief > 0) {
            if (!vervoerPerPersoon[row.naam]) {
                vervoerPerPersoon[row.naam] = { tarief: row.vervoerTarief, dagen: new Set() };
            }
            vervoerPerPersoon[row.naam].dagen.add(row.datum);
        }
    });

    let totaalVervoerBedrag = 0;
    const vervoerEntries = Object.entries(vervoerPerPersoon);

    if (vervoerEntries.length > 0) {
        excelRows.push({ "Naam": "--- VERVOER ---", "Dagdelen": "Dagen" });

        for (const [naam, { tarief, dagen }] of vervoerEntries) {
            const aantalDagen = dagen.size;
            const bedrag = aantalDagen * tarief;
            totaalVervoerBedrag += bedrag;

            excelRows.push({
                "Naam": naam,
                "BSN": "",
                "Medewerkernummer": "",
                "Activiteit": "Vervoer",
                "Begindatum": "",
                "Minuten": "",
                "Dagdelen": aantalDagen,
                "VG": "",
                "Tarief": tarief,
                "Bedrag": bedrag
            });
        }
    }

    // 3c. Eindtotaal
    excelRows.push({});
    excelRows.push({
        "Naam": "EINDTOTAAL",
        "BSN": "",
        "Medewerkernummer": "",
        "Activiteit": "",
        "Begindatum": "",
        "Minuten": "",
        "Dagdelen": "",
        "VG": "",
        "Tarief": "",
        "Bedrag": totaalUrenBedrag + totaalVervoerBedrag
    });

    // 4. Bestandsnaam genereren
    const [yearStr, monthStr] = yearMonth.split('-');
    const year = parseInt(yearStr);
    const monthIndex = parseInt(monthStr) - 1;
    const lastDay = new Date(year, monthIndex + 1, 0).getDate(); // Laatste dag van de maand
    const monthNames = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
    
    // Format: YYMMDD - ...
    const shortYear = yearStr.slice(2);
    const filename = `${shortYear}${monthStr}${lastDay} - Controlebestand Wimpie&Domino's - ${monthNames[monthIndex]} '${shortYear}.xlsx`;

    // 5. Preview tonen in plaats van direct downloaden
    renderExportPreview(excelRows, filename, yearMonth, 
    // Confirm Callback (Email)
    async () => {
        // 6. Excel Generatie (Pas bij bevestiging)
        const ws = XLSX.utils.json_to_sheet(excelRows);

        // Kolombreedtes automatisch aanpassen
        if (excelRows.length > 0) {
            const headers = Object.keys(excelRows[0]);
            const wscols = headers.map(h => ({ wch: h.length }));

            excelRows.forEach(row => {
                headers.forEach((h, i) => {
                    const val = row[h];
                    if (val !== undefined && val !== null) {
                        const len = String(val).length;
                        if (len > wscols[i].wch) wscols[i].wch = len;
                    }
                });
            });

            // Extra padding toevoegen
            wscols.forEach(c => c.wch += 2);
            ws['!cols'] = wscols;
        }

        // Styling & Formattering
        if (ws['!ref']) {
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let R = range.s.r; R <= range.e.r; ++R) {
                const firstCellRef = XLSX.utils.encode_cell({ r: R, c: 0 });
                const cell = ws[firstCellRef];
                const isHeader = (R === 0);
                const cellVal = cell && cell.v ? String(cell.v) : '';
                const isSubtotal = cellVal.startsWith('Subtotaal') || cellVal.startsWith('--- VERVOER') || cellVal === 'EINDTOTAAL';

                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                    if (!ws[cellRef]) continue;

                    // 1. Styling (Headers & Subtotalen)
                    if (isHeader || isSubtotal) {
                        if (!ws[cellRef].s) ws[cellRef].s = {};
                        ws[cellRef].s.font = { bold: true };
                        ws[cellRef].s.fill = { fgColor: { rgb: isHeader ? "D9D9D9" : "F2F2F2" } };
                    }

                    // 2. Valuta Formattering (Kolom 8=Tarief, 9=Bedrag) - Niet op header
                    if (!isHeader && (C === 8 || C === 9)) {
                        ws[cellRef].z = '"€ "#,##0.00';
                    }
                }
            }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Blad1");
        
        // Geen lokale download meer (XLSX.writeFile verwijderd)

        // Email versturen naar backend
        const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        await sendExportEmail({ filename, base64Data, maand: yearMonth, organisatie: 'cordaan' });
    }, 
    // Invoice Callback (PDF)
    async () => {
        await generateCordaanInvoicePDF(data, monthStr, yearStr);
    });
}