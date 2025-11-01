import { supabase } from '../lib/supabaseClient';
import { geminiService } from './geminiServiceWrapper';

export interface InterviewReport {
  sessionId: string;
  overallPerformance: {
    score: number;
    rating: 'Excellent' | 'Good' | 'Average' | 'Needs Improvement';
    summary: string;
  };
  categoryScores: {
    projectKnowledge: number;
    codingProficiency: number;
    problemSolving: number;
    communication: number;
  };
  strengths: string[];
  areasForImprovement: string[];
  questionBreakdown: Array<{
    questionNumber: number;
    questionText: string;
    questionType: string;
    score: number;
    timeSpent: number;
    feedback: string;
  }>;
  projectSpecificFeedback: Array<{
    projectName: string;
    understanding: string;
    recommendations: string[];
  }>;
  recommendedTopics: string[];
  nextSteps: string[];
}

class InterviewReportService {
  async generateComprehensiveReport(sessionId: string): Promise<InterviewReport> {
    try {
      const session = await this.getSessionDetails(sessionId);
      const responses = await this.getSessionResponses(sessionId);
      const questions = await this.getSessionQuestions(sessionId);
      const followUps = await this.getFollowUpQuestions(sessionId);

      const categoryScores = this.calculateCategoryScores(responses, questions);
      const overallScore = this.calculateOverallScore(categoryScores);
      const overallPerformance = await this.generateOverallPerformance(
        overallScore,
        responses,
        questions
      );

      const strengths = this.extractStrengths(responses);
      const areasForImprovement = this.extractWeaknesses(responses);
      const questionBreakdown = this.createQuestionBreakdown(responses, questions);
      const projectSpecificFeedback = await this.generateProjectFeedback(responses, questions);
      const recommendedTopics = await this.generateRecommendations(
        areasForImprovement,
        categoryScores
      );

      const report: InterviewReport = {
        sessionId,
        overallPerformance,
        categoryScores,
        strengths,
        areasForImprovement,
        questionBreakdown,
        projectSpecificFeedback,
        recommendedTopics,
        nextSteps: this.generateNextSteps(categoryScores, areasForImprovement)
      };

      await this.saveReportToDatabase(session.user_id, report);

      return report;
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  }

  private async getSessionDetails(sessionId: string) {
    const { data, error } = await supabase
      .from('adaptive_interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) throw error;
    return data;
  }

  private async getSessionResponses(sessionId: string) {
    const { data, error } = await supabase
      .from('interview_responses_detailed')
      .select('*')
      .eq('session_id', sessionId)
      .order('submitted_at');

    if (error) throw error;
    return data || [];
  }

  private async getSessionQuestions(sessionId: string) {
    const { data, error } = await supabase
      .from('interview_questions_dynamic')
      .select('*')
      .eq('session_id', sessionId)
      .order('question_number');

    if (error) throw error;
    return data || [];
  }

  private async getFollowUpQuestions(sessionId: string) {
    const { data, error } = await supabase
      .from('follow_up_questions')
      .select('*')
      .eq('session_id', sessionId)
      .order('asked_at');

    if (error) throw error;
    return data || [];
  }

  private calculateCategoryScores(responses: any[], questions: any[]) {
    const categoryScores = {
      projectKnowledge: 0,
      codingProficiency: 0,
      problemSolving: 0,
      communication: 0
    };

    const categoryCounts = {
      projectKnowledge: 0,
      codingProficiency: 0,
      problemSolving: 0,
      communication: 0
    };

    responses.forEach((response, idx) => {
      const question = questions.find(q => q.id === response.question_id);
      if (!question) return;

      const score = response.score || 50;

      if (question.question_type === 'project_specific') {
        categoryScores.projectKnowledge += score;
        categoryCounts.projectKnowledge++;
      }

      if (question.requires_coding) {
        categoryScores.codingProficiency += score;
        categoryCounts.codingProficiency++;
      }

      if (question.question_type === 'coding' || question.question_type === 'technical') {
        categoryScores.problemSolving += score;
        categoryCounts.problemSolving++;
      }

      if (response.ai_analysis?.clarity) {
        categoryScores.communication += response.ai_analysis.clarity;
        categoryCounts.communication++;
      }
    });

    return {
      projectKnowledge: categoryCounts.projectKnowledge > 0
        ? Math.round(categoryScores.projectKnowledge / categoryCounts.projectKnowledge)
        : 0,
      codingProficiency: categoryCounts.codingProficiency > 0
        ? Math.round(categoryScores.codingProficiency / categoryCounts.codingProficiency)
        : 0,
      problemSolving: categoryCounts.problemSolving > 0
        ? Math.round(categoryScores.problemSolving / categoryCounts.problemSolving)
        : 0,
      communication: categoryCounts.communication > 0
        ? Math.round(categoryScores.communication / categoryCounts.communication)
        : 0
    };
  }

  private calculateOverallScore(categoryScores: any): number {
    const scores = Object.values(categoryScores).filter(s => s > 0);
    return scores.length > 0
      ? Math.round(scores.reduce((sum: number, s: any) => sum + s, 0) / scores.length)
      : 0;
  }

  private async generateOverallPerformance(
    score: number,
    responses: any[],
    questions: any[]
  ) {
    const rating = this.getRating(score);

    const prompt = `
You are an expert interview evaluator. Generate a concise overall performance summary.

Overall Score: ${score}/100
Rating: ${rating}
Total Questions: ${questions.length}
Total Responses: ${responses.length}

Response Quality Breakdown:
${responses.map((r, idx) => `Q${idx + 1}: ${r.score || 50}/100`).join('\n')}

Generate a 2-3 sentence summary of the candidate's overall performance.
Return ONLY the summary text, no additional formatting.
`;

    try {
      const summary = await geminiService.generateText(prompt);
      return {
        score,
        rating,
        summary: summary.trim()
      };
    } catch (error) {
      return {
        score,
        rating,
        summary: `Overall performance was ${rating.toLowerCase()} with a score of ${score}/100.`
      };
    }
  }

  private getRating(score: number): 'Excellent' | 'Good' | 'Average' | 'Needs Improvement' {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Average';
    return 'Needs Improvement';
  }

  private extractStrengths(responses: any[]): string[] {
    const allStrengths = new Set<string>();

    responses.forEach(response => {
      if (response.strengths && Array.isArray(response.strengths)) {
        response.strengths.forEach((s: string) => allStrengths.add(s));
      }
    });

    return Array.from(allStrengths).slice(0, 8);
  }

  private extractWeaknesses(responses: any[]): string[] {
    const allWeaknesses = new Set<string>();

    responses.forEach(response => {
      if (response.weaknesses && Array.isArray(response.weaknesses)) {
        response.weaknesses.forEach((w: string) => allWeaknesses.add(w));
      }
    });

    return Array.from(allWeaknesses).slice(0, 8);
  }

  private createQuestionBreakdown(responses: any[], questions: any[]) {
    return responses.map((response, idx) => {
      const question = questions.find(q => q.id === response.question_id);

      return {
        questionNumber: idx + 1,
        questionText: question?.question_text || 'Question not found',
        questionType: question?.question_type || 'unknown',
        score: response.score || 0,
        timeSpent: response.time_spent_seconds || 0,
        feedback: this.generateQuestionFeedback(response)
      };
    });
  }

  private generateQuestionFeedback(response: any): string {
    const analysis = response.ai_analysis || {};
    const parts: string[] = [];

    if (analysis.clarity) {
      parts.push(`Clarity: ${analysis.clarity}/100`);
    }
    if (analysis.technicalDepth) {
      parts.push(`Technical Depth: ${analysis.technicalDepth}/100`);
    }

    if (response.strengths?.length > 0) {
      parts.push(`Strengths: ${response.strengths[0]}`);
    }

    return parts.join('. ') || 'Response recorded';
  }

  private async generateProjectFeedback(responses: any[], questions: any[]) {
    const projectFeedback: Array<{
      projectName: string;
      understanding: string;
      recommendations: string[];
    }> = [];

    const projectQuestions = questions.filter(q => q.question_type === 'project_specific');

    for (const question of projectQuestions) {
      const response = responses.find(r => r.question_id === question.id);
      if (!response || !question.related_project) continue;

      const understanding = response.score >= 70 ? 'Strong' : response.score >= 50 ? 'Moderate' : 'Limited';
      const recommendations = response.weaknesses || ['Review project architecture and design decisions'];

      projectFeedback.push({
        projectName: question.related_project,
        understanding,
        recommendations
      });
    }

    return projectFeedback;
  }

  private async generateRecommendations(weaknesses: string[], categoryScores: any) {
    const recommendations: string[] = [];

    if (categoryScores.codingProficiency < 70) {
      recommendations.push('Practice data structures and algorithms');
      recommendations.push('Focus on code optimization and efficiency');
    }

    if (categoryScores.projectKnowledge < 70) {
      recommendations.push('Deep dive into system architecture patterns');
      recommendations.push('Document technical decisions in your projects');
    }

    if (categoryScores.problemSolving < 70) {
      recommendations.push('Solve more LeetCode/HackerRank problems');
      recommendations.push('Study common algorithm patterns');
    }

    if (categoryScores.communication < 70) {
      recommendations.push('Practice explaining technical concepts clearly');
      recommendations.push('Work on structuring your responses');
    }

    return recommendations.slice(0, 6);
  }

  private generateNextSteps(categoryScores: any, weaknesses: string[]): string[] {
    const steps: string[] = [
      'Review the detailed feedback for each question',
      'Practice the recommended topics and skills'
    ];

    const lowestCategory = Object.entries(categoryScores)
      .sort(([, a]: any, [, b]: any) => a - b)[0];

    if (lowestCategory) {
      const categoryName = lowestCategory[0].replace(/([A-Z])/g, ' $1').toLowerCase();
      steps.push(`Focus on improving your ${categoryName}`);
    }

    steps.push('Take another mock interview in 1-2 weeks');
    steps.push('Apply learnings in real interview scenarios');

    return steps;
  }

  private async saveReportToDatabase(userId: string, report: InterviewReport) {
    const { error } = await supabase
      .from('interview_feedback_comprehensive')
      .insert({
        session_id: report.sessionId,
        user_id: userId,
        overall_performance: report.overallPerformance,
        project_knowledge_score: report.categoryScores.projectKnowledge,
        coding_proficiency_score: report.categoryScores.codingProficiency,
        problem_solving_score: report.categoryScores.problemSolving,
        communication_score: report.categoryScores.communication,
        strengths: report.strengths,
        areas_for_improvement: report.areasForImprovement,
        project_specific_feedback: report.projectSpecificFeedback,
        recommended_topics: report.recommendedTopics,
        detailed_breakdown: report.questionBreakdown
      });

    if (error) throw error;
  }

  async getReport(sessionId: string) {
    const { data, error } = await supabase
      .from('interview_feedback_comprehensive')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data;
  }

  async getUserReports(userId: string) {
    const { data, error } = await supabase
      .from('interview_feedback_comprehensive')
      .select(`
        *,
        adaptive_interview_sessions (
          created_at,
          total_questions,
          total_duration_seconds
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
}

export const interviewReportService = new InterviewReportService();
