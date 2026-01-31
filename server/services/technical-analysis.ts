/**
 * Technical Analysis Service
 * Bitcoin-focused indicators and signals
 */

import {
  SMA,
  EMA,
  RSI,
  MACD,
  BollingerBands,
  ADX,
  ATR,
  Stochastic,
  OBV,
  VWAP,
  WilliamsR,
  CCI,
  ROC,
  MFI,
} from 'technicalindicators';

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TrendSignal {
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0-100
  confidence: number; // 0-100
}

export interface MomentumSignal {
  momentum: 'overbought' | 'oversold' | 'neutral';
  value: number;
  divergence: boolean;
}

export interface VolatilitySignal {
  volatility: 'high' | 'medium' | 'low';
  atr: number;
  atrPercent: number;
  squeeze: boolean;
}

export interface SupportResistance {
  supports: number[];
  resistances: number[];
  pivot: number;
}

export interface TechnicalSummary {
  signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  score: number; // -100 to 100
  trend: TrendSignal;
  momentum: MomentumSignal;
  volatility: VolatilitySignal;
  indicators: {
    sma20: number;
    sma50: number;
    sma200: number;
    ema9: number;
    ema21: number;
    rsi: number;
    macd: { macd: number; signal: number; histogram: number };
    bollinger: { upper: number; middle: number; lower: number };
    adx: number;
    atr: number;
    stochastic: { k: number; d: number };
    williamsR: number;
    cci: number;
    obv: number;
    mfi: number;
  };
  priceAction: {
    currentPrice: number;
    priceVsSma20: number;
    priceVsSma50: number;
    priceVsSma200: number;
    distanceFromBBUpper: number;
    distanceFromBBLower: number;
  };
}

export class TechnicalAnalysisService {
  /**
   * Calculate all technical indicators and generate a summary
   */
  analyze(candles: OHLCV[]): TechnicalSummary {
    if (candles.length < 200) {
      throw new Error('Need at least 200 candles for full analysis');
    }

    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const volumes = candles.map((c) => c.volume);
    const currentPrice = closes[closes.length - 1];

    // Moving Averages
    const sma20Values = SMA.calculate({ period: 20, values: closes });
    const sma50Values = SMA.calculate({ period: 50, values: closes });
    const sma200Values = SMA.calculate({ period: 200, values: closes });
    const ema9Values = EMA.calculate({ period: 9, values: closes });
    const ema21Values = EMA.calculate({ period: 21, values: closes });

    const sma20 = sma20Values[sma20Values.length - 1];
    const sma50 = sma50Values[sma50Values.length - 1];
    const sma200 = sma200Values[sma200Values.length - 1];
    const ema9 = ema9Values[ema9Values.length - 1];
    const ema21 = ema21Values[ema21Values.length - 1];

    // RSI
    const rsiValues = RSI.calculate({ period: 14, values: closes });
    const rsi = rsiValues[rsiValues.length - 1];

    // MACD
    const macdResult = MACD.calculate({
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
      values: closes,
    });
    const macd = macdResult[macdResult.length - 1];

    // Bollinger Bands
    const bbResult = BollingerBands.calculate({
      period: 20,
      stdDev: 2,
      values: closes,
    });
    const bollinger = bbResult[bbResult.length - 1];

    // ADX
    const adxResult = ADX.calculate({
      period: 14,
      close: closes,
      high: highs,
      low: lows,
    });
    const adx = adxResult[adxResult.length - 1]?.adx || 0;

    // ATR
    const atrResult = ATR.calculate({
      period: 14,
      close: closes,
      high: highs,
      low: lows,
    });
    const atr = atrResult[atrResult.length - 1];

    // Stochastic
    const stochResult = Stochastic.calculate({
      period: 14,
      signalPeriod: 3,
      high: highs,
      low: lows,
      close: closes,
    });
    const stoch = stochResult[stochResult.length - 1];

    // Williams %R
    const williamsResult = WilliamsR.calculate({
      period: 14,
      high: highs,
      low: lows,
      close: closes,
    });
    const williamsR = williamsResult[williamsResult.length - 1];

    // CCI
    const cciResult = CCI.calculate({
      period: 20,
      high: highs,
      low: lows,
      close: closes,
    });
    const cci = cciResult[cciResult.length - 1];

    // OBV
    const obvResult = OBV.calculate({
      close: closes,
      volume: volumes,
    });
    const obv = obvResult[obvResult.length - 1];

    // MFI
    const mfiResult = MFI.calculate({
      period: 14,
      high: highs,
      low: lows,
      close: closes,
      volume: volumes,
    });
    const mfi = mfiResult[mfiResult.length - 1];

    // Trend Analysis
    const trend = this.analyzeTrend(currentPrice, sma20, sma50, sma200, ema9, ema21, adx);

    // Momentum Analysis
    const momentum = this.analyzeMomentum(rsi, stoch, williamsR, mfi);

    // Volatility Analysis
    const volatility = this.analyzeVolatility(atr, currentPrice, bollinger);

    // Price Action
    const priceAction = {
      currentPrice,
      priceVsSma20: ((currentPrice - sma20) / sma20) * 100,
      priceVsSma50: ((currentPrice - sma50) / sma50) * 100,
      priceVsSma200: ((currentPrice - sma200) / sma200) * 100,
      distanceFromBBUpper: ((bollinger.upper - currentPrice) / currentPrice) * 100,
      distanceFromBBLower: ((currentPrice - bollinger.lower) / currentPrice) * 100,
    };

    // Calculate overall score
    const score = this.calculateOverallScore(trend, momentum, priceAction, macd, cci);
    const signal = this.scoreToSignal(score);

    return {
      signal,
      score,
      trend,
      momentum,
      volatility,
      indicators: {
        sma20,
        sma50,
        sma200,
        ema9,
        ema21,
        rsi,
        macd: {
          macd: macd?.MACD || 0,
          signal: macd?.signal || 0,
          histogram: macd?.histogram || 0,
        },
        bollinger: {
          upper: bollinger.upper,
          middle: bollinger.middle,
          lower: bollinger.lower,
        },
        adx,
        atr,
        stochastic: { k: stoch?.k || 0, d: stoch?.d || 0 },
        williamsR,
        cci,
        obv,
        mfi,
      },
      priceAction,
    };
  }

