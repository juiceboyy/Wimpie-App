export function generateAndDownloadCsv(data, organization, month) {
    if (organization.toLowerCase() === 'cordaan') {
        return generateCordaanExcel(data, month);
    }

    const orgData = data.filter(d => String(d.organisatie).toLowerCase() === organization.toLowerCase());

    if (orgData.length === 0) {
        throw new Error(`Geen uren gevonden voor ${organization} in deze maand.`);
    }

    let csvContent = "";

    if (organization === 'cordaan') {
        // Fallback of oude logica verwijderd, wordt nu afgevangen door generateCordaanExcel
    } else if (organization === 'amsta') {
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

export function generateCordaanExcel(data, yearMonth) {
    // 1. Filteren op Cordaan
    const cordaanData = data.filter(d => d.organisatie && d.organisatie.toLowerCase().includes('cordaan'));

    if (cordaanData.length === 0) {
        throw new Error(`Geen data gevonden voor Cordaan in ${yearMonth}`);
    }

    // 2. Data Transformatie
    const mappedData = cordaanData.map(row => {
        // Datum conversie YYYY-MM-DD -> D/M/YYYY
        const [y, m, d] = row.datum.split('-');
        const formattedDate = `${parseInt(d)}/${parseInt(m)}/${y}`;

        // Tarief opschonen (€ weghalen, komma naar punt)
        let tarief = 0;
        if (row.tarief) {
            const cleanTarief = String(row.tarief).replace('€', '').replace(',', '.').trim();
            tarief = parseFloat(cleanTarief) || 0;
        }

        const dagdelen = parseFloat(row.dagdelen) || 0;
        const minuten = dagdelen * 240;
        const bedrag = dagdelen * tarief;

        return {
            "Naam": row.naam,
            "BSN": row.bsn,
            "Medewerkernummer": "",
            "Activiteit": row.activiteit,
            "Begindatum": formattedDate,
            "Minuten": minuten,
            "Dagdelen": dagdelen,
            "VG": "",
            "Tarief": tarief,
            "Bedrag": bedrag
        };
    });

    // 3. Bestandsnaam genereren
    const [yearStr, monthStr] = yearMonth.split('-');
    const year = parseInt(yearStr);
    const monthIndex = parseInt(monthStr) - 1;
    const lastDay = new Date(year, monthIndex + 1, 0).getDate(); // Laatste dag van de maand
    const monthNames = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
    
    const filename = `${yearStr.slice(2)}${monthStr}${lastDay} - Controlebestand Wimpie&Domino's - ${monthNames[monthIndex]} '${yearStr.slice(2)}.xlsx`;

    // 4. Excel Generatie
    const ws = XLSX.utils.json_to_sheet(mappedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Blad1");
    XLSX.writeFile(wb, filename);
}