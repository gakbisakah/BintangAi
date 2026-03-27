/**
 * Helper untuk memanggil Groq Cloud API dari Edge Functions
 * (Nama file tetap gemini.ts agar tidak merusak import di fungsi lain,
 * namun isinya menggunakan Groq)
 */
export const callGemini = async (prompt: string, config: { maxTokens?: number, temperature?: number } = {}) => {
  const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');

  if (!GROQ_API_KEY) {
    console.error("Missing GROQ_API_KEY in Edge Function Environment");
    throw new Error("API Key Groq tidak ditemukan di konfigurasi server.");
  }

  const MODEL = "llama-3.3-70b-versatile"; // Model Groq yang sangat cepat dan pintar
  const url = `https://api.groq.com/openai/v1/chat/completions`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "user", content: prompt }
        ],
        max_tokens: config.maxTokens || 800,
        temperature: config.temperature || 0.7,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Groq API Error Response:", result);
      throw new Error(result.error?.message || "Gagal mendapatkan respon dari Groq AI.");
    }

    // Mengambil teks hasil generate (Format OpenAI/Groq)
    const text = result.choices?.[0]?.message?.content;
    return text || "Maaf, Kak Bintang belum bisa memproses jawaban ini.";

  } catch (error) {
    console.error("Groq Utility Error:", error);
    throw error;
  }
};
