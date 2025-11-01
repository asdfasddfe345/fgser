import { supabase } from '../lib/supabaseClient';
import { InterviewConfig, InterviewCategory } from '../types/interview';
import { UserResume } from '../types/resumeInterview';
import { geminiService } from './geminiServiceWrapper';

export interface InterviewQuestion {
  id: string;
  question_number: number;
  question_type: 'introduction' | 'project' | 'technical' | 'coding' | 'behavioral' | 'hr' | 'follow_up';
  question_text: string;
  context?: any;
  requires_coding: boolean;
  programming_language?: string;
  difficulty_level: 'easy' | 'medium' | 'hard';
  expected_duration_minutes: number;
  related_skills: string[];
  related_project?: string;
}

export interface QuestionResponse {
  question_id: string;
  answer_text?: string;
  code_answer?: string;
  programming_language?: string;
  time_spent_seconds: number;
  quality_score?: number;
}

export interface FollowUpQuestion {
  question_text: string;
  reason: string;
  context: any;
}

class RealisticInterviewService {
  async generateInterviewQuestions(
    config: InterviewConfig,
    resume: UserResume
  ): Promise<InterviewQuestion[]> {
    const questions: InterviewQuestion[] = [];
    let questionNumber = 1;

    questions.push(this.createIntroductionQuestion(questionNumber++));

    if (resume.projects_list && resume.projects_list.length > 0) {
      const projectQuestions = await this.generateProjectQuestions(
        resume,
        questionNumber,
        config
      );
      questions.push(...projectQuestions);
      questionNumber += projectQuestions.length;
    }

    const technicalQuestions = await this.generateTechnicalQuestions(
      config,
      resume,
      questionNumber
    );
    questions.push(...technicalQuestions);
    questionNumber += technicalQuestions.length;

    if (config.interviewCategory === 'mixed' || config.interviewCategory === 'hr') {
      const hrQuestions = await this.generateHRQuestions(
        config,
        resume,
        questionNumber
      );
      questions.push(...hrQuestions);
    }

    return questions;
  }

  private createIntroductionQuestion(questionNumber: number): InterviewQuestion {
    return {
      id: `intro-${Date.now()}`,
      question_number: questionNumber,
      question_type: 'introduction',
      question_text: 'Please introduce yourself. Tell me about your background, current role, and what you\'re looking for in your next opportunity.',
      requires_coding: false,
      difficulty_level: 'easy',
      expected_duration_minutes: 3,
      related_skills: [],
      context: {
        is_introduction: true,
        listen_for: ['background', 'experience', 'goals', 'motivation']
      }
    };
  }

  async generateProjectQuestions(
    resume: UserResume,
    startingNumber: number,
    config: InterviewConfig
  ): Promise<InterviewQuestion[]> {
    const questions: InterviewQuestion[] = [];
    const projects = resume.projects_list || [];
    const maxProjects = Math.min(2, projects.length);

    for (let i = 0; i < maxProjects; i++) {
      const project = projects[i];

      const initialQuestion: InterviewQuestion = {
        id: `project-${i}-${Date.now()}`,
        question_number: startingNumber + (i * 2),
        question_type: 'project',
        question_text: `I see you worked on "${project.title || project.name || `Project ${i + 1}`}". Can you walk me through this project? What problem were you solving, and what was your role?`,
        requires_coding: false,
        difficulty_level: 'medium',
        expected_duration_minutes: 4,
        related_skills: project.technologies || [],
        related_project: project.title || project.name,
        context: {
          project_details: project,
          expect_topics: ['problem_statement', 'role', 'technologies', 'challenges', 'outcomes']
        }
      };

      questions.push(initialQuestion);

      const technicalDeepDive: InterviewQuestion = {
        id: `project-tech-${i}-${Date.now()}`,
        question_number: startingNumber + (i * 2) + 1,
        question_type: 'project',
        question_text: `What were the biggest technical challenges you faced in this project, and how did you overcome them?`,
        requires_coding: false,
        difficulty_level: 'medium',
        expected_duration_minutes: 3,
        related_skills: project.technologies || [],
        related_project: project.title || project.name,
        context: {
          project_details: project,
          expect_topics: ['challenges', 'problem_solving', 'technical_decisions']
        }
      };

      questions.push(technicalDeepDive);
    }

    return questions;
  }

