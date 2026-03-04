import { sendExportEmail, fetchInvoiceNumber } from './api.js';
import { renderExportPreview } from './ui.js';

export function generateAndDownloadCsv(data, organization, month) {
    if (organization.toLowerCase() === 'cordaan') {
        return generateCordaanExcel(data, month);
    }

    if (organization.toLowerCase() === 'amsta') {
        const filename = `Urenverantwoording_${organization}_${month}.xlsx`;
        return generateAmstaExcel(data, month, filename);
    }

    const orgData = data.filter(d => String(d.organisatie).toLowerCase() === organization.toLowerCase());

    if (orgData.length === 0) {
        throw new Error(`Geen uren gevonden voor ${organization} in deze maand.`);
    }

    let csvContent = "";

    if (organization === 'cordaan') {
        // Fallback of oude logica verwijderd, wordt nu afgevangen door generateCordaanExcel
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

export async function generateCordaanInvoicePDF(data, monthStr, yearStr) {
    // 1. Filter & Aggregate
    const cordaanData = data.filter(d => d.organisatie && d.organisatie.toLowerCase().includes('cordaan'));
    
    const participants = {};
    cordaanData.forEach(row => {
        if (!participants[row.naam]) {
            // Tarief opschonen
            const cleanTarief = String(row.tarief || '').replace(/[^0-9,.-]/g, '').replace(',', '.');
            participants[row.naam] = {
                naam: row.naam,
                dagdelen: 0,
                tarief: parseFloat(cleanTarief) || 0
            };
        }
        participants[row.naam].dagdelen += parseFloat(row.dagdelen) || 0;
    });

    const tableBody = [
        [
            { text: 'Naam Deelnemer', style: 'tableHeader' },
            { text: 'Aantal dagdelen', style: 'tableHeader' },
            { text: 'Tarief', style: 'tableHeader' },
            { text: 'Totaal (BTW 0%)', style: 'tableHeader' }
        ]
    ];

    let grandTotal = 0;
    const sortedNames = Object.keys(participants).sort();

    sortedNames.forEach(name => {
        const p = participants[name];
        const total = p.dagdelen * p.tarief;
        grandTotal += total;

        tableBody.push([
            p.naam,
            p.dagdelen.toString(),
            `€ ${p.tarief.toFixed(2).replace('.', ',')}`,
            `€ ${total.toFixed(2).replace('.', ',')}`
        ]);
    });

    // Totaal rij
    tableBody.push([
        { text: 'Totaal', style: 'tableHeader', colSpan: 3, alignment: 'right' },
        {},
        {},
        { text: `€ ${grandTotal.toFixed(2).replace('.', ',')}`, style: 'tableHeader' }
    ]);

    // 2. Factuurnummer Ophalen
    const invoiceNumber = await fetchInvoiceNumber('Cordaan', grandTotal);

    // 3. PDF Definitie
    const docDefinition = {
        content: [
            { text: "VOF Wimpie & de Domino's", style: 'header' },
            { text: "Aletta Jacobsstraat 59\n1349 HB Almere\nBtw nr: NL867767819801\nKvK: 96802863\nTel: 06-28143815", margin: [0, 0, 0, 20] },
            
            { text: "Aan:", style: 'subheader' },
            { text: "Stichting Cordaan\nt.a.v. de Financiële Administratie\nDe Ruyterkade 7\n1013AA Amsterdam", margin: [0, 0, 0, 20] },

            { text: `Factuur nr: ${invoiceNumber}`, bold: true },
            { text: `Datum: ${new Date().toLocaleDateString('nl-NL')}` },
            { text: `Betreft: Muziek Dagbesteding Wimpie & de Domino's in ${monthStr} '${yearStr.slice(-2)} - medewerkernummer 9125107`, margin: [0, 0, 0, 20] },

            {
                table: {
                    headerRows: 1,
                    widths: ['*', 'auto', 'auto', 'auto'],
                    body: tableBody
                },
                layout: 'lightHorizontalLines',
                margin: [0, 0, 0, 40]
            }
        ],
        footer: {
            text: "Betalingswijze: per bank IBAN NL 81 BUNQ 2154 5934 53 tnv VOF Wimpie & de Domino's te Almere, ovv factuurnummer.\nZorgvrijstelling: deze prestatie is vrijgesteld van BTW.\nTe betalen binnen 30 dagen na ontvangst factuur.",
            alignment: 'center',
            fontSize: 10,
            margin: [40, 0, 40, 0]
        },
        styles: {
            header: { fontSize: 18, bold: true, margin: [0, 0, 0, 5] },
            subheader: { fontSize: 12, bold: true, margin: [0, 0, 0, 2] },
            tableHeader: { bold: true, fillColor: '#eeeeee' }
        }
    };

    // 4. Genereren
    pdfMake.createPdf(docDefinition).download(`Factuur_${invoiceNumber}_Cordaan_${monthStr}_${yearStr}.pdf`);
}