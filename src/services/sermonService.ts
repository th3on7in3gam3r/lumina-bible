export class SermonListenerService {
    recognition: any = null;
    isListening: boolean = false;
    wakeLock: any = null;
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

    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await (navigator as any).wakeLock.request('screen');
            } catch (err) {
                console.error("WakeLock failed:", err);
            }
        }
    }

    releaseWakeLock() {
        if (this.wakeLock !== null) {
            this.wakeLock.release().then(() => {
                this.wakeLock = null;
            }).catch(console.error);
        }
    }

    async start() {
        if (!this.recognition) {
            if (this.onError) this.onError("not-supported");
            return;
        }
        if (this.isListening) return;

        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                // We just needed permission; stop the tracks so SpeechRecognition can take over cleanly
                stream.getTracks().forEach(track => track.stop());
            }
        } catch (e) {
            console.error("Microphone access denied or error:", e);
            if (this.onError) this.onError("permission-denied");
            return;
        }

        await this.requestWakeLock();

        try {
            this.isListening = true;
            this.recognition.start();
        } catch (e) {
            console.error("Failed to start speech recognition", e);
            this.isListening = false;
            this.releaseWakeLock();
            if (this.onError) this.onError("start-failed");
        }
    }

    stop() {
        this.isListening = false;
        if (this.recognition) {
            this.recognition.stop();
        }
        this.releaseWakeLock();
    }
}

export const sermonService = new SermonListenerService();
