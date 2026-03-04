export class SermonListenerService {
    recognition: any = null;
    isListening: boolean = false;
    onTranscript: ((text: string, isFinal: boolean) => void) | null = null;
    onError: ((err: string) => void) | null = null;

    constructor() {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';

            this.recognition.onstart = () => {
                this.isListening = true;
            };

            this.recognition.onresult = (event: any) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                if (this.onTranscript) {
                    if (finalTranscript) {
                        this.onTranscript(finalTranscript, true);
                    }
                    if (interimTranscript) {
                        this.onTranscript(interimTranscript, false);
                    }
                }
            };

            this.recognition.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                if (this.onError) {
                    this.onError(event.error);
                }
                if (event.error !== 'no-speech') {
                    this.isListening = false;
                }
            };

            this.recognition.onend = () => {
                // Auto-restart if we are supposed to be listening (handles standard timeouts)
                if (this.isListening) {
                    try {
                        this.recognition.start();
                    } catch (e) {
                        this.isListening = false;
                    }
                } else {
                    this.isListening = false;
                }
            };
        }
    }

    isSupported(): boolean {
        return !!this.recognition;
    }

    start() {
        if (!this.recognition) {
            if (this.onError) this.onError("not-supported");
            return;
        }
        if (this.isListening) return;

        try {
            this.isListening = true;
            this.recognition.start();
        } catch (e) {
            console.error("Failed to start speech recognition", e);
            this.isListening = false;
            if (this.onError) this.onError("start-failed");
        }
    }

    stop() {
        this.isListening = false;
        if (this.recognition) {
            this.recognition.stop();
        }
    }
}

export const sermonService = new SermonListenerService();
