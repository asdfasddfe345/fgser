// src/components/ResumePreview.tsx

import React, { useRef, useEffect, useState } from 'react';
import { ResumeData, UserType } from '../types/resume';
import { LiveResumePreviewControls } from './LiveResumePreviewControls';

// --- FIX: Define necessary types and defaults locally to resolve import error ---
interface ExportOptions {
  layoutType: 'standard' | 'compact';
  paperSize: 'a4' | 'letter';
  fontFamily: 'Helvetica' | 'Times' | 'Courier' | 'Roboto' | 'Calibri'; // Added Calibri
  nameSize: number;
  sectionHeaderSize: number;
  subHeaderSize: number;
  bodyTextSize: number;
  sectionSpacing: number;
  entrySpacing: number;
}

const defaultExportOptions: ExportOptions = {
  layoutType: 'standard',
  paperSize: 'a4',
  fontFamily: 'Calibri', // Changed default font
  nameSize: 22,
  sectionHeaderSize: 12,
  subHeaderSize: 10,
  bodyTextSize: 10,
  sectionSpacing: 4,
  entrySpacing: 2,
};
// --- END FIX ---


// ---------- Helper Functions (replicated from exportUtils.ts for consistency) ----------
const mmToPx = (mm: number) => mm * 3.779528; // 1mm = 3.779528px at 96 DPI
const ptToPx = (pt: number) => pt * 1.333; // 1pt = 1.333px at 96 DPI

// Replicate PDF_CONFIG creation logic from exportUtils.ts
const createPDFConfigForPreview = (options: ExportOptions) => {
  const layoutConfig = options.layoutType === 'compact' ?
    { margins: { top: 12, bottom: 12, left: 12, right: 12 } } : // Adjusted for compact
    { margins: { top: 17.78, bottom: 17.78, left: 17.78, right: 17.78 } }; // Adjusted for standard

  const paperConfig = options.paperSize === 'letter' ?
    { pageWidth: 216, pageHeight: 279 } :
    { pageWidth: 210, pageHeight: 297 }; // Changed from 300 to 297

  return {
    pageWidth: paperConfig.pageWidth,
    pageHeight: paperConfig.pageHeight,
    margins: layoutConfig.margins,
    get contentWidth() {
      return this.pageWidth - this.margins.left - this.margins.right;
    },
    get contentHeight() {
      return this.pageHeight - this.margins.top - this.margins.bottom;
    },
    fonts: {
      name: { size: options.nameSize, weight: 'bold' as const },
      contact: { size: options.bodyTextSize - 0.5, weight: 'normal' as const },
      sectionTitle: { size: options.sectionHeaderSize, weight: 'bold' as const },
      jobTitle: { size: options.subHeaderSize, weight: 'bold' as const },
      company: { size: options.subHeaderSize, weight: 'normal' as const }, // Changed to normal
      year: { size: options.subHeaderSize, weight: 'normal' as const }, // Changed to normal
      body: { size: options.bodyTextSize, weight: 'normal' as const },
    },
    spacing: {
      nameFromTop: 10, // Changed from 13 to 10
      afterName: 0,
      afterContact: 2, // Changed from 1 to 2
      sectionSpacingBefore: options.sectionSpacing,
      sectionSpacingAfter: 2,
      bulletListSpacing: 0.5, // Changed from options.entrySpacing * 0.3 to 0.5
      afterSubsection: 3,
      lineHeight: 1.2,
      bulletIndent: 5, // Changed from 4 to 5
      entrySpacing: options.entrySpacing,
    },
    colors: {
      primary: [0, 0, 0] as [number, number, number],
      secondary: [80, 80, 80] as [number, number, number],
      accent: [37, 99, 235] as [number, number, number],
    },
    fontFamily: options.fontFamily,
  };
};

interface ResumePreviewProps {
  resumeData: ResumeData;
  userType?: UserType;
  exportOptions?: ExportOptions;
  showControls?: boolean;
  onScaleChange?: (scale: number) => void;
  defaultZoom?: number;
}

