export class SpeechActivityDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private silenceTimer: NodeJS.Timeout | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private onSilenceCallback: ((duration: number) => void) | null = null;
  private onSpeechCallback: (() => void) | null = null;
  private silenceThreshold: number = 5000;
  private volumeThreshold: number = -50;
  private lastSpeechTime: number = 0;
  private isActive: boolean = false;
  private currentSilenceDuration: number = 0;

  async initialize(
    stream: MediaStream,
    options?: {
      silenceThreshold?: number;
      volumeThreshold?: number;
    }
  ): Promise<void> {
    try {
      this.silenceThreshold = options?.silenceThreshold || 5000;
      this.volumeThreshold = options?.volumeThreshold || -50;

      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;

      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.microphone.connect(this.analyser);

      this.lastSpeechTime = Date.now();
      this.isActive = true;
    } catch (error) {
      console.error('Failed to initialize speech activity detector:', error);
      throw error;
    }
  }

  start(
    onSilenceDetected: (duration: number) => void,
    onSpeechDetected: () => void
  ): void {
    if (!this.isActive || !this.analyser) {
      console.warn('Speech activity detector not initialized');
      return;
    }

    this.onSilenceCallback = onSilenceDetected;
    this.onSpeechCallback = onSpeechDetected;
    this.lastSpeechTime = Date.now();
    this.currentSilenceDuration = 0;

    this.checkInterval = setInterval(() => {
      this.checkAudioLevel();
    }, 100);
  }

  private checkAudioLevel(): void {
    if (!this.analyser || !this.isActive) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const decibels = 20 * Math.log10(average / 255);

    if (decibels > this.volumeThreshold) {
      this.lastSpeechTime = Date.now();
      this.currentSilenceDuration = 0;

      if (this.onSpeechCallback) {
        this.onSpeechCallback();
      }

      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    } else {
      const silenceDuration = Date.now() - this.lastSpeechTime;
      this.currentSilenceDuration = Math.floor(silenceDuration / 1000);

      if (silenceDuration >= this.silenceThreshold && !this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          if (this.onSilenceCallback) {
            this.onSilenceCallback(this.currentSilenceDuration);
          }
        }, 100);
      }
    }
  }

  getCurrentSilenceDuration(): number {
    if (!this.isActive) return 0;
    const silenceDuration = Date.now() - this.lastSpeechTime;
    return Math.floor(silenceDuration / 1000);
  }

  resetSilenceTimer(): void {
    this.lastSpeechTime = Date.now();
    this.currentSilenceDuration = 0;

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  stop(): void {
    this.isActive = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  cleanup(): void {
    this.stop();

    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.onSilenceCallback = null;
    this.onSpeechCallback = null;
  }

  isInitialized(): boolean {
    return this.isActive && this.analyser !== null;
  }
}

export const speechActivityDetector = new SpeechActivityDetector();
