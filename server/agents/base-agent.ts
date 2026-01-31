/**
 * Base Agent - Foundation for all trading swarm agents
 */

import { EventEmitter } from 'events';
import { saveAgentState, loadAgentState, type AgentStateData } from '../services/state';

export type AgentStatus = 'idle' | 'analyzing' | 'executing' | 'error' | 'disabled';

export interface AgentLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
}

export interface AgentConfig {
  id: string;
  name: string;
  enabled: boolean;
  intervalMs: number;
  maxRetries: number;
  timeoutMs: number;
}

export interface AgentMetrics {
  lastRunAt: Date | null;
  successCount: number;
  errorCount: number;
  avgExecutionTimeMs: number;
  lastError: string | null;
}

export abstract class BaseAgent extends EventEmitter {
  protected config: AgentConfig;
  protected status: AgentStatus = 'idle';
  protected logs: AgentLog[] = [];
  protected metrics: AgentMetrics = {
    lastRunAt: null,
    successCount: 0,
    errorCount: 0,
    avgExecutionTimeMs: 0,
    lastError: null,
  };
  protected intervalHandle: NodeJS.Timeout | null = null;
  protected maxLogSize = 1000;

  constructor(config: Partial<AgentConfig> & { id: string; name: string }) {
    super();
    this.config = {
      enabled: true,
      intervalMs: 60000, // 1 minute default
      maxRetries: 3,
      timeoutMs: 30000,
      ...config,
    };
  }

  // ============ LIFECYCLE ============

  start(): void {
    if (!this.config.enabled) {
      this.log('warn', `Agent ${this.config.name} is disabled`);
      return;
    }

    this.log('info', `Starting agent: ${this.config.name}`);

    // Run immediately, then on interval
    this.tick();

    this.intervalHandle = setInterval(() => {
      this.tick();
    }, this.config.intervalMs);
  }

  stop(): void {
    this.log('info', `Stopping agent: ${this.config.name}`);

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    this.status = 'idle';
  }

  async tick(): Promise<void> {
    if (this.status === 'analyzing' || this.status === 'executing') {
      this.log('debug', 'Agent is busy, skipping tick');
      return;
    }

    const startTime = Date.now();
    this.status = 'analyzing';

    try {
      await this.execute();
      this.metrics.successCount++;
      this.metrics.lastError = null;
    } catch (error) {
      this.metrics.errorCount++;
      this.metrics.lastError = error instanceof Error ? error.message : String(error);
      this.log('error', `Agent execution failed: ${this.metrics.lastError}`);
      this.status = 'error';
      this.emit('error', error);
      return;
    }

    const executionTime = Date.now() - startTime;
    this.updateAvgExecutionTime(executionTime);
    this.metrics.lastRunAt = new Date();
    this.status = 'idle';

    // Persist state after successful tick
    await this.persistAfterTick();
  }

  // ============ ABSTRACT METHODS ============

  abstract execute(): Promise<void>;

  abstract getType(): string;

  // ============ STATE & CONFIG ============

  getStatus(): AgentStatus {
    return this.status;
  }

  getConfig(): AgentConfig {
    return { ...this.config };
  }

  getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  getLogs(limit = 100): AgentLog[] {
    return this.logs.slice(-limit);
  }

  enable(): void {
    this.config.enabled = true;
    this.log('info', 'Agent enabled');
    this.emit('enabled');
  }

  disable(): void {
    this.config.enabled = false;
    this.stop();
    this.status = 'disabled';
    this.log('info', 'Agent disabled');
    this.emit('disabled');
  }

  updateConfig(updates: Partial<AgentConfig>): void {
    const wasRunning = this.intervalHandle !== null;

    if (wasRunning) {
      this.stop();
    }

    this.config = { ...this.config, ...updates };
    this.log('info', 'Config updated', updates);

    if (wasRunning && this.config.enabled) {
      this.start();
    }
  }

  // ============ LOGGING ============

  protected log(level: AgentLog['level'], message: string, data?: any): void {
    const log: AgentLog = {
      timestamp: new Date(),
      level,
      message,
      data,
    };

    this.logs.push(log);

    // Trim logs if too many
    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize);
    }

    this.emit('log', log);

    // Console output for development
    const prefix = `[${this.config.name}]`;
    switch (level) {
      case 'error':
        console.error(prefix, message, data || '');
        break;
      case 'warn':
        console.warn(prefix, message, data || '');
        break;
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.debug(prefix, message, data || '');
        }
        break;
      default:
        console.log(prefix, message, data || '');
    }
  }

  private updateAvgExecutionTime(newTime: number): void {
    const totalRuns = this.metrics.successCount + this.metrics.errorCount;
    if (totalRuns === 0) {
      this.metrics.avgExecutionTimeMs = newTime;
    } else {
      this.metrics.avgExecutionTimeMs =
        (this.metrics.avgExecutionTimeMs * (totalRuns - 1) + newTime) / totalRuns;
    }
  }

  // ============ SERIALIZATION ============

  toJSON() {
    return {
      id: this.config.id,
      name: this.config.name,
      type: this.getType(),
      status: this.status,
      config: this.config,
      metrics: this.metrics,
    };
  }

  // ============ STATE PERSISTENCE ============

  /**
   * Get agent-specific state for persistence (override in subclasses)
   */
  protected getAgentSpecificState(): any {
    return {};
  }

  /**
   * Restore agent-specific state from persistence (override in subclasses)
   */
  protected restoreAgentSpecificState(state: any): void {
    // Override in subclasses
  }

  /**
   * Save current state to database
   */
  async saveState(): Promise<void> {
    try {
      await saveAgentState({
        agentId: this.config.id,
        enabled: this.config.enabled,
        status: this.status,
        config: this.config,
        metrics: this.metrics,
        state: this.getAgentSpecificState(),
        lastRunAt: this.metrics.lastRunAt,
      });
    } catch (error) {
      this.log('error', 'Failed to save agent state', error);
    }
  }

  /**
   * Load state from database
   */
  async loadState(): Promise<boolean> {
    try {
      const state = await loadAgentState(this.config.id);
      
      if (!state) {
        this.log('debug', 'No saved state found');
        return false;
      }

      // Restore config (merge with defaults)
      if (state.config) {
        this.config = { ...this.config, ...state.config };
      }

      // Restore metrics
      if (state.metrics) {
        this.metrics = { ...this.metrics, ...state.metrics };
      }

      // Restore agent-specific state
      if (state.state) {
        this.restoreAgentSpecificState(state.state);
      }

      this.log('info', 'State restored from database');
      return true;
    } catch (error) {
      this.log('error', 'Failed to load agent state', error);
      return false;
    }
  }

  /**
   * Persist state after each tick
   */
  protected async persistAfterTick(): Promise<void> {
    await this.saveState();
  }
}
