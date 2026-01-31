/**
 * Execution Agent
 * Handles order execution, position management, and trade lifecycle
 */

import { BaseAgent, type AgentConfig } from './base-agent';
import { LNMarketsService, type Position, type TradeParams } from '../services/lnmarkets';
import { RiskManagerAgent, type PositionSizing } from './risk-manager';
import { MarketAnalystAgent, type MarketAnalysis } from './market-analyst';
import {
  savePendingSignal,
  deletePendingSignal,
  loadPendingSignals,
  clearPendingSignals,
  saveExecutedTrade,
  loadExecutedTrades,
  updateExecutedTradeStatus,
} from '../services/state';

export interface TradeSignal {
  id: string;
  timestamp: Date;
  direction: 'long' | 'short';
  confidence: number;
  reason: string;
  source: string;
  price: number;
}

export interface ExecutedTrade {
  signalId: string;
  positionId: string;
  direction: 'long' | 'short';
  entryPrice: number;
  margin: number;
  leverage: number;
  stopLoss: number;
  takeProfit: number;
  executedAt: Date;
  status: 'open' | 'closed' | 'cancelled';
  closedAt?: Date;
  pnl?: number;
}

export interface ExecutionConfig {
  id: string;
  name: string;
  enabled?: boolean;
  intervalMs?: number;
  maxRetries?: number;
  timeoutMs?: number;
  autoExecute: boolean;
  minConfidence: number;
  maxOpenPositions: number;
  cooldownMs: number; // Minimum time between trades
}

export class ExecutionAgent extends BaseAgent {
  private lnMarkets: LNMarketsService | null = null;
  private riskManager: RiskManagerAgent | null = null;
  private marketAnalyst: MarketAnalystAgent | null = null;
  private execConfig: ExecutionConfig;
  private pendingSignals: TradeSignal[] = [];
  private executedTrades: Map<string, ExecutedTrade> = new Map();
  private lastTradeTime: Date | null = null;

  constructor(config: ExecutionConfig) {
    super({
      id: config.id,
      name: config.name,
      enabled: config.enabled ?? true,
      intervalMs: config.intervalMs || 10 * 1000, // 10 seconds default
      maxRetries: config.maxRetries ?? 3,
      timeoutMs: config.timeoutMs ?? 30000,
    });

    this.execConfig = {
      id: config.id,
      name: config.name,
      enabled: config.enabled ?? true,
      intervalMs: config.intervalMs || 10 * 1000,
      autoExecute: config.autoExecute ?? false,
      minConfidence: config.minConfidence ?? 70,
      maxOpenPositions: config.maxOpenPositions ?? 3,
      cooldownMs: config.cooldownMs ?? 60 * 1000, // 1 minute cooldown
    };
  }

  setServices(services: {
    lnMarkets: LNMarketsService;
    riskManager: RiskManagerAgent;
    marketAnalyst: MarketAnalystAgent;
  }): void {
    this.lnMarkets = services.lnMarkets;
    this.riskManager = services.riskManager;
    this.marketAnalyst = services.marketAnalyst;
  }

  getType(): string {
    return 'execution';
  }

  async execute(): Promise<void> {
    if (!this.lnMarkets || !this.riskManager) {
      this.log('debug', 'Services not configured');
      return;
    }

    // Process pending signals
    if (this.pendingSignals.length > 0 && this.execConfig.autoExecute) {
      await this.processPendingSignals();
    }

    // Monitor open positions
    await this.monitorPositions();
  }

  // ============ SIGNAL HANDLING ============

  addSignal(signal: TradeSignal): void {
    // Validate signal
    if (signal.confidence < this.execConfig.minConfidence) {
      this.log('debug', `Signal rejected: confidence too low (${signal.confidence}%)`);
      return;
    }

    // Check for conflicting signals
    const hasConflict = this.pendingSignals.some(
      (s) => s.direction !== signal.direction && s.timestamp.getTime() > Date.now() - 300000
    );

    if (hasConflict) {
      this.log('warn', 'Conflicting signals detected, holding');
      return;
    }

    this.pendingSignals.push(signal);
    this.log('info', `Signal added: ${signal.direction} @ ${signal.price}`, {
      confidence: signal.confidence,
      source: signal.source,
    });
    this.emit('signal_added', signal);

    // Persist to database
    this.persistPendingSignal(signal).catch(() => {});
  }

