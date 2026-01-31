/**
 * Risk Manager Agent
 * Manages position sizing, stop losses, and overall portfolio risk
 */

import { BaseAgent, type AgentConfig } from './base-agent';
import { LNMarketsService, type Position } from '../services/lnmarkets';

export interface RiskParameters {
  maxPositionSizePercent: number; // Max % of balance per position
  maxTotalExposurePercent: number; // Max % of balance in all positions
  maxLeverage: number;
  defaultStopLossPercent: number;
  defaultTakeProfitPercent: number;
  trailingStopPercent: number | null;
  maxDailyLossPercent: number;
  maxDrawdownPercent: number;
}

export interface PositionSizing {
  recommendedMargin: number;
  recommendedLeverage: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  maxLoss: number;
  potentialProfit: number;
}

export interface RiskAssessment {
  timestamp: Date;
  balance: number;
  totalExposure: number;
  exposurePercent: number;
  positions: {
    id: string;
    side: 'buy' | 'sell';
    margin: number;
    pl: number;
    plPercent: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }[];
  dailyPL: number;
  dailyPLPercent: number;
  alerts: RiskAlert[];
  canOpenNewPosition: boolean;
  availableMargin: number;
}

export interface RiskAlert {
  level: 'info' | 'warning' | 'critical';
  type: string;
  message: string;
  positionId?: string;
  action?: string;
}

export interface RiskManagerConfig extends Partial<AgentConfig> {
  id: string;
  name: string;
  riskParams: Partial<RiskParameters>;
}

export class RiskManagerAgent extends BaseAgent {
  private lnMarkets: LNMarketsService | null = null;
  private riskParams: RiskParameters;
  private lastAssessment: RiskAssessment | null = null;
  private dailyStartBalance: number = 0;
  private dailyStartDate: Date = new Date();

  constructor(config: RiskManagerConfig) {
    super({
      ...config,
      intervalMs: config.intervalMs || 30 * 1000, // 30 seconds default
    });

    this.riskParams = {
      maxPositionSizePercent: 10,
      maxTotalExposurePercent: 50,
      maxLeverage: 25,
      defaultStopLossPercent: 5,
      defaultTakeProfitPercent: 10,
      trailingStopPercent: null,
      maxDailyLossPercent: 10,
      maxDrawdownPercent: 20,
      ...config.riskParams,
    };
  }

  setLNMarketsService(service: LNMarketsService): void {
    this.lnMarkets = service;
  }

  getType(): string {
    return 'risk_manager';
  }

  async execute(): Promise<void> {
    if (!this.lnMarkets) {
      this.log('warn', 'LN Markets service not configured');
      return;
    }

    this.log('debug', 'Running risk assessment');

    try {
      const assessment = await this.assessRisk();
      this.lastAssessment = assessment;

      // Emit alerts
      for (const alert of assessment.alerts) {
        this.emit('alert', alert);
        const logLevel = alert.level === 'critical' ? 'error' : alert.level === 'warning' ? 'warn' : 'info';
        this.log(logLevel, alert.message);
      }

      // Auto-actions for critical alerts
      if (assessment.alerts.some((a) => a.level === 'critical')) {
        await this.handleCriticalAlerts(assessment.alerts);
      }

      this.emit('assessment', assessment);
    } catch (error) {
      this.log('error', 'Risk assessment failed', error);
      throw error;
    }
  }

