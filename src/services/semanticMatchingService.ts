import { pipeline, Pipeline } from '@xenova/transformers';
import { supabase } from '../lib/supabaseClient';
import {
  EmbeddingVector,
  SemanticMatchResult,
  HybridMatchScore,
  KeywordContext
} from '../types/resume';

class SemanticMatchingService {
  private embedder: Pipeline | null = null;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;
  private embeddingCache = new Map<string, number[]>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000;
  private readonly SEMANTIC_WEIGHT = 0.6;
  private readonly LITERAL_WEIGHT = 0.4;
  private readonly SIMILARITY_THRESHOLDS = {
    exact: 0.95,
    semantic: 0.75,
    partial: 0.50,
    none: 0
  };

  async initialize(): Promise<void> {
    if (this.embedder) return;

    if (this.isInitializing) {
      if (this.initPromise) await this.initPromise;
      return;
    }

    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        console.log('Initializing semantic matching service with all-MiniLM-L6-v2...');
        this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('Semantic matching service initialized successfully');
      } catch (error) {
        console.error('Failed to initialize semantic matching service:', error);
        throw new Error('Failed to initialize embedding model');
      } finally {
        this.isInitializing = false;
      }
    })();

    await this.initPromise;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    await this.initialize();

    const cacheKey = this.getCacheKey(text);
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }

    if (!this.embedder) {
      throw new Error('Embedder not initialized');
    }

    try {
      const output = await this.embedder(text, {
        pooling: 'mean',
        normalize: true
      });

      const embedding = Array.from(output.data as Float32Array);

      this.embeddingCache.set(cacheKey, embedding);

      setTimeout(() => {
        this.embeddingCache.delete(cacheKey);
      }, this.CACHE_TTL);

      return embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      magA += vecA[i] * vecA[i];
      magB += vecB[i] * vecB[i];
    }

    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);

    if (magA === 0 || magB === 0) {
      return 0;
    }

    return dot / (magA * magB);
  }

  async semanticMatch(
    resumeText: string,
    targetText: string
  ): Promise<SemanticMatchResult> {
    const resumeEmbedding = await this.generateEmbedding(resumeText);
    const targetEmbedding = await this.generateEmbedding(targetText);

    const similarity = this.cosineSimilarity(resumeEmbedding, targetEmbedding);

    let matchType: SemanticMatchResult['match_type'] = 'none';
    if (similarity >= this.SIMILARITY_THRESHOLDS.exact) {
      matchType = 'exact';
    } else if (similarity >= this.SIMILARITY_THRESHOLDS.semantic) {
      matchType = 'semantic';
    } else if (similarity >= this.SIMILARITY_THRESHOLDS.partial) {
      matchType = 'partial';
    }

    return {
      similarity_score: similarity,
      match_type: matchType,
      confidence: similarity,
      matched_text: resumeText,
      context: targetText
    };
  }

  async hybridMatch(
    resumeText: string,
    jobDescription: string,
    keywords: string[]
  ): Promise<HybridMatchScore> {
    const literalMatches = this.calculateLiteralMatch(resumeText, keywords);
    const semanticResult = await this.semanticMatch(resumeText, jobDescription);

    const literalScore = literalMatches / Math.max(keywords.length, 1);
    const semanticScore = semanticResult.similarity_score;

    const combinedScore =
      (literalScore * this.LITERAL_WEIGHT) +
      (semanticScore * this.SEMANTIC_WEIGHT);

    return {
      literal_score: literalScore,
      semantic_score: semanticScore,
      combined_score: combinedScore,
      literal_weight: this.LITERAL_WEIGHT,
      semantic_weight: this.SEMANTIC_WEIGHT,
      match_details: [semanticResult]
    };
  }

  private calculateLiteralMatch(text: string, keywords: string[]): number {
    const lowerText = text.toLowerCase();
    let matches = 0;

    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matches++;
      }
    }

    return matches;
  }

  async analyzeKeywordContext(
    resumeText: string,
    keywords: string[]
  ): Promise<KeywordContext[]> {
    const sentences = this.splitIntoSentences(resumeText);
    const contexts: KeywordContext[] = [];

    for (const keyword of keywords) {
      const contextSentences = sentences.filter(sentence =>
        sentence.toLowerCase().includes(keyword.toLowerCase())
      );

      const foundInResume = contextSentences.length > 0;
      let relevanceScore = 0;

      if (foundInResume) {
        const avgSimilarity = await this.calculateAverageRelevance(
          contextSentences,
          keyword
        );
        relevanceScore = avgSimilarity;
      }

      const semanticAlternatives = foundInResume
        ? []
        : await this.findSemanticAlternatives(keyword, sentences);

      contexts.push({
        keyword,
        found_in_resume: foundInResume,
        context_sentences: contextSentences,
        relevance_score: relevanceScore,
        semantic_alternatives: semanticAlternatives
      });
    }

    return contexts;
  }

  private async calculateAverageRelevance(
    sentences: string[],
    keyword: string
  ): Promise<number> {
    if (sentences.length === 0) return 0;

    let totalSimilarity = 0;
    for (const sentence of sentences) {
      const result = await this.semanticMatch(sentence, keyword);
      totalSimilarity += result.similarity_score;
    }

    return totalSimilarity / sentences.length;
  }

  private async findSemanticAlternatives(
    keyword: string,
    sentences: string[]
  ): Promise<string[]> {
    const alternatives: Array<{ text: string; score: number }> = [];

    for (const sentence of sentences) {
      const words = sentence.split(/\s+/).filter(w => w.length > 3);

      for (const word of words) {
        const result = await this.semanticMatch(word, keyword);

        if (result.similarity_score >= this.SIMILARITY_THRESHOLDS.partial &&
            result.similarity_score < this.SIMILARITY_THRESHOLDS.exact) {
          alternatives.push({
            text: word,
            score: result.similarity_score
          });
        }
      }
    }

    return alternatives
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(alt => alt.text);
  }

  private splitIntoSentences(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  private getCacheKey(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  async storeEmbedding(
    vector: number[],
    text: string,
    type: EmbeddingVector['type'],
    metadata?: Record<string, any>,
    userId?: string
  ): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('resume_embeddings')
        .insert({
          user_id: userId,
          vector: vector,
          text: text,
          type: type,
          metadata: metadata || {}
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to store embedding:', error);
        throw error;
      }

      return data.id;
    } catch (error) {
      console.error('Error storing embedding:', error);
      throw new Error('Failed to store embedding in database');
    }
  }

  async retrieveEmbedding(id: string): Promise<EmbeddingVector | null> {
    try {
      const { data, error } = await supabase
        .from('resume_embeddings')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Failed to retrieve embedding:', error);
        return null;
      }

      return data as EmbeddingVector;
    } catch (error) {
      console.error('Error retrieving embedding:', error);
      return null;
    }
  }

  clearCache(): void {
    this.embeddingCache.clear();
    console.log('Embedding cache cleared');
  }

  getCacheSize(): number {
    return this.embeddingCache.size;
  }
}

export const semanticMatchingService = new SemanticMatchingService();