  /**
   * Quick analysis with fewer candles (min 50)
   */
  quickAnalysis(candles: OHLCV[]): {
    signal: 'buy' | 'sell' | 'neutral';
    rsi: number;
    macdHistogram: number;
    ema9CrossEma21: 'above' | 'below';
  } {
    if (candles.length < 50) {
      throw new Error('Need at least 50 candles for quick analysis');
    }

    const closes = candles.map((c) => c.close);

    const rsiValues = RSI.calculate({ period: 14, values: closes });
    const rsi = rsiValues[rsiValues.length - 1];

    const macdResult = MACD.calculate({
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
      values: closes,
    });
    const macd = macdResult[macdResult.length - 1];

    const ema9Values = EMA.calculate({ period: 9, values: closes });
    const ema21Values = EMA.calculate({ period: 21, values: closes });
    const ema9 = ema9Values[ema9Values.length - 1];
    const ema21 = ema21Values[ema21Values.length - 1];

    const ema9CrossEma21 = ema9 > ema21 ? 'above' : 'below';

    let signal: 'buy' | 'sell' | 'neutral' = 'neutral';

    if (rsi < 30 && macd?.histogram > 0 && ema9CrossEma21 === 'above') {
      signal = 'buy';
    } else if (rsi > 70 && macd?.histogram < 0 && ema9CrossEma21 === 'below') {
      signal = 'sell';
    } else if (rsi < 40 && macd?.histogram > 0) {
      signal = 'buy';
    } else if (rsi > 60 && macd?.histogram < 0) {
      signal = 'sell';
    }

    return {
      signal,
      rsi,
      macdHistogram: macd?.histogram || 0,
      ema9CrossEma21,
    };
  }