  private async assessRisk(): Promise<RiskAssessment> {
    const [balance, positions] = await Promise.all([
      this.lnMarkets!.getBalance(),
      this.lnMarkets!.getRunningIsolatedPositions(),
    ]);

    // Reset daily tracking at midnight
    const today = new Date();
    if (today.toDateString() !== this.dailyStartDate.toDateString()) {
      this.dailyStartBalance = balance;
      this.dailyStartDate = today;
    }

    if (this.dailyStartBalance === 0) {
      this.dailyStartBalance = balance;
    }

    const totalExposure = positions.reduce((sum, p) => sum + p.margin, 0);
    const exposurePercent = (totalExposure / balance) * 100;

    const dailyPL = balance - this.dailyStartBalance;
    const dailyPLPercent = (dailyPL / this.dailyStartBalance) * 100;

    const alerts: RiskAlert[] = [];

    // Assess each position
    const assessedPositions = positions.map((p) => {
      const riskLevel = this.assessPositionRisk(p);

      if (riskLevel === 'critical') {
        alerts.push({
          level: 'critical',
          type: 'position_critical',
          message: `Position ${p.id} is at critical risk (${p.plPercent.toFixed(1)}% loss)`,
          positionId: p.id,
          action: 'Consider closing position',
        });
      } else if (riskLevel === 'high') {
        alerts.push({
          level: 'warning',
          type: 'position_high_risk',
          message: `Position ${p.id} is at high risk (${p.plPercent.toFixed(1)}% loss)`,
          positionId: p.id,
        });
      }

      return {
        id: p.id,
        side: p.side,
        margin: p.margin,
        pl: p.pl,
        plPercent: p.plPercent,
        riskLevel,
      };
    });

    // Portfolio-level alerts
    if (exposurePercent > this.riskParams.maxTotalExposurePercent) {
      alerts.push({
        level: 'warning',
        type: 'over_exposed',
        message: `Total exposure (${exposurePercent.toFixed(1)}%) exceeds limit (${this.riskParams.maxTotalExposurePercent}%)`,
        action: 'Reduce position sizes',
      });
    }

    if (dailyPLPercent < -this.riskParams.maxDailyLossPercent) {
      alerts.push({
        level: 'critical',
        type: 'daily_loss_limit',
        message: `Daily loss (${dailyPLPercent.toFixed(1)}%) exceeds limit (-${this.riskParams.maxDailyLossPercent}%)`,
        action: 'Stop trading for today',
      });
    }

    // Drawdown check
    // (Would need historical high balance for proper implementation)

    const availableMargin =
      (balance * this.riskParams.maxTotalExposurePercent) / 100 - totalExposure;
    const canOpenNewPosition =
      availableMargin > 0 &&
      dailyPLPercent > -this.riskParams.maxDailyLossPercent &&
      exposurePercent < this.riskParams.maxTotalExposurePercent;

    return {
      timestamp: new Date(),
      balance,
      totalExposure,
      exposurePercent,
      positions: assessedPositions,
      dailyPL,
      dailyPLPercent,
      alerts,
      canOpenNewPosition,
      availableMargin: Math.max(0, availableMargin),
    };
  }

  private assessPositionRisk(position: Position): 'low' | 'medium' | 'high' | 'critical' {
    const lossPercent = Math.abs(Math.min(0, position.plPercent));

    if (lossPercent > 50) return 'critical';
    if (lossPercent > 30) return 'high';
    if (lossPercent > 15) return 'medium';
    return 'low';
  }

  private async handleCriticalAlerts(alerts: RiskAlert[]): Promise<void> {
    for (const alert of alerts) {
      if (alert.type === 'daily_loss_limit') {
        this.emit('stop_trading', { reason: 'Daily loss limit exceeded' });
        // Could auto-close all positions here
      }
    }
  }

  // ============ POSITION SIZING ============

  calculatePositionSize(params: {
    entryPrice: number;
    direction: 'long' | 'short';
    confidence: number; // 0-100
    volatility: 'low' | 'medium' | 'high';
  }): PositionSizing | null {
    if (!this.lastAssessment) {
      this.log('warn', 'No risk assessment available');
      return null;
    }

    if (!this.lastAssessment.canOpenNewPosition) {
      this.log('warn', 'Cannot open new position - risk limits exceeded');
      return null;
    }

    const { balance, availableMargin } = this.lastAssessment;
    const { entryPrice, direction, confidence, volatility } = params;

    // Adjust position size based on confidence
    const confidenceMultiplier = confidence / 100;

    // Adjust for volatility
    const volatilityMultiplier =
      volatility === 'high' ? 0.5 : volatility === 'medium' ? 0.75 : 1;

    // Calculate base margin
    const maxMargin = (balance * this.riskParams.maxPositionSizePercent) / 100;
    const adjustedMargin = Math.min(
      maxMargin * confidenceMultiplier * volatilityMultiplier,
      availableMargin
    );

    // Determine leverage (lower for volatile markets)
    const baseLeverage = Math.min(
      this.riskParams.maxLeverage,
      volatility === 'high' ? 10 : volatility === 'medium' ? 15 : 25
    );
    const recommendedLeverage = Math.max(1, Math.floor(baseLeverage * confidenceMultiplier));

    // Calculate stop loss and take profit
    const stopLossPercent =
      volatility === 'high'
        ? this.riskParams.defaultStopLossPercent * 1.5
        : this.riskParams.defaultStopLossPercent;

    const takeProfitPercent = stopLossPercent * 2; // 1:2 risk/reward minimum

    let stopLoss: number;
    let takeProfit: number;

    if (direction === 'long') {
      stopLoss = entryPrice * (1 - stopLossPercent / 100);
      takeProfit = entryPrice * (1 + takeProfitPercent / 100);
    } else {
      stopLoss = entryPrice * (1 + stopLossPercent / 100);
      takeProfit = entryPrice * (1 - takeProfitPercent / 100);
    }

    const maxLoss = (adjustedMargin * stopLossPercent * recommendedLeverage) / 100;
    const potentialProfit = (adjustedMargin * takeProfitPercent * recommendedLeverage) / 100;

    return {
      recommendedMargin: Math.floor(adjustedMargin),
      recommendedLeverage,
      stopLoss: Math.round(stopLoss),
      takeProfit: Math.round(takeProfit),
      riskRewardRatio: takeProfitPercent / stopLossPercent,
      maxLoss: Math.floor(maxLoss),
      potentialProfit: Math.floor(potentialProfit),
    };
  }