export const ResumePreview: React.FC<ResumePreviewProps> = ({
  resumeData,
  userType = 'experienced',
  exportOptions,
  showControls = false,
  onScaleChange,
  defaultZoom = 0.98
}) => {
  // Use defaultExportOptions if exportOptions is not provided
  const currentExportOptions = exportOptions || defaultExportOptions;
  const PDF_CONFIG = createPDFConfigForPreview(currentExportOptions);

  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const resumeContentRef = useRef<HTMLDivElement>(null);
  const [scaleFactor, setScaleFactor] = useState(defaultZoom);
  const [autoScaleFactor, setAutoScaleFactor] = useState(defaultZoom);
  const [isScaling, setIsScaling] = useState(true);
  const [manualZoom, setManualZoom] = useState(false);

  useEffect(() => {
    const calculateScale = () => {
      if (contentWrapperRef.current && !manualZoom) {
        const containerWidth = contentWrapperRef.current.offsetWidth;
        const containerHeight = contentWrapperRef.current.offsetHeight;
        const resumeNaturalWidthPx = mmToPx(PDF_CONFIG.pageWidth);
        const resumeNaturalHeightPx = mmToPx(PDF_CONFIG.pageHeight);

        // Calculate available space with minimal padding
        const availableWidth = containerWidth - 40;
        const availableHeight = containerHeight - 40;

        // Calculate scale factors for both width and height
        const scaleX = availableWidth / resumeNaturalWidthPx;
        const scaleY = availableHeight / resumeNaturalHeightPx;

        // Use the smaller scale factor with defaultZoom multiplier for optimal fit
        const optimalScale = Math.min(scaleX, scaleY) * defaultZoom;

        // Allow scaling down but prevent scaling up beyond original size
        const finalScale = Math.min(optimalScale, 1);

        setAutoScaleFactor(finalScale);
        setScaleFactor(finalScale);
        setIsScaling(false);

        if (onScaleChange) {
          onScaleChange(finalScale);
        }
      }
    };

    setIsScaling(true);
    calculateScale();

    const timeoutId = setTimeout(calculateScale, 150);

    window.addEventListener('resize', calculateScale);
    return () => {
      window.removeEventListener('resize', calculateScale);
      clearTimeout(timeoutId);
    };
  }, [PDF_CONFIG.pageWidth, PDF_CONFIG.pageHeight, resumeData, manualZoom, onScaleChange]);

  // Zoom control handlers
  const handleZoomIn = () => {
    setManualZoom(true);
    const newScale = Math.min(scaleFactor + 0.1, 1.5);
    setScaleFactor(newScale);
    if (onScaleChange) {
      onScaleChange(newScale);
    }
  };

  const handleZoomOut = () => {
    setManualZoom(true);
    const newScale = Math.max(scaleFactor - 0.1, 0.3);
    setScaleFactor(newScale);
    if (onScaleChange) {
      onScaleChange(newScale);
    }
  };

  const handleResetZoom = () => {
    setManualZoom(false);
    setScaleFactor(autoScaleFactor);
    if (onScaleChange) {
      onScaleChange(autoScaleFactor);
    }
  };


  // Debug logging to check what data we're receiving
  console.log('ResumePreview received data:', resumeData);

  // Add validation to ensure we have valid resume data
  if (!resumeData) {
    return (
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-8 text-center">
          <div className="text-gray-500 mb-4">No resume data available</div>
          <div className="text-sm text-gray-400">Please ensure your resume has been properly optimized</div>
        </div>
      </div>
    );
  }

  // Ensure we have at least a name to display
  if (!resumeData.name || resumeData.name.trim() === '') {
    return (
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-8 text-center">
          <div className="text-gray-500 mb-4">Start building your resume!</div>
          <div className="text-sm text-gray-400">Fill in your details on the left to generate a live preview here</div>
        </div>
      </div>
    );
  }

  // --- Style constants ---
  const sectionTitleStyle: React.CSSProperties = {
    fontSize: ptToPx(PDF_CONFIG.fonts.sectionTitle.size),
    fontWeight: 'bold',
    marginTop: mmToPx(PDF_CONFIG.spacing.sectionSpacingBefore), // Adjusted
    marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter), // Adjusted
    fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`,
    letterSpacing: '0.5pt',
    textTransform: 'uppercase',
    // Force resume section titles to remain black even in dark mode context
    color: '#000000',
  } as const;

  const sectionUnderlineStyle: React.CSSProperties = {
    borderBottomWidth: '0.5pt',
    borderColor: '#404040',
    height: '1px',
    marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter),
    width: '100%',
    maxWidth: `${mmToPx(PDF_CONFIG.contentWidth)}px`,
    margin: '0 auto',
    boxSizing: 'border-box',
  };

  const bodyTextStyle: React.CSSProperties = {
    fontSize: ptToPx(PDF_CONFIG.fonts.body.size),
    fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`,
    lineHeight: PDF_CONFIG.spacing.lineHeight,
  };

  const listItemStyle: React.CSSProperties = {
    ...bodyTextStyle,
    marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 0.25),
    display: 'flex',
    alignItems: 'flex-start',
  };

  // Build contact information with proper separators
  const buildContactInfo = () => {
    const parts: React.ReactNode[] = [];

    const isValidField = (field?: string | null, fieldType: 'phone' | 'email' | 'url' | 'text' = 'text'): boolean => {
      if (!field || field.trim() === '') return false;
      const lower = field.trim().toLowerCase();
      const invalidValues = ['n/a', 'not specified', 'none'];
      if (invalidValues.includes(lower)) return false;
      
      switch (fieldType) {
        case 'phone': {
          const digitCount = (field.match(/\d/g) || []).length;
          return digitCount >= 7 && digitCount <= 15;
        }
        case 'email':
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field);
        case 'url':
          return /^https?:\/\//.test(field) ||
                 /^(www\.)?linkedin\.com\/in\//.test(field) ||
                 /^(www\.)?github\.com\//.test(field) ||
                 /linkedin\.com\/in\//.test(field) ||
                 /github\.com\//.test(field);
        case 'text':
        default:
          return true;
      }
    };

    if (isValidField(resumeData.phone, 'phone')) {
      parts.push(
        <span key="phone" style={{
          fontSize: ptToPx(PDF_CONFIG.fonts.contact.size),
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {resumeData.phone}
        </span>
      );
    }
    if (isValidField(resumeData.email, 'email')) {
      parts.push(
        <span key="email" style={{
          fontSize: ptToPx(PDF_CONFIG.fonts.contact.size),
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '200px',
        }}>
          {resumeData.email}
        </span>
      );
    }
    if (isValidField(resumeData.location, 'text')) {
      parts.push(
        <span key="location" style={{
          fontSize: ptToPx(PDF_CONFIG.fonts.contact.size),
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {resumeData.location}
        </span>
      );
    }
    if (isValidField(resumeData.linkedin, 'url')) {
      let processedLinkedin = resumeData.linkedin!;
      if (!processedLinkedin.startsWith('http')) {
        processedLinkedin = `https://${processedLinkedin}`;
      }
      parts.push(
        <span key="linkedin" style={{
          fontSize: ptToPx(PDF_CONFIG.fonts.contact.size),
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '180px',
        }}>
          {processedLinkedin}
        </span>
      );
    }
    if (isValidField(resumeData.github, 'url')) {
      let processedGithub = resumeData.github!;
      if (!processedGithub.startsWith('http')) {
        processedGithub = `https://${processedGithub}`;
      }
      parts.push(
        <span key="github" style={{
          fontSize: ptToPx(PDF_CONFIG.fonts.contact.size),
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '180px',
        }}>
          {processedGithub}
        </span>
      );
    }

    return parts.map((part, index) => (
      <React.Fragment key={index}>
        {part}
        {index < parts.length - 1 && (
          <span style={{
            fontSize: ptToPx(PDF_CONFIG.fonts.contact.size),
            margin: '0 4px',
            flexShrink: 0,
          }}>
            |
          </span>
        )}
      </React.Fragment>
    ));
  };

  const contactElements = buildContactInfo();

  const getSectionOrder = () => {
    if (userType === 'experienced') {
      return ['summary', 'education', 'workExperience', 'projects', 'skills', 'certifications', 'additionalSections'];
    } else if (userType === 'student') {
      return ['careerObjective', 'education', 'workExperience', 'projects', 'skills', 'certifications', 'achievementsAndExtras', 'additionalSections'];
    } else { // 'fresher'
      return ['careerObjective', 'education', 'workExperience', 'projects', 'skills', 'certifications', 'achievementsAndExtras', 'additionalSections'];
    }
  };

  const sectionOrder = getSectionOrder();

  const renderSection = (sectionName: string) => {
    switch (sectionName) {
      case 'careerObjective':
        if (!String(resumeData.careerObjective || '').trim()) return null;
        return (
          <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
            <h2 style={sectionTitleStyle}>CAREER OBJECTIVE</h2>
            <div style={sectionUnderlineStyle}></div>
            <p style={{ ...bodyTextStyle, marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing) }}>
              {resumeData.careerObjective || ''}
            </p>
          </div>
        );

      case 'summary':
        if (!String(resumeData.summary || '').trim()) return null;
        return (
          <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
            <h2 style={sectionTitleStyle}>PROFESSIONAL SUMMARY</h2>
            <div style={sectionUnderlineStyle}></div>
            <p style={{ ...bodyTextStyle, marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing) }}>
              {resumeData.summary || ''}
            </p>
          </div>
        );

      case 'workExperience':
        if (!resumeData.workExperience || resumeData.workExperience.length === 0) return null;
        return (
          <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
            <h2 style={sectionTitleStyle}>
              {userType === 'fresher' || userType === 'student' ? 'WORK EXPERIENCE' : 'PROFESSIONAL EXPERIENCE'}
            </h2>
            <div style={sectionUnderlineStyle}></div>
            {resumeData.workExperience.map((job, index) => (
              <div key={index} style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 2) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 0.5) }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: ptToPx(PDF_CONFIG.fonts.jobTitle.size), fontWeight: 'bold', fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif` }}>
                      {job.role} | {job.company}{job.location ? `, ${job.location}` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: ptToPx(PDF_CONFIG.fonts.year.size), fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif`, fontWeight: 'normal', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                    {job.year}
                  </div>
                </div>
                {job.bullets && job.bullets.length > 0 && (
                  <ul style={{ marginLeft: mmToPx(PDF_CONFIG.spacing.bulletIndent), listStyleType: 'disc', paddingLeft: '0' }}>
                    {job.bullets.map((bullet, bulletIndex) => {
                      // Ensure bullets are always rendered as strings and handle various shapes
                      const bulletObj = (bullet && typeof bullet === 'object') ? (bullet as any) : null;
                      const bulletText = typeof bullet === 'string'
                        ? bullet
                        : bulletObj && (bulletObj.description || bulletObj.title || bulletObj.text)
                          ? (bulletObj.description || bulletObj.title || bulletObj.text)
                          : JSON.stringify(bullet);
                      return (
                        <li key={bulletIndex} style={listItemStyle}>
                          <span>{bulletText}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        );

      case 'education':
        if (!resumeData.education || resumeData.education.length === 0) return null;
        return (
          <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
            <h2 style={sectionTitleStyle}>EDUCATION</h2>
            <div style={sectionUnderlineStyle}></div>
            {resumeData.education.map((edu, index) => (
              <div key={index} style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 2) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: ptToPx(PDF_CONFIG.fonts.jobTitle.size), fontWeight: 'bold', fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif` }}>
                      {edu.degree}
                    </div>
                    <div style={{ fontSize: ptToPx(PDF_CONFIG.fonts.company.size), fontWeight: 'normal', fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif` }}>
                      {edu.school}{edu.location ? `, ${edu.location}` : ''}
                    </div>
                    {edu.cgpa && (
                      <div style={{ fontSize: ptToPx(PDF_CONFIG.fonts.body.size), fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif`, color: '#4B5563' }}>
                        CGPA: {edu.cgpa}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: ptToPx(PDF_CONFIG.fonts.year.size), fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif`, fontWeight: 'normal', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                    {edu.year}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'projects':
        if (!resumeData.projects || resumeData.projects.length === 0) return null;
        return (
          <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
            <h2 style={sectionTitleStyle}>
              PROJECTS
            </h2>
            <div style={sectionUnderlineStyle}></div>
            {resumeData.projects.map((project, index) => (
              <div key={index} style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 2) }}>
                <div style={{ fontSize: ptToPx(PDF_CONFIG.fonts.jobTitle.size), fontWeight: 'bold', fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif`, marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 0.5) }}> {/* Already bold */}
                  {project.title}
                </div>
                {project.bullets && project.bullets.length > 0 && (
                  <ul style={{ marginLeft: mmToPx(PDF_CONFIG.spacing.bulletIndent), listStyleType: 'disc' }}> {/* Changed to disc */}
                    {project.bullets.map((bullet, bulletIndex) => {
                      // Ensure bullets are always rendered as strings and handle various shapes
                      const bulletObj = (bullet && typeof bullet === 'object') ? (bullet as any) : null;
                      const bulletText = typeof bullet === 'string'
                        ? bullet
                        : bulletObj && (bulletObj.description || bulletObj.title || bulletObj.text)
                          ? (bulletObj.description || bulletObj.title || bulletObj.text)
                          : JSON.stringify(bullet);
                      return (
                        <li key={bulletIndex} style={listItemStyle}>
                          <span>{bulletText}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        );

      case 'skills':
        if (!resumeData.skills || resumeData.skills.length === 0) return null;
        return (
          <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
            <h2 style={sectionTitleStyle}>SKILLS</h2>
            <div style={sectionUnderlineStyle}></div>
            {resumeData.skills.map((skillCategory, index) => (
              <div key={index} style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing * 0.5) }}>
                <span style={{ fontSize: ptToPx(PDF_CONFIG.fonts.body.size), fontFamily: `${PDF_CONFIG.fontFamily}, sans-serif` }}>
                  <strong style={{ fontWeight: 'bold' }}>{skillCategory.category}:</strong>{' '} {/* Already bold */}
                  {skillCategory.list && skillCategory.list.join(', ')}
                </span>
              </div>
            ))}
          </div>
        );

      case 'certifications':
        if (!resumeData.certifications || resumeData.certifications.length === 0) return null;
        return (
          <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
            <h2 style={sectionTitleStyle}>CERTIFICATIONS</h2>
            <div style={sectionUnderlineStyle}></div>
            <ul style={{ marginLeft: mmToPx(PDF_CONFIG.spacing.bulletIndent), listStyleType: 'disc' }}> {/* Changed to disc */}
              {resumeData.certifications.map((cert, index) => {
                if (!cert) {
                  return null;
                }

                // Properly handle both string and object certification types
                if (typeof cert === 'string') {
                  return (
                    <li key={index} style={listItemStyle}>
                      <span>{cert}</span>
                    </li>
                  );
                } else if (cert && typeof cert === 'object' && 'title' in cert) {
                  // Handle Certification object with title and description
                  const certObj = cert as { title: string; description?: string };
                  return (
                    <li key={index} style={listItemStyle}>
                      <span>
                        <b style={{fontWeight: 'bold'}}>{certObj.title}</b>
                        {certObj.description ? `: ${certObj.description}` : ''}
                      </span>
                    </li>
                  );
                } else {
                  // Fallback for unexpected formats
                  console.warn('Unexpected certification format:', cert);
                  return (
                    <li key={index} style={listItemStyle}>
                      <span>{String(cert)}</span>
                    </li>
                  );
                }
              })}
            </ul>
          </div>
        );

      case 'achievementsAndExtras':
        const hasAchievements = resumeData.achievements && resumeData.achievements.length > 0;

        if (!hasAchievements) return null;

        return (
          <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
            <h2 style={sectionTitleStyle}>ACHIEVEMENTS</h2>
            <div style={sectionUnderlineStyle}></div>
            {hasAchievements && (
              <div style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.entrySpacing) }}>
                <ul style={{ marginLeft: mmToPx(PDF_CONFIG.spacing.bulletIndent), listStyleType: 'disc' }}>
                  {resumeData.achievements!.map((item, index) => {
                    const itemObj = (item && typeof item === 'object') ? (item as any) : null;
                    const text = typeof item === 'string'
                      ? item
                      : itemObj && (itemObj.title || itemObj.text || itemObj.description)
                        ? (itemObj.title || itemObj.text || itemObj.description)
                        : JSON.stringify(item);
                    return (
                      <li key={index} style={listItemStyle}>
                        <span>{text}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        );

      case 'additionalSections':
        if (!resumeData.additionalSections || resumeData.additionalSections.length === 0) return null;
        return (
          <>
            {resumeData.additionalSections.map((section, sectionIndex) => (
              <div key={sectionIndex} style={{ marginBottom: mmToPx(PDF_CONFIG.spacing.sectionSpacingAfter) }}>
                <h2 style={sectionTitleStyle}>{section.title.toUpperCase()}</h2>
                <div style={sectionUnderlineStyle}></div>
              {section.bullets && section.bullets.length > 0 && (
  <ul style={{ marginLeft: mmToPx(PDF_CONFIG.spacing.bulletIndent), listStyleType: 'disc' }}>
    {section.bullets.map((bullet, bulletIndex) => {
      // Handle cases where bullet is a string, object, or other format
      const bulletText =
        typeof bullet === 'string'
          ? bullet
          : bullet && typeof bullet === 'object'
          ? bullet.title || bullet.text || JSON.stringify(bullet)
          : String(bullet);

      return (
        <li key={bulletIndex} style={listItemStyle}>
          <span>{bulletText}</span>
        </li>
      );
    })}
  </ul>
)}

              </div>
            ))}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {showControls && (
        <LiveResumePreviewControls
          scaleFactor={scaleFactor}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onReset={handleResetZoom}
          minZoom={0.3}
          maxZoom={1.5}
        />
      )}
      <div
        ref={contentWrapperRef}
        className="flex-1 overflow-auto flex items-start justify-center p-5"
        style={{
          position: 'relative',
          backgroundColor: 'transparent'
        }}
      >
      <div
        ref={resumeContentRef}
        className={`resume-one-column ${currentExportOptions.layoutType === 'compact' ? 'resume-compact' : 'resume-standard'} ${currentExportOptions.paperSize === 'letter' ? 'resume-letter' : 'resume-a4'}`}
        style={{
          fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`,
          fontSize: ptToPx(PDF_CONFIG.fonts.body.size),
          lineHeight: PDF_CONFIG.spacing.lineHeight,
          color: '#000000',
          paddingTop: mmToPx(PDF_CONFIG.margins.top),
          paddingBottom: mmToPx(PDF_CONFIG.margins.bottom),
          paddingLeft: mmToPx(PDF_CONFIG.margins.left),
          paddingRight: mmToPx(PDF_CONFIG.margins.right),
          width: mmToPx(PDF_CONFIG.pageWidth),
          minHeight: mmToPx(PDF_CONFIG.pageHeight),
          transform: `scale(${scaleFactor})`,
          transformOrigin: 'top center',
          boxSizing: 'border-box',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          backgroundColor: 'white',
          overflow: 'hidden',
          transition: isScaling ? 'none' : 'transform 0.3s ease',
          marginBottom: `${mmToPx(PDF_CONFIG.pageHeight) * (1 - scaleFactor)}px`,
        }}
      >
          {/* Header */}
          <div style={{
            textAlign: 'center',
            marginBottom: mmToPx(PDF_CONFIG.spacing.afterContact),
            maxWidth: `${mmToPx(PDF_CONFIG.contentWidth)}px`,
            margin: '0 auto',
          }}>
            <h1 style={{
              fontSize: ptToPx(PDF_CONFIG.fonts.name.size),
              fontWeight: 'bold',
              letterSpacing: '1pt',
              marginBottom: mmToPx(PDF_CONFIG.spacing.afterName),
              fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`,
              textTransform: 'uppercase',
              wordWrap: 'break-word',
              overflow: 'hidden',
              color: '#000000',
            }}>
              {resumeData.name}
            </h1>

            {contactElements.length > 0 && (
              <div style={{
                fontSize: ptToPx(PDF_CONFIG.fonts.contact.size),
                fontWeight: 'bold',
                fontFamily: `${PDF_CONFIG.fontFamily}, "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`,
                marginBottom: mmToPx(PDF_CONFIG.spacing.afterContact),
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '4px',
                maxWidth: '100%',
                overflow: 'hidden',
                wordBreak: 'break-word',
                color: '#000000',
              }}>
                {contactElements}
              </div>
            )}

            <div style={{
              borderBottomWidth: '0.5pt',
              borderColor: '#404040',
              height: '1px',
              margin: '0 auto',
              width: '100%',
              maxWidth: `${mmToPx(PDF_CONFIG.contentWidth)}px`,
            }}></div>
          </div>

          {/* Dynamic sections */}
          <div style={{
            maxWidth: `${mmToPx(PDF_CONFIG.contentWidth)}px`,
            margin: '0 auto',
            width: '100%',
            boxSizing: 'border-box',
          }}>
            {(Array.isArray(sectionOrder) ? sectionOrder : []).map((sectionName) => renderSection(sectionName))}
          </div>
        </div>
      </div>
    </div>
  );
};
