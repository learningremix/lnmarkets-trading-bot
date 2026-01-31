/**
 * Base Agent - Foundation for all trading swarm agents
 */

import { EventEmitter } from 'events';
import { saveAgentState, loadAgentState, type AgentStateData } from '../services/state';
import { getMessageBus, type MessageBus, type AgentMessage } from './message-bus';
import { aiService } from '../services/ai';

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
  protected messageBus: MessageBus;

  constructor(config: Partial<AgentConfig> & { id: string; name: string }) {
    super();
    this.config = {
      enabled: true,
      intervalMs: 60000, // 1 minute default
      maxRetries: 3,
      timeoutMs: 30000,
      ...config,
    };
    this.messageBus = getMessageBus();
    this.setupMessageHandlers();
  }

  // ============ MESSAGE BUS INTEGRATION ============

  private setupMessageHandlers(): void {
    // Listen for messages directed to this agent
    this.messageBus.on(`message:${this.config.id}`, (msg: AgentMessage) => {
      this.handleMessage(msg).catch(err => {
        this.log('error', 'Failed to handle message', err);
      });
    });

    // Listen for vote requests
    this.messageBus.on('type:vote', (msg: AgentMessage) => {
      if (msg.content?.action === 'request_vote') {
        this.handleVoteRequest(msg).catch(err => {
          this.log('error', 'Failed to handle vote request', err);
        });
      }
    });

    // Listen for chat messages
    this.messageBus.on('type:chat', (msg: AgentMessage) => {
      const targets = msg.to ? (Array.isArray(msg.to) ? msg.to : [msg.to]) : [];
      if (targets.includes(this.config.id) || targets.length === 0) {
        this.handleChatMessage(msg).catch(err => {
          this.log('error', 'Failed to handle chat message', err);
        });
      }
    });

    // Listen for questions
    this.messageBus.on('type:question', (msg: AgentMessage) => {
      this.handleQuestion(msg).catch(err => {
        this.log('error', 'Failed to handle question', err);
      });
    });
  }

  /**
   * Handle incoming messages (override in subclasses)
   */
  protected async handleMessage(message: AgentMessage): Promise<void> {
    this.log('debug', `Received message from ${message.from}`, message.content);
  }

  /**
   * Handle vote requests for trade proposals
   */
  protected async handleVoteRequest(message: AgentMessage): Promise<void> {
    const proposal = message.content?.proposal;
    if (!proposal) return;

    // Get agent's opinion on the trade
    const vote = await this.evaluateTradeProposal(proposal);
    
    if (vote) {
      this.messageBus.vote(proposal.id, {
        agentId: this.config.id,
        vote: vote.decision,
        confidence: vote.confidence,
        reason: vote.reason,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Handle chat messages from humans
   */
  protected async handleChatMessage(message: AgentMessage): Promise<void> {
    const query = typeof message.content === 'string' 
      ? message.content 
      : message.content?.text || JSON.stringify(message.content);
    
    const response = await this.generateChatResponse(query);
    
    if (response) {
      this.messageBus.reply(this.config.id, message, response);
    }
  }

  /**
   * Handle questions (especially trade opinions)
   */
  protected async handleQuestion(message: AgentMessage): Promise<void> {
    if (message.content?.type === 'trade_opinion') {
      const opinion = await this.getTradeOpinion(
        message.content.direction,
        message.content.context
      );
      this.messageBus.reply(this.config.id, message, opinion);
    }
  }

  /**
   * Evaluate a trade proposal (override in subclasses)
   */
  protected async evaluateTradeProposal(proposal: any): Promise<{
    decision: 'approve' | 'reject' | 'abstain';
    confidence: number;
    reason: string;
  } | null> {
    // Default: abstain if not overridden
    return {
      decision: 'abstain',
      confidence: 50,
      reason: `${this.config.name} has no opinion on this trade`,
    };
  }

  /**
   * Generate a response to a chat message (override in subclasses)
   * Uses AI if enabled, otherwise returns rule-based response
   */
  protected async generateChatResponse(query: string): Promise<string | null> {
    // Try AI-powered response first
    const aiEnabled = await aiService.isEnabled();
    if (aiEnabled) {
      const context = this.getContextForAI();
      const aiResponse = await aiService.generateAgentResponse(
        this.config.name,
        this.getAgentRole(),
        query,
        context
      );
      if (aiResponse) return aiResponse;
    }

    // Fallback to rule-based response
    return this.getRuleBasedResponse(query);
  }

  /**
   * Get context data for AI (override in subclasses)
   */
  protected getContextForAI(): any {
    return {
      agentId: this.config.id,
      status: this.status,
      metrics: this.metrics,
    };
  }

  /**
   * Get agent role description for AI (override in subclasses)
   */
  protected getAgentRole(): string {
    return 'trading agent';
  }

  /**
   * Rule-based response fallback (override in subclasses)
   */
  protected getRuleBasedResponse(query: string): string | null {
    return `[${this.config.name}] I received your message but don't have a specific response.`;
  }

  /**
   * Get opinion on a trade direction (override in subclasses)
   */
  protected async getTradeOpinion(
    direction: 'long' | 'short',
    context?: string
  ): Promise<{
    opinion: 'approve' | 'reject' | 'neutral';
    confidence: number;
    reason: string;
  }> {
    // Try AI-powered evaluation
    const aiEnabled = await aiService.isEnabled();
    if (aiEnabled) {
      const evaluation = await aiService.evaluateTrade({
        direction,
        confidence: 70,
        reason: context || 'Trade proposal',
        marketData: this.getContextForAI(),
        riskAssessment: {},
      });
      return evaluation;
    }

    return {
      opinion: 'neutral',
      confidence: 50,
      reason: `${this.config.name} has no strong opinion`,
    };
  }

  /**
   * Broadcast a message to other agents
   */
  protected broadcastToSwarm(type: 'analysis' | 'alert' | 'opinion', content: any): void {
    this.messageBus.broadcast(this.config.id, type, content);
  }

  /**
   * Send a message to a specific agent
   */
  protected sendToAgent(targetId: string, content: any): void {
    this.messageBus.sendTo(this.config.id, targetId, 'opinion', content);
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
