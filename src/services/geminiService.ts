const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('bible_auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

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

export interface SacredLocation {
  ancientName: string;
  modernName: string;
  lat: number;
  lng: number;
  context: string;
}

export interface ScriptureRef {
  book: string;
  chapter: number;
  verse: number | null;
  translation?: string;
}

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

export async function generateVerseImage(verseText: string, reference: string): Promise<{ imageUrl: string | null; galleryItem: { id: string; reference: string; text: string; date: string } | null }> {
  try {
    const response = await fetch(`${API_URL}/ai/image`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ verseText, reference })
    });
    if (!response.ok) return { imageUrl: null, galleryItem: null };
    const data = await response.json();
    return { imageUrl: data.imageBase64 || null, galleryItem: data.galleryItem || null };
  } catch (error) {
    console.error("Gemini image generation error:", error);
    return { imageUrl: null, galleryItem: null };
  }
}

export async function searchBible(query: string): Promise<AISearchResponse> {
  try {
    const response = await fetch(`${API_URL}/ai/search`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ query })
    });
    if (!response.ok) {
      if (response.status === 401) return { answer: "Please log in to use AI search features.", results: [] };
      return { answer: "Sorry, I encountered an error while searching.", results: [] };
    }
    return await response.json();
  } catch (error) {
    console.error("Gemini search error:", error);
    return { answer: "Sorry, an error occurred communicating with the server.", results: [] };
  }
}

export async function askAuthor(
  personaName: string,
  personaRole: string,
  message: string,
  history: { isUser: boolean; text: string }[] = []
): Promise<string> {
  try {
    const response = await fetch(`${API_URL}/ai/ask`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ personaName, personaRole, message, history })
    });
    if (!response.ok) {
      if (response.status === 401) return "Please log in to speak with me.";
      return "I cannot speak right now, my connection is clouded.";
    }
    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("Gemini author chat error:", error);
    return "Forgive me, my mind wanders. (An error occurred).";
  }
}

export async function getSacredGeography(chapterRef: string, chapterText: string): Promise<SacredLocation[]> {
  try {
    const response = await fetch(`${API_URL}/ai/geography`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ chapterRef, chapterText })
    });
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error("Gemini sacred geography error:", error);
    return [];
  }
}

export async function extractScriptureReference(transcript: string): Promise<ScriptureRef | null> {
  try {
    const response = await fetch(`${API_URL}/ai/extract`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ transcript })
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Gemini extract scripture error:", error);
    return null;
  }
}

export async function getVerseDeepDive(reference: string, verseText: string): Promise<VerseDeepDive | null> {
  try {
    const response = await fetch(`${API_URL}/ai/deepdive`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reference, verseText })
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Gemini deep dive error:", error);
    return null;
  }
}

export async function getWeeklyReflection(input: WeeklyReflectionInput): Promise<WeeklyReflection | null> {
  try {
    const response = await fetch(`${API_URL}/ai/reflection`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ input })
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Gemini weekly reflection error:", error);
    return null;
  }
}
