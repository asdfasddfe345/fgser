import { supabase } from '../lib/supabaseClient';
import { geminiService } from './geminiServiceWrapper';

export interface TestCase {
  input: string;
  expectedOutput: string;
  description?: string;
}

export interface ExecutionResult {
  testCase: TestCase;
  actualOutput: string;
  passed: boolean;
  executionTime?: number;
  error?: string;
}

export interface CompilationResult {
  success: boolean;
  output?: string;
  error?: string;
  executionResults?: ExecutionResult[];
  allTestsPassed?: boolean;
  totalExecutionTime?: number;
}

class CodeCompilerService {
  private readonly JUDGE0_API = 'https://judge0-ce.p.rapidapi.com';
  private readonly RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY;
  private readonly RAPIDAPI_HOST = 'judge0-ce.p.rapidapi.com';

  private languageIds: { [key: string]: number } = {
    'Python': 71,
    'JavaScript': 63,
    'Java': 62,
    'C++': 54,
    'C': 50,
    'C#': 51,
    'Go': 60,
    'Ruby': 72,
    'PHP': 68,
    'Swift': 83,
    'Kotlin': 78,
    'Rust': 73,
    'TypeScript': 74
  };

  async generateTestCases(questionText: string, language: string): Promise<TestCase[]> {
    const prompt = `
You are a test case generator for coding interviews.

Question: ${questionText}
Programming Language: ${language}

Generate EXACTLY 2 test cases that:
1. Test basic functionality (simple case)
2. Test edge cases or complex scenarios

Format your response as JSON:
{
  "testCases": [
    {
      "input": "test input as string",
      "expectedOutput": "expected output as string",
      "description": "what this test case checks"
    },
    {
      "input": "test input as string",
      "expectedOutput": "expected output as string",
      "description": "what this test case checks"
    }
  ]
}

Important: Keep inputs and outputs simple and clear. For functions, provide the function call with arguments.
`;

    try {
      const response = await geminiService.generateText(prompt);
      const parsed = this.parseJSONResponse(response);
      return parsed.testCases || this.createFallbackTestCases();
    } catch (error) {
      console.error('Error generating test cases:', error);
      return this.createFallbackTestCases();
    }
  }

  async executeCode(
    code: string,
    language: string,
    testCases: TestCase[]
  ): Promise<CompilationResult> {
    if (!this.RAPIDAPI_KEY) {
      return this.mockExecuteCode(code, language, testCases);
    }

    const languageId = this.languageIds[language];
    if (!languageId) {
      return {
        success: false,
        error: `Unsupported language: ${language}`
      };
    }

    try {
      const executionResults: ExecutionResult[] = [];
      let totalExecutionTime = 0;

      for (const testCase of testCases) {
        const result = await this.executeWithTestCase(code, languageId, testCase);
        executionResults.push(result);
        if (result.executionTime) {
          totalExecutionTime += result.executionTime;
        }
      }

      const allTestsPassed = executionResults.every(r => r.passed);

      return {
        success: true,
        executionResults,
        allTestsPassed,
        totalExecutionTime
      };
    } catch (error) {
      console.error('Code execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed'
      };
    }
  }

  private async executeWithTestCase(
    code: string,
    languageId: number,
    testCase: TestCase
  ): Promise<ExecutionResult> {
    try {
      const submissionData = {
        source_code: btoa(code),
        language_id: languageId,
        stdin: btoa(testCase.input)
      };

      const createResponse = await fetch(`${this.JUDGE0_API}/submissions?base64_encoded=true&wait=true`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-RapidAPI-Key': this.RAPIDAPI_KEY!,
          'X-RapidAPI-Host': this.RAPIDAPI_HOST
        },
        body: JSON.stringify(submissionData)
      });

      if (!createResponse.ok) {
        throw new Error(`Judge0 API error: ${createResponse.statusText}`);
      }

      const result = await createResponse.json();

