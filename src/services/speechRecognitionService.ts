export class SpeechRecognitionService {
  private recognition: any = null;
  private isListening: boolean = false;
  private transcript: string = '';
  private onTranscriptUpdate?: (transcript: string) => void;
  private onEnd?: (finalTranscript: string) => void;
  private onError?: (error: string) => void;
  private autoRestart: boolean = false;
  private restartAttempts: number = 0;
  private maxRestartAttempts: number = 5;
  private baseRestartDelay: number = 1000;
  private consecutiveNetworkErrors: number = 0;
  private lastErrorTime: number = 0;
  private isRecovering: boolean = false;

  constructor() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.setupRecognition();
    }
  }

  private setupRecognition(): void {
    if (!this.recognition) return;

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      this.transcript += finalTranscript;
      const currentTranscript = this.transcript + interimTranscript;

      this.consecutiveNetworkErrors = 0;
      this.restartAttempts = 0;

      if (this.onTranscriptUpdate) {
        this.onTranscriptUpdate(currentTranscript);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);

      if (event.error === 'network') {
        this.consecutiveNetworkErrors++;
        const timeSinceLastError = Date.now() - this.lastErrorTime;
        this.lastErrorTime = Date.now();

        if (timeSinceLastError < 2000 && this.consecutiveNetworkErrors > 3) {
          console.error('Too many consecutive network errors, stopping auto-restart');
          this.autoRestart = false;
          this.isRecovering = false;
          if (this.onError) {
            this.onError('network-persistent-failure');
          }
          return;
        }

        if (this.autoRestart && this.restartAttempts < this.maxRestartAttempts && !this.isRecovering) {
          this.isRecovering = true;
          this.restartAttempts++;
          const exponentialDelay = this.baseRestartDelay * Math.pow(2, this.restartAttempts - 1);
          const maxDelay = 8000;
          const delay = Math.min(exponentialDelay, maxDelay);

          console.warn(`Network error in speech recognition. Retry ${this.restartAttempts}/${this.maxRestartAttempts} in ${delay}ms...`);

          setTimeout(() => {
            if (this.autoRestart && !this.isListening) {
              try {
                console.log(`Attempting speech recognition restart (${this.restartAttempts}/${this.maxRestartAttempts})`);
                this.recognition.start();
                this.isListening = true;
                this.isRecovering = false;
              } catch (restartError) {
                console.error('Failed to restart speech recognition:', restartError);
                this.isRecovering = false;
                if (this.onError && this.restartAttempts >= this.maxRestartAttempts) {
                  this.onError('network-restart-failed');
                }
              }
            } else {
              this.isRecovering = false;
            }
          }, delay);
        } else if (this.restartAttempts >= this.maxRestartAttempts) {
          console.error('Max restart attempts reached for network errors');
          this.autoRestart = false;
          if (this.onError) {
            this.onError('network-max-retries-exceeded');
          }
        }
      } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.autoRestart = false;
        if (this.onError) {
          this.onError('microphone-permission-denied');
        }
      } else if (event.error === 'aborted') {
        console.log('Speech recognition aborted (expected)');
      } else {
        if (this.onError) {
          this.onError(event.error);
        }
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;

      if (this.autoRestart && this.restartAttempts < this.maxRestartAttempts && !this.isRecovering) {
        console.log('Speech recognition ended, attempting auto-restart...');
        setTimeout(() => {
          if (this.autoRestart && !this.isListening) {
            try {
              this.recognition.start();
              this.isListening = true;
              this.consecutiveNetworkErrors = 0;
            } catch (error: any) {
              console.error('Failed to auto-restart speech recognition:', error);
              if (error.message && error.message.includes('already started')) {
                this.isListening = true;
              }
            }
          }
        }, 300);
      } else if (this.onEnd) {
        this.onEnd(this.transcript);
      }
    };
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }

  async startListening(
    onUpdate: (transcript: string) => void,
    onComplete: (transcript: string) => void,
    onErrorCallback: (error: string) => void,
    enableAutoRestart: boolean = true
  ): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('Speech recognition is not supported in this browser');
    }

    if (this.isListening) {
      console.warn('Speech recognition is already listening');
      return;
    }

    this.transcript = '';
    this.onTranscriptUpdate = onUpdate;
    this.onEnd = onComplete;
    this.onError = onErrorCallback;
    this.autoRestart = enableAutoRestart;
    this.restartAttempts = 0;

    try {
      this.recognition.start();
      this.isListening = true;
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      throw error;
    }
  }

  stopListening(): string {
    if (!this.isListening) {
      return this.transcript;
    }

    this.autoRestart = false;

    if (this.recognition) {
      this.recognition.stop();
    }

    this.isListening = false;
    return this.transcript;
  }

  getCurrentTranscript(): string {
    return this.transcript;
  }

  reset(): void {
    this.transcript = '';
    this.isListening = false;
    this.autoRestart = false;
    this.restartAttempts = 0;
    this.consecutiveNetworkErrors = 0;
    this.lastErrorTime = 0;
    this.isRecovering = false;
    this.onTranscriptUpdate = undefined;
    this.onEnd = undefined;
    this.onError = undefined;
  }

  async transcribeAudioBlob(audioBlob: Blob): Promise<string> {
    console.log('Audio blob transcription requested. Size:', audioBlob.size);

    if (audioBlob.size === 0) {
      throw new Error('Audio blob is empty');
    }

    const currentTranscript = this.getCurrentTranscript();
    if (currentTranscript && currentTranscript.trim().length > 0) {
      return currentTranscript;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(this.transcript || 'Unable to transcribe audio. Please ensure microphone permission is granted.');
      };
      reader.onerror = () => {
        reject(new Error('Failed to read audio blob'));
      };
      reader.readAsArrayBuffer(audioBlob);
    });
  }
}

export const speechRecognitionService = new SpeechRecognitionService();
