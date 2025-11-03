import { DifficultyLevel, AdaptiveDifficultyConfig, BubbleSelectionQuestion, OperationType } from '../types/bubbleSelection';

class AdaptiveDifficultyService {
  getDifficultyForQuestion(
    questionNumber: number,
    previousQuestions: BubbleSelectionQuestion[]
  ): AdaptiveDifficultyConfig {
    const sectionNumber = Math.ceil(questionNumber / 2);
    let difficultyLevel: DifficultyLevel;
    const bubbleCount: number = 3; // Always 3 bubbles
    let timeLimit: number = 14; // 14 seconds for all questions
    let allowDecimals: boolean;
    let operationTypes: OperationType[];
    let valueRange: { min: number; max: number };

    const recentAccuracy = this.calculateRecentAccuracy(previousQuestions, 3);

    // Questions 1-8: Easy difficulty
    if (questionNumber <= 8) {
      difficultyLevel = 'easy';
      allowDecimals = false;
      operationTypes = questionNumber <= 4 ? ['addition'] : ['addition', 'subtraction'];
      valueRange = { min: 1, max: 15 };
    } 
    // Questions 9-16: Medium difficulty (add multiplication and division)
    else if (questionNumber <= 16) {
      difficultyLevel = 'medium';
      allowDecimals = questionNumber > 12;
      
      if (questionNumber <= 12) {
        operationTypes = ['addition', 'subtraction', 'multiplication'];
      } else {
        operationTypes = ['multiplication', 'division', 'addition', 'subtraction'];
      }
      
      valueRange = { min: 2, max: 20 };

      // Adaptive adjustment
      if (recentAccuracy < 50 && questionNumber > 10) {
        allowDecimals = false;
        operationTypes = ['addition', 'subtraction', 'multiplication'];
      }
    } 
    // Questions 17-24: Hard difficulty (complex operations, decimals, square roots)
    else {
      difficultyLevel = 'hard';
      allowDecimals = true;
      operationTypes = ['multiplication', 'division', 'mixed'];
      valueRange = { min: 2, max: 25 };
      
      // Extra time for very complex questions
      if (questionNumber >= 22) {
        timeLimit = 16;
      }

      // Adaptive adjustment
      if (recentAccuracy < 40) {
        difficultyLevel = 'medium';
        operationTypes = ['multiplication', 'division', 'addition'];
        allowDecimals = false;
      }
    }

    // Boost difficulty if performing exceptionally well
    if (recentAccuracy > 90 && questionNumber > 8) {
      if (difficultyLevel === 'easy') {
        difficultyLevel = 'medium';
      } else if (difficultyLevel === 'medium' && questionNumber > 12) {
        difficultyLevel = 'hard';
        allowDecimals = true;
      }
    }

    return {
      sectionNumber,
      questionNumber,
      difficultyLevel,
      bubbleCount,
      timeLimit,
      allowDecimals,
      operationTypes,
      valueRange
    };
  }

  private calculateRecentAccuracy(
    questions: BubbleSelectionQuestion[],
    count: number
  ): number {
    if (questions.length === 0) return 100;

    const recentQuestions = questions.slice(-count);
    const correctCount = recentQuestions.filter(q => q.is_correct).length;

    return (correctCount / recentQuestions.length) * 100;
  }

  getSectionDescription(sectionNumber: number): string {
    if (sectionNumber <= 4) {
      return 'Warm-up: Basic addition and subtraction';
    } else if (sectionNumber <= 8) {
      return 'Building: Multiplication enters the game';
    } else if (sectionNumber <= 10) {
      return 'Challenge: Division and decimals';
    } else if (sectionNumber <= 12) {
      return 'Advanced: Complex mixed operations';
    } else {
      return 'Expert: Master level with square roots';
    }
  }

  getProgressPercentage(questionNumber: number, totalQuestions: number = 24): number {
    return Math.round((questionNumber / totalQuestions) * 100);
  }

  shouldShowEncouragement(
    questionNumber: number,
    correctAnswers: number
  ): { show: boolean; message: string } {
    const accuracy = (correctAnswers / questionNumber) * 100;

    if (questionNumber === 8 && accuracy >= 75) {
      return {
        show: true,
        message: 'Excellent start! You\'re crushing it!'
      };
    }

    if (questionNumber === 16 && accuracy >= 70) {
      return {
        show: true,
        message: 'Amazing progress! Keep it up!'
      };
    }

    if (questionNumber === 24) {
      if (accuracy >= 90) {
        return {
          show: true,
          message: 'Outstanding performance! You\'re a math wizard!'
        };
      } else if (accuracy >= 70) {
        return {
          show: true,
          message: 'Great job! You completed all questions!'
        };
      } else {
        return {
          show: true,
          message: 'Well done! Practice makes perfect!'
        };
      }
    }

    return { show: false, message: '' };
  }

  getPerformanceRating(accuracy: number, averageTime: number): {
    rating: string;
    color: string;
    message: string;
  } {
    if (accuracy >= 90 && averageTime <= 8) {
      return {
        rating: 'Exceptional',
        color: 'text-yellow-600',
        message: 'You have outstanding mental math skills!'
      };
    } else if (accuracy >= 80 && averageTime <= 10) {
      return {
        rating: 'Excellent',
        color: 'text-green-600',
        message: 'You performed exceptionally well!'
      };
    } else if (accuracy >= 70 && averageTime <= 12) {
      return {
        rating: 'Very Good',
        color: 'text-blue-600',
        message: 'Great job! Your skills are impressive!'
      };
    } else if (accuracy >= 60) {
      return {
        rating: 'Good',
        color: 'text-indigo-600',
        message: 'Well done! Keep practicing to improve further.'
      };
    } else {
      return {
        rating: 'Needs Practice',
        color: 'text-gray-600',
        message: 'Keep practicing! You\'ll improve with time.'
      };
    }
  }
}

export const adaptiveDifficultyService = new AdaptiveDifficultyService();
