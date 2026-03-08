import { Router, Request, Response } from 'express';
import { GoogleGenAI, Type } from "@google/genai";
import { authenticateToken, AuthRequest } from './middleware.js';
import pool from './db.js';

const router = Router();

let ai: any = null;
try {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (apiKey) {
        ai = new GoogleGenAI({ apiKey });
    } else {
        console.warn("Lumina Backend: GEMINI_API_KEY not found. AI features will fail.");
    }
} catch (e) {
    console.error("Lumina Backend: Failed to initialize Gemini API:", e);
}

router.post('/image', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
    const { verseText, reference } = req.body;
    const userId = req.user?.id;
    if (!ai) return res.status(503).json({ error: "AI not configured" });

    const prompt = `A breathtaking, high-quality, atmospheric, and spiritual cinematic digital art piece inspired by the Bible verse: "${verseText}" (${reference}). 
    The style should be ethereal, meditative, and deeply artistic, with dramatic lighting and a sense of divine presence. 
    Focus on the emotional and spiritual essence of the verse. 
    NO TEXT, NO LETTERS, NO WORDS in the image. 
    Professional 4k resolution aesthetic.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: { parts: [{ text: prompt }] },
            config: { imageConfig: { aspectRatio: "1:1" } }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                const rawBase64 = part.inlineData.data;
                const localId = `img_${Date.now()}`;
                const date = new Date().toLocaleDateString();

                // Save directly to DB at generation time — no large payload sync needed
                if (userId) {
                    try {
                        await pool.query(
                            `INSERT INTO gallery (user_id, local_id, url, reference, text, date)
                             VALUES ($1, $2, $3, $4, $5, $6)
                             ON CONFLICT (user_id, local_id) DO NOTHING`,
                            [userId, localId, rawBase64, reference, verseText, date]
                        );
                    } catch (dbErr) {
                        console.error('Gallery DB save error (non-fatal):', dbErr);
                    }
                }

                return res.json({
                    imageBase64: `data:image/png;base64,${rawBase64}`,
                    galleryItem: { id: localId, reference, text: verseText, date }
                });
            }
        }
        res.json({ imageBase64: null, galleryItem: null });
    } catch (err: any) {
        console.error("Image gen error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/search', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    const { query } = req.body;
    if (!ai) return res.status(503).json({ answer: "AI features are currently unavailable because the Gemini API key is not configured.", results: [] });

    const systemInstruction = `
    You are a Bible search assistant. Your task is to find relevant Bible verses based on user queries and provide a helpful, encouraging conversational answer.
    Queries can be keywords, topics (e.g., "anxiety", "love"), or specific questions (e.g., "How can I find peace?").
    
    Return a JSON object with:
    - answer: A brief (2-3 sentences) conversational answer or summary based on the Bible's teachings regarding the query.
    - results: A JSON array of exactly 5 objects with:
      - reference: The standard Bible reference (e.g., "John 3:16").
      - preview: A short snippet of the verse text (KJV version).
      - relevance: A brief explanation of why this verse matches the query.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Search for: ${query}`,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        answer: { type: Type.STRING },
                        results: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    reference: { type: Type.STRING },
                                    preview: { type: Type.STRING },
                                    relevance: { type: Type.STRING }
                                },
                                required: ["reference", "preview", "relevance"]
                            }
                        }
                    },
                    required: ["answer", "results"]
                }
            }
        });
        const text = response.text;
        if (!text) return res.json({ answer: "I couldn't find anything on that topic.", results: [] });
        res.json(JSON.parse(text));
    } catch (err: any) {
        console.error("Search error:", err);
        res.status(500).json({ answer: "Sorry, an error occurred.", results: [] });
    }
});

router.post('/ask', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    const { personaName, personaRole, message, history } = req.body;
    if (!ai) return res.status(503).json({ text: "I cannot speak right now, API Key missing." });

    const systemInstruction = `
    You are playing the role of ${personaName}, ${personaRole} from the Bible.
    Engage in a conversational, helpful, and spiritually encouraging chat with the user.
    Speak in the first person ("I", "my") as if you are truly them.
    Base all your knowledge, experiences, and advice strictly on the biblical text.
    Do not break character. 
    Keep your responses medium-length (2-4 sentences max), conversational, and wise.
    `;

    try {
        const formattedHistory = (history || []).map((msg: any) =>
            `${msg.isUser ? "User" : personaName}: ${msg.text}`
        ).join("\n");

        const prompt = formattedHistory
            ? `Here is our conversation history:\n${formattedHistory}\n\nUser: ${message}`
            : `User: ${message}`;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: { systemInstruction }
        });

        const text = response.text;
        res.json({ text: text || "I have no words at this moment." });
    } catch (err: any) {
        console.error("Ask author error:", err);
        res.status(500).json({ text: "Forgive me, my mind wanders." });
    }
});

router.post('/geography', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    const { chapterRef, chapterText } = req.body;
    if (!ai) return res.status(503).json([]);

    const systemInstruction = `
    You are an expert biblical geographer and historian.
    The user will provide the text of a specific Bible chapter (${chapterRef}).
    Your task is to identify all distinct physical, geographic locations mentioned in the text (e.g., cities, mountains, regions, bodies of water).
    
    For each location found in the text, provide:
    - ancientName: The name exactly as it appears in the text.
    - modernName: The modern-day, real-world equivalent name of that location.
    - lat: The estimated modern decimal latitude coordinate.
    - lng: The estimated modern decimal longitude coordinate.
    - context: A brief (1-sentence) explanation of what happens at this location in this chapter.

    Return ONLY a JSON array of these location objects. 
    If no identifiable geographic locations exist in this chapter, return an empty array [].
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Chapter Text:\n${chapterText}`,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            ancientName: { type: Type.STRING },
                            modernName: { type: Type.STRING },
                            lat: { type: Type.NUMBER },
                            lng: { type: Type.NUMBER },
                            context: { type: Type.STRING }
                        },
                        required: ["ancientName", "modernName", "lat", "lng", "context"]
                    }
                }
            }
        });

        const text = response.text;
        res.json(text ? JSON.parse(text) : []);
    } catch (err) {
        console.error("Geography error:", err);
        res.status(500).json([]);
    }
});

router.post('/extract', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    const { transcript } = req.body;
    if (!ai) return res.status(503).json(null);

    const systemInstruction = `
    You are an AI tasked with listening to transcribed audio from a church sermon and detecting when the speaker tells the audience to turn to a specific Bible reference.
    
    If no clear navigation-worthy scripture reference is found in the text, return null. 
    Return the output as a clean JSON object. 
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Transcript Snippet:\n"${transcript}"\n\nDid the speaker ask to turn to a verse? If so, extract it.`,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        book: { type: Type.STRING },
                        chapter: { type: Type.INTEGER },
                        verse: { type: Type.INTEGER, nullable: true },
                        translation: { type: Type.STRING, nullable: true }
                    },
                    required: ["book", "chapter"]
                }
            }
        });

        const text = response.text;
        if (!text) return res.json(null);
        res.json(JSON.parse(text));
    } catch (err) {
        console.error("Extract reference error:", err);
        res.status(500).json(null);
    }
});

router.post('/deepdive', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    const { reference, verseText } = req.body;
    if (!ai) return res.status(503).json(null);

    const systemInstruction = `
    You are a "digital Bible archeologist". Your task is to perform a deep-dive analysis of a specific Bible verse. 
    
    Provide your analysis in the following structured JSON format:
    1. originalLanguage
    2. historicalContext
    3. crossPollination
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Verse: ${reference}\nText: "${verseText}"`,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        originalLanguage: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    original: { type: Type.STRING },
                                    transliteration: { type: Type.STRING },
                                    pronunciation: { type: Type.STRING },
                                    meaning: { type: Type.STRING },
                                    nuance: { type: Type.STRING }
                                },
                                required: ["original", "transliteration", "pronunciation", "meaning", "nuance"]
                            }
                        },
                        historicalContext: { type: Type.STRING },
                        crossPollination: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    reference: { type: Type.STRING },
                                    description: { type: Type.STRING }
                                },
                                required: ["reference", "description"]
                            }
                        }
                    },
                    required: ["originalLanguage", "historicalContext", "crossPollination"]
                }
            }
        });

        const text = response.text;
        res.json(text ? JSON.parse(text) : null);
    } catch (err) {
        console.error("Deep dive error:", err);
        res.status(500).json(null);
    }
});

router.post('/reflection', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    const { input } = req.body;
    if (!ai) return res.status(503).json(null);

    const highlightsSummary = input.highlights.length > 0
        ? input.highlights.map((h: any) => `- ${h.reference}: "${h.text}"${h.note ? " (Note: " + h.note + ")" : ""}`).join("\n")
        : "No highlights this week.";

    const notesSummary = input.notes.length > 0
        ? input.notes.map((n: any) => `- ${n.reference}: "${n.content}"`).join("\n")
        : "No personal notes this week.";

    const systemInstruction = `You are a compassionate, insightful spiritual director and journal writer.
Your role is to synthesize a person's week of Bible engagement into a deeply personal, beautifully written "Spiritual Journal Entry."
Write with warmth, wisdom, and theological depth—like a letter from a trusted mentor who has read every verse alongside them.
The narrative should be cohesive and feel like God has been weaving a single theme through their entire week.
Return ONLY a JSON object matching the required schema.`;

    const userPrompt = `Week of: ${input.weekStartDate}\nPerson: ${input.userName || "Dear Friend"}\n\nBooks Read This Week: ${input.booksRead.join(", ") || "None recorded"}\nTotal Verses Read: ${input.versesRead}\n\nHighlighted Verses:\n${highlightsSummary}\n\nPersonal Notes:\n${notesSummary}\n\nGenerate the Weekly Growth Report now.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: userPrompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        theme: { type: Type.STRING },
                        narrative: { type: Type.STRING },
                        keyVerse: { type: Type.STRING },
                        keyVerseText: { type: Type.STRING },
                        actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
                        prayerPrompt: { type: Type.STRING }
                    },
                    required: ["title", "theme", "narrative", "keyVerse", "keyVerseText", "actionItems", "prayerPrompt"]
                }
            }
        });

        const text = response.text;
        res.json(text ? JSON.parse(text) : null);
    } catch (err) {
        console.error("Weekly reflection error:", err);
        res.status(500).json(null);
    }
});

