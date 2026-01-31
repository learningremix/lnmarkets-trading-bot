/**
 * Researcher Agent
 * Gathers market news, sentiment, and on-chain data for Bitcoin analysis
 */

import { BaseAgent, AgentConfig } from './base-agent';

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: Date;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  relevance: number; // 0-100
  summary?: string;
}

export interface MarketSentiment {
  overall: 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';
  score: number; // 0-100
  indicators: {
    fearGreedIndex?: number;
    socialSentiment?: number;
    newsWeight?: number;
    volatility?: number;
    momentum?: number;
    dominance?: number;
  };
}

export interface OnChainMetrics {
  timestamp: Date;
  hashRate?: number;
  difficulty?: number;
  mempoolSize?: number;
  avgFee?: number;
  activeAddresses?: number;
  exchangeNetflows?: number; // Positive = inflow (bearish), Negative = outflow (bullish)
}

export interface ResearchReport {
  timestamp: Date;
  news: NewsItem[];
  sentiment: MarketSentiment;
  onChain?: OnChainMetrics;
  summary: string;
  recommendation: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  keyEvents: string[];
}

export interface ResearcherConfig extends Partial<AgentConfig> {
  id: string;
  name: string;
  newsApiKey?: string;
  cryptoCompareKey?: string;
  enableOnChain: boolean;
}

export class ResearcherAgent extends BaseAgent {
  private researchConfig: ResearcherConfig;
  private lastReport: ResearchReport | null = null;
  private newsCache: NewsItem[] = [];

  constructor(config: ResearcherConfig) {
    super({
      ...config,
      intervalMs: config.intervalMs || 15 * 60 * 1000, // 15 minutes default
    });

    this.researchConfig = {
      enableOnChain: false,
      ...config,
    };
  }

  getType(): string {
    return 'researcher';
  }

  async execute(): Promise<void> {
    this.log('info', 'Starting research cycle');

    try {
      const [news, sentiment, onChain] = await Promise.all([
        this.fetchNews(),
        this.analyzeSentiment(),
        this.researchConfig.enableOnChain ? this.fetchOnChainMetrics() : Promise.resolve(undefined),
      ]);

      const report = this.generateReport(news, sentiment, onChain);
      this.lastReport = report;

      this.emit('report', report);
      this.log('info', 'Research report generated', {
        newsCount: news.length,
        sentiment: sentiment.overall,
        recommendation: report.recommendation,
      });
    } catch (error) {
      this.log('error', 'Research cycle failed', error);
      throw error;
    }
  }

  // ============ NEWS FETCHING ============

  private async fetchNews(): Promise<NewsItem[]> {
    const news: NewsItem[] = [];

    // Fetch from multiple sources
    try {
      // Public Bitcoin news feeds (example - would need actual API integration)
      const sources = [
        { name: 'CoinDesk', weight: 1.0 },
        { name: 'CoinTelegraph', weight: 0.9 },
        { name: 'Bitcoin Magazine', weight: 0.95 },
      ];

      // For now, generate simulated news based on recent market conditions
      // In production, integrate with actual news APIs
      const simulatedNews = await this.fetchSimulatedNews();
      news.push(...simulatedNews);

      // Cache news
      this.newsCache = [...news, ...this.newsCache.slice(0, 100)];
    } catch (error) {
      this.log('warn', 'Failed to fetch news', error);
    }

    return news;
  }

  private async fetchSimulatedNews(): Promise<NewsItem[]> {
    // This would be replaced with actual API calls in production
    // For demonstration, we'll simulate based on time-based patterns

    const now = new Date();
    const items: NewsItem[] = [];

    // Simulate a mix of news items
    const templates = [
      {
        title: 'Bitcoin institutional adoption continues to grow',
        sentiment: 'bullish' as const,
        relevance: 85,
      },
      {
        title: 'Federal Reserve signals interest rate decision',
        sentiment: 'neutral' as const,
        relevance: 75,
      },
      {
        title: 'Major exchange reports record trading volume',
        sentiment: 'bullish' as const,
        relevance: 70,
      },
      {
        title: 'Regulatory developments in major markets',
        sentiment: 'neutral' as const,
        relevance: 80,
      },
    ];

    for (let i = 0; i < 3; i++) {
      const template = templates[i % templates.length];
      items.push({
        id: `news-${now.getTime()}-${i}`,
        title: template.title,
        source: 'Market Analysis',
        url: '#',
        publishedAt: new Date(now.getTime() - i * 60 * 60 * 1000),
        sentiment: template.sentiment,
        relevance: template.relevance,
      });
    }

    return items;
  }

  // ============ SENTIMENT ANALYSIS ============

  private async analyzeSentiment(): Promise<MarketSentiment> {
    // Aggregate sentiment from multiple sources
    const indicators: MarketSentiment['indicators'] = {};

    try {
      // Fear & Greed Index (public API)
      const fgi = await this.fetchFearGreedIndex();
      if (fgi !== null) {
        indicators.fearGreedIndex = fgi;
      }

      // News-based sentiment
      const newsScore = this.calculateNewsSentiment();
      indicators.newsWeight = newsScore;

      // Calculate overall sentiment
      const avgScore = this.calculateAverageScore(indicators);
      const overall = this.scoreToSentiment(avgScore);

      return {
        overall,
        score: avgScore,
        indicators,
      };
    } catch (error) {
      this.log('warn', 'Sentiment analysis incomplete', error);
      return {
        overall: 'neutral',
        score: 50,
        indicators,
      };
    }
  }

