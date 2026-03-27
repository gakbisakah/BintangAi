export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { inputs, parameters, isImage } = req.body;
  const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Gemini API Key tidak ditemukan di server.' });
  }

  const MODEL = "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  try {
    const body = {
      contents: [{
        parts: [{
          text: isImage
            ? `Deskripsikan gambar ini untuk anak SD: ${inputs}`
            : inputs
        }]
      }],
      generationConfig: {
        maxOutputTokens: parameters?.max_new_tokens || 500,
        temperature: parameters?.temperature || 0.7,
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    let result;

    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      console.error("Gagal parse JSON dari Gemini:", responseText);
      return res.status(response.status).json({
        error: 'Respon dari Gemini bukan JSON yang valid',
        details: responseText
      });
    }

    if (!response.ok) {
      console.error("Gemini API Error:", result);
      return res.status(response.status).json(result);
    }

    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, aku tidak bisa menjawab itu.";

    return res.status(200).json({ answer: generatedText });
  } catch (error) {
    console.error("Gemini Proxy Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