  // ============ STOP LOSS MANAGEMENT ============

  async updateTrailingStops(): Promise<void> {
    if (!this.lnMarkets || !this.riskParams.trailingStopPercent) {
      return;
    }

    const positions = await this.lnMarkets.getRunningIsolatedPositions();
    const ticker = await this.lnMarkets.getTicker();
    const currentPrice = ticker.lastPrice;

    for (const position of positions) {
      if (position.pl > 0) {
        // Only trail profitable positions
        await this.updateTrailingStop(position, currentPrice);
      }
    }
  }

  private async updateTrailingStop(position: Position, currentPrice: number): Promise<void> {
    if (!this.riskParams.trailingStopPercent) return;

    const trailPercent = this.riskParams.trailingStopPercent / 100;
    let newStopLoss: number;

    if (position.side === 'buy') {
      newStopLoss = currentPrice * (1 - trailPercent);
      // Only move stop up, never down
      if (newStopLoss > position.entryPrice) {
        await this.lnMarkets!.updateIsolatedStopLoss(position.id, Math.round(newStopLoss));
        this.log('info', `Trailing stop updated for ${position.id}`, { newStopLoss });
      }
    } else {
      newStopLoss = currentPrice * (1 + trailPercent);
      // Only move stop down, never up
      if (newStopLoss < position.entryPrice) {
        await this.lnMarkets!.updateIsolatedStopLoss(position.id, Math.round(newStopLoss));
        this.log('info', `Trailing stop updated for ${position.id}`, { newStopLoss });
      }
    }
  }

  // ============ PUBLIC API ============

  getLastAssessment(): RiskAssessment | null {
    return this.lastAssessment;
  }

  getRiskParams(): RiskParameters {
    return { ...this.riskParams };
  }

  updateRiskParams(params: Partial<RiskParameters>): void {
    this.riskParams = { ...this.riskParams, ...params };
    this.log('info', 'Risk parameters updated', params);
    this.emit('params_updated', this.riskParams);
  }

  async forceAssessment(): Promise<RiskAssessment | null> {
    await this.execute();
    return this.lastAssessment;
  }

  // ============ AI INTEGRATION ============

  protected getContextForAI(): any {
    if (!this.lastAssessment) {
      return { status: 'no assessment available' };
    }
    const a = this.lastAssessment;
    return {
      balance: a.balance,
      totalExposure: a.totalExposure,
      exposurePercent: a.exposurePercent,
      dailyPL: a.dailyPL,
      dailyPLPercent: a.dailyPLPercent,
      openPositions: a.positions.length,
      canOpenNewPosition: a.canOpenNewPosition,
      availableMargin: a.availableMargin,
      alerts: a.alerts,
      riskParams: this.riskParams,
    };
  }

  protected getAgentRole(): string {
    return 'risk management specialist focusing on position sizing, exposure limits, and portfolio risk';
  }

  protected getRuleBasedResponse(query: string): string | null {
    if (!this.lastAssessment) {
      return `**🛡️ Risk Manager:** No assessment available - LN Markets may not be connected.`;
    }

    const a = this.lastAssessment;
    return `**🛡️ Risk Manager Report**
• Balance: ${a.balance.toLocaleString()} sats
• Exposure: ${a.exposurePercent.toFixed(1)}%
• Daily P&L: ${a.dailyPLPercent.toFixed(2)}%
• Can Trade: ${a.canOpenNewPosition ? '✅' : '❌'}
• Alerts: ${a.alerts.length > 0 ? a.alerts.map(al => al.message).join(', ') : 'None'}`;
  }

  // ============ SWARM COMMUNICATION ============

