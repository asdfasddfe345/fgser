// src/services/platformDetectionService.ts

export interface PlatformInfo {
  name: string;
  displayName: string;
  baseUrl: string;
  loginUrl?: string;
  requiresAuth: boolean;
  authStrategy: 'cookie' | 'token' | 'oauth' | 'session';
  confidence: number;
  formSelectors?: {
    name?: string[];
    email?: string[];
    phone?: string[];
    resume?: string[];
    submitButton?: string[];
  };
}

export interface PlatformDetectionResult {
  platform: string;
  displayName: string;
  confidence: number;
  requiresAuth: boolean;
  authStrategy: string;
  loginUrl?: string;
  metadata: any;
}

/**
 * Platform detection patterns and configurations
 */
const PLATFORM_PATTERNS: Array<{
  name: string;
  displayName: string;
  patterns: RegExp[];
  requiresAuth: boolean;
  authStrategy: 'cookie' | 'token' | 'oauth' | 'session';
  loginUrl?: string;
  formSelectors?: any;
}> = [
  {
    name: 'linkedin',
    displayName: 'LinkedIn',
    patterns: [/linkedin\.com/i, /linkedin\.co\./i],
    requiresAuth: true,
    authStrategy: 'cookie',
    loginUrl: 'https://www.linkedin.com/login',
    formSelectors: {
      name: ['input[name*="name"]', '#applicant-name'],
      email: ['input[name*="email"]', '#applicant-email'],
      phone: ['input[name*="phone"]', '#applicant-phone'],
      resume: ['input[type="file"][name*="resume"]', 'input[type="file"][accept*="pdf"]'],
      submitButton: ['button[type="submit"]', '.jobs-apply-button'],
    },
  },
  {
    name: 'workday',
    displayName: 'Workday',
    patterns: [/myworkdayjobs\.com/i, /workday\.com/i, /wd\d\.myworkdayjobs/i],
    requiresAuth: false,
    authStrategy: 'session',
    formSelectors: {
      name: ['input[data-automation-id*="legalNameSection"]', 'input[name*="name"]'],
      email: ['input[data-automation-id*="email"]', 'input[type="email"]'],
      phone: ['input[data-automation-id*="phone"]', 'input[type="tel"]'],
      resume: ['input[data-automation-id*="resume"]', 'input[type="file"]'],
      submitButton: ['button[data-automation-id="bottom-navigation-next-button"]'],
    },
  },
  {
    name: 'naukri',
    displayName: 'Naukri.com',
    patterns: [/naukri\.com/i, /naukrigulf\.com/i],
    requiresAuth: true,
    authStrategy: 'cookie',
    loginUrl: 'https://www.naukri.com/nlogin/login',
    formSelectors: {
      name: ['input[name="name"]', '#name'],
      email: ['input[name="email"]', '#email'],
      phone: ['input[name="mobile"]', '#mobile'],
      resume: ['input[type="file"]', '#attachCV'],
      submitButton: ['button[type="submit"]', '.btn-submit'],
    },
  },
  {
    name: 'greenhouse',
    displayName: 'Greenhouse',
    patterns: [/greenhouse\.io/i, /boards\.greenhouse\.io/i],
    requiresAuth: false,
    authStrategy: 'session',
    formSelectors: {
      name: ['input[name*="name"]', '#first_name', '#last_name'],
      email: ['input[name="email"]', '#email'],
      phone: ['input[name="phone"]', '#phone'],
      resume: ['input[name="resume"]', 'input[type="file"]'],
      submitButton: ['input[type="submit"]', '#submit_app'],
    },
  },
  {
    name: 'lever',
    displayName: 'Lever',
    patterns: [/lever\.co/i, /jobs\.lever\.co/i],
    requiresAuth: false,
    authStrategy: 'session',
    formSelectors: {
      name: ['input[name="name"]', '.application-name'],
      email: ['input[name="email"]', '.application-email'],
      phone: ['input[name="phone"]', '.application-phone'],
      resume: ['input[name="resume"]', 'input[type="file"]'],
      submitButton: ['button.template-btn-submit'],
    },
  },
  {
    name: 'indeed',
    displayName: 'Indeed',
    patterns: [/indeed\.com/i, /indeed\.co\./i],
    requiresAuth: false,
    authStrategy: 'cookie',
    loginUrl: 'https://secure.indeed.com/account/login',
    formSelectors: {
      name: ['input[name*="name"]'],
      email: ['input[name*="email"]'],
      phone: ['input[name*="phone"]'],
      resume: ['input[type="file"]'],
      submitButton: ['button[type="submit"]'],
    },
  },
  {
    name: 'monster',
    displayName: 'Monster.com',
    patterns: [/monster\.com/i, /monster\.co\./i],
    requiresAuth: true,
    authStrategy: 'cookie',
    loginUrl: 'https://www.monster.com/login',
  },
  {
    name: 'glassdoor',
    displayName: 'Glassdoor',
    patterns: [/glassdoor\.com/i, /glassdoor\.co\./i],
    requiresAuth: true,
    authStrategy: 'cookie',
    loginUrl: 'https://www.glassdoor.com/profile/login_input.htm',
  },
  {
    name: 'instahyre',
    displayName: 'Instahyre',
    patterns: [/instahyre\.com/i],
    requiresAuth: true,
    authStrategy: 'cookie',
    loginUrl: 'https://www.instahyre.com/login/',
  },
  {
    name: 'angellist',
    displayName: 'AngelList/Wellfound',
    patterns: [/angel\.co/i, /wellfound\.com/i],
    requiresAuth: true,
    authStrategy: 'cookie',
    loginUrl: 'https://wellfound.com/login',
  },
];

