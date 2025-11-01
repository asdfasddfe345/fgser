import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Code,
  MessageSquare,
  Send,
  Play,
  CheckCircle,
  XCircle,
  Mic,
  MicOff,
  Video,
  VideoOff,
  SkipForward,
  Loader2,
  AlertTriangle,
  Volume2
} from 'lucide-react';
import { smartInterviewService, SmartInterviewConfig, SmartQuestion } from '../../services/smartInterviewService';
import { codeCompilerService, TestCase, ExecutionResult } from '../../services/codeCompilerService';
import { codeLogicReviewService, LogicReviewQuestion } from '../../services/codeLogicReviewService';
import { speechRecognitionService } from '../../services/speechRecognitionService';
import { textToSpeechService } from '../../services/textToSpeechService';
import { speechActivityDetector } from '../../services/speechActivityDetector';
import { useFullScreenMonitor } from '../../hooks/useFullScreenMonitor';
import { useTabSwitchDetector } from '../../hooks/useTabSwitchDetector';
import { SimplifiedInterviewHeader } from './SimplifiedInterviewHeader';

interface SmartInterviewRoomProps {
  config: SmartInterviewConfig;
  userId: string;
  userName: string;
  onInterviewComplete: (sessionId: string) => void;
  onBack: () => void;
}

type InterviewStage =
  | 'loading'
  | 'ready'
  | 'question'
  | 'listening'
  | 'coding'
  | 'executing'
  | 'code_review'
  | 'processing'
  | 'completed';

