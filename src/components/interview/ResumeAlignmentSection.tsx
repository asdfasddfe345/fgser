import React from 'react';
import { FileText, CheckCircle, XCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { ResumeInterviewAlignment } from '../../types/resumeInterview';

interface ResumeAlignmentSectionProps {
  alignment: ResumeInterviewAlignment;
  resumeName?: string;
}

export const ResumeAlignmentSection: React.FC<ResumeAlignmentSectionProps> = ({
  alignment,
  resumeName
}) => {
  const getAlignmentColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getAlignmentBgColor = (score: number): string => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getAlignmentLabel = (score: number): string => {
    if (score >= 80) return 'Excellent Alignment';
    if (score >= 60) return 'Good Alignment';
    return 'Needs Improvement';
  };

  const getConfidenceIcon = (level: string) => {
    switch (level) {
      case 'high':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'medium':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'low':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const validatedSkills = alignment.skills_validated.filter(s => s.validated_in_interview);
  const notTestedSkills = alignment.skills_validated.filter(s => s.confidence_level === 'not_tested');
  const inconsistentSkills = alignment.skills_validated.filter(
    s => !s.validated_in_interview && s.confidence_level === 'low'
  );

  return (
    <div className="bg-white dark:bg-dark-200 rounded-2xl shadow-lg p-8 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-3 rounded-xl">
          <FileText className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-secondary-900 dark:text-gray-100">
            Resume-Interview Alignment
          </h2>
          {resumeName && (
            <p className="text-sm text-secondary-600 dark:text-gray-400">
              Based on: {resumeName}
            </p>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-dark-300 dark:to-dark-300 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-secondary-700 dark:text-gray-300 font-semibold">
              Overall Alignment Score
            </span>
            <span className={`text-3xl font-bold ${getAlignmentColor(alignment.overall_alignment_score)}`}>
              {alignment.overall_alignment_score}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-dark-400 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full ${getAlignmentBgColor(alignment.overall_alignment_score)} transition-all duration-500`}
              style={{ width: `${alignment.overall_alignment_score}%` }}
            ></div>
          </div>
          <p className={`mt-2 text-sm font-semibold ${getAlignmentColor(alignment.overall_alignment_score)}`}>
            {getAlignmentLabel(alignment.overall_alignment_score)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {alignment.credibility_assessment.consistent_answers}
            </p>
            <p className="text-xs text-green-700 dark:text-green-300 font-medium">
              Consistent Answers
            </p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {alignment.credibility_assessment.inconsistent_answers}
            </p>
            <p className="text-xs text-red-700 dark:text-red-300 font-medium">
              Inconsistent Answers
            </p>
          </div>
        </div>
      </div>

      {validatedSkills.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="font-bold text-green-900 dark:text-green-100">
              Verified Skills ({validatedSkills.length})
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {validatedSkills.map((skill, idx) => (
              <div
                key={idx}
                className="px-3 py-1.5 bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700 rounded-lg flex items-center gap-2"
              >
                {getConfidenceIcon(skill.confidence_level)}
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  {skill.skill_name}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-green-700 dark:text-green-300 mt-3">
            These skills from your resume were successfully demonstrated during the interview.
          </p>
        </div>
      )}

      {inconsistentSkills.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <h3 className="font-bold text-yellow-900 dark:text-yellow-100">
              Skills Needing Improvement ({inconsistentSkills.length})
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {inconsistentSkills.map((skill, idx) => (
              <div
                key={idx}
                className="px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700 rounded-lg flex items-center gap-2"
              >
                {getConfidenceIcon(skill.confidence_level)}
                <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  {skill.skill_name}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-3">
            Consider gaining more hands-on experience with these skills listed on your resume.
          </p>
        </div>
      )}

      {notTestedSkills.length > 0 && (
        <div className="bg-gray-50 dark:bg-dark-300 border border-gray-200 dark:border-dark-400 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="font-bold text-gray-900 dark:text-gray-100">
              Skills Not Tested ({notTestedSkills.length})
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {notTestedSkills.slice(0, 10).map((skill, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 bg-gray-100 dark:bg-dark-400 border border-gray-300 dark:border-dark-500 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {skill.skill_name}
              </span>
            ))}
            {notTestedSkills.length > 10 && (
              <span className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400">
                +{notTestedSkills.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}

      {alignment.credibility_assessment.overall_score < 70 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h3 className="font-bold text-red-900 dark:text-red-100">Credibility Alert</h3>
          </div>
          <p className="text-sm text-red-700 dark:text-red-300 mb-3">
            Your interview answers didn't consistently match your resume claims. This could be due to:
          </p>
          <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 ml-5 list-disc">
            <li>Nervousness affecting your ability to explain your experience</li>
            <li>Resume overstating your actual skill level</li>
            <li>Lack of recent practice with listed technologies</li>
          </ul>
        </div>
      )}

      {alignment.recommendations.length > 0 && (
        <div className="bg-blue-50 dark:bg-dark-300 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold text-blue-900 dark:text-blue-100">Recommendations</h3>
          </div>
          <ul className="space-y-2">
            {alignment.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="text-blue-600 dark:text-blue-400 font-bold mt-0.5">•</span>
                <span className="text-sm text-blue-800 dark:text-blue-200">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
