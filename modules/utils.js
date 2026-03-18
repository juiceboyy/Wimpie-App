// Helper voor maandnamen
const monthNames = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
export function getDisplayMonth(monthStr) {
    const mIndex = parseInt(monthStr, 10) - 1;
    return (mIndex >= 0 && mIndex < 12) ? monthNames[mIndex] : monthStr;
}

export function createInvoiceDocDefinition({ invoiceNumber, recipientText, betreftText, tableBody, footerText }) {
    return {
        content: [
            { text: "VOF Wimpie & de Domino's", style: 'header' },
            { text: "Aletta Jacobsstraat 59\n1349 HB Almere\nBtw nr: NL867767819B01\nKvK: 96802863\nTel: 06-28143815", margin: [0, 0, 0, 20] },
            
            { text: "Aan:", style: 'subheader' },
            { text: recipientText, margin: [0, 0, 0, 20] },

            { text: `Factuur nr: ${invoiceNumber}`, bold: true },
            { text: `Datum: ${new Date().toLocaleDateString('nl-NL')}` },
            { text: `Betreft: ${betreftText}`, margin: [0, 0, 0, 20] },

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
            text: footerText,
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
}