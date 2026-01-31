/**
 * API Route: /api/positions
 * Returns open positions and allows position management
 */

import type { Route } from './+types/api.positions';
import { getSwarmCoordinator } from '../../server/agents';

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const swarm = getSwarmCoordinator();
    const lnMarkets = swarm.getLNMarkets();
    const riskManager = swarm.getRiskManager();

    if (!lnMarkets) {
      return Response.json({
        success: false,
        error: 'LN Markets service not initialized',
      }, { status: 503 });
    }

    const [positions, orders] = await Promise.all([
      lnMarkets.getRunningIsolatedPositions(),
      lnMarkets.getOpenIsolatedOrders(),
    ]);

    // Get risk assessment
    let riskAssessment = null;
    if (riskManager) {
      riskAssessment = riskManager.getLastAssessment();
    }

    return Response.json({
      success: true,
      data: {
        positions,
        orders,
        riskAssessment,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function action({ request }: Route.ActionArgs) {
  const swarm = getSwarmCoordinator();
  const lnMarkets = swarm.getLNMarkets();

  if (!lnMarkets) {
    return Response.json({
      success: false,
      error: 'LN Markets service not initialized',
    }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const action = formData.get('action') as string;
    const positionId = formData.get('positionId') as string;

    switch (action) {
      case 'close':
        if (!positionId) {
          return Response.json({ success: false, error: 'Position ID required' }, { status: 400 });
        }
        await lnMarkets.closeIsolatedPosition(positionId);
        return Response.json({ success: true, message: 'Position closed' });

      case 'closeAll':
        await swarm.closeAllPositions('Manual close all');
        return Response.json({ success: true, message: 'All positions closed' });

      case 'updateStopLoss':
        if (!positionId) {
          return Response.json({ success: false, error: 'Position ID required' }, { status: 400 });
        }
        const stopLoss = Number(formData.get('stopLoss'));
        await lnMarkets.updateIsolatedStopLoss(positionId, stopLoss);
        return Response.json({ success: true, message: 'Stop loss updated' });

      case 'updateTakeProfit':
        if (!positionId) {
          return Response.json({ success: false, error: 'Position ID required' }, { status: 400 });
        }
        const takeProfit = Number(formData.get('takeProfit'));
        await lnMarkets.updateIsolatedTakeProfit(positionId, takeProfit);
        return Response.json({ success: true, message: 'Take profit updated' });

      default:
        return Response.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
