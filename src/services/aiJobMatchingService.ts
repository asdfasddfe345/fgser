import { supabase } from '../lib/supabaseClient';
import { JobListing } from '../types/jobs';

interface UserPreferences {
  resumeText: string;
  passoutYear: number;
  roleType: 'internship' | 'fulltime' | 'both';
  techInterests: string[];
  preferredModes: string[];
}

interface JobRecommendation {
  job_id: string;
  match_score: number;
  match_reason: string;
  skills_matched: string[];
  location_match: boolean;
  year_match: boolean;
}

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SYSTEM_PROMPT = `You are an intelligent career recommendation assistant for PrimoBoost AI.
Your goal is to analyze a candidate's resume, education year, job type preference, and technology interests,
and match them with the most relevant job listings from the database.

You must:
1. Read and extract candidate details (skills, experience, education, and role preferences) from the given resume.
2. Compare those details with the job listings provided (each job has skills, eligible_years, location_type, and domain).
3. Compute a match_score (0–100) and explain briefly why that job fits the candidate.
4. Filter out jobs below 40% match.
5. Return a sorted list of jobs in descending order of match_score, in JSON format only.

Be precise, structured, and helpful. Return ONLY valid JSON array, no markdown, no explanations.`;

class AIJobMatchingService {
  /**
   * Analyze resume and generate job recommendations using AI
   */
  async analyzeAndMatch(
    userId: string,
    preferences: UserPreferences,
    jobListings: JobListing[]
  ): Promise<JobRecommendation[]> {
    try {
      // Filter jobs based on basic criteria first
      const filteredJobs = this.filterJobsByPreferences(jobListings, preferences);

      if (filteredJobs.length === 0) {
        console.log('No jobs match the basic criteria');
        return [];
      }

      // Prepare job listings for AI
      const jobsForAI = filteredJobs.slice(0, 50).map((job) => ({
        id: job.id,
        role_title: job.role_title,
        company_name: job.company_name,
        skills: job.skills || [],
        eligible_years: job.eligible_years,
        location_type: job.location_type,
        location_city: job.location_city,
        domain: job.domain,
        experience_required: job.experience_required,
        description: job.short_description || job.description,
      }));

      // Build user prompt
      const userPrompt = `Here is the candidate profile and job listings data:

[Candidate Resume Text]
${preferences.resumeText}

[Candidate Preferences]
- Graduation Year: ${preferences.passoutYear}
- Role Type: ${preferences.roleType}
- Interested Technologies: ${preferences.techInterests.join(', ')}
- Preferred Mode: ${preferences.preferredModes.join(', ')}

[Job Listings from Database]
${JSON.stringify(jobsForAI, null, 2)}

Now, analyze and return a JSON array with this format:
[
  {
    "job_id": "<uuid>",
    "match_score": <integer>,
    "reason": "<short explanation of why it matches>",
    "skills_matched": ["React", "Node.js"],
    "location_match": true,
    "year_match": true
  }
]
Return only the JSON array, no text, no markdown.`;

      // Call AI API
      const recommendations = await this.callAIAPI(userPrompt);

      // Save recommendations to database
      await this.saveRecommendations(userId, recommendations);

      return recommendations;
    } catch (error) {
      console.error('Error in analyzeAndMatch:', error);
      throw error;
    }
  }

  /**
   * Filter jobs based on user preferences before sending to AI
   */
  private filterJobsByPreferences(
    jobs: JobListing[],
    preferences: UserPreferences
  ): JobListing[] {
    return jobs.filter((job) => {
      // Filter by active status
      if (!job.is_active) return false;

      // Filter by year eligibility
      if (job.eligible_years) {
        const yearMatch = this.checkYearEligibility(
          job.eligible_years,
          preferences.passoutYear
        );
        if (!yearMatch) return false;
      }

      // Filter by role type
      if (preferences.roleType !== 'both') {
        const isInternship = job.experience_required.toLowerCase().includes('intern');
        if (preferences.roleType === 'internship' && !isInternship) return false;
        if (preferences.roleType === 'fulltime' && isInternship) return false;
      }

      // Filter by preferred work modes
      if (preferences.preferredModes.length > 0) {
        const jobLocationType = job.location_type.toLowerCase();
        const hasMatchingMode = preferences.preferredModes.some(
          (mode) => jobLocationType.includes(mode.toLowerCase())
        );
        if (!hasMatchingMode) return false;
      }

      return true;
    });
  }

  /**
   * Check if job's eligible years include user's passout year
   */
  private checkYearEligibility(eligibleYears: string, passoutYear: number): boolean {
    const yearStr = passoutYear.toString();
    return eligibleYears.includes(yearStr);
  }

  /**
   * Call OpenRouter API with Gemini 2.5 Flash
   */
  private async callAIAPI(userPrompt: string): Promise<JobRecommendation[]> {
    if (!OPENROUTER_API_KEY) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'PrimoBoost AI',
        },
        body: JSON.stringify({
          model: 'nousresearch/deephermes-3-llama-3-8b-preview:free',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenRouter API error: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content in AI response');
      }

      // Parse JSON response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON in AI response');
      }

      const recommendations = JSON.parse(jsonMatch[0]) as JobRecommendation[];
      return recommendations.filter((r) => r.match_score >= 40);
    } catch (error) {
      console.error('AI API call failed:', error);
      throw error;
    }
  }

  /**
   * Save recommendations to Supabase
   * FIXED: Uses upsert to handle duplicate key constraint
   */
  private async saveRecommendations(
    userId: string,
    recommendations: JobRecommendation[]
  ): Promise<void> {
    try {
      // Prepare records for upsert
      const records = recommendations.map((rec) => ({
        user_id: userId,
        job_id: rec.job_id,
        match_score: rec.match_score,
        match_reason: rec.match_reason,
        skills_matched: rec.skills_matched,
        location_match: rec.location_match,
        year_match: rec.year_match,
        is_dismissed: false, // Reset dismissed status on refresh
      }));

      // Use upsert to handle duplicates automatically
      const { error } = await supabase
        .from('ai_job_recommendations')
        .upsert(records, {
          onConflict: 'user_id,job_id', // Specify the unique constraint columns
          ignoreDuplicates: false, // Update existing records instead of ignoring
        });

      if (error) {
        console.error('Error saving recommendations:', error);
        throw error;
      }

      console.log(`Successfully saved ${records.length} recommendations for user ${userId}`);
    } catch (error) {
      console.error('Error in saveRecommendations:', error);
      throw error;
    }
  }

  /**
   * Get stored recommendations for a user
   */
  async getRecommendations(userId: string, minScore: number = 40): Promise<any[]> {
    try {
      const { data, error } = await supabase.rpc('get_user_recommended_jobs', {
        p_user_id: userId,
        p_min_score: minScore,
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      return [];
    }
  }

  /**
   * Dismiss a recommendation
   */
  async dismissRecommendation(userId: string, jobId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_job_recommendations')
        .update({ is_dismissed: true })
        .eq('user_id', userId)
        .eq('job_id', jobId);

      if (error) throw error;
    } catch (error) {
      console.error('Error dismissing recommendation:', error);
      throw error;
    }
  }

  /**
   * Check if user needs to refresh recommendations
   */
  async shouldRefreshRecommendations(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('ai_job_recommendations')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return true;

      const daysSinceUpdate = Math.floor(
        (Date.now() - new Date(data.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      return daysSinceUpdate >= 7;
    } catch (error) {
      return true;
    }
  }
}

export const aiJobMatchingService = new AIJobMatchingService();
