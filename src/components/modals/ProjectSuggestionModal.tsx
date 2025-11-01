import React, { useState } from 'react';
import {
  X,
  Code,
  ExternalLink,
  Github,
  TrendingUp,
  Check,
  AlertCircle,
  Sparkles,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { ProjectSuggestion } from '../../services/aiProjectSuggestionService';

interface ProjectSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectSuggestion[];
  matchScore: number;
  potentialImprovement: number;
  reasoning: string;
  onProjectSelect: (
    project: ProjectSuggestion,
    action: 'replace' | 'add' | 'skip'
  ) => Promise<void>;
  loading?: boolean;
}

export const ProjectSuggestionModal: React.FC<ProjectSuggestionModalProps> = ({
  isOpen,
  onClose,
  projects,
  matchScore,
  potentialImprovement,
  reasoning,
  onProjectSelect,
  loading = false,
}) => {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAction = async (
    project: ProjectSuggestion,
    action: 'replace' | 'add' | 'skip'
  ) => {
    try {
      setProcessingAction(action);
      await onProjectSelect(project, action);
    } catch (error) {
      console.error('Error processing project action:', error);
    } finally {
      setProcessingAction(null);
    }
  };

  const projectedScore = matchScore + potentialImprovement;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-100 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white dark:bg-dark-100 p-2 rounded-lg">
                <Sparkles className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  AI Project Suggestions
                </h2>
                <p className="text-blue-100">
                  Boost your resume match score with relevant projects
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
              disabled={loading || processingAction !== null}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Score Display */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="bg-white dark:bg-dark-100 bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
              <p className="text-blue-100 text-sm">Current Score</p>
              <p className="text-3xl font-bold text-white">{matchScore}%</p>
            </div>
            <div className="bg-white dark:bg-dark-100 bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
              <p className="text-blue-100 text-sm">Potential Improvement</p>
              <p className="text-3xl font-bold text-white flex items-center">
                +{potentialImprovement}%
                <TrendingUp className="w-5 h-5 ml-2" />
              </p>
            </div>
            <div className="bg-white dark:bg-dark-100 bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
              <p className="text-blue-100 text-sm">Projected Score</p>
              <p className="text-3xl font-bold text-white">{projectedScore}%</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* AI Reasoning */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Why These Projects?
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {reasoning}
                </p>
              </div>
            </div>
          </div>

          {/* Project Cards */}
          <div className="space-y-6">
            {projects.map((project, index) => (
              <div
                key={index}
                className={`border-2 rounded-2xl p-6 transition-all ${
                  selectedProject === project.projectTitle
                    ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-dark-300 bg-white dark:bg-dark-50'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                      {project.projectTitle}
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      {project.projectSummary}
                    </p>

                    {/* Tech Stack */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {project.techStack.map((tech, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-sm rounded-full font-medium"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>

                    {/* Links */}
                    <div className="flex flex-wrap gap-4 mb-4">
                      <a
                        href={`https://${project.githubLink}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
                      >
                        <Github className="w-4 h-4" />
                        <span>GitHub</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <a
                        href={`https://${project.liveDemoLink}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-sm font-medium"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Live Demo</span>
                      </a>
                    </div>

                    {/* Impact */}
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
                      <div className="flex items-start space-x-2">
                        <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-green-800 dark:text-green-300 font-medium">
                          {project.impactDescription}
                        </p>
                      </div>
                    </div>

                    {/* Code Snippet */}
                    <div className="bg-gray-900 dark:bg-dark-200 rounded-lg p-4 overflow-x-auto">
                      <div className="flex items-center space-x-2 mb-2">
                        <Code className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-400 font-mono">
                          Code Sample
                        </span>
                      </div>
                      <pre className="text-sm text-gray-300 font-mono overflow-x-auto">
                        {project.codeSnippet.trim()}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 mt-4">
                  <button
                    onClick={() => {
                      setSelectedProject(project.projectTitle);
                      handleAction(project, 'replace');
                    }}
                    disabled={
                      loading || processingAction !== null
                    }
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {processingAction === 'replace' ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Replacing...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-5 h-5" />
                        <span>Replace Existing Project</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedProject(project.projectTitle);
                      handleAction(project, 'add');
                    }}
                    disabled={
                      loading || processingAction !== null
                    }
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {processingAction === 'add' ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>Adding...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        <span>Add as New Project</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Skip All Button */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                if (projects.length > 0) {
                  handleAction(projects[0], 'skip');
                }
              }}
              disabled={loading || processingAction !== null}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingAction === 'skip' ? 'Skipping...' : 'Skip and Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
