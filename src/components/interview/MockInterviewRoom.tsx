import React, { useState, useEffect, useRef } from 'react';
import { Video, Mic, MicOff, Volume2, AlertTriangle, SkipForward, Loader2 } from 'lucide-react';
import { InterviewConfig, InterviewQuestion, MockInterviewSession } from '../../types/interview';
import { UserResume } from '../../types/resumeInterview';
import { interviewService } from '../../services/interviewService';
import { interviewFeedbackService } from '../../services/interviewFeedbackService';
import { hybridQuestionService } from '../../services/hybridQuestionService';
import { speechRecognitionService } from '../../services/speechRecognitionService';
import { textToSpeechService } from '../../services/textToSpeechService';
import { speechActivityDetector } from '../../services/speechActivityDetector';
import { useFullScreenMonitor } from '../../hooks/useFullScreenMonitor';
import { useTabSwitchDetector } from '../../hooks/useTabSwitchDetector';
import { SimplifiedInterviewHeader } from './SimplifiedInterviewHeader';
import { supabase } from '../../lib/supabaseClient';

interface MockInterviewRoomProps {
  config: InterviewConfig;
  userId: string;
  userName: string;
  resume: UserResume;
  onInterviewComplete: (sessionId: string) => void;
  onBack: () => void;
}

type InterviewStage = 'loading' | 'ready' | 'question' | 'listening' | 'processing' | 'feedback' | 'completed';

