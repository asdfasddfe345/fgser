import React, { useEffect, useState } from 'react';
import { Award, TrendingUp, Code, MessageSquare, Briefcase, Brain, CheckCircle, AlertCircle, Clock, Target } from 'lucide-react';
import { interviewReportService, InterviewReport } from '../../services/interviewReportService';

interface InterviewReportViewerProps {
  sessionId: string;
}

export const InterviewReportViewer: React.FC<InterviewReportViewerProps> = ({ sessionId }) => {
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadReport();
  }, [sessionId]);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      let existingReport = await interviewReportService.getReport(sessionId);

      if (!existingReport) {
        setIsGenerating(true);
        const generatedReport = await interviewReportService.generateComprehensiveReport(sessionId);
        setReport(generatedReport);
        setIsGenerating(false);
      } else {
        setReport({
          sessionId: existingReport.session_id,
          overallPerformance: existingReport.overall_performance,
          categoryScores: {
            projectKnowledge: existingReport.project_knowledge_score,
            codingProficiency: existingReport.coding_proficiency_score,
            problemSolving: existingReport.problem_solving_score,
            communication: existingReport.communication_score
          },
          strengths: existingReport.strengths,
          areasForImprovement: existingReport.areas_for_improvement,
          questionBreakdown: existingReport.detailed_breakdown,
          projectSpecificFeedback: existingReport.project_specific_feedback,
          recommendedTopics: existingReport.recommended_topics,
          nextSteps: ['Review feedback', 'Practice recommended topics', 'Retake interview']
        });
      }
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || isGenerating) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-gray-800">
            {isGenerating ? 'Generating Your Report...' : 'Loading Report...'}
          </p>
          <p className="text-gray-600 mt-2">Analyzing your interview performance</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-800">Report Not Found</p>
        </div>
      </div>
    );
  }

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'Excellent': return 'text-green-600 bg-green-100';
      case 'Good': return 'text-blue-600 bg-blue-100';
      case 'Average': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-red-600 bg-red-100';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Interview Performance Report</h1>
            <Award className="w-12 h-12 text-yellow-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-lg">
              <div className="text-sm text-gray-600 mb-2">Overall Score</div>
              <div className={`text-5xl font-bold mb-2 ${getScoreColor(report.overallPerformance.score)}`}>
                {report.overallPerformance.score}/100
              </div>
              <div className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${getRatingColor(report.overallPerformance.rating)}`}>
                {report.overallPerformance.rating}
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-3">Performance Summary</h3>
              <p className="text-gray-700 leading-relaxed">{report.overallPerformance.summary}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <TrendingUp className="w-6 h-6" />
            Category Breakdown
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-gray-800">Project Knowledge</span>
                </div>
                <span className={`text-2xl font-bold ${getScoreColor(report.categoryScores.projectKnowledge)}`}>
                  {report.categoryScores.projectKnowledge}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${report.categoryScores.projectKnowledge}%` }}
                />
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Code className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-gray-800">Coding Proficiency</span>
                </div>
                <span className={`text-2xl font-bold ${getScoreColor(report.categoryScores.codingProficiency)}`}>
                  {report.categoryScores.codingProficiency}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${report.categoryScores.codingProficiency}%` }}
                />
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold text-gray-800">Problem Solving</span>
                </div>
                <span className={`text-2xl font-bold ${getScoreColor(report.categoryScores.problemSolving)}`}>
                  {report.categoryScores.problemSolving}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${report.categoryScores.problemSolving}%` }}
                />
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-orange-600" />
                  <span className="font-semibold text-gray-800">Communication</span>
                </div>
                <span className={`text-2xl font-bold ${getScoreColor(report.categoryScores.communication)}`}>
                  {report.categoryScores.communication}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-orange-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${report.categoryScores.communication}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-600" />
              Strengths
            </h3>
            <ul className="space-y-2">
              {report.strengths.map((strength, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span className="text-gray-700">{strength}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Target className="w-6 h-6 text-orange-600" />
              Areas for Improvement
            </h3>
            <ul className="space-y-2">
              {report.areasForImprovement.map((area, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-orange-600 mt-1">•</span>
                  <span className="text-gray-700">{area}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="w-6 h-6" />
            Question-by-Question Analysis
          </h3>
          <div className="space-y-4">
            {report.questionBreakdown.map((question, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-800">Q{question.questionNumber}</span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        {question.questionType}
                      </span>
                      <span className="text-sm text-gray-600">
                        {Math.floor(question.timeSpent / 60)}:{(question.timeSpent % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                    <p className="text-gray-700 text-sm mb-2">{question.questionText}</p>
                    <p className="text-gray-600 text-sm italic">{question.feedback}</p>
                  </div>
                  <div className={`text-2xl font-bold ml-4 ${getScoreColor(question.score)}`}>
                    {question.score}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {report.projectSpecificFeedback.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Project-Specific Feedback</h3>
            <div className="space-y-4">
              {report.projectSpecificFeedback.map((feedback, idx) => (
                <div key={idx} className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-semibold text-gray-800 mb-2">{feedback.projectName}</h4>
                  <p className="text-gray-700 mb-2">Understanding: <span className="font-medium">{feedback.understanding}</span></p>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Recommendations:</span>
                    <ul className="mt-1 ml-4">
                      {feedback.recommendations.map((rec, ridx) => (
                        <li key={ridx}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Recommended Topics to Study</h3>
          <div className="flex flex-wrap gap-2">
            {report.recommendedTopics.map((topic, idx) => (
              <span key={idx} className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm">
                {topic}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-xl font-bold mb-4">Next Steps</h3>
          <ul className="space-y-2">
            {report.nextSteps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-1">{idx + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
