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
    const { naam, steekwoorden, historie } = payload;

    if (!steekwoorden) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Geen steekwoorden meegegeven.' }) };
    }

    const prompt = `Je bent een professionele en empathische zorgverlener bij VOF Wimpie & de Domino's. Schrijf een beknopt dagverslag (maximaal 3-4 zinnen) in de ik-vorm.
Gebruik deze context van eerdere verslagen voor de juiste toon en continuïteit: ${historie || 'Geen eerdere verslagen.'}.
Schrijf het nieuwe verslag op basis van deze steekwoorden: ${steekwoorden}.
Houd het feitelijk, positief en professioneel voor de rapportage aan de wettelijk vertegenwoordiger.`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is niet ingesteld.");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
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