const { verstuurVerslagEmail } = require('./utils/mailer');
const { getSheetData, updateSheetData, appendSheetData, clearSheetData } = require('./utils/google');

exports.handler = async function(event, context) {
  // CORS headers instellen voor alle responses
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // Preflight request (OPTIONS) afhandelen
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    // --- GET REQUEST ---
    if (event.httpMethod === 'GET') {
      const { type, maand, datum, naam } = event.queryStringParameters || {};

      // 1. AANWEZIGHEID OPHALEN
      if (datum && !type) {
        const rows = await getSheetData('Registraties!A:D');
        const attendance = rows.slice(1)
          .filter(row => row[0] && row[0].startsWith(datum))
          .map(row => ({
            naam: row[1],
            dagdelen: row[2],
            aanwezig: row[3]
          }));

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(attendance),
        };
      }

      // 2. BESTAAND VERSLAG OPHALEN
      if (type === 'verslag') {
        const rows = await getSheetData('Verslagen!A:C');
        const foundRow = rows.find(row => row[0] === datum && row[1] === naam);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ tekst: foundRow ? foundRow[2] : "" }),
        };
      }

      // 3. VERSLAG HISTORIE OPHALEN
      if (type === 'verslag_historie') {
        const rows = await getSheetData('Verslagen!A:C');
        const history = rows.slice(1)
          .filter(row => row[1] === naam)
          .map(row => row[0])
          .sort((a, b) => new Date(b) - new Date(a));

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(history),
        };
      }

      // EXPORT LOGICA
      if (type === 'export') {
        if (!maand) throw new Error('Geen maand opgegeven voor export.');

        // Data ophalen uit sheets
        const [registraties, deelnemers, legenda] = await Promise.all([
          getSheetData('Registraties!A:D'),
          getSheetData('Deelnemers!A:F'),
          getSheetData('Legenda!A:B'),
        ]);

        // Legenda map opbouwen (Code -> Omschrijving)
        const legendaMap = {};
        (legenda || []).slice(1).forEach(row => {
          if (row[0]) legendaMap[row[0]] = row[1];
        });

        // Mapping maken van deelnemers (Naam -> Info)
        // Aanname kolommen Deelnemers: A=Naam, B=Organisatie, C=BSN, D=Code, E=Tarief
        const deelnemerMap = {};
        deelnemers.slice(1).forEach(row => {
          if (row[0]) {
            deelnemerMap[row[0]] = {
              organisatie: row[1] || '',
              bsn: row[2] || '',
              code: row[3] || '',
              tarief: row[4] || '',
            };
          }
        });

        // Registraties filteren en verrijken
        // Prompt vereiste: Datum=Kolom A (index 0), Aanwezig=Kolom D (index 3)
        // Impliciet: Naam=Kolom B (index 1), Dagdelen=Kolom C (index 2)
        const exportData = registraties.slice(1)
          .filter(row => {
            const datum = row[0];
            const aanwezig = row[3];
            return aanwezig === 'Ja' && datum && datum.startsWith(maand);
          })
          .map(row => {
            const naam = row[1];
            const info = deelnemerMap[naam] || {};
            const code = info.code || '';
            const omschrijving = legendaMap[code] || code;

            return {
              datum: row[0],
              naam: naam,
              dagdelen: row[2],
              organisatie: info.organisatie || '',
              bsn: info.bsn || '',
              code: code,
              tarief: info.tarief || '',
              activiteit_omschrijving: omschrijving,
            };
          });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(exportData),
        };
      }

      // STANDAARD GET (Deelnemers ophalen)
      const rows = await getSheetData('Deelnemers!A:F');
      const participants = rows.slice(1)
        .filter(row => row[5] === 'Ja')
        .map(row => ({
          naam: row[0],
          organisatie: row[1],
          bsn: row[2],
          code: row[3],
          tarief: row[4]
        }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(participants),
      };
    }

    // --- POST REQUEST ---
    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body);

      // SCENARIO A: Registratie
      if (payload.type === 'registratie') {
        const range = 'Registraties!A:D';
        
        // 1. Bestaande data ophalen
        const rows = await getSheetData(range);
        
        // Datum uit payload halen
        const targetDate = payload.entries[0]?.datum;
        if (!targetDate) throw new Error("Geen datum gevonden in payload");

        // 2. Filter oude registraties van deze datum eruit (Datum staat in kolom A, index 0)
        const filteredRows = rows.filter(row => row[0] !== targetDate);

        // 3. Nieuwe entries toevoegen
        const newRows = payload.entries
          .filter(e => e.naam !== 'DELETE_SIGNAL')
          .map(e => [e.datum, e.naam, e.dagdelen, e.aanwezig]);

        const finalRows = [...filteredRows, ...newRows];

        // 4. Deduplicatie: Filter dubbele entries (Datum + Naam)
        const uniqueRows = [];
        const seen = new Set();

        // Loop van achteren naar voren om de laatste (meest recente) versie te behouden
        for (let i = finalRows.length - 1; i >= 0; i--) {
          const row = finalRows[i];
          const key = `${row[0]}_${row[1]}`;

          if (!seen.has(key)) {
            seen.add(key);
            uniqueRows.unshift(row);
          }
        }

        // 5. Sheet leegmaken en updaten
        await clearSheetData(range);
        await updateSheetData(range, uniqueRows);

        return { statusCode: 200, headers, body: JSON.stringify({ message: "Opgeslagen" }) };
      }

      // SCENARIO B: Verslag
      if (payload.type === 'verslag') {
        const verslagenRange = 'Verslagen!A:C'; // A=Datum, B=Naam, C=Verslag
        const verslagenRows = await getSheetData(verslagenRange);

        // Zoek bestaand verslag (Datum op index 0, Naam op index 1)
        const rowIndex = verslagenRows.findIndex(row => row[0] === payload.datum && row[1] === payload.naam);

        if (rowIndex !== -1) {
          // Update bestaande cel (Verslagen!C...)
          await updateSheetData(`Verslagen!C${rowIndex + 1}`, [[payload.tekst]]);
        } else {
          // Nieuwe rij toevoegen
          await appendSheetData(verslagenRange, [[payload.datum, payload.naam, payload.tekst]]);
        }

        // Email logica
        let mailStatus = '';
        try {
          const deelnemersRows = await getSheetData('Deelnemers!A:G');
          const deelnemer = deelnemersRows.find(row => row[0] === payload.naam);
          
          // Check kolom G (index 6) voor email
          if (deelnemer && deelnemer[6] && deelnemer[6].includes('@')) {
            mailStatus = await verstuurVerslagEmail(payload.naam, payload.datum, payload.tekst, deelnemer[6]);
          }
        } catch (mailError) {
          console.error('Mail error:', mailError);
          mailStatus = 'Mail mislukt.';
        }

        return { statusCode: 200, headers, body: JSON.stringify({ message: `Verslag opgeslagen. ${mailStatus}` }) };
      }
    }

  } catch (error) {
    console.error('Fout bij ophalen data:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Er is een fout opgetreden bij het ophalen van de data.' }),
    };
  }
};