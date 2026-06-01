const { getSheetData } = require('./utils/google');

exports.handler = async function(event, context) {
  const HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS, POST',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: 'Method Not Allowed' };
  }

  try {
    const payload = JSON.parse(event.body);
    const { naam } = payload;

    if (!naam || naam === 'Selecteer...') {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Geen geldige deelnemer geselecteerd.' }) };
    }

    // 1. Haal alle verslagen op uit de Google Sheet
    const rows = await getSheetData('Verslagen!A:C');
    
    // Bepaal de datum van exact 1 jaar geleden
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    // 2. Filter op deelnemer en datum (afgelopen jaar)
    const filteredRows = rows.slice(1).filter(row => {
      if (!row[0] || !row[1] || !row[2]) return false;
      if (row[1] !== naam) return false;
      const rowDate = new Date(row[0]);
      return !isNaN(rowDate) && rowDate >= oneYearAgo && rowDate <= today;
    });

    if (filteredRows.length === 0) {
      return { 
        statusCode: 400, 
        headers: HEADERS, 
        body: JSON.stringify({ error: `Er zijn geen dagrapportages gevonden voor ${naam} in het afgelopen jaar (sinds ${oneYearAgo.toISOString().split('T')[0]}).` }) 
      };
    }

    // Sorteer op datum oplopend voor de AI
    filteredRows.sort((a, b) => new Date(a[0]) - new Date(b[0]));

    // Format dagrapportages tot een compacte string
    const formattedReports = filteredRows.map(row => `[${row[0]}]: ${row[2]}`).join('\n');

    // 3. AI Prompt configureren
    const systemInstruction = `Je bent een ervaren en empathische senior begeleider bij VOF Wimpie & de Domino's (een muzikale dagbesteding voor mensen met een verstandelijke of meervoudige beperking).
Jouw taak is het schrijven van een professioneel, warm en constructief Jaarverslag in het Nederlands voor de deelnemer. Dit verslag zal worden gelezen door alle zorgverleners rondom de deelnemer (zoals persoonlijk begeleiders, therapeuten, artsen en familie).

Richtlijnen:
1. Schrijf uitsluitend in het Nederlands. Gebruik een respectvolle, professionele en mensgerichte toon.
2. Structureer het verslag in exact de volgende 5 hoofdstukken, aangeduid met heldere kopjes:
   - Hoofdstuk 1: Inleiding & Algemeen Beeld
     (Geef een algemeen overzicht van de aanwezigheid, hoe de deelnemer binnenkomt, stemmingen over het jaar heen en de algehele houding.)
   - Hoofdstuk 2: Muzikale Deelname & Activiteiten
     (Beschrijf hoe de deelnemer heeft meegedaan met muziek: bijv. zingen, instrumenten bespelen, reageren op ritmes, luisteren, en welke muziekvoorkeuren opvielen.)
   - Hoofdstuk 3: Sociaal-Emotionele Ontwikkeling & Welbevinden
     (Analyseer de gemoedstoestanden, interacties met mededeelnemers en begeleiders, en de invloed van muziek op de gemoedstoestand en emotionele staat.)
   - Hoofdstuk 4: Bijzondere Momenten & Hoogtepunten
     (Noem specifieke gebeurtenissen, optredens of betekenisvolle doorbraken gedurende het jaar.)
   - Hoofdstuk 5: Evaluatie & Advies voor Zorgverleners
     (Geef een heldere samenvatting van de behoeften en leerpunten, en praktische handvatten en adviezen voor andere zorgverleners om deze deelnemer optimaal te begeleiden.)

3. Lever de output op als SCHONE, valide HTML (zonder \`\`\`html of \`\`\` code-omheiningen, begin direct met de HTML-tags).
4. Gebruik uitsluitend standaard HTML5-elementen voor structuur:
   - Koppen: <h3> voor de hoofdstuktitels
   - Alinea's: <p> voor lopende tekst
   - Lijstjes: <ul> en <li> voor opsommingen van adviezen of punten
   - Nadruk: <strong> voor belangrijke termen
   - Gebruik GEEN inline CSS styles of HTML class-attributen in de tags.
5. Baseer je op de feiten uit de dagrapportages. Synthetiseer en verwoord dit op een vloeiende, zorginhoudelijke en professionele manier. Zorg dat het leest als één samenhangend en kwalitatief jaarverslag van een jaar muzikale dagbesteding.`;

    const userPrompt = `Deelnemer: ${naam}
Datum opgesteld: ${today.toLocaleDateString('nl-NL')}
Zorginstelling: VOF Wimpie & de Domino's

Hier zijn de chronologische dagrapportages van het afgelopen jaar om te synthetiseren:
${formattedReports}

Schrijf nu het Jaarverslag in schone HTML:`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is niet ingesteld.");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [{
          parts: [{ text: userPrompt }]
        }],
        generationConfig: {
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API Error for Annual Report:", errText);
      throw new Error("Fout bij aanroepen Gemini API.");
    }

    const data = await response.json();
    let generatedHTML = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Verwijder eventuele per ongeluk gegenereerde markdown blocks
    generatedHTML = generatedHTML.replace(/^```html\s*/i, '').replace(/```\s*$/g, '').trim();

    return { 
      statusCode: 200, 
      headers: HEADERS, 
      body: JSON.stringify({ 
        naam,
        datum: today.toLocaleDateString('nl-NL'),
        aantalVerslagen: filteredRows.length,
        verslagHTML: generatedHTML 
      }) 
    };

  } catch (error) {
    console.error('Annual Report Function Error:', error);
    return { 
      statusCode: 500, 
      headers: HEADERS, 
      body: JSON.stringify({ error: error.message || 'Interne serverfout bij genereren jaarverslag' }) 
    };
  }
};
