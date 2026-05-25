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
    const steekwoorden = (payload.steekwoorden || '').trim().replace(/\s+/g, ' ');
    const historie = (payload.historie || '').trim().replace(/\s+/g, ' ');

    if (!steekwoorden) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Geen steekwoorden meegegeven.' }) };
    }

    const systemInstruction = `Je bent een professionele en positieve begeleider bij VOF Wimpie & de Domino's (een dagbesteding).
Jouw taak is het schrijven van een extreem beknopte, to-the-point dagrapportage (memo van maximaal 2 tot 3 korte zinnen) in het Nederlands en in de ik-vorm over een deelnemer.

Richtlijnen:
1. Schrijf uitsluitend in het Nederlands. Vertaal eventuele Engelse termen of namen niet, maar houd de voertaal strikt Nederlands.
2. Schrijf in de ik-vorm (bijv. "We hebben...", "Ik zag...").
3. Geen overbodige introducties of opsmuk, ga direct naar de feiten en observaties.
4. Houd het feitelijk, positief en professioneel voor de rapportage aan de wettelijk vertegenwoordiger.
5. Baseer je op de meegegeven steekwoorden en gebruik eerdere verslagen voor de juiste toon en continuïteit.
6. Lever uitsluitend de pure tekst van het nieuwe verslag op, zonder aanhalingstekens eromheen, en zonder inleidingen, labels of toelichtingen.`;

    const userPrompt = `Deelnemer: ${naam}

Eerdere verslagen ter referentie:
${historie || 'Geen eerdere verslagen.'}

Nieuwe steekwoorden voor vandaag:
${steekwoorden}

Schrijf nu het nieuwe verslag:`;

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
          maxOutputTokens: 150,
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API Error:", errText);
      throw new Error("Fout bij aanroepen Gemini API.");
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ verbeterdVerslag: generatedText.trim() }) };

  } catch (error) {
    console.error('AI Writer Error:', error);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: error.message || 'Server error in AI writer' }) };
  }
};