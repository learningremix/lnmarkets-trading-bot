/**
 * API Route: /api/market
 * Returns market data, ticker, and analysis
 */

import type { Route } from './+types/api.market';
import { getSwarmCoordinator } from '../../server/agents';

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const swarm = getSwarmCoordinator();
    const lnMarkets = swarm.getLNMarkets();
    const marketAnalyst = swarm.getMarketAnalyst();

    if (!lnMarkets) {
      return Response.json({
        success: false,
        error: 'LN Markets service not initialized',
      }, { status: 503 });
    }

    const [ticker, oracle] = await Promise.all([
      lnMarkets.getTicker(),
      lnMarkets.getOraclePrice(),
    ]);

    // Get latest analysis if available
    let analysis = null;
    if (marketAnalyst) {
      const lastAnalysis = marketAnalyst.getLastAnalysis();
      if (lastAnalysis instanceof Map) {
        analysis = Object.fromEntries(lastAnalysis);
      }
    }

    return Response.json({
      success: true,
      data: {
        ticker,
        oracle,
        analysis,
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