class PlatformDetectionService {
  /**
   * Detects the platform from a URL
   */
  detectPlatform(url: string): PlatformDetectionResult {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const fullUrl = url.toLowerCase();

      // Check each platform pattern
      for (const platform of PLATFORM_PATTERNS) {
        for (const pattern of platform.patterns) {
          if (pattern.test(hostname) || pattern.test(fullUrl)) {
            return {
              platform: platform.name,
              displayName: platform.displayName,
              confidence: 0.95,
              requiresAuth: platform.requiresAuth,
              authStrategy: platform.authStrategy,
              loginUrl: platform.loginUrl,
              metadata: {
                baseUrl: `${urlObj.protocol}//${urlObj.hostname}`,
                formSelectors: platform.formSelectors,
              },
            };
          }
        }
      }

      // Unknown platform
      return {
        platform: 'unknown',
        displayName: 'Unknown Platform',
        confidence: 0.3,
        requiresAuth: false,
        authStrategy: 'session',
        metadata: {
          baseUrl: `${urlObj.protocol}//${urlObj.hostname}`,
        },
      };
    } catch (error) {
      console.error('Platform detection error:', error);
      return {
        platform: 'unknown',
        displayName: 'Unknown Platform',
        confidence: 0,
        requiresAuth: false,
        authStrategy: 'session',
        metadata: {},
      };
    }
  }

  /**
   * Gets platform configuration by name
   */
  getPlatformConfig(platformName: string): PlatformInfo | null {
    const platform = PLATFORM_PATTERNS.find((p) => p.name === platformName);
    if (!platform) return null;

    return {
      name: platform.name,
      displayName: platform.displayName,
      baseUrl: '',
      loginUrl: platform.loginUrl,
      requiresAuth: platform.requiresAuth,
      authStrategy: platform.authStrategy,
      confidence: 1.0,
      formSelectors: platform.formSelectors,
    };
  }

  /**
   * Checks if a platform requires authentication
   */
  requiresAuthentication(url: string): boolean {
    const detection = this.detectPlatform(url);
    return detection.requiresAuth;
  }

  /**
   * Gets the login URL for a platform
   */
  getLoginUrl(url: string): string | null {
    const detection = this.detectPlatform(url);
    return detection.loginUrl || null;
  }

  /**
   * Gets form selectors for a platform
   */
  getFormSelectors(url: string): any {
    const detection = this.detectPlatform(url);
    return detection.metadata?.formSelectors || {};
  }

  /**
   * Checks if a platform is supported for auto-apply
   */
  isSupported(url: string): boolean {
    const detection = this.detectPlatform(url);
    return detection.confidence > 0.5;
  }

  /**
   * Gets all supported platforms
   */
  getSupportedPlatforms(): Array<{ name: string; displayName: string }> {
    return PLATFORM_PATTERNS.map((p) => ({
      name: p.name,
      displayName: p.displayName,
    }));
  }

  /**
   * Detects authentication state from page content
   * This would be called by the browser automation service
   */
  detectAuthenticationState(pageContent: string, url: string): {
    isAuthenticated: boolean;
    needsLogin: boolean;
    loginDetected: boolean;
  } {
    const platform = this.detectPlatform(url).platform;

    // Platform-specific detection patterns
    const authPatterns: Record<string, { authenticated: RegExp[]; loginPage: RegExp[] }> = {
      linkedin: {
        authenticated: [/nav__me-photo/i, /global-nav__me/i],
        loginPage: [/login-form/i, /login-email/i, /signin/i],
      },
      workday: {
        authenticated: [/signed.*in/i, /myworkday/i],
        loginPage: [/sign.*in/i, /login/i],
      },
      naukri: {
        authenticated: [/logout/i, /my.*naukri/i],
        loginPage: [/login.*form/i, /signin/i],
      },
      indeed: {
        authenticated: [/account.*menu/i, /user.*nav/i],
        loginPage: [/login.*form/i, /sign.*in/i],
      },
    };

    const patterns = authPatterns[platform] || {
      authenticated: [/logout/i, /signout/i, /sign.*out/i],
      loginPage: [/login/i, /signin/i, /sign.*in/i, /authenticate/i],
    };

    const isAuthenticated = patterns.authenticated.some((pattern) =>
      pattern.test(pageContent)
    );
    const loginDetected = patterns.loginPage.some((pattern) => pattern.test(pageContent));

    return {
      isAuthenticated,
      needsLogin: !isAuthenticated && loginDetected,
      loginDetected,
    };
  }

  /**
   * Extracts session cookies for a platform
   */
  getSessionCookieNames(platformName: string): string[] {
    const cookieMap: Record<string, string[]> = {
      linkedin: ['li_at', 'JSESSIONID', 'liap', 'lang'],
      workday: ['PLAY_SESSION', 'wday_vps_cookie', 'wd-browser-id'],
      naukri: ['NAUKRICSRF', '_t_ds', '_t_r', 'MYNAUKRI[UNID]'],
      indeed: ['CTK', 'INDEED_CSRF_TOKEN', 'JSESSIONID'],
      greenhouse: ['__csrf_token', '_greenhouse_session'],
      lever: ['lever.session', 'lever.signature'],
    };

    return cookieMap[platformName] || ['JSESSIONID', 'PHPSESSID', 'connect.sid'];
  }
}

export const platformDetectionService = new PlatformDetectionService();
