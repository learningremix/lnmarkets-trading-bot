/**
 * TradingView Signal Agent
 * Fetches signals from TradingView Technical Analysis API
 * Based on: https://github.com/RielBitcoin/TradingView_Technical_Analysis_API
 */

import { BaseAgent, type AgentConfig } from './base-agent';

export type TVSignal = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';

export interface TVAnalysis {
  timestamp: Date;
  timeframe: string;
  recommendation: TVSignal;
  buy: number;
  sell: number;
  neutral: number;
  oscillators: {
    recommendation: TVSignal;
    buy: number;
    sell: number;
    neutral: number;
  };
  movingAverages: {
    recommendation: TVSignal;
    buy: number;
    sell: number;
    neutral: number;
  };
  indicators?: Record<string, any>;
}

export interface TradingViewConfig {
  id: string;
  name: string;
  enabled?: boolean;
  intervalMs?: number;
  apiUrl: string;
  symbol: string;
  exchange: string;
  timeframes: string[];
  requireStrongSignal: boolean;
}

export class TradingViewAgent extends BaseAgent {
  private tvConfig: TradingViewConfig;
  private lastAnalysis: Map<string, TVAnalysis> = new Map();
  private currentSignal: TVSignal = 'NEUTRAL';

  constructor(config: TradingViewConfig) {
    super({
      id: config.id,
      name: config.name,
      enabled: config.enabled ?? true,
      intervalMs: config.intervalMs || 60 * 1000, // 1 minute default
      maxRetries: 3,
      timeoutMs: 30000,
    });

    this.tvConfig = config;
  }

  getType(): string {
    return 'tradingview';
  }

  async execute(): Promise<void> {
    this.log('info', 'Fetching TradingView signals');

    for (const timeframe of this.tvConfig.timeframes) {
      try {
        const analysis = await this.fetchSignal(timeframe);
        this.lastAnalysis.set(timeframe, analysis);
        this.emit('signal', { timeframe, analysis });
        this.log('info', `${timeframe} signal: ${analysis.recommendation}`, {
          buy: analysis.buy,
          sell: analysis.sell,
          neutral: analysis.neutral,
        });
      } catch (error) {
        this.log('error', `Failed to fetch ${timeframe} signal`, error);
      }
    }

    // Determine combined signal
    this.currentSignal = this.calculateCombinedSignal();
    this.emit('combined_signal', this.currentSignal);
  }

  private async fetchSignal(timeframe: string): Promise<TVAnalysis> {
    const url = `${this.tvConfig.apiUrl}/${this.tvConfig.symbol}/crypto/${this.tvConfig.exchange}/${timeframe}`;
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'LNMarkets-Trading-Bot' },
    });

    if (!response.ok) {
      throw new Error(`TradingView API error: ${response.status}`);
    }

    const data: any = await response.json();

    return {
      timestamp: new Date(),
      timeframe,
      recommendation: this.parseRecommendation(data.RECOMMENDATION),
      buy: data.BUY || 0,
      sell: data.SELL || 0,
      neutral: data.NEUTRAL || 0,
      oscillators: {
        recommendation: this.parseRecommendation(data.OSCILLATORS?.RECOMMENDATION),
        buy: data.OSCILLATORS?.BUY || 0,
        sell: data.OSCILLATORS?.SELL || 0,
        neutral: data.OSCILLATORS?.NEUTRAL || 0,
      },
      movingAverages: {
        recommendation: this.parseRecommendation(data.MOVING_AVERAGES?.RECOMMENDATION),
        buy: data.MOVING_AVERAGES?.BUY || 0,
        sell: data.MOVING_AVERAGES?.SELL || 0,
        neutral: data.MOVING_AVERAGES?.NEUTRAL || 0,
      },
      indicators: data,
    };
  }

  private parseRecommendation(rec: string | undefined): TVSignal {
    if (!rec) return 'NEUTRAL';
    const upper = rec.toUpperCase();
    if (upper === 'STRONG_BUY') return 'STRONG_BUY';
    if (upper === 'BUY') return 'BUY';
    if (upper === 'STRONG_SELL') return 'STRONG_SELL';
    if (upper === 'SELL') return 'SELL';
    return 'NEUTRAL';
  }

  private calculateCombinedSignal(): TVSignal {
    if (this.lastAnalysis.size === 0) return 'NEUTRAL';

    let buyScore = 0;
    let sellScore = 0;

    for (const [timeframe, analysis] of this.lastAnalysis) {
      // Weight longer timeframes more heavily
      const weight = timeframe.includes('1d') ? 3 : timeframe.includes('4h') ? 2 : 1;

      if (analysis.recommendation === 'STRONG_BUY') buyScore += 2 * weight;
      else if (analysis.recommendation === 'BUY') buyScore += 1 * weight;
      else if (analysis.recommendation === 'STRONG_SELL') sellScore += 2 * weight;
      else if (analysis.recommendation === 'SELL') sellScore += 1 * weight;
    }

    const threshold = this.tvConfig.requireStrongSignal ? 4 : 2;

    if (buyScore >= threshold * 2) return 'STRONG_BUY';
    if (buyScore >= threshold) return 'BUY';
    if (sellScore >= threshold * 2) return 'STRONG_SELL';
    if (sellScore >= threshold) return 'SELL';
    return 'NEUTRAL';
  }

  // ============ PUBLIC API ============

  getCurrentSignal(): TVSignal {
    return this.currentSignal;
  }

  getLastAnalysis(timeframe?: string): TVAnalysis | Map<string, TVAnalysis> | undefined {
    if (timeframe) {
      return this.lastAnalysis.get(timeframe);
    }
    return this.lastAnalysis;
  }

  async forceUpdate(): Promise<TVSignal> {
    await this.execute();
    return this.currentSignal;
  }

  getTVConfig(): TradingViewConfig {
    return { ...this.tvConfig };
  }

  updateTVConfig(updates: Partial<TradingViewConfig>): void {
    this.tvConfig = { ...this.tvConfig, ...updates };
    this.log('info', 'TradingView config updated', updates);
  }
}
