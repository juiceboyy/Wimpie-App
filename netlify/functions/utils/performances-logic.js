const { getSheetData, updateSheetData, clearSheetData } = require('./google');
const { getParticipants } = require('./sheet-logic');

/**
 * Converteert een datumtekenreeks van de Google Sheet (bijvoorbeeld DD-MM-YYYY, DD/MM/YYYY of YYYY-MM-DD)
 * naar het gestandaardiseerde YYYY-MM-DD ISO-formaat voor betrouwbare vergelijkingen.
 */
function parseDateToISO(dateStr) {
  if (!dateStr) return null;
  const trimmed = String(dateStr).trim();
  
  // Als het al YYYY-MM-DD is
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Splits op streepjes of slashes
  const parts = trimmed.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD / YYYY/MM/DD
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${y}-${m}-${d}`;
    } else {
      // DD-MM-YYYY / D-M-YYYY / DD/MM/YYYY
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      if (y.length === 4) {
        return `${y}-${m}-${d}`;
      }
    }
  }
  return trimmed;
}

/**
 * Haalt de communicatiestatus rondom een optreden op voor alle actieve deelnemers op een specifieke datum.
 * Voegt automatisch standaardwaarden toe voor deelnemers die nog geen status hebben opgeslagen.
 */
async function getPerformances(datum) {
  if (!datum) throw new Error('Geen datum opgegeven.');

  // Parallel actieve deelnemers en bestaande optredens ophalen
  const [participants, rows] = await Promise.all([
    getParticipants(),
    getSheetData('Optredens!A:G')
  ]);

  // Filter de rijen voor de specifieke datum
  // Kolommen: 0: Datum, 1: Deelnemer, 2: Datum Vrijhouden Benaderd, 3: Datum Vrijhouden Status, 4: Vervoer Benaderd, 5: Vervoer Status, 6: Opmerkingen
  const performanceMap = {};
  rows.slice(1).forEach(row => {
    if (row[0] && row[1]) {
      const rowDate = parseDateToISO(row[0]);
      if (rowDate === datum) {
        performanceMap[row[1]] = {
          vrijhoudenBenaderd: row[2] || 'Nee',
          vrijhoudenStatus: row[3] || 'Open',
          vervoerBenaderd: row[4] || 'Nee',
          vervoerStatus: row[5] || 'Open',
          opmerkingen: row[6] || ''
        };
      }
    }
  });

  // Combineer actieve deelnemers met hun opgeslagen status of de standaardwaarden
  return participants.map(p => {
    const saved = performanceMap[p.naam] || {
      vrijhoudenBenaderd: 'Nee',
      vrijhoudenStatus: 'Open',
      vervoerBenaderd: 'Nee',
      vervoerStatus: 'Open',
      opmerkingen: ''
    };

    return {
      naam: p.naam,
      organisatie: p.organisatie,
      vrijhoudenBenaderd: saved.vrijhoudenBenaderd,
      vrijhoudenStatus: saved.vrijhoudenStatus,
      vervoerBenaderd: saved.vervoerBenaderd,
      vervoerStatus: saved.vervoerStatus,
      opmerkingen: saved.opmerkingen
    };
  });
}

/**
 * Slaat de communicatiestatus voor een optreden op.
 * Maakt gebruik van de veilige overschrijfmethode (lezen, filteren, samenvoegen, wissen, schrijven) 
 * om dubbele regels en opmaakconflicten in Google Sheets te voorkomen.
 */
async function savePerformances(payload) {
  const { datum, entries } = payload;
  if (!datum) throw new Error('Geen datum opgegeven voor opslaan.');
  if (!entries || !Array.isArray(entries)) throw new Error('Geen geldige records aangeleverd.');

  const range = 'Optredens!A:G';
  const rows = await getSheetData(range);

  // Behoud de header en alle rijen die NIET voor deze datum zijn
  const header = rows[0] || ['Datum', 'Deelnemer', 'Datum Vrijhouden Benaderd', 'Datum Vrijhouden Status', 'Vervoer Benaderd', 'Vervoer Status', 'Opmerkingen'];
  const otherRows = rows.slice(1).filter(row => {
    if (!row[0]) return false;
    return parseDateToISO(row[0]) !== datum;
  });

  // Map de nieuwe entries naar het juiste sheet-rij-formaat
  const newRows = entries.map(e => [
    datum,
    e.naam,
    e.vrijhoudenBenaderd || 'Nee',
    e.vrijhoudenStatus || 'Open',
    e.vervoerBenaderd || 'Nee',
    e.vervoerStatus || 'Open',
    e.opmerkingen || ''
  ]);

  // Voeg alles samen en schrijf het terug
  const finalRows = [header, ...otherRows, ...newRows];

  await clearSheetData(range);
  await updateSheetData(range, finalRows);

  return { message: 'Optredens communicatie succesvol bijgewerkt.' };
}

module.exports = {
  getPerformances,
  savePerformances
};
