/// <reference types="vite/client" />
export interface Verse {
    id: string;
    number: number;
    text: string;
}

export type AudioRole = 'narrator' | 'character';

export interface AudioChunk {
    text: string;
    role: AudioRole;
    verseId?: string;
}

export interface GoogleVoice {
    name: string;
    label: string;
    languageCode: string;
}

export const GOOGLE_VOICES: GoogleVoice[] = [
    { name: 'en-US-Journey-D', label: 'Journey D (Warm Male)', languageCode: 'en-US' },
    { name: 'en-US-Journey-V', label: 'Journey V (Deep Male)', languageCode: 'en-US' },
    { name: 'en-US-Journey-F', label: 'Journey F (Clear Female)', languageCode: 'en-US' },
    { name: 'en-US-Journey-O', label: 'Journey O (Authoritative Female)', languageCode: 'en-US' },
    { name: 'en-US-Studio-M', label: 'Studio M (Professional Male)', languageCode: 'en-US' },
    { name: 'en-US-Studio-O', label: 'Studio O (Professional Female)', languageCode: 'en-US' },
];

export class AudioService {
    private currentAudio: HTMLAudioElement | null = null;
    private chunks: AudioChunk[] = [];
    private currentIndex: number = 0;
    private onChunkChange?: (index: number) => void;
    public onAudioStartLoading?: () => void;
    public onAudioFinishLoading?: () => void;
    private onComplete?: () => void;
    public isPlaying: boolean = false;

    // Google Cloud TTS configuration
    private readonly API_KEY = import.meta.env.VITE_GOOGLE_TTS_API_KEY;
    private readonly TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

    // Voice Selection based on role
    private narratorVoice: GoogleVoice = GOOGLE_VOICES[0];  // Default: Journey D (Warm Male)
    private characterVoice: GoogleVoice = GOOGLE_VOICES[1]; // Default: Journey V (Deep Male)

    constructor() { }

    public getVoices(): GoogleVoice[] {
        return GOOGLE_VOICES;
    }

    public getNarratorVoice(): GoogleVoice {
        return this.narratorVoice;
    }

    public getCharacterVoice(): GoogleVoice {
        return this.characterVoice;
    }

    public setNarratorVoice(name: string) {
        const voice = GOOGLE_VOICES.find(v => v.name === name);
        if (voice) this.narratorVoice = voice;
    }

    public setCharacterVoice(name: string) {
        const voice = GOOGLE_VOICES.find(v => v.name === name);
        if (voice) this.characterVoice = voice;
    }

    /**
     * Parses an array of verses into discrete chunks of dialogue and narration
     * by splitting on common quotation marks.
     */
    public parseChapterToDialogue(verses: Verse[]): AudioChunk[] {
        const chunks: AudioChunk[] = [];

        // Common quotation marks used in different Bible APIs
        const quoteMarks = ['"', '“', '”', '‘', '’', "'"];

        // We trackquote state globally across verses so a speech spanning multiple verses stays in 'character' mode.
        let inQuotes = false;

        for (const verse of verses) {
            let currentText = '';

            for (let i = 0; i < verse.text.length; i++) {
                const char = verse.text[i];

                if (quoteMarks.includes(char)) {
                    // Flush current text
                    if (currentText.trim().length > 0) {
                        chunks.push({
                            text: currentText.trim(),
                            role: inQuotes ? 'character' : 'narrator',
                            verseId: verse.id
                        });
                    }
                    currentText = '';
                    inQuotes = !inQuotes; // Toggle quote state
                } else {
                    currentText += char;
                }
            }

            // Flush remaining text at end of verse
            if (currentText.trim().length > 0) {
                chunks.push({
                    text: currentText.trim(),
                    role: inQuotes ? 'character' : 'narrator',
                    verseId: verse.id
                });
            }
        }

        return chunks;
    }

    public play(chunks: AudioChunk[], onChunkChange?: (index: number) => void, onComplete?: () => void) {
        this.stop(); // stop any existing playback

        if (chunks.length === 0) return;

        this.chunks = chunks;
        this.currentIndex = 0;
        this.onChunkChange = onChunkChange;
        this.onComplete = onComplete;
        this.isPlaying = true;

        this.playNextChunk();
    }

    public pause() {
        if (this.isPlaying && this.currentAudio) {
            this.currentAudio.pause();
            this.isPlaying = false;
        }
    }

    public resume() {
        if (!this.isPlaying && this.currentAudio && this.chunks.length > 0) {
            this.currentAudio.play();
            this.isPlaying = true;
        } else if (!this.isPlaying && !this.currentAudio && this.currentIndex < this.chunks.length) {
            // If it was stopped completely, just resume playing next chunk
            this.isPlaying = true;
            this.playNextChunk();
        }
    }

    public stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.src = '';
            this.currentAudio = null;
        }
        this.isPlaying = false;
        this.chunks = [];
        this.currentIndex = 0;
    }

    private async playNextChunk() {
        if (this.currentIndex >= this.chunks.length) {
            this.isPlaying = false;
            if (this.onComplete) this.onComplete();
            return;
        }

        if (!this.isPlaying) return; // if stopped while fetching

        const chunk = this.chunks[this.currentIndex];
        if (this.onChunkChange) this.onChunkChange(this.currentIndex);

        if (!this.API_KEY) {
            console.error("VITE_GOOGLE_TTS_API_KEY is missing from environment variables.");
            this.stop();
            return;
        }

        if (this.onAudioStartLoading) this.onAudioStartLoading();

        try {
            const requestBody = {
                input: { text: chunk.text },
                voice: chunk.role === 'character' ? { languageCode: this.characterVoice.languageCode, name: this.characterVoice.name } : { languageCode: this.narratorVoice.languageCode, name: this.narratorVoice.name },
                audioConfig: { audioEncoding: "MP3" }
            };

            const response = await fetch(`${this.TTS_URL}?key=${this.API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Google Cloud TTS API Error: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            const audioSrc = `data:audio/mp3;base64,${data.audioContent}`;

            // Check if playback was stopped while we were waiting for the network
            if (!this.isPlaying) return;

            if (this.onAudioFinishLoading) this.onAudioFinishLoading();

            this.currentAudio = new Audio(audioSrc);

            this.currentAudio.onended = () => {
                this.currentIndex++;
                this.currentAudio = null;
                this.playNextChunk();
            };

            this.currentAudio.onerror = (e) => {
                console.error("Audio playback error", e);
                this.isPlaying = false;
                if (this.onAudioFinishLoading) this.onAudioFinishLoading();
            };

            await this.currentAudio.play();

        } catch (error) {
            console.error("Error fetching or playing Google TTS chunk:", error);
            this.isPlaying = false;
            if (this.onAudioFinishLoading) this.onAudioFinishLoading();
        }
    }
}

// Export a singleton instance for ease of use
export const audioService = new AudioService();
