import { AutoApplyFormData, FormFieldMapping } from '../types/autoApply';

export interface PlatformStrategy {
  platform: string;
  detectUrl: (url: string) => boolean;
  getFieldMappings: () => FormFieldMapping[];
  getNavigationSteps?: () => string[];
  getSubmitButtonSelector: () => string;
  getFileUploadSelector: () => string;
  requiresLogin: boolean;
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
}

const linkedInStrategy: PlatformStrategy = {
  platform: 'linkedin',
  detectUrl: (url: string) => url.toLowerCase().includes('linkedin.com'),
  requiresLogin: true,
  estimatedComplexity: 'moderate',

  getFieldMappings: () => [
    { fieldName: 'firstName', fieldType: 'text', value: '', selector: 'input[name="firstName"]' },
    { fieldName: 'lastName', fieldType: 'text', value: '', selector: 'input[name="lastName"]' },
    { fieldName: 'email', fieldType: 'email', value: '', selector: 'input[name="email"]' },
    { fieldName: 'phone', fieldType: 'tel', value: '', selector: 'input[name="phone"]' },
  ],

  getSubmitButtonSelector: () => 'button[type="submit"], button[aria-label*="Submit"], button:has-text("Submit application")',

  getFileUploadSelector: () => 'input[type="file"][name*="resume"], input[type="file"][accept*="pdf"]',

  getNavigationSteps: () => [
    'Click "Easy Apply" button',
    'Wait for application modal to open',
    'Fill in required fields',
    'Upload resume if requested',
    'Click through multi-step form if needed',
    'Submit application',
  ],
};

const workdayStrategy: PlatformStrategy = {
  platform: 'workday',
  detectUrl: (url: string) => url.toLowerCase().includes('workday') || url.toLowerCase().includes('myworkdayjobs'),
  requiresLogin: false,
  estimatedComplexity: 'complex',

  getFieldMappings: () => [
    { fieldName: 'name', fieldType: 'text', value: '', selector: 'input[data-automation-id*="legalName"], input[name*="name"]' },
    { fieldName: 'email', fieldType: 'email', value: '', selector: 'input[data-automation-id*="email"], input[type="email"]' },
    { fieldName: 'phone', fieldType: 'tel', value: '', selector: 'input[data-automation-id*="phone"], input[type="tel"]' },
    { fieldName: 'address', fieldType: 'text', value: '', selector: 'input[data-automation-id*="address"]' },
    { fieldName: 'city', fieldType: 'text', value: '', selector: 'input[data-automation-id*="city"]' },
    { fieldName: 'country', fieldType: 'select', value: '', selector: 'select[data-automation-id*="country"]' },
  ],

  getSubmitButtonSelector: () => 'button[data-automation-id*="submit"], button[aria-label*="Submit"]',

  getFileUploadSelector: () => 'input[type="file"][data-automation-id*="resume"], input[type="file"][data-automation-id*="file"]',

  getNavigationSteps: () => [
    'Click "Apply" button on job posting',
    'Fill in personal information section',
    'Complete work experience section',
    'Upload resume and cover letter',
    'Answer pre-screening questions',
    'Review and submit application',
  ],
};

const greenhouseStrategy: PlatformStrategy = {
  platform: 'greenhouse',
  detectUrl: (url: string) => url.toLowerCase().includes('greenhouse.io') || url.toLowerCase().includes('boards.greenhouse'),
  requiresLogin: false,
  estimatedComplexity: 'moderate',

  getFieldMappings: () => [
    { fieldName: 'first_name', fieldType: 'text', value: '', selector: 'input[name="first_name"], input[id*="first_name"]' },
    { fieldName: 'last_name', fieldType: 'text', value: '', selector: 'input[name="last_name"], input[id*="last_name"]' },
    { fieldName: 'email', fieldType: 'email', value: '', selector: 'input[name="email"], input[type="email"]' },
    { fieldName: 'phone', fieldType: 'tel', value: '', selector: 'input[name="phone"], input[type="tel"]' },
    { fieldName: 'location', fieldType: 'text', value: '', selector: 'input[name="location"]' },
  ],

  getSubmitButtonSelector: () => 'input[type="submit"][value*="Submit"], button[type="submit"]',

  getFileUploadSelector: () => 'input[type="file"][name*="resume"], input#resume',

  getNavigationSteps: () => [
    'Navigate to application form',
    'Fill in contact information',
    'Upload resume file',
    'Answer application questions',
    'Submit application',
  ],
};

