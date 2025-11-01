import { supabase } from '../lib/supabaseClient';
import { deepseekService } from './deepseekService';

export interface LogicReviewQuestion {
  id: string;
  response_id: string;
  session_id: string;
  original_question_id: string;
  review_question_number: number;
  question_type: string;
  question_text: string;
  code_section_reference?: string;
  expected_concepts: string[];
}

export interface LogicReviewResponse {
  id: string;
  review_question_id: string;
  response_id: string;
  session_id: string;
  explanation_text: string;
  audio_transcript?: string;
  understanding_score?: number;
  ai_feedback?: any;
  concepts_covered: string[];
  concepts_missed: string[];
  response_duration_seconds?: number;
}

class CodeLogicReviewService {
  async generateReviewQuestions(
    code: string,
    language: string,
    originalQuestion: string,
    responseId: string,
    sessionId: string,
    questionId: string
  ): Promise<LogicReviewQuestion[]> {
    try {
      const prompt = `You are an expert coding interviewer conducting a code review. The candidate has submitted the following code:

Original Question: ${originalQuestion}

Programming Language: ${language}

Code Submitted:
\`\`\`${language.toLowerCase()}
${code}
\`\`\`

Generate 3 follow-up questions to assess the candidate's understanding of their code. Focus on:
1. Time and space complexity analysis
2. Logic explanation and approach
3. Edge cases and potential improvements

Return a JSON array of questions in this format:
[
  {
    "question_type": "complexity" | "logic" | "edge_cases" | "optimization",
    "question_text": "<the question to ask>",
    "code_section_reference": "<specific part of code this refers to, if applicable>",
    "expected_concepts": ["<concept1>", "<concept2>"]
  }
]`;

      const response = await deepseekService.generateText(prompt, { maxTokens: 800 });
      const questions = JSON.parse(response);

      const savedQuestions: LogicReviewQuestion[] = [];

      for (let i = 0; i < questions.length && i < 3; i++) {
        const q = questions[i];
        const { data, error } = await supabase
          .from('code_logic_review_questions')
          .insert({
            response_id: responseId,
            session_id: sessionId,
            original_question_id: questionId,
            review_question_number: i + 1,
            question_type: q.question_type,
            question_text: q.question_text,
            code_section_reference: q.code_section_reference,
            expected_concepts: q.expected_concepts || []
          })
          .select()
          .single();

        if (!error && data) {
          savedQuestions.push(data);
        }
      }

      return savedQuestions;
    } catch (error) {
      console.error('Error generating review questions:', error);
      return this.generateDefaultReviewQuestions(
        code,
        language,
        responseId,
        sessionId,
        questionId
      );
    }
  }

  private async generateDefaultReviewQuestions(
    code: string,
    language: string,
    responseId: string,
    sessionId: string,
    questionId: string
  ): Promise<LogicReviewQuestion[]> {
    const defaultQuestions = [
      {
        review_question_number: 1,
        question_type: 'complexity',
        question_text: 'What is the time complexity of your solution? Can you explain how you determined this?',
        expected_concepts: ['Time complexity', 'Big O notation', 'Algorithm analysis']
      },
      {
        review_question_number: 2,
        question_type: 'logic',
        question_text: 'Walk me through your approach. Why did you choose this particular method to solve the problem?',
        expected_concepts: ['Problem-solving approach', 'Algorithm choice', 'Trade-offs']
      },
      {
        review_question_number: 3,
        question_type: 'edge_cases',
        question_text: 'What edge cases did you consider? Are there any scenarios where your code might fail?',
        expected_concepts: ['Edge cases', 'Input validation', 'Error handling']
      }
    ];

    const savedQuestions: LogicReviewQuestion[] = [];

    for (const q of defaultQuestions) {
      const { data, error } = await supabase
        .from('code_logic_review_questions')
        .insert({
          response_id: responseId,
          session_id: sessionId,
          original_question_id: questionId,
          ...q
        })
        .select()
        .single();

      if (!error && data) {
        savedQuestions.push(data);
      }
    }

    return savedQuestions;
  }

