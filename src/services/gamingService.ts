import { supabase } from '../lib/supabaseClient';
import {
  GamingCompany,
  GameLevel,
  UserGameProgress,
  GameScore,
  LeaderboardEntry,
  GameSession,
  GridData,
  Position,
  ScoreCalculation,
  CompanyWithProgress,
  LevelWithProgress
} from '../types/gaming';

class GamingService {
  async getAllCompanies(): Promise<GamingCompany[]> {
    const { data, error } = await supabase
      .from('gaming_companies')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching gaming companies:', error);
      throw error;
    }

    return data || [];
  }

  async getCompanyById(companyId: string): Promise<GamingCompany | null> {
    const { data, error } = await supabase
      .from('gaming_companies')
      .select('*')
      .eq('id', companyId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching company:', error);
      throw error;
    }

    return data;
  }

  async getCompanyLevels(companyId: string): Promise<GameLevel[]> {
    const { data, error } = await supabase
      .from('game_levels')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('level_number', { ascending: true });

    if (error) {
      console.error('Error fetching company levels:', error);
      throw error;
    }

    return data || [];
  }

  async initializeCompanyProgress(userId: string, companyId: string): Promise<void> {
    const { error } = await supabase.rpc('initialize_company_progress', {
      p_user_id: userId,
      p_company_id: companyId
    });

    if (error) {
      console.error('Error initializing company progress:', error);
      throw error;
    }
  }

  async getUserProgress(userId: string, companyId: string): Promise<UserGameProgress[]> {
    const { data, error } = await supabase
      .from('user_game_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('company_id', companyId);

    if (error) {
      console.error('Error fetching user progress:', error);
      throw error;
    }

    return data || [];
  }

  async getUserProgressForLevel(userId: string, levelId: string): Promise<UserGameProgress | null> {
    const { data, error } = await supabase
      .from('user_game_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('level_id', levelId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user progress for level:', error);
      throw error;
    }

    return data;
  }

  async getCompanyWithProgress(userId: string, companyId: string): Promise<CompanyWithProgress | null> {
    const company = await this.getCompanyById(companyId);
    if (!company) return null;

    const levels = await this.getCompanyLevels(companyId);
    let userProgress = await this.getUserProgress(userId, companyId);

    if (userProgress.length === 0) {
      await this.initializeCompanyProgress(userId, companyId);
      userProgress = await this.getUserProgress(userId, companyId);
    }

    const levelsWithProgress: LevelWithProgress[] = levels.map(level => {
      const progress = userProgress.find(p => p.level_id === level.id) || null;
      return { level, progress };
    });

    const totalScore = userProgress.reduce((sum, p) => sum + (p.best_score || 0), 0);
    const completedLevels = userProgress.filter(p => p.is_completed).length;

    return {
      company,
      levels: levelsWithProgress,
      totalScore,
      completedLevels,
      totalLevels: levels.length
    };
  }

  async getAllCompaniesWithProgress(userId: string): Promise<CompanyWithProgress[]> {
    const companies = await this.getAllCompanies();
    const companiesWithProgress: CompanyWithProgress[] = [];

    for (const company of companies) {
      const companyProgress = await this.getCompanyWithProgress(userId, company.id);
      if (companyProgress) {
        companiesWithProgress.push(companyProgress);
      }
    }

    return companiesWithProgress;
  }

  async createGameSession(
    userId: string,
    levelId: string,
    gridData: GridData
  ): Promise<GameSession> {
    const level = await this.getLevelById(levelId);
    if (!level) throw new Error('Level not found');

    const startTime = new Date();
    const expectedEndTime = new Date(startTime.getTime() + level.time_limit_seconds * 1000);

    const { data, error } = await supabase
      .from('game_sessions')
      .insert({
        user_id: userId,
        level_id: levelId,
        grid_data: gridData,
        start_time: startTime.toISOString(),
        expected_end_time: expectedEndTime.toISOString(),
        is_active: true,
        is_validated: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating game session:', error);
      throw error;
    }

    return data;
  }

  async getLevelById(levelId: string): Promise<GameLevel | null> {
    const { data, error } = await supabase
      .from('game_levels')
      .select('*')
      .eq('id', levelId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching level:', error);
      throw error;
    }

    return data;
  }

  calculateScore(
    completionTimeSeconds: number,
    pathLength: number,
    optimalPathLength: number,
    timeLimitSeconds: number,
    difficultyModifier: number
  ): ScoreCalculation {
    const baseScore = 1000;

    const timePercentageRemaining = Math.max(0, (timeLimitSeconds - completionTimeSeconds) / timeLimitSeconds);
    const timeBonus = Math.floor(baseScore * 0.5 * timePercentageRemaining);

    const efficiency = Math.min(100, (optimalPathLength / pathLength) * 100);
    const efficiencyBonus = Math.floor(baseScore * 0.3 * (efficiency / 100));

    const rawScore = baseScore + timeBonus + efficiencyBonus;
    const finalScore = Math.floor(rawScore * difficultyModifier);

    return {
      baseScore,
      timeBonus,
      efficiencyBonus,
      difficultyMultiplier: difficultyModifier,
      finalScore,
      efficiency
    };
  }

  async submitScore(
    userId: string,
    companyId: string,
    levelId: string,
    sessionId: string,
    completionTimeSeconds: number,
    pathLength: number,
    optimalPathLength: number
  ): Promise<GameScore> {
    const company = await this.getCompanyById(companyId);
    const level = await this.getLevelById(levelId);

    if (!company || !level) {
      throw new Error('Company or level not found');
    }

    const scoreCalc = this.calculateScore(
      completionTimeSeconds,
      pathLength,
      optimalPathLength,
      level.time_limit_seconds,
      company.difficulty_modifier
    );

    const { data: scoreData, error: scoreError } = await supabase
      .from('game_scores')
      .insert({
        user_id: userId,
        company_id: companyId,
        level_id: levelId,
        session_id: sessionId,
        score: scoreCalc.finalScore,
        completion_time_seconds: completionTimeSeconds,
        path_length: pathLength,
        optimal_path_length: optimalPathLength,
        efficiency_percentage: scoreCalc.efficiency,
        is_valid: true
      })
      .select()
      .single();

    if (scoreError) {
      console.error('Error submitting score:', scoreError);
      throw scoreError;
    }

    const progress = await this.getUserProgressForLevel(userId, levelId);
    const isNewBest = !progress || !progress.best_score || scoreCalc.finalScore > progress.best_score;

    await supabase
      .from('user_game_progress')
      .update({
        is_completed: true,
        best_score: isNewBest ? scoreCalc.finalScore : progress?.best_score,
        best_time_seconds: isNewBest ? completionTimeSeconds : progress?.best_time_seconds,
        attempts_count: (progress?.attempts_count || 0) + 1,
        first_completed_at: progress?.first_completed_at || new Date().toISOString(),
        last_played_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('level_id', levelId);

    if (scoreCalc.finalScore >= level.target_score) {
      await supabase.rpc('unlock_next_level', {
        p_user_id: userId,
        p_company_id: companyId,
        p_current_level_number: level.level_number
      });
    }

    await supabase.rpc('update_leaderboards_after_score', {
      p_user_id: userId,
      p_company_id: companyId,
      p_level_id: levelId,
      p_score: scoreCalc.finalScore
    });

    return scoreData;
  }

  async getLeaderboard(
    companyId?: string,
    levelId?: string,
    period: 'all_time' | 'monthly' | 'weekly' = 'all_time',
    limit: number = 10
  ): Promise<LeaderboardEntry[]> {
    let query = supabase
      .from('leaderboards')
      .select(`
        *,
        user_profiles!inner(full_name)
      `)
      .eq('period', period)
      .order('total_score', { ascending: false })
      .limit(limit);

    if (companyId) {
      query = query.eq('company_id', companyId);
    } else {
      query = query.is('company_id', null);
    }

    if (levelId) {
      query = query.eq('level_id', levelId);
    } else {
      query = query.is('level_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching leaderboard:', error);
      throw error;
    }

    return (data || []).map((entry: any) => ({
      ...entry,
      user_name: entry.user_profiles?.full_name || 'Anonymous'
    }));
  }

  async getUserRank(userId: string, companyId?: string): Promise<number | null> {
    const { data, error } = await supabase
      .from('leaderboards')
      .select('rank')
      .eq('user_id', userId)
      .eq('period', 'all_time')
      .is('level_id', null)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user rank:', error);
      return null;
    }

    return data?.rank || null;
  }

  generateGrid(
    gridSize: number,
    obstacleDensity: number
  ): GridData {
    const grid: ('empty' | 'obstacle')[][] = Array(gridSize)
      .fill(null)
      .map(() => Array(gridSize).fill('empty'));

    const start: Position = { row: 0, col: 0 };
    const end: Position = { row: gridSize - 1, col: gridSize - 1 };

    grid[start.row][start.col] = 'empty';
    grid[end.row][end.col] = 'empty';

    const totalCells = gridSize * gridSize;
    const obstacleCount = Math.floor(totalCells * obstacleDensity);
    const obstacles: Position[] = [];

    let placedObstacles = 0;
    let attempts = 0;
    const maxAttempts = obstacleCount * 10;

    while (placedObstacles < obstacleCount && attempts < maxAttempts) {
      attempts++;
      const row = Math.floor(Math.random() * gridSize);
      const col = Math.floor(Math.random() * gridSize);

      if (
        (row === start.row && col === start.col) ||
        (row === end.row && col === end.col) ||
        grid[row][col] === 'obstacle'
      ) {
        continue;
      }

      grid[row][col] = 'obstacle';
      obstacles.push({ row, col });

      if (this.hasValidPath(grid, start, end, gridSize)) {
        placedObstacles++;
      } else {
        grid[row][col] = 'empty';
        obstacles.pop();
      }
    }

    const optimalPathLength = this.findOptimalPathLength(grid, start, end, gridSize);

    return {
      grid,
      start,
      end,
      obstacles,
      optimalPathLength
    };
  }

  private hasValidPath(
    grid: ('empty' | 'obstacle')[][],
    start: Position,
    end: Position,
    gridSize: number
  ): boolean {
    const visited = Array(gridSize)
      .fill(null)
      .map(() => Array(gridSize).fill(false));

    const queue: Position[] = [start];
    visited[start.row][start.col] = true;

    const directions = [
      { row: -1, col: 0 },
      { row: 1, col: 0 },
      { row: 0, col: -1 },
      { row: 0, col: 1 }
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.row === end.row && current.col === end.col) {
        return true;
      }

      for (const dir of directions) {
        const newRow = current.row + dir.row;
        const newCol = current.col + dir.col;

        if (
          newRow >= 0 &&
          newRow < gridSize &&
          newCol >= 0 &&
          newCol < gridSize &&
          !visited[newRow][newCol] &&
          grid[newRow][newCol] !== 'obstacle'
        ) {
          visited[newRow][newCol] = true;
          queue.push({ row: newRow, col: newCol });
        }
      }
    }

    return false;
  }

  private findOptimalPathLength(
    grid: ('empty' | 'obstacle')[][],
    start: Position,
    end: Position,
    gridSize: number
  ): number {
    const distances = Array(gridSize)
      .fill(null)
      .map(() => Array(gridSize).fill(Infinity));

    const queue: Position[] = [start];
    distances[start.row][start.col] = 0;

    const directions = [
      { row: -1, col: 0 },
      { row: 1, col: 0 },
      { row: 0, col: -1 },
      { row: 0, col: 1 }
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentDist = distances[current.row][current.col];

      if (current.row === end.row && current.col === end.col) {
        return currentDist + 1;
      }

      for (const dir of directions) {
        const newRow = current.row + dir.row;
        const newCol = current.col + dir.col;

        if (
          newRow >= 0 &&
          newRow < gridSize &&
          newCol >= 0 &&
          newCol < gridSize &&
          grid[newRow][newCol] !== 'obstacle' &&
          distances[newRow][newCol] === Infinity
        ) {
          distances[newRow][newCol] = currentDist + 1;
          queue.push({ row: newRow, col: newCol });
        }
      }
    }

    return gridSize * gridSize;
  }
}

export const gamingService = new GamingService();