  private async processPendingSignals(): Promise<void> {
    if (this.pendingSignals.length === 0) return;

    // Check cooldown
    if (this.lastTradeTime) {
      const timeSinceLastTrade = Date.now() - this.lastTradeTime.getTime();
      if (timeSinceLastTrade < this.execConfig.cooldownMs) {
        this.log('debug', 'Trade cooldown active');
        return;
      }
    }

    // Check position limit
    const positions = await this.lnMarkets!.getRunningIsolatedPositions();
    if (positions.length >= this.execConfig.maxOpenPositions) {
      this.log('debug', 'Max open positions reached');
      return;
    }

    // Get the strongest signal
    const sortedSignals = this.pendingSignals.sort((a, b) => b.confidence - a.confidence);
    const signal = sortedSignals[0];

    // Check if signal is still valid (not too old)
    const signalAge = Date.now() - signal.timestamp.getTime();
    if (signalAge > 5 * 60 * 1000) {
      // 5 minutes
      this.pendingSignals = this.pendingSignals.filter((s) => s.id !== signal.id);
      this.log('debug', 'Signal expired', { signalId: signal.id });
      return;
    }

    // Execute the trade
    await this.executeTrade(signal);
  }

  // ============ TRADE EXECUTION ============

  async executeTrade(signal: TradeSignal): Promise<ExecutedTrade | null> {
    if (!this.lnMarkets || !this.riskManager) {
      throw new Error('Services not configured');
    }

    this.log('info', `Executing trade for signal ${signal.id}`);
    this.status = 'executing';

    try {
      // Get risk assessment
      const riskAssessment = await this.riskManager.forceAssessment();
      if (!riskAssessment?.canOpenNewPosition) {
        this.log('warn', 'Risk manager blocked trade');
        return null;
      }

      // Get current price
      const ticker = await this.lnMarkets.getTicker();
      const currentPrice = ticker.lastPrice;

      // Calculate position sizing
      const sizing = this.riskManager.calculatePositionSize({
        entryPrice: currentPrice,
        direction: signal.direction,
        confidence: signal.confidence,
        volatility: 'medium', // Could get from market analyst
      });

      if (!sizing) {
        this.log('warn', 'Position sizing failed');
        return null;
      }

      // Execute the trade
      const tradeParams: TradeParams = {
        type: 'market',
        side: signal.direction === 'long' ? 'buy' : 'sell',
        margin: sizing.recommendedMargin,
        leverage: sizing.recommendedLeverage,
        stoploss: sizing.stopLoss,
        takeprofit: sizing.takeProfit,
      };

      const position = await this.lnMarkets.openIsolatedPosition(tradeParams);

      const executedTrade: ExecutedTrade = {
        signalId: signal.id,
        positionId: position.id,
        direction: signal.direction,
        entryPrice: currentPrice,
        margin: sizing.recommendedMargin,
        leverage: sizing.recommendedLeverage,
        stopLoss: sizing.stopLoss,
        takeProfit: sizing.takeProfit,
        executedAt: new Date(),
        status: 'open',
      };

      this.executedTrades.set(position.id, executedTrade);
      this.lastTradeTime = new Date();

      // Remove the signal from pending
      this.pendingSignals = this.pendingSignals.filter((s) => s.id !== signal.id);

      // Persist to database
      this.persistExecutedTrade(executedTrade).catch(() => {});
      this.removePendingSignal(signal.id).catch(() => {});

      this.log('info', `Trade executed successfully`, {
        positionId: position.id,
        direction: signal.direction,
        margin: sizing.recommendedMargin,
        leverage: sizing.recommendedLeverage,
      });

      this.emit('trade_executed', executedTrade);
      return executedTrade;
    } catch (error) {
      this.log('error', `Trade execution failed`, error);
      this.emit('trade_failed', { signal, error });
      return null;
    } finally {
      this.status = 'idle';
    }
  }