router.post('/sermon-content', authenticateToken, async (req: Request, res: Response): Promise<any> => {
    const { transcript } = req.body;
    if (!ai) return res.status(503).json(null);

    const systemInstruction = `You are a pastoral assistant and content creator. The user has provided a raw transcript of a sermon.
Your task is to transform this sermon into actionable, highly structured content to help the congregation engage with the message throughout the week.

Provide the response matching EXACTLY the JSON schema provided, with no additional formatting or text outside the JSON.
Keep social media quotes punchy and inspiring.
Ensure the 7-day devotional has exactly 7 distinct days, each tying a core sermon point to a practical application and prayer.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Here is the transcript of the sermon:\n\n${transcript}\n\nPlease generate the comprehensive weekly content pack now.`,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: {
                            type: Type.OBJECT,
                            properties: {
                                coreTheme: { type: Type.STRING },
                                keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } }
                            },
                            required: ["coreTheme", "keyTakeaways"]
                        },
                        devotional: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    day: { type: Type.STRING },
                                    theme: { type: Type.STRING },
                                    scripture: { type: Type.STRING },
                                    reflection: { type: Type.STRING },
                                    prayer: { type: Type.STRING }
                                },
                                required: ["day", "theme", "scripture", "reflection", "prayer"]
                            }
                        },
                        socialMedia: {
                            type: Type.OBJECT,
                            properties: {
                                quotes: { type: Type.ARRAY, items: { type: Type.STRING } },
                                caption: { type: Type.STRING }
                            },
                            required: ["quotes", "caption"]
                        },
                        actionSteps: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["summary", "devotional", "socialMedia", "actionSteps"]
                }
            }
        });

        const text = response.text;
        res.json(text ? JSON.parse(text) : null);
    } catch (err) {
        console.error("Sermon content extraction error:", err);
        res.status(500).json(null);
    }
});

export default router;
