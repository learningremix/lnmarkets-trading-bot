/**
 * API Route: /api/control
 * Control API for AI agent to manage the trading swarm
 * This endpoint allows the OpenClaw gateway to control the bot
 */

import type { Route } from './+types/api.control';
import { getSwarmCoordinator } from '../../server/agents';

// Simple API key auth for control endpoints
const CONTROL_API_KEY = process.env.CONTROL_API_KEY || 'pixelai-trading-control';

function validateAuth(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  const apiKey = request.headers.get('X-API-Key');
  
  if (apiKey === CONTROL_API_KEY) return true;
  if (authHeader === `Bearer ${CONTROL_API_KEY}`) return true;
  
  // Allow from localhost without auth for development
  const host = request.headers.get('Host');
  if (host?.includes('localhost') || host?.includes('127.0.0.1')) return true;
  
  return false;
}

export async function loader({ request }: Route.LoaderArgs) {
  if (!validateAuth(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const swarm = getSwarmCoordinator();
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  try {
    switch (action) {
      case 'status':
        return Response.json({
          success: true,
          data: await swarm.getStatus(),
        });

      case 'analysis':
        const analyst = swarm.getMarketAnalyst();
        const analysis = analyst?.getLastAnalysis();
        return Response.json({
          success: true,
          data: analysis instanceof Map ? Object.fromEntries(analysis) : analysis,
        });

      case 'risk':
        const riskManager = swarm.getRiskManager();
        return Response.json({
          success: true,
          data: riskManager?.getLastAssessment(),
        });

      case 'signals':
        const executor = swarm.getExecutionAgent();
        return Response.json({
          success: true,
          data: {
            pending: executor?.getPendingSignals() || [],
            executed: executor?.getExecutedTrades() || [],
            autoExecute: executor?.isAutoExecuteEnabled() || false,
          },
        });

      case 'research':
        const researcher = swarm.getResearcher();
        return Response.json({
          success: true,
          data: researcher?.getLastReport(),
        });

      case 'positions':
        const lnMarkets = swarm.getLNMarkets();
        if (!lnMarkets) {
          return Response.json({ success: false, error: 'Not authenticated' }, { status: 503 });
        }
        const [positions, orders, ticker] = await Promise.all([
          lnMarkets.getRunningIsolatedPositions(),
          lnMarkets.getOpenIsolatedOrders(),
          lnMarkets.getTicker(),
        ]);
        return Response.json({
          success: true,
          data: { positions, orders, ticker },
        });

      case 'balance':
        const lnm = swarm.getLNMarkets();
        if (!lnm) {
          return Response.json({ success: false, error: 'Not authenticated' }, { status: 503 });
        }
        const account = await lnm.getAccount();
        return Response.json({
          success: true,
          data: account,
        });

      default:
        return Response.json({
          success: true,
          message: 'Control API ready',
          endpoints: {
            'GET ?action=status': 'Get swarm status',
            'GET ?action=analysis': 'Get market analysis',
            'GET ?action=risk': 'Get risk assessment',
            'GET ?action=signals': 'Get pending and executed signals',
            'GET ?action=research': 'Get research report',
            'GET ?action=positions': 'Get open positions',
            'GET ?action=balance': 'Get account balance',
            'POST action=start': 'Start the swarm',
            'POST action=stop': 'Stop the swarm',
            'POST action=auto_execute': 'Enable/disable auto execution',
            'POST action=trade': 'Execute a manual trade',
            'POST action=close': 'Close a position',
            'POST action=close_all': 'Close all positions',
            'POST action=update_sl': 'Update stop loss',
            'POST action=update_tp': 'Update take profit',
          },
        });
    }
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function action({ request }: Route.ActionArgs) {
  if (!validateAuth(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const swarm = getSwarmCoordinator();
  
  try {
    const body = await request.json();
    const { action: cmd, ...params } = body;

    switch (cmd) {
      case 'start':
        swarm.start();
        return Response.json({ success: true, message: 'Swarm started' });

      case 'stop':
        swarm.stop();
        return Response.json({ success: true, message: 'Swarm stopped' });

      case 'auto_execute':
        const enabled = params.enabled === true;
        swarm.setAutoExecute(enabled);
        return Response.json({
          success: true,
          message: `Auto-execute ${enabled ? 'enabled' : 'disabled'}`,
        });

      case 'trade':
        const trade = await swarm.executeManualTrade({
          direction: params.direction, // 'long' | 'short'
          marginPercent: params.marginPercent || 5,
          leverage: params.leverage || 10,
          stopLossPercent: params.stopLossPercent,
          takeProfitPercent: params.takeProfitPercent,
        });
        return Response.json({ success: true, data: trade });

      case 'close':
        const executor = swarm.getExecutionAgent();
        if (!executor) {
          return Response.json({ success: false, error: 'Execution agent not available' }, { status: 503 });
        }
        await executor.closePosition(params.positionId, params.reason || 'AI control');
        return Response.json({ success: true, message: 'Position closed' });

      case 'close_all':
        await swarm.closeAllPositions(params.reason || 'AI control - close all');
        return Response.json({ success: true, message: 'All positions closed' });

      case 'update_sl':
        const lnm1 = swarm.getLNMarkets();
        if (!lnm1) {
          return Response.json({ success: false, error: 'Not authenticated' }, { status: 503 });
        }
        await lnm1.updateIsolatedStopLoss(params.positionId, params.stopLoss);
        return Response.json({ success: true, message: 'Stop loss updated' });

      case 'update_tp':
        const lnm2 = swarm.getLNMarkets();
        if (!lnm2) {
          return Response.json({ success: false, error: 'Not authenticated' }, { status: 503 });
        }
        await lnm2.updateIsolatedTakeProfit(params.positionId, params.takeProfit);
        return Response.json({ success: true, message: 'Take profit updated' });

      case 'add_signal':
        const exec = swarm.getExecutionAgent();
        if (!exec) {
          return Response.json({ success: false, error: 'Execution agent not available' }, { status: 503 });
        }
        exec.addSignal({
          id: `ai-${Date.now()}`,
          timestamp: new Date(),
          direction: params.direction,
          confidence: params.confidence || 75,
          reason: params.reason || 'AI signal',
          source: 'ai-control',
          price: params.price || 0,
        });
        return Response.json({ success: true, message: 'Signal added' });

      case 'update_risk_params':
        const riskMgr = swarm.getRiskManager();
        if (!riskMgr) {
          return Response.json({ success: false, error: 'Risk manager not available' }, { status: 503 });
        }
        riskMgr.updateRiskParams(params);
        return Response.json({ success: true, message: 'Risk parameters updated' });

      case 'force_analysis':
        const analyst = swarm.getMarketAnalyst();
        if (!analyst) {
          return Response.json({ success: false, error: 'Market analyst not available' }, { status: 503 });
        }
        const analysis = await analyst.forceAnalysis();
        return Response.json({
          success: true,
          data: Object.fromEntries(analysis),
        });

      default:
        return Response.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
