import { supabase } from '../lib/supabaseClient';
import { geminiService } from './geminiServiceWrapper';
import { interviewService } from './interviewService';
import {
  UserResume,
  QuestionGenerationMode,
  DynamicQuestionContext,
  GeneratedQuestion
} from '../types/resumeInterview';
import {
  InterviewQuestion,
  QuestionCategory,
  QuestionDifficulty,
  InterviewConfig
} from '../types/interview';

class HybridQuestionService {
  async selectQuestionsForInterview(
    config: InterviewConfig,
    resume: UserResume,
    totalQuestions: number = 10
  ): Promise<InterviewQuestion[]> {
    const mode: QuestionGenerationMode = 'hybrid';

    // Ensure a well-rounded interview: mix DB and AI, and cover categories.
    const desiredDbCount = Math.ceil(totalQuestions * 0.6);

    // Exclude questions the user has already seen for this company/role when possible
    const previouslyAskedIds = await this.getPreviouslyAskedQuestionIds(resume.user_id, config);

    const databaseQuestions = await this.selectDatabaseQuestions(
      config,
      resume,
      desiredDbCount,
      totalQuestions,
      new Set(previouslyAskedIds)
    );

    // If DB couldn't fill due to exclusions, top up with AI so total matches
    const remainingForAI = Math.max(0, totalQuestions - databaseQuestions.length);
    const aiQuestions = await this.generateAIQuestions(config, resume, remainingForAI);

    const allQuestions = [...databaseQuestions, ...aiQuestions];
    return this.shuffleQuestions(allQuestions);
  }

  private async selectDatabaseQuestions(
    config: InterviewConfig,
    resume: UserResume,
    count: number,
    totalPlanned: number,
    excludeIds: Set<string>
  ): Promise<InterviewQuestion[]> {
    const categories = this.getCategoriesForConfig(config);
    const desiredMix = this.getDesiredCategoryMix(config, resume, totalPlanned);

    const perCategorySelected: InterviewQuestion[] = [];
    const remainingPool: { question: InterviewQuestion; score: number }[] = [];

    // Fetch and score per-category to guarantee coverage
    for (const cat of categories) {
      const take = desiredMix[cat] ? Math.min(desiredMix[cat], count - perCategorySelected.length) : 0;
      if (take <= 0) continue;

      let query = supabase
        .from('interview_questions')
        .select('*')
        .eq('is_active', true)
        .eq('is_dynamic', false)
        .eq('category', cat);

      if (config.companyName) {
        const roleFilter = config.targetRole ? `,role.eq.${config.targetRole}` : '';
        // Prefer company-specific questions for the chosen company/role, but allow general as fallback
        query = query.or(
          `interview_type.eq.general,and(interview_type.eq.company-specific,company_name.eq.${config.companyName}${roleFilter})`
        );
      } else {
        query = query.eq('interview_type', 'general');
      }

      const { data: catQuestions, error } = await query;
      if (error || !catQuestions || catQuestions.length === 0) continue;
      // Filter out previously asked questions
      const fresh = (catQuestions as any[]).filter(q => !excludeIds.has(q.id));
      const pool = fresh.length > 0 ? fresh : (catQuestions as any[]); // fallback if all were previously asked

      const scored = pool.map(q => ({ question: q as unknown as InterviewQuestion, score: this.calculateRelevanceScore(q as any, resume) }));
      scored.sort((a, b) => b.score - a.score);

      const picked = scored.slice(0, take).map(s => s.question);
      perCategorySelected.push(...picked);

      // Save leftovers to fill any remaining slots later
      remainingPool.push(...scored.slice(take));
      if (perCategorySelected.length >= count) break;
    }

    // Fill remaining with highest-scoring leftovers across categories
    if (perCategorySelected.length < count) {
      remainingPool.sort((a, b) => b.score - a.score);
      const needed = count - perCategorySelected.length;
      perCategorySelected.push(...remainingPool.slice(0, needed).map(s => s.question));
    }

    return perCategorySelected;
  }

