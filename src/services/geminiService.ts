import { GoogleGenAI, Type } from "@google/genai";

let ai: any = null;
try {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' && process.env ? process.env.GEMINI_API_KEY : "") || "";
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
  } else {
    console.warn("Lumina Bible: Gemini API key not found. AI features will be disabled.");
  }
} catch (e) {
  console.error("Lumina Bible: Failed to initialize Gemini API:", e);
}

export interface SearchResult {
  reference: string;
  preview: string;
  relevance: string;
}

export interface AISearchResponse {
  answer: string;
  results: SearchResult[];
}

export interface DeepDiveWord {
  original: string;
  transliteration: string;
  pronunciation: string;
  meaning: string;
  nuance: string;
}

export interface DeepDiveConnection {
  reference: string;
  description: string;
}

export interface VerseDeepDive {
  originalLanguage: DeepDiveWord[];
  historicalContext: string;
  crossPollination: DeepDiveConnection[];
}

export async function generateVerseImage(verseText: string, reference: string): Promise<string | null> {
  const model = "gemini-2.5-flash-image";

  const prompt = `A breathtaking, high-quality, atmospheric, and spiritual cinematic digital art piece inspired by the Bible verse: "${verseText}" (${reference}). 
  The style should be ethereal, meditative, and deeply artistic, with dramatic lighting and a sense of divine presence. 
  Focus on the emotional and spiritual essence of the verse. 
  NO TEXT, NO LETTERS, NO WORDS in the image. 
  Professional 4k resolution aesthetic.`;

  try {
    if (!ai) return null;
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini image generation error:", error);
    return null;
  }
}

export async function searchBible(query: string): Promise<AISearchResponse> {
  const model = "gemini-3-flash-preview";

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
    if (!ai) return { answer: "AI features are currently unavailable because the Gemini API key is not configured.", results: [] };
    const response = await ai.models.generateContent({
      model,
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
                  relevance: { type: Type.STRING },
                },
                required: ["reference", "preview", "relevance"],
              },
            },
          },
          required: ["answer", "results"],
        },
      },
    });

    const text = response.text;
    if (!text) return { answer: "I couldn't find anything on that topic.", results: [] };
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini search error:", error);
    return { answer: "Sorry, I encountered an error while searching.", results: [] };
  }
}

export async function askAuthor(
  personaName: string,
  personaRole: string,
  message: string,
  history: { isUser: boolean; text: string }[] = []
): Promise<string> {
  const model = "gemini-3-flash-preview";

  const systemInstruction = `
    You are playing the role of ${personaName}, ${personaRole} from the Bible.
    Engage in a conversational, helpful, and spiritually encouraging chat with the user.
    Speak in the first person ("I", "my") as if you are truly them.
    Base all your knowledge, experiences, and advice strictly on the biblical text.
    Do not break character. 
    Keep your responses medium-length (2-4 sentences max), conversational, and wise.
  `;

  try {
    if (!ai) return "I cannot speak right now, as the Divine connection (API Key) is missing.";

    // Format history for Gemini's contextual understanding
    const formattedHistory = history.map(msg =>
      `${msg.isUser ? "User" : personaName}: ${msg.text}`
    ).join("\n");

    const prompt = formattedHistory
      ? `Here is our conversation history:\n${formattedHistory}\n\nUser: ${message}`
      : `User: ${message}`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
      },
    });

    const text = response.text;
    if (!text) return "I have no words at this moment.";
    return text;
  } catch (error) {
    console.error("Gemini author chat error:", error);
    return "Forgive me, my mind wanders. (An error occurred connecting to the service).";
  }
}

export interface SacredLocation {
  ancientName: string;
  modernName: string;
  lat: number;
  lng: number;
  context: string;
}

export async function getSacredGeography(chapterRef: string, chapterText: string): Promise<SacredLocation[]> {
  const model = "gemini-3-flash-preview";

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
    if (!ai) return [];

    const response = await ai.models.generateContent({
      model,
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
              context: { type: Type.STRING },
            },
            required: ["ancientName", "modernName", "lat", "lng", "context"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];

    return JSON.parse(text) as SacredLocation[];
  } catch (error) {
    console.error("Gemini sacred geography error:", error);
    return [];
  }
}

export interface ScriptureRef {
  book: string;
  chapter: number;
  verse: number | null;
  translation?: string; // e.g., "NIV", "KJV" if explicitly mentioned
}

