const SYSTEM_PROMPT = `Du er en lærerassistent der laver læringsspil til EUD-elever i Danmark.

Din opgave er at finde præcis 10 vigtige fagord i en fagtekst og lave multiple-choice spørgsmål om dem.

Regler:
- Forklaringer skal være på let dansk og forståelige for EUD-elever
- Hvert spørgsmål skal teste forståelsen af fagordet
- correctAnswer skal være kort og tydelig
- wrongAnswers skal altid indeholde præcis 3 plausible men forkerte svar
- Vælg fagord der er centrale for teksten, ikke tilfældige ord
- Returnér kun gyldig JSON uden markdown eller ekstra tekst

Returnér JSON i præcis dette format:
{
  "words": [
    {
      "word": "fagord",
      "explanation": "kort forklaring på let dansk",
      "question": "spørgsmål om fagordet",
      "correctAnswer": "det rigtige svar",
      "wrongAnswers": ["forkert 1", "forkert 2", "forkert 3"]
    }
  ]
}`;

function validateWords(words) {
  if (!Array.isArray(words) || words.length !== 10) {
    throw new Error("OpenAI returnerede ikke præcis 10 fagord.");
  }

  for (const item of words) {
    if (
      typeof item.word !== "string" ||
      typeof item.explanation !== "string" ||
      typeof item.question !== "string" ||
      typeof item.correctAnswer !== "string" ||
      !Array.isArray(item.wrongAnswers) ||
      item.wrongAnswers.length !== 3 ||
      item.wrongAnswers.some((answer) => typeof answer !== "string")
    ) {
      throw new Error("OpenAI returnerede et ugyldigt spørgsmålsformat.");
    }
  }

  return words;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Kun POST er tilladt." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return response.status(500).json({ error: "OPENAI_API_KEY mangler." });
  }

  const { text } = request.body || {};
  if (!text || typeof text !== "string" || !text.trim()) {
    return response.status(400).json({ error: "Tekst mangler." });
  }

  try {
    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Find 10 vigtige fagord i denne tekst og lav spørgsmål om dem:\n\n${text.trim()}`
          }
        ]
      })
    });

    if (!openAiResponse.ok) {
      const errorBody = await openAiResponse.text();
      return response.status(502).json({
        error: "OpenAI API-kald fejlede.",
        details: errorBody
      });
    }

    const completion = await openAiResponse.json();
    const content = completion?.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI returnerede intet svar.");
    }

    const parsed = JSON.parse(content);
    const words = validateWords(parsed.words);

    return response.status(200).json({ words });
  } catch (error) {
    return response.status(500).json({
      error: "Kunne ikke generere læringsspil.",
      details: error.message
    });
  }
}
