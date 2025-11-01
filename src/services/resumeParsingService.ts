import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface ParsedResume {
  text: string;
  skills: string[];
  wordCount: number;
  hasError: boolean;
  errorMessage?: string;
}

class ResumeParsingService {
  private commonSkills = [
    'React', 'Angular', 'Vue', 'JavaScript', 'TypeScript', 'Node.js', 'Python',
    'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Rust', 'Swift', 'Kotlin',
    'HTML', 'CSS', 'Sass', 'Tailwind', 'Bootstrap', 'SQL', 'MongoDB', 'PostgreSQL',
    'MySQL', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP',
    'Git', 'CI/CD', 'Jenkins', 'GraphQL', 'REST API', 'Machine Learning',
    'Deep Learning', 'TensorFlow', 'PyTorch', 'Data Science', 'AI',
    'Spring Boot', 'Django', 'Flask', 'Express', 'Next.js', 'Nest.js',
    'React Native', 'Flutter', 'Android', 'iOS', 'Figma', 'Adobe XD',
    'Photoshop', 'Illustrator', 'UI/UX', 'Agile', 'Scrum', 'Jira',
  ];

  /**
   * Parse resume file and extract text
   */
  async parseResume(file: File): Promise<ParsedResume> {
    try {
      const fileType = file.type;
      let text = '';

      if (fileType === 'application/pdf') {
        text = await this.parsePDF(file);
      } else if (
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileType === 'application/msword'
      ) {
        text = await this.parseDOCX(file);
      } else if (fileType === 'text/plain') {
        text = await this.parseText(file);
      } else {
        throw new Error('Unsupported file type. Please upload PDF, DOCX, or TXT file.');
      }

      if (!text || text.trim().length === 0) {
        throw new Error('Could not extract text from the file. Please try a different file.');
      }

      const skills = this.extractSkills(text);
      const wordCount = text.split(/\s+/).length;

      return {
        text,
        skills,
        wordCount,
        hasError: false,
      };
    } catch (error: any) {
      console.error('Error parsing resume:', error);
      return {
        text: '',
        skills: [],
        wordCount: 0,
        hasError: true,
        errorMessage: error.message || 'Failed to parse resume',
      };
    }
  }

  /**
   * Parse PDF file
   */
  private async parsePDF(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }

      return fullText.trim();
    } catch (error) {
      console.error('PDF parsing error:', error);
      throw new Error('Failed to parse PDF file');
    }
  }

  /**
   * Parse DOCX file
   */
  private async parseDOCX(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value.trim();
    } catch (error) {
      console.error('DOCX parsing error:', error);
      throw new Error('Failed to parse DOCX file');
    }
  }

  /**
   * Parse plain text file
   */
  private async parseText(file: File): Promise<string> {
    try {
      return await file.text();
    } catch (error) {
      console.error('Text parsing error:', error);
      throw new Error('Failed to parse text file');
    }
  }

  /**
   * Extract skills from resume text
   */
  private extractSkills(text: string): string[] {
    const lowerText = text.toLowerCase();
    const foundSkills = new Set<string>();

    this.commonSkills.forEach((skill) => {
      const lowerSkill = skill.toLowerCase();
      if (lowerText.includes(lowerSkill)) {
        foundSkills.add(skill);
      }
    });

    return Array.from(foundSkills);
  }

  /**
   * Validate file before parsing
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
    ];

    if (file.size > maxSize) {
      return {
        valid: false,
        error: 'File size must be less than 5MB',
      };
    }

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Only PDF, DOCX, and TXT files are supported',
      };
    }

    return { valid: true };
  }

  /**
   * Get file extension icon
   */
  getFileIcon(fileType: string): string {
    if (fileType === 'application/pdf') return '📄';
    if (fileType.includes('word')) return '📝';
    if (fileType === 'text/plain') return '📃';
    return '📎';
  }
}

export const resumeParsingService = new ResumeParsingService();
