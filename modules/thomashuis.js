import { fetchInvoiceNumber } from './api.js';
import { getDisplayMonth } from './utils.js';

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
    const omschrijving = `Muziekdagbesteding Casper ${displayMonth}`;
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
            { text: `Betreft: Muziekdagbesteding Casper ${displayMonth}`, margin: [0, 0, 0, 20] },

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
                            `Muziekdagbesteding Casper ${displayMonth}`,
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