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
    const hasDecimals = config.allowDecimals && Math.random() > 0.5;

    if (hasDecimals) {
      const a = this.getRandomDecimal(2, 5);
      const b = this.getRandomDecimal(1, 3);
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
      const a = this.getRandomInt(2, 10);
      const b = this.getRandomInt(2, 10);
      const result = a * b;
      return {
        id: this.generateId(),
        expression: `${a}×${b}`,
        result,
        operationType: 'multiplication',
        hasDecimals: false,
        complexityScore: 4
      };
    }
  }

  private generateDivision(config: GeneratorConfig): MathematicalExpression {
    const hasDecimals = config.allowDecimals && Math.random() > 0.5;

    if (hasDecimals) {
      const divisor = this.getRandomDecimal(1.5, 3.5);
      const result = this.getRandomDecimal(1, 5);
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
      const divisor = this.getRandomInt(2, 10);
      const result = this.getRandomInt(1, 10);
      const dividend = divisor * result;
      return {
        id: this.generateId(),
        expression: `${dividend}÷${divisor}`,
        result,
        operationType: 'division',
        hasDecimals: false,
        complexityScore: 5
      };
    }
  }

  private generateMixed(config: GeneratorConfig): MathematicalExpression {
    const hasDecimals = config.allowDecimals && Math.random() > 0.5;

    if (hasDecimals) {
      const a = this.getRandomDecimal(1, 5);
      const b = this.getRandomDecimal(1, 3);
      const c = this.getRandomDecimal(0.5, 2);
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
    } else {
      const a = this.getRandomInt(1, 10);
      const b = this.getRandomInt(1, 10);
      const c = this.getRandomInt(2, 5);
      const intermediate = a + b;
      const result = intermediate * c;
      return {
        id: this.generateId(),
        expression: `(${a}+${b})×${c}`,
        result,
        operationType: 'mixed',
        hasDecimals: false,
        complexityScore: 6
      };
    }
  }

  private generateExpression(config: GeneratorConfig): MathematicalExpression {
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

  generateExpressions(config: GeneratorConfig): MathematicalExpression[] {
    const expressions: MathematicalExpression[] = [];
    const usedResults = new Set<number>();
    let attempts = 0;
    const maxAttempts = config.count * 20;

    while (expressions.length < config.count && attempts < maxAttempts) {
      attempts++;
      const expr = this.generateExpression(config);

      if (!usedResults.has(expr.result)) {
        expressions.push(expr);
        usedResults.add(expr.result);
      }
    }

    if (expressions.length < config.count) {
      while (expressions.length < config.count) {
        const expr = this.generateExpression(config);
        expressions.push(expr);
      }
    }

    return expressions;
  }

  generateQuestionSet(
    questionNumber: number,
    sectionNumber: number,
    difficultyLevel: DifficultyLevel,
    bubbleCount: number = 4
  ): MathematicalExpression[] {
    let config: GeneratorConfig;

    switch (difficultyLevel) {
      case 'easy':
        config = {
          difficultyLevel: 'easy',
          allowDecimals: false,
          operationTypes: questionNumber <= 4 ? ['addition'] : ['addition', 'subtraction'],
          valueRange: { min: 1, max: 10 },
          count: bubbleCount
        };
        break;

      case 'medium':
        config = {
          difficultyLevel: 'medium',
          allowDecimals: questionNumber > 12,
          operationTypes: ['addition', 'subtraction', 'multiplication'],
          valueRange: { min: 1, max: 15 },
          count: bubbleCount
        };
        break;

      case 'hard':
        config = {
          difficultyLevel: 'hard',
          allowDecimals: true,
          operationTypes: ['mixed', 'multiplication', 'division'],
          valueRange: { min: 1, max: 20 },
          count: bubbleCount
        };
        break;

      default:
        config = {
          difficultyLevel: 'easy',
          allowDecimals: false,
          operationTypes: ['addition'],
          valueRange: { min: 1, max: 10 },
          count: bubbleCount
        };
    }

    return this.generateExpressions(config);
  }
}

export const expressionGeneratorService = new ExpressionGeneratorService();
