import { semanticMatchingService } from './semanticMatchingService';
import { ComprehensiveScore, HybridMatchScore, KeywordContext } from '../types/resume';

class EnhancedScoringService {
  async enhanceScoreWithSemantics(
    resumeText: string,
    jobDescription: string,
    keywords: string[],
    baseScore: ComprehensiveScore
  ): Promise<ComprehensiveScore> {
    try {
      const hybridScore = await semanticMatchingService.hybridMatch(
        resumeText,
        jobDescription,
        keywords
      );

      const keywordContexts = await semanticMatchingService.analyzeKeywordContext(
        resumeText,
        keywords
      );

      const enhancedBreakdown = this.enhanceBreakdownWithSemantics(
        baseScore.breakdown,
        hybridScore,
        keywordContexts
      );

      const enhancedKeywords = this.enhanceKeywordAnalysis(
        baseScore.missing_keywords,
        keywordContexts
      );

      const enhancedActions = this.generateSemanticActions(
        keywordContexts,
        hybridScore
      );

      const adjustedScore = this.adjustOverallScore(
        baseScore.overall,
        hybridScore
      );

      return {
        ...baseScore,
        overall: adjustedScore,
        breakdown: enhancedBreakdown,
        missing_keywords: enhancedKeywords,
        actions: [...baseScore.actions, ...enhancedActions],
        notes: [
          ...baseScore.notes,
          `Semantic match score: ${(hybridScore.semantic_score * 100).toFixed(1)}%`,
          `Hybrid match score: ${(hybridScore.combined_score * 100).toFixed(1)}%`
        ]
      };
    } catch (error) {
      console.error('Error enhancing score with semantics:', error);
      return baseScore;
    }
  }

  private enhanceBreakdownWithSemantics(
    breakdown: ComprehensiveScore['breakdown'],
    hybridScore: HybridMatchScore,
    keywordContexts: KeywordContext[]
  ): ComprehensiveScore['breakdown'] {
    return breakdown.map(metric => {
      if (metric.key === 'keywords_match') {
        const semanticBonus = Math.round(
          (hybridScore.semantic_score - hybridScore.literal_score) * metric.max_score
        );

        const adjustedScore = Math.min(
          metric.max_score,
          metric.score + semanticBonus
        );

        const contextualKeywords = keywordContexts.filter(
          kc => kc.found_in_resume && kc.relevance_score > 0.7
        ).length;

        return {
          ...metric,
          score: adjustedScore,
          contribution: (adjustedScore / 142) * 100,
          details: `${metric.details} Semantic analysis found ${contextualKeywords} keywords used in relevant context. Hybrid match score: ${(hybridScore.combined_score * 100).toFixed(1)}%.`
        };
      }

      if (metric.key === 'skills_alignment') {
        const semanticSkillMatches = keywordContexts.filter(
          kc => kc.semantic_alternatives && kc.semantic_alternatives.length > 0
        ).length;

        const semanticBonus = Math.min(
          3,
          Math.round((semanticSkillMatches / keywordContexts.length) * 3)
        );

        return {
          ...metric,
          score: Math.min(metric.max_score, metric.score + semanticBonus),
          contribution: ((metric.score + semanticBonus) / 142) * 100,
          details: `${metric.details} Found ${semanticSkillMatches} semantic skill equivalents.`
        };
      }

      return metric;
    });
  }

  private enhanceKeywordAnalysis(
    missingKeywords: string[],
    keywordContexts: KeywordContext[]
  ): string[] {
    const trulyMissing: string[] = [];

    for (const keyword of missingKeywords) {
      const context = keywordContexts.find(kc => kc.keyword === keyword);

      if (!context) {
        trulyMissing.push(keyword);
        continue;
      }

      const hasSemanticMatch =
        context.semantic_alternatives &&
        context.semantic_alternatives.length > 0;

      if (!hasSemanticMatch) {
        trulyMissing.push(keyword);
      }
    }

    return trulyMissing;
  }

