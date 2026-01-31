/**
 * Market Analyst Agent
 * Performs technical analysis and generates trading signals
 */

import { BaseAgent, type AgentConfig } from './base-agent';
import { LNMarketsService, getLNMarketsService } from '../services/lnmarkets';
import {
  TechnicalAnalysisService,
  getTechnicalAnalysisService,
  type TechnicalSummary,
} from '../services/technical-analysis';

export interface MarketAnalysis {
  timestamp: Date;
  price: number;
  technicalSummary: TechnicalSummary;
  patterns: string[];
  supportResistance: {
    supports: number[];
    resistances: number[];
    pivot: number;
  };
  recommendation: {
    action: 'long' | 'short' | 'hold' | 'close_longs' | 'close_shorts';
    confidence: number;
    reason: string;
  };
}

export interface MarketAnalystConfig extends Partial<AgentConfig> {
  id: string;
  name: string;
  analysisIntervals: ('1h' | '4h' | '1d')[];
  minConfidence: number;
}

export class MarketAnalystAgent extends BaseAgent {
  private lnMarkets: LNMarketsService;
  private ta: TechnicalAnalysisService;
  private agentConfig: MarketAnalystConfig;
  private lastAnalysis: Map<string, MarketAnalysis> = new Map();

  constructor(config: MarketAnalystConfig) {
    super({
      ...config,
      intervalMs: config.intervalMs || 5 * 60 * 1000, // 5 minutes default
    });
    this.agentConfig = {
      id: config.id,
      name: config.name,
      analysisIntervals: config.analysisIntervals || ['1h', '4h'],
      minConfidence: config.minConfidence ?? 60,
    };
    this.lnMarkets = getLNMarketsService();
    this.ta = getTechnicalAnalysisService();
  }

  getType(): string {
    return 'market_analyst';
  }

  async execute(): Promise<void> {
    this.log('info', 'Starting market analysis');

    for (const interval of this.agentConfig.analysisIntervals) {
      try {
        const analysis = await this.analyzeTimeframe(interval);
        this.lastAnalysis.set(interval, analysis);
        this.emit('analysis', { interval, analysis });
        this.log('info', `${interval} analysis complete`, {
          signal: analysis.technicalSummary.signal,
          score: analysis.technicalSummary.score,
          recommendation: analysis.recommendation.action,
        });
      } catch (error) {
        this.log('error', `Failed to analyze ${interval}`, error);
      }
    }

    // Generate combined recommendation
    const recommendation = this.generateCombinedRecommendation();
    this.emit('recommendation', recommendation);
  }