  private calculateRelevanceScore(
    question: InterviewQuestion,
    resume: UserResume
  ): number {
    let score = 0;

    const text = question.question_text.toLowerCase();
    const resumeSkills = (resume.skills_detected || []).map(s => s.toLowerCase());
    const projectTechs = (resume.parsed_data?.projects || []).flatMap(p => (p.technologies || []).map(t => t.toLowerCase()));
    const workTechs = (resume.parsed_data?.work_experience || []).flatMap(w => (w.technologies || []).map(t => t.toLowerCase()));

    // Skills matches
    for (const skill of resumeSkills) {
      if (text.includes(skill)) score += 10;
    }

    // Project/experience technology matches weigh a bit more to drive project questions
    for (const tech of projectTechs) {
      if (text.includes(tech)) score += 6;
    }
    for (const tech of workTechs) {
      if (text.includes(tech)) score += 4;
    }

    // Small boost for category alignment if projects exist
    if (question.category === 'Projects' && (resume.parsed_data?.projects?.length || 0) > 0) {
      score += 8;
    }

    if (question.difficulty === 'Easy') score += 1;
    else if (question.difficulty === 'Medium') score += 2;
    else if (question.difficulty === 'Hard') score += 3;

    const experienceMap: Record<string, number> = {
      entry: 1,
      junior: 2,
      mid: 3,
      senior: 4,
      lead: 5,
      executive: 6
    };

    const difficultyMap: Record<string, number> = {
      Easy: 1,
      Medium: 2,
      Hard: 3
    };

    const expLevel = experienceMap[resume.experience_level || 'junior'] || 2;
    const qDifficulty = difficultyMap[question.difficulty] || 2;

    if (Math.abs(expLevel - qDifficulty) <= 1) {
      score += 5;
    }

    return score + Math.random() * 2;
  }

  // Compute target per-category distribution to ensure "all-in-one" coverage
  private getDesiredCategoryMix(
    config: InterviewConfig,
    resume: UserResume,
    total: number
  ): Record<QuestionCategory, number> {
    const categories = this.getCategoriesForConfig(config);
    const mix: Record<QuestionCategory, number> = {
      Technical: 0,
      HR: 0,
      Behavioral: 0,
      Coding: 0,
      Projects: 0,
    } as Record<QuestionCategory, number>;

    if (config.interviewCategory === 'technical') {
      mix.Technical = Math.round(total * 0.5);
      mix.Coding = Math.round(total * 0.3);
      mix.Projects = Math.max(1, total - (mix.Technical + mix.Coding));
    } else if (config.interviewCategory === 'hr') {
      mix.HR = Math.round(total * 0.6);
      mix.Behavioral = total - mix.HR;
    } else {
      // Mixed: aim for broad coverage with slight emphasis on Technical
      mix.Technical = Math.round(total * 0.4);
      mix.Coding = Math.round(total * 0.2);
      mix.Behavioral = Math.max(1, Math.round(total * 0.15));
      mix.HR = Math.max(1, Math.round(total * 0.15));
      mix.Projects = Math.max(1, total - (mix.Technical + mix.Coding + mix.Behavioral + mix.HR));
    }

    // If no projects on resume, reallocate Projects quota to Technical
    const hasProjects = (resume.parsed_data?.projects?.length || 0) > 0;
    if (!hasProjects) {
      mix.Technical += mix.Projects;
      mix.Projects = 0;
    }

    // Only keep categories allowed by config
    for (const key of Object.keys(mix) as QuestionCategory[]) {
      if (!categories.includes(key)) mix[key] = 0;
    }

    // Ensure total does not exceed target
    const sum = (Object.values(mix) as number[]).reduce((a, b) => a + b, 0);
    if (sum > total) {
      // scale down proportionally
      const ratio = total / sum;
      (Object.keys(mix) as QuestionCategory[]).forEach(k => {
        mix[k] = Math.floor(mix[k] * ratio);
      });
      // Fill any rounding deficit
      let deficit = total - (Object.values(mix) as number[]).reduce((a, b) => a + b, 0);
      for (const k of ['Technical', 'Coding', 'Behavioral', 'HR', 'Projects'] as QuestionCategory[]) {
        if (deficit <= 0) break;
        if (categories.includes(k)) { mix[k] += 1; deficit--; }
      }
    }

    return mix;
  }