  private async fetchFearGreedIndex(): Promise<number | null> {
    try {
      // Public Fear & Greed API
      const response = await fetch('https://api.alternative.me/fng/?limit=1');
      if (response.ok) {
        const data = await response.json();
        return parseInt(data.data[0].value, 10);
      }
    } catch (error) {
      this.log('debug', 'Failed to fetch Fear & Greed Index', error);
    }
    return null;
  }

  private calculateNewsSentiment(): number {
    if (this.newsCache.length === 0) return 50;

    const recentNews = this.newsCache.filter(
      (n) => n.publishedAt.getTime() > Date.now() - 24 * 60 * 60 * 1000
    );

    if (recentNews.length === 0) return 50;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const news of recentNews) {
      const weight = news.relevance / 100;
      const sentimentScore =
        news.sentiment === 'bullish' ? 75 : news.sentiment === 'bearish' ? 25 : 50;

      weightedSum += sentimentScore * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 50;
  }

  private calculateAverageScore(indicators: MarketSentiment['indicators']): number {
    const values = Object.values(indicators).filter((v) => v !== undefined) as number[];
    if (values.length === 0) return 50;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private scoreToSentiment(
    score: number
  ): 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed' {
    if (score <= 20) return 'extreme_fear';
    if (score <= 40) return 'fear';
    if (score <= 60) return 'neutral';
    if (score <= 80) return 'greed';
    return 'extreme_greed';
  }

  // ============ ON-CHAIN METRICS ============

  private async fetchOnChainMetrics(): Promise<OnChainMetrics | undefined> {
    try {
      // This would integrate with on-chain data providers like:
      // - Glassnode (paid)
      // - CryptoQuant (paid)
      // - Blockchain.com API (free, limited)

      // For demonstration, return placeholder data
      return {
        timestamp: new Date(),
        hashRate: undefined,
        difficulty: undefined,
        mempoolSize: undefined,
        avgFee: undefined,
        activeAddresses: undefined,
        exchangeNetflows: undefined,
      };
    } catch (error) {
      this.log('debug', 'On-chain metrics fetch failed', error);
      return undefined;
    }
  }

  // ============ REPORT GENERATION ============

  private generateReport(
    news: NewsItem[],
    sentiment: MarketSentiment,
    onChain?: OnChainMetrics
  ): ResearchReport {
    const keyEvents: string[] = [];

    // Extract key events from high-relevance news
    news
      .filter((n) => n.relevance > 80)
      .forEach((n) => {
        keyEvents.push(n.title);
      });

    // Determine recommendation
    let recommendation: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let confidence = 50;

    if (sentiment.score >= 60) {
      recommendation = 'bullish';
      confidence = Math.min(90, sentiment.score);
    } else if (sentiment.score <= 40) {
      recommendation = 'bearish';
      confidence = Math.min(90, 100 - sentiment.score);
    }

    // Contrarian adjustment for extreme sentiment
    if (sentiment.overall === 'extreme_greed') {
      // Market might be due for correction
      recommendation = 'neutral';
      keyEvents.push('⚠️ Extreme greed - potential reversal risk');
    } else if (sentiment.overall === 'extreme_fear') {
      // Possible buying opportunity
      recommendation = 'bullish';
      keyEvents.push('📈 Extreme fear - potential buying opportunity');
    }

    // Generate summary
    const summary = this.generateSummary(sentiment, news.length, keyEvents.length);

    return {
      timestamp: new Date(),
      news,
      sentiment,
      onChain,
      summary,
      recommendation,
      confidence,
      keyEvents,
    };
  }

  private generateSummary(
    sentiment: MarketSentiment,
    newsCount: number,
    eventCount: number
  ): string {
    const sentimentText = {
      extreme_fear: 'Market is in extreme fear',
      fear: 'Market sentiment is fearful',
      neutral: 'Market sentiment is neutral',
      greed: 'Market sentiment is greedy',
      extreme_greed: 'Market is in extreme greed',
    };

    return `${sentimentText[sentiment.overall]} (score: ${sentiment.score}). ` +
      `Analyzed ${newsCount} news items. ` +
      `${eventCount} key events identified.`;
  }

  // ============ PUBLIC API ============

  getLastReport(): ResearchReport | null {
    return this.lastReport;
  }

  getRecentNews(limit = 20): NewsItem[] {
    return this.newsCache.slice(0, limit);
  }

  async forceResearch(): Promise<ResearchReport | null> {
    await this.execute();
    return this.lastReport;
  }

  // ============ MARKET EVENT DETECTION ============

  async checkForMarketEvents(): Promise<string[]> {
    const events: string[] = [];

    // Check for significant price movements
    // This would integrate with price monitoring

    // Check for news spikes
    const recentNews = this.newsCache.filter(
      (n) => n.publishedAt.getTime() > Date.now() - 60 * 60 * 1000 // Last hour
    );

    if (recentNews.length > 5) {
      events.push('High news activity detected');
    }

    const bearishNews = recentNews.filter((n) => n.sentiment === 'bearish');
    if (bearishNews.length >= 3) {
      events.push('Multiple bearish news items');
    }

    const bullishNews = recentNews.filter((n) => n.sentiment === 'bullish');
    if (bullishNews.length >= 3) {
      events.push('Multiple bullish news items');
    }

    return events;
  }
}
