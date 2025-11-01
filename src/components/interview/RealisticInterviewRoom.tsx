import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  AlertTriangle,
  SkipForward,
  Loader2,
  Video,
  Mic,
  MicOff,
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  Code,
  MessageSquare
} from 'lucide-react';
import { InterviewConfig } from '../../types/interview';
import { UserResume } from '../../types/resumeInterview';
import {
  realisticInterviewService,
  InterviewQuestion,
  QuestionResponse,
  FollowUpQuestion
} from '../../services/realisticInterviewService';
import { codeCompilerService, TestCase, ExecutionResult } from '../../services/codeCompilerService';
import { speechRecognitionService } from '../../services/speechRecognitionService';
import { textToSpeechService } from '../../services/textToSpeechService';
import { speechActivityDetector } from '../../services/speechActivityDetector';
import { useFullScreenMonitor } from '../../hooks/useFullScreenMonitor';
import { useTabSwitchDetector } from '../../hooks/useTabSwitchDetector';
import { SimplifiedInterviewHeader } from './SimplifiedInterviewHeader';
import { EnhancedCodeEditor } from './EnhancedCodeEditor';
import { TestCaseAccordion } from './TestCaseAccordion';
import { VoiceActivityIndicator } from './VoiceActivityIndicator';
import { TranscriptDisplay } from './TranscriptDisplay';
import { QuestionCard } from './QuestionCard';
import { SessionRecoveryModal } from './SessionRecoveryModal';
import { interviewSessionPersistence, InterviewSessionState } from '../../services/interviewSessionPersistence';
import { supabase } from '../../lib/supabaseClient';

interface RealisticInterviewRoomProps {
  config: InterviewConfig;
  resume: UserResume;
  userId: string;
  userName: string;
  onInterviewComplete: (sessionId: string) => void;
  onBack: () => void;
}

type InterviewStage = 'loading' | 'ready' | 'question' | 'listening' | 'processing' | 'feedback' | 'code_review' | 'follow_up';

