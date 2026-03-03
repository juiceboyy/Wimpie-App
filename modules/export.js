export function generateAndDownloadCsv(data, organization, month) {
    const orgData = data.filter(d => String(d.organisatie).toLowerCase() === organization.toLowerCase());

    if (orgData.length === 0) {
        throw new Error(`Geen uren gevonden voor ${organization} in deze maand.`);
    }

    let csvContent = "";

    if (organization === 'cordaan') {
        // Cordaan Format: BSN;Activiteit;Datum;Minuten
        csvContent += "BSN;Activiteit;Datum;Minuten\r\n";
        orgData.forEach(row => {
            const d = row.datum.split('-');
            const nlDatum = `${d[2]}-${d[1]}-${d[0]}`;
            const minuten = parseInt(row.dagdelen) * 240; // 1 dagdeel = 4 uur
            csvContent += `${row.bsn};${row.activiteit};${nlDatum};${minuten}\r\n`;
        });
    } 
    else if (organization === 'amsta') {
        // Amsta Format: Volledige naam;Product;Datum;Tijd van;Tijd tot
        csvContent += "Volledige naam;Product;Datum;Tijd van;Tijd tot\r\n";
        orgData.forEach(row => {
            const d = row.datum.split('-');
            const nlDatum = `${d[2]}-${d[1]}-${d[0]}`;
            const tijdVan = "09:00";
            const tijdTot = parseInt(row.dagdelen) === 2 ? "17:00" : "13:00";
            csvContent += `${row.naam};${row.activiteit};${nlDatum};${tijdVan};${tijdTot}\r\n`;
        });
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