  /**
   * Evaluate a trade proposal from risk perspective
   */
  protected async evaluateTradeProposal(proposal: any): Promise<{
    decision: 'approve' | 'reject' | 'abstain';
    confidence: number;
    reason: string;
  } | null> {
    if (!this.lastAssessment) {
      await this.forceAssessment();
    }

    if (!this.lastAssessment) {
      return {
        decision: 'reject',
        confidence: 100,
        reason: 'Cannot assess risk - no data available',
      };
    }

    const assessment = this.lastAssessment;

    // Check if we can open new positions
    if (!assessment.canOpenNewPosition) {
      return {
        decision: 'reject',
        confidence: 100,
        reason: `Risk limits exceeded: exposure ${assessment.exposurePercent.toFixed(1)}%, daily P&L ${assessment.dailyPLPercent.toFixed(1)}%`,
      };
    }

    // Check available margin
    if (assessment.availableMargin < 1000) {
      return {
        decision: 'reject',
        confidence: 90,
        reason: `Insufficient available margin: ${assessment.availableMargin} sats`,
      };
    }

    // Check daily loss
    if (assessment.dailyPLPercent < -this.riskParams.maxDailyLossPercent / 2) {
      return {
        decision: 'reject',
        confidence: 85,
        reason: `Already at ${assessment.dailyPLPercent.toFixed(1)}% daily loss - reducing risk`,
      };
    }

    // Approve with confidence based on risk headroom
    const headroomPercent = (this.riskParams.maxTotalExposurePercent - assessment.exposurePercent);
    const confidence = Math.min(90, 50 + headroomPercent);

    return {
      decision: 'approve',
      confidence,
      reason: `Risk checks passed. Available margin: ${assessment.availableMargin} sats, exposure: ${assessment.exposurePercent.toFixed(1)}%`,
    };
  }

  /**
   * Generate chat response about risk
   */
  protected async generateChatResponse(query: string): Promise<string | null> {
    if (!this.lastAssessment) {
      await this.forceAssessment();
    }

    if (!this.lastAssessment) {
      return `⚠️ Risk assessment not available - LN Markets may not be connected.`;
    }

    const a = this.lastAssessment;
    const parts: string[] = [`**🛡️ Risk Manager Report**\n`];

    parts.push(`**Portfolio Status:**`);
    parts.push(`• Balance: ${a.balance.toLocaleString()} sats`);
    parts.push(`• Exposure: ${a.totalExposure.toLocaleString()} sats (${a.exposurePercent.toFixed(1)}%)`);
    parts.push(`• Available Margin: ${a.availableMargin.toLocaleString()} sats`);
    parts.push(`• Daily P&L: ${a.dailyPL >= 0 ? '+' : ''}${a.dailyPL.toLocaleString()} sats (${a.dailyPLPercent.toFixed(2)}%)\n`);

    parts.push(`**Open Positions (${a.positions.length}):**`);
    for (const p of a.positions) {
      const emoji = p.riskLevel === 'critical' ? '🔴' : p.riskLevel === 'high' ? '🟠' : p.riskLevel === 'medium' ? '🟡' : '🟢';
      parts.push(`${emoji} ${p.side.toUpperCase()}: ${p.margin.toLocaleString()} sats, P&L: ${p.pl >= 0 ? '+' : ''}${p.pl.toLocaleString()} (${p.plPercent.toFixed(1)}%)`);
    }

    if (a.alerts.length > 0) {
      parts.push(`\n**⚠️ Alerts:**`);
      for (const alert of a.alerts) {
        const emoji = alert.level === 'critical' ? '🚨' : alert.level === 'warning' ? '⚠️' : 'ℹ️';
        parts.push(`${emoji} ${alert.message}`);
      }
    }

    parts.push(`\n**Can Open New Position:** ${a.canOpenNewPosition ? '✅ Yes' : '❌ No'}`);

    return parts.join('\n');
  }

  /**
   * Get trade opinion from risk perspective
   */
  protected async getTradeOpinion(
    direction: 'long' | 'short',
    context?: string
  ): Promise<{
    opinion: 'approve' | 'reject' | 'neutral';
    confidence: number;
    reason: string;
  }> {
    const evaluation = await this.evaluateTradeProposal({ direction });
    
    if (!evaluation) {
      return {
        opinion: 'neutral',
        confidence: 50,
        reason: 'Unable to evaluate',
      };
    }

    return {
      opinion: evaluation.decision === 'approve' ? 'approve' : 
               evaluation.decision === 'reject' ? 'reject' : 'neutral',
      confidence: evaluation.confidence,
      reason: evaluation.reason,
    };
  }
}
