import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Lightbulb, RotateCcw, Home, Download, Share2, Shield, AlertTriangle } from 'lucide-react';
import { interviewService } from '../../services/interviewService';
import { interviewFeedbackService } from '../../services/interviewFeedbackService';
import { InterviewSessionWithQuestions, AIFeedback } from '../../types/interview';
import { supabase } from '../../lib/supabaseClient';

interface InterviewSummaryReportProps {
  sessionId: string;
  onRetake: () => void;
  onBackHome: () => void;
}

export const InterviewSummaryReport: React.FC<InterviewSummaryReportProps> = ({
  sessionId,
  onRetake,
  onBackHome
}) => {
  const [sessionData, setSessionData] = useState<InterviewSessionWithQuestions | null>(null);
  const [overallInsights, setOverallInsights] = useState<{
    overallStrengths: string[];
    overallImprovements: string[];
    keyTakeaways: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessionData();
  }, [sessionId]);

  const loadSessionData = async () => {
    try {
      if (!sessionId || sessionId === '') {
        console.error('Invalid session ID provided');
        setLoading(false);
        setSessionData(null);
        return;
      }

      // Try legacy/mock session first
      let data = await interviewService.getSessionWithDetails(sessionId);

      // Fallback: try realistic interview tables
      if (!data) {
        try {
          const { data: realSession, error: realErr } = await supabase
            .from('realistic_interview_sessions')
            .select('*')
            .eq('id', sessionId)
            .maybeSingle();

          if (realErr) throw realErr;

          if (realSession) {
            const { data: realResponses, error: respErr } = await supabase
              .from('realistic_interview_responses')
              .select('*')
              .eq('session_id', sessionId)
              .order('question_number', { ascending: true });

            if (respErr) throw respErr;

            // Shape into InterviewSessionWithQuestions-like object
            const questions = (realResponses || []).map((r: any, idx: number) => ({
              id: `realistic-${idx + 1}`,
              question_text: r.question_text || `Question ${idx + 1}`,
              // Provide safe defaults so UI doesn't show undefined text
              category: (r.question_type || 'Technical') as any,
              difficulty: 'Medium' as any,
              interview_type: 'general' as any,
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }));

            data = {
              // Map common fields used by the UI
              id: realSession.id,
              user_id: realSession.user_id,
              session_type: (realSession.session_type || 'general') as any,
              interview_category: (realSession.interview_category || 'mixed') as any,
              duration_minutes: realSession.duration_minutes || Math.ceil((realSession.actual_duration_seconds || 0) / 60),
              actual_duration_seconds: realSession.actual_duration_seconds,
              overall_score: realSession.overall_score,
              status: realSession.status as any,
              started_at: realSession.started_at,
              completed_at: realSession.completed_at,
              created_at: realSession.created_at,
              updated_at: realSession.updated_at,
              tab_switches_count: realSession.tab_switches_count,
              fullscreen_exits_count: realSession.fullscreen_exits_count,
              total_violation_time: realSession.total_violation_time,
              violations_log: realSession.violations_log,
              security_score: realSession.security_score,
              questions,
              responses: (realResponses || []).map((r: any, idx: number) => ({
                id: r.id,
                session_id: r.session_id,
                question_id: questions[idx]?.id || `realistic-${idx + 1}`,
                question_order: r.question_number || idx + 1,
                user_answer_text: r.answer_text || r.code_answer || '',
                audio_url: undefined,
                video_url: undefined,
                audio_transcript: undefined,
                // Map any AI feedback if it exists in a compatible shape
                ai_feedback_json: r.ai_feedback_json as any,
                individual_score: r.quality_score || r.score || 0,
                tone_rating: undefined,
                confidence_rating: undefined,
                response_duration_seconds: r.time_spent_seconds || undefined,
                created_at: r.created_at,
                updated_at: r.updated_at
              }))
            } as unknown as InterviewSessionWithQuestions;
          }
        } catch (fallbackErr) {
          console.error('Fallback realistic session lookup failed:', fallbackErr);
        }
      }

      if (!data) {
        console.error('Session not found for ID:', sessionId);
        setLoading(false);
        setSessionData(null);
        return;
      }

      setSessionData(data);

      if (data.responses && data.responses.length > 0) {
        const responsesWithFeedback = data.responses
          .filter(r => r.ai_feedback_json && r.user_answer_text)
          .map(r => ({
            question: data.questions.find(q => q.id === r.question_id)?.question_text || '',
            answer: r.user_answer_text || '',
            feedback: r.ai_feedback_json as AIFeedback,
            score: r.individual_score || 0
          }));

        if (responsesWithFeedback.length > 0) {
          try {
            const insights = await interviewFeedbackService.generateOverallSummary(responsesWithFeedback);
            setOverallInsights(insights);
          } catch (insightError) {
            console.error('Error generating insights:', insightError);
          }
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading session data:', error);
      setLoading(false);
      setSessionData(null);
    }
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getScoreColor = (score: number): string => {
    if (score >= 8) return 'text-green-500';
    if (score >= 6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 8) return 'bg-green-500';
    if (score >= 6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-dark-100 dark:via-dark-50 dark:to-dark-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-secondary-700 dark:text-gray-300">Loading your interview results...</p>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-dark-100 dark:via-dark-50 dark:to-dark-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-secondary-700 dark:text-gray-300">Session data not found</p>
          <button onClick={onBackHome} className="mt-4 btn-primary">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const overallScore = sessionData.overall_score || 0;
  const completedQuestions = sessionData.responses.length;
  const totalQuestions = sessionData.questions.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-dark-100 dark:via-dark-50 dark:to-dark-100 py-12">
      <div className="max-w-5xl mx-auto px-4">
        <div className="bg-white dark:bg-dark-200 rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2">Interview Complete!</h1>
                <p className="text-blue-100">Here's your detailed performance report</p>
              </div>
              <Trophy className="w-16 h-16 opacity-80" />
            </div>
          </div>

          <div className="p-8">
            <div className="grid md:grid-cols-4 gap-4 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4 text-center">
                <div className={`text-4xl font-bold mb-1 ${getScoreColor(overallScore)}`}>
                  {overallScore}
                </div>
                <div className="text-sm text-secondary-600 dark:text-gray-400">Overall Score</div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4 text-center">
                <div className="text-4xl font-bold mb-1 text-secondary-900 dark:text-gray-100">
                  {completedQuestions}/{totalQuestions}
                </div>
                <div className="text-sm text-secondary-600 dark:text-gray-400">Questions Answered</div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4 text-center">
                <div className="text-4xl font-bold mb-1 text-secondary-900 dark:text-gray-100">
                  {formatDuration(sessionData.actual_duration_seconds)}
                </div>
                <div className="text-sm text-secondary-600 dark:text-gray-400">Total Duration</div>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-4 text-center">
                <div className="text-4xl font-bold mb-1 text-secondary-900 dark:text-gray-100">
                  {sessionData.interview_category.toUpperCase()}
                </div>
                <div className="text-sm text-secondary-600 dark:text-gray-400">Interview Type</div>
              </div>
            </div>

            {overallInsights && (
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h3 className="font-bold text-secondary-900 dark:text-gray-100">Key Strengths</h3>
                  </div>
                  <ul className="space-y-2">
                    {overallInsights.overallStrengths.slice(0, 3).map((strength, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-secondary-700 dark:text-gray-300">
                        <span className="text-green-500 font-bold">✓</span>
                        <span className="capitalize">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-bold text-secondary-900 dark:text-gray-100">Areas to Improve</h3>
                  </div>
                  <ul className="space-y-2">
                    {overallInsights.overallImprovements.slice(0, 3).map((improvement, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-secondary-700 dark:text-gray-300">
                        <span className="text-blue-500 font-bold">→</span>
                        <span className="capitalize">{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {overallInsights && overallInsights.keyTakeaways.length > 0 && (
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6 mb-8">
                <h3 className="font-bold text-secondary-900 dark:text-gray-100 mb-4">🎯 Key Takeaways</h3>
                <ul className="space-y-2">
                  {overallInsights.keyTakeaways.map((takeaway, idx) => (
                    <li key={idx} className="text-secondary-700 dark:text-gray-300">
                      • {takeaway}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(sessionData.security_score !== undefined ||
              sessionData.tab_switches_count !== undefined ||
              sessionData.fullscreen_exits_count !== undefined) && (
              <div className={`rounded-xl p-6 mb-8 border ${
                (sessionData.security_score || 100) >= 80
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : (sessionData.security_score || 100) >= 60
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center gap-3 mb-4">
                  {(sessionData.security_score || 100) >= 80 ? (
                    <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                  )}
                  <h3 className="text-xl font-bold text-secondary-900 dark:text-gray-100">
                    Interview Integrity Report
                  </h3>
                </div>

                <div className="grid md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-white dark:bg-dark-200 rounded-lg p-4 text-center">
                    <div className={`text-3xl font-bold mb-1 ${
                      (sessionData.security_score || 100) >= 80
                        ? 'text-green-600 dark:text-green-400'
                        : (sessionData.security_score || 100) >= 60
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {sessionData.security_score || 100}
                    </div>
                    <div className="text-xs text-secondary-600 dark:text-gray-400">Security Score</div>
                  </div>

                  <div className="bg-white dark:bg-dark-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold mb-1 text-secondary-900 dark:text-gray-100">
                      {sessionData.tab_switches_count || 0}
                    </div>
                    <div className="text-xs text-secondary-600 dark:text-gray-400">Tab Switches</div>
                  </div>

                  <div className="bg-white dark:bg-dark-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold mb-1 text-secondary-900 dark:text-gray-100">
                      {sessionData.fullscreen_exits_count || 0}
                    </div>
                    <div className="text-xs text-secondary-600 dark:text-gray-400">Full-Screen Exits</div>
                  </div>

                  <div className="bg-white dark:bg-dark-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold mb-1 text-secondary-900 dark:text-gray-100">
                      {sessionData.total_violation_time || 0}s
                    </div>
                    <div className="text-xs text-secondary-600 dark:text-gray-400">Time Away</div>
                  </div>
                </div>

                <div className={`rounded-lg p-4 ${
                  (sessionData.security_score || 100) >= 80
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : (sessionData.security_score || 100) >= 60
                    ? 'bg-yellow-100 dark:bg-yellow-900/30'
                    : 'bg-red-100 dark:bg-red-900/30'
                }`}>
                  <p className="text-sm text-secondary-700 dark:text-gray-300">
                    {(sessionData.security_score || 100) >= 80 ? (
                      <>
                        <strong>✓ Excellent!</strong> You maintained excellent focus throughout the interview.
                        No significant violations were detected.
                      </>
                    ) : (sessionData.security_score || 100) >= 60 ? (
                      <>
                        <strong>⚠ Good Attempt!</strong> Some minor distractions were detected.
                        Try to stay more focused in future interviews for better results.
                      </>
                    ) : (
                      <>
                        <strong>⚠ Attention Required!</strong> Multiple violations were detected during the interview.
                        This may affect the credibility of your results. Please ensure better focus in future attempts.
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}

            <div className="mb-8">
              <h3 className="text-xl font-bold text-secondary-900 dark:text-gray-100 mb-4">
                Question-by-Question Breakdown
              </h3>
              <div className="space-y-4">
                {sessionData.responses.map((response, idx) => {
                  const question = sessionData.questions.find(q => q.id === response.question_id);
                  const feedback = response.ai_feedback_json as AIFeedback;

                  return (
                    <div key={response.id} className="bg-secondary-50 dark:bg-dark-300 rounded-xl p-6 border border-secondary-200 dark:border-dark-400">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-blue-500 text-white px-2 py-1 rounded text-sm font-semibold">
                          Q{idx + 1}
                        </span>
                        {(() => {
                          const meta: string[] = [];
                          if (question?.category) meta.push(String(question.category));
                          if (question?.difficulty) meta.push(String(question.difficulty));
                          return meta.length > 0 ? (
                            <span className="text-xs text-secondary-600 dark:text-gray-400">
                              {meta.join(' • ')}
                            </span>
                          ) : null;
                        })()}
                      </div>
                          <p className="font-semibold text-secondary-900 dark:text-gray-100 mb-2">
                            {question?.question_text}
                          </p>
                        </div>
                        <div className={`text-2xl font-bold ${getScoreColor(response.individual_score || 0)} ml-4`}>
                          {response.individual_score?.toFixed(1)}/10
                        </div>
                      </div>

                      {feedback && (
                        <div className="space-y-3 mt-4">
                          {feedback.strengths && feedback.strengths.length > 0 && (
                            <div>
                              <p className="text-sm font-semibold text-green-600 dark:text-green-400 mb-1">
                                ✓ Strengths:
                              </p>
                              <ul className="text-sm text-secondary-700 dark:text-gray-300 ml-4 space-y-1">
                                {feedback.strengths.map((strength, i) => (
                                  <li key={i}>• {strength}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {feedback.suggestions && feedback.suggestions.length > 0 && (
                            <div>
                              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-1">
                                💡 Suggestions:
                              </p>
                              <ul className="text-sm text-secondary-700 dark:text-gray-300 ml-4 space-y-1">
                                {feedback.suggestions.map((suggestion, i) => (
                                  <li key={i}>• {suggestion}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {feedback.tone_confidence_rating && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-secondary-600 dark:text-gray-400">Tone & Confidence:</span>
                              <span className="font-semibold text-secondary-900 dark:text-gray-100">
                                {feedback.tone_confidence_rating}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={onRetake}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg"
              >
                <RotateCcw className="w-5 h-5" />
                Retake Interview
              </button>

              <button
                onClick={onBackHome}
                className="flex items-center gap-2 px-6 py-3 bg-secondary-200 dark:bg-dark-300 text-secondary-900 dark:text-gray-100 rounded-xl font-semibold hover:bg-secondary-300 dark:hover:bg-dark-400 transition-all"
              >
                <Home className="w-5 h-5" />
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