export const RealisticInterviewRoom: React.FC<RealisticInterviewRoomProps> = ({
  config,
  resume,
  userId,
  userName,
  onInterviewComplete,
  onBack
}) => {
  const [stage, setStage] = useState<InterviewStage>('loading');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const [currentTranscript, setCurrentTranscript] = useState('');
  const [verbalAnswer, setVerbalAnswer] = useState('');
  const [codeAnswer, setCodeAnswer] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('Python');

  const [isRecording, setIsRecording] = useState(false);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [aiCurrentText, setAiCurrentText] = useState('');

  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [violationMessage, setViolationMessage] = useState('');
  const [violationCount, setViolationCount] = useState(0);
  const [silenceCountdown, setSilenceCountdown] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [showAutoSubmitInfo, setShowAutoSubmitInfo] = useState(true);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryData, setRecoveryData] = useState<InterviewSessionState | null>(null);
  const [hasStartedSpeaking, setHasStartedSpeaking] = useState(false);

  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState<FollowUpQuestion | null>(null);
  const [followUpAnswer, setFollowUpAnswer] = useState('');

  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [showTestResults, setShowTestResults] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const [codeReviewMode, setCodeReviewMode] = useState(false);
  const [codeReviewQuestions, setCodeReviewQuestions] = useState<string[]>([]);
  const [currentReviewQuestion, setCurrentReviewQuestion] = useState(0);
  const [reviewAnswer, setReviewAnswer] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const silenceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSubmitTriggeredRef = useRef<boolean>(false);
  const isEndingRef = useRef<boolean>(false);
  const startListeningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const moveNextTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartTimeRef = useRef<number>(Date.now());

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
    checkForRecoverableSession();
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (sessionId && stage !== 'loading' && stage !== 'ready') {
      const getState = (): InterviewSessionState => ({
        sessionId,
        userId,
        currentQuestionIndex,
        totalQuestions: questions.length,
        timeRemaining,
        currentTranscript,
        textAnswer: verbalAnswer,
        codeAnswer,
        selectedLanguage,
        questionsAnswered: currentQuestionIndex,
        questionsSkipped: 0,
        lastSaved: new Date().toISOString(),
        interviewType: 'realistic'
      });

      interviewSessionPersistence.startAutoSave(getState);

      return () => {
        interviewSessionPersistence.stopAutoSave();
      };
    }
  }, [sessionId, stage, currentQuestionIndex, timeRemaining, currentTranscript, verbalAnswer, codeAnswer]);

  useEffect(() => {
    if (stage === 'listening' && !isPaused && !currentQuestion?.requires_coding) {
      silenceCheckIntervalRef.current = setInterval(() => {
        if (speechActivityDetector.isInitialized()) {
          const currentSilence = speechActivityDetector.getCurrentSilenceDuration();
          if (currentSilence > 0) {
            setIsSpeaking(false);
          }
          const countdown = Math.max(0, 5 - currentSilence);
          setSilenceCountdown(countdown);

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
  }, [stage, isPaused, currentQuestion]);

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

  const checkForRecoverableSession = async () => {
    const recoverable = await interviewSessionPersistence.checkForRecoverableSession(userId, 'realistic');
    if (recoverable) {
      setRecoveryData(recoverable);
      setShowRecoveryModal(true);
    } else {
      initializeInterview();
    }
  };

  const handleRecoverSession = async () => {
    if (!recoveryData) return;

    try {
      setShowRecoveryModal(false);
      setStage('loading');

      const loadedQuestions = await realisticInterviewService.generateInterviewQuestions(config, resume);
      setQuestions(loadedQuestions);
      setSessionId(recoveryData.sessionId);
      setCurrentQuestionIndex(recoveryData.currentQuestionIndex);
      setTimeRemaining(recoveryData.timeRemaining);
      setCurrentTranscript(recoveryData.currentTranscript);
      setVerbalAnswer(recoveryData.textAnswer);
      setCodeAnswer(recoveryData.codeAnswer);
      setSelectedLanguage(recoveryData.selectedLanguage);

      await requestMediaPermissions();
      setStage('question');
      setTimeout(() => startListening(), 1000);
    } catch (error) {
      console.error('Error recovering session:', error);
      initializeInterview();
    }
  };

  const handleStartNewSession = () => {
    if (recoveryData) {
      interviewSessionPersistence.clearSessionState(recoveryData.sessionId);
    }
    setShowRecoveryModal(false);
    initializeInterview();
  };

  const initializeInterview = async () => {
    try {
      setStage('loading');

      const loadedQuestions = await realisticInterviewService.generateInterviewQuestions(config, resume);
      if (loadedQuestions.length === 0) {
        throw new Error('No questions available for this configuration');
      }
      setQuestions(loadedQuestions);

      const newSessionId = await realisticInterviewService.createInterviewSession(userId, config, resume.id);
      setSessionId(newSessionId);

      setTimeRemaining(config.durationMinutes * 60);

      await requestMediaPermissions();

      setStage('ready');
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

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              resolve();
            };
          }
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        try {
          await videoRef.current.play();
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

    if (startListeningTimeoutRef.current) clearTimeout(startListeningTimeoutRef.current);
    startListeningTimeoutRef.current = setTimeout(() => {
      if (!isEndingRef.current) startListening();
    }, 500);
  };

  const startListening = async () => {
    if (isEndingRef.current) return;
    setStage('listening');
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

    if (videoStreamRef.current && !currentQuestion?.requires_coding) {
      try {
        await speechActivityDetector.initialize(videoStreamRef.current, {
          silenceThreshold: 5000,
          adaptive: true,
          calibrationMs: 1000,
          minSpeechMs: 250,
          hangoverMs: 300,
          rmsMultiplier: 2.8,
          absoluteRmsFloor: 0.035
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
          }
        );
      } catch (error) {
        console.error('Failed to start silence detection:', error);
      }
    }

    autoSubmitTriggeredRef.current = false;
    setAutoSubmitted(false);
    setHasStartedSpeaking(false);
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
    setVerbalAnswer(currentTranscript);

    await processAnswer(responseDuration, isAutoSubmit, silenceDuration);
  };

  const handleAutoSubmit = async () => {
    setAutoSubmitted(true);
    await stopListening(true);
  };

  const handleSkipQuestion = async () => {
    if (isSkipping) return;

    setIsSkipping(true);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    if (speechRecognitionService.isSupported()) {
      speechRecognitionService.stopListening();
    }

    speechActivityDetector.stop();

    if (sessionId && currentQuestion) {
      try {
        await realisticInterviewService.saveQuestionResponse(
          sessionId,
          currentQuestion,
          {
            question_id: currentQuestion.id,
            answer_text: '[Question Skipped]',
            time_spent_seconds: 0
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

  const executeCode = async () => {
    if (!codeAnswer.trim()) {
      alert('Please write some code first');
      return;
    }

    setIsExecuting(true);
    setShowTestResults(true);

    try {
      if (testCases.length === 0) {
        const cases = await codeCompilerService.generateTestCases(
          currentQuestion.question_text,
          selectedLanguage
        );
        setTestCases(cases);
      }

      const result = await codeCompilerService.executeCode(
        codeAnswer,
        selectedLanguage,
        testCases
      );

      if (result.success && result.executionResults) {
        setExecutionResults(result.executionResults);
      } else {
        alert(result.error || 'Execution failed');
      }
    } catch (error) {
      console.error('Execution error:', error);
      alert('Failed to execute code');
    } finally {
      setIsExecuting(false);
    }
  };

  const processAnswer = async (responseDuration: number, isAutoSubmit: boolean = false, silenceDuration: number = 0) => {
    try {
      if (!sessionId || !currentQuestion) return;

      const transcript = currentTranscript || 'No answer provided';
      const hasVerbal = transcript.length > 0;
      const hasCode = codeAnswer.trim().length > 0;

      const response: QuestionResponse = {
        question_id: currentQuestion.id,
        answer_text: hasVerbal ? transcript : undefined,
        code_answer: hasCode ? codeAnswer : undefined,
        programming_language: hasCode ? selectedLanguage : undefined,
        time_spent_seconds: responseDuration
      };

      await realisticInterviewService.saveQuestionResponse(
        sessionId,
        currentQuestion,
        response
      );

      if (hasCode && currentQuestion.requires_coding) {
        setCodeReviewMode(true);
        const reviewQuestions = await realisticInterviewService.generateCodeReviewQuestions(
          codeAnswer,
          selectedLanguage,
          currentQuestion.question_text
        );
        setCodeReviewQuestions(reviewQuestions);
        setCurrentReviewQuestion(0);
        setStage('code_review');
        return;
      }

      const followUp = await realisticInterviewService.analyzeAnswerAndGenerateFollowUp(
        currentQuestion,
        response,
        resume
      );

      if (followUp) {
        setFollowUpQuestion(followUp);
        setShowFollowUp(true);
        setStage('follow_up');
        return;
      }

      setStage('feedback');

      if (moveNextTimeoutRef.current) clearTimeout(moveNextTimeoutRef.current);
      moveNextTimeoutRef.current = setTimeout(() => {
        if (!isEndingRef.current) moveToNextQuestion();
      }, 1200);
    } catch (error) {
      console.error('Error processing answer:', error);
      alert('Failed to process answer. Moving to next question.');
      moveToNextQuestion();
    }
  };

  const handleCodeReviewAnswer = async () => {
    if (!reviewAnswer.trim() || !sessionId) return;

    await realisticInterviewService.saveFollowUpResponse(
      sessionId,
      currentQuestion.question_number,
      codeReviewQuestions[currentReviewQuestion],
      reviewAnswer,
      Math.floor((Date.now() - startTimeRef.current) / 1000)
    );

    if (currentReviewQuestion < codeReviewQuestions.length - 1) {
      setCurrentReviewQuestion(currentReviewQuestion + 1);
      setReviewAnswer('');
    } else {
      setCodeReviewMode(false);
      setCodeReviewQuestions([]);
      setCurrentReviewQuestion(0);
      setReviewAnswer('');
      moveToNextQuestion();
    }
  };

  const handleFollowUpSubmit = async () => {
    if (!followUpAnswer.trim() || !sessionId) return;

    try {
      await realisticInterviewService.saveFollowUpResponse(
        sessionId,
        currentQuestion.question_number,
        followUpQuestion!.question_text,
        followUpAnswer,
        Math.floor((Date.now() - startTimeRef.current) / 1000)
      );

      setShowFollowUp(false);
      setFollowUpQuestion(null);
      setFollowUpAnswer('');
      moveToNextQuestion();
    } catch (error) {
      console.error('Error submitting follow-up:', error);
    }
  };

  const moveToNextQuestion = async () => {
    if (isEndingRef.current) return;
    speechRecognitionService.reset();
    setCurrentTranscript('');
    setVerbalAnswer('');
    setCodeAnswer('');

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
    if (!sessionId) return;

    const totalDuration = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
    await realisticInterviewService.completeSession(sessionId, totalDuration);
    await interviewSessionPersistence.clearSessionState(sessionId);

    fullScreen.exitFullScreen();
    onInterviewComplete(sessionId);
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
      isEndingRef.current = true;
      cleanup();
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

  if (stage === 'loading') {
    return (
      <div className="min-h-screen bg-dark-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-300 text-lg">Initializing interview...</p>
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
            Speak clearly for verbal questions, and you can type code for coding challenges.
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
              <li>• Verbal answers auto-submit after 5 seconds of silence</li>
              <li>• Code questions allow typing and testing your code</li>
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

  if (codeReviewMode && stage === 'code_review') {
    return (
      <div className="min-h-screen bg-dark-100 text-white p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-dark-200 rounded-xl shadow-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Code className="w-6 h-6 text-blue-400" />
                Code Review Question {currentReviewQuestion + 1}/{codeReviewQuestions.length}
              </h2>
            </div>

            <div className="bg-dark-300 rounded-lg p-6 mb-6">
              <p className="text-lg text-gray-100">{codeReviewQuestions[currentReviewQuestion]}</p>
            </div>

            <div className="bg-dark-400 rounded-lg p-4 mb-6">
              <p className="text-xs text-gray-400 mb-2">Your Code:</p>
              <pre className="text-sm text-gray-300 overflow-x-auto font-mono">
                {codeAnswer}
              </pre>
            </div>

            <textarea
              value={reviewAnswer}
              onChange={(e) => setReviewAnswer(e.target.value)}
              className="w-full h-40 px-4 py-3 bg-dark-300 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Explain your code and reasoning..."
            />

            <button
              onClick={handleCodeReviewAnswer}
              disabled={!reviewAnswer.trim()}
              className="w-full mt-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentReviewQuestion < codeReviewQuestions.length - 1 ? 'Next Review Question' : 'Complete Code Review'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showFollowUp && followUpQuestion && stage === 'follow_up') {
    return (
      <div className="min-h-screen bg-dark-100 text-white p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-dark-200 rounded-xl shadow-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-yellow-400" />
                Follow-up Question
              </h2>
            </div>

            <div className="bg-blue-900/30 border-l-4 border-blue-500 rounded-lg p-6 mb-6">
              <p className="text-lg text-gray-100 mb-2">{followUpQuestion.question_text}</p>
              <p className="text-sm text-blue-300">Reason: {followUpQuestion.reason.replace('_', ' ')}</p>
            </div>

            <textarea
              value={followUpAnswer}
              onChange={(e) => setFollowUpAnswer(e.target.value)}
              className="w-full h-48 px-4 py-3 bg-dark-300 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Provide a detailed answer..."
            />

            <button
              onClick={handleFollowUpSubmit}
              disabled={!followUpAnswer.trim()}
              className="w-full mt-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Answer & Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showRecoveryModal && recoveryData) {
    return (
      <SessionRecoveryModal
        sessionData={{
          questionIndex: recoveryData.currentQuestionIndex,
          totalQuestions: recoveryData.totalQuestions,
          timeRemaining: recoveryData.timeRemaining,
          lastSaved: new Date(recoveryData.lastSaved).toLocaleString()
        }}
        onRecover={handleRecoverSession}
        onStartNew={handleStartNewSession}
      />
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
                <strong>Violations Detected:</strong> {violationCount}
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
        totalViolations={violationCount}
        isFullScreen={fullScreen.isFullScreen}
        onPause={handlePause}
        onEnd={handleEndInterview}
        onEnterFullScreen={fullScreen.requestFullScreen}
      />

      <div className="flex-1 mt-20 pt-8 pb-20">
          <div className="max-w-7xl mx-auto px-2 md:px-4 grid lg:grid-cols-[280px_1fr_320px] gap-6 h-full">
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

          <div className="bg-dark-200 rounded-xl p-6 flex flex-col justify-center max-h-[calc(100vh-180px)] overflow-y-auto">
            {currentQuestion && (
              <div>
                <QuestionCard
                  questionNumber={currentQuestionIndex + 1}
                  totalQuestions={questions.length}
                  questionText={currentQuestion.question_text}
                  questionType={currentQuestion.question_type}
                  difficulty={currentQuestion.difficulty_level}
                  requiresCoding={currentQuestion.requires_coding}
                  relatedSkills={[]}
                />

                {aiSpeaking && aiCurrentText && (
                  <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Volume2 className="w-4 h-4 text-blue-400" />
                      <span className="text-blue-400 text-sm">AI is speaking:</span>
                    </div>
                    <p className="text-gray-300 text-sm italic">{aiCurrentText}</p>
                  </div>
                )}

                {currentQuestion.requires_coding ? (
                  <div className="space-y-4 mt-6">
                    {stage === 'listening' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          Explain Your Approach (Voice)
                        </label>
                        <TranscriptDisplay
                          transcript={currentTranscript}
                          isListening={true}
                          placeholder="Start speaking to explain your approach..."
                        />
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-gray-300 flex items-center gap-2">
                          <Code className="w-4 h-4" />
                          Write Your Code
                        </label>
                        <select
                          value={selectedLanguage}
                          onChange={(e) => setSelectedLanguage(e.target.value)}
                          className="px-3 py-1 bg-dark-300 border border-gray-600 rounded text-sm text-white"
                        >
                          {codeCompilerService.getSupportedLanguages().map((lang) => (
                            <option key={lang} value={lang}>
                              {lang}
                            </option>
                          ))}
                        </select>
                      </div>
                      <EnhancedCodeEditor
                        value={codeAnswer}
                        onChange={setCodeAnswer}
                        language={selectedLanguage}
                        placeholder={`Write your ${selectedLanguage} code here...`}
                        height="400px"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={executeCode}
                        disabled={isExecuting || !codeAnswer.trim()}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition-all disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Play className="w-5 h-5" />
                        {isExecuting ? 'Running...' : 'Run & Test Code'}
                      </button>
                      <button
                        onClick={() => stopListening(false)}
                        disabled={stage !== 'listening' && stage !== 'question'}
                        className="flex-1 btn-primary py-3"
                      >
                        Submit Answer
                      </button>
                    </div>

                    {testCases.length > 0 && (
                      <TestCaseAccordion
                        testCases={testCases}
                        executionResults={executionResults}
                        isExecuting={isExecuting}
                      />
                    )}
                  </div>
                ) : (
                  <div className="mt-6">
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

                        <TranscriptDisplay
                          transcript={currentTranscript}
                          isListening={true}
                          placeholder="Start speaking..."
                        />

                        <VoiceActivityIndicator
                          isSpeaking={isSpeaking}
                          isListening={true}
                          silenceCountdown={silenceCountdown}
                        />

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
            )}
          </div>

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
        <div className="max-w-7xl mx-auto px-2 md:px-4 text-center text-sm text-gray-400">
          {stage === 'listening' ? 'Listening to your answer...' :
           stage === 'processing' ? 'Processing your answer...' :
           stage === 'question' ? 'AI is asking the question...' :
           'Ready to continue'}
        </div>
      </div>
    </div>
  );
};
