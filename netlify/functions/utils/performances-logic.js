const { getSheetData, updateSheetData, clearSheetData } = require('./google');
const { getParticipants } = require('./sheet-logic');

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
    if (row[0] === datum && row[1]) {
      performanceMap[row[1]] = {
        vrijhoudenBenaderd: row[2] || 'Nee',
        vrijhoudenStatus: row[3] || 'Open',
        vervoerBenaderd: row[4] || 'Nee',
        vervoerStatus: row[5] || 'Open',
        opmerkingen: row[6] || ''
      };
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
  const otherRows = rows.slice(1).filter(row => row[0] !== datum);

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