  async generateTechnicalQuestions(
    config: InterviewConfig,
    resume: UserResume,
    startingNumber: number
  ): Promise<InterviewQuestion[]> {
    const questions: InterviewQuestion[] = [];
    const skills = resume.skills_detected || [];
    const topSkills = skills.slice(0, 5);

    if (topSkills.length === 0) {
      return [];
    }

    const prompt = `Generate 3-4 realistic technical interview questions for a ${config.targetRole} position${
      config.companyName ? ` at ${config.companyName}` : ''
    }.

Resume Skills: ${topSkills.join(', ')}
Experience Level: ${resume.experience_level || 'Mid-level'}
Interview Category: ${config.interviewCategory}

Requirements:
1. First question should be a conceptual/theoretical question about their main skill
2. Second question should be a coding problem (medium difficulty)
3. Third question should be about system design or architecture
4. Questions should feel natural and conversational, not robotic

Return ONLY a valid JSON array with this exact structure:
[
  {
    "question_text": "the question",
    "question_type": "technical" or "coding",
    "requires_coding": true/false,
    "programming_language": "Python" (if coding required),
    "difficulty_level": "easy/medium/hard",
    "expected_duration_minutes": 3-5,
    "related_skills": ["skill1", "skill2"]
  }
]`;

    try {
      const response = await geminiService.chat([
        { role: 'user', content: prompt }
      ]);

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const generatedQuestions = JSON.parse(jsonMatch[0]);

      generatedQuestions.forEach((q: any, index: number) => {
        questions.push({
          id: `tech-${index}-${Date.now()}`,
          question_number: startingNumber + index,
          question_type: q.requires_coding ? 'coding' : 'technical',
          question_text: q.question_text,
          requires_coding: q.requires_coding || false,
          programming_language: q.programming_language,
          difficulty_level: q.difficulty_level || 'medium',
          expected_duration_minutes: q.expected_duration_minutes || 4,
          related_skills: q.related_skills || topSkills.slice(0, 2),
          context: {
            generated_for_skills: topSkills,
            company: config.companyName
          }
        });
      });
    } catch (error) {
      console.error('Error generating technical questions:', error);
    }

    return questions;
  }

  async generateHRQuestions(
    config: InterviewConfig,
    resume: UserResume,
    startingNumber: number
  ): Promise<InterviewQuestion[]> {
    const hrQuestions: InterviewQuestion[] = [
      {
        id: `hr-1-${Date.now()}`,
        question_number: startingNumber,
        question_type: 'behavioral',
        question_text: 'Tell me about a time when you had to work under tight deadlines. How did you manage your time and priorities?',
        requires_coding: false,
        difficulty_level: 'medium',
        expected_duration_minutes: 3,
        related_skills: ['time management', 'prioritization'],
        context: {
          behavioral_type: 'time_management',
          star_expected: true
        }
      },
      {
        id: `hr-2-${Date.now()}`,
        question_number: startingNumber + 1,
        question_type: 'hr',
        question_text: config.companyName
          ? `Why do you want to work at ${config.companyName}? What do you know about our company culture?`
          : 'What are you looking for in your next role? What kind of work environment helps you thrive?',
        requires_coding: false,
        difficulty_level: 'easy',
        expected_duration_minutes: 2,
        related_skills: ['communication', 'cultural fit'],
        context: {
          company_specific: !!config.companyName
        }
      }
    ];

    return hrQuestions;
  }

  async analyzeAnswerAndGenerateFollowUp(
    question: InterviewQuestion,
    response: QuestionResponse,
    resume: UserResume
  ): Promise<FollowUpQuestion | null> {
    if (!response.answer_text || response.answer_text.length < 50) {
      return {
        question_text: 'Can you elaborate more on that? I\'d like to understand your thought process better.',
        reason: 'incomplete_answer',
        context: { original_question: question.question_text }
      };
    }

    if (question.question_type === 'project') {
      const prompt = `Analyze this interview response and determine if a follow-up question is needed.

Original Question: ${question.question_text}
Candidate's Answer: ${response.answer_text}
Project: ${question.related_project}
Skills: ${question.related_skills.join(', ')}

Does the answer:
1. Explain the technical approach clearly?
2. Mention specific technologies used?
3. Discuss challenges or results?

If the answer is vague or misses key technical details, generate ONE specific follow-up question that digs deeper into the technical implementation.

Return ONLY valid JSON:
{
  "needs_followup": true/false,
  "follow_up_question": "the question" (if needed),
  "reason": "why followup is needed"
}`;

      try {
        const aiResponse = await geminiService.chat([
          { role: 'user', content: prompt }
        ]);

        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const analysis = JSON.parse(jsonMatch[0]);

        if (analysis.needs_followup && analysis.follow_up_question) {
          return {
            question_text: analysis.follow_up_question,
            reason: analysis.reason || 'clarification_needed',
            context: {
              original_question: question.question_text,
              original_answer: response.answer_text
            }
          };
        }
      } catch (error) {
        console.error('Error analyzing answer:', error);
      }
    }

    if (question.question_type === 'coding' && response.code_answer) {
      return {
        question_text: 'Can you explain your code line by line? Walk me through your logic and any optimizations you made.',
        reason: 'code_explanation',
        context: {
          code: response.code_answer,
          language: response.programming_language
        }
      };
    }

    return null;
  }

