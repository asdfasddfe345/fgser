import React, { useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { TestCase, ExecutionResult } from '../../services/codeCompilerService';

interface TestCaseAccordionProps {
  testCases: TestCase[];
  executionResults: ExecutionResult[];
  isExecuting: boolean;
}

export const TestCaseAccordion: React.FC<TestCaseAccordionProps> = ({
  testCases,
  executionResults,
  isExecuting
}) => {
  const [expandedCases, setExpandedCases] = useState<Set<number>>(new Set([0]));

  const toggleCase = (index: number) => {
    const newExpanded = new Set(expandedCases);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedCases(newExpanded);
  };

  const expandAll = () => {
    setExpandedCases(new Set(testCases.map((_, i) => i)));
  };

  const collapseAll = () => {
    setExpandedCases(new Set());
  };

  if (testCases.length === 0) {
    return null;
  }

  // Build a quick lookup to robustly match results to test cases even if order differs
  const makeKey = (tc: TestCase) => `${tc.input}__${tc.expectedOutput}`;
  const resultMap = new Map<string, ExecutionResult>();
  for (const r of executionResults) {
    resultMap.set(makeKey(r.testCase), r);
  }

  const resultsMatched = testCases.map(tc => resultMap.get(makeKey(tc))).filter(Boolean) as ExecutionResult[];
  const passedCount = resultsMatched.filter(r => r.passed).length;
  const totalTests = testCases.length;

  return (
    <div className="bg-dark-300 rounded-lg border border-gray-700 overflow-hidden">
      <div className="bg-dark-400 px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-gray-100">
            Test Cases {totalTests > 0 && `(${passedCount}/${totalTests} passed)`}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {isExecuting && (
            <div className="flex items-center gap-2 text-yellow-400 text-sm">
              <Clock className="w-4 h-4 animate-spin" />
              <span>Running tests...</span>
            </div>
          )}
          {expandedCases.size > 0 ? (
            <button
              onClick={collapseAll}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Collapse All
            </button>
          ) : (
            <button
              onClick={expandAll}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Expand All
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-700">
        {testCases.map((testCase, index) => {
          const result = resultMap.get(makeKey(testCase));
          const isExpanded = expandedCases.has(index);

          return (
            <div key={index} className="bg-dark-300">
              <button
                onClick={() => toggleCase(index)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-dark-400 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {result ? (
                    result.passed ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
                  )}
                  <span className="font-medium text-gray-200">Test Case {index + 1}</span>
                  {result && (
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        result.passed
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-red-900/30 text-red-400'
                      }`}
                    >
                      {result.passed ? 'Passed' : 'Failed'}
                    </span>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 bg-dark-400">
                  <div className="bg-dark-500 rounded p-3">
                    <div className="text-xs text-gray-400 mb-1 font-semibold">Input:</div>
                    <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap break-words">
                      {testCase.input}
                    </pre>
                  </div>

                  <div className="bg-dark-500 rounded p-3">
                    <div className="text-xs text-gray-400 mb-1 font-semibold">Expected Output:</div>
                    <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap break-words">
                      {testCase.expectedOutput}
                    </pre>
                  </div>

                  {result && (
                    <>
                      <div
                        className={`rounded p-3 ${
                          result.passed ? 'bg-green-900/20' : 'bg-red-900/20'
                        }`}
                      >
                        <div className="text-xs text-gray-400 mb-1 font-semibold">
                          Your Output:
                        </div>
                        <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap break-words">
                          {result.actualOutput}
                        </pre>
                      </div>

                      {result.error && (
                        <div className="bg-red-900/20 rounded p-3 border border-red-700">
                          <div className="text-xs text-red-400 mb-1 font-semibold">Error:</div>
                          <pre className="text-sm text-red-300 font-mono whitespace-pre-wrap break-words">
                            {result.error}
                          </pre>
                        </div>
                      )}

                      {result.executionTime && (
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Execution: {result.executionTime}ms</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
