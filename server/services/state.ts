/**
 * State Service - Persist swarm and agent state to database
 * Handles save/load of runtime state for crash recovery
 */

import { getDatabase } from '../../database/context';
import {
  swarmState,
  agentState,
  pendingSignals,
  executedTradesState,
  type SwarmState,
  type AgentState,
} from '../../database/schema';
import { eq } from 'drizzle-orm';

// ============ SWARM STATE ============

export interface SwarmStateData {
  running: boolean;
  autoExecute: boolean;
  config: any;
  lastStartedAt: Date | null;
  lastStoppedAt: Date | null;
}

export async function saveSwarmState(state: Partial<SwarmStateData>): Promise<void> {
  try {
    const db = getDatabase();
    
    await db.insert(swarmState)
      .values({
        key: 'primary',
        running: state.running ?? false,
        autoExecute: state.autoExecute ?? false,
        config: state.config ?? {},
        lastStartedAt: state.lastStartedAt,
        lastStoppedAt: state.lastStoppedAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: swarmState.key,
        set: {
          running: state.running,
          autoExecute: state.autoExecute,
          config: state.config,
          lastStartedAt: state.lastStartedAt,
          lastStoppedAt: state.lastStoppedAt,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Failed to save swarm state:', error);
    throw error;
  }
}

export async function loadSwarmState(): Promise<SwarmStateData | null> {
  try {
    const db = getDatabase();
    
    const [row] = await db.select()
      .from(swarmState)
      .where(eq(swarmState.key, 'primary'))
      .limit(1);
    
    if (!row) return null;
    
    return {
      running: row.running ?? false,
      autoExecute: row.autoExecute ?? false,
      config: row.config,
      lastStartedAt: row.lastStartedAt,
      lastStoppedAt: row.lastStoppedAt,
    };
  } catch (error) {
    console.error('Failed to load swarm state:', error);
    return null;
  }
}

// ============ AGENT STATE ============

export interface AgentStateData {
  agentId: string;
  enabled: boolean;
  status: string;
  config: any;
  metrics: any;
  state: any; // Agent-specific state
  lastRunAt: Date | null;
}

export async function saveAgentState(data: AgentStateData): Promise<void> {
  try {
    const db = getDatabase();
    
    await db.insert(agentState)
      .values({
        agentId: data.agentId,
        enabled: data.enabled,
        status: data.status,
        config: data.config,
        metrics: data.metrics,
        state: data.state,
        lastRunAt: data.lastRunAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: agentState.agentId,
        set: {
          enabled: data.enabled,
          status: data.status,
          config: data.config,
          metrics: data.metrics,
          state: data.state,
          lastRunAt: data.lastRunAt,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error(`Failed to save agent state for ${data.agentId}:`, error);
    throw error;
  }
}

export async function loadAgentState(agentId: string): Promise<AgentStateData | null> {
  try {
    const db = getDatabase();
    
    const [row] = await db.select()
      .from(agentState)
      .where(eq(agentState.agentId, agentId))
      .limit(1);
    
    if (!row) return null;
    
    return {
      agentId: row.agentId,
      enabled: row.enabled ?? true,
      status: row.status ?? 'idle',
      config: row.config,
      metrics: row.metrics,
      state: row.state,
      lastRunAt: row.lastRunAt,
    };
  } catch (error) {
    console.error(`Failed to load agent state for ${agentId}:`, error);
    return null;
  }
}

export async function loadAllAgentStates(): Promise<AgentStateData[]> {
  try {
    const db = getDatabase();
    
    const rows = await db.select().from(agentState);
    
    return rows.map((row) => ({
      agentId: row.agentId,
      enabled: row.enabled ?? true,
      status: row.status ?? 'idle',
      config: row.config,
      metrics: row.metrics,
      state: row.state,
      lastRunAt: row.lastRunAt,
    }));
  } catch (error) {
    console.error('Failed to load agent states:', error);
    return [];
  }
}

// ============ PENDING SIGNALS ============

export interface PendingSignalData {
  signalId: string;
  direction: 'long' | 'short';
  price: number;
  confidence: number;
  source: string;
  reason?: string;
  metadata?: any;
  expiresAt?: Date;
  createdAt: Date;
}

export async function savePendingSignal(signal: PendingSignalData): Promise<void> {
  try {
    const db = getDatabase();
    
    await db.insert(pendingSignals)
      .values({
        signalId: signal.signalId,
        direction: signal.direction,
        price: signal.price,
        confidence: signal.confidence,
        source: signal.source,
        reason: signal.reason,
        metadata: signal.metadata,
        expiresAt: signal.expiresAt,
        createdAt: signal.createdAt,
      })
      .onConflictDoUpdate({
        target: pendingSignals.signalId,
        set: {
          direction: signal.direction,
          price: signal.price,
          confidence: signal.confidence,
          source: signal.source,
          reason: signal.reason,
          metadata: signal.metadata,
          expiresAt: signal.expiresAt,
        },
      });
  } catch (error) {
    console.error('Failed to save pending signal:', error);
    throw error;
  }
}

export async function deletePendingSignal(signalId: string): Promise<void> {
  try {
    const db = getDatabase();
    await db.delete(pendingSignals).where(eq(pendingSignals.signalId, signalId));
  } catch (error) {
    console.error('Failed to delete pending signal:', error);
    throw error;
  }
}

export async function loadPendingSignals(): Promise<PendingSignalData[]> {
  try {
    const db = getDatabase();
    
    const rows = await db.select().from(pendingSignals);
    
    return rows.map((row) => ({
      signalId: row.signalId,
      direction: row.direction as 'long' | 'short',
      price: row.price,
      confidence: row.confidence,
      source: row.source,
      reason: row.reason ?? undefined,
      metadata: row.metadata,
      expiresAt: row.expiresAt ?? undefined,
      createdAt: row.createdAt,
    }));
  } catch (error) {
    console.error('Failed to load pending signals:', error);
    return [];
  }
}

export async function clearPendingSignals(): Promise<void> {
  try {
    const db = getDatabase();
    await db.delete(pendingSignals);
  } catch (error) {
    console.error('Failed to clear pending signals:', error);
    throw error;
  }
}

// ============ EXECUTED TRADES STATE ============

export interface ExecutedTradeData {
  positionId: string;
  signalId?: string;
  direction: 'long' | 'short';
  entryPrice: number;
  margin: number;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
  status: 'open' | 'closed' | 'cancelled';
  pnl?: number;
  executedAt: Date;
  closedAt?: Date;
}

export async function saveExecutedTrade(trade: ExecutedTradeData): Promise<void> {
  try {
    const db = getDatabase();
    
    await db.insert(executedTradesState)
      .values({
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
      })
      .onConflictDoUpdate({
        target: executedTradesState.positionId,
        set: {
          status: trade.status,
          pnl: trade.pnl,
          closedAt: trade.closedAt,
        },
      });
  } catch (error) {
    console.error('Failed to save executed trade:', error);
    throw error;
  }
}

export async function loadExecutedTrades(status?: 'open' | 'closed'): Promise<ExecutedTradeData[]> {
  try {
    const db = getDatabase();
    
    let query = db.select().from(executedTradesState);
    
    if (status) {
      query = query.where(eq(executedTradesState.status, status)) as any;
    }
    
    const rows = await query;
    
    return rows.map((row) => ({
      positionId: row.positionId,
      signalId: row.signalId ?? undefined,
      direction: row.direction as 'long' | 'short',
      entryPrice: row.entryPrice,
      margin: row.margin,
      leverage: row.leverage,
      stopLoss: row.stopLoss ?? undefined,
      takeProfit: row.takeProfit ?? undefined,
      status: row.status as 'open' | 'closed' | 'cancelled',
      pnl: row.pnl ?? undefined,
      executedAt: row.executedAt,
      closedAt: row.closedAt ?? undefined,
    }));
  } catch (error) {
    console.error('Failed to load executed trades:', error);
    return [];
  }
}

export async function updateExecutedTradeStatus(
  positionId: string,
  status: 'open' | 'closed' | 'cancelled',
  pnl?: number
): Promise<void> {
  try {
    const db = getDatabase();
    
    await db.update(executedTradesState)
      .set({
        status,
        pnl,
        closedAt: status !== 'open' ? new Date() : undefined,
      })
      .where(eq(executedTradesState.positionId, positionId));
  } catch (error) {
    console.error('Failed to update executed trade status:', error);
    throw error;
  }
}

// ============ STATE SERVICE CLASS ============

export class StateService {
  private static instance: StateService;
  
  static getInstance(): StateService {
    if (!StateService.instance) {
      StateService.instance = new StateService();
    }
    return StateService.instance;
  }

  // Swarm
  saveSwarmState = saveSwarmState;
  loadSwarmState = loadSwarmState;

  // Agents
  saveAgentState = saveAgentState;
  loadAgentState = loadAgentState;
  loadAllAgentStates = loadAllAgentStates;

  // Pending Signals
  savePendingSignal = savePendingSignal;
  deletePendingSignal = deletePendingSignal;
  loadPendingSignals = loadPendingSignals;
  clearPendingSignals = clearPendingSignals;

  // Executed Trades
  saveExecutedTrade = saveExecutedTrade;
  loadExecutedTrades = loadExecutedTrades;
  updateExecutedTradeStatus = updateExecutedTradeStatus;
}

export const stateService = StateService.getInstance();
