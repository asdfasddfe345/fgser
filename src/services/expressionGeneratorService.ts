import { MathematicalExpression, DifficultyLevel, OperationType } from '../types/bubbleSelection';

interface GeneratorConfig {
  difficultyLevel: DifficultyLevel;
  allowDecimals: boolean;
  operationTypes: OperationType[];
  valueRange: { min: number; max: number };
  count: number;
}

class ExpressionGeneratorService {
  private generateId(): string {
    return `expr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private getRandomDecimal(min: number, max: number, decimals: number = 1): number {
    const value = Math.random() * (max - min) + min;
    return Number(value.toFixed(decimals));
  }

  private getRandomOperation(types: OperationType[]): OperationType {
    if (types.includes('mixed')) {
      const ops: OperationType[] = ['addition', 'subtraction', 'multiplication', 'division'];
      return ops[Math.floor(Math.random() * ops.length)];
    }
    return types[Math.floor(Math.random() * types.length)];
  }

  private generateSquareRoot(config: GeneratorConfig): MathematicalExpression {
    // Generate perfect squares for clean results
    const perfectSquares = [4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144, 169, 196, 225];
    const base = perfectSquares[Math.floor(Math.random() * perfectSquares.length)];
    const result = Math.sqrt(base);
    
    return {
      id: this.generateId(),
      expression: `√${base}`,
      result,
      operationType: 'mixed',
      hasDecimals: false,
      complexityScore: 6
    };
  }

  private generateAddition(config: GeneratorConfig): MathematicalExpression {
    const hasDecimals = config.allowDecimals && Math.random() > 0.5;

    if (hasDecimals) {
      const a = this.getRandomDecimal(config.valueRange.min, config.valueRange.max);
      const b = this.getRandomDecimal(config.valueRange.min, config.valueRange.max);
      const result = Number((a + b).toFixed(1));
      return {
        id: this.generateId(),
        expression: `${a}+${b}`,
        result,
        operationType: 'addition',
        hasDecimals: true,
        complexityScore: 4
      };
    } else {
      const a = this.getRandomInt(config.valueRange.min, config.valueRange.max);
      const b = this.getRandomInt(config.valueRange.min, config.valueRange.max);
      const result = a + b;
      return {
        id: this.generateId(),
        expression: `${a}+${b}`,
        result,
        operationType: 'addition',
        hasDecimals: false,
        complexityScore: 2
      };
    }
  }

  private generateSubtraction(config: GeneratorConfig): MathematicalExpression {
    const hasDecimals = config.allowDecimals && Math.random() > 0.5;

    if (hasDecimals) {
      const a = this.getRandomDecimal(config.valueRange.min, config.valueRange.max);
      const b = this.getRandomDecimal(config.valueRange.min, Math.min(a, config.valueRange.max));
      const result = Number((a - b).toFixed(1));
      return {
        id: this.generateId(),
        expression: `${a}-${b}`,
        result,
        operationType: 'subtraction',
        hasDecimals: true,
        complexityScore: 5
      };
    } else {
      const a = this.getRandomInt(config.valueRange.min, config.valueRange.max);
      const b = this.getRandomInt(config.valueRange.min, a);
      const result = a - b;
      return {
        id: this.generateId(),
        expression: `${a}-${b}`,
        result,
        operationType: 'subtraction',
        hasDecimals: false,
        complexityScore: 3
      };
    }
  }

  private generateMultiplication(config: GeneratorConfig): MathematicalExpression {
    const hasDecimals = config.allowDecimals && Math.random() > 0.6;

    if (hasDecimals) {
      const a = this.getRandomDecimal(2, 6, 1);
      const b = this.getRandomDecimal(1, 4, 1);
      const result = Number((a * b).toFixed(1));
      return {
        id: this.generateId(),
        expression: `${a}×${b}`,
        result,
        operationType: 'multiplication',
        hasDecimals: true,
        complexityScore: 7
      };
    } else {
      const a = this.getRandomInt(2, 12);
      const b = this.getRandomInt(2, 12);
      const result = a * b;
      return {
        id: this.generateId(),
        expression: `${a}×${b}`,
        result,
        operationType: 'multiplication',
        hasDecimals: false,
        complexityScore: 5
      };
    }
  }

  private generateDivision(config: GeneratorConfig): MathematicalExpression {
    const hasDecimals = config.allowDecimals && Math.random() > 0.5;

    if (hasDecimals) {
      const divisor = this.getRandomDecimal(1.5, 4.5, 1);
      const result = this.getRandomDecimal(2, 8, 1);
      const dividend = Number((divisor * result).toFixed(1));
      return {
        id: this.generateId(),
        expression: `${dividend}÷${divisor}`,
        result: Number(result.toFixed(1)),
        operationType: 'division',
        hasDecimals: true,
        complexityScore: 8
      };
    } else {
      const divisor = this.getRandomInt(2, 12);
      const result = this.getRandomInt(2, 12);
      const dividend = divisor * result;
      return {
        id: this.generateId(),
        expression: `${dividend}÷${divisor}`,
        result,
        operationType: 'division',
        hasDecimals: false,
        complexityScore: 6
      };
    }
  }

  private generateMixed(config: GeneratorConfig): MathematicalExpression {
    const hasDecimals = config.allowDecimals && Math.random() > 0.5;
    const mixedType = Math.floor(Math.random() * 3);

    if (hasDecimals) {
      if (mixedType === 0) {
        // (a+b)×c
        const a = this.getRandomDecimal(1, 5, 1);
        const b = this.getRandomDecimal(1, 3, 1);
        const c = this.getRandomDecimal(1.5, 3, 1);
        const intermediate = Number((a + b).toFixed(1));
        const result = Number((intermediate * c).toFixed(1));
        return {
          id: this.generateId(),
          expression: `(${a}+${b})×${c}`,
          result,
          operationType: 'mixed',
          hasDecimals: true,
          complexityScore: 9
        };
      } else if (mixedType === 1) {
        // a×b-c
        const a = this.getRandomDecimal(2, 4, 1);
        const b = this.getRandomDecimal(2, 4, 1);
        const product = Number((a * b).toFixed(1));
        const c = this.getRandomDecimal(1, product - 1, 1);
        const result = Number((product - c).toFixed(1));
        return {
          id: this.generateId(),
          expression: `${a}×${b}-${c}`,
          result,
          operationType: 'mixed',
          hasDecimals: true,
          complexityScore: 10
        };
      } else {
        // a÷b+c
        const b = this.getRandomDecimal(2, 4, 1);
        const quotient = this.getRandomDecimal(3, 6, 1);
        const a = Number((b * quotient).toFixed(1));
        const c = this.getRandomDecimal(1, 5, 1);
        const result = Number((quotient + c).toFixed(1));
        return {
          id: this.generateId(),
          expression: `${a}÷${b}+${c}`,
          result,
          operationType: 'mixed',
          hasDecimals: true,
          complexityScore: 11
        };
      }
    } else {
      if (mixedType === 0) {
        // (a+b)×c
        const a = this.getRandomInt(2, 8);
        const b = this.getRandomInt(2, 8);
        const c = this.getRandomInt(2, 5);
        const intermediate = a + b;
        const result = intermediate * c;
        return {
          id: this.generateId(),
          expression: `(${a}+${b})×${c}`,
          result,
          operationType: 'mixed',
          hasDecimals: false,
          complexityScore: 7
        };
      } else if (mixedType === 1) {
        // a×b-c
        const a = this.getRandomInt(3, 8);
        const b = this.getRandomInt(3, 8);
        const product = a * b;
        const c = this.getRandomInt(5, product - 5);
        const result = product - c;
        return {
          id: this.generateId(),
          expression: `${a}×${b}-${c}`,
          result,
          operationType: 'mixed',
          hasDecimals: false,
          complexityScore: 8
        };
      } else {
        // a÷b+c
        const b = this.getRandomInt(3, 6);
        const quotient = this.getRandomInt(4, 10);
        const a = b * quotient;
        const c = this.getRandomInt(2, 8);
        const result = quotient + c;
        return {
          id: this.generateId(),
          expression: `${a}÷${b}+${c}`,
          result,
          operationType: 'mixed',
          hasDecimals: false,
          complexityScore: 9
        };
      }
    }
  }

  private generateExpression(config: GeneratorConfig, includeSquareRoot: boolean = false): MathematicalExpression {
    // Add square root option for hard difficulty
    if (includeSquareRoot && Math.random() > 0.7) {
      return this.generateSquareRoot(config);
    }

    const operation = this.getRandomOperation(config.operationTypes);

    switch (operation) {
      case 'addition':
        return this.generateAddition(config);
      case 'subtraction':
        return this.generateSubtraction(config);
      case 'multiplication':
        return this.generateMultiplication(config);
      case 'division':
        return this.generateDivision(config);
      case 'mixed':
        return this.generateMixed(config);
      default:
        return this.generateAddition(config);
    }
  }

  generateExpressions(config: GeneratorConfig, includeSquareRoot: boolean = false): MathematicalExpression[] {
    const expressions: MathematicalExpression[] = [];
    const usedResults = new Set<number>();
    let attempts = 0;
    const maxAttempts = config.count * 30;

    while (expressions.length < config.count && attempts < maxAttempts) {
      attempts++;
      const expr = this.generateExpression(config, includeSquareRoot);

      // Ensure unique results with some tolerance for decimals
      const resultKey = Math.round(expr.result * 10);
      if (!usedResults.has(resultKey)) {
        expressions.push(expr);
        usedResults.add(resultKey);
      }
    }

    if (expressions.length < config.count) {
      while (expressions.length < config.count) {
        const expr = this.generateExpression(config, includeSquareRoot);
        expressions.push(expr);
      }
    }

    return expressions;
  }

  generateQuestionSet(
    questionNumber: number,
    sectionNumber: number,
    difficultyLevel: DifficultyLevel,
    bubbleCount: number = 3
  ): MathematicalExpression[] {
    let config: GeneratorConfig;
    let includeSquareRoot = false;

    // Questions 1-8: Easy
    if (questionNumber <= 8) {
      config = {
        difficultyLevel: 'easy',
        allowDecimals: false,
        operationTypes: questionNumber <= 4 ? ['addition'] : ['addition', 'subtraction'],
        valueRange: { min: 1, max: 15 },
        count: 3
      };
    }
    // Questions 9-16: Medium (add multiplication)
    else if (questionNumber <= 16) {
      config = {
        difficultyLevel: 'medium',
        allowDecimals: questionNumber > 12,
        operationTypes: questionNumber <= 12 
          ? ['addition', 'subtraction', 'multiplication']
          : ['multiplication', 'division', 'addition'],
        valueRange: { min: 2, max: 20 },
        count: 3
      };
    }
    // Questions 17-24: Hard (all operations including square roots)
    else {
      config = {
        difficultyLevel: 'hard',
        allowDecimals: true,
        operationTypes: ['mixed', 'multiplication', 'division'],
        valueRange: { min: 2, max: 25 },
        count: 3
      };
      includeSquareRoot = questionNumber >= 20;
    }

    return this.generateExpressions(config, includeSquareRoot);
  }
}

export const expressionGeneratorService = new ExpressionGeneratorService();