  // Fetch question_ids the user has already answered in similar sessions to avoid repetition
  private async getPreviouslyAskedQuestionIds(
    userId: string,
    config: InterviewConfig
  ): Promise<string[]> {
    try {
      // First fetch recent sessions for this user that match company/role if provided
      let sessionQuery = supabase
        .from('mock_interview_sessions')
        .select('id, company_name, target_role, interview_category, session_type')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(10);

      const { data: sessions, error: sErr } = await sessionQuery;
      if (sErr || !sessions || sessions.length === 0) return [];

      // Prefer sessions for the same company/role, otherwise include recent ones
      const matching = sessions.filter((s: any) =>
        (config.companyName ? s.company_name === config.companyName : true) &&
        (config.targetRole ? s.target_role === config.targetRole : true)
      );

      const sessionIds = (matching.length > 0 ? matching : sessions).map((s: any) => s.id);
      if (sessionIds.length === 0) return [];

      const { data: responses, error: rErr } = await supabase
        .from('interview_responses')
        .select('question_id')
        .in('session_id', sessionIds)
        .limit(500);

      if (rErr || !responses) return [];
      const ids = Array.from(new Set(responses.map((r: any) => r.question_id).filter(Boolean)));
      return ids as string[];
    } catch (e) {
      console.error('getPreviouslyAskedQuestionIds failed:', e);
      return [];
    }
  }

  private async generateAIQuestions(
    config: InterviewConfig,
    resume: UserResume,
    count: number
  ): Promise<InterviewQuestion[]> {
    const generatedQuestions: InterviewQuestion[] = [];

    for (let i = 0; i < count; i++) {
      try {
        const question = await this.generateSingleQuestion(config, resume, i);
        if (question) {
          generatedQuestions.push(question);
        }
      } catch (error) {
        console.error(`Failed to generate question ${i + 1}:`, error);
      }
    }

    return generatedQuestions;
  }

  async generateSingleQuestion(
    config: InterviewConfig,
    resume: UserResume,
    index: number
  ): Promise<InterviewQuestion | null> {
    const context: DynamicQuestionContext = {
      resume_id: resume.id,
      user_id: resume.user_id,
      skill_being_tested: resume.skills_detected[index % resume.skills_detected.length] || 'general',
      experience_level: resume.experience_level || 'junior',
      specific_project: resume.parsed_data?.projects?.[0]?.name,
      specific_technology: resume.skills_detected[0]
    };

    const prompt = this.buildQuestionGenerationPrompt(config, resume, context);

    try {
      const response = await geminiService.generateText(prompt);
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const generated: GeneratedQuestion = JSON.parse(cleaned);

      const { data: savedQuestion, error } = await supabase
        .from('interview_questions')
        .insert({
          question_text: generated.question_text,
          category: this.mapToQuestionCategory(generated.category),
          difficulty: generated.difficulty as QuestionDifficulty,
          interview_type: config.companyName ? 'company-specific' : 'general',
          company_name: config.companyName,
          role: config.targetRole,
          is_active: true,
          is_dynamic: true,
          generated_for_user: resume.user_id,
          resume_context: context
        })
        .select()
        .single();

      if (error || !savedQuestion) {
        console.error('Failed to save generated question:', error);
        return null;
      }

      return savedQuestion;
    } catch (error) {
      console.error('AI question generation failed:', error);
      return null;
    }
  }

