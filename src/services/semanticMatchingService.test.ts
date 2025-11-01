import { semanticMatchingService } from './semanticMatchingService';
import { synonymExpansionService } from './synonymExpansionService';

describe('SemanticMatchingService', () => {
  beforeAll(async () => {
    await semanticMatchingService.initialize();
  });

  describe('Embedding Generation', () => {
    test('should generate embeddings for text', async () => {
      const text = 'React developer with 5 years of experience';
      const embedding = await semanticMatchingService.generateEmbedding(text);

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(384);
      expect(embedding.every(n => typeof n === 'number')).toBe(true);
    });

    test('should use cache for repeated embeddings', async () => {
      const text = 'Python developer';
      const embedding1 = await semanticMatchingService.generateEmbedding(text);
      const embedding2 = await semanticMatchingService.generateEmbedding(text);

      expect(embedding1).toEqual(embedding2);
    });
  });

  describe('Cosine Similarity', () => {
    test('should calculate similarity between vectors', async () => {
      const text1 = 'JavaScript programming';
      const text2 = 'JavaScript development';
      const text3 = 'Python data science';

      const emb1 = await semanticMatchingService.generateEmbedding(text1);
      const emb2 = await semanticMatchingService.generateEmbedding(text2);
      const emb3 = await semanticMatchingService.generateEmbedding(text3);

      const sim12 = semanticMatchingService.cosineSimilarity(emb1, emb2);
      const sim13 = semanticMatchingService.cosineSimilarity(emb1, emb3);

      expect(sim12).toBeGreaterThan(sim13);
      expect(sim12).toBeGreaterThan(0.8);
      expect(sim13).toBeLessThan(0.7);
    });

    test('should return 1 for identical vectors', async () => {
      const text = 'Test text';
      const embedding = await semanticMatchingService.generateEmbedding(text);
      const similarity = semanticMatchingService.cosineSimilarity(embedding, embedding);

      expect(similarity).toBeCloseTo(1.0, 5);
    });

    test('should throw error for vectors of different lengths', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2];

      expect(() => {
        semanticMatchingService.cosineSimilarity(vec1, vec2);
      }).toThrow('Vectors must have the same length');
    });
  });

  describe('Semantic Matching', () => {
    test('should match semantically similar texts', async () => {
      const resumeText = 'Built RESTful APIs using Node.js and Express';
      const jdText = 'Experience with backend API development';

      const result = await semanticMatchingService.semanticMatch(resumeText, jdText);

      expect(result.similarity_score).toBeGreaterThan(0.5);
      expect(result.match_type).toMatch(/semantic|partial/);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('should detect exact matches', async () => {
      const text = 'React developer with TypeScript experience';

      const result = await semanticMatchingService.semanticMatch(text, text);

      expect(result.similarity_score).toBeGreaterThan(0.95);
      expect(result.match_type).toBe('exact');
    });

    test('should detect no match for unrelated texts', async () => {
      const resumeText = 'Experienced chef with culinary expertise';
      const jdText = 'Software engineer with machine learning skills';

      const result = await semanticMatchingService.semanticMatch(resumeText, jdText);

      expect(result.similarity_score).toBeLessThan(0.5);
      expect(result.match_type).toBe('none');
    });
  });

  describe('Hybrid Matching', () => {
    test('should combine literal and semantic scores', async () => {
      const resumeText = 'React developer with JavaScript and Node.js experience';
      const jobDescription = 'Looking for ReactJS developer with JS skills';
      const keywords = ['React', 'JavaScript', 'Node.js'];

      const result = await semanticMatchingService.hybridMatch(
        resumeText,
        jobDescription,
        keywords
      );

      expect(result.literal_score).toBeGreaterThan(0);
      expect(result.semantic_score).toBeGreaterThan(0);
      expect(result.combined_score).toBeGreaterThan(0);
      expect(result.literal_weight).toBe(0.4);
      expect(result.semantic_weight).toBe(0.6);
    });

    test('should weight semantic score higher than literal', async () => {
      const resumeText = 'Backend API development using server-side technologies';
      const jobDescription = 'Experience with backend development and APIs';
      const keywords = ['backend', 'API', 'development'];

      const result = await semanticMatchingService.hybridMatch(
        resumeText,
        jobDescription,
        keywords
      );

      const literalContribution = result.literal_score * result.literal_weight;
      const semanticContribution = result.semantic_score * result.semantic_weight;

      expect(semanticContribution).toBeGreaterThanOrEqual(literalContribution);
    });
  });

  describe('Keyword Context Analysis', () => {
    test('should analyze keyword presence and context', async () => {
      const resumeText = `
        Developed scalable React applications with Redux state management.
        Built RESTful APIs using Node.js and Express framework.
        Implemented CI/CD pipelines with Docker containers.
      `;
      const keywords = ['React', 'Node.js', 'Python', 'Docker'];

      const contexts = await semanticMatchingService.analyzeKeywordContext(
        resumeText,
        keywords
      );

      expect(contexts).toHaveLength(4);

      const reactContext = contexts.find(c => c.keyword === 'React');
      expect(reactContext?.found_in_resume).toBe(true);
      expect(reactContext?.context_sentences.length).toBeGreaterThan(0);
      expect(reactContext?.relevance_score).toBeGreaterThan(0);

      const pythonContext = contexts.find(c => c.keyword === 'Python');
      expect(pythonContext?.found_in_resume).toBe(false);
    });

    test('should suggest semantic alternatives for missing keywords', async () => {
      const resumeText = 'Built containerized applications using container orchestration';
      const keywords = ['Docker', 'Kubernetes'];

      const contexts = await semanticMatchingService.analyzeKeywordContext(
        resumeText,
        keywords
      );

      contexts.forEach(context => {
        if (!context.found_in_resume && context.semantic_alternatives) {
          expect(context.semantic_alternatives.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Cache Management', () => {
    test('should clear cache', () => {
      semanticMatchingService.clearCache();
      const cacheSize = semanticMatchingService.getCacheSize();
      expect(cacheSize).toBe(0);
    });

    test('should track cache size', async () => {
      semanticMatchingService.clearCache();

      await semanticMatchingService.generateEmbedding('test1');
      await semanticMatchingService.generateEmbedding('test2');

      const cacheSize = semanticMatchingService.getCacheSize();
      expect(cacheSize).toBeGreaterThan(0);
    });
  });
});

describe('SynonymExpansionService', () => {
  describe('Keyword Expansion', () => {
    test('should expand technical keywords', async () => {
      const synonyms = await synonymExpansionService.expandKeyword('JavaScript');

      expect(synonyms).toBeDefined();
      expect(Array.isArray(synonyms)).toBe(true);
      expect(synonyms.length).toBeGreaterThan(0);
      expect(synonyms).toContain('js');
    });

    test('should expand framework names', async () => {
      const reactSynonyms = await synonymExpansionService.expandKeyword('React');

      expect(reactSynonyms).toContain('reactjs');
      expect(reactSynonyms).toContain('react.js');
    });

    test('should expand cloud platforms', async () => {
      const awsSynonyms = await synonymExpansionService.expandKeyword('AWS');

      expect(awsSynonyms.some(s => s.toLowerCase().includes('amazon'))).toBe(true);
    });
  });

  describe('Match with Expansion', () => {
    test('should match keywords using synonyms', async () => {
      const resumeText = 'Experienced with JS, ReactJS, and K8s';
      const keywords = ['JavaScript', 'React', 'Kubernetes'];

      const results = await synonymExpansionService.matchWithExpansion(
        resumeText,
        keywords
      );

      expect(results.size).toBe(3);

      const jsMatch = results.get('JavaScript');
      expect(jsMatch?.found).toBe(true);
      expect(jsMatch?.matchedAs?.toLowerCase()).toBe('js');

      const reactMatch = results.get('React');
      expect(reactMatch?.found).toBe(true);

      const k8sMatch = results.get('Kubernetes');
      expect(k8sMatch?.found).toBe(true);
      expect(k8sMatch?.matchedAs?.toLowerCase()).toBe('k8s');
    });
  });

  describe('Custom Synonyms', () => {
    test('should add custom synonyms', async () => {
      synonymExpansionService.addCustomSynonym('MyFramework', ['myfmwk', 'my-framework']);

      const synonyms = await synonymExpansionService.expandKeyword('MyFramework');

      expect(synonyms).toContain('myfmwk');
      expect(synonyms).toContain('my-framework');
    });
  });

  describe('Semantic Clustering', () => {
    test('should build semantic clusters', () => {
      const terms = ['React', 'ReactJS', 'Angular', 'AngularJS', 'Vue', 'VueJS'];

      const clusters = synonymExpansionService.buildSemanticCluster(terms);

      expect(clusters.length).toBeGreaterThan(0);
      expect(clusters.every(c => c.synonyms.length > 0)).toBe(true);
    });
  });
});

console.log('✅ All semantic matching tests defined');
