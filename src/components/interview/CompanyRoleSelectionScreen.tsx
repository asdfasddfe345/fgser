import React, { useState } from 'react';
import { ArrowLeft, Building2, ChevronRight } from 'lucide-react';
import { POPULAR_COMPANIES } from '../../types/interview';

interface CompanyRoleSelectionScreenProps {
  onCompanyRoleSelected: (company: string, role: string) => void;
  onBack: () => void;
}

export const CompanyRoleSelectionScreen: React.FC<CompanyRoleSelectionScreenProps> = ({
  onCompanyRoleSelected,
  onBack
}) => {
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  const selectedCompanyData = POPULAR_COMPANIES.find(c => c.name === selectedCompany);

  const handleCompanyClick = (companyName: string) => {
    setSelectedCompany(companyName);
  };

  const handleRoleClick = (role: string) => {
    if (selectedCompany) {
      onCompanyRoleSelected(selectedCompany, role);
    }
  };

  const handleBackToCompanies = () => {
    setSelectedCompany(null);
  };

  if (selectedCompany && selectedCompanyData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-dark-100 dark:via-dark-50 dark:to-dark-100">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <button
            onClick={handleBackToCompanies}
            className="flex items-center gap-2 text-secondary-600 hover:text-secondary-900 dark:text-gray-400 dark:hover:text-gray-200 mb-8 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Companies</span>
          </button>

          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-secondary-900 dark:text-gray-100 mb-4">
              Select Role at {selectedCompany}
            </h2>
            <p className="text-lg text-secondary-600 dark:text-gray-400">
              Choose the specific role you're interviewing for
            </p>
          </div>

          <div className="bg-white dark:bg-dark-200 rounded-xl shadow-lg border border-gray-200 dark:border-dark-300 p-6">
            <div className="space-y-3">
              {selectedCompanyData.roles.map((role) => (
                <button
                  key={role}
                  onClick={() => handleRoleClick(role)}
                  className="w-full group bg-white dark:bg-dark-300 rounded-lg border-2 border-gray-200 dark:border-dark-400 hover:border-purple-500 dark:hover:border-purple-400 p-4 transition-all hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <h3 className="text-lg font-bold text-secondary-900 dark:text-gray-100">
                        {role}
                      </h3>
                      <p className="text-sm text-secondary-600 dark:text-gray-400">
                        Interview questions specific to {selectedCompany}
                      </p>
                    </div>
                    <ChevronRight className="w-6 h-6 text-purple-600 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-dark-200 dark:to-dark-200 rounded-xl p-6">
            <h4 className="font-semibold text-secondary-900 dark:text-gray-100 mb-3">
              Interview Style for {selectedCompany}
            </h4>
            <p className="text-secondary-700 dark:text-gray-300 mb-3">
              This interview will include questions that mirror {selectedCompany}'s actual interview process:
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedCompanyData.categories.map((cat) => (
                <span
                  key={cat}
                  className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium"
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            Select Target Company
          </h2>
          <p className="text-lg text-secondary-600 dark:text-gray-400">
            Choose the company you're preparing to interview with
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {POPULAR_COMPANIES.map((company) => (
            <button
              key={company.name}
              onClick={() => handleCompanyClick(company.name)}
              className="group bg-white dark:bg-dark-200 rounded-xl shadow-lg border-2 border-gray-200 dark:border-dark-300 hover:border-purple-500 dark:hover:border-purple-400 p-6 transition-all hover:shadow-xl"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-3 rounded-xl group-hover:scale-110 transition-transform">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <ChevronRight className="w-6 h-6 text-purple-600 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              <h3 className="text-xl font-bold text-secondary-900 dark:text-gray-100 mb-2">
                {company.name}
              </h3>

              <p className="text-sm text-secondary-600 dark:text-gray-400 mb-3">
                {company.roles.length} roles available
              </p>

              <div className="flex flex-wrap gap-1">
                {company.categories.slice(0, 3).map((cat) => (
                  <span
                    key={cat}
                    className="px-2 py-1 bg-gray-100 dark:bg-dark-300 text-gray-700 dark:text-gray-300 rounded text-xs"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-12 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-dark-200 dark:to-dark-200 rounded-xl p-6">
          <h4 className="font-semibold text-secondary-900 dark:text-gray-100 mb-3">
            Company-Specific Interview Preparation
          </h4>
          <ul className="text-secondary-700 dark:text-gray-300 space-y-2">
            <li>Questions tailored to the company's interview style</li>
            <li>Role-specific technical and behavioral questions</li>
            <li>Company culture and values assessment</li>
            <li>Real interview scenarios from these companies</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