  async saveReviewResponse(
    reviewQuestionId: string,
    responseId: string,
    sessionId: string,
    explanationText: string,
    audioTranscript?: string,
    responseDuration?: number
  ): Promise<LogicReviewResponse> {
    const reviewQuestion = await this.getReviewQuestion(reviewQuestionId);

    if (!reviewQuestion) {
      throw new Error('Review question not found');
    }

    const evaluation = await this.evaluateExplanation(
      reviewQuestion.question_text,
      explanationText,
      reviewQuestion.expected_concepts
    );

    const { data, error } = await supabase
      .from('code_logic_review_responses')
      .insert({
        review_question_id: reviewQuestionId,
        response_id: responseId,
        session_id: sessionId,
        explanation_text: explanationText,
        audio_transcript: audioTranscript,
        understanding_score: evaluation.score,
        ai_feedback: evaluation.feedback,
        concepts_covered: evaluation.conceptsCovered,
        concepts_missed: evaluation.conceptsMissed,
        response_duration_seconds: responseDuration
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving review response:', error);
      throw new Error('Failed to save review response');
    }

    return data;
  }

  private async getReviewQuestion(reviewQuestionId: string): Promise<LogicReviewQuestion | null> {
    const { data, error } = await supabase
      .from('code_logic_review_questions')
      .select('*')
      .eq('id', reviewQuestionId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching review question:', error);
      return null;
    }

    return data;
  }

  private async evaluateExplanation(
    question: string,
    explanation: string,
    expectedConcepts: string[]
  ): Promise<{
    score: number;
    feedback: any;
    conceptsCovered: string[];
    conceptsMissed: string[];
  }> {
    try {
      const prompt = `You are an expert coding interviewer evaluating a candidate's explanation of their code.

Review Question: ${question}

Expected Concepts: ${expectedConcepts.join(', ')}

Candidate's Explanation: ${explanation}

Evaluate the explanation and return JSON:
{
  "score": <number 0-100>,
  "conceptsCovered": [<concepts they explained well>],
  "conceptsMissed": [<concepts they didn't cover>],
  "feedback": "<detailed feedback on their understanding>"
}`;

      const response = await deepseekService.generateText(prompt, { maxTokens: 500 });
      const evaluation = JSON.parse(response);

      return {
        score: evaluation.score,
        feedback: evaluation,
        conceptsCovered: evaluation.conceptsCovered || [],
        conceptsMissed: evaluation.conceptsMissed || []
      };
    } catch (error) {
      console.error('Error evaluating explanation:', error);
      return {
        score: 60,
        feedback: { feedback: 'Unable to evaluate explanation automatically.' },
        conceptsCovered: [],
        conceptsMissed: expectedConcepts
      };
    }
  }

  async getReviewQuestions(responseId: string): Promise<LogicReviewQuestion[]> {
    const { data, error } = await supabase
      .from('code_logic_review_questions')
      .select('*')
      .eq('response_id', responseId)
      .order('review_question_number', { ascending: true });

    if (error) {
      console.error('Error fetching review questions:', error);
      return [];
    }

    return data || [];
  }

  async getReviewResponses(responseId: string): Promise<LogicReviewResponse[]> {
    const { data, error } = await supabase
      .from('code_logic_review_responses')
      .select('*')
      .eq('response_id', responseId);

    if (error) {
      console.error('Error fetching review responses:', error);
      return [];
    }

    return data || [];
  }

  async calculateAverageReviewScore(responseId: string): Promise<number> {
    const responses = await this.getReviewResponses(responseId);

    if (responses.length === 0) {
      return 0;
    }

    const total = responses.reduce((sum, r) => sum + (r.understanding_score || 0), 0);
    return Math.round(total / responses.length);
  }
}

export const codeLogicReviewService = new CodeLogicReviewService();