export const SmartInterviewRoom: React.FC<SmartInterviewRoomProps> = ({
  config,
  userId,
  userName,
  onInterviewComplete,
  onBack
}) => {
  const [stage, setStage] = useState<InterviewStage>('loading');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<SmartQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(config.durationMinutes * 60);
  const [isPaused, setIsPaused] = useState(false);

  const [textAnswer, setTextAnswer] = useState('');
  const [codeAnswer, setCodeAnswer] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('Python');
  const [currentTranscript, setCurrentTranscript] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [aiCurrentText, setAiCurrentText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [showTestResults, setShowTestResults] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const [reviewQuestions, setReviewQuestions] = useState<LogicReviewQuestion[]>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [reviewAnswer, setReviewAnswer] = useState('');

  const [silenceCountdown, setSilenceCountdown] = useState(0);
  const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [violationMessage, setViolationMessage] = useState('');
  const [violationCount, setViolationCount] = useState(0);

  const [statusMessage, setStatusMessage] = useState('Initializing interview...');
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [questionsSkipped, setQuestionsSkipped] = useState(0);

  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const silenceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const sessionStartTimeRef = useRef<number>(Date.now());
  const isEndingRef = useRef<boolean>(false);
  const currentResponseIdRef = useRef<string | null>(null);

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
    if (!isPaused && (stage === 'listening' || stage === 'coding')) {
      timerIntervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
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

  useEffect(() => {
    if (stage === 'listening' && !isPaused) {
      silenceCheckIntervalRef.current = setInterval(() => {
        if (speechActivityDetector.isInitialized()) {
          const currentSilence = speechActivityDetector.getCurrentSilenceDuration();
          if (currentSilence > 0) {
            setIsSpeaking(false);
          }
          const countdown = Math.max(0, 5 - currentSilence);
          setSilenceCountdown(countdown);

          if (countdown === 0 && !autoSubmitTriggered) {
            setAutoSubmitTriggered(true);
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
  }, [stage, isPaused, autoSubmitTriggered]);

  useEffect(() => {
    const attachVideo = async () => {
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
    attachVideo();
  }, [stage]);

  const initializeInterview = async () => {
    try {
      setStatusMessage('Setting up interview session...');

      const session = await smartInterviewService.createSession(config, userId);
      setSessionId(session.id);

      setStatusMessage('Selecting personalized questions...');
      const selectedQuestions = await smartInterviewService.selectQuestions(config, 10);
      setQuestions(selectedQuestions);

      await smartInterviewService.updateSessionProgress(session.id, 0, 0);

      setStatusMessage('Requesting camera and microphone access...');
      await requestMediaPermissions();

      setStage('ready');
      setStatusMessage('Ready to start interview');
      sessionStartTimeRef.current = Date.now();
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
            videoRef.current.onloadedmetadata = () => resolve();
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
      alert('Camera/microphone access denied. You can continue, but responses will not be recorded.');
    }
  };

  const startQuestion = async () => {
    await fullScreen.requestFullScreen();

    if (!currentQuestion) return;

    setStage('question');
    setStatusMessage(`Question ${currentQuestionIndex + 1} of ${questions.length}`);
    setTextAnswer('');
    setCodeAnswer('');
    setCurrentTranscript('');
    setAutoSubmitTriggered(false);

    if (textToSpeechService.isSupported()) {
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

    setTimeout(() => {
      if (!isEndingRef.current) {
        if (currentQuestion.requires_coding) {
          startCoding();
        } else {
          startListening();
        }
      }
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
          (transcript) => {
            setCurrentTranscript(transcript);
            setTextAnswer(transcript);
          },
          (finalTranscript) => {
            setCurrentTranscript(finalTranscript);
            setTextAnswer(finalTranscript);
          },
          (error) => console.error('Speech recognition error:', error)
        );
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
      }
    }

    if (videoStreamRef.current) {
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
          }
        );
      } catch (error) {
        console.error('Failed to start silence detection:', error);
      }
    }
  };

  const startCoding = () => {
    setStage('coding');
    setStatusMessage('Write your code solution...');
    startTimeRef.current = Date.now();

    if (currentQuestion.default_language) {
      setSelectedLanguage(currentQuestion.default_language);
    }
  };

  const executeCode = async () => {
    if (!codeAnswer.trim()) {
      alert('Please write some code first');
      return;
    }

    setIsExecuting(true);
    setShowTestResults(true);
    setStage('executing');

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
      setStage('coding');
    }
  };

  const submitCodeAnswer = async () => {
    if (!codeAnswer.trim()) {
      alert('Please write your code before submitting');
      return;
    }

    setStage('processing');
    setStatusMessage('Analyzing your code...');

    const responseDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

    try {
      if (!sessionId || !currentQuestion) return;

      const codeQualityAnalysis = await codeCompilerService.analyzeCodeQuality(
        codeAnswer,
        selectedLanguage,
        currentQuestion.question_text
      );

      const response = await smartInterviewService.saveResponse(
        sessionId,
        currentQuestion.id,
        currentQuestionIndex + 1,
        {
          answerType: 'code',
          codeAnswer: codeAnswer,
          programmingLanguage: selectedLanguage,
          individualScore: codeQualityAnalysis.overallScore,
          responseDuration: responseDuration,
          autoSubmitted: false,
          wasSkipped: false
        }
      );

      currentResponseIdRef.current = response.id;

      const savedExecution = await codeCompilerService.saveExecutionResult(
        response.id,
        sessionId,
        codeAnswer,
        selectedLanguage,
        testCases,
        executionResults
      );

      setStatusMessage('Generating code review questions...');

      const reviewQs = await codeLogicReviewService.generateReviewQuestions(
        codeAnswer,
        selectedLanguage,
        currentQuestion.question_text,
        response.id,
        sessionId,
        currentQuestion.id
      );

      if (reviewQs.length > 0) {
        setReviewQuestions(reviewQs);
        setCurrentReviewIndex(0);
        setReviewAnswer('');
        setStage('code_review');
        setStatusMessage('Code review questions...');

        if (textToSpeechService.isSupported()) {
          await textToSpeechService.speak(
            reviewQs[0].question_text,
            (text, speaking) => {
              setAiSpeaking(speaking);
              setAiCurrentText(speaking ? text : '');
            },
            { rate: 0.9, pitch: 1.0 }
          );
        }
      } else {
        moveToNextQuestion();
      }
    } catch (error) {
      console.error('Error submitting code:', error);
      alert('Failed to submit code');
    }
  };

  const submitReviewAnswer = async () => {
    if (!reviewAnswer.trim()) {
      alert('Please provide an answer');
      return;
    }

    setStatusMessage('Evaluating your explanation...');

    try {
      if (!sessionId || !currentResponseIdRef.current) return;

      const currentReview = reviewQuestions[currentReviewIndex];
      const responseDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

      await codeLogicReviewService.saveReviewResponse(
        currentReview.id,
        currentResponseIdRef.current,
        sessionId,
        reviewAnswer,
        undefined,
        responseDuration
      );

      if (currentReviewIndex < reviewQuestions.length - 1) {
        setCurrentReviewIndex(currentReviewIndex + 1);
        setReviewAnswer('');
        startTimeRef.current = Date.now();

        const nextReview = reviewQuestions[currentReviewIndex + 1];
        if (textToSpeechService.isSupported()) {
          await textToSpeechService.speak(
            nextReview.question_text,
            (text, speaking) => {
              setAiSpeaking(speaking);
              setAiCurrentText(speaking ? text : '');
            },
            { rate: 0.9, pitch: 1.0 }
          );
        }
      } else {
        moveToNextQuestion();
      }
    } catch (error) {
      console.error('Error submitting review answer:', error);
      alert('Failed to submit answer');
    }
  };

  const stopListening = async (isAutoSubmit: boolean = false) => {
    const responseDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

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

    await processTextAnswer(responseDuration, isAutoSubmit);
  };

  const processTextAnswer = async (responseDuration: number, isAutoSubmit: boolean) => {
    try {
      if (!sessionId || !currentQuestion) return;

      const answer = textAnswer || currentTranscript || 'No answer provided';

      const evaluation = await smartInterviewService.evaluateTextAnswer(
        currentQuestion.question_text,
        answer,
        currentQuestion.expected_answer_points || []
      );

      await smartInterviewService.saveResponse(
        sessionId,
        currentQuestion.id,
        currentQuestionIndex + 1,
        {
          answerType: isAutoSubmit ? 'voice' : 'text',
          textAnswer: answer,
          audioTranscript: currentTranscript,
          aiFeedback: evaluation.feedback,
          individualScore: evaluation.score,
          strengths: evaluation.strengths,
          improvements: evaluation.improvements,
          responseDuration: responseDuration,
          autoSubmitted: isAutoSubmit,
          silenceDuration: isAutoSubmit ? 5 : 0,
          wasSkipped: false
        }
      );

      setQuestionsAnswered((prev) => prev + 1);
      await smartInterviewService.updateSessionProgress(sessionId, questionsAnswered + 1, questionsSkipped);

      setTimeout(() => {
        if (!isEndingRef.current) moveToNextQuestion();
      }, 1000);
    } catch (error) {
      console.error('Error processing answer:', error);
      alert('Failed to process answer');
    }
  };

  const handleAutoSubmit = async () => {
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

    if (sessionId && currentQuestion) {
      try {
        await smartInterviewService.saveResponse(
          sessionId,
          currentQuestion.id,
          currentQuestionIndex + 1,
          {
            answerType: 'text',
            textAnswer: '[Question Skipped]',
            aiFeedback: { feedback: 'Question was skipped by the user.' },
            individualScore: 0,
            responseDuration: 0,
            wasSkipped: true
          }
        );

        setQuestionsSkipped((prev) => prev + 1);
        await smartInterviewService.updateSessionProgress(sessionId, questionsAnswered, questionsSkipped + 1);
      } catch (error) {
        console.error('Error saving skipped question:', error);
      }
    }

    setTimeout(() => {
      setIsSkipping(false);
      moveToNextQuestion();
    }, 1000);
  };

  const moveToNextQuestion = async () => {
    if (isEndingRef.current) return;

    speechRecognitionService.reset();
    setTextAnswer('');
    setCodeAnswer('');
    setCurrentTranscript('');
    setExecutionResults([]);
    setShowTestResults(false);
    setTestCases([]);
    setReviewQuestions([]);
    setReviewAnswer('');
    currentResponseIdRef.current = null;

    if (currentQuestionIndex + 1 < questions.length) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setTimeout(() => {
        if (!isEndingRef.current) startQuestion();
      }, 500);
    } else {
      completeInterview();
    }
  };

  const completeInterview = async () => {
    if (!sessionId) return;

    isEndingRef.current = true;
    setStage('completed');
    setStatusMessage('Completing interview...');

    const actualDuration = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);

    await smartInterviewService.completeSession(sessionId, actualDuration, {
      tabSwitchCount: tabDetector.tabSwitchCount,
      fullScreenExits: fullScreen.violations,
      totalViolationTime: tabDetector.totalTimeAway,
      violationsLog: tabDetector.violations
    });

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
      videoStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
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
            Questions include introductory, behavioral, technical, and coding challenges.
          </p>
          <div className="bg-dark-300 rounded-lg p-4 mb-6 space-y-2">
            <p className="text-gray-300 text-sm">
              {isMicrophoneEnabled ? '✓ Camera and microphone are ready' : '⚠ Media devices not available'}
            </p>
            <p className="text-gray-300 text-sm">
              {textToSpeechService.isSupported() ? '✓ AI voice enabled' : '⚠ Text-to-speech not available'}
            </p>
            <p className="text-gray-300 text-sm">✓ Full-screen security mode will be enabled</p>
            <p className="text-gray-300 text-sm">✓ Auto code compiler for coding questions</p>
          </div>
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-6 text-left">
            <h3 className="text-yellow-400 font-semibold mb-2">⚠️ Important Guidelines:</h3>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• The interview will run in full-screen mode</li>
              <li>• Coding questions will open an integrated compiler automatically</li>
              <li>• After code passes tests, AI will ask follow-up logic questions</li>
              <li>• Voice answers auto-submit after 5 seconds of silence</li>
              <li>• Violations will be tracked and reported</li>
            </ul>
          </div>
          <button onClick={startQuestion} className="btn-primary px-8 py-4 text-lg">
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
          <div className="max-w-7xl mx-auto px-2 md:px-4 grid md:grid-cols-[300px_1fr_350px] gap-6 h-full">
          <div className="bg-dark-200 rounded-xl p-6 flex items-center justify-center">
            <div className="text-center">
              <div
                className={`w-32 h-32 rounded-full mx-auto mb-4 flex items-center justify-center transition-all ${
                  aiSpeaking
                    ? 'bg-gradient-to-br from-blue-500 to-purple-600 animate-pulse'
                    : 'bg-gradient-to-br from-blue-500/50 to-purple-600/50'
                }`}
              >
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

          <div className="bg-dark-200 rounded-xl p-8 flex flex-col justify-center max-h-[calc(100vh-200px)] overflow-y-auto">
            {currentQuestion && (
              <div>
                <div className="text-sm text-blue-400 mb-4">
                  {currentQuestion.category} • {currentQuestion.difficulty}
                  {currentQuestion.requires_coding && ' • Coding'}
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
                    <div className="bg-dark-300 rounded-lg p-4 min-h-[100px] max-h-[200px] overflow-y-auto">
                      <p className="text-gray-300 text-sm">{textAnswer || currentTranscript || 'Start speaking...'}</p>
                    </div>

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
                      <button onClick={() => stopListening(false)} className="flex-1 btn-primary py-3" disabled={autoSubmitTriggered}>
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

                {(stage === 'coding' || stage === 'executing') && (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-300 flex items-center gap-2">
                          <Code className="w-4 h-4" />
                          Write Your Code
                        </label>
                        <select
                          value={selectedLanguage}
                          onChange={(e) => setSelectedLanguage(e.target.value)}
                          className="px-3 py-1 bg-dark-300 border border-gray-600 rounded text-sm text-white"
                        >
                          {(currentQuestion.programming_languages || ['Python', 'JavaScript', 'Java', 'C++']).map((lang) => (
                            <option key={lang} value={lang}>
                              {lang}
                            </option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        value={codeAnswer}
                        onChange={(e) => setCodeAnswer(e.target.value)}
                        className="w-full h-80 px-4 py-3 bg-dark-300 text-green-400 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
                        placeholder={`Write your ${selectedLanguage} code here...`}
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
                        onClick={submitCodeAnswer}
                        disabled={!codeAnswer.trim() || executionResults.length === 0}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-all disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Send className="w-5 h-5" />
                        Submit Code
                      </button>
                    </div>

                    {showTestResults && executionResults.length > 0 && (
                      <div className="bg-dark-300 rounded-lg p-4 border border-gray-700">
                        <h3 className="font-semibold text-gray-100 mb-3 flex items-center gap-2">
                          Test Results
                        </h3>
                        <div className="space-y-3">
                          {executionResults.map((result, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded border ${
                                result.passed ? 'bg-green-900/30 border-green-700' : 'bg-red-900/30 border-red-700'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-sm">Test Case {idx + 1}</span>
                                {result.passed ? (
                                  <CheckCircle className="w-5 h-5 text-green-500" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-red-500" />
                                )}
                              </div>
                              <div className="text-xs space-y-1 text-gray-300">
                                <div>
                                  <span className="font-medium">Input:</span> {result.testCase.input}
                                </div>
                                <div>
                                  <span className="font-medium">Expected:</span> {result.testCase.expectedOutput}
                                </div>
                                <div>
                                  <span className="font-medium">Got:</span> {result.actualOutput}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {stage === 'code_review' && reviewQuestions.length > 0 && (
                  <div className="space-y-4">
                    <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-blue-400 font-semibold">
                          Code Review {currentReviewIndex + 1}/{reviewQuestions.length}
                        </span>
                      </div>
                      <p className="text-gray-100 text-lg">{reviewQuestions[currentReviewIndex].question_text}</p>
                    </div>

                    <div className="bg-dark-300 rounded-lg p-4">
                      <p className="text-xs text-gray-400 mb-2">Your Code:</p>
                      <pre className="text-sm text-gray-300 overflow-x-auto font-mono max-h-40 overflow-y-auto">
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
                      onClick={submitReviewAnswer}
                      disabled={!reviewAnswer.trim()}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Send className="w-5 h-5" />
                      {currentReviewIndex < reviewQuestions.length - 1 ? 'Next Review Question' : 'Complete Code Review'}
                    </button>
                  </div>
                )}

                {stage === 'processing' && (
                  <div className="text-center">
                    <div className="animate-pulse text-blue-400 mb-2">Processing...</div>
                    <p className="text-gray-400 text-sm">Analyzing your response</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-dark-200 rounded-xl p-6 flex flex-col">
            <div className="text-gray-400 text-sm mb-4">Your Camera</div>
            <div className="flex-1 bg-dark-300 rounded-lg overflow-hidden relative" style={{ minHeight: '400px' }}>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover min-h-[400px]" />
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
        <div className="max-w-7xl mx-auto px-2 md:px-4 text-center text-sm text-gray-400">{statusMessage}</div>
      </div>
    </div>
  );
};
