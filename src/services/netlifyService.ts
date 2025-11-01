import { PortfolioData, PortfolioTemplate } from '../types/portfolio';

const NETLIFY_API_TOKEN = import.meta.env.VITE_NETLIFY_API_TOKEN;
const NETLIFY_API_URL = 'https://api.netlify.com/api/v1';

interface NetlifyDeployResponse {
  id: string;
  site_id: string;
  url: string;
  ssl_url: string;
  deploy_ssl_url: string;
  state: string;
  error_message?: string;
}

class NetlifyService {
  private apiToken: string;

  constructor() {
    if (!NETLIFY_API_TOKEN) {
      console.warn('Netlify API token not configured. Deployment features will be disabled.');
      this.apiToken = '';
    } else {
      this.apiToken = NETLIFY_API_TOKEN;
    }
  }

  async deployPortfolio(
    portfolioData: PortfolioData,
    template: PortfolioTemplate,
    subdomain?: string
  ): Promise<{ siteId: string; deployId: string; url: string }> {
    if (!this.apiToken) {
      throw new Error('Netlify API token is not configured. Please contact support.');
    }

    const zipBlob = await this.generateSiteBundle(portfolioData, template);

    const siteName = subdomain || `portfolio-${portfolioData.id?.substring(0, 8)}`;

    try {
      const deployResponse = await this.deployToNetlify(zipBlob, siteName);

      return {
        siteId: deployResponse.site_id,
        deployId: deployResponse.id,
        url: deployResponse.ssl_url || deployResponse.url,
      };
    } catch (error: any) {
      console.error('Netlify deployment error:', error);
      throw new Error(`Deployment failed: ${error.message}`);
    }
  }

  private async deployToNetlify(zipBlob: Blob, siteName: string): Promise<NetlifyDeployResponse> {
    const formData = new FormData();
    formData.append('zip', zipBlob, 'site.zip');

    const response = await fetch(`${NETLIFY_API_URL}/sites`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/zip',
      },
      body: zipBlob,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Netlify API error: ${response.status} - ${errorText}`);
    }

    const result: NetlifyDeployResponse = await response.json();

    if (siteName) {
      await this.updateSiteName(result.site_id, siteName);
    }

    return result;
  }

  private async updateSiteName(siteId: string, name: string): Promise<void> {
    try {
      await fetch(`${NETLIFY_API_URL}/sites/${siteId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
    } catch (error) {
      console.warn('Failed to update site name:', error);
    }
  }

  private async generateSiteBundle(
    portfolioData: PortfolioData,
    template: PortfolioTemplate
  ): Promise<Blob> {
    const htmlContent = this.generateHTML(portfolioData, template);
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
    return htmlBlob;
  }

