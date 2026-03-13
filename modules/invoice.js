import { fetchInvoiceNumber } from './api.js';

// Helper voor maandnamen
const monthNames = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
function getDisplayMonth(monthStr) {
    const mIndex = parseInt(monthStr, 10) - 1;
    return (mIndex >= 0 && mIndex < 12) ? monthNames[mIndex] : monthStr;
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
    const displayMonth = getDisplayMonth(monthStr);
    const omschrijving = `Muziekdagbesteding Cordaan ${displayMonth} ${yearStr}`;
    const invoiceNumber = await fetchInvoiceNumber('Cordaan', grandTotal, omschrijving);

    // 3. PDF Definitie
    const docDefinition = {
        content: [
            { text: "VOF Wimpie & de Domino's", style: 'header' },
            { text: "Aletta Jacobsstraat 59\n1349 HB Almere\nBtw nr: NL867767819801\nKvK: 96802863\nTel: 06-28143815", margin: [0, 0, 0, 20] },
            
            { text: "Aan:", style: 'subheader' },
            { text: "Stichting Cordaan\nt.a.v. de Financiële Administratie\nDe Ruyterkade 7\n1013AA Amsterdam", margin: [0, 0, 0, 20] },

            { text: `Factuur nr: ${invoiceNumber}`, bold: true },
            { text: `Datum: ${new Date().toLocaleDateString('nl-NL')}` },
            { text: `Betreft: Muziek Dagbesteding Wimpie & de Domino's in ${displayMonth} ${yearStr} - medewerkernummer 9125107`, margin: [0, 0, 0, 20] },

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

export async function generateThomashuisInvoicePDF(data, monthStr, yearStr) {
    // 1. Filter & Aggregate
    const clientName = "Casper Slabbers";
    // Filter uitsluitend op de specifieke cliënt
    const clientData = data.filter(d => d.naam && d.naam.trim().toLowerCase() === clientName.toLowerCase());
    const days = clientData.length;

    // Validatie
    if (days === 0) {
        alert(`Geen registraties gevonden voor ${clientName} in de geselecteerde maand.`);
        return;
    }

    // Berekening
    const rate = 100.00;
    const totalAmount = days * rate;

    // Helper voor maandnaam
    const displayMonth = getDisplayMonth(monthStr);

    // 2. Factuurnummer Ophalen (met dynamische omschrijving)
    const omschrijving = `Muziekdagbesteding Casper Slabbers ${displayMonth} ${yearStr}`;
    const invoiceNumber = await fetchInvoiceNumber('Thomashuis Lisse', totalAmount, omschrijving);

    // Datums verzamelen en formatteren
    // We splitsen op '-' om tijdzone-issues te voorkomen (YYYY-MM-DD)
    const uniqueDays = [...new Set(clientData.map(d => parseInt(d.datum.split('-')[2], 10)))].sort((a, b) => a - b);
    // Formatteer naar "4, 11, 18 en 25"
    const daysString = uniqueDays.join(', ').replace(/, ([^,]*)$/, ' en $1');
    const presenceText = `Aanwezig op: ${daysString} ${displayMonth}`;

    // 3. PDF Definitie
    const docDefinition = {
        content: [
            { text: "VOF Wimpie & de Domino's", style: 'header' },
            { text: "Aletta Jacobsstraat 59\n1349 HB Almere\nBtw nr: NL867767819B01\nKvK: 96802863\nTel: 06-28143815", margin: [0, 0, 0, 20] },
            
            { text: "Aan:", style: 'subheader' },
            { text: "Thomashuis Lisse\nt.a.v. Rob Barnhoorn\nHeereweg 453\n2161 DC Lisse", margin: [0, 0, 0, 20] },

            { text: `Factuur nr: ${invoiceNumber}`, bold: true },
            { text: `Datum: ${new Date().toLocaleDateString('nl-NL')}` },
            { text: `Betreft: Muziekdagbesteding Casper Slabbers ${displayMonth} ${yearStr}`, margin: [0, 0, 0, 20] },

            {
                table: {
                    headerRows: 1,
                    widths: ['*', 'auto', 'auto', 'auto'],
                    body: [
                        [
                            { text: 'Omschrijving', style: 'tableHeader' },
                            { text: 'Aantal dagen', style: 'tableHeader' },
                            { text: 'Tarief', style: 'tableHeader' },
                            { text: 'Totaal', style: 'tableHeader' }
                        ],
                        [
                            `Muziekdagbesteding Casper Slabbers ${displayMonth} ${yearStr}`,
                            days.toString(),
                            `€ ${rate.toFixed(2).replace('.', ',')}`,
                            `€ ${totalAmount.toFixed(2).replace('.', ',')}`
                        ],
                        // Extra rij met specificatie van datums
                        [
                            { text: presenceText, colSpan: 4, italics: true, fontSize: 10, color: '#555555', margin: [0, 0, 0, 5] },
                            {}, {}, {}
                        ],
                        // Totaal rij
                        [
                            { text: 'Totaal', style: 'tableHeader', colSpan: 3, alignment: 'right' },
                            {},
                            {},
                            { text: `€ ${totalAmount.toFixed(2).replace('.', ',')}`, style: 'tableHeader' }
                        ]
                    ]
                },
                layout: 'lightHorizontalLines',
                margin: [0, 0, 0, 40]
            }
        ],
        footer: {
            text: "Betalingswijze: per bank IBAN NL81 BUNQ 2154 5934 53 tnv VOF Wimpie & de Domino's te Almere, ovv factuurnummer.\nBetalingstermijn: binnen 14 dagen.\nZorgvrijstelling: deze prestatie is vrijgesteld van BTW (artikel 11, lid 1, onderdeel g, Wet OB).",
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
    pdfMake.createPdf(docDefinition).download(`Factuur_${invoiceNumber}_Thomashuis_${monthStr}_${yearStr}.pdf`);
}