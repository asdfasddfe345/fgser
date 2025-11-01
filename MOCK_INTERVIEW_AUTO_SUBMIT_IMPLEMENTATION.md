# Mock Interview Auto-Submit & Simplified Header Implementation

## Overview
This implementation adds intelligent auto-submit functionality with 5-second silence detection and a simplified branded header to the AI Mock Interview system.

## Features Implemented

### 1. Speech Activity Detection Service
**File:** `src/services/speechActivityDetector.ts`

- Real-time audio level monitoring using Web Audio API
- Configurable silence threshold (default: 5 seconds)
- Configurable volume threshold (default: -50dB)
- Automatic silence detection and callback triggers
- Speech detection with immediate feedback
- Proper cleanup and resource management

**Key Methods:**
- `initialize(stream, options)` - Sets up audio analysis
- `start(onSilenceDetected, onSpeechDetected)` - Begins monitoring
- `getCurrentSilenceDuration()` - Returns current silence duration
- `resetSilenceTimer()` - Resets the countdown
- `stop()` - Stops monitoring
- `cleanup()` - Releases all resources

### 2. Database Schema Updates
**Migration:** `supabase/migrations/add_auto_submit_and_skip_tracking.sql`

**New Columns Added:**

**interview_responses table:**
- `auto_submitted` (boolean) - Tracks if answer was auto-submitted
- `silence_duration` (integer) - Records silence duration before submission

**mock_interview_sessions table:**
- `skipped_questions` (jsonb) - Array of skipped question IDs
- `skip_count` (integer) - Total count of skipped questions

### 3. Simplified Branded Header Component
**File:** `src/components/interview/SimplifiedInterviewHeader.tsx`

**Features:**
- Clean, minimalist design with PrimoBoost AI branding
- Essential controls only (timer, question counter, pause/resume, end)
- Violation warning indicator
- Full-screen toggle when not in full-screen mode
- Responsive layout with proper spacing
- Dark theme consistent with interview interface

**Header Elements:**
- Left: PrimoBoost AI logo + brand name
- Center: Timer, Question counter, Violations (if any), Full-screen toggle
- Right: Pause/Resume button, End interview button

### 4. Enhanced MockInterviewRoom Component
**File:** `src/components/interview/MockInterviewRoom.tsx`

**New Features:**

#### Auto-Submit Functionality
- Monitors user speech in real-time
- Detects 5 seconds of continuous silence
- Automatically submits answer when silence threshold reached
- Visual countdown timer shows remaining seconds
- Progress bar animation for countdown
- Prevents double-submission with ref flag
- Tracks auto-submit status in database

#### Skip Question Feature
- "Skip Question" button during listening stage
- Loading state with spinner during transition
- Saves skipped question to database
- Updates session skip count
- Marks response as skipped with 0 score
- Smooth transition to next question

#### Visual Feedback Improvements
- **Auto-submit info banner** - Dismissible info about 5-second rule
- **Silence countdown display** - Shows countdown from 5 to 0 seconds
- **Progress bar** - Visual indicator of countdown progress
- **Speech detection indicator** - Green dot shows when speaking detected
- **Skip loading state** - Spinner and "Skipping..." text
- **Auto-submit notification** - Yellow warning during countdown

#### State Management
New state variables:
- `silenceCountdown` - Tracks countdown (5 to 0)
- `isSpeaking` - Indicates active speech detection
- `isSkipping` - Loading state for skip operation
- `autoSubmitted` - Prevents manual submit after auto-submit
- `showAutoSubmitInfo` - Controls info banner visibility

#### Refs
- `silenceCheckIntervalRef` - Interval for checking silence duration
- `autoSubmitTriggeredRef` - Prevents duplicate auto-submits

## User Experience Flow

### Starting Interview
1. User sees standard interview setup
2. Camera and microphone permissions requested
3. Full-screen mode activated
4. Interview begins with first question

### Answering Questions
1. AI interviewer asks question via text-to-speech
2. User starts speaking - speech detection active (green indicator)
3. Transcript appears in real-time
4. Info banner explains 5-second auto-submit rule (dismissible)

### Auto-Submit Trigger
1. User stops speaking for 5 seconds
2. Yellow countdown appears: "Auto-submitting in: 5s"
3. Progress bar decreases from 100% to 0%
4. At 0 seconds, answer automatically submits
5. Status message: "Auto-submitting your answer..."
6. Continues to next question

### Manual Submit
1. User can click "Submit Answer" button anytime
2. Bypasses auto-submit countdown
3. Immediately processes answer

### Skip Question
1. User clicks "Skip" button
2. Button shows loading spinner: "Skipping..."
3. Question recorded as skipped in database
4. Moves to next question after 1 second

### Countdown Reset
- If user speaks again during countdown, timer resets to 5 seconds
- Speech detection continuously monitors for activity
- Countdown only proceeds during continuous silence

## Technical Implementation Details

### Silence Detection Algorithm
1. Web Audio API analyzes microphone input every 100ms
2. Calculates average frequency data across all bins
3. Converts to decibels: `20 * log10(average / 255)`
4. If decibels > threshold (-50dB): Speech detected
5. If decibels < threshold: Silence detected
6. Tracks last speech time, calculates duration
7. Triggers callback when 5 seconds of silence reached

### Auto-Submit Mechanism
```typescript
// Interval checks silence duration every 100ms
silenceCheckIntervalRef.current = setInterval(() => {
  const currentSilence = speechActivityDetector.getCurrentSilenceDuration();
  const countdown = Math.max(0, 5 - currentSilence);
  setSilenceCountdown(countdown);

  if (countdown === 0 && !autoSubmitTriggeredRef.current) {
    autoSubmitTriggeredRef.current = true;
    handleAutoSubmit();
  }
}, 100);
```

### Skip Question Process
1. Stop all recording and speech recognition
2. Fetch current session data (skipped questions array)
3. Update session with new skipped question ID
4. Increment skip_count
5. Save response with [Question Skipped] marker
6. Set individual_score to 0
7. Move to next question

### Database Integration
```typescript
// Auto-submit tracking
await supabase.from('interview_responses').insert({
  // ... standard fields ...
  auto_submitted: isAutoSubmit,
  silence_duration: silenceDuration
});

// Skip tracking
await supabase.from('mock_interview_sessions').update({
  skipped_questions: [...existing, currentQuestion.id],
  skip_count: skipCount + 1
});
```

## Configuration Options

### Silence Detection Settings
Located in `MockInterviewRoom.tsx`:
```typescript
await speechActivityDetector.initialize(stream, {
  silenceThreshold: 5000,  // 5 seconds in milliseconds
  volumeThreshold: -50     // Volume in decibels
});
```

### Adjustable Parameters
- **silenceThreshold**: Time in ms before auto-submit (default: 5000)
- **volumeThreshold**: Audio level in dB to detect speech (default: -50)
- **checkInterval**: How often to check silence (default: 100ms)

## UI Components

### Countdown Display
```tsx
{silenceCountdown < 5 && silenceCountdown > 0 && (
  <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
    <div className="flex items-center justify-between">
      <span>Auto-submitting in:</span>
      <span className="font-mono font-bold">{silenceCountdown}s</span>
    </div>
    <div className="progress-bar">
      <div style={{ width: `${(silenceCountdown / 5) * 100}%` }} />
    </div>
  </div>
)}
```

### Skip Button
```tsx
<button onClick={handleSkipQuestion} disabled={isSkipping}>
  {isSkipping ? (
    <>
      <Loader2 className="animate-spin" />
      <span>Skipping...</span>
    </>
  ) : (
    <>
      <SkipForward />
      <span>Skip</span>
    </>
  )}
</button>
```

