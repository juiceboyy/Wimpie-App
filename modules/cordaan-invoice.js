import { fetchInvoiceNumber } from './api.js';
import { getDisplayMonth } from './utils.js';

export async function generateCordaanInvoicePDF(data, monthStr, yearStr) {
    // 1. Filter & Aggregate
    const cordaanData = data.filter(d => d.organisatie && d.organisatie.toLowerCase().includes('cordaan'));
    const TRANSPORT_TARIEF = 21.46;
    
    const participants = {};
    cordaanData.forEach(row => {
        if (!participants[row.naam]) {
            // Tarief opschonen
            const cleanTarief = String(row.tarief || '').replace(/[^0-9,.-]/g, '').replace(',', '.');
            participants[row.naam] = {
                naam: row.naam,
                dagdelen: 0,
                dagen: 0,
                tarief: parseFloat(cleanTarief) || 0
            };
        }
        participants[row.naam].dagdelen += parseFloat(row.dagdelen) || 0;
        // Elke rij in de data is 1 dag aanwezigheid (ongeacht aantal dagdelen)
        participants[row.naam].dagen += 1;
    });

    const tableBody = [
        [
            { text: 'Naam Deelnemer', style: 'tableHeader' },
            { text: 'Aantal dagdelen', style: 'tableHeader' },
            { text: 'Tarief', style: 'tableHeader' },
            { text: 'Totaal (BTW 0%)', style: 'tableHeader' }
        ]
    ];

    let subTotalCare = 0;
    let subTotalTransport = 0;
    const sortedNames = Object.keys(participants).sort();

    // --- BLOK 1: Zorg ---
    sortedNames.forEach(name => {
        const p = participants[name];
        const total = p.dagdelen * p.tarief;

        if (total > 0) {
            subTotalCare += total;

            tableBody.push([
                p.naam,
                p.dagdelen.toString(),
                `€ ${p.tarief.toFixed(2).replace('.', ',')}`,
                `€ ${total.toFixed(2).replace('.', ',')}`
            ]);
        }
    });

    // Subtotaal Zorg
    tableBody.push([
        { text: 'Subtotaal Urendeclaratie', style: 'tableHeader', colSpan: 3, alignment: 'right', italics: true },
        {},
        {},
        { text: `€ ${subTotalCare.toFixed(2).replace('.', ',')}`, style: 'tableHeader', italics: true }
    ]);

    // --- BLOK 2: Vervoer ---
    // Lege rij voor scheiding
    tableBody.push([{ text: '', colSpan: 4, border: [false, false, false, false], margin: [0, 5, 0, 5] }, {}, {}, {}]);
    
    // Header voor vervoer (optioneel, maar duidelijk)
    tableBody.push([
        { text: 'Vervoerskosten', style: 'tableHeader', colSpan: 4, fillColor: '#f2f2f2' }, {}, {}, {}
    ]);

    sortedNames.forEach(name => {
        const p = participants[name];
        const totalTransport = p.dagen * TRANSPORT_TARIEF;

        if (totalTransport > 0) {
            subTotalTransport += totalTransport;

            tableBody.push([
                `Bijdrage vervoerskosten ${p.naam}`,
                `${p.dagen} dagen`,
                `€ ${TRANSPORT_TARIEF.toFixed(2).replace('.', ',')}`,
                `€ ${totalTransport.toFixed(2).replace('.', ',')}`
            ]);
        }
    });

    // Subtotaal Vervoer
    tableBody.push([
        { text: 'Subtotaal Vervoerskosten', style: 'tableHeader', colSpan: 3, alignment: 'right', italics: true },
        {},
        {},
        { text: `€ ${subTotalTransport.toFixed(2).replace('.', ',')}`, style: 'tableHeader', italics: true }
    ]);

    // --- BLOK 3: Eindtotaal ---
    const grandTotal = subTotalCare + subTotalTransport;

    tableBody.push([
        { text: 'Totaal te voldoen', style: 'tableHeader', colSpan: 3, alignment: 'right', fontSize: 11 },
        {},
        {},
        { text: `€ ${grandTotal.toFixed(2).replace('.', ',')}`, style: 'tableHeader', fontSize: 11 }
    ]);

    // 2. Factuurnummer Ophalen
    const displayMonth = getDisplayMonth(monthStr);
    const omschrijving = `Urendeclaratie en vervoer Cordaan ${displayMonth} ${yearStr}`;
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
            { text: `Betreft: ${omschrijving} - medewerkernummer 9125107`, margin: [0, 0, 0, 20] },

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