/**
 * atmosphereService.ts
 * Manages ambient background soundscapes for the Lumina Bible.
 */

export type AtmosphereType = 'waters' | 'desert' | 'morning' | 'none';

class AtmosphereService {
    private audio: HTMLAudioElement | null = null;
    private currentType: AtmosphereType = 'none';
    private fadeInterval: NodeJS.Timeout | null = null;

    private soundUrls: Record<Exclude<AtmosphereType, 'none'>, string> = {
        waters: "https://assets.mixkit.co/active_storage/sfx/2012/2012-preview.mp3", // River flow ambience loop
        desert: "https://assets.mixkit.co/active_storage/sfx/1254/1254-preview.mp3", // Windy desert loop
        morning: "https://assets.mixkit.co/active_storage/sfx/1127/1127-preview.mp3", // Morning birds chirping
    };

    play(type: AtmosphereType) {
        if (type === this.currentType) return;
        this.stop();

        if (type === 'none') {
            this.currentType = 'none';
            return;
        }

        this.currentType = type;
        this.audio = new Audio(this.soundUrls[type]);
        this.audio.loop = true;
        this.audio.volume = 0;

        this.audio.play().catch(e => console.warn("Atmosphere play blocked by browser:", e));
        this.fadeIn();
    }

    stop() {
        if (this.fadeInterval) clearInterval(this.fadeInterval);
        if (this.audio) {
            this.fadeOut(() => {
                if (this.audio) {
                    this.audio.pause();
                    this.audio = null;
                }
            });
        }
        this.currentType = 'none';
    }

    private fadeIn() {
        if (!this.audio) return;
        let vol = 0;
        this.fadeInterval = setInterval(() => {
            if (this.audio && vol < 0.3) {
                vol += 0.02;
                this.audio.volume = vol;
            } else {
                if (this.fadeInterval) clearInterval(this.fadeInterval);
            }
        }, 200);
    }

    private fadeOut(callback: () => void) {
        if (!this.audio) {
            callback();
            return;
        }
        let vol = this.audio.volume;
        const interval = setInterval(() => {
            if (this.audio && vol > 0.02) {
                vol -= 0.02;
                this.audio.volume = vol;
            } else {
                clearInterval(interval);
                callback();
            }
        }, 100);
    }
}

export const atmosphereService = new AtmosphereService();