      const actualOutput = result.stdout ? atob(result.stdout).trim() : '';
      const error = result.stderr ? atob(result.stderr) : result.compile_output ? atob(result.compile_output) : undefined;
      const passed = actualOutput === testCase.expectedOutput.trim() && !error;

      return {
        testCase,
        actualOutput: actualOutput || error || 'No output',
        passed,
        executionTime: result.time ? parseFloat(result.time) * 1000 : undefined,
        error
      };
    } catch (error) {
      return {
        testCase,
        actualOutput: '',
        passed: false,
        error: error instanceof Error ? error.message : 'Execution failed'
      };
    }
  }

  private mockExecuteCode(code: string, language: string, testCases: TestCase[]): CompilationResult {
    const executionResults: ExecutionResult[] = testCases.map((testCase, index) => {
      const mockPassed = index === 0;
      return {
        testCase,
        actualOutput: mockPassed ? testCase.expectedOutput : 'Mock output',
        passed: mockPassed,
        executionTime: Math.random() * 100 + 50
      };
    });

    return {
      success: true,
      executionResults,
      allTestsPassed: executionResults.every(r => r.passed),
      totalExecutionTime: executionResults.reduce((sum, r) => sum + (r.executionTime || 0), 0),
      output: 'Mock execution - Configure RAPIDAPI_KEY for real execution'
    };
  }

  async saveExecutionResult(
    responseId: string,
    sessionId: string,
    code: string,
    language: string,
    testCases: TestCase[],
    executionResults: ExecutionResult[]
  ) {
    const allTestsPassed = executionResults.every(r => r.passed);
    const totalTime = executionResults.reduce((sum, r) => sum + (r.executionTime || 0), 0);

    const { data, error } = await supabase
      .from('code_execution_results')
      .insert({
        response_id: responseId,
        session_id: sessionId,
        code,
        language,
        test_cases: testCases,
        execution_results: executionResults,
        all_tests_passed: allTestsPassed,
        execution_time_ms: Math.round(totalTime),
        errors: executionResults.filter(r => r.error).map(r => r.error).join('\n') || null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getExecutionResults(responseId: string) {
    const { data, error } = await supabase
      .from('code_execution_results')
      .select('*')
      .eq('response_id', responseId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async analyzeCodeQuality(code: string, language: string, questionText: string): Promise<any> {
    const prompt = `
You are an expert code reviewer. Analyze this code submission for a coding interview.

Question: ${questionText}
Language: ${language}
Code:
\`\`\`${language.toLowerCase()}
${code}
\`\`\`

Provide analysis on:
1. Code correctness and logic
2. Time and space complexity
3. Code quality and readability
4. Best practices followed/violated
5. Potential improvements

Format your response as JSON:
{
  "correctness": "assessment of logic correctness",
  "complexity": "time and space complexity analysis",
  "codeQuality": "code quality assessment",
  "bestPractices": ["practice1", "practice2"],
  "improvements": ["improvement1", "improvement2"],
  "score": 0-100
}
`;

    try {
      const response = await geminiService.generateText(prompt);
      return this.parseJSONResponse(response);
    } catch (error) {
      console.error('Error analyzing code quality:', error);
      return {
        correctness: 'Unable to analyze',
        complexity: 'N/A',
        codeQuality: 'N/A',
        bestPractices: [],
        improvements: [],
        score: 50
      };
    }
  }

  getSupportedLanguages(): string[] {
    return Object.keys(this.languageIds);
  }

  private parseJSONResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(response);
    } catch {
      return {};
    }
  }

  private createFallbackTestCases(): TestCase[] {
    return [
      {
        input: 'test input 1',
        expectedOutput: 'expected output 1',
        description: 'Basic functionality test'
      },
      {
        input: 'test input 2',
        expectedOutput: 'expected output 2',
        description: 'Edge case test'
      }
    ];
  }
}

export const codeCompilerService = new CodeCompilerService();
