import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Code, MessageSquare, Send, Play, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { adaptiveInterviewSessionService } from '../../services/adaptiveInterviewSessionService';
import { adaptiveQuestionService } from '../../services/adaptiveQuestionService';
import { codeCompilerService, TestCase, ExecutionResult } from '../../services/codeCompilerService';
import { useAuth } from '../../contexts/AuthContext';

interface AdaptiveInterviewRoomProps {
  sessionId: string;
  onComplete: () => void;
}

interface Question {
  id: string;
  question_number: number;
  question_type: string;
  question_text: string;
  related_project?: string;
  related_skills: string[];
  difficulty_level: string;
  expected_duration_minutes: number;
  requires_coding: boolean;
  programming_language?: string;
  context: any;
}

export const AdaptiveInterviewRoom: React.FC<AdaptiveInterviewRoomProps> = ({ sessionId, onComplete }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [verbalResponse, setVerbalResponse] = useState('');
  const [codeResponse, setCodeResponse] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('Python');
  const [timeSpent, setTimeSpent] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [followUpResponse, setFollowUpResponse] = useState('');
  const [showTestResults, setShowTestResults] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    loadQuestions();
    startTimer();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionId]);

  useEffect(() => {
    if (currentQuestion?.requires_coding && currentQuestion?.programming_language) {
      setSelectedLanguage(currentQuestion.programming_language);
      generateTestCases();
    }
  }, [currentQuestionIndex]);

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

  const loadQuestions = async () => {
    try {
      const sessionQuestions = await adaptiveQuestionService.getSessionQuestions(sessionId);
      setQuestions(sessionQuestions);

      const session = await adaptiveInterviewSessionService.getSession(sessionId);
      if (session) {
        setCurrentQuestionIndex(session.currentQuestionIndex || 0);
      }
    } catch (error) {
      console.error('Error loading questions:', error);
    }
  };

  const generateTestCases = async () => {
    if (!currentQuestion) return;

    try {
      const cases = await codeCompilerService.generateTestCases(
        currentQuestion.question_text,
        selectedLanguage
      );
      setTestCases(cases);
    } catch (error) {
      console.error('Error generating test cases:', error);
    }
  };

  const executeCode = async () => {
    if (!codeResponse.trim()) {
      alert('Please write some code first');
      return;
    }

    setIsExecuting(true);
    setShowTestResults(true);

    try {
      const result = await codeCompilerService.executeCode(
        codeResponse,
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

  const submitResponse = async () => {
    if (!currentQuestion) return;

    const hasVerbal = verbalResponse.trim().length > 0;
    const hasCode = codeResponse.trim().length > 0;

    if (!hasVerbal && !hasCode) {
      alert('Please provide a response before submitting');
      return;
    }

    setIsLoading(true);

    try {
      const responseType = hasCode && hasVerbal ? 'mixed' : hasCode ? 'code' : 'verbal';

      const response = await adaptiveInterviewSessionService.saveResponse(sessionId, currentQuestion.id, {
        responseType,
        verbalResponse: hasVerbal ? verbalResponse : undefined,
        codeResponse: hasCode ? codeResponse : undefined,
        programmingLanguage: hasCode ? selectedLanguage : undefined,
        timeSpentSeconds: timeSpent
      });

      const analysis = await adaptiveInterviewSessionService.analyzeResponse(
        currentQuestion.question_text,
        verbalResponse || 'Code-only submission',
        currentQuestion.question_type,
        currentQuestion.related_skills
      );

      let codeQualityAnalysis = null;
      if (hasCode) {
        codeQualityAnalysis = await codeCompilerService.analyzeCodeQuality(
          codeResponse,
          selectedLanguage,
          currentQuestion.question_text
        );

        if (executionResults.length > 0) {
          await codeCompilerService.saveExecutionResult(
            response.id,
            sessionId,
            codeResponse,
            selectedLanguage,
            testCases,
            executionResults
          );
        }
      }

      await adaptiveInterviewSessionService.updateResponseWithAnalysis(
        response.id,
        analysis,
        codeQualityAnalysis
      );

      if (analysis.needsFollowUp) {
        const followUp = await adaptiveInterviewSessionService.generateAndSaveFollowUp(
          sessionId,
          currentQuestion.id,
          response.id,
          currentQuestion.question_text,
          verbalResponse || codeResponse,
          analysis
        );

        if (followUp) {
          setFollowUpQuestion(followUp.follow_up_text);
          setShowFollowUp(true);
          setIsLoading(false);
          return;
        }
      }

      moveToNextQuestion();
    } catch (error) {
      console.error('Error submitting response:', error);
      alert('Failed to submit response');
    } finally {
      setIsLoading(false);
    }
  };

  const submitFollowUp = async () => {
    if (!followUpResponse.trim()) {
      alert('Please provide an answer to the follow-up question');
      return;
    }

    setIsLoading(true);

    try {
      setShowFollowUp(false);
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
    adaptiveInterviewSessionService.updateSessionProgress(sessionId, nextIndex);
    setVerbalResponse('');
    setCodeResponse('');
    setExecutionResults([]);
    setShowTestResults(false);
    setFollowUpResponse('');
    resetTimer();
  };

  const completeInterview = async () => {
    try {
      const responses = await adaptiveInterviewSessionService.getSessionResponses(sessionId);
      const avgScore = responses.reduce((sum, r) => sum + (r.score || 0), 0) / responses.length;

      await adaptiveInterviewSessionService.completeSession(sessionId, avgScore);
      onComplete();
    } catch (error) {
      console.error('Error completing interview:', error);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeColor = () => {
    if (!currentQuestion) return 'text-gray-600';
    const maxTime = currentQuestion.expected_duration_minutes * 60;
    const progress = timeSpent / maxTime;

    if (progress > 1) return 'text-red-600';
    if (progress > 0.8) return 'text-orange-600';
    return 'text-green-600';
  };

  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading interview questions...</p>
        </div>
      </div>
    );
  }

  if (showFollowUp) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Follow-up Question</h2>
              <div className={`flex items-center gap-2 text-lg font-semibold ${getTimeColor()}`}>
                <Clock className="w-5 h-5" />
                {formatTime(timeSpent)}
              </div>
            </div>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <p className="text-gray-700 whitespace-pre-wrap">{followUpQuestion}</p>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Answer
            </label>
            <textarea
              value={followUpResponse}
              onChange={(e) => setFollowUpResponse(e.target.value)}
              className="w-full h-40 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Provide your answer..."
            />
          </div>

          <button
            onClick={submitFollowUp}
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
          >
            <Send className="w-5 h-5" />
            {isLoading ? 'Submitting...' : 'Submit Answer'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Question {currentQuestion.question_number} of {questions.length}
              </h1>
              <div className="flex items-center gap-4 mt-2">
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                  {currentQuestion.question_type.replace('_', ' ')}
                </span>
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                  {currentQuestion.difficulty_level}
                </span>
                {currentQuestion.related_project && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                    Project: {currentQuestion.related_project}
                  </span>
                )}
              </div>
            </div>
            <div className={`flex items-center gap-2 text-2xl font-bold ${getTimeColor()}`}>
              <Clock className="w-6 h-6" />
              {formatTime(timeSpent)}
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-lg">
            <p className="text-lg text-gray-800 whitespace-pre-wrap">{currentQuestion.question_text}</p>
            {currentQuestion.related_skills.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {currentQuestion.related_skills.map((skill, idx) => (
                  <span key={idx} className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded">
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          {currentQuestion.requires_coding ? (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Explain Your Approach
                  </label>
                  <MessageSquare className="w-5 h-5 text-gray-400" />
                </div>
                <textarea
                  value={verbalResponse}
                  onChange={(e) => setVerbalResponse(e.target.value)}
                  className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Explain your approach and thought process before coding..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Write Your Code
                  </label>
                  <div className="flex items-center gap-2">
                    <Code className="w-5 h-5 text-gray-400" />
                    <select
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded text-sm"
                    >
                      {codeCompilerService.getSupportedLanguages().map(lang => (
                        <option key={lang} value={lang}>{lang}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <textarea
                  value={codeResponse}
                  onChange={(e) => setCodeResponse(e.target.value)}
                  className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
                  placeholder={`Write your ${selectedLanguage} code here...`}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={executeCode}
                  disabled={isExecuting || !codeResponse.trim()}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  {isExecuting ? 'Running...' : 'Run Code & Test'}
                </button>
              </div>

              {showTestResults && executionResults.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-3">Test Results</h3>
                  <div className="space-y-3">
                    {executionResults.map((result, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded border ${
                          result.passed
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">Test Case {idx + 1}</span>
                          {result.passed ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                        <div className="text-xs space-y-1">
                          <div><span className="font-medium">Input:</span> {result.testCase.input}</div>
                          <div><span className="font-medium">Expected:</span> {result.testCase.expectedOutput}</div>
                          <div><span className="font-medium">Got:</span> {result.actualOutput}</div>
                          {result.error && (
                            <div className="text-red-600"><span className="font-medium">Error:</span> {result.error}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {testCases.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-800">Test Cases to Pass</h3>
                  </div>
                  <div className="space-y-2">
                    {testCases.map((tc, idx) => (
                      <div key={idx} className="text-sm bg-white p-2 rounded">
                        <div><span className="font-medium">Input:</span> {tc.input}</div>
                        <div><span className="font-medium">Expected Output:</span> {tc.expectedOutput}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Answer
              </label>
              <textarea
                value={verbalResponse}
                onChange={(e) => setVerbalResponse(e.target.value)}
                className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Type your detailed answer here..."
              />
            </div>
          )}

          <button
            onClick={submitResponse}
            disabled={isLoading}
            className="w-full mt-6 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
          >
            <Send className="w-5 h-5" />
            {isLoading ? 'Submitting...' : currentQuestionIndex < questions.length - 1 ? 'Submit & Continue' : 'Submit & Complete Interview'}
          </button>
        </div>
      </div>
    </div>
  );
};
