import { fetchInvoiceNumber } from './api.js';

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

        if (total > 0) {
            grandTotal += total;

            tableBody.push([
                p.naam,
                p.dagdelen.toString(),
                `€ ${p.tarief.toFixed(2).replace('.', ',')}`,
                `€ ${total.toFixed(2).replace('.', ',')}`
            ]);
        }
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