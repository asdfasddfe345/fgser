import { semanticMatchingService } from './semanticMatchingService';

interface SynonymCluster {
  canonical: string;
  synonyms: string[];
  semantic_similarity_threshold: number;
}

class SynonymExpansionService {
  private technicalSynonyms: Map<string, string[]> = new Map([
    ['javascript', ['js', 'ecmascript', 'es6', 'es2015', 'node.js', 'nodejs']],
    ['typescript', ['ts']],
    ['python', ['py', 'python3', 'python2']],
    ['react', ['reactjs', 'react.js']],
    ['angular', ['angularjs', 'angular.js']],
    ['vue', ['vuejs', 'vue.js']],
    ['docker', ['containerization', 'containers']],
    ['kubernetes', ['k8s', 'k8', 'container orchestration']],
    ['aws', ['amazon web services', 'amazon aws']],
    ['azure', ['microsoft azure', 'ms azure']],
    ['gcp', ['google cloud platform', 'google cloud']],
    ['ci/cd', ['continuous integration', 'continuous deployment', 'cicd']],
    ['devops', ['dev ops', 'development operations']],
    ['machine learning', ['ml', 'artificial intelligence', 'ai']],
    ['deep learning', ['dl', 'neural networks']],
    ['sql', ['structured query language', 'database']],
    ['mongodb', ['mongo', 'nosql']],
    ['postgresql', ['postgres', 'psql']],
    ['redis', ['cache', 'in-memory database']],
    ['git', ['version control', 'source control']],
    ['agile', ['scrum', 'kanban']],
    ['rest api', ['restful', 'rest', 'api']],
    ['graphql', ['graph ql', 'gql']],
    ['microservices', ['micro services', 'service-oriented architecture']],
    ['frontend', ['front-end', 'client-side', 'ui']],
    ['backend', ['back-end', 'server-side', 'api']],
    ['fullstack', ['full-stack', 'full stack']]
  ]);

  private semanticCache: Map<string, string[]> = new Map();

  async expandKeyword(keyword: string): Promise<string[]> {
    const normalizedKeyword = keyword.toLowerCase().trim();

    if (this.technicalSynonyms.has(normalizedKeyword)) {
      return this.technicalSynonyms.get(normalizedKeyword)!;
    }

    if (this.semanticCache.has(normalizedKeyword)) {
      return this.semanticCache.get(normalizedKeyword)!;
    }

    try {
      const semanticSynonyms = await this.findSemanticSynonyms(keyword);
      this.semanticCache.set(normalizedKeyword, semanticSynonyms);
      return semanticSynonyms;
    } catch (error) {
      console.error('Error finding semantic synonyms:', error);
      return [];
    }
  }

  private async findSemanticSynonyms(keyword: string): Promise<string[]> {
    const candidateTerms = this.generateCandidates(keyword);
    const synonyms: Array<{ term: string; score: number }> = [];

    const keywordEmbedding = await semanticMatchingService.generateEmbedding(keyword);

    for (const candidate of candidateTerms) {
      try {
        const candidateEmbedding = await semanticMatchingService.generateEmbedding(candidate);
        const similarity = semanticMatchingService.cosineSimilarity(
          keywordEmbedding,
          candidateEmbedding
        );

        if (similarity >= 0.7 && similarity < 0.95) {
          synonyms.push({ term: candidate, score: similarity });
        }
      } catch (error) {
        console.error(`Error processing candidate ${candidate}:`, error);
      }
    }

    return synonyms
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(s => s.term);
  }

  private generateCandidates(keyword: string): string[] {
    const candidates: string[] = [];

    const kebabCase = keyword.replace(/\s+/g, '-');
    const snakeCase = keyword.replace(/\s+/g, '_');
    const camelCase = keyword
      .split(/\s+/)
      .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
    const pascalCase = keyword
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');

    candidates.push(kebabCase, snakeCase, camelCase, pascalCase);

    const words = keyword.split(/\s+/);
    if (words.length > 1) {
      const acronym = words.map(w => w.charAt(0).toUpperCase()).join('');
      candidates.push(acronym);
      candidates.push(acronym.toLowerCase());
    }

    const withSlash = keyword.replace(/\s+/g, '/');
    candidates.push(withSlash);

    candidates.push(keyword.toUpperCase());
    candidates.push(keyword.toLowerCase());

    const dotNotation = keyword.replace(/\s+/g, '.');
    candidates.push(dotNotation);

    return [...new Set(candidates)].filter(c => c.length > 0);
  }

  async matchWithExpansion(
    resumeText: string,
    keywords: string[]
  ): Promise<Map<string, { found: boolean; matchedAs?: string; synonyms: string[] }>> {
    const results = new Map();
    const lowerResumeText = resumeText.toLowerCase();

    for (const keyword of keywords) {
      const expanded = await this.expandKeyword(keyword);
      const allVariants = [keyword, ...expanded];

      let found = false;
      let matchedAs: string | undefined;

      for (const variant of allVariants) {
        if (lowerResumeText.includes(variant.toLowerCase())) {
          found = true;
          matchedAs = variant;
          break;
        }
      }

      results.set(keyword, {
        found,
        matchedAs,
        synonyms: expanded
      });
    }

    return results;
  }

  buildSemanticCluster(terms: string[]): SynonymCluster[] {
    const clusters: SynonymCluster[] = [];
    const processed = new Set<string>();

    for (const term of terms) {
      if (processed.has(term)) continue;

      const relatedTerms = terms.filter(t => {
        if (t === term || processed.has(t)) return false;

        const isRelated = this.areTermsRelated(term, t);
        if (isRelated) processed.add(t);
        return isRelated;
      });

      if (relatedTerms.length > 0) {
        clusters.push({
          canonical: term,
          synonyms: relatedTerms,
          semantic_similarity_threshold: 0.75
        });
        processed.add(term);
      }
    }

    return clusters;
  }

  private areTermsRelated(term1: string, term2: string): boolean {
    const norm1 = term1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const norm2 = term2.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      return true;
    }

    if (this.levenshteinDistance(norm1, norm2) <= 2) {
      return true;
    }

    return false;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  addCustomSynonym(canonical: string, synonyms: string[]): void {
    const normalized = canonical.toLowerCase().trim();
    const existing = this.technicalSynonyms.get(normalized) || [];
    this.technicalSynonyms.set(normalized, [
      ...new Set([...existing, ...synonyms.map(s => s.toLowerCase().trim())])
    ]);
  }

  getAllSynonyms(): Map<string, string[]> {
    return new Map(this.technicalSynonyms);
  }

  clearSemanticCache(): void {
    this.semanticCache.clear();
  }
}

export const synonymExpansionService = new SynonymExpansionService();