export const MockInterviewRoom: React.FC<MockInterviewRoomProps> = ({
  config,
  userId,
  userName,
  resume,
  onInterviewComplete,
  onBack
}) => {
  const [stage, setStage] = useState<InterviewStage>('loading');
  const [session, setSession] = useState<MockInterviewSession | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(config.durationMinutes * 60);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Initializing interview...');
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [aiCurrentText, setAiCurrentText] = useState('');
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [violationMessage, setViolationMessage] = useState('');
  const [silenceCountdown, setSilenceCountdown] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [showAutoSubmitInfo, setShowAutoSubmitInfo] = useState(true);
  
  // New state for improved auto-submit
  const [hasStartedSpeaking, setHasStartedSpeaking] = useState(false);
  const [minimumSpeechDuration, setMinimumSpeechDuration] = useState(0);
  // Track total violations for live popup/header
  const [violationCount, setViolationCount] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const silenceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSubmitTriggeredRef = useRef<boolean>(false);
  // New refs to prevent background actions after ending
  const isEndingRef = useRef<boolean>(false);
  const startListeningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const moveNextTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fullScreen = useFullScreenMonitor({
    onFullScreenExit: () => {
      setViolationMessage('⚠️ You exited full-screen mode. Please return to full-screen to continue.');
      setShowViolationWarning(true);
      setViolationCount((v) => v + 1);
      handlePauseInterview();
    },
    onViolation: (type) => {
      console.log('Full-screen violation:', type);
    },
  });

  const tabDetector = useTabSwitchDetector({
    onTabSwitch: () => {
      setViolationMessage('⚠️ You switched tabs. Please stay on this page during the interview.');
      setShowViolationWarning(true);
      setViolationCount((v) => v + 1);
      handlePauseInterview();
    },
    onWindowBlur: () => {
      setViolationMessage('⚠️ You switched to another application. Please stay focused on the interview.');
      setShowViolationWarning(true);
      handlePauseInterview();
    },
    onViolation: (type, duration) => {
      console.log(`Violation: ${type}, Duration: ${duration}s`);
    },
  });

  const currentQuestion = questions[currentQuestionIndex];

  useEffect(() => {
    initializeInterview();
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (stage === 'listening' && !isPaused) {
      silenceCheckIntervalRef.current = setInterval(() => {
        if (speechActivityDetector.isInitialized()) {
          const currentSilence = speechActivityDetector.getCurrentSilenceDuration();
          // Mark speaking false when any silence persists
          if (currentSilence > 0) {
            setIsSpeaking(false);
          }
          const countdown = Math.max(0, 5 - currentSilence); // CHANGED: 10 to 5 seconds
          setSilenceCountdown(countdown);

          // Auto-submit after 5s of silence
          if (countdown === 0 && !autoSubmitTriggeredRef.current) {
            autoSubmitTriggeredRef.current = true;
            handleAutoSubmit();
          }
        }
      }, 100);
    } else {
      if (silenceCheckIntervalRef.current) {
        clearInterval(silenceCheckIntervalRef.current);
        silenceCheckIntervalRef.current = null;
      }
    }

    return () => {
      if (silenceCheckIntervalRef.current) {
        clearInterval(silenceCheckIntervalRef.current);
      }
    };
  }, [stage, isPaused, hasStartedSpeaking, minimumSpeechDuration]);

  // Ensure video element attaches to the stream whenever the stage changes to a view where it's rendered
  useEffect(() => {
    const attach = async () => {
      if (videoRef.current && videoStreamRef.current) {
        if (videoRef.current.srcObject !== videoStreamRef.current) {
          videoRef.current.srcObject = videoStreamRef.current;
        }
        try {
          if (videoRef.current.readyState >= 2) {
            await videoRef.current.play();
          } else {
            await new Promise<void>((resolve) => {
              if (!videoRef.current) return resolve();
              videoRef.current.onloadedmetadata = () => resolve();
            });
            if (videoRef.current) {
              await videoRef.current.play();
            }
          }
        } catch (err) {
          console.error('Error ensuring video playback:', err);
        }
      }
    };
    attach();
  }, [stage]);

  useEffect(() => {
    if (!isPaused && stage === 'listening') {
      timerIntervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleEndInterview();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isPaused, stage]);

  const initializeInterview = async () => {
    try {
      setStatusMessage('Setting up interview session...');

      const newSession = await interviewService.createSession(config, userId, resume);
      setSession(newSession);

      setStatusMessage('Analyzing your resume and selecting personalized questions...');

      const loadedQuestions = await hybridQuestionService.selectQuestionsForInterview(
        config,
        resume,
        10
      );

      if (loadedQuestions.length === 0) {
        throw new Error('No questions available for this configuration');
      }

      setQuestions(loadedQuestions);
      setStatusMessage('Requesting camera and microphone access...');

      await requestMediaPermissions();

      setStage('ready');
      setStatusMessage('Ready to start interview');
    } catch (error) {
      console.error('Error initializing interview:', error);
      alert(`Failed to initialize interview: ${(error as Error).message}`);
      onBack();
    }
  };

  const requestMediaPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      videoStreamRef.current = stream;
      setIsMicrophoneEnabled(true);

      // FIXED: Better video attachment with delay
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for metadata to load
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              resolve();
            };
          }
        });

        // Small delay before playing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Play the video
        try {
          await videoRef.current.play();
          console.log('Video playback started successfully');
        } catch (playError) {
          console.error('Error playing video:', playError);
        }
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
      setIsMicrophoneEnabled(false);
      alert('Camera/microphone access denied. You can continue, but your responses will not be recorded.');
    }
  };

  const startQuestion = async () => {
    await fullScreen.requestFullScreen();

    setStage('question');
    setStatusMessage(`Question ${currentQuestionIndex + 1} of ${questions.length}`);
    setCurrentTranscript('');

    if (currentQuestion && textToSpeechService.isSupported()) {
      try {
        await textToSpeechService.speak(
          currentQuestion.question_text,
          (text, speaking) => {
            setAiSpeaking(speaking);
            setAiCurrentText(speaking ? text : '');
          },
          { rate: 0.9, pitch: 1.0 }
        );
      } catch (error) {
        console.error('Error with text-to-speech:', error);
      }
    }

    // Start listening shortly after TTS prompt
    if (startListeningTimeoutRef.current) clearTimeout(startListeningTimeoutRef.current);
    startListeningTimeoutRef.current = setTimeout(() => {
      if (!isEndingRef.current) startListening();
    }, 500);
  };

  const startListening = async () => {
    if (isEndingRef.current) return;
    setStage('listening');
    setStatusMessage('Listening to your answer...');
    startTimeRef.current = Date.now();

    if (isMicrophoneEnabled && videoStreamRef.current) {
      try {
        audioChunksRef.current = [];

        const options: MediaRecorderOptions = { mimeType: 'video/webm;codecs=vp8,opus' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = 'video/webm';
        }

        const mediaRecorder = new MediaRecorder(videoStreamRef.current, options);

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.start(1000);
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
      } catch (error) {
        console.error('Error starting media recorder:', error);
      }
    }

    if (speechRecognitionService.isSupported()) {
      try {
        await speechRecognitionService.startListening(
          (transcript) => setCurrentTranscript(transcript),
          (finalTranscript) => setCurrentTranscript(finalTranscript),
          (error) => console.error('Speech recognition error:', error)
        );
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
      }
    }

    if (videoStreamRef.current) {
      try {
        await speechActivityDetector.initialize(videoStreamRef.current, {
          silenceThreshold: 5000, // 5 seconds of continuous silence
          adaptive: true,         // calibrate to room noise
          calibrationMs: 1000,    // 1s baseline noise sample
          minSpeechMs: 250,       // require ~250ms of speech to count
          hangoverMs: 300,        // keep speaking for 300ms after drop
          rmsMultiplier: 2.8,     // speech must be ~2.8x baseline RMS
          absoluteRmsFloor: 0.035 // never count super-low noise as speech
        });

        speechActivityDetector.start(
          (duration) => {
            console.log('Silence detected for', duration, 'seconds');
          },
          () => {
            setIsSpeaking(true);
            if (!hasStartedSpeaking) {
              setHasStartedSpeaking(true);
            }
            setMinimumSpeechDuration(prev => prev + 0.1);
          }
        );
      } catch (error) {
        console.error('Failed to start silence detection:', error);
      }
    }

    autoSubmitTriggeredRef.current = false;
    setAutoSubmitted(false);
    setHasStartedSpeaking(false); // Reset for each question
    setMinimumSpeechDuration(0);
  };

  const stopListening = async (isAutoSubmit: boolean = false) => {
    const responseDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const silenceDuration = isAutoSubmit ? speechActivityDetector.getCurrentSilenceDuration() : 0;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    if (speechRecognitionService.isSupported()) {
      speechRecognitionService.stopListening();
    }

    speechActivityDetector.stop();

    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
      silenceCheckIntervalRef.current = null;
    }

    setStage('processing');
    setStatusMessage(isAutoSubmit ? 'Auto-submitting your answer...' : 'Processing your answer...');

    await processAnswer(responseDuration, isAutoSubmit, silenceDuration);
  };

  const handleAutoSubmit = async () => {
    setAutoSubmitted(true);
    await stopListening(true);
  };

  const handleSkipQuestion = async () => {
    if (isSkipping) return;

    setIsSkipping(true);
    setStatusMessage('Skipping question...');

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    if (speechRecognitionService.isSupported()) {
      speechRecognitionService.stopListening();
    }

    speechActivityDetector.stop();

    if (session && currentQuestion) {
      try {
        const { data: sessionData } = await supabase
          .from('mock_interview_sessions')
          .select('skipped_questions, skip_count')
          .eq('id', session.id)
          .maybeSingle();

        const skippedQuestions = sessionData?.skipped_questions || [];
        const skipCount = (sessionData?.skip_count || 0) + 1;

        await supabase
          .from('mock_interview_sessions')
          .update({
            skipped_questions: [...skippedQuestions, currentQuestion.id],
            skip_count: skipCount
          })
          .eq('id', session.id);

        await interviewService.saveResponse(
          session.id,
          currentQuestion.id,
          currentQuestionIndex + 1,
          {
            userAnswerText: '[Question Skipped]',
            audioTranscript: '[Question Skipped]',
            aiFeedback: {
              score: 0,
              feedback: 'Question was skipped by the user.',
              strengths: [],
              improvements: [],
              tone_confidence_rating: 'N/A'
            },
            individualScore: 0,
            responseDuration: 0
          }
        );
      } catch (error) {
        console.error('Error saving skipped question:', error);
      }
    }

    setTimeout(() => {
      setIsSkipping(false);
      moveToNextQuestion();
    }, 1000);
  };

  const processAnswer = async (responseDuration: number, isAutoSubmit: boolean = false, silenceDuration: number = 0) => {
    try {
      if (!session || !currentQuestion) return;

      const transcript = currentTranscript || 'No answer provided';

      setStatusMessage('Analyzing your answer with AI...');
      const feedback = await interviewFeedbackService.analyzeAnswer(
        currentQuestion.question_text,
        transcript,
        currentQuestion.category,
        currentQuestion.difficulty
      );

      setStatusMessage('Saving your response...');

      const responseData: any = {
        userAnswerText: transcript,
        audioTranscript: transcript,
        aiFeedback: feedback,
        individualScore: feedback.score,
        toneRating: feedback.tone_confidence_rating,
        confidenceRating: feedback.score,
        responseDuration: responseDuration
      };

      const { data, error } = await supabase
        .from('interview_responses')
        .insert({
          session_id: session.id,
          question_id: currentQuestion.id,
          question_order: currentQuestionIndex + 1,
          user_answer_text: responseData.userAnswerText,
          audio_transcript: responseData.audioTranscript,
          ai_feedback_json: responseData.aiFeedback,
          individual_score: responseData.individualScore,
          tone_rating: responseData.toneRating,
          confidence_rating: responseData.confidenceRating,
          response_duration_seconds: responseData.responseDuration,
          auto_submitted: isAutoSubmit,
          silence_duration: silenceDuration
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving response:', error);
      }

      setStage('feedback');
      setStatusMessage('Feedback generated');

      if (moveNextTimeoutRef.current) clearTimeout(moveNextTimeoutRef.current);
      // Shorter feedback delay for faster flow
      moveNextTimeoutRef.current = setTimeout(() => {
        if (!isEndingRef.current) moveToNextQuestion();
      }, 1200);
    } catch (error) {
      console.error('Error processing answer:', error);
      alert('Failed to process answer. Moving to next question.');
      moveToNextQuestion();
    }
  };

  const moveToNextQuestion = async () => {
    if (isEndingRef.current) return;
    speechRecognitionService.reset();
    setCurrentTranscript('');

    if (currentQuestionIndex + 1 < questions.length) {
      setCurrentQuestionIndex(prev => prev + 1);
      setStage('question');

      const nextQuestion = questions[currentQuestionIndex + 1];
      if (nextQuestion && textToSpeechService.isSupported()) {
        try {
          await textToSpeechService.speak(
            nextQuestion.question_text,
            (text, speaking) => {
              setAiSpeaking(speaking);
              setAiCurrentText(speaking ? text : '');
            },
            { rate: 0.9, pitch: 1.0 }
          );
        } catch (error) {
          console.error('Error with text-to-speech:', error);
        }
      }

      if (startListeningTimeoutRef.current) clearTimeout(startListeningTimeoutRef.current);
      startListeningTimeoutRef.current = setTimeout(() => {
        if (!isEndingRef.current) startListening();
      }, 500);
    } else {
      completeInterview();
    }
  };

  const completeInterview = async () => {
    setStage('completed');
    setStatusMessage('Completing interview...');

    if (session) {
      const actualDuration = config.durationMinutes * 60 - timeRemaining;
      const overallScore = await interviewService.calculateOverallScore(session.id);

      await interviewService.updateSessionWithSecurity(
        session.id,
        'completed',
        overallScore,
        actualDuration,
        {
          tabSwitchCount: tabDetector.tabSwitchCount,
          fullScreenExits: fullScreen.violations,
          totalViolationTime: tabDetector.totalTimeAway,
          violationsLog: tabDetector.violations
        }
      );

      fullScreen.exitFullScreen();
      onInterviewComplete(session.id);
    }
  };

  const handlePauseInterview = () => {
    setIsPaused(true);
    if (stage === 'listening') {
      if (speechRecognitionService.isSupported()) {
        speechRecognitionService.stopListening();
      }
    }
    textToSpeechService.pause();
  };

  const handleResumeInterview = () => {
    setIsPaused(false);
    setShowViolationWarning(false);
    textToSpeechService.resume();

    if (!fullScreen.isFullScreen) {
      fullScreen.requestFullScreen();
    }
  };

  const handlePause = () => {
    if (isPaused) {
      handleResumeInterview();
    } else {
      handlePauseInterview();
    }
  };

  const handleEndInterview = async () => {
    if (window.confirm('End interview now and view your report? Your progress so far will be analyzed.')) {
      // Mark ending state to prevent any pending timeouts from firing
      isEndingRef.current = true;
      // Stop media and timers first
      cleanup();
      // Finalize the session and navigate to the summary report
      await completeInterview();
    }
  };

  const cleanup = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => track.stop());
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
    }

    if (startListeningTimeoutRef.current) {
      clearTimeout(startListeningTimeoutRef.current);
      startListeningTimeoutRef.current = null;
    }

    if (moveNextTimeoutRef.current) {
      clearTimeout(moveNextTimeoutRef.current);
      moveNextTimeoutRef.current = null;
    }

    speechActivityDetector.cleanup();
    textToSpeechService.stop();
    speechRecognitionService.reset();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalViolations = violationCount;

  if (stage === 'loading') {
    return (
      <div className="min-h-screen bg-dark-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-300 text-lg">{statusMessage}</p>
        </div>
      </div>
    );
  }

  if (stage === 'ready') {
    return (
      <div className="min-h-screen bg-dark-100 flex items-center justify-center p-4">
        <div className="bg-dark-200 rounded-2xl p-8 max-w-2xl w-full text-center">
          <h2 className="text-3xl font-bold text-gray-100 mb-4">Ready to Start?</h2>
          <p className="text-gray-400 mb-6">
            You will answer {questions.length} questions in {config.durationMinutes} minutes.
            Take your time and speak clearly.
          </p>
          <div className="bg-dark-300 rounded-lg p-4 mb-6 space-y-2">
            <p className="text-gray-300 text-sm">
              {isMicrophoneEnabled ? '✓ Camera and microphone are ready' : '⚠ Media devices not available'}
            </p>
            <p className="text-gray-300 text-sm">
              {textToSpeechService.isSupported() ? '✓ AI voice enabled' : '⚠ Text-to-speech not available'}
            </p>
            <p className="text-gray-300 text-sm">
              ✓ Full-screen security mode will be enabled
            </p>
          </div>
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-6 text-left">
            <h3 className="text-yellow-400 font-semibold mb-2">⚠️ Important Guidelines:</h3>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• The interview will run in full-screen mode</li>
              <li>• Do not switch tabs or minimize the window</li>
              <li>• Do not open other applications</li>
              <li>• Violations will be tracked and reported</li>
              <li>• Answers auto-submit after 5 seconds of silence</li>
            </ul>
          </div>
          <button
            onClick={startQuestion}
            className="btn-primary px-8 py-4 text-lg"
          >
            Start Interview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-100 flex flex-col">
      {showViolationWarning && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-dark-200 rounded-2xl p-8 max-w-md w-full border-2 border-red-500">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <h3 className="text-xl font-bold text-red-400">Interview Paused</h3>
            </div>
            <p className="text-gray-300 mb-6">{violationMessage}</p>
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 mb-6">
              <p className="text-red-300 text-sm">
                <strong>Violations Detected:</strong> {totalViolations}
              </p>
              <p className="text-red-300 text-sm mt-1">
                <strong>Time Away:</strong> {tabDetector.totalTimeAway}s
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={handleResumeInterview}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Return to Interview
              </button>
              <button
                onClick={handleEndInterview}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                End Interview & View Report
              </button>
            </div>
          </div>
        </div>
      )}

      <SimplifiedInterviewHeader
        userName={userName}
        timeRemaining={timeRemaining}
        currentQuestionIndex={currentQuestionIndex}
        totalQuestions={questions.length}
        isPaused={isPaused}
        totalViolations={totalViolations}
        isFullScreen={fullScreen.isFullScreen}
        onPause={handlePause}
        onEnd={handleEndInterview}
        onEnterFullScreen={fullScreen.requestFullScreen}
      />

      <div className="flex-1 mt-20 pt-8 pb-20">
        {/* CHANGED: Better grid layout for center focus */}
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-[300px_1fr_350px] gap-6 h-full">
          <div className="bg-dark-200 rounded-xl p-6 flex items-center justify-center">
            <div className="text-center">
              <div className={`w-32 h-32 rounded-full mx-auto mb-4 flex items-center justify-center transition-all ${
                aiSpeaking
                  ? 'bg-gradient-to-br from-blue-500 to-purple-600 animate-pulse'
                  : 'bg-gradient-to-br from-blue-500/50 to-purple-600/50'
              }`}>
                <span className="text-4xl">🤖</span>
              </div>
              <p className="text-gray-400 text-sm mb-2">AI Interviewer</p>
              {aiSpeaking && (
                <div className="flex items-center justify-center gap-2 text-blue-400">
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  <span className="text-xs">Speaking...</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-dark-200 rounded-xl p-8 flex flex-col justify-center">
            {currentQuestion && (
              <div>
                <div className="text-sm text-blue-400 mb-4">
                  {currentQuestion.category} • {currentQuestion.difficulty}
                </div>
                <h3 className="text-3xl font-bold text-gray-100 mb-6 leading-relaxed">
                  {currentQuestion.question_text}
                </h3>

                {aiSpeaking && aiCurrentText && (
                  <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Volume2 className="w-4 h-4 text-blue-400" />
                      <span className="text-blue-400 text-sm">AI is speaking:</span>
                    </div>
                    <p className="text-gray-300 text-sm italic">{aiCurrentText}</p>
                  </div>
                )}

                {stage === 'listening' && (
                  <div className="space-y-4">
                    {showAutoSubmitInfo && (
                      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-4">
                        <div className="flex items-start gap-3">
                          <div className="text-blue-300 text-sm flex-1">
                            <strong className="text-blue-200 text-base">📌 Auto-Submit Info:</strong>
                            <p className="mt-1">Your answer will automatically submit after <strong>5 seconds</strong> of silence.</p>
                          </div>
                          <button
                            onClick={() => setShowAutoSubmitInfo(false)}
                            className="text-blue-400 hover:text-blue-300 text-lg font-bold leading-none"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="bg-dark-300 rounded-lg p-4 min-h-[100px] max-h-[200px] overflow-y-auto">
                      <p className="text-gray-300 text-sm">
                        {currentTranscript || 'Start speaking...'}
                      </p>
                    </div>

                    {/* CHANGED: Countdown now shows for 5 seconds instead of 10 */}
                    {silenceCountdown <= 5 && silenceCountdown > 0 && (
                      <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-yellow-400 text-sm">Auto-submitting in:</span>
                          <span className="text-yellow-400 font-mono font-bold text-lg">{silenceCountdown}s</span>
                        </div>
                        <div className="mt-2 w-full bg-dark-400 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-yellow-400 h-full transition-all duration-1000"
                            style={{ width: `${(silenceCountdown / 5) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => stopListening(false)}
                        className="flex-1 btn-primary py-3"
                        disabled={autoSubmitted}
                      >
                        Submit Answer
                      </button>
                      <button
                        onClick={handleSkipQuestion}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors"
                        disabled={isSkipping}
                      >
                        {isSkipping ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Skipping...</span>
                          </>
                        ) : (
                          <>
                            <SkipForward className="w-4 h-4" />
                            <span className="text-sm">Skip</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-center gap-3 py-2">
                      {isSpeaking ? (
                        <div className="flex items-center gap-2 text-green-400 text-sm font-semibold">
                          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                          <span>🎤 Speaking...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-gray-500 text-sm">
                          <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                          <span>Waiting for speech...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {stage === 'processing' && (
                  <div className="text-center">
                    <div className="animate-pulse text-blue-400 mb-2">Processing...</div>
                    <p className="text-gray-400 text-sm">Analyzing your response</p>
                  </div>
                )}

                {stage === 'feedback' && (
                  <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                    <p className="text-green-400">✓ Answer recorded successfully!</p>
                    <p className="text-gray-400 text-sm mt-2">Moving to next question...</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CHANGED: Larger video panel with better sizing */}
          <div className="bg-dark-200 rounded-xl p-6 flex flex-col">
            <div className="text-gray-400 text-sm mb-4">Your Camera</div>
            <div className="flex-1 bg-dark-300 rounded-lg overflow-hidden relative" style={{ minHeight: '400px' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover min-h-[400px]"
              />
              {!isMicrophoneEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-dark-400">
                  <div className="text-center">
                    <Video className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Camera not available</p>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              {isRecording ? (
                <>
                  <Mic className="w-5 h-5 text-red-500 animate-pulse" />
                  <span className="text-red-500 text-sm font-semibold">Recording</span>
                </>
              ) : (
                <>
                  <MicOff className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-500 text-sm">Not Recording</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-dark-200 border-t border-dark-300 py-3">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-400">
          {statusMessage}
        </div>
      </div>
    </div>
  );
};