  /**
   * Calculate support and resistance levels
   */
  calculateSupportResistance(candles: OHLCV[]): SupportResistance {
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const closes = candles.map((c) => c.close);

    // Pivot Point
    const lastCandle = candles[candles.length - 1];
    const pivot = (lastCandle.high + lastCandle.low + lastCandle.close) / 3;

    // Simple pivot-based S/R
    const r1 = 2 * pivot - lastCandle.low;
    const r2 = pivot + (lastCandle.high - lastCandle.low);
    const r3 = lastCandle.high + 2 * (pivot - lastCandle.low);

    const s1 = 2 * pivot - lastCandle.high;
    const s2 = pivot - (lastCandle.high - lastCandle.low);
    const s3 = lastCandle.low - 2 * (lastCandle.high - pivot);

    // Find local highs/lows (swing points)
    const swingHighs: number[] = [];
    const swingLows: number[] = [];

    for (let i = 2; i < candles.length - 2; i++) {
      if (
        highs[i] > highs[i - 1] &&
        highs[i] > highs[i - 2] &&
        highs[i] > highs[i + 1] &&
        highs[i] > highs[i + 2]
      ) {
        swingHighs.push(highs[i]);
      }
      if (
        lows[i] < lows[i - 1] &&
        lows[i] < lows[i - 2] &&
        lows[i] < lows[i + 1] &&
        lows[i] < lows[i + 2]
      ) {
        swingLows.push(lows[i]);
      }
    }

    // Cluster nearby levels
    const clusterLevels = (levels: number[], threshold: number): number[] => {
      const sorted = [...levels].sort((a, b) => a - b);
      const clusters: number[] = [];
      let currentCluster: number[] = [];

      for (const level of sorted) {
        if (currentCluster.length === 0) {
          currentCluster.push(level);
        } else {
          const avg = currentCluster.reduce((a, b) => a + b) / currentCluster.length;
          if (Math.abs(level - avg) / avg < threshold) {
            currentCluster.push(level);
          } else {
            clusters.push(currentCluster.reduce((a, b) => a + b) / currentCluster.length);
            currentCluster = [level];
          }
        }
      }

      if (currentCluster.length > 0) {
        clusters.push(currentCluster.reduce((a, b) => a + b) / currentCluster.length);
      }

      return clusters;
    };

    const clusteredResistances = clusterLevels([...swingHighs, r1, r2, r3], 0.02);
    const clusteredSupports = clusterLevels([...swingLows, s1, s2, s3], 0.02);

    return {
      resistances: clusteredResistances.slice(-5).reverse(),
      supports: clusteredSupports.slice(0, 5),
      pivot,
    };
  }

  /**
   * Detect chart patterns
   */
  detectPatterns(candles: OHLCV[]): string[] {
    const patterns: string[] = [];
    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const last5 = candles.slice(-5);

    // Double Top
    const recentHighs = highs.slice(-50);
    const maxHigh = Math.max(...recentHighs);
    const highOccurrences = recentHighs.filter((h) => Math.abs(h - maxHigh) / maxHigh < 0.02);
    if (highOccurrences.length >= 2) {
      patterns.push('double_top');
    }

    // Double Bottom
    const minLow = Math.min(...lows.slice(-50));
    const lowOccurrences = lows.slice(-50).filter((l) => Math.abs(l - minLow) / minLow < 0.02);
    if (lowOccurrences.length >= 2) {
      patterns.push('double_bottom');
    }

    // Bullish Engulfing
    const prevCandle = last5[last5.length - 2];
    const lastCandle = last5[last5.length - 1];
    if (
      prevCandle.close < prevCandle.open &&
      lastCandle.close > lastCandle.open &&
      lastCandle.close > prevCandle.open &&
      lastCandle.open < prevCandle.close
    ) {
      patterns.push('bullish_engulfing');
    }

    // Bearish Engulfing
    if (
      prevCandle.close > prevCandle.open &&
      lastCandle.close < lastCandle.open &&
      lastCandle.close < prevCandle.open &&
      lastCandle.open > prevCandle.close
    ) {
      patterns.push('bearish_engulfing');
    }

    // Doji
    const bodySize = Math.abs(lastCandle.close - lastCandle.open);
    const wickSize = lastCandle.high - lastCandle.low;
    if (bodySize < wickSize * 0.1) {
      patterns.push('doji');
    }

    // Hammer
    const lowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;
    const upperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
    if (lowerWick > bodySize * 2 && upperWick < bodySize * 0.5) {
      patterns.push('hammer');
    }

    // Shooting Star
    if (upperWick > bodySize * 2 && lowerWick < bodySize * 0.5) {
      patterns.push('shooting_star');
    }

    return patterns;
  }

  // ============ PRIVATE HELPERS ============