### Speech Indicator
```tsx
{isSpeaking && (
  <div className="flex items-center gap-2 text-green-400">
    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
    <span>Speech detected</span>
  </div>
)}
```

## Analytics & Reporting

### Data Available for Analysis
- Which answers were auto-submitted vs manual
- Silence duration before each auto-submit
- Which questions were skipped
- Total skip count per session
- Correlation between auto-submits and answer quality
- User behavior patterns (skip vs auto-submit vs manual)

### Sample Queries
```sql
-- Get auto-submit rate
SELECT
  COUNT(*) FILTER (WHERE auto_submitted = true) * 100.0 / COUNT(*) as auto_submit_rate
FROM interview_responses;

-- Average silence before auto-submit
SELECT AVG(silence_duration) as avg_silence
FROM interview_responses
WHERE auto_submitted = true;

-- Most skipped questions
SELECT question_id, COUNT(*) as skip_count
FROM mock_interview_sessions, jsonb_array_elements(skipped_questions) as question_id
GROUP BY question_id
ORDER BY skip_count DESC;
```

## Benefits

### For Users
- **Natural flow**: No need to manually submit every answer
- **Reduced friction**: Automatic submission when done speaking
- **Clear feedback**: Visual countdown shows exactly when auto-submit happens
- **Control**: Can still manually submit or skip anytime
- **Clean interface**: Simplified header reduces distraction

### For Platform
- **Better data**: Track auto-submit vs manual patterns
- **Insights**: Identify difficult questions (high skip rate)
- **UX metrics**: Measure silence duration trends
- **Quality**: Correlate submission type with answer scores
- **Engagement**: Reduce user fatigue with skip option

## Accessibility

- Keyboard navigation supported
- Clear visual indicators for all states
- ARIA labels for screen readers
- High contrast colors for countdown warnings
- Progress bar provides visual feedback
- Text alternatives for all icons

## Browser Compatibility

- **Web Audio API**: Chrome 25+, Firefox 25+, Safari 14.1+
- **MediaRecorder**: Chrome 47+, Firefox 29+, Safari 14.1+
- **Speech Recognition**: Chrome 25+, Safari 14.1+

## Performance Considerations

- Audio analysis runs at 100ms intervals (10 FPS)
- Minimal CPU usage for frequency analysis
- Proper cleanup prevents memory leaks
- Intervals cleared on component unmount
- Audio context properly closed

## Future Enhancements

1. **Adjustable silence threshold** - User preference setting
2. **Visual volume meter** - Show real-time audio levels
3. **Pause countdown** - "Still thinking" button
4. **Smart detection** - AI-powered speech completion detection
5. **Analytics dashboard** - View auto-submit patterns
6. **A/B testing** - Compare different threshold values
7. **Accessibility mode** - Extended timers for special needs

## Testing Recommendations

1. Test with different microphone sensitivities
2. Verify countdown resets when speaking resumes
3. Check skip functionality with various network conditions
4. Validate database writes for all submission types
5. Test full-screen toggle behavior
6. Verify cleanup on component unmount
7. Test pause/resume with auto-submit active
8. Check violation tracking during auto-submit

## Troubleshooting

### Issue: Auto-submit not triggering
- Check microphone permissions
- Verify volumeThreshold is appropriate for mic
- Ensure Web Audio API is supported
- Check browser console for errors

### Issue: Countdown resets too quickly
- Adjust volumeThreshold to lower value (-60dB)
- Check for background noise interference
- Verify microphone noise suppression is enabled

### Issue: Skip button not working
- Check network connectivity
- Verify Supabase connection
- Check browser console for errors
- Ensure session ID is valid

## Code Quality

- TypeScript strict mode enabled
- Proper error handling throughout
- Resource cleanup in all code paths
- Defensive programming for edge cases
- Clear variable and function names
- Comprehensive comments
- Follows React best practices