  private generateHTML(portfolioData: PortfolioData, template: PortfolioTemplate): string {
    const { profile, about, targetRole, experience, projects, education, skills, certifications, achievements } = portfolioData;
    const { visibleSections, sectionOrder, accentColor, fontFamily } = template;

    const sections = sectionOrder
      .map(section => {
        if (!visibleSections[section as keyof typeof visibleSections]) return '';

        switch (section) {
          case 'contact':
            return this.generateContactSection(profile);
          case 'about':
            return about ? this.generateAboutSection(about) : '';
          case 'skills':
            return skills.length > 0 ? this.generateSkillsSection(skills) : '';
          case 'experience':
            return experience.length > 0 ? this.generateExperienceSection(experience) : '';
          case 'projects':
            return projects.length > 0 ? this.generateProjectsSection(projects) : '';
          case 'education':
            return education.length > 0 ? this.generateEducationSection(education) : '';
          case 'certifications':
            return certifications.length > 0 ? this.generateCertificationsSection(certifications) : '';
          case 'achievements':
            return achievements.length > 0 ? this.generateAchievementsSection(achievements) : '';
          default:
            return '';
        }
      })
      .filter(Boolean)
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${portfolioData.seo?.title || `${profile.name} - ${targetRole || 'Portfolio'}`}</title>
  <meta name="description" content="${portfolioData.seo?.description || `Professional portfolio of ${profile.name}`}">
  <meta name="keywords" content="${portfolioData.seo?.keywords?.join(', ') || ''}">
  <link rel="stylesheet" href="styles.css">
  <link href="https://fonts.googleapis.com/css2?family=${fontFamily.replace(' ', '+')}:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --accent-color: ${accentColor};
      --font-family: '${fontFamily}', sans-serif;
    }
  </style>
</head>
<body>
  <div class="container">
    ${sections}
  </div>
  <script src="script.js"></script>
</body>
</html>`;
  }

  private generateContactSection(profile: any): string {
    return `
    <header class="contact-section">
      <h1 class="name">${profile.name}</h1>
      <div class="contact-info">
        ${profile.email ? `<a href="mailto:${profile.email}">${profile.email}</a>` : ''}
        ${profile.phone ? `<span>${profile.phone}</span>` : ''}
        ${profile.location ? `<span>${profile.location}</span>` : ''}
      </div>
      <div class="social-links">
        ${profile.linkedinUrl ? `<a href="${profile.linkedinUrl}" target="_blank" rel="noopener">LinkedIn</a>` : ''}
        ${profile.githubUrl ? `<a href="${profile.githubUrl}" target="_blank" rel="noopener">GitHub</a>` : ''}
      </div>
    </header>`;
  }

  private generateAboutSection(about: string): string {
    return `
    <section class="about-section">
      <h2>About</h2>
      <p>${about.replace(/\n/g, '</p><p>')}</p>
    </section>`;
  }

  private generateSkillsSection(skills: any[]): string {
    const skillsHTML = skills.map(category => `
      <div class="skill-category">
        <h3>${category.category}</h3>
        <div class="skill-tags">
          ${category.items.map((skill: string) => `<span class="skill-tag">${skill}</span>`).join('')}
        </div>
      </div>
    `).join('');

    return `
    <section class="skills-section">
      <h2>Skills</h2>
      <div class="skills-grid">
        ${skillsHTML}
      </div>
    </section>`;
  }

  private generateExperienceSection(experience: any[]): string {
    const experienceHTML = experience.map(exp => `
      <div class="experience-item">
        <div class="exp-header">
          <h3>${exp.role}</h3>
          <span class="duration">${exp.duration}</span>
        </div>
        <p class="company">${exp.company}</p>
        <ul class="bullets">
          ${exp.bullets.map((bullet: string) => `<li>${bullet}</li>`).join('')}
        </ul>
      </div>
    `).join('');

    return `
    <section class="experience-section">
      <h2>Experience</h2>
      ${experienceHTML}
    </section>`;
  }

  private generateProjectsSection(projects: any[]): string {
    const projectsHTML = projects.map(project => `
      <div class="project-item">
        <h3>${project.title}</h3>
        ${project.description ? `<p class="project-desc">${project.description}</p>` : ''}
        ${project.techStack && project.techStack.length > 0 ? `
          <div class="tech-stack">
            ${project.techStack.map((tech: string) => `<span class="tech-tag">${tech}</span>`).join('')}
          </div>
        ` : ''}
        <ul class="bullets">
          ${project.bullets.map((bullet: string) => `<li>${bullet}</li>`).join('')}
        </ul>
        ${project.links ? `
          <div class="project-links">
            ${project.links.github ? `<a href="${project.links.github}" target="_blank" rel="noopener">GitHub</a>` : ''}
            ${project.links.demo ? `<a href="${project.links.demo}" target="_blank" rel="noopener">Live Demo</a>` : ''}
          </div>
        ` : ''}
      </div>
    `).join('');

    return `
    <section class="projects-section">
      <h2>Projects</h2>
      ${projectsHTML}
    </section>`;
  }

  private generateEducationSection(education: any[]): string {
    const educationHTML = education.map(edu => `
      <div class="education-item">
        <h3>${edu.degree}</h3>
        <p class="institution">${edu.institution}</p>
        <div class="edu-details">
          <span>${edu.year}</span>
          ${edu.gpa ? `<span>GPA: ${edu.gpa}</span>` : ''}
          ${edu.location ? `<span>${edu.location}</span>` : ''}
        </div>
      </div>
    `).join('');

    return `
    <section class="education-section">
      <h2>Education</h2>
      ${educationHTML}
    </section>`;
  }

  private generateCertificationsSection(certifications: any[]): string {
    const certsHTML = certifications.map(cert => `
      <div class="cert-item">
        <h4>${cert.title}</h4>
        ${cert.issuer ? `<p class="issuer">${cert.issuer}</p>` : ''}
        ${cert.date ? `<span class="cert-date">${cert.date}</span>` : ''}
      </div>
    `).join('');

    return `
    <section class="certifications-section">
      <h2>Certifications</h2>
      <div class="certs-grid">
        ${certsHTML}
      </div>
    </section>`;
  }

  private generateAchievementsSection(achievements: string[]): string {
    return `
    <section class="achievements-section">
      <h2>Achievements</h2>
      <ul class="achievements-list">
        ${achievements.map(achievement => `<li>${achievement}</li>`).join('')}
      </ul>
    </section>`;
  }

  private generateCSS(template: PortfolioTemplate): string {
    return `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-family);
  line-height: 1.6;
  color: #333;
  background: #f9fafb;
}