  async generateCodeReviewQuestions(
    code: string,
    language: string,
    problemStatement: string
  ): Promise<string[]> {
    const prompt = `You are an experienced technical interviewer reviewing code during a live interview.

Problem: ${problemStatement}
Language: ${language}
Code:
\`\`\`${language}
${code}
\`\`\`

Generate 2-3 specific, realistic questions an interviewer would ask about this code:
1. Ask about a specific line or section and its purpose
2. Ask about potential edge cases or optimization
3. Ask why they chose a particular approach

Make questions conversational and natural. Return ONLY a JSON array of strings.`;

    try {
      const response = await geminiService.chat([
        { role: 'user', content: prompt }
      ]);

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [
          'Can you explain your approach to solving this problem?',
          'What edge cases did you consider?',
          'How would you optimize this solution?'
        ];
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error generating code review questions:', error);
      return [
        'Walk me through your solution step by step.',
        'What\'s the time and space complexity?',
        'How would you handle invalid inputs?'
      ];
    }
  }

  async createInterviewSession(
    userId: string,
    config: InterviewConfig,
    resumeId: string
  ): Promise<string> {
    try {
      console.log('Creating realistic interview session for user:', userId);

      const sessionData = {
        user_id: userId,
        session_type: config.sessionType,
        interview_category: config.interviewCategory,
        company_name: config.companyName,
        target_role: config.targetRole,
        duration_minutes: config.durationMinutes,
        resume_id: resumeId,
        status: 'in_progress',
        started_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('realistic_interview_sessions')
        .insert(sessionData)
        .select()
        .single();

      if (error) {
        console.error('Error creating interview session:', error);
        throw new Error(`Failed to create interview session: ${error.message}`);
      }

      if (!data || !data.id) {
        console.error('Session created but no ID returned:', data);
        throw new Error('Session was created but no ID was returned');
      }

      console.log('Interview session created successfully with ID:', data.id);

      localStorage.setItem(`interview_session_${data.id}`, JSON.stringify({
        sessionId: data.id,
        userId,
        config,
        createdAt: Date.now()
      }));

      return data.id;
    } catch (error) {
      console.error('Failed to create interview session:', error);
      throw error;
    }
  }

  async saveQuestionResponse(
    sessionId: string,
    question: InterviewQuestion,
    response: QuestionResponse
  ): Promise<void> {
    if (!sessionId) {
      console.error('Cannot save response: sessionId is null or undefined');
      throw new Error('Session ID is required to save response');
    }

    try {
      console.log('Saving response for session:', sessionId, 'question:', question.question_number);

      const { error } = await supabase
        .from('realistic_interview_responses')
        .insert({
          session_id: sessionId,
          question_number: question.question_number,
          question_type: question.question_type,
          question_text: question.question_text,
          answer_text: response.answer_text,
          code_answer: response.code_answer,
          programming_language: response.programming_language,
          time_spent_seconds: response.time_spent_seconds,
          quality_score: response.quality_score
        });

      if (error) {
        console.error('Error saving question response:', error);
        throw new Error(`Failed to save response: ${error.message}`);
      }

      console.log('Response saved successfully');
    } catch (error) {
      console.error('Failed to save question response:', error);
      throw error;
    }
  }

  async saveFollowUpResponse(
    sessionId: string,
    parentQuestionNumber: number,
    followUpQuestion: string,
    answer: string,
    timeSpent: number
  ): Promise<void> {
    if (!sessionId) {
      console.error('Cannot save follow-up: sessionId is null or undefined');
      throw new Error('Session ID is required to save follow-up response');
    }

    try {
      console.log('Saving follow-up response for session:', sessionId);

      const { error } = await supabase
        .from('realistic_interview_followups')
        .insert({
          session_id: sessionId,
          parent_question_number: parentQuestionNumber,
          follow_up_question: followUpQuestion,
          answer: answer,
          time_spent_seconds: timeSpent
        });

      if (error) {
        console.error('Error saving follow-up response:', error);
        throw new Error(`Failed to save follow-up: ${error.message}`);
      }

      console.log('Follow-up response saved successfully');
    } catch (error) {
      console.error('Failed to save follow-up response:', error);
      throw error;
    }
  }

  async completeSession(
    sessionId: string,
    actualDurationSeconds: number
  ): Promise<void> {
    if (!sessionId) {
      console.error('Cannot complete session: sessionId is null or undefined');
      throw new Error('Session ID is required to complete session');
    }

    try {
      console.log('Completing interview session:', sessionId);

      const { error } = await supabase
        .from('realistic_interview_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          actual_duration_seconds: actualDurationSeconds
        })
        .eq('id', sessionId);

      if (error) {
        console.error('Error completing session:', error);
        throw new Error(`Failed to complete session: ${error.message}`);
      }

      console.log('Session completed successfully');

      localStorage.removeItem(`interview_session_${sessionId}`);
    } catch (error) {
      console.error('Failed to complete session:', error);
      throw error;
    }
  }
}

export const realisticInterviewService = new RealisticInterviewService();