  private async analyzeTimeframe(
    interval: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w'
  ): Promise<MarketAnalysis> {
    // Calculate time range based on interval
    const now = new Date();
    const candleCount = 250;
    const intervalMs = this.intervalToMs(interval);
    const from = new Date(now.getTime() - candleCount * intervalMs);

    const candles = await this.lnMarkets.getCandles({
      from: from.toISOString(),
      to: now.toISOString(),
      interval,
    });

    if (candles.length < 200) {
      throw new Error(`Not enough candles for analysis: ${candles.length}`);
    }

    const ohlcv = candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));

    const technicalSummary = this.ta.analyze(ohlcv);
    const patterns = this.ta.detectPatterns(ohlcv);
    const supportResistance = this.ta.calculateSupportResistance(ohlcv);

    const currentPrice = candles[candles.length - 1].close;
    const recommendation = this.generateRecommendation(technicalSummary, patterns, currentPrice);

    return {
      timestamp: new Date(),
      price: currentPrice,
      technicalSummary,
      patterns,
      supportResistance,
      recommendation,
    };
  }

  private generateRecommendation(
    summary: TechnicalSummary,
    patterns: string[],
    price: number
  ): MarketAnalysis['recommendation'] {
    let action: MarketAnalysis['recommendation']['action'] = 'hold';
    let confidence = Math.abs(summary.score);
    let reasons: string[] = [];

    // Primary signal from TA
    if (summary.signal === 'strong_buy' || summary.signal === 'buy') {
      action = 'long';
      reasons.push(`TA signal: ${summary.signal}`);
    } else if (summary.signal === 'strong_sell' || summary.signal === 'sell') {
      action = 'short';
      reasons.push(`TA signal: ${summary.signal}`);
    }

    // Trend confirmation
    if (summary.trend.trend === 'bullish' && summary.trend.strength > 25) {
      if (action === 'long') confidence += 10;
      reasons.push(`Strong bullish trend (ADX: ${summary.trend.strength.toFixed(1)})`);
    } else if (summary.trend.trend === 'bearish' && summary.trend.strength > 25) {
      if (action === 'short') confidence += 10;
      reasons.push(`Strong bearish trend (ADX: ${summary.trend.strength.toFixed(1)})`);
    }

    // Momentum confirmation
    if (summary.momentum.momentum === 'oversold' && action === 'long') {
      confidence += 15;
      reasons.push(`Oversold RSI: ${summary.indicators.rsi.toFixed(1)}`);
    } else if (summary.momentum.momentum === 'overbought' && action === 'short') {
      confidence += 15;
      reasons.push(`Overbought RSI: ${summary.indicators.rsi.toFixed(1)}`);
    }

    // Pattern confirmation
    if (patterns.includes('bullish_engulfing') && action === 'long') {
      confidence += 10;
      reasons.push('Bullish engulfing pattern');
    } else if (patterns.includes('bearish_engulfing') && action === 'short') {
      confidence += 10;
      reasons.push('Bearish engulfing pattern');
    }

    if (patterns.includes('hammer') && action === 'long') {
      confidence += 5;
      reasons.push('Hammer candle');
    } else if (patterns.includes('shooting_star') && action === 'short') {
      confidence += 5;
      reasons.push('Shooting star candle');
    }

    // Exit signals
    if (summary.momentum.momentum === 'overbought' && action === 'hold') {
      action = 'close_longs';
      reasons.push('Overbought conditions - consider taking profits');
    } else if (summary.momentum.momentum === 'oversold' && action === 'hold') {
      action = 'close_shorts';
      reasons.push('Oversold conditions - consider covering shorts');
    }

    // Cap confidence
    confidence = Math.min(100, confidence);

    return {
      action,
      confidence,
      reason: reasons.join('; '),
    };
  }

  private generateCombinedRecommendation() {
    const analyses = Array.from(this.lastAnalysis.values());

    if (analyses.length === 0) {
      return { action: 'hold', confidence: 0, reason: 'No analysis available' };
    }

    // Weight longer timeframes more
    const weights: Record<string, number> = {
      '1h': 1,
      '4h': 2,
      '1d': 3,
    };

    let longScore = 0;
    let shortScore = 0;
    let totalWeight = 0;

    for (const [interval, analysis] of this.lastAnalysis) {
      const weight = weights[interval] || 1;
      totalWeight += weight;

      if (analysis.recommendation.action === 'long') {
        longScore += weight * (analysis.recommendation.confidence / 100);
      } else if (analysis.recommendation.action === 'short') {
        shortScore += weight * (analysis.recommendation.confidence / 100);
      }
    }

    const normalizedLong = (longScore / totalWeight) * 100;
    const normalizedShort = (shortScore / totalWeight) * 100;

    let action: 'long' | 'short' | 'hold' = 'hold';
    let confidence = 0;

    if (normalizedLong > this.agentConfig.minConfidence && normalizedLong > normalizedShort) {
      action = 'long';
      confidence = normalizedLong;
    } else if (
      normalizedShort > this.agentConfig.minConfidence &&
      normalizedShort > normalizedLong
    ) {
      action = 'short';
      confidence = normalizedShort;
    }

    return {
      action,
      confidence,
      timeframes: Object.fromEntries(
        Array.from(this.lastAnalysis.entries()).map(([k, v]) => [k, v.recommendation])
      ),
    };
  }

  private intervalToMs(interval: string): number {
    const map: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
    };
    return map[interval] || 60 * 60 * 1000;
  }

  // ============ PUBLIC API ============

  getLastAnalysis(interval?: string): MarketAnalysis | Map<string, MarketAnalysis> | undefined {
    if (interval) {
      return this.lastAnalysis.get(interval);
    }
    return this.lastAnalysis;
  }

  async forceAnalysis(): Promise<Map<string, MarketAnalysis>> {
    await this.execute();
    return this.lastAnalysis;
  }

  // ============ SWARM COMMUNICATION ============

  /**
   * Evaluate a trade proposal based on current analysis
   */
  protected async evaluateTradeProposal(proposal: any): Promise<{
    decision: 'approve' | 'reject' | 'abstain';
    confidence: number;
    reason: string;
  } | null> {
    const combined = this.generateCombinedRecommendation();
    
    if (combined.action === 'hold') {
      return {
        decision: 'abstain',
        confidence: 50,
        reason: 'Market conditions do not favor a clear direction',
      };
    }

    const agrees = combined.action === proposal.direction;
    
    return {
      decision: agrees ? 'approve' : 'reject',
      confidence: combined.confidence,
      reason: agrees 
        ? `Technical analysis supports ${proposal.direction} with ${combined.confidence.toFixed(0)}% confidence`
        : `Technical analysis suggests ${combined.action}, not ${proposal.direction}`,
    };
  }

  /**
   * Generate chat response about market analysis
   */
  protected async generateChatResponse(query: string): Promise<string | null> {
    const lower = query.toLowerCase();
    
    // Ensure we have recent analysis
    if (this.lastAnalysis.size === 0) {
      try {
        await this.execute();
      } catch (e) {
        return `I don't have current analysis available. Error: ${e}`;
      }
    }

    // Build response based on query
    const parts: string[] = [`**📊 Market Analyst Report**\n`];
    
    for (const [interval, analysis] of this.lastAnalysis) {
      const rec = analysis.recommendation;
      const trend = analysis.technicalSummary.trend;
      const indicators = analysis.technicalSummary.indicators;
      
      parts.push(`**${interval.toUpperCase()} Timeframe:**`);
      parts.push(`• Signal: ${analysis.technicalSummary.signal} (score: ${analysis.technicalSummary.score})`);
      parts.push(`• Trend: ${trend.trend} (strength: ${trend.strength.toFixed(1)})`);
      parts.push(`• RSI: ${indicators.rsi.toFixed(1)} | MACD: ${indicators.macd.histogram > 0 ? '📈' : '📉'}`);
      parts.push(`• Recommendation: **${rec.action.toUpperCase()}** (${rec.confidence.toFixed(0)}% confidence)`);
      parts.push(`• Reason: ${rec.reason}\n`);
    }

    const combined = this.generateCombinedRecommendation();
    parts.push(`**Overall Recommendation:** ${combined.action.toUpperCase()} @ ${combined.confidence.toFixed(0)}% confidence`);

    return parts.join('\n');
  }

  /**
   * Get trade opinion for consensus
   */
  protected async getTradeOpinion(
    direction: 'long' | 'short',
    context?: string
  ): Promise<{
    opinion: 'approve' | 'reject' | 'neutral';
    confidence: number;
    reason: string;
  }> {
    const combined = this.generateCombinedRecommendation();

    if (combined.action === 'hold' || combined.confidence < 50) {
      return {
        opinion: 'neutral',
        confidence: combined.confidence,
        reason: 'Technical signals are mixed or weak',
      };
    }

    const agrees = combined.action === direction;
    return {
      opinion: agrees ? 'approve' : 'reject',
      confidence: combined.confidence,
      reason: agrees
        ? `TA supports ${direction}: ${JSON.stringify(combined.timeframes)}`
        : `TA suggests ${combined.action} instead of ${direction}`,
    };
  }
}
