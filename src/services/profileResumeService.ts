// src/services/profileResumeService.ts
import { supabase } from '../lib/supabaseClient';
import { ResumeData, Education, WorkExperience, Project, Skill, Certification, UserType } from '../types/resume';

interface UserProfileDb {
  id: string;
  full_name: string;
  email_address: string;
  phone?: string;
  linkedin_profile_url?: string;
  github_profile_url?: string;
  current_location?: string;
  resume_headline?: string; // Can be summary or career objective
  education_details?: Education[]; // JSONB field
  experience_details?: WorkExperience[]; // JSONB field
  skills_details?: Skill[]; // JSONB field
  // Future fields if you add them to user_profiles
  certifications_details?: (string | Certification)[]; // Example: if you add this column
  projects_details?: Project[]; // Example: if you add this column
  achievements_details?: string[]; // Example: if you add this column
}

interface InternshipRecordDb {
  company_name: string;
  position: string;
  start_date: string;
  end_date?: string;
  description?: string; // This would need to be parsed into bullets
  is_current?: boolean;
}

class ProfileResumeService {
  async buildResumeDataFromProfile(userId: string, userType: UserType): Promise<ResumeData> {
    if (!userId) {
      throw new Error('User ID is required to build resume data from profile.');
    }

    console.log('ProfileResumeService: Building ResumeData from profile for user:', userId);

    // 1. Fetch user profile data
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select(`
        id,
        full_name,
        email_address,
        phone,
        linkedin_profile_url,
        github_profile_url,
        current_location,
        resume_headline,
        education_details,
        experience_details,
        skills_details
      `)
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      throw new Error('Failed to fetch user profile data.');
    }

    if (!profileData) {
      throw new Error('User profile not found.');
    }

    console.log('ProfileResumeService: User profile fetched successfully');

    // 2. Fetch internship records (if applicable)
    const { data: internshipRecords, error: internshipError } = await supabase
      .from('internship_records')
      .select('*')
      .eq('client_id', userId)
      .order('start_date', { ascending: false });

    if (internshipError) {
      console.warn('Error fetching internship records:', internshipError);
      // Continue without internships if there's an error
    }

    console.log('ProfileResumeService: Internship records fetched:', internshipRecords?.length || 0);

    // 3. Map internship records to WorkExperience format
    const mappedInternships: WorkExperience[] = (internshipRecords || []).map(record => ({
      role: record.position,
      company: record.company_name,
      year: `${new Date(record.start_date).getFullYear()} - ${record.end_date ? new Date(record.end_date).getFullYear() : 'Present'}`,
      bullets: record.description ? record.description.split('\n').map(s => s.trim()).filter(Boolean) : [
        `Contributed to ${record.company_name} as ${record.position}`,
        'Gained hands-on experience in professional environment',
        'Developed technical and soft skills relevant to the industry'
      ],
    }));

    // 4. Combine experience details from profile and internships
    const allWorkExperience: WorkExperience[] = [
      ...(profileData.experience_details || []),
      ...mappedInternships
    ];

    // 5. Fetch client resumes for projects (if any stored)
    const { data: clientResumes, error: resumeError } = await supabase
      .from('client_resumes')
      .select('*')
      .eq('client_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (resumeError) {
      console.warn('Error fetching client resumes:', resumeError);
    }

    // 6. Create default projects if none exist (for demonstration)
    const defaultProjects: Project[] = profileData.skills_details && profileData.skills_details.length > 0 ? [
      {
        title: 'Portfolio Website',
        bullets: [
          `Developed responsive portfolio website using ${profileData.skills_details[0]?.list?.[0] || 'modern web technologies'}`,
          'Implemented responsive design and optimized for mobile devices',
          'Integrated contact forms and deployed on cloud platform'
        ]
      }
    ] : [];

    // 7. Create default certifications from course materials
    const { data: courseMaterials, error: courseError } = await supabase
      .from('course_materials')
      .select('title, description')
      .eq('assigned_to', userId)
      .eq('is_completed', true);

    if (courseError) {
      console.warn('Error fetching course materials:', courseError);
    }

    const mappedCertifications: (string | Certification)[] = (courseMaterials || []).map(course => ({
      title: course.title,
      description: course.description || ''
    }));

    // 8. Construct ResumeData object
    const resumeData: ResumeData = {
      name: profileData.full_name || '',
      phone: profileData.phone || '',
      email: profileData.email_address || '',
      linkedin: profileData.linkedin_profile_url || '',
      github: profileData.github_profile_url || '',
      location: profileData.current_location || undefined,
      education: profileData.education_details || [],
      workExperience: allWorkExperience,
      skills: profileData.skills_details || [],
      projects: defaultProjects, // Use default projects for now
      certifications: mappedCertifications,
      achievements: [], // Empty for now, can be enhanced later
      origin: 'profile_generated', // Indicate origin
    };

    // Handle summary vs careerObjective based on userType
    if (profileData.resume_headline) {
      if (userType === 'experienced') {
        resumeData.summary = profileData.resume_headline;
      } else { // 'fresher' or 'student'
        resumeData.careerObjective = profileData.resume_headline;
      }
    }

    console.log('ProfileResumeService: ResumeData constructed successfully');
    return resumeData;
  }

  // Helper method to check if user has resume data
  async hasUserResume(userId: string): Promise<boolean> {
    const { data: profileData, error } = await supabase
      .from('user_profiles')
      .select('id, education_details, skills_details')
      .eq('id', userId)
      .maybeSingle();

    if (error || !profileData) {
      return false;
    }

    // User has resume if they have at least education and skills
    return !!(
      profileData.education_details &&
      Array.isArray(profileData.education_details) &&
      profileData.education_details.length > 0 &&
      profileData.skills_details &&
      Array.isArray(profileData.skills_details) &&
      profileData.skills_details.length > 0
    );
  }

  // Helper method to validate if profile is complete for auto-apply
  async isProfileCompleteForAutoApply(userId: string): Promise<{ isComplete: boolean; missingFields: string[] }> {
    const { data: profileData, error } = await supabase
      .from('user_profiles')
      .select(`
        full_name,
        email_address,
        phone,
        linkedin_profile_url,
        github_profile_url,
        education_details,
        experience_details,
        skills_details
      `)
      .eq('id', userId)
      .maybeSingle();

    if (error || !profileData) {
      return { isComplete: false, missingFields: ['profile'] };
    }

    const missingFields: string[] = [];

    if (!profileData.full_name?.trim()) missingFields.push('full name');
    if (!profileData.email_address?.trim()) missingFields.push('email');
    if (!profileData.phone?.trim()) missingFields.push('phone');
    if (!profileData.education_details || profileData.education_details.length === 0) missingFields.push('education');
    if (!profileData.skills_details || profileData.skills_details.length === 0) missingFields.push('skills');

    return {
      isComplete: missingFields.length === 0,
      missingFields
    };
  }
}

export const profileResumeService = new ProfileResumeService();