/**
 * Trading Agents - Export all agents
 */

export { BaseAgent, type AgentConfig, type AgentLog, type AgentMetrics, type AgentStatus } from './base-agent';
export { MarketAnalystAgent, type MarketAnalysis, type MarketAnalystConfig } from './market-analyst';
export { RiskManagerAgent, type RiskAssessment, type RiskAlert, type RiskParameters, type PositionSizing, type RiskManagerConfig } from './risk-manager';
export { ExecutionAgent, type TradeSignal, type ExecutedTrade, type ExecutionConfig } from './execution-agent';
export { ResearcherAgent, type NewsItem, type MarketSentiment, type ResearchReport, type ResearcherConfig } from './researcher-agent';
export { TradingViewAgent, type TVSignal, type TVAnalysis, type TradingViewConfig } from './tradingview-agent';
export { SwarmCoordinator, getSwarmCoordinator, createSwarmCoordinator, type SwarmConfig, type SwarmStatus } from './swarm-coordinator';
