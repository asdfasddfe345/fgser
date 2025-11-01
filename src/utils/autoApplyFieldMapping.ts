// src/utils/autoApplyFieldMapping.ts
import { AutoApplyFormData, FormFieldMapping } from '../types/autoApply';

/**
 * Maps ResumeData to common application form fields
 */
export const createFormFieldMappings = (userData: AutoApplyFormData): FormFieldMapping[] => {
  const mappings: FormFieldMapping[] = [
    // Personal Information
    {
      fieldName: 'full_name',
      fieldType: 'text',
      value: userData.fullName,
      alternatives: ['name', 'fullname', 'full-name', 'firstName', 'first_name', 'lastname', 'last_name']
    },
    {
      fieldName: 'email',
      fieldType: 'email',
      value: userData.email,
      alternatives: ['email_address', 'emailAddress', 'email-address', 'mail']
    },
    {
      fieldName: 'phone',
      fieldType: 'tel',
      value: userData.phone,
      alternatives: ['phone_number', 'phoneNumber', 'mobile', 'contact', 'telephone']
    },
    {
      fieldName: 'location',
      fieldType: 'text',
      value: userData.location || '',
      alternatives: ['address', 'city', 'current_location', 'location', 'residence']
    },

    // Professional Links
    {
      fieldName: 'linkedin',
      fieldType: 'text',
      value: userData.linkedin || '',
      alternatives: ['linkedin_url', 'linkedinUrl', 'linkedin-url', 'linkedin_profile']
    },
    {
      fieldName: 'github',
      fieldType: 'text',
      value: userData.github || '',
      alternatives: ['github_url', 'githubUrl', 'github-url', 'github_profile', 'portfolio']
    },

    // Education (typically the most recent/highest degree)
    {
      fieldName: 'education',
      fieldType: 'text',
      value: userData.education.length > 0 
        ? `${userData.education[0].degree} from ${userData.education[0].school} (${userData.education[0].year})`
        : '',
      alternatives: ['degree', 'qualification', 'education_details', 'university', 'college']
    },
    {
      fieldName: 'college',
      fieldType: 'text',
      value: userData.education.length > 0 ? userData.education[0].school : '',
      alternatives: ['university', 'school', 'institution', 'college_name']
    },
    {
      fieldName: 'graduation_year',
      fieldType: 'text',
      value: userData.education.length > 0 ? userData.education[0].year : '',
      alternatives: ['year', 'passing_year', 'grad_year', 'completion_year']
    },

    // Work Experience (most recent)
    {
      fieldName: 'experience',
      fieldType: 'textarea',
      value: userData.workExperience.length > 0 
        ? `${userData.workExperience[0].role} at ${userData.workExperience[0].company} (${userData.workExperience[0].year})\n${userData.workExperience[0].description}`
        : '',
      alternatives: ['work_experience', 'job_experience', 'professional_experience']
    },
    {
      fieldName: 'current_company',
      fieldType: 'text',
      value: userData.workExperience.length > 0 ? userData.workExperience[0].company : '',
      alternatives: ['company', 'employer', 'organization', 'workplace']
    },
    {
      fieldName: 'current_role',
      fieldType: 'text',
      value: userData.workExperience.length > 0 ? userData.workExperience[0].role : '',
      alternatives: ['position', 'job_title', 'designation', 'role']
    },

    // Skills
    {
      fieldName: 'skills',
      fieldType: 'textarea',
      value: userData.skills.map(skill => `${skill.category}: ${skill.skills.join(', ')}`).join('\n'),
      alternatives: ['technical_skills', 'key_skills', 'core_skills', 'skill_set']
    },

    // Cover Letter / Why You
    {
      fieldName: 'cover_letter',
      fieldType: 'textarea',
      value: userData.summary || userData.careerObjective || 
        `I am interested in the ${userData.workExperience.length > 0 ? userData.workExperience[0].role : 'position'} role and believe my background in ${userData.skills.length > 0 ? userData.skills[0].skills.join(', ') : 'technology'} makes me a strong candidate.`,
      alternatives: ['why_you', 'motivation', 'cover_letter', 'additional_info', 'message']
    },

    // Additional Common Fields
    {
      fieldName: 'portfolio_url',
      fieldType: 'text',
      value: userData.portfolioUrl || userData.github || '',
      alternatives: ['portfolio', 'website', 'personal_website', 'portfolio_link']
    },
    {
      fieldName: 'expected_salary',
      fieldType: 'text',
      value: userData.expectedSalary || '',
      alternatives: ['salary', 'expected_ctc', 'compensation', 'salary_expectation']
    },
    {
      fieldName: 'notice_period',
      fieldType: 'text',
      value: userData.noticePeriod || 'Immediate',
      alternatives: ['notice', 'availability', 'joining_date', 'start_date']
    }
  ];

  return mappings.filter(mapping => mapping.value && mapping.value.toString().trim() !== '');
};

/**
 * Common form field selectors used by the headless browser
 */
export const COMMON_FIELD_SELECTORS = {
  name: [
    'input[name*="name"]',
    'input[id*="name"]',
    'input[placeholder*="name"]',
    '[data-testid*="name"]'
  ],
  email: [
    'input[type="email"]',
    'input[name*="email"]',
    'input[id*="email"]',
    'input[placeholder*="email"]'
  ],
  phone: [
    'input[type="tel"]',
    'input[name*="phone"]',
    'input[name*="mobile"]',
    'input[id*="phone"]',
    'input[placeholder*="phone"]'
  ],
  resume: [
    'input[type="file"]',
    'input[name*="resume"]',
    'input[name*="cv"]',
    'input[id*="resume"]',
    'input[accept*="pdf"]'
  ],
  submit: [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:contains("Submit")',
    'button:contains("Apply")',
    '[data-testid*="submit"]'
  ]
};

/**
 * Intelligent field detection based on label text, placeholder, and context
 */
export const detectFieldType = (element: any): string => {
  const text = (element.label + ' ' + element.placeholder + ' ' + element.name + ' ' + element.id).toLowerCase();
  
  if (text.includes('email')) return 'email';
  if (text.includes('phone') || text.includes('mobile') || text.includes('contact')) return 'phone';
  if (text.includes('name') && !text.includes('company') && !text.includes('file')) return 'name';
  if (text.includes('linkedin')) return 'linkedin';
  if (text.includes('github') || text.includes('portfolio')) return 'github';
  if (text.includes('education') || text.includes('degree') || text.includes('university')) return 'education';
  if (text.includes('experience') || text.includes('work')) return 'experience';
  if (text.includes('skill')) return 'skills';
  if (text.includes('cover') || text.includes('why') || text.includes('motivation')) return 'cover_letter';
  if (text.includes('resume') || text.includes('cv') || text.includes('file')) return 'resume';
  if (text.includes('salary') || text.includes('compensation')) return 'salary';
  if (text.includes('notice') || text.includes('availability')) return 'notice_period';
  
  return 'text'; // Default fallback
};