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
 * Haalt de communicatiestatus rondom een optreden op voor alle actieve deelnemers op een specifieke datum,
 * inclusief de opgeslagen titel van het optreden.
 */
async function getPerformances(datum) {
  if (!datum) throw new Error('Geen datum opgegeven.');

  // Parallel actieve deelnemers en bestaande optredens ophalen
  const [participants, rows] = await Promise.all([
    getParticipants(),
    getSheetData('Optredens!A:H')
  ]);

  // Filter de rijen voor de specifieke datum
  // Kolommen: 
  // 0: Datum, 1: Titel, 2: Deelnemer, 3: Datum Vrijhouden Benaderd, 4: Datum Vrijhouden Status, 
  // 5: Vervoer Benaderd, 6: Vervoer Status, 7: Opmerkingen
  const performanceMap = {};
  let savedTitle = '';

  rows.slice(1).forEach(row => {
    if (row[0] && row[2]) {
      const rowDate = parseDateToISO(row[0]);
      if (rowDate === datum) {
        // Leg de titel vast (eerste niet-lege titel die we tegenkomen voor deze datum)
        if (row[1] && !savedTitle) {
          savedTitle = row[1];
        }

        performanceMap[row[2]] = {
          vrijhoudenBenaderd: row[3] || 'Nee',
          vrijhoudenStatus: row[4] || 'Open',
          vervoerBenaderd: row[5] || 'Nee',
          vervoerStatus: row[6] || 'Open',
          opmerkingen: row[7] || ''
        };
      }
    }
  });

  // Combineer actieve deelnemers met hun opgeslagen status of de standaardwaarden
  const entries = participants.map(p => {
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

  return {
    titel: savedTitle,
    entries: entries
  };
}

/**
 * Slaat de communicatiestatus en de titel voor een optreden op.
 * Maakt gebruik van de veilige overschrijfmethode (lezen, filteren, samenvoegen, wissen, schrijven) 
 * om dubbele regels en opmaakconflicten in Google Sheets te voorkomen.
 */
async function savePerformances(payload) {
  const { datum, titel, entries } = payload;
  if (!datum) throw new Error('Geen datum opgegeven voor opslaan.');
  if (!entries || !Array.isArray(entries)) throw new Error('Geen geldige records aangeleverd.');

  const range = 'Optredens!A:H';
  const rows = await getSheetData(range);

  // Behoud de header en alle rijen die NIET voor deze datum zijn
  const header = rows[0] || ['Datum', 'Titel', 'Deelnemer', 'Datum Vrijhouden Benaderd', 'Datum Vrijhouden Status', 'Vervoer Benaderd', 'Vervoer Status', 'Opmerkingen'];
  const otherRows = rows.slice(1).filter(row => {
    if (!row[0]) return false;
    return parseDateToISO(row[0]) !== datum;
  });

  // Map de nieuwe entries naar het juiste 8-koloms sheet-rij-formaat
  const newRows = entries.map(e => [
    datum,
    titel || '',
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

/**
 * Haalt een overzicht op van alle unieke geregistreerde optredens (datum + titel).
 * Gesorteerd op datum (meest recente eerst).
 */
async function getPerformancesHistory() {
  const rows = await getSheetData('Optredens!A:B');
  if (rows.length <= 1) return [];

  const uniqueEventsMap = {};

  rows.slice(1).forEach(row => {
    const datum = row[0];
    const titel = row[1] || '';
    if (datum) {
      const standardDate = parseDateToISO(datum);
      // Sla op als we de datum nog niet hebben, of als we een titel vinden voor een datum die we al hadden zonder titel
      if (!uniqueEventsMap[standardDate] || (titel && !uniqueEventsMap[standardDate].titel)) {
        uniqueEventsMap[standardDate] = {
          datum: standardDate,
          titel: titel
        };
      }
    }
  });

  // Converteren naar lijst en sorteren op datum (descending)
  return Object.values(uniqueEventsMap).sort((a, b) => new Date(b.datum) - new Date(a.datum));
}

module.exports = {
  getPerformances,
  savePerformances,
  getPerformancesHistory
};