export async function extractScriptureReference(transcript: string): Promise<ScriptureRef | null> {
  const model = "gemini-3-flash-preview";

  const systemInstruction = `
    You are an AI tasked with listening to transcribed audio from a church sermon and detecting when the speaker tells the audience to turn to a specific Bible reference.
    
    Examples of what you should detect:
    - "Turn with me to John chapter 3 verse 16"
    - "Look at Romans 8, starting at verse 28"
    - "Back in the second half of Psalm 23"
    - "If you have your Bibles, flip to Revelation chapter 1"
    - "Let's read from Ephesians 2 verses 8 and 9..."
    - "In the NIV it says in Matthew 5..."

    If you detect a solid, actionable citation intended for the congregation to navigate to, extract it representing the target book, chapter, and verse (if mentioned).
    If a specific Bible translation (like NIV, KJV, ESV, NLT) is explicitly mentioned, include it.
    If multiple references are mentioned in the snippet, return the most prominent or recent one they are turning to.
    
    If no clear navigation-worthy scripture reference is found in the text, return null. 
    Do not hallucinate references. If the text only loosely mentions a biblical concept without a book/chapter pairing (e.g. "when David fought Goliath"), return null.
    
    Return the output as a clean JSON object. 
  `;

  try {
    if (!ai) return null;

    const response = await ai.models.generateContent({
      model,
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
            translation: { type: Type.STRING, nullable: true },
          },
          required: ["book", "chapter"],
        },
      },
    });

    const text = response.text;
    if (!text) return null;

    const result = JSON.parse(text);
    if (!result.book || !result.chapter) return null;

    return result as ScriptureRef;
  } catch (error) {
    console.error("Gemini extract scripture error:", error);
    return null;
  }
}

export async function getVerseDeepDive(reference: string, verseText: string): Promise<VerseDeepDive | null> {
  const model = "gemini-3-flash-preview";
  console.log("Lumina: Calling Gemini Deep Dive with model:", model);

  const systemInstruction = `
    You are a "digital Bible archeologist". Your task is to perform a deep-dive analysis of a specific Bible verse. 
    
    Provide your analysis in the following structured JSON format:
    
    1. originalLanguage: An array of 3-5 key Greek (NT) or Hebrew (OT) words from the verse. For each word include:
       - original: The word in its original script.
       - transliteration: Standard English transliteration.
       - pronunciation: Basic phonetic spelling.
       - meaning: Primary definition.
       - nuance: A brief (1 sentence) explanation of how this word provides deeper meaning to the verse.
       
    2. historicalContext: A 2-3 sentence paragraph explaining:
       - Who was the original audience?
       - What was the specific cultural or situational context that makes this verse significant?
       
    3. crossPollination: An array of 3-4 other Bible verses that are deeply connected to this one. For each:
       - reference: Standard reference (e.g., "Isaiah 53:5").
       - description: A 1-sentence explanation of the connection (e.g., "Prophecy fulfillment", "Thematic parallel").

    Be academic yet accessible. Ensure the JSON is valid.
  `;

  try {
    if (!ai) return null;

    const response = await ai.models.generateContent({
      model,
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
                  nuance: { type: Type.STRING },
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
                  description: { type: Type.STRING },
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
    if (!text) return null;

    return JSON.parse(text) as VerseDeepDive;
  } catch (error) {
    console.error("Gemini deep dive error:", error);
    return null;
  }
}

// ─── Weekly Growth Report ────────────────────────────────────────────────────

export interface WeeklyReflection {
  title: string;
  theme: string;
  narrative: string;
  keyVerse: string;
  keyVerseText: string;
  actionItems: string[];
  prayerPrompt: string;
}

export interface WeeklyReflectionInput {
  highlights: Array<{ reference: string; text: string; note?: string }>;
  notes: Array<{ reference: string; content: string }>;
  booksRead: string[];
  versesRead: number;
  userName?: string;
  weekStartDate: string;
}

export async function getWeeklyReflection(input: WeeklyReflectionInput): Promise<WeeklyReflection | null> {
  if (!ai) return null;

  const model = "gemini-3-flash-preview";

  const highlightsSummary = input.highlights.length > 0
    ? input.highlights.map(h => `- ${h.reference}: "${h.text}"${h.note ? ` (Note: ${h.note})` : ""}`).join("\n")
    : "No highlights this week.";

  const notesSummary = input.notes.length > 0
    ? input.notes.map(n => `- ${n.reference}: "${n.content}"`).join("\n")
    : "No personal notes this week.";

  const systemInstruction = `You are a compassionate, insightful spiritual director and journal writer.
Your role is to synthesize a person's week of Bible engagement into a deeply personal, beautifully written "Spiritual Journal Entry."
Write with warmth, wisdom, and theological depth—like a letter from a trusted mentor who has read every verse alongside them.
The narrative should be cohesive and feel like God has been weaving a single theme through their entire week.
Return ONLY a JSON object matching the required schema.`;

  const userPrompt = `Week of: ${input.weekStartDate}\nPerson: ${input.userName || "Dear Friend"}\n\nBooks Read This Week: ${input.booksRead.join(", ") || "None recorded"}\nTotal Verses Read: ${input.versesRead}\n\nHighlighted Verses:\n${highlightsSummary}\n\nPersonal Notes:\n${notesSummary}\n\nGenerate the Weekly Growth Report now.`;

  try {
    const response = await ai.models.generateContent({
      model,
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
            prayerPrompt: { type: Type.STRING },
          },
          required: ["title", "theme", "narrative", "keyVerse", "keyVerseText", "actionItems", "prayerPrompt"]
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as WeeklyReflection;
  } catch (error) {
    console.error("Gemini weekly reflection error:", error);
    return null;
  }
}