  private analyzeTrend(
    price: number,
    sma20: number,
    sma50: number,
    sma200: number,
    ema9: number,
    ema21: number,
    adx: number
  ): TrendSignal {
    let bullishPoints = 0;
    let bearishPoints = 0;

    // Price vs MAs
    if (price > sma20) bullishPoints += 1;
    else bearishPoints += 1;

    if (price > sma50) bullishPoints += 1;
    else bearishPoints += 1;

    if (price > sma200) bullishPoints += 2;
    else bearishPoints += 2;

    // MA alignment (Golden/Death cross)
    if (sma20 > sma50 && sma50 > sma200) bullishPoints += 3;
    else if (sma20 < sma50 && sma50 < sma200) bearishPoints += 3;

    // EMA crossover
    if (ema9 > ema21) bullishPoints += 1;
    else bearishPoints += 1;

    const totalPoints = bullishPoints + bearishPoints;
    const strength = adx;
    const confidence = (Math.max(bullishPoints, bearishPoints) / totalPoints) * 100;

    let trend: 'bullish' | 'bearish' | 'neutral';
    if (bullishPoints > bearishPoints + 2) trend = 'bullish';
    else if (bearishPoints > bullishPoints + 2) trend = 'bearish';
    else trend = 'neutral';

    return { trend, strength, confidence };
  }

  private analyzeMomentum(
    rsi: number,
    stoch: { k: number; d: number },
    williamsR: number,
    mfi: number
  ): MomentumSignal {
    let overboughtCount = 0;
    let oversoldCount = 0;

    if (rsi > 70) overboughtCount++;
    if (rsi < 30) oversoldCount++;

    if (stoch?.k > 80) overboughtCount++;
    if (stoch?.k < 20) oversoldCount++;

    if (williamsR > -20) overboughtCount++;
    if (williamsR < -80) oversoldCount++;

    if (mfi > 80) overboughtCount++;
    if (mfi < 20) oversoldCount++;

    let momentum: 'overbought' | 'oversold' | 'neutral';
    if (overboughtCount >= 2) momentum = 'overbought';
    else if (oversoldCount >= 2) momentum = 'oversold';
    else momentum = 'neutral';

    // Check for divergence (simplified)
    const divergence = false; // Would need price comparison

    return { momentum, value: rsi, divergence };
  }

  private analyzeVolatility(
    atr: number,
    price: number,
    bollinger: { upper: number; middle: number; lower: number }
  ): VolatilitySignal {
    const atrPercent = (atr / price) * 100;
    const bbWidth = ((bollinger.upper - bollinger.lower) / bollinger.middle) * 100;

    let volatility: 'high' | 'medium' | 'low';
    if (atrPercent > 3 || bbWidth > 8) volatility = 'high';
    else if (atrPercent < 1.5 || bbWidth < 4) volatility = 'low';
    else volatility = 'medium';

    // Bollinger Band squeeze detection
    const squeeze = bbWidth < 4;

    return { volatility, atr, atrPercent, squeeze };
  }

  private calculateOverallScore(
    trend: TrendSignal,
    momentum: MomentumSignal,
    priceAction: any,
    macd: any,
    cci: number
  ): number {
    let score = 0;

    // Trend contribution (40%)
    if (trend.trend === 'bullish') score += (trend.confidence / 100) * 40;
    else if (trend.trend === 'bearish') score -= (trend.confidence / 100) * 40;

    // Momentum contribution (30%)
    if (momentum.momentum === 'oversold') score += 20;
    else if (momentum.momentum === 'overbought') score -= 20;

    // Normalize RSI contribution
    score += ((50 - momentum.value) / 50) * 10;

    // MACD contribution (15%)
    if (macd?.histogram > 0) score += 15;
    else if (macd?.histogram < 0) score -= 15;

    // CCI contribution (15%)
    if (cci > 100) score -= 10;
    else if (cci < -100) score += 10;

    return Math.max(-100, Math.min(100, score));
  }

  private scoreToSignal(
    score: number
  ): 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell' {
    if (score >= 50) return 'strong_buy';
    if (score >= 20) return 'buy';
    if (score <= -50) return 'strong_sell';
    if (score <= -20) return 'sell';
    return 'neutral';
  }
}

// Singleton
let taService: TechnicalAnalysisService | null = null;

export function getTechnicalAnalysisService(): TechnicalAnalysisService {
  if (!taService) {
    taService = new TechnicalAnalysisService();
  }
  return taService;
}
