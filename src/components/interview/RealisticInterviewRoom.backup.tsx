import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Code,
  MessageSquare,
  Send,
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Maximize,
  ArrowRight,
  Volume2,
  AlertTriangle,
  SkipForward,
  Loader2
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
import { supabase } from '../../lib/supabaseClient';

interface RealisticInterviewRoomProps {
  config: InterviewConfig;
  resume: UserResume;
  userId: string;
  userName: string;
  onInterviewComplete: (sessionId: string) => void;
  onBack: () => void;
}

export const RealisticInterviewRoom: React.FC<RealisticInterviewRoomProps> = ({
  config,
  resume,
  userId,
  userName,
  onInterviewComplete,
  onBack
}) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [verbalAnswer, setVerbalAnswer] = useState('');
  const [codeAnswer, setCodeAnswer] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('Python');
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
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
  const [hasStartedSpeaking, setHasStartedSpeaking] = useState(false);
  const [minimumSpeechDuration, setMinimumSpeechDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [stage, setStage] = useState<'loading' | 'ready' | 'question' | 'listening' | 'processing'>('loading');

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

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const sessionStartTimeRef = useRef<number>(Date.now());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const silenceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSubmitTriggeredRef = useRef<boolean>(false);
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
  }, [stage, isPaused]);

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
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            completeInterview();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPaused, stage]);

  const initializeInterview = async () => {
    try {
      setStage('loading');
      const questions = await realisticInterviewService.generateInterviewQuestions(config, resume);
      setQuestions(questions);

      const sessionId = await realisticInterviewService.createInterviewSession(
        userId,
        config,
        resume.id
      );
      setSessionId(sessionId);
      sessionStartTimeRef.current = Date.now();

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

  const startTimer = () => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  };

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeSpent(0);
    startTimer();
  };

  const currentQuestion = questions[currentQuestionIndex];

  const toggleRecording = () => {
    if (isRecording) {
      speechRecognitionService.stopRecognition();
      setIsRecording(false);
    } else {
      speechRecognitionService.startRecognition((transcript) => {
        setVerbalAnswer((prev) => prev + ' ' + transcript);
      });
      setIsRecording(true);
    }
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

  const handleSubmitAnswer = async () => {
    if (!currentQuestion || !sessionId) return;

    const hasVerbal = verbalAnswer.trim().length > 0;
    const hasCode = codeAnswer.trim().length > 0;

    if (!hasVerbal && !hasCode) {
      alert('Please provide an answer before submitting');
      return;
    }

    setIsLoading(true);

    try {
      const response: QuestionResponse = {
        question_id: currentQuestion.id,
        answer_text: hasVerbal ? verbalAnswer : undefined,
        code_answer: hasCode ? codeAnswer : undefined,
        programming_language: hasCode ? selectedLanguage : undefined,
        time_spent_seconds: timeSpent
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
        setIsLoading(false);
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
        setIsLoading(false);
        return;
      }

      moveToNextQuestion();
    } catch (error) {
      console.error('Error submitting answer:', error);
      alert('Failed to submit answer');
    } finally {
      setIsLoading(false);
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

    setIsLoading(true);

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
    } finally {
      setIsLoading(false);
    }
  };

  const moveToNextQuestion = () => {
    const nextIndex = currentQuestionIndex + 1;

    if (nextIndex >= questions.length) {
      completeInterview();
      return;
    }

    setCurrentQuestionIndex(nextIndex);
    setVerbalAnswer('');
    setCodeAnswer('');
    setExecutionResults([]);
    setShowTestResults(false);
    setTestCases([]);
    resetTimer();
  };

  const completeInterview = async () => {
    if (!sessionId) return;

    const totalDuration = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
    await realisticInterviewService.completeSession(sessionId, totalDuration);
    onInterviewComplete(sessionId);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white">Preparing your interview...</p>
        </div>
      </div>
    );
  }

  if (codeReviewMode) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gray-800 rounded-xl shadow-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Code className="w-6 h-6 text-blue-400" />
                Code Review Question {currentReviewQuestion + 1}/{codeReviewQuestions.length}
              </h2>
              <div className="flex items-center gap-2 text-lg font-semibold text-green-400">
                <Clock className="w-5 h-5" />
                {formatTime(timeSpent)}
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-6 mb-6">
              <p className="text-lg text-gray-100">{codeReviewQuestions[currentReviewQuestion]}</p>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 mb-6">
              <p className="text-xs text-gray-400 mb-2">Your Code:</p>
              <pre className="text-sm text-gray-300 overflow-x-auto font-mono">
                {codeAnswer}
              </pre>
            </div>

            <textarea
              value={reviewAnswer}
              onChange={(e) => setReviewAnswer(e.target.value)}
              className="w-full h-40 px-4 py-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Explain your code and reasoning..."
            />

            <button
              onClick={handleCodeReviewAnswer}
              disabled={!reviewAnswer.trim()}
              className="w-full mt-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Send className="w-5 h-5" />
              {currentReviewQuestion < codeReviewQuestions.length - 1 ? 'Next Review Question' : 'Complete Code Review'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showFollowUp && followUpQuestion) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gray-800 rounded-xl shadow-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-yellow-400" />
                Follow-up Question
              </h2>
              <div className="flex items-center gap-2 text-lg font-semibold text-green-400">
                <Clock className="w-5 h-5" />
                {formatTime(timeSpent)}
              </div>
            </div>

            <div className="bg-blue-900/30 border-l-4 border-blue-500 rounded-lg p-6 mb-6">
              <p className="text-lg text-gray-100 mb-2">{followUpQuestion.question_text}</p>
              <p className="text-sm text-blue-300">Reason: {followUpQuestion.reason.replace('_', ' ')}</p>
            </div>

            <textarea
              value={followUpAnswer}
              onChange={(e) => setFollowUpAnswer(e.target.value)}
              className="w-full h-48 px-4 py-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Provide a detailed answer..."
            />

            <button
              onClick={handleFollowUpSubmit}
              disabled={isLoading || !followUpAnswer.trim()}
              className="w-full mt-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Send className="w-5 h-5" />
              {isLoading ? 'Submitting...' : 'Submit Answer & Continue'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleRecording}
                className={`p-2 rounded-full ${
                  isRecording ? 'bg-red-600 animate-pulse' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {isRecording ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setVideoEnabled(!videoEnabled)}
                className={`p-2 rounded-full ${
                  videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600'
                }`}
              >
                {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
            </div>

            <div className="text-sm">
              <p className="font-semibold">{userName}</p>
              <p className="text-gray-400">Interview in Progress</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-xs text-gray-400">Question</p>
              <p className="text-lg font-bold">
                {currentQuestion.question_number}/{questions.length}
              </p>
            </div>

            <div className="text-center">
              <p className="text-xs text-gray-400">Time</p>
              <p className="text-lg font-bold text-green-400">{formatTime(timeSpent)}</p>
            </div>

            <button
              onClick={requestFullScreen}
              className="p-2 rounded-full bg-gray-700 hover:bg-gray-600"
            >
              <Maximize className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-gray-800 rounded-xl shadow-2xl p-8 mb-6">
          <div className="mb-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-xl font-bold">{currentQuestion.question_number}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-3 py-1 bg-blue-600 text-white text-xs rounded-full font-medium">
                    {currentQuestion.question_type.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="px-3 py-1 bg-purple-600 text-white text-xs rounded-full font-medium">
                    {currentQuestion.difficulty_level.toUpperCase()}
                  </span>
                  {currentQuestion.related_project && (
                    <span className="px-3 py-1 bg-green-600 text-white text-xs rounded-full font-medium">
                      Project: {currentQuestion.related_project}
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-gray-100 mb-2">
                  {currentQuestion.question_text}
                </h2>
                {currentQuestion.related_skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {currentQuestion.related_skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {currentQuestion.requires_coding ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Explain Your Approach
                </label>
                <textarea
                  value={verbalAnswer}
                  onChange={(e) => setVerbalAnswer(e.target.value)}
                  className="w-full h-32 px-4 py-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Explain your approach before writing code..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-300 flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Write Your Code
                  </label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                  >
                    {codeCompilerService.getSupportedLanguages().map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={codeAnswer}
                  onChange={(e) => setCodeAnswer(e.target.value)}
                  className="w-full h-80 px-4 py-3 bg-gray-900 text-green-400 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
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
              </div>

              {showTestResults && executionResults.length > 0 && (
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <h3 className="font-semibold text-gray-100 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Test Results
                  </h3>
                  <div className="space-y-3">
                    {executionResults.map((result, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded border ${
                          result.passed
                            ? 'bg-green-900/30 border-green-700'
                            : 'bg-red-900/30 border-red-700'
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
                            <span className="font-medium">Expected:</span>{' '}
                            {result.testCase.expectedOutput}
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
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Your Answer
              </label>
              <textarea
                value={verbalAnswer}
                onChange={(e) => setVerbalAnswer(e.target.value)}
                className="w-full h-64 px-4 py-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Type your detailed answer here..."
              />
            </div>
          )}

          <button
            onClick={handleSubmitAnswer}
            disabled={isLoading || (!verbalAnswer.trim() && !codeAnswer.trim())}
            className="w-full mt-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Analyzing...
              </>
            ) : (
              <>
                <ArrowRight className="w-6 h-6" />
                {currentQuestionIndex < questions.length - 1 ? 'Submit & Continue' : 'Complete Interview'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
