import { AIFeedback } from '../types/interview';
import { UserResume, ResumeSkillValidation } from '../types/resumeInterview';
import { geminiService } from './geminiServiceWrapper';

class ResumeValidationFeedbackService {
  async analyzeAnswerWithResumeContext(
    question: string,
    userAnswer: string,
    category: string,
    difficulty: string,
    resume: UserResume,
    baseFeedback: AIFeedback
  ): Promise<{
    feedback: AIFeedback;
    resumeRelevanceScore: number;
    validatesResumeClaim: boolean;
    resumeSkillValidated?: string;
    credibilityScore: number;
  }> {
    try {
      const resumeSkills = resume.skills_detected.join(', ');
      const experienceLevel = resume.experience_level || 'unknown';

      const prompt = `You are evaluating an interview answer in the context of the candidate's resume. Analyze if their answer validates their resume claims.

RESUME CONTEXT:
- Experience Level: ${experienceLevel}
- Key Skills: ${resumeSkills}
- Years of Experience: ${resume.years_of_experience || 'unknown'}

QUESTION:
${question}

CANDIDATE'S ANSWER:
${userAnswer}

BASE FEEDBACK SCORE: ${baseFeedback.score}/10

Analyze and return a JSON object:
{
  "enhanced_feedback": {
    "score": <number 0-10, adjusted based on resume context>,
    "missed_points": [<array>],
    "suggestions": [<array>],
    "tone_confidence_rating": "<string>",
    "strengths": [<array, include resume validations>],
    "improvement_areas": [<array, include resume discrepancies>]
  },
  "resume_relevance_score": <number 0-10, how relevant was this question to their resume>,
  "validates_resume_claim": <boolean, did they demonstrate claimed skills>,
  "resume_skill_validated": "<skill name from resume if applicable>",
  "credibility_score": <number 0-10, consistency between resume and answer>,
  "credibility_notes": "<brief explanation>"
}

IMPORTANT: Return ONLY the JSON object, no additional text.`;

      const response = await geminiService.generateText(prompt);
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const analysis = JSON.parse(cleaned);

      return {
        feedback: analysis.enhanced_feedback || baseFeedback,
        resumeRelevanceScore: analysis.resume_relevance_score || 5,
        validatesResumeClaim: analysis.validates_resume_claim || false,
        resumeSkillValidated: analysis.resume_skill_validated,
        credibilityScore: analysis.credibility_score || 5
      };
    } catch (error) {
      console.error('Resume validation analysis failed:', error);
      return {
        feedback: baseFeedback,
        resumeRelevanceScore: 5,
        validatesResumeClaim: false,
        credibilityScore: 5
      };
    }
  }

  async validateSkillFromAnswer(
    skill: string,
    userAnswer: string,
    question: string
  ): Promise<ResumeSkillValidation> {
    try {
      const prompt = `Analyze if the candidate demonstrated knowledge of "${skill}" in their answer.

QUESTION: ${question}
ANSWER: ${userAnswer}
SKILL TO VALIDATE: ${skill}

Return JSON:
{
  "validated_in_interview": <boolean>,
  "confidence_level": "high|medium|low|not_tested",
  "evidence_from_answer": "<specific quote or explanation>",
  "discrepancy_notes": "<any concerns about their knowledge>"
}

IMPORTANT: Return ONLY the JSON object.`;

      const response = await geminiService.generateText(prompt);
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const validation = JSON.parse(cleaned);

      return {
        skill_name: skill,
        claimed_on_resume: true,
        validated_in_interview: validation.validated_in_interview || false,
        confidence_level: validation.confidence_level || 'not_tested',
        evidence_from_answer: validation.evidence_from_answer,
        discrepancy_notes: validation.discrepancy_notes
      };
    } catch (error) {
      console.error('Skill validation failed:', error);
      return {
        skill_name: skill,
        claimed_on_resume: true,
        validated_in_interview: false,
        confidence_level: 'not_tested'
      };
    }
  }

  async generateResumeAlignmentReport(
    resume: UserResume,
    responses: Array<{
      question: string;
      answer: string;
      skill_validated?: string;
      validates_claim: boolean;
      credibility_score: number;
    }>
  ): Promise<{
    overall_alignment_score: number;
    skills_validated: ResumeSkillValidation[];
    consistent_answers: number;
    inconsistent_answers: number;
    inflated_claims: string[];
    verified_claims: string[];
    recommendations: string[];
  }> {
    const skillsTestedMap = new Map<string, ResumeSkillValidation[]>();

    responses.forEach(r => {
      if (r.skill_validated) {
        const validations = skillsTestedMap.get(r.skill_validated) || [];
        validations.push({
          skill_name: r.skill_validated,
          claimed_on_resume: true,
          validated_in_interview: r.validates_claim,
          confidence_level: r.validates_claim ? 'high' : 'low',
          evidence_from_answer: r.answer.substring(0, 100)
        });
        skillsTestedMap.set(r.skill_validated, validations);
      }
    });

    const skills_validated: ResumeSkillValidation[] = [];
    resume.skills_detected.forEach(skill => {
      const validations = skillsTestedMap.get(skill);
      if (validations && validations.length > 0) {
        const validated = validations.some(v => v.validated_in_interview);
        skills_validated.push({
          skill_name: skill,
          claimed_on_resume: true,
          validated_in_interview: validated,
          confidence_level: validated ? 'high' : 'low'
        });
      } else {
        skills_validated.push({
          skill_name: skill,
          claimed_on_resume: true,
          validated_in_interview: false,
          confidence_level: 'not_tested'
        });
      }
    });

    const consistent_answers = responses.filter(r => r.credibility_score >= 7).length;
    const inconsistent_answers = responses.filter(r => r.credibility_score < 5).length;

    const verified_claims = skills_validated
      .filter(s => s.validated_in_interview && s.confidence_level === 'high')
      .map(s => s.skill_name);

    const inflated_claims = skills_validated
      .filter(s => !s.validated_in_interview && s.confidence_level === 'low')
      .map(s => s.skill_name);

    const validatedSkillsCount = verified_claims.length;
    const totalSkills = resume.skills_detected.length;
    const validationRate = totalSkills > 0 ? (validatedSkillsCount / totalSkills) * 100 : 0;

    const avgCredibility = responses.reduce((sum, r) => sum + r.credibility_score, 0) / responses.length;
    const overall_alignment_score = Math.round((validationRate * 0.6 + avgCredibility * 4) / 2);

    const recommendations: string[] = [];

    if (inflated_claims.length > 0) {
      recommendations.push(
        `Consider gaining more hands-on experience with: ${inflated_claims.slice(0, 3).join(', ')}`
      );
    }

    if (validationRate < 50) {
      recommendations.push(
        'Only list skills on your resume that you can confidently discuss in interviews'
      );
    }

    if (verified_claims.length > 0) {
      recommendations.push(
        `Your verified skills (${verified_claims.slice(0, 3).join(', ')}) are strong selling points`
      );
    }

    if (inconsistent_answers > responses.length * 0.3) {
      recommendations.push(
        'Practice explaining your projects and experience more clearly to build credibility'
      );
    }

    return {
      overall_alignment_score,
      skills_validated,
      consistent_answers,
      inconsistent_answers,
      inflated_claims,
      verified_claims,
      recommendations
    };
  }
}

export const resumeValidationFeedbackService = new ResumeValidationFeedbackService();
