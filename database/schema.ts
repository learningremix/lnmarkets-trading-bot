/**
 * Database Schema - Trade history, settings, and agent state
 */

import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  real,
  json,
  varchar,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ============ TRADES ============

export const trades = pgTable('trades', {
  id: serial('id').primaryKey(),
  externalId: varchar('external_id', { length: 100 }).notNull(), // LN Markets trade ID
  signalId: varchar('signal_id', { length: 100 }),
  direction: varchar('direction', { length: 10 }).notNull(), // 'long' | 'short'
  entryPrice: real('entry_price').notNull(),
  exitPrice: real('exit_price'),
  margin: integer('margin').notNull(), // in satoshis
  leverage: integer('leverage').notNull(),
  quantity: real('quantity'),
  stopLoss: real('stop_loss'),
  takeProfit: real('take_profit'),
  pnl: integer('pnl'), // in satoshis
  pnlPercent: real('pnl_percent'),
  status: varchar('status', { length: 20 }).notNull().default('open'), // 'open' | 'closed' | 'cancelled'
  closeReason: varchar('close_reason', { length: 100 }),
  source: varchar('source', { length: 50 }), // 'manual' | 'market-analyst' | 'signal'
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  closedAt: timestamp('closed_at'),
}, (table) => ({
  externalIdIdx: uniqueIndex('trades_external_id_idx').on(table.externalId),
  statusIdx: index('trades_status_idx').on(table.status),
  createdAtIdx: index('trades_created_at_idx').on(table.createdAt),
}));

// ============ SIGNALS ============

export const signals = pgTable('signals', {
  id: serial('id').primaryKey(),
  signalId: varchar('signal_id', { length: 100 }).notNull(),
  direction: varchar('direction', { length: 10 }).notNull(),
  price: real('price').notNull(),
  confidence: integer('confidence').notNull(),
  source: varchar('source', { length: 50 }).notNull(),
  reason: text('reason'),
  executed: boolean('executed').default(false),
  tradeId: integer('trade_id').references(() => trades.id),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  signalIdIdx: uniqueIndex('signals_signal_id_idx').on(table.signalId),
  createdAtIdx: index('signals_created_at_idx').on(table.createdAt),
}));

// ============ DAILY PERFORMANCE ============

export const dailyPerformance = pgTable('daily_performance', {
  id: serial('id').primaryKey(),
  date: timestamp('date').notNull(),
  startBalance: integer('start_balance').notNull(),
  endBalance: integer('end_balance').notNull(),
  pnl: integer('pnl').notNull(),
  pnlPercent: real('pnl_percent').notNull(),
  tradesCount: integer('trades_count').default(0),
  winCount: integer('win_count').default(0),
  lossCount: integer('loss_count').default(0),
  largestWin: integer('largest_win'),
  largestLoss: integer('largest_loss'),
  avgWin: integer('avg_win'),
  avgLoss: integer('avg_loss'),
  maxDrawdown: real('max_drawdown'),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  dateIdx: uniqueIndex('daily_performance_date_idx').on(table.date),
}));

// ============ AGENT LOGS ============

export const agentLogs = pgTable('agent_logs', {
  id: serial('id').primaryKey(),
  agentId: varchar('agent_id', { length: 50 }).notNull(),
  level: varchar('level', { length: 10 }).notNull(), // 'info' | 'warn' | 'error' | 'debug'
  message: text('message').notNull(),
  data: json('data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  agentIdIdx: index('agent_logs_agent_id_idx').on(table.agentId),
  createdAtIdx: index('agent_logs_created_at_idx').on(table.createdAt),
  levelIdx: index('agent_logs_level_idx').on(table.level),
}));

// ============ SETTINGS ============

export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull(),
  value: json('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  keyIdx: uniqueIndex('settings_key_idx').on(table.key),
}));

// ============ MARKET ANALYSIS SNAPSHOTS ============

export const analysisSnapshots = pgTable('analysis_snapshots', {
  id: serial('id').primaryKey(),
  timeframe: varchar('timeframe', { length: 10 }).notNull(), // '1h' | '4h' | '1d'
  price: real('price').notNull(),
  signal: varchar('signal', { length: 20 }).notNull(),
  score: integer('score').notNull(),
  trendDirection: varchar('trend_direction', { length: 20 }),
  trendStrength: real('trend_strength'),
  rsi: real('rsi'),
  macdHistogram: real('macd_histogram'),
  patterns: json('patterns'),
  recommendation: varchar('recommendation', { length: 20 }),
  confidence: integer('confidence'),
  fullAnalysis: json('full_analysis'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  timeframeIdx: index('analysis_snapshots_timeframe_idx').on(table.timeframe),
  createdAtIdx: index('analysis_snapshots_created_at_idx').on(table.createdAt),
}));

// ============ RISK ASSESSMENTS ============

export const riskAssessments = pgTable('risk_assessments', {
  id: serial('id').primaryKey(),
  balance: integer('balance').notNull(),
  totalExposure: integer('total_exposure').notNull(),
  exposurePercent: real('exposure_percent').notNull(),
  dailyPL: integer('daily_pl').notNull(),
  dailyPLPercent: real('daily_pl_percent').notNull(),
  openPositionsCount: integer('open_positions_count').default(0),
  alerts: json('alerts'),
  canOpenNewPosition: boolean('can_open_new_position').default(true),
  availableMargin: integer('available_margin'),
  fullAssessment: json('full_assessment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index('risk_assessments_created_at_idx').on(table.createdAt),
}));

// ============ TYPE EXPORTS ============

export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;

export type Signal = typeof signals.$inferSelect;
export type NewSignal = typeof signals.$inferInsert;

export type DailyPerformance = typeof dailyPerformance.$inferSelect;
export type NewDailyPerformance = typeof dailyPerformance.$inferInsert;

export type AgentLog = typeof agentLogs.$inferSelect;
export type NewAgentLog = typeof agentLogs.$inferInsert;

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

export type AnalysisSnapshot = typeof analysisSnapshots.$inferSelect;
export type NewAnalysisSnapshot = typeof analysisSnapshots.$inferInsert;

export type RiskAssessment = typeof riskAssessments.$inferSelect;
export type NewRiskAssessment = typeof riskAssessments.$inferInsert;
