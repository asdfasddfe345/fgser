import React, { useState } from 'react';
import { ArrowLeft, Briefcase, Code, Database, Smartphone, Cloud, Shield, Brain, LineChart } from 'lucide-react';

interface RoleSelectionScreenProps {
  onRoleSelected: (role: string) => void;
  onBack: () => void;
}

const AVAILABLE_ROLES = [
  {
    category: 'Software Engineering',
    icon: <Code className="w-6 h-6" />,
    roles: [
      'Frontend Developer',
      'Backend Developer',
      'Full Stack Developer',
      'Software Engineer',
      'Senior Software Engineer'
    ]
  },
  {
    category: 'Mobile Development',
    icon: <Smartphone className="w-6 h-6" />,
    roles: ['Android Developer', 'iOS Developer', 'React Native Developer', 'Flutter Developer']
  },
  {
    category: 'Data & AI',
    icon: <Brain className="w-6 h-6" />,
    roles: ['Data Scientist', 'Data Engineer', 'Machine Learning Engineer', 'AI Engineer', 'Data Analyst']
  },
  {
    category: 'DevOps & Cloud',
    icon: <Cloud className="w-6 h-6" />,
    roles: ['DevOps Engineer', 'Cloud Engineer', 'Site Reliability Engineer', 'Platform Engineer']
  },
  {
    category: 'Database & Systems',
    icon: <Database className="w-6 h-6" />,
    roles: ['Database Administrator', 'Systems Engineer', 'Backend Architect']
  },
  {
    category: 'Security',
    icon: <Shield className="w-6 h-6" />,
    roles: ['Security Engineer', 'Penetration Tester', 'Security Analyst']
  },
  {
    category: 'Product & Management',
    icon: <LineChart className="w-6 h-6" />,
    roles: ['Product Manager', 'Technical Product Manager', 'Engineering Manager', 'Project Manager']
  }
];

export const RoleSelectionScreen: React.FC<RoleSelectionScreenProps> = ({
  onRoleSelected,
  onBack
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleRoleClick = (role: string) => {
    onRoleSelected(role);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-dark-100 dark:via-dark-50 dark:to-dark-100">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-secondary-600 hover:text-secondary-900 dark:text-gray-400 dark:hover:text-gray-200 mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 dark:text-gray-100 mb-4">
            Select Your Target Role
          </h2>
          <p className="text-lg text-secondary-600 dark:text-gray-400">
            Choose the role you're preparing for to get relevant interview questions
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {AVAILABLE_ROLES.map((category) => (
            <div
              key={category.category}
              className="bg-white dark:bg-dark-200 rounded-xl shadow-lg border border-gray-200 dark:border-dark-300 overflow-hidden hover:shadow-xl transition-all"
            >
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4">
                <div className="flex items-center gap-3 text-white">
                  {category.icon}
                  <h3 className="text-lg font-bold">{category.category}</h3>
                </div>
              </div>

              <div className="p-4 space-y-2">
                {category.roles.map((role) => (
                  <button
                    key={role}
                    onClick={() => handleRoleClick(role)}
                    className="w-full text-left px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-dark-300 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-secondary-900 dark:text-gray-100">
                        {role}
                      </span>
                      <ArrowLeft className="w-4 h-4 text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity rotate-180" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-dark-200 dark:to-dark-200 rounded-xl p-6">
          <h4 className="font-semibold text-secondary-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            What happens next?
          </h4>
          <ul className="text-secondary-700 dark:text-gray-300 space-y-2">
            <li>1. Upload your resume for personalized questions</li>
            <li>2. Set your preferred interview duration (minimum 15 minutes)</li>
            <li>3. Start your realistic mock interview with AI-powered feedback</li>
            <li>4. Get detailed performance analysis and improvement suggestions</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
