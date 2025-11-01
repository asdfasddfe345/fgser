// src/components/UserProfileManagement.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User as UserIcon,
  Mail,
  Phone,
  Linkedin,
  Github,
  Briefcase,
  Code,
  Award,
  GraduationCap,
  MapPin,
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Wallet,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Info,
  Target,
  Copy as CopyIcon,
  Share2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { paymentService } from '../services/paymentService';
import { FileUpload } from './FileUpload';
import { ResumeData, ExtractionResult } from '../types/resume';
import { AlertModal } from './AlertModal';
import { DeviceManagement } from './security/DeviceManagement';
import { supabase } from '../lib/supabaseClient'; // ADDED: Import supabase client

// Mock services for local development if needed
const mockAuthService = {
  updateUserProfile: async (userId: string, data: any) => {
    console.log('Updating profile for user ' + userId + ':', data);
    return Promise.resolve({ success: true });
  },
  markProfilePromptSeen: async (userId: string) => {
    console.log('Marking profile prompt seen for user ' + userId);
    return Promise.resolve({ success: true });
  },
};

const mockPaymentService = {
  getUserWalletBalance: async (userId: string) => {
    console.log('Fetching wallet balance for user ' + userId);
    return Promise.resolve(1000); // Mock balance in INR
  },
  redeemWalletBalance: async (userId: string, amount: number, method: string, details: any) => {
    console.log('Redeeming wallet balance for user ' + userId + ' amount ' + amount + ' method ' + method + ' details ' + JSON.stringify(details));
    return Promise.resolve({ success: true, transactionId: 'mock_tx_123' });
  },
  parseResumeWithAI: async (resumeText: string): Promise<ResumeData> => {
    const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OpenRouter API key is not configured. Please contact support.');
    }

    const text = (resumeText || '').trim();
    if (!text) {
      throw new Error('Parsed resume was empty. Please upload a readable resume file.');
    }

    const MAX_INPUT_LENGTH = 50000;
    let payload = text;
    let wasTrimmed = false;

    if (payload.length > MAX_INPUT_LENGTH) {
      payload = payload.slice(0, MAX_INPUT_LENGTH);
      wasTrimmed = true;
    }

    const promptLines = [
      'You are an expert ATS resume parsing assistant. Convert the resume text below into JSON that strictly matches this schema:',
      '',
      '{',
      '  "name": "",',
      '  "phone": "",',
      '  "email": "",',
      '  "linkedin": "",',
      '  "github": "",',
      '  "location": "",',
      '  "targetRole": "",',
      '  "summary": "",',
      '  "careerObjective": "",',
      '  "education": [',
      '    { "degree": "", "school": "", "year": "", "cgpa": "", "location": "" }',
      '  ],',
      '  "workExperience": [',
      '    { "role": "", "company": "", "year": "", "bullets": [] }',
      '  ],',
      '  "projects": [',
      '    { "title": "", "bullets": [] }',
      '  ],',
      '  "skills": [',
      '    { "category": "", "list": [] }',
      '  ],',
      '  "certifications": [',
      '    { "title": "", "description": "" }',
      '  ],',
      '  "additionalSections": [',
      '    { "title": "", "bullets": [] }',
      '  ],',
      '  "achievements": []',
      '}',
      '',
      'Rules:',
      '1. Use only information that explicitly appears in the resume.',
      '2. Keep field names exactly as defined above.',
      '3. If information is missing for a field, use an empty string or empty array as appropriate.',
      '4. Split multi-line or numbered lists into clean bullet arrays of strings.',
      '5. Preserve original phrasing for achievements and bullet points.',
      '6. Do not invent data, add commentary, or wrap the JSON in code fences.',
      '',
      'Resume Text:',
      '"""' + payload + '"""'
    ];
    const prompt = promptLines.join('\n');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://primoboost.ai',
        'X-Title': 'PrimoBoost AI',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('Resume parsing failed (' + response.status + '): ' + errorText);
    }

    const data = await response.json();
    let rawContent = data?.choices?.[0]?.message?.content;

    if (Array.isArray(rawContent)) {
      rawContent = rawContent
        .map((part: any) => {
          if (!part) return '';
          if (typeof part === 'string') return part;
          if (typeof part === 'object' && typeof part.text === 'string') return part.text;
          return '';
        })
        .join('\n');
    } else if (rawContent && typeof rawContent === 'object' && typeof rawContent.text === 'string') {
      rawContent = rawContent.text;
    }

    if (typeof rawContent !== 'string' || !rawContent.trim()) {
      throw new Error('Resume parsing service returned an empty response.');
    }

    const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)```/i);
    const cleaned = jsonMatch && jsonMatch[1]
      ? jsonMatch[1].trim()
      : rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned || '{}');
    } catch (error) {
      console.error('Failed to parse JSON from resume parser:', error);
      console.error('Resume parser raw output:', cleaned);
      throw new Error('Resume parsing service returned invalid data. Please try again.');
    }

    const asString = (value: any): string => {
      if (typeof value === 'string') return value.trim();
      if (typeof value === 'number') return String(value).trim();
      return '';
    };

    const ensureStringArray = (value: any): string[] => {
      if (Array.isArray(value)) {
        return value.map(asString).filter(Boolean);
      }
      return [];
    };

    const normalizeEducation = (value: any): ResumeData['education'] => {
      if (!Array.isArray(value)) return [];
      return value
        .map((item: any) => ({
          degree: asString(item?.degree),
          school: asString(item?.school),
          year: asString(item?.year),
          cgpa: asString(item?.cgpa),
          location: asString(item?.location),
        }))
        .filter(entry => entry.degree || entry.school || entry.year || entry.cgpa || entry.location);
    };

    const normalizeExperience = (value: any): ResumeData['workExperience'] => {
      if (!Array.isArray(value)) return [];
      return value
        .map((item: any) => ({
          role: asString(item?.role),
          company: asString(item?.company),
          year: asString(item?.year),
          bullets: ensureStringArray(item?.bullets),
        }))
        .filter(entry => entry.role || entry.company || entry.year || entry.bullets.length);
    };

    const normalizeProjects = (value: any): ResumeData['projects'] => {
      if (!Array.isArray(value)) return [];
      return value
        .map((item: any) => ({
          title: asString(item?.title),
          bullets: ensureStringArray(item?.bullets),
        }))
        .filter(entry => entry.title || entry.bullets.length);
    };

    const normalizeSkills = (value: any): ResumeData['skills'] => {
      if (!Array.isArray(value)) return [];
      return value
        .map((item: any) => {
          const list = ensureStringArray(item?.list);
          const category = asString(item?.category) || (list.length ? 'Skills' : '');
          if (!category && !list.length) {
            return null;
          }
          return { category, count: list.length, list };
        })
        .filter((entry): entry is ResumeData['skills'][number] => !!entry);
    };

    const normalizeCertifications = (value: any): ResumeData['certifications'] => {
      if (!Array.isArray(value)) return [];
      return value
        .map((item: any) => {
          if (typeof item === 'string') {
            const title = asString(item);
            return title ? { title, description: '' } : null;
          }
          const title = asString(item?.title);
          const description = asString(item?.description);
          if (!title && !description) {
            return null;
          }
          return { title, description };
        })
        .filter((entry): entry is { title: string; description: string } => !!entry);
    };

    const normalizeAdditionalSections = (value: any): { title: string; bullets: string[] }[] => {
      if (!Array.isArray(value)) return [];
      return value
        .map((item: any) => {
          const title = asString(item?.title);
          const bullets = ensureStringArray(item?.bullets);
          if (!title && !bullets.length) {
            return null;
          }
          return { title, bullets };
        })
        .filter((entry): entry is { title: string; bullets: string[] } => !!entry);
    };

    const resumeData: ResumeData = {
      name: asString(parsed?.name),
      phone: asString(parsed?.phone),
      email: asString(parsed?.email),
      linkedin: asString(parsed?.linkedin),
      github: asString(parsed?.github),
      location: asString(parsed?.location) || undefined,
      targetRole: asString(parsed?.targetRole) || undefined,
      summary: asString(parsed?.summary) || undefined,
      careerObjective: asString(parsed?.careerObjective) || undefined,
      education: normalizeEducation(parsed?.education),
      workExperience: normalizeExperience(parsed?.workExperience),
      projects: normalizeProjects(parsed?.projects),
      skills: normalizeSkills(parsed?.skills),
      certifications: normalizeCertifications(parsed?.certifications),
      origin: wasTrimmed ? 'parsed_resume_trimmed' : 'parsed_resume',
    };

    const additionalSections = normalizeAdditionalSections(parsed?.additionalSections);
    if (additionalSections.length) {
      resumeData.additionalSections = additionalSections;
    }

    const achievements = ensureStringArray(parsed?.achievements ?? parsed?.awards ?? parsed?.accomplishments);
    if (achievements.length) {
      resumeData.achievements = achievements;
    }

    return resumeData;
  },
};

// Zod Schemas
const educationSchema = z.object({
  degree: z.string().min(1, 'Degree is required'),
  school: z.string().min(1, 'School is required'),
  year: z.string().min(1, 'Year is required'),
  cgpa: z.string().optional(),
  location: z.string().optional(),
});

const workExperienceSchema = z.object({
  role: z.string().min(1, 'Role is required'),
  company: z.string().min(1, 'Company is required'),
  year: z.string().min(1, 'Year is required'),
  bullets: z.array(z.string().min(1, 'Bullet point cannot be empty')).min(1, 'At least one bullet point is required'),
});

const projectSchema = z.object({
  title: z.string().min(1, 'Project title is required'),
  bullets: z.array(z.string().min(1, 'Bullet point cannot be empty')).min(1, 'At least one bullet point is required'),
});

const skillSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  list: z.array(z.string().min(1, 'Skill cannot be empty')).min(1, 'At least one skill is required'),
});

const certificationSchema = z.object({
  title: z.string().min(1, 'Certification title is required'),
  description: z.string().optional(),
});

const profileSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email_address: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  linkedin_profile: z.string().url('Invalid LinkedIn URL').optional().or(z.literal('')),
  github_profile: z.string().url('Invalid GitHub URL').optional().or(z.literal('')),
  resume_headline: z.string().optional(),
  current_location: z.string().optional(),
  education_details: z.array(educationSchema),
  experience_details: z.array(workExperienceSchema),
  projects_details: z.array(projectSchema),
  skills_details: z.array(skillSchema),
  certifications_details: z.array(certificationSchema),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface UserProfileManagementProps {
  isOpen: boolean;
  onClose: () => void;
  viewMode?: 'profile' | 'wallet';
  walletRefreshKey: number;
  setWalletRefreshKey: React.Dispatch<React.SetStateAction<number>>;
}

export const UserProfileManagement: React.FC<UserProfileManagementProps> = ({
  isOpen,
  onClose,
  viewMode = 'profile',
  walletRefreshKey,
  setWalletRefreshKey,
}) => {
  const { user, revalidateUserSession, markProfilePromptSeen } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'wallet' | 'security'>(viewMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0); // In Rupees
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [isGeneratingReferral, setIsGeneratingReferral] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [redeemAmount, setRedeemAmount] = useState<string>('');
  const [redeemMethod, setRedeemMethod] = useState<'upi' | 'bank_transfer'>('upi');
  const [redeemDetails, setRedeemDetails] = useState<{ upiId?: string; bankAccount?: string; ifscCode?: string; accountHolderName?: string }>({});
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertContent, setAlertContent] = useState<{ title: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }>({ title: '', message: '', type: 'info' });
  const [isParsingResume, setIsParsingResume] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
    setValue, // Destructure setValue
    getValues, // Destructure getValues for logging
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: '',
      email_address: '',
      phone: '',
      linkedin_profile: '',
      github_profile: '',
      resume_headline: '',
      current_location: '',
      education_details: [],
      experience_details: [],
      projects_details: [],
      skills_details: [],
      certifications_details: [],
    },
  });

  // Field arrays for dynamic sections
  const { fields: educationFields, append: appendEducation, remove: removeEducation, update: updateEducation } = useFieldArray({ control, name: 'education_details' });
  const { fields: experienceFields, append: appendExperience, remove: removeExperience, update: updateExperience } = useFieldArray({ control, name: 'experience_details' });
  const { fields: projectFields, append: appendProject, remove: removeProject, update: updateProject } = useFieldArray({ control, name: 'projects_details' });
  const { fields: skillFields, append: appendSkill, remove: removeSkill, update: updateSkill } = useFieldArray({ control, name: 'skills_details' });
  const { fields: certificationFields, append: appendCertification, remove: removeCertification, update: updateCertification } = useFieldArray({ control, name: 'certifications_details' });

  useEffect(() => {
    if (viewMode) {
      setActiveTab(viewMode);
    }
  }, [viewMode]);

  useEffect(() => {
    if (user && isOpen) {
      // Populate form with user data
      reset({
        full_name: user.name || '',
        email_address: user.email || '',
        phone: user.phone || '',
        linkedin_profile: user.linkedin || '',
        github_profile: user.github || '',
        resume_headline: user.resumeHeadline || '',
        current_location: user.currentLocation || '',
        education_details: user.educationDetails || [],
        experience_details: user.experienceDetails || [],
        projects_details: user.projectsDetails || [],
        skills_details: user.skillsDetails || [],
        certifications_details: user.certificationsDetails || [],
      });
      fetchWalletBalance();
    }
  }, [user, isOpen, reset, walletRefreshKey]);

  const fetchWalletBalance = useCallback(async () => {
    if (!user) return;
    setLoadingWallet(true);
    try {
      const { data: transactions, error } = await supabase
        .from('wallet_transactions')
        .select('amount, status')
        .eq('user_id', user.id);
      if (error) {
        console.error('Error fetching wallet data:', error);
        return;
      }
      const completed = (transactions || []).filter((t: any) => t.status === 'completed');
      const balance = completed.reduce((sum: number, tr: any) => sum + parseFloat(tr.amount), 0);
      setWalletBalance(Math.max(0, balance));
    } catch (err) {
      console.error('Error fetching wallet data:', err);
    } finally {
      setLoadingWallet(false);
    }
  }, [user]);

  const handleRedeem = async () => {
    if (!user) return;
    setRedeemError(null);
    setRedeemSuccess(false);
    setIsSubmitting(true);

    const amount = parseFloat(redeemAmount);
    if (isNaN(amount) || amount <= 0) {
      setRedeemError('Please enter a valid amount.');
      setIsSubmitting(false);
      return;
    }
    if (amount > walletBalance) {
      setRedeemError('Insufficient wallet balance.');
      setIsSubmitting(false);
      return;
    }
    if (amount < 100) {
      setRedeemError('Minimum redemption amount is ₹100.');
      setIsSubmitting(false);
      return;
    }

    if (redeemMethod === 'upi' && !redeemDetails.upiId) {
      setRedeemError('UPI ID is required.');
      setIsSubmitting(false);
      return;
    }
    if (redeemMethod === 'bank_transfer' && (!redeemDetails.bankAccount || !redeemDetails.ifscCode || !redeemDetails.accountHolderName)) {
      setRedeemError('Bank account, IFSC code, and account holder name are required.');
      setIsSubmitting(false);
      return;
    }

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error('Authentication required for redemption.');
      }

      const response = await fetch(import.meta.env.VITE_SUPABASE_URL + '/functions/v1/send-redemption-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.access_token, // Changed to string concatenation
        },
        body: JSON.stringify({
          userId: user.id,
          amount: amount,
          redeemMethod: redeemMethod,
          redeemDetails: redeemDetails,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Redemption failed.');
      }

      setRedeemSuccess(true);
      setRedeemAmount('');
      setRedeemDetails({});
      setWalletRefreshKey(prev => prev + 1); // Trigger wallet refresh
      setAlertContent({ title: 'Redemption Request Sent!', message: 'Your request has been submitted and will be processed shortly.', type: 'success' });
      setShowAlert(true);
    } catch (err: any) {
      setRedeemError(err.message || 'Failed to submit redemption request.');
      setAlertContent({ title: 'Redemption Failed', message: err.message || 'Failed to submit redemption request.', type: 'error' });
      setShowAlert(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    console.log('Submitting profile data:', data); // Debug log

    try {
      await authService.updateUserProfile(user.id, {
        full_name: data.full_name,
        email_address: data.email_address,
        phone: data.phone,
        linkedin_profile: data.linkedin_profile,
        github_profile: data.github_profile,
        resume_headline: data.resume_headline,
        current_location: data.current_location,
        education_details: data.education_details,
        experience_details: data.experience_details,
        projects_details: data.projects_details,
        skills_details: data.skills_details,
        certifications_details: data.certifications_details,
      });
      await revalidateUserSession(); // Refresh user context
      await markProfilePromptSeen(); // Mark prompt as seen after saving profile
      setSubmitSuccess(true);
      setAlertContent({ title: 'Profile Updated!', message: 'Your profile has been saved successfully.', type: 'success' });
      setShowAlert(true);
      // Automatically close modal after successful update if it was opened from post-signup prompt
      if (user.hasSeenProfilePrompt === false) {
        onClose();
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to update profile');
      setAlertContent({ title: 'Update Failed', message: err.message || 'Failed to update profile.', type: 'error' });
      setShowAlert(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResumeFileUpload = async (result: ExtractionResult) => {
    if (!result.text.trim()) {
      setAlertContent({ title: 'Upload Failed', message: result.extraction_mode === 'OCR' ? 'Failed to extract text from image-based PDF. Please upload a searchable PDF or a DOCX/TXT file.' : 'Could not extract text from the file. Please try another file or enter manually.', type: 'error' });
      setShowAlert(true);
      return;
    }

    // Show loader while we parse and fill the form
    setIsParsingResume(true);
    try {
      console.log('Extracted text for parsing:', result.text);
      const resumeData: ResumeData = await mockPaymentService.parseResumeWithAI(result.text);
      console.log('Parsed Resume Data from mockPaymentService:', resumeData); // Diagnostic Log 1

      // Helper: normalize arrays to strings and dedupe
      const toStringArray = (arr?: any[]): string[] => {
        if (!Array.isArray(arr)) return [];
        const out: string[] = arr
          .map((v) => {
            if (typeof v === 'string') return v.trim();
            if (v && typeof v === 'object') {
              const text = (v.description || v.title || v.text || '').toString();
              return text.trim();
            }
            return String(v || '').trim();
          })
          .filter(Boolean);
        // Dedupe while preserving order
        const seen = new Set<string>();
        return out.filter((s) => (seen.has(s) ? false : (seen.add(s), true)));
      };

      const normEducation = Array.isArray(resumeData.education)
        ? resumeData.education.map((e: any) => ({
            degree: (e?.degree || '').toString(),
            school: (e?.school || '').toString(),
            year: (e?.year || '').toString(),
            cgpa: e?.cgpa ? e.cgpa.toString() : '',
            location: e?.location ? e.location.toString() : '',
          }))
        : [];

      const normExperience = Array.isArray(resumeData.workExperience)
        ? resumeData.workExperience.map((w: any) => ({
            role: (w?.role || '').toString(),
            company: (w?.company || '').toString(),
            year: (w?.year || '').toString(),
            bullets: toStringArray(w?.bullets).length ? toStringArray(w?.bullets) : [''],
          }))
        : [];

      const normProjects = Array.isArray(resumeData.projects)
        ? resumeData.projects.map((p: any) => ({
            title: (p?.title || '').toString(),
            bullets: toStringArray(p?.bullets).length ? toStringArray(p?.bullets) : [''],
          }))
        : [];

      const normSkills = Array.isArray(resumeData.skills)
        ? resumeData.skills.map((s: any) => ({
            category: (s?.category || '').toString(),
            list: toStringArray(s?.list),
          }))
        : [];

      const normCertsArray: any[] = Array.isArray(resumeData.certifications)
        ? (resumeData.certifications as any[])
        : [];
      const normCerts = normCertsArray.map((cert: any) =>
        typeof cert === 'string'
          ? { title: cert, description: '' }
          : { title: (cert?.title || '').toString(), description: cert?.description ? cert.description.toString() : '' }
      );

      // Prepare data for reset
      const newFormData: ProfileFormData = {
        full_name: resumeData.name || '',
        email_address: resumeData.email || '',
        phone: resumeData.phone || '',
        linkedin_profile: resumeData.linkedin || '',
        github_profile: resumeData.github || '',
        resume_headline: resumeData.summary || resumeData.careerObjective || '',
        current_location: resumeData.location || '',
        education_details: normEducation,
        experience_details: normExperience,
        projects_details: normProjects,
        skills_details: normSkills,
        certifications_details: normCerts,
      };

      console.log('New form data prepared for reset:', newFormData); // Diagnostic Log 2

      // Reset the entire form with the new data, ensuring old values are replaced
      reset(newFormData, { keepDefaultValues: false, keepValues: false, keepDirty: false });
      console.log('Form data AFTER reset:', getValues()); // Diagnostic Log after reset

      setAlertContent({ title: 'Resume Parsed!', message: 'Your resume data has been pre-filled into the form.', type: 'success' });
      setShowAlert(true);
    } catch (error: any) {
      console.error('Error parsing resume with AI:', error);
      setAlertContent({ title: 'Parsing Failed', message: error.message || 'Failed to parse resume with AI. Please try again or fill manually.', type: 'error' });
      setShowAlert(true);
    } finally {
      // Hide loader once done
      setIsParsingResume(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col dark:bg-dark-100 dark:shadow-dark-xl">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 px-3 sm:px-6 py-4 sm:py-8 border-b border-gray-100 flex-shrink-0 dark:from-dark-200 dark:to-dark-300 dark:border-dark-400">
          <button
            onClick={onClose}
            className="absolute top-2 sm:top-4 right-2 sm:right-4 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-white/50 z-10 min-w-[44px] min-h-[44px] dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-dark-300/50"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          <div className="text-center max-w-4xl mx-auto px-8">
            <div className="bg-gradient-to-br from-neon-cyan-500 to-neon-blue-500 w-12 h-12 sm:w-20 sm:h-20 rounded-xl sm:rounded-3xl flex items-center justify-center mx-auto mb-3 sm:mb-6 shadow-lg dark:shadow-neon-cyan">
              <UserIcon className="w-6 h-6 sm:w-10 h-10 text-white" />
            </div>
            <h1 className="text-lg sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2 sm:mb-3">
              Manage Your Profile
            </h1>
            <p className="text-sm sm:text-lg lg:text-xl text-gray-600 dark:text-gray-300 mb-3 sm:mb-6">
              Keep your information up-to-date for seamless resume optimization and auto-apply.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 flex-shrink-0 dark:border-dark-300">
          <nav className="flex space-x-4 sm:space-x-8 px-3 sm:px-6 lg:px-8">
            {[
              { id: 'profile', label: 'My Profile', icon: <UserIcon className="w-4 h-4 sm:w-5 h-5" /> },
              { id: 'wallet', label: 'Wallet & Referrals', icon: <Wallet className="w-4 h-4 sm:w-5 h-5" /> },
              { id: 'security', label: 'Security', icon: <Sparkles className="w-4 h-4 sm:w-5 h-5" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'profile' | 'wallet' | 'security')}
                className={'py-3 sm:py-4 px-2 sm:px-0 border-b-2 flex items-center space-x-2 font-medium text-sm sm:text-base transition-colors ' +
                  (activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:border-neon-cyan-400 dark:text-neon-cyan-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-dark-200')
                }
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="p-3 sm:p-6 lg:p-8 overflow-y-auto flex-1 relative">
          {isParsingResume && (
            <div className="absolute inset-0 z-20 bg-white/70 dark:bg-dark-100/70 backdrop-blur-sm flex items-center justify-center">
              <div className="flex items-center space-x-3 px-4 py-3 rounded-xl border border-gray-200 shadow-lg bg-white dark:bg-dark-200 dark:border-dark-300">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-neon-cyan-400" />
                <span className="text-gray-700 dark:text-gray-200 font-medium">Parsing your resume… Please wait</span>
              </div>
            </div>
          )}
          {activeTab === 'profile' && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {submitError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl dark:bg-red-900/20 dark:border-red-500/50">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 mt-0.5" />
                    <p className="text-red-700 dark:text-red-300 text-sm font-medium">{submitError}</p>
                  </div>
                </div>
              )}

              {submitSuccess && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl dark:bg-neon-cyan-500/10 dark:border-neon-cyan-400/50">
                  <div className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-neon-cyan-400 mr-3 mt-0.5" />
                    <p className="text-green-700 dark:text-neon-cyan-300 text-sm font-medium">Profile updated successfully!</p>
                  </div>
                </div>
              )}

              {/* Resume Upload Section */}
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200 dark:bg-dark-100 dark:border-dark-300">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <Sparkles className="w-5 h-5 mr-2 text-purple-600 dark:text-neon-purple-400" />
                  Upload Resume to Pre-fill
                </h2>
                <FileUpload onFileUpload={handleResumeFileUpload} />
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                  Upload your resume (PDF, DOCX, TXT) to automatically populate your profile details.
                </p>
              </div>

              {/* Personal Information */}
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200 dark:bg-dark-100 dark:border-dark-300">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <UserIcon className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                  Personal Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Full Name</label>
                    <input type="text" {...register('full_name')} className="input-base" />
                    {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
                    <input type="email" {...register('email_address')} className="input-base" disabled />
                    {errors.email_address && <p className="text-red-500 text-xs mt-1">{errors.email_address.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone</label>
                    <input type="tel" {...register('phone')} className="input-base" />
                    {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Location</label>
                    <input type="text" {...register('current_location')} className="input-base" />
                    {errors.current_location && <p className="text-red-500 text-xs mt-1">{errors.current_location.message}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Resume Headline / Summary</label>
                    <textarea {...register('resume_headline')} className="input-base h-24 resize-y" />
                    {errors.resume_headline && <p className="text-red-500 text-xs mt-1">{errors.resume_headline.message}</p>}
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200 dark:bg-dark-100 dark:border-dark-300">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <Linkedin className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                  Social Links
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">LinkedIn Profile URL</label>
                    <input type="url" {...register('linkedin_profile')} className="input-base" />
                    {errors.linkedin_profile && <p className="text-red-500 text-xs mt-1">{errors.linkedin_profile.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">GitHub Profile URL</label>
                    <input type="url" {...register('github_profile')} className="input-base" />
                    {errors.github_profile && <p className="text-red-500 text-xs mt-1">{errors.github_profile.message}</p>}
                  </div>
                </div>
              </div>

              {/* Education Details */}
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200 dark:bg-dark-100 dark:border-dark-300">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <GraduationCap className="w-5 h-5 mr-2 text-green-600 dark:text-neon-green-400" />
                  Education
                </h2>
                {educationFields.map((field, index) => (
                  <div key={field.id} className="space-y-3 border-t border-gray-200 pt-4 mt-4 first:border-t-0 first:pt-0 first:mt-0 dark:border-dark-300">
                    <div className="flex justify-end">
                      <button type="button" onClick={() => removeEducation(index)} className="text-red-500 hover:text-red-700 text-sm flex items-center">
                        <Trash2 className="w-4 h-4 mr-1" /> Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Degree</label>
                        <input type="text" {...register(`education_details.${index}.degree`)} className="input-base" />
                        {errors.education_details?.[index]?.degree && <p className="text-red-500 text-xs mt-1">{errors.education_details[index]?.degree?.message}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">School</label>
                        <input type="text" {...register(`education_details.${index}.school`)} className="input-base" />
                        {errors.education_details?.[index]?.school && <p className="text-red-500 text-xs mt-1">{errors.education_details[index]?.school?.message}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Year</label>
                        <input type="text" {...register(`education_details.${index}.year`)} className="input-base" />
                        {errors.education_details?.[index]?.year && <p className="text-red-500 text-xs mt-1">{errors.education_details[index]?.year?.message}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">CGPA (Optional)</label>
                        <input type="text" {...register(`education_details.${index}.cgpa`)} className="input-base" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Location (Optional)</label>
                        <input type="text" {...register(`education_details.${index}.location`)} className="input-base" />
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => appendEducation({ degree: '', school: '', year: '', cgpa: '', location: '' })} className="btn-secondary mt-4 flex items-center space-x-2">
                  <Plus className="w-4 h-4" /> <span>Add Education</span>
                </button>
              </div>

              {/* Experience Details */}
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200 dark:bg-dark-100 dark:border-dark-300">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <Briefcase className="w-5 h-5 mr-2 text-purple-600 dark:text-neon-purple-400" />
                  Work Experience
                </h2>
                {experienceFields.map((field, index) => (
                  <div key={field.id} className="space-y-3 border-t border-gray-200 pt-4 mt-4 first:border-t-0 first:pt-0 first:mt-0 dark:border-dark-300">
                    <div className="flex justify-end">
                      <button type="button" onClick={() => removeExperience(index)} className="text-red-500 hover:text-red-700 text-sm flex items-center">
                        <Trash2 className="w-4 h-4 mr-1" /> Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role</label>
                        <input type="text" {...register(`experience_details.${index}.role`)} className="input-base" />
                        {errors.experience_details?.[index]?.role && <p className="text-red-500 text-xs mt-1">{errors.experience_details[index]?.role?.message}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company</label>
                        <input type="text" {...register(`experience_details.${index}.company`)} className="input-base" />
                        {errors.experience_details?.[index]?.company && <p className="text-red-500 text-xs mt-1">{errors.experience_details[index]?.company?.message}</p>}
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Year / Duration</label>
                        <input type="text" {...register(`experience_details.${index}.year`)} className="input-base" />
                        {errors.experience_details?.[index]?.year && <p className="text-red-500 text-xs mt-1">{errors.experience_details[index]?.year?.message}</p>}
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Responsibilities / Achievements (Bullet Points)</label>
                        {experienceFields[index].bullets.map((bullet, bulletIndex) => (
                          <div key={bulletIndex} className="flex items-center space-x-2 mb-2">
                            <input
                              type="text"
                              {...register(`experience_details.${index}.bullets.${bulletIndex}`)}
                              className="input-base flex-1"
                            />
                            <button type="button" onClick={() => {
                              const newBullets = [...experienceFields[index].bullets];
                              newBullets.splice(bulletIndex, 1);
                              updateExperience(index, { ...experienceFields[index], bullets: newBullets });
                            }} className="text-red-500 hover:text-red-700">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button type="button" onClick={() => {
                          const newBullets = [...experienceFields[index].bullets, ''];
                          updateExperience(index, { ...experienceFields[index], bullets: newBullets });
                        }} className="btn-secondary btn-sm mt-2 flex items-center space-x-1">
                          <Plus className="w-3 h-3" /> <span>Add Bullet</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => appendExperience({ role: '', company: '', year: '', bullets: [''] })} className="btn-secondary mt-4 flex items-center space-x-2">
                  <Plus className="w-4 h-4" /> <span>Add Experience</span>
                </button>
              </div>

              {/* Project Details */}
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200 dark:bg-dark-100 dark:border-dark-300">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <Code className="w-5 h-5 mr-2 text-orange-600 dark:text-orange-400" />
                  Projects
                </h2>
                {projectFields.map((field, index) => (
                  <div key={field.id} className="space-y-3 border-t border-gray-200 pt-4 mt-4 first:border-t-0 first:pt-0 first:mt-0 dark:border-dark-300">
                    <div className="flex justify-end">
                      <button type="button" onClick={() => removeProject(index)} className="text-red-500 hover:text-red-700 text-sm flex items-center">
                        <Trash2 className="w-4 h-4 mr-1" /> Remove
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Project Title</label>
                      <input type="text" {...register(`projects_details.${index}.title`)} className="input-base" />
                      {errors.projects_details?.[index]?.title && <p className="text-red-500 text-xs mt-1">{errors.projects_details[index]?.title?.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description (Bullet Points)</label>
                      {projectFields[index].bullets.map((bullet, bulletIndex) => (
                        <div key={bulletIndex} className="flex items-center space-x-2 mb-2">
                          <input
                            type="text"
                            {...register(`projects_details.${index}.bullets.${bulletIndex}`)}
                            className="input-base flex-1"
                          />
                          <button type="button" onClick={() => {
                            const newBullets = [...projectFields[index].bullets];
                            newBullets.splice(bulletIndex, 1);
                            updateProject(index, { ...projectFields[index], bullets: newBullets });
                          }} className="text-red-500 hover:text-red-700">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => {
                        const newBullets = [...projectFields[index].bullets, ''];
                        updateProject(index, { ...projectFields[index], bullets: newBullets });
                      }} className="btn-secondary btn-sm mt-2 flex items-center space-x-1">
                        <Plus className="w-3 h-3" /> <span>Add Bullet</span>
                      </button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => appendProject({ title: '', bullets: [''] })} className="btn-secondary mt-4 flex items-center space-x-2">
                  <Plus className="w-4 h-4" /> <span>Add Project</span>
                </button>
              </div>

              {/* Skills Details */}
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200 dark:bg-dark-100 dark:border-dark-300">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <Target className="w-5 h-5 mr-2 text-red-600 dark:text-red-400" />
                  Skills
                </h2>
                {skillFields.map((field, index) => (
                  <div key={field.id} className="space-y-3 border-t border-gray-200 pt-4 mt-4 first:border-t-0 first:pt-0 first:mt-0 dark:border-dark-300">
                    <div className="flex justify-end">
                      <button type="button" onClick={() => removeSkill(index)} className="text-red-500 hover:text-red-700 text-sm flex items-center">
                        <Trash2 className="w-4 h-4 mr-1" /> Remove
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
                      <input type="text" {...register(`skills_details.${index}.category`)} className="input-base" />
                      {errors.skills_details?.[index]?.category && <p className="text-red-500 text-xs mt-1">{errors.skills_details[index]?.category?.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Skills (comma-separated)</label>
                      {skillFields[index].list.map((skill, skillIndex) => (
                        <div key={skillIndex} className="flex items-center space-x-2 mb-2">
                          <input
                            type="text"
                            {...register(`skills_details.${index}.list.${skillIndex}`)}
                            className="input-base flex-1"
                          />
                          <button type="button" onClick={() => {
                            const newList = [...skillFields[index].list];
                            newList.splice(skillIndex, 1);
                            updateSkill(index, { ...skillFields[index], list: newList });
                          }} className="text-red-500 hover:text-red-700">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => {
                        const newList = [...skillFields[index].list, ''];
                        updateSkill(index, { ...skillFields[index], list: newList });
                      }} className="btn-secondary btn-sm mt-2 flex items-center space-x-1">
                        <Plus className="w-3 h-3" /> <span>Add Skill</span>
                      </button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => appendSkill({ category: '', list: [] })} className="btn-secondary mt-4 flex items-center space-x-2">
                  <Plus className="w-4 h-4" /> <span>Add Skill Category</span>
                </button>
              </div>

              {/* Certifications Details */}
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200 dark:bg-dark-100 dark:border-dark-300">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <Award className="w-5 h-5 mr-2 text-yellow-600 dark:text-yellow-400" />
                  Certifications
                </h2>
                {certificationFields.map((field, index) => (
                  <div key={field.id} className="space-y-3 border-t border-gray-200 pt-4 mt-4 first:border-t-0 first:pt-0 first:mt-0 dark:border-dark-300">
                    <div className="flex justify-end">
                      <button type="button" onClick={() => removeCertification(index)} className="text-red-500 hover:text-red-700 text-sm flex items-center">
                        <Trash2 className="w-4 h-4 mr-1" /> Remove
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Certification Title</label>
                      <input type="text" {...register(`certifications_details.${index}.title`)} className="input-base" />
                      {errors.certifications_details?.[index]?.title && <p className="text-red-500 text-xs mt-1">{errors.certifications_details[index]?.title?.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description (Optional)</label>
                      <input type="text" {...register(`certifications_details.${index}.description`)} className="input-base" />
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => appendCertification({ title: '', description: '' })} className="btn-secondary mt-4 flex items-center space-x-2">
                  <Plus className="w-4 h-4" /> <span>Add Certification</span>
                </button>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-6 border-t border-gray-200 dark:border-dark-300">
                <button disabled={isSubmitting || isParsingResume} className="btn-primary flex items-center space-x-2">
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isParsingResume ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  <span>{isSubmitting ? 'Saving...' : isParsingResume ? 'Please wait…' : 'Save Profile'}</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'wallet' && (
            <div className="space-y-6">
              {/* Referral Code Section */}
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200 dark:bg-dark-100 dark:border-dark-300">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Referral Code</h2>
                {user?.referralCode ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-dark-200 rounded-lg p-3">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">Your Code</p>
                        <p className="font-mono text-xl font-bold text-gray-900 dark:text-gray-100">{user.referralCode}</p>
                      </div>
                      <button
                        onClick={() => navigator.clipboard?.writeText(user.referralCode || '')}
                        className="px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-dark-300 dark:hover:bg-dark-200 dark:text-gray-200 flex items-center gap-2"
                        title="Copy code"
                      >
                        <CopyIcon className="w-4 h-4" /> Copy
                      </button>
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-dark-200 rounded-lg p-3">
                      <div className="truncate mr-3">
                        <p className="text-sm text-gray-600 dark:text-gray-300">Share Link</p>
                        <p className="text-sm font-medium text-blue-600 dark:text-neon-cyan-400 truncate">
                          {`${window.location.origin}/?ref=${user.referralCode}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/?ref=${user?.referralCode}`)}
                          className="px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-dark-300 dark:hover:bg-dark-200 dark:text-gray-200"
                          title="Copy link"
                        >
                          <CopyIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async () => {
                            const url = `${window.location.origin}/?ref=${user?.referralCode}`;
                            try {
                              if ((navigator as any).share) {
                                await (navigator as any).share({ title: 'Join PrimoBoost AI', text: 'Use my referral link to sign up!', url });
                              } else {
                                await navigator.clipboard?.writeText(url);
                                alert('Referral link copied to clipboard');
                              }
                            } catch {}
                          }}
                          className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                          title="Share link"
                        >
                          <Share2 className="w-4 h-4" /> Share
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-300">You don’t have a referral code yet.</p>
                    {referralError && (
                      <p className="text-sm text-red-600 dark:text-red-400">{referralError}</p>
                    )}
                    <button
                      disabled={isGeneratingReferral}
                      onClick={async () => {
                        if (!user) return;
                        setReferralError(null);
                        setIsGeneratingReferral(true);
                        try {
                          const base = (user.username || user.email.split('@')[0] || 'PRIMO').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                          const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
                          const code = `${base}${rand}`;
                          const { error } = await supabase.from('user_profiles').update({ referral_code: code }).eq('id', user.id);
                          if (error) throw error;
                          await revalidateUserSession();
                        } catch (e: any) {
                          setReferralError('Failed to generate referral code. Please try again later.');
                        } finally {
                          setIsGeneratingReferral(false);
                        }
                      }}
                      className="btn-primary inline-flex items-center gap-2"
                    >
                      {isGeneratingReferral ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      <span>{isGeneratingReferral ? 'Generating...' : 'Generate Referral Code'}</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200 dark:bg-dark-100 dark:border-dark-300">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <Wallet className="w-5 h-5 mr-2 text-green-600 dark:text-neon-green-400" />
                  My Wallet Balance
                </h2>
                {loadingWallet ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                    <span className="text-gray-600 dark:text-gray-300">Loading wallet...</span>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-gray-600 dark:text-gray-300 text-lg">Current Balance</p>
                    <p className="text-5xl font-bold text-green-600 dark:text-neon-green-400">₹{walletBalance.toFixed(2)}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Earned through referrals and bonuses</p>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-200 dark:bg-dark-100 dark:border-dark-300">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <ArrowRight className="w-5 h-5 mr-2 text-blue-600 dark:text-neon-cyan-400" />
                  Redeem Balance
                </h2>
                {redeemError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-4 dark:bg-red-900/20 dark:border-red-500/50">
                    <div className="flex items-start">
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 mt-0.5" />
                      <p className="text-red-700 dark:text-red-300 text-sm font-medium">{redeemError}</p>
                    </div>
                  </div>
                )}
                {redeemSuccess && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl mb-4 dark:bg-neon-cyan-500/10 dark:border-neon-cyan-400/50">
                    <div className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-neon-cyan-400 mr-3 mt-0.5" />
                      <p className="text-green-700 dark:text-neon-cyan-300 text-sm font-medium">Redemption request submitted successfully!</p>
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Amount to Redeem (₹)</label>
                    <input
                      type="number"
                      value={redeemAmount}
                      onChange={(e) => setRedeemAmount(e.target.value)}
                      className="input-base"
                      min="100"
                      step="1"
                      placeholder="Minimum ₹100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Redemption Method</label>
                    <select value={redeemMethod} onChange={(e) => setRedeemMethod(e.target.value as 'upi' | 'bank_transfer')} className="input-base">
                      <option value="upi">UPI</option>
                      <option value="bank_transfer">Bank Transfer</option>
                    </select>
                  </div>
                  {redeemMethod === 'upi' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">UPI ID</label>
                      <input
                        type="text"
                        value={redeemDetails.upiId || ''}
                        onChange={(e) => setRedeemDetails(prev => ({ ...prev, upiId: e.target.value }))}
                        className="input-base"
                        placeholder="e.g., yourname@bank"
                      />
                    </div>
                  )}
                  {redeemMethod === 'bank_transfer' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bank Account Number</label>
                        <input
                          type="text"
                          value={redeemDetails.bankAccount || ''}
                          onChange={(e) => setRedeemDetails(prev => ({ ...prev, bankAccount: e.target.value }))}
                          className="input-base"
                          placeholder="e.g., 1234567890"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">IFSC Code</label>
                        <input
                          type="text"
                          value={redeemDetails.ifscCode || ''}
                          onChange={(e) => setRedeemDetails(prev => ({ ...prev, ifscCode: e.target.value }))}
                          className="input-base"
                          placeholder="e.g., HDFC0000123"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Account Holder Name</label>
                        <input
                          type="text"
                          value={redeemDetails.accountHolderName || ''}
                          onChange={(e) => setRedeemDetails(prev => ({ ...prev, accountHolderName: e.target.value }))}
                          className="input-base"
                          placeholder="e.g., John Doe"
                        />
                      </div>
                    </div>
                  )}
                  <button onClick={handleRedeem} disabled={isSubmitting || loadingWallet} className="btn-primary w-full flex items-center justify-center space-x-2">
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wallet className="w-5 h-5" />}
                    <span>{isSubmitting ? 'Processing...' : 'Redeem Now'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <DeviceManagement />
          )}
        </div>
      </div>
      <AlertModal
        isOpen={showAlert}
        onClose={() => setShowAlert(false)}
        title={alertContent.title}
        message={alertContent.message}
        type={alertContent.type}
      />
    </div>
  );
};