const leverStrategy: PlatformStrategy = {
  platform: 'lever',
  detectUrl: (url: string) => url.toLowerCase().includes('lever.co') || url.toLowerCase().includes('jobs.lever'),
  requiresLogin: false,
  estimatedComplexity: 'simple',

  getFieldMappings: () => [
    { fieldName: 'name', fieldType: 'text', value: '', selector: 'input[name="name"]' },
    { fieldName: 'email', fieldType: 'email', value: '', selector: 'input[name="email"]' },
    { fieldName: 'phone', fieldType: 'tel', value: '', selector: 'input[name="phone"]' },
    { fieldName: 'org', fieldType: 'text', value: '', selector: 'input[name="org"]' },
    { fieldName: 'urls[LinkedIn]', fieldType: 'text', value: '', selector: 'input[name="urls[LinkedIn]"]' },
    { fieldName: 'urls[GitHub]', fieldType: 'text', value: '', selector: 'input[name="urls[GitHub]"]' },
  ],

  getSubmitButtonSelector: () => 'button[type="submit"].template-btn-submit',

  getFileUploadSelector: () => 'input[type="file"][name="resume"]',

  getNavigationSteps: () => [
    'Fill in basic contact information',
    'Upload resume',
    'Add portfolio links if applicable',
    'Submit application',
  ],
};

const genericStrategy: PlatformStrategy = {
  platform: 'generic',
  detectUrl: () => true,
  requiresLogin: false,
  estimatedComplexity: 'moderate',

  getFieldMappings: () => [
    {
      fieldName: 'name',
      fieldType: 'text',
      value: '',
      selector: 'input[name*="name" i], input[id*="name" i], input[placeholder*="name" i]',
      alternatives: ['input[name="fullname"]', 'input[name="full_name"]', 'input[name="applicant_name"]'],
    },
    {
      fieldName: 'email',
      fieldType: 'email',
      value: '',
      selector: 'input[type="email"], input[name*="email" i], input[id*="email" i]',
    },
    {
      fieldName: 'phone',
      fieldType: 'tel',
      value: '',
      selector: 'input[type="tel"], input[name*="phone" i], input[id*="phone" i]',
    },
    {
      fieldName: 'linkedin',
      fieldType: 'text',
      value: '',
      selector: 'input[name*="linkedin" i], input[id*="linkedin" i], input[placeholder*="linkedin" i]',
    },
    {
      fieldName: 'github',
      fieldType: 'text',
      value: '',
      selector: 'input[name*="github" i], input[id*="github" i], input[placeholder*="github" i]',
    },
  ],

  getSubmitButtonSelector: () => 'button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Apply")',

  getFileUploadSelector: () => 'input[type="file"][accept*="pdf"], input[type="file"][name*="resume" i], input[type="file"][name*="cv" i]',

  getNavigationSteps: () => [
    'Analyze form structure',
    'Fill detected fields',
    'Upload resume if file input found',
    'Submit form',
  ],
};

export const platformStrategies: PlatformStrategy[] = [
  linkedInStrategy,
  workdayStrategy,
  greenhouseStrategy,
  leverStrategy,
  genericStrategy,
];

export function detectPlatformStrategy(url: string): PlatformStrategy {
  for (const strategy of platformStrategies) {
    if (strategy.platform !== 'generic' && strategy.detectUrl(url)) {
      return strategy;
    }
  }
  return genericStrategy;
}

export function getPlatformName(url: string): string {
  const strategy = detectPlatformStrategy(url);
  return strategy.platform;
}

export function getFieldMappingsForPlatform(url: string): FormFieldMapping[] {
  const strategy = detectPlatformStrategy(url);
  return strategy.getFieldMappings();
}

export function mapFormDataToFields(
  formData: AutoApplyFormData,
  platform: string
): { [key: string]: string } {
  const mappedData: { [key: string]: string } = {};

  if (platform === 'linkedin') {
    const nameParts = formData.fullName.split(' ');
    mappedData['firstName'] = nameParts[0] || '';
    mappedData['lastName'] = nameParts.slice(1).join(' ') || '';
    mappedData['email'] = formData.email;
    mappedData['phone'] = formData.phone;
  } else if (platform === 'greenhouse') {
    const nameParts = formData.fullName.split(' ');
    mappedData['first_name'] = nameParts[0] || '';
    mappedData['last_name'] = nameParts.slice(1).join(' ') || '';
    mappedData['email'] = formData.email;
    mappedData['phone'] = formData.phone;
    mappedData['location'] = formData.location || '';
  } else if (platform === 'lever') {
    mappedData['name'] = formData.fullName;
    mappedData['email'] = formData.email;
    mappedData['phone'] = formData.phone;
    if (formData.linkedin) mappedData['urls[LinkedIn]'] = formData.linkedin;
    if (formData.github) mappedData['urls[GitHub]'] = formData.github;
  } else {
    mappedData['name'] = formData.fullName;
    mappedData['email'] = formData.email;
    mappedData['phone'] = formData.phone;
    if (formData.linkedin) mappedData['linkedin'] = formData.linkedin;
    if (formData.github) mappedData['github'] = formData.github;
    if (formData.location) mappedData['location'] = formData.location;
  }

  return mappedData;
}