  async closePosition(positionId: string, reason: string): Promise<void> {
    if (!this.lnMarkets) {
      throw new Error('LN Markets service not configured');
    }

    this.log('info', `Closing position ${positionId}: ${reason}`);

    try {
      await this.lnMarkets.closeIsolatedPosition(positionId);

      const trade = this.executedTrades.get(positionId);
      if (trade) {
        trade.status = 'closed';
        trade.closedAt = new Date();
        this.emit('position_closed', { positionId, reason, trade });

        // Persist status change
        updateExecutedTradeStatus(positionId, 'closed', trade.pnl).catch(() => {});
      }

      this.log('info', `Position ${positionId} closed`);
    } catch (error) {
      this.log('error', `Failed to close position ${positionId}`, error);
      throw error;
    }
  }

  async closeAllPositions(reason: string): Promise<void> {
    if (!this.lnMarkets) {
      throw new Error('LN Markets service not configured');
    }

    this.log('warn', `Closing all positions: ${reason}`);

    const positions = await this.lnMarkets.getRunningIsolatedPositions();

    for (const position of positions) {
      try {
        await this.closePosition(position.id, reason);
      } catch (error) {
        this.log('error', `Failed to close position ${position.id}`, error);
      }
    }
  }

  // ============ POSITION MONITORING ============

  private async monitorPositions(): Promise<void> {
    if (!this.lnMarkets) return;

    const positions = await this.lnMarkets.getRunningIsolatedPositions();

    for (const position of positions) {
      const trade = this.executedTrades.get(position.id);

      if (trade && trade.status === 'open') {
        // Check if position has been closed by stop loss or take profit
        // (This would be detected by the position disappearing from running positions)

        // Update trade P&L
        trade.pnl = position.pl;

        // Emit position update
        this.emit('position_update', {
          positionId: position.id,
          pl: position.pl,
          plPercent: position.plPercent,
        });
      }
    }

    // Check for closed positions
    for (const [positionId, trade] of this.executedTrades) {
      if (trade.status === 'open') {
        const stillOpen = positions.some((p) => p.id === positionId);
        if (!stillOpen) {
          trade.status = 'closed';
          trade.closedAt = new Date();
          this.log('info', `Position ${positionId} was closed (likely by SL/TP)`);
          this.emit('position_closed', {
            positionId,
            reason: 'SL/TP triggered',
            trade,
          });

          // Persist status change
          updateExecutedTradeStatus(positionId, 'closed', trade.pnl).catch(() => {});
        }
      }
    }
  }

  // ============ PUBLIC API ============

  getPendingSignals(): TradeSignal[] {
    return [...this.pendingSignals];
  }

  getExecutedTrades(): ExecutedTrade[] {
    return Array.from(this.executedTrades.values());
  }

  getOpenTrades(): ExecutedTrade[] {
    return Array.from(this.executedTrades.values()).filter((t) => t.status === 'open');
  }

  clearPendingSignals(): void {
    this.pendingSignals = [];
    this.log('info', 'Pending signals cleared');

    // Clear from database
    clearPendingSignals().catch(() => {});
  }

  setAutoExecute(enabled: boolean): void {
    this.execConfig.autoExecute = enabled;
    this.log('info', `Auto-execute ${enabled ? 'enabled' : 'disabled'}`);
    this.emit('auto_execute_changed', enabled);
  }

  isAutoExecuteEnabled(): boolean {
    return this.execConfig.autoExecute;
  }

  getExecutionConfig(): ExecutionConfig {
    return { ...this.execConfig };
  }

  updateExecutionConfig(updates: Partial<ExecutionConfig>): void {
    this.execConfig = { ...this.execConfig, ...updates };
    this.log('info', 'Execution config updated', updates);
  }

