import { fetchInvoiceNumber } from './api.js';
import { getDisplayMonth, createInvoiceDocDefinition } from './utils.js';

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

    // 3. Tabel Body & PDF Definitie
    const tableBody = [
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
        [
            { text: presenceText, colSpan: 4, italics: true, fontSize: 10, color: '#555555', margin: [0, 0, 0, 5] },
            {}, {}, {}
        ],
        [
            { text: 'Totaal', style: 'tableHeader', colSpan: 3, alignment: 'right' },
            {},
            {},
            { text: `€ ${totalAmount.toFixed(2).replace('.', ',')}`, style: 'tableHeader' }
        ]
    ];

    const docDefinition = createInvoiceDocDefinition({
        invoiceNumber: invoiceNumber,
        recipientText: "Thomashuis Lisse\nt.a.v. Rob Barnhoorn\nHeereweg 453\n2161 DC Lisse",
        betreftText: `Muziekdagbesteding Casper ${displayMonth}`,
        tableBody: tableBody,
        footerText: "Betalingswijze: per bank IBAN NL81 BUNQ 2154 5934 53 tnv VOF Wimpie & de Domino's te Almere, ovv factuurnummer.\nBetalingstermijn: binnen 14 dagen.\nZorgvrijstelling: deze prestatie is vrijgesteld van BTW (artikel 11, lid 1, onderdeel g, Wet OB)."
    });

    // 4. Genereren
    pdfMake.createPdf(docDefinition).download(`Factuur_${invoiceNumber}_Thomashuis_${monthStr}_${yearStr}.pdf`);
}