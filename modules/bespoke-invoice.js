import { fetchInvoiceNumber } from './api.js';
import { createInvoiceDocDefinition } from './utils.js';

/**
 * Genereert een maatwerk (bespoke) factuur PDF.
 * 
 * @param {string} adres Het volledige factuuradres (meerdere regels)
 * @param {number} bedrag Het factuurbedrag in euro's
 * @param {string} omschrijving De volledige omschrijving van de factuur (meerdere regels)
 */
export async function generateBespokeInvoicePDF(adres, bedrag, omschrijving) {
    if (!adres || !adres.trim()) {
        throw new Error("Factuuradres is verplicht.");
    }
    if (!omschrijving || !omschrijving.trim()) {
        throw new Error("Omschrijving is verplicht.");
    }
    
    const totalAmount = parseFloat(bedrag);
    if (isNaN(totalAmount) || totalAmount <= 0) {
        throw new Error("Voer een geldig factuurbedrag in groter dan 0.");
    }

    // 1. Extraheer de eerste regel van het adres als Klantnaam (organisatie) voor de Google Sheet
    const adresRegels = adres.split('\n').map(r => r.trim()).filter(Boolean);
    const organisatie = adresRegels[0] || "Maatwerk Klant";

    // 2. Extraheer de eerste regel van de omschrijving als korte log-omschrijving voor de Google Sheet
    const omschrijvingRegels = omschrijving.split('\n').map(r => r.trim()).filter(Boolean);
    const sheetOmschrijving = omschrijvingRegels[0] || "Optreden / Maatwerk";

    // 3. Factuurnummer ophalen (en loggen in de Google Sheet via de backend)
    const invoiceNumber = await fetchInvoiceNumber(organisatie, totalAmount, sheetOmschrijving);

    // 4. Tabel Body opbouwen voor een 2-koloms lay-out
    const tableBody = [
        [
            { text: 'Omschrijving', style: 'tableHeader' },
            { text: 'Bedrag', style: 'tableHeader' }
        ],
        [
            { text: omschrijving, margin: [0, 5, 0, 5] },
            { text: `€ ${totalAmount.toFixed(2).replace('.', ',')}`, margin: [0, 5, 0, 5] }
        ],
        [
            { text: 'Totaal', style: 'tableHeader', alignment: 'right' },
            { text: `€ ${totalAmount.toFixed(2).replace('.', ',')}`, style: 'tableHeader' }
        ]
    ];

    const footerText = "Betalingswijze: per bank IBAN NL81 BUNQ 2154 5934 53 tnv VOF Wimpie & de Domino's te Almere, ovv factuurnummer.\nBetalingstermijn: binnen 14 dagen.\nZorgvrijstelling: deze prestatie is vrijgesteld van BTW (artikel 11, lid 1, onderdeel g, Wet OB).";

    // 5. PDF definitie maken met de 2-koloms instellingen
    const docDefinition = createInvoiceDocDefinition({
        invoiceNumber: invoiceNumber,
        recipientText: adres,
        betreftText: "", // Geen betreft-regel zoals afgesproken
        tableBody: tableBody,
        footerText: footerText,
        widths: ['*', 'auto']
    });

    // Sleutel voor bestandsnaam opschonen van vreemde tekens
    const veiligeKlantnaam = organisatie.replace(/[^a-zA-Z0-9]/g, '_');

    // 6. Genereren en downloaden
    pdfMake.createPdf(docDefinition).download(`Factuur_${invoiceNumber}_${veiligeKlantnaam}.pdf`);
}
