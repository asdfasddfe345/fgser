export class TextToSpeechService {
  private synthesis: SpeechSynthesis | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private isSpeaking: boolean = false;
  private isPaused: boolean = false;
  private onSpeakingUpdate?: (text: string, isSpeaking: boolean) => void;

  constructor() {
    if ('speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
    }
  }

  isSupported(): boolean {
    return this.synthesis !== null;
  }

  async speak(
    text: string,
    onUpdate?: (currentText: string, speaking: boolean) => void,
    options?: {
      rate?: number;
      pitch?: number;
      volume?: number;
      voice?: SpeechSynthesisVoice;
    }
  ): Promise<void> {
    if (!this.isSupported()) {
      console.warn('Text-to-Speech is not supported in this browser');
      return Promise.resolve();
    }

    this.stop();

    return new Promise((resolve, reject) => {
      this.utterance = new SpeechSynthesisUtterance(text);
      this.onSpeakingUpdate = onUpdate;

      this.utterance.rate = options?.rate || 0.9;
      this.utterance.pitch = options?.pitch || 1.0;
      this.utterance.volume = options?.volume || 1.0;

      if (options?.voice) {
        this.utterance.voice = options.voice;
      } else {
        const voices = this.synthesis!.getVoices();
        const preferredVoice = voices.find(
          (voice) =>
            voice.lang.startsWith('en') &&
            (voice.name.includes('Google') || voice.name.includes('Female'))
        );
        if (preferredVoice) {
          this.utterance.voice = preferredVoice;
        }
      }

      this.utterance.onstart = () => {
        this.isSpeaking = true;
        if (this.onSpeakingUpdate) {
          this.onSpeakingUpdate(text, true);
        }
      };

      this.utterance.onend = () => {
        this.isSpeaking = false;
        if (this.onSpeakingUpdate) {
          this.onSpeakingUpdate(text, false);
        }
        resolve();
      };

      this.utterance.onerror = (event) => {
        this.isSpeaking = false;
        console.error('Speech synthesis error:', event);
        if (this.onSpeakingUpdate) {
          this.onSpeakingUpdate(text, false);
        }
        reject(event);
      };

      this.synthesis!.speak(this.utterance);
    });
  }

  pause(): void {
    if (this.synthesis && this.isSpeaking && !this.isPaused) {
      this.synthesis.pause();
      this.isPaused = true;
    }
  }

  resume(): void {
    if (this.synthesis && this.isSpeaking && this.isPaused) {
      this.synthesis.resume();
      this.isPaused = false;
    }
  }

  stop(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.isSpeaking = false;
      this.isPaused = false;
    }
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synthesis) return [];
    return this.synthesis.getVoices();
  }

  isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  isPausedState(): boolean {
    return this.isPaused;
  }
}

export const textToSpeechService = new TextToSpeechService();