  private generateSemanticActions(
    keywordContexts: KeywordContext[],
    hybridScore: HybridMatchScore
  ): string[] {
    const actions: string[] = [];

    const weakContextKeywords = keywordContexts.filter(
      kc => kc.found_in_resume && kc.relevance_score < 0.5
    );

    if (weakContextKeywords.length > 0) {
      actions.push(
        `${weakContextKeywords.length} keywords are present but used in weak context. Consider rewriting these sections to better demonstrate your expertise.`
      );
    }

    const missingWithAlternatives = keywordContexts.filter(
      kc => !kc.found_in_resume &&
           kc.semantic_alternatives &&
           kc.semantic_alternatives.length > 0
    );

    if (missingWithAlternatives.length > 0) {
      const examples = missingWithAlternatives
        .slice(0, 3)
        .map(kc => `"${kc.keyword}" (you used: ${kc.semantic_alternatives![0]})`)
        .join(', ');

      actions.push(
        `Consider using exact keyword matches for: ${examples}. While you have related skills, exact matches improve ATS compatibility.`
      );
    }

    if (hybridScore.semantic_score > 0.7 && hybridScore.literal_score < 0.5) {
      actions.push(
        'Your resume shows strong semantic alignment with the job, but could benefit from using more exact keywords from the job description for better ATS performance.'
      );
    }

    return actions;
  }

  private adjustOverallScore(
    baseScore: number,
    hybridScore: HybridMatchScore
  ): number {
    const semanticBonus = Math.round(
      (hybridScore.semantic_score - hybridScore.literal_score) * 5
    );

    const adjustedScore = Math.max(
      0,
      Math.min(100, baseScore + semanticBonus)
    );

    return adjustedScore;
  }

  async extractKeywordsFromJD(jobDescription: string): Promise<string[]> {
    const lines = jobDescription
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const keywords = new Set<string>();
    const technicalPatterns = [
      /\b(?:React|Angular|Vue|Node\.js|Python|Java|JavaScript|TypeScript|AWS|Azure|Docker|Kubernetes|SQL|MongoDB)\b/gi,
      /\b(?:\w+\.js|\w+\+\+|C#)\b/gi,
      /\b(?:Machine Learning|Deep Learning|DevOps|CI\/CD|Agile|Scrum)\b/gi
    ];

    for (const line of lines) {
      for (const pattern of technicalPatterns) {
        const matches = line.match(pattern);
        if (matches) {
          matches.forEach(match => keywords.add(match));
        }
      }
    }

    const commonWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were',
      'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can'
    ]);

    const words = jobDescription
      .toLowerCase()
      .split(/\s+/)
      .filter(word => {
        const cleaned = word.replace(/[^a-z0-9+#.-]/g, '');
        return cleaned.length > 3 && !commonWords.has(cleaned);
      });

    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });

    const frequentWords = Array.from(wordFreq.entries())
      .filter(([word, freq]) => freq >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([word]) => word);

    frequentWords.forEach(word => keywords.add(word));

    return Array.from(keywords);
  }

  async cacheSemanticScore(
    resumeHash: string,
    jdHash: string,
    hybridScore: HybridMatchScore
  ): Promise<void> {
    try {
      const { supabase } = await import('../lib/supabaseClient');

      await supabase.from('semantic_match_cache').insert({
        resume_hash: resumeHash,
        jd_hash: jdHash,
        similarity_score: hybridScore.semantic_score,
        literal_score: hybridScore.literal_score,
        combined_score: hybridScore.combined_score,
        match_details: {
          match_details: hybridScore.match_details
        }
      });
    } catch (error) {
      console.error('Failed to cache semantic score:', error);
    }
  }

  async getCachedSemanticScore(
    resumeHash: string,
    jdHash: string
  ): Promise<HybridMatchScore | null> {
    try {
      const { supabase } = await import('../lib/supabaseClient');

      const { data, error } = await supabase
        .from('semantic_match_cache')
        .select('*')
        .eq('resume_hash', resumeHash)
        .eq('jd_hash', jdHash)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return {
        literal_score: data.literal_score,
        semantic_score: data.similarity_score,
        combined_score: data.combined_score,
        literal_weight: 0.4,
        semantic_weight: 0.6,
        match_details: data.match_details?.match_details || []
      };
    } catch (error) {
      console.error('Failed to retrieve cached semantic score:', error);
      return null;
    }
  }
}

export const enhancedScoringService = new EnhancedScoringService();
