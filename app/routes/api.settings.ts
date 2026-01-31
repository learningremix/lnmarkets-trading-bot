/**
 * API Route: /api/settings
 * Get and update trading bot settings from database
 */

import type { Route } from './+types/api.settings';
import { settingsService } from '../../server/services/settings';

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const settings = await settingsService.getSettings();
    const defaults = settingsService.getDefaults();
    
    return Response.json({
      success: true,
      data: {
        settings,
        defaults,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load settings',
    }, { status: 500 });
  }
}

export async function action({ request }: Route.ActionArgs) {
  try {
    const body = await request.json();
    const { action, settings: updates, key, value } = body;

    switch (action) {
      case 'update':
        if (!updates || typeof updates !== 'object') {
          return Response.json({ success: false, error: 'Invalid settings object' }, { status: 400 });
        }
        await settingsService.updateSettings(updates);
        const newSettings = await settingsService.getSettings();
        return Response.json({
          success: true,
          message: 'Settings updated',
          data: newSettings,
        });

      case 'set':
        if (!key) {
          return Response.json({ success: false, error: 'Key required' }, { status: 400 });
        }
        await settingsService.setSetting(key, value);
        return Response.json({
          success: true,
          message: `Setting ${key} updated`,
        });

      case 'reset':
        await settingsService.resetToDefaults();
        return Response.json({
          success: true,
          message: 'Settings reset to defaults',
          data: settingsService.getDefaults(),
        });

      case 'initialize':
        await settingsService.initializeDefaults();
        return Response.json({
          success: true,
          message: 'Settings initialized',
        });

      default:
        // Default action is update
        if (body && typeof body === 'object' && !body.action) {
          await settingsService.updateSettings(body);
          const updatedSettings = await settingsService.getSettings();
          return Response.json({
            success: true,
            message: 'Settings updated',
            data: updatedSettings,
          });
        }
        return Response.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update settings',
    }, { status: 500 });
  }
}