  // ============ STATE PERSISTENCE ============

  /**
   * Get agent-specific state for persistence
   */
  protected getAgentSpecificState(): any {
    return {
      autoExecute: this.execConfig.autoExecute,
      lastTradeTime: this.lastTradeTime?.toISOString() ?? null,
      execConfig: this.execConfig,
    };
  }

  /**
   * Restore agent-specific state from persistence
   */
  protected restoreAgentSpecificState(state: any): void {
    if (state.autoExecute !== undefined) {
      this.execConfig.autoExecute = state.autoExecute;
    }
    if (state.lastTradeTime) {
      this.lastTradeTime = new Date(state.lastTradeTime);
    }
    if (state.execConfig) {
      this.execConfig = { ...this.execConfig, ...state.execConfig };
    }
  }

  /**
   * Load state from database (including signals and trades)
   */
  async loadState(): Promise<boolean> {
    const baseLoaded = await super.loadState();

    try {
      // Load pending signals
      const signals = await loadPendingSignals();
      this.pendingSignals = signals.map((s) => ({
        id: s.signalId,
        timestamp: s.createdAt,
        direction: s.direction,
        confidence: s.confidence,
        reason: s.reason || '',
        source: s.source,
        price: s.price,
      }));
      this.log('info', `Restored ${this.pendingSignals.length} pending signals`);

      // Load executed trades
      const trades = await loadExecutedTrades();
      this.executedTrades.clear();
      for (const trade of trades) {
        this.executedTrades.set(trade.positionId, {
          signalId: trade.signalId || '',
          positionId: trade.positionId,
          direction: trade.direction,
          entryPrice: trade.entryPrice,
          margin: trade.margin,
          leverage: trade.leverage,
          stopLoss: trade.stopLoss || 0,
          takeProfit: trade.takeProfit || 0,
          executedAt: trade.executedAt,
          status: trade.status,
          closedAt: trade.closedAt,
          pnl: trade.pnl,
        });
      }
      this.log('info', `Restored ${this.executedTrades.size} executed trades`);

      return true;
    } catch (error) {
      this.log('error', 'Failed to load execution state', error);
      return baseLoaded;
    }
  }

  /**
   * Persist state after each tick
   */
  protected async persistAfterTick(): Promise<void> {
    await this.saveState();
    // Signals and trades are persisted individually when modified
  }

  /**
   * Save a pending signal to database
   */
  private async persistPendingSignal(signal: TradeSignal): Promise<void> {
    try {
      await savePendingSignal({
        signalId: signal.id,
        direction: signal.direction,
        price: signal.price,
        confidence: signal.confidence,
        source: signal.source,
        reason: signal.reason,
        expiresAt: new Date(signal.timestamp.getTime() + 5 * 60 * 1000), // 5 min expiry
        createdAt: signal.timestamp,
      });
    } catch (error) {
      this.log('error', 'Failed to persist pending signal', error);
    }
  }

  /**
   * Remove a pending signal from database
   */
  private async removePendingSignal(signalId: string): Promise<void> {
    try {
      await deletePendingSignal(signalId);
    } catch (error) {
      this.log('error', 'Failed to remove pending signal', error);
    }
  }

  /**
   * Save an executed trade to database
   */
  private async persistExecutedTrade(trade: ExecutedTrade): Promise<void> {
    try {
      await saveExecutedTrade({
        positionId: trade.positionId,
        signalId: trade.signalId,
        direction: trade.direction,
        entryPrice: trade.entryPrice,
        margin: trade.margin,
        leverage: trade.leverage,
        stopLoss: trade.stopLoss,
        takeProfit: trade.takeProfit,
        status: trade.status,
        pnl: trade.pnl,
        executedAt: trade.executedAt,
        closedAt: trade.closedAt,
      });
    } catch (error) {
      this.log('error', 'Failed to persist executed trade', error);
    }
  }
}
