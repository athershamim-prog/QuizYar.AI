export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { subject, level, count } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-8b"];
    const prompt = `Generate exactly ${count} different MCQs with ${level} difficulty on the topic: ${subject}. Include a one-sentence explanation for the correct answer.`;

    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    q: { type: "STRING" },
                                    a: { type: "ARRAY", items: { type: "STRING" } },
                                    c: { type: "STRING" },
                                    e: { type: "STRING" }
                                },
                                required: ["q", "a", "c", "e"]
                            }
                        }
                    }
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                const msg = errData?.error?.message || `HTTP ${response.status}`;
                console.warn(`Skipping ${model}: ${msg}`);
                return res.status(response.status).json({ error: `[${model}] ${msg}` });
            }

            const data = await response.json();
            const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!raw) continue;

            return res.status(200).json(JSON.parse(raw.trim()));
        } catch (e) {
            console.error(`Model ${model} failed:`, e.message);
        }
    }

    res.status(429).json({ error: "AI is busy right now — please wait a moment and try again." });
}
