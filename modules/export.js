import { generateAmstaExcel } from './amsta.js';
import { generateCordaanExcel } from './cordaan.js';

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