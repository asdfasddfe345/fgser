# AI Mock Interview Feature - User Guide

## Overview
The AI Mock Interview feature allows users to practice technical and HR interviews in a realistic, meet-style environment with AI-powered feedback.

## How to Access
1. Navigate to the PrimoBoost AI homepage
2. Sign in to your account (required for mock interviews)
3. Click on "AI Mock Interview (Beta)" card on the homepage
4. Or directly navigate to `/mock-interview` route

## Features
- **Two Interview Types:**
  - General Mock Interview: Practice common questions across different roles and domains
  - Company-Based Interview: Prepare for specific companies (Google, Amazon, TCS, Infosys, etc.)

- **Interview Categories:**
  - Technical: Coding, system design, and technical concepts
  - HR: Behavioral questions and soft skills
  - Mixed: Combination of technical and HR questions

- **Duration Options:** 10 to 40 minutes (adjustable in 5-minute increments)

- **Real-Time Features:**
  - Live speech-to-text transcription
  - Video and audio recording
  - Fixed header showing timer, question count, and controls
  - AI-powered feedback after each answer

## User Flow

### 1. Welcome Screen
- Overview of the feature
- Feature list and what to expect
- "Start Mock Interview" button

### 2. Interview Type Selection
- Choose between General or Company-Based interview
- Visual cards with descriptions

### 3. Configuration
**For General Interviews:**
- Select category (Technical or HR)
- Choose technical domain (optional for Technical interviews)
- Enter target role (optional)
- Set duration

**For Company-Based Interviews:**
- Select company from popular list
- Choose role specific to that company
- Select interview category
- Set duration

### 4. Interview Room (Meet-Style UI)
**Fixed Header (Always Visible):**
- User name
- Countdown timer
- Current question number / total questions
- Pause button
- End Interview button

**Main Content Area (3-Column Layout):**
- **Left Column:** AI Interviewer avatar
- **Center Column:** Current question display and answer submission
- **Right Column:** User camera preview and recording status

**Footer Status Bar:**
- Shows current stage: "Listening", "Processing", "Generating Feedback"

**Interview Flow:**
1. Question appears on screen
2. System starts listening automatically after 2 seconds
3. Speak your answer clearly
4. Click "Submit Answer" when done
5. AI processes and analyzes your response
6. Brief feedback shown (optional)
7. Automatically moves to next question
8. Repeat until all questions answered or time expires

### 5. Summary Report
- Overall score out of 100
- Number of questions answered
- Total duration taken
- Key strengths identified
- Areas for improvement
- Question-by-question breakdown with:
  - Individual scores (0-10)
  - Specific feedback
  - Missed points
  - Suggestions for improvement
  - Tone and confidence assessment

**Actions Available:**
- Retake Interview (starts a new session)
- Download Report (future feature)
- Back to Home

## Technical Requirements

### Browser Compatibility
- **Recommended:** Chrome 90+, Edge 90+
- **Supported:** Firefox 88+, Safari 14+
- **Note:** Speech recognition works best in Chrome/Edge

### Permissions Required
- **Microphone:** Required for speech-to-text
- **Camera:** Required for video recording
- **Note:** You can continue without camera/mic, but responses won't be recorded

### Internet Connection
- Stable broadband connection recommended
- Minimum 2 Mbps upload speed for video streaming

## Tips for Best Experience

### Before Interview
1. **Test your equipment:** Check camera and microphone work properly
2. **Find a quiet space:** Minimize background noise
3. **Good lighting:** Ensure your face is well-lit
4. **Stable internet:** Test your connection speed
5. **Browser preparation:** Close unnecessary tabs

### During Interview
1. **Speak clearly:** Enunciate words properly
2. **Face the camera:** Maintain good posture
3. **Take your time:** No need to rush, quality > speed
4. **Use the STAR method:** For behavioral questions (Situation, Task, Action, Result)
5. **Be specific:** Include metrics and concrete examples
6. **Watch the timer:** Manage your time effectively

### Answer Quality Tips
- Start with strong action verbs
- Include quantifiable achievements
- Demonstrate problem-solving approach
- Show technical depth for technical questions
- Be honest and authentic for HR questions
- Structure your answers logically

## Scoring System

### Individual Question Scores (0-10)
- **9-10:** Excellent answer with deep understanding
- **7-8:** Good answer covering main concepts
- **5-6:** Satisfactory with significant gaps
- **3-4:** Poor answer missing key concepts
- **0-2:** Very poor or no substantial answer

### Overall Score (0-100)
- Calculated as average of all individual scores × 10
- Represents overall interview performance

### AI Feedback Components
1. **Score:** Numerical rating
2. **Strengths:** What you did well
3. **Missed Points:** Key concepts you didn't cover
4. **Suggestions:** Specific improvements
5. **Tone & Confidence:** Communication assessment
6. **Improvement Areas:** Overall areas to work on

## Data Privacy & Storage

### What We Store
- Interview session metadata (type, duration, score)
- Question and answer pairs
- AI-generated feedback
- Audio transcripts (not raw audio files)
- Video URLs (stored securely in Supabase Storage)

### Data Access
- Only you can access your interview sessions
- Admin users can view aggregate statistics (not individual responses)
- Data is secured with Row Level Security (RLS)

### Data Retention
- Interview sessions stored indefinitely
- You can delete your data anytime from profile settings

## Troubleshooting

### Common Issues

**Issue: Microphone not working**
- Solution: Check browser permissions, allow microphone access

**Issue: Speech recognition not capturing words**
- Solution: Speak louder, reduce background noise, use Chrome browser

**Issue: Video preview not showing**
- Solution: Allow camera permission, check if camera is used by another app

**Issue: Interview freezes or crashes**
- Solution: Refresh page, clear browser cache, check internet connection

**Issue: AI feedback taking too long**
- Solution: Be patient, OpenRouter API may be slow sometimes

**Issue: Timer not working**
- Solution: Refresh page, this resets the timer

### Error Messages

**"Camera/microphone access denied"**
- Click the camera icon in your browser's address bar
- Allow permissions for this site
- Refresh the page

**"Failed to initialize interview"**
- Check your internet connection
- Ensure you're logged in
- Try again in a few moments

**"No questions available"**
- This indicates a database issue
- Contact support or try a different interview configuration

## Feature Limitations (Beta Version)

### Current Limitations
- Fixed question pool (20 sample questions)
- No adaptive questioning (questions don't adjust based on performance)
- Basic feedback analysis
- No voice-to-voice AI interaction
- Limited company-specific questions
- No collaborative interview mode

### Planned Features (Future Updates)
- Expanded question database (1000+ questions)
- Adaptive AI that adjusts difficulty based on responses
- Company-specific interview patterns
- Resume-based personalized questions
- Voice-to-voice conversation with AI
- Real-time hints and tips during interview
- Peer comparison and leaderboards
- Integration with job applications

## API & Technical Details

### Services Used
- **OpenRouter API:** AI feedback generation (Gemini 2.0 Flash)
- **Browser Speech Recognition API:** Speech-to-text transcription
- **MediaRecorder API:** Audio/video recording
- **Supabase:** Database and storage

### Database Tables
- `interview_questions`: Question pool
- `mock_interview_sessions`: Session metadata
- `interview_responses`: Individual question responses with feedback
- `interview-recordings` storage bucket: Video/audio files

## Support & Feedback
- Report bugs via contact form on website
- Feature requests welcome at support@primoboost.ai
- Check our Tutorials page for video guides

## FAQs

**Q: Is this feature free?**
A: Currently in beta, it's free for all authenticated users.

**Q: How long does each interview take?**
A: You choose the duration (10-40 minutes).

**Q: Can I pause and resume?**
A: Yes, use the Pause button in the header.

**Q: Are my interviews recorded?**
A: Yes, but only you can access them.

**Q: Can I retake the same interview?**
A: Yes, you can retake as many times as you want.

**Q: Do I get different questions each time?**
A: Questions are randomly selected from the pool, so you may see some repeats.

**Q: How accurate is the AI feedback?**
A: The AI provides constructive feedback based on industry best practices, but it's not perfect. Use it as a learning tool.

**Q: Can I download my interview report?**
A: Download feature coming soon. Currently, you can view online.

**Q: What if I don't have a camera?**
A: You can still participate; your responses just won't be video recorded.

**Q: Is the AI interviewer interactive?**
A: Not yet. Current version shows questions and collects responses. Interactive AI coming in future updates.

---

**Version:** 1.0 (Beta)
**Last Updated:** October 2025
**Feature Status:** Active Beta Testing