.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 20px;
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.contact-section {
  text-align: center;
  padding: 40px 0;
  border-bottom: 2px solid var(--accent-color);
}

.name {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--accent-color);
  margin-bottom: 10px;
}

.contact-info, .social-links {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 15px;
  flex-wrap: wrap;
}

.contact-info a, .social-links a {
  color: #666;
  text-decoration: none;
}

.contact-info a:hover, .social-links a:hover {
  color: var(--accent-color);
}

section {
  padding: 40px 0;
  border-bottom: 1px solid #e5e7eb;
}

section:last-child {
  border-bottom: none;
}

h2 {
  font-size: 1.875rem;
  color: var(--accent-color);
  margin-bottom: 24px;
  font-weight: 600;
}

h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.about-section p {
  margin-bottom: 16px;
  font-size: 1.05rem;
  line-height: 1.8;
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
}

.skill-category h3 {
  color: #1f2937;
  margin-bottom: 12px;
}

.skill-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.skill-tag {
  padding: 6px 12px;
  background: var(--accent-color);
  color: white;
  border-radius: 4px;
  font-size: 0.875rem;
}

.experience-item, .project-item, .education-item {
  margin-bottom: 32px;
}

.exp-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}

.company, .institution {
  color: #6b7280;
  margin-bottom: 12px;
}

.bullets {
  list-style: disc;
  padding-left: 24px;
}

.bullets li {
  margin-bottom: 8px;
}

.tech-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}

.tech-tag {
  padding: 4px 10px;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #4b5563;
}

.project-links {
  margin-top: 12px;
  display: flex;
  gap: 16px;
}

.project-links a {
  color: var(--accent-color);
  text-decoration: none;
  font-weight: 500;
}

.certs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.cert-item {
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  border-left: 4px solid var(--accent-color);
}

.achievements-list {
  list-style: none;
}

.achievements-list li {
  padding: 12px 0;
  border-bottom: 1px solid #e5e7eb;
  position: relative;
  padding-left: 24px;
}

.achievements-list li:before {
  content: "✓";
  position: absolute;
  left: 0;
  color: var(--accent-color);
  font-weight: bold;
}

@media (max-width: 768px) {
  .container {
    padding: 20px 16px;
  }

  .name {
    font-size: 2rem;
  }

  .exp-header {
    flex-direction: column;
    align-items: flex-start;
  }
}`;
  }

  private generateJS(): string {
    return `console.log('Portfolio loaded successfully');

document.addEventListener('DOMContentLoaded', function() {
  const links = document.querySelectorAll('a');
  links.forEach(link => {
    link.addEventListener('click', function() {
      if (window.plausible) {
        plausible('Link Click', { props: { url: this.href } });
      }
    });
  });
});`;
  }

  private generateRobotsTxt(): string {
    return `User-agent: *
Allow: /

Sitemap: /sitemap.xml`;
  }

  private generateSitemap(portfolioData: PortfolioData): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <priority>1.0</priority>
  </url>
</urlset>`;
  }

  async downloadZipBundle(portfolioData: PortfolioData, template: PortfolioTemplate): Promise<Blob> {
    return this.generateSiteBundle(portfolioData, template);
  }

  isConfigured(): boolean {
    return !!this.apiToken;
  }
}

export const netlifyService = new NetlifyService();