  private buildQuestionGenerationPrompt(
    config: InterviewConfig,
    resume: UserResume,
    context: DynamicQuestionContext
  ): string {
    return `Generate a personalized interview question based on the candidate's resume.

Resume Information:
- Experience Level: ${resume.experience_level}
- Years of Experience: ${resume.years_of_experience || 0}
- Key Skills: ${resume.skills_detected.join(', ')}
- Domains: ${resume.domains.join(', ')}
- Projects: ${resume.parsed_data?.projects?.map(p => p.name).join(', ') || 'None listed'}

Interview Configuration:
- Type: ${config.sessionType}
- Category: ${config.interviewCategory}
- Company: ${config.companyName || 'General'}
- Role: ${config.targetRole || 'Software Engineer'}

Specific Context for This Question:
- Testing Skill: ${context.skill_being_tested}
- Specific Project: ${context.specific_project || 'N/A'}
- Technology Focus: ${context.specific_technology || 'N/A'}

Generate ONE interview question that:
1. Tests the candidate's knowledge of "${context.skill_being_tested}"
2. Is appropriate for ${resume.experience_level} level candidates
3. References their specific experience or projects when relevant
4. Feels natural and conversational
5. Has clear evaluation criteria

Return a JSON object with this structure:
{
  "question_text": "Your personalized question here",
  "category": "Technical|HR|Behavioral|Coding|Projects",
  "difficulty": "Easy|Medium|Hard",
  "generation_rationale": "Why this question is relevant",
  "expected_topics": ["topic1", "topic2"],
  "resume_context": {}
}

IMPORTANT: Return ONLY the JSON object, no additional text.`;
  }

  async generateFollowUpQuestion(
    previousQuestion: InterviewQuestion,
    userAnswer: string,
    resume: UserResume
  ): Promise<InterviewQuestion | null> {
    const prompt = `Based on the candidate's answer, generate a relevant follow-up question.

Previous Question: ${previousQuestion.question_text}

Candidate's Answer: ${userAnswer}

Resume Context:
- Skills: ${resume.skills_detected.join(', ')}
- Experience Level: ${resume.experience_level}

Generate a follow-up question that:
1. Probes deeper into their answer
2. Validates their claimed skills
3. Is appropriate for their experience level
4. Feels like a natural conversation

Return JSON with: {"question_text": "...", "category": "...", "difficulty": "...", "generation_rationale": "...", "expected_topics": []}`;

    try {
      const response = await geminiService.generateText(prompt);
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const generated: GeneratedQuestion = JSON.parse(cleaned);

      const { data: savedQuestion, error } = await supabase
        .from('interview_questions')
        .insert({
          question_text: generated.question_text,
          category: this.mapToQuestionCategory(generated.category),
          difficulty: generated.difficulty as QuestionDifficulty,
          interview_type: 'general',
          is_active: true,
          is_dynamic: true,
          generated_for_user: resume.user_id,
          source_question_id: previousQuestion.id,
          resume_context: {
            resume_id: resume.id,
            user_id: resume.user_id,
            skill_being_tested: 'follow-up',
            experience_level: resume.experience_level || 'junior',
            previous_answers: [userAnswer]
          }
        })
        .select()
        .single();

      if (error || !savedQuestion) {
        return null;
      }

      return savedQuestion;
    } catch (error) {
      console.error('Follow-up question generation failed:', error);
      return null;
    }
  }

  private getCategoriesForConfig(config: InterviewConfig): QuestionCategory[] {
    if (config.interviewCategory === 'technical') {
      return ['Technical', 'Coding', 'Projects'];
    } else if (config.interviewCategory === 'hr') {
      return ['HR', 'Behavioral'];
    } else {
      return ['Technical', 'HR', 'Behavioral', 'Coding', 'Projects'];
    }
  }

  private getDifficultyForExperience(level: string): QuestionDifficulty[] {
    switch (level) {
      case 'entry':
      case 'junior':
        return ['Easy', 'Medium'];
      case 'mid':
        return ['Medium', 'Hard'];
      case 'senior':
      case 'lead':
      case 'executive':
        return ['Medium', 'Hard'];
      default:
        return ['Easy', 'Medium', 'Hard'];
    }
  }

  private mapToQuestionCategory(category: string): QuestionCategory {
    const normalized = category.toLowerCase();
    if (normalized.includes('tech')) return 'Technical';
    if (normalized.includes('hr')) return 'HR';
    if (normalized.includes('behavior')) return 'Behavioral';
    if (normalized.includes('cod')) return 'Coding';
    if (normalized.includes('project')) return 'Projects';
    return 'Technical';
  }

  private shuffleQuestions(questions: InterviewQuestion[]): InterviewQuestion[] {
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

export const hybridQuestionService = new HybridQuestionService();
