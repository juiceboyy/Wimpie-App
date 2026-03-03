import { sendExportEmail } from './api.js';

export function generateAndDownloadCsv(data, organization, month) {
    if (organization.toLowerCase() === 'cordaan') {
        return generateCordaanExcel(data, month);
    }

    const orgData = data.filter(d => String(d.organisatie).toLowerCase() === organization.toLowerCase());

    if (orgData.length === 0) {
        throw new Error(`Geen uren gevonden voor ${organization} in deze maand.`);
    }

    let csvContent = "";

    if (organization === 'cordaan') {
        // Fallback of oude logica verwijderd, wordt nu afgevangen door generateCordaanExcel
    } else if (organization === 'amsta') {
        // Amsta Format: Volledige naam;Product;Datum;Tijd van;Tijd tot
        csvContent += "Volledige naam;Product;Datum;Tijd van;Tijd tot\r\n";
        orgData.forEach(row => {
            const d = row.datum.split('-');
            const nlDatum = `${d[2]}-${d[1]}-${d[0]}`;
            const tijdVan = "09:00";
            const tijdTot = parseInt(row.dagdelen) === 2 ? "17:00" : "13:00";
            csvContent += `${row.naam};${row.code};${nlDatum};${tijdVan};${tijdTot}\r\n`;
        });
    }

    // Download triggeren
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Urenverantwoording_${organization}_${month}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

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

    for (let i = 0; i < cordaanData.length; i++) {
        const row = cordaanData[i];

        // Datum conversie YYYY-MM-DD -> D/M/YYYY
        const [y, m, d] = row.datum.split('-');
        const formattedDate = `${parseInt(d)}/${parseInt(m)}/${y}`;

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
            "Medewerkernummer": "1965203",
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

            // Reset tellers
            subMinuten = 0;
            subDagdelen = 0;
            subBedrag = 0;
        }
    }

    // 4. Bestandsnaam genereren
    const [yearStr, monthStr] = yearMonth.split('-');
    const year = parseInt(yearStr);
    const monthIndex = parseInt(monthStr) - 1;
    const lastDay = new Date(year, monthIndex + 1, 0).getDate(); // Laatste dag van de maand
    const monthNames = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
    
    // Format: YYMMDD - ...
    const shortYear = yearStr.slice(2);
    const filename = `${shortYear}${monthStr}${lastDay} - Controlebestand Wimpie&Domino's - ${monthNames[monthIndex]} '${shortYear}.xlsx`;

    // 5. Excel Generatie
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
            const isSubtotal = (cell && cell.v && String(cell.v).startsWith('Subtotaal'));

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
    XLSX.writeFile(wb, filename);

    // Email versturen naar backend
    const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    sendExportEmail({ filename, base64Data, maand: yearMonth })
        .then(() => alert("Bestand succesvol gedownload en gemaild naar Cordaan!"))
        .catch(e => alert("Bestand gedownload, maar mailen mislukt: " + e.message));
}