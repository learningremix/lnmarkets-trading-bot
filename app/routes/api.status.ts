/**
 * API Route: /api/status
 * Returns system status, balance, and agent states
 */

import type { Route } from './+types/api.status';
import { getSwarmCoordinator } from '../../server/agents';

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const swarm = getSwarmCoordinator();
    const status = await swarm.getStatus();

    return Response.json({
      success: true,
      data: status,
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
