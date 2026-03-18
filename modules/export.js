import { generateAmstaExcel } from './amsta.js';
import { generateAmstaInvoicePDF } from './amsta-invoice.js';
import { generateCordaanExcel } from './cordaan.js';
import { generateThomashuisInvoicePDF } from './thomashuis.js';

export async function handleExportAction(data, organization, month) {
    if (organization.toLowerCase() === 'cordaan') {
        return generateCordaanExcel(data, month);
    }

    if (organization.toLowerCase().includes('thomashuis')) {
        const [yearStr, monthStr] = month.split('-');
        return await generateThomashuisInvoicePDF(data, monthStr, yearStr);
    }

    if (organization.toLowerCase() === 'amsta') {
        const filename = `Urenverantwoording_${organization}_${month}.xlsx`;
        return generateAmstaExcel(data, month, filename);
    }

    if (organization.toLowerCase() === 'amsta-factuur') {
        const [yearStr, monthStr] = month.split('-');
        return await generateAmstaInvoicePDF(data, monthStr, yearStr);
    }

    throw new Error(`Onbekende organisatie of export-actie: ${organization}`);
}