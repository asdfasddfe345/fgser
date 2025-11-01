# PrimoBoost AI - Resume Optimization Platform

## 🚀 Quick Start

**Database Status**: ✅ Migrated to production Supabase instance (January 2025)
**Database URL**: `https://rixmudvtbfkjpwjoefon.supabase.co`

### Setup Instructions
1. **Database Setup**: See `QUICK_START_NEW_DATABASE.md` for 3-step migration guide
2. **Development**: Run `npm install` and `npm run dev`
3. **Build**: Run `npm run build` to compile for production

### Important Files
- `QUICK_START_NEW_DATABASE.md` - Quick migration guide
- `MIGRATION_INSTRUCTIONS.md` - Detailed migration steps
- `DATABASE_MIGRATION_COMPLETE.md` - Migration summary
- `verify-migration.sql` - Database verification script

---

## Overview

PrimoBoost AI is an intelligent resume optimization platform with auto-apply feature that enables users to automatically apply to jobs with AI-optimized resumes.

## Architecture

### Core Components

1. **Profile Resume Service** (`src/services/profileResumeService.ts`)
   - Constructs comprehensive ResumeData objects from user profiles
   - Aggregates data from user_profiles, internship_records, and course_materials
   - Validates profile completeness for auto-apply eligibility

2. **Auto-Apply Orchestrator** (`src/services/autoApplyOrchestrator.ts`)
   - Coordinates the end-to-end auto-apply process
   - Integrates AI optimization, project enhancement, and file generation
   - Manages communication with external browser automation service

3. **External Browser Service** (`src/services/externalBrowserService.ts`)
   - Interfaces with external headless browser automation
   - Handles form analysis, field mapping, and submission
   - Provides real-time status updates and progress tracking

4. **Enhanced Edge Functions**
   - `auto-apply/index.ts`: Orchestrates server-side auto-apply process
   - Prepares data payload for external browser service
   - Logs application attempts and results

### Data Flow

```
User clicks "Auto Apply" 
    ↓
JobCard validates profile completeness
    ↓
AutoApplyOrchestrator.initiateAutoApply()
    ├── Fetch job details
    ├── Build ResumeData from profile
    ├── Enhance projects based on JD
    ├── AI-optimize resume content
    ├── Store optimized resume
    └── Trigger server-side auto-apply
        ↓
Edge Function (auto-apply/index.ts)
    ├── Prepare payload for external service
    ├── Call external headless browser service
    ├── Receive automation results
    └── Update application logs
        ↓
External Browser Service
    ├── Analyze application form structure
    ├── Navigate to application URL
    ├── Fill form fields with user data
    ├── Upload optimized resume file
    ├── Submit application
    ├── Capture confirmation screenshot
    └── Return results
```

## Database Schema Integration

### Tables Used

- **user_profiles**: Core user information and JSONB fields for structured resume data
- **internship_records**: Additional work experience data
- **course_materials**: Certification information
- **job_listings**: Job postings and application URLs
- **optimized_resumes**: AI-optimized resume data and file URLs
- **auto_apply_logs**: Tracking of all auto-apply attempts
- **manual_apply_logs**: Manual application tracking for comparison

### Key JSONB Fields

- `education_details`: Array of Education objects
- `experience_details`: Array of WorkExperience objects  
- `skills_details`: Array of Skill objects

## External Browser Service Requirements

### API Endpoints

1. **POST /auto-apply**
   - Receives application payload
   - Returns automation results

2. **GET /auto-apply/status/{applicationId}**
   - Real-time status updates
   - Progress tracking

3. **POST /auto-apply/cancel/{applicationId}**
   - Cancellation support

4. **POST /analyze-form**
   - Form structure analysis
   - Field detection

### Environment Variables

```env
# External Browser Service Configuration
EXTERNAL_BROWSER_SERVICE_URL=https://your-browser-service.com/api
EXTERNAL_SERVICE_API_KEY=your-service-api-key
VITE_EXTERNAL_BROWSER_SERVICE_URL=https://your-browser-service.com/api
VITE_EXTERNAL_BROWSER_API_KEY=your-client-api-key
```

## Implementation Status

### ✅ Completed
- Profile resume data construction
- Auto-apply orchestration logic
- Edge Function integration with external service
- Job card UI updates for auto-apply
- Progress tracking modal
- Form field mapping utilities

### 🚧 In Progress
- External headless browser service setup
- File upload handling for resume attachments
- Advanced form field detection algorithms
- CAPTCHA handling strategies

### 📋 TODO
- Integration with specific job board APIs
- Batch auto-apply functionality
- Machine learning for form field detection improvement
- A/B testing for application success rates

## Usage

### For Users
1. Ensure profile is complete (education, experience, skills, contact info)
2. Browse job listings filtered by graduation year/experience level
3. Click "Auto Apply" on relevant positions
4. Monitor progress through real-time status updates
5. Receive confirmation and application tracking

### For Developers
1. Set up external browser service (AWS Lambda + Puppeteer recommended)
2. Configure environment variables for service URLs and API keys
3. Test with sample job applications before production deployment
4. Monitor auto_apply_logs table for success rates and errors

## Security Considerations

- All user data is encrypted in transit to external service
- API keys for external service are stored securely
- Application logs include only necessary metadata
- User consent required before initiating auto-apply
- Ability to cancel applications in progress

## Performance Metrics

- Target application completion time: < 2 minutes
- Expected success rate: > 80% for standard forms
- Fallback to manual apply for complex forms
- Real-time progress updates every 2 seconds

## Error Handling

- Graceful degradation to manual apply
- Detailed error logging for debugging
- User-friendly error messages
- Automatic retry for transient failures
- Screenshot capture for failed applications

This implementation provides a robust foundation for intelligent job application automation while maintaining flexibility for future enhancements and integrations.