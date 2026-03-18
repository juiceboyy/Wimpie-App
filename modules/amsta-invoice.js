import { fetchInvoiceNumber } from './api.js';
import { getDisplayMonth, createInvoiceDocDefinition } from './utils.js';

export async function generateAmstaInvoicePDF(data, monthStr, yearStr) {
    // 1. Filter uitsluitend op AMSTA cliënten
    const amstaData = data.filter(d => d.organisatie && d.organisatie.toLowerCase() === 'amsta');

    if (amstaData.length === 0) {
        alert(`Geen registraties gevonden voor AMSTA in de geselecteerde maand.`);
        return;
    }

    // 2. Groepeer per deelnemer
    const participants = {};
    amstaData.forEach(row => {
        if (!participants[row.naam]) {
            const cleanTarief = String(row.tarief || '').replace(/[^0-9,.-]/g, '').replace(',', '.');
            participants[row.naam] = {
                naam: row.naam,
                dagen: 0,
                datums: new Set(),
                tarief: parseFloat(cleanTarief) || 0
            };
        }
        participants[row.naam].dagen += 1;
        
        // Datum verzamelen (dag ophalen uit YYYY-MM-DD)
        const day = parseInt(row.datum.split('-')[2], 10);
        participants[row.naam].datums.add(day);
    });

    const displayMonth = getDisplayMonth(monthStr);

    // 3. Tabel Body opbouwen
    const tableBody = [
        [
            { text: 'Omschrijving', style: 'tableHeader' },
            { text: 'Aantal dagen', style: 'tableHeader' },
            { text: 'Tarief', style: 'tableHeader' },
            { text: 'Totaal', style: 'tableHeader' }
        ]
    ];

    let grandTotal = 0;
    const sortedNames = Object.keys(participants).sort();

    sortedNames.forEach(name => {
        const p = participants[name];
        const totalAmount = p.dagen * p.tarief;
        grandTotal += totalAmount;

        // Formatteer naar "4, 11, 18 en 25"
        const uniqueDays = [...p.datums].sort((a, b) => a - b);
        const daysString = uniqueDays.join(', ').replace(/, ([^,]*)$/, ' en $1');
        const presenceText = `Aanwezige data: ${daysString} ${displayMonth}`;

        tableBody.push([
            `Zorgverlening AMSTA - ${p.naam} in ${displayMonth} ${yearStr}`,
            p.dagen.toString(),
            `€ ${p.tarief.toFixed(2).replace('.', ',')}`,
            `€ ${totalAmount.toFixed(2).replace('.', ',')}`
        ]);
        
        // Toelichting rij
        tableBody.push([
            { text: presenceText, colSpan: 4, italics: true, fontSize: 10, color: '#555555', margin: [0, 0, 0, 5] },
            {}, {}, {}
        ]);
    });

    // Totaal rij toevoegen
    tableBody.push([
        { text: 'Totaal', style: 'tableHeader', colSpan: 3, alignment: 'right' },
        {}, {},
        { text: `€ ${grandTotal.toFixed(2).replace('.', ',')}`, style: 'tableHeader' }
    ]);

    // 4. Factuurnummer ophalen en wegschrijven in Inkoop/Verkoop
    const omschrijving = `Factuur AMSTA ${displayMonth} ${yearStr}`;
    const invoiceNumber = await fetchInvoiceNumber('AMSTA', grandTotal, omschrijving);

    // 5. PDF genereren met centrale styling
    const docDefinition = createInvoiceDocDefinition({
        invoiceNumber: invoiceNumber,
        recipientText: "Stichting Amsta\nT.a.v. afd. Crediteuren\nJan Bongastraat 5\n1067 HZ Amsterdam",
        betreftText: omschrijving,
        tableBody: tableBody,
        footerText: "Betalingswijze: per bank IBAN NL81 BUNQ 2154 5934 53 tnv VOF Wimpie & de Domino's te Almere, ovv factuurnummer.\nBetalingstermijn: binnen 30 dagen.\nZorgvrijstelling: deze prestatie is vrijgesteld van BTW (artikel 11, lid 1, onderdeel g, Wet OB)."
    });

    pdfMake.createPdf(docDefinition).download(`Factuur_${invoiceNumber}_AMSTA_${monthStr}_${yearStr}.pdf`);
}