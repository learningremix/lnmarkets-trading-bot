/**
 * API Route: /api/settings
 * Complete settings management - all config stored in database
 */

import type { Route } from './+types/api.settings';
import { settingsService } from '../../server/services/settings';

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const key = url.searchParams.get('key');

  try {
    // Get specific setting
    if (action === 'get' && key) {
      const value = await settingsService.getSetting(key as any);
      const isSensitive = settingsService.isSensitive(key);
      return Response.json({
        success: true,
        data: {
          key,
          value: isSensitive && value ? '••••••••' : value,
          description: settingsService.getDescription(key),
          sensitive: isSensitive,
        },
      });
    }

    // Get categories/schema
    if (action === 'schema') {
      const defaults = settingsService.getDefaults();
      const categories = settingsService.getCategories();
      
      const schema: Record<string, any[]> = {};
      for (const [category, keys] of Object.entries(categories)) {
        schema[category] = keys.map(k => ({
          key: k,
          type: typeof (defaults as any)[k],
          default: (defaults as any)[k],
          description: settingsService.getDescription(k),
          sensitive: settingsService.isSensitive(k),
        }));
      }
      
      return Response.json({
        success: true,
        data: { schema },
      });
    }

    // Check LN Markets connection status
    if (action === 'status') {
      const isConfigured = await settingsService.isLNMarketsConfigured();
      const s = await settingsService.getSettings();
      
      return Response.json({
        success: true,
        data: {
          lnMarketsConfigured: isConfigured,
          network: s.lnmarketsNetwork,
          autoStartSwarm: s.autoStartSwarm,
          autoExecuteTrades: s.autoExecuteTrades,
          tradingViewEnabled: s.tradingViewEnabled,
          debugMode: s.debugMode,
        },
      });
    }

    // Default: get all settings (masked)
    const allSettings = await settingsService.getSettingsMasked();
    const defaults = settingsService.getDefaults();
    const categories = settingsService.getCategories();

    return Response.json({
      success: true,
      data: {
        settings: allSettings,
        defaults,
        categories,
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
  if (request.method !== 'POST' && request.method !== 'PUT' && request.method !== 'PATCH') {
    return Response.json({ success: false, error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { action, settings: updates, key, value } = body;

    switch (action) {
      // Update multiple settings
      case 'update':
        if (!updates || typeof updates !== 'object') {
          return Response.json({ success: false, error: 'Invalid settings object' }, { status: 400 });
        }
        await settingsService.updateSettings(updates);
        const newSettings = await settingsService.getSettingsMasked();
        return Response.json({
          success: true,
          message: 'Settings updated',
          data: newSettings,
        });

      // Set single setting
      case 'set':
        if (!key) {
          return Response.json({ success: false, error: 'Key required' }, { status: 400 });
        }
        await settingsService.setSetting(key, value);
        return Response.json({
          success: true,
          message: `Setting '${key}' updated`,
        });

      // Reset to defaults
      case 'reset':
        await settingsService.resetToDefaults();
        return Response.json({
          success: true,
          message: 'Settings reset to defaults',
          data: settingsService.getDefaults(),
        });

      // Initialize defaults (first run)
      case 'initialize':
        await settingsService.initializeDefaults();
        return Response.json({
          success: true,
          message: 'Settings initialized with defaults',
        });

      // Configure LN Markets
      case 'configure_lnmarkets':
        const { apiKey, apiSecret, passphrase, network } = body;
        if (!apiKey || !apiSecret || !passphrase) {
          return Response.json({ 
            success: false, 
            error: 'apiKey, apiSecret, and passphrase are required' 
          }, { status: 400 });
        }
        await settingsService.updateSettings({
          lnmarketsKey: apiKey,
          lnmarketsSecret: apiSecret,
          lnmarketsPassphrase: passphrase,
          lnmarketsNetwork: network || 'testnet',
        });
        return Response.json({
          success: true,
          message: `LN Markets configured for ${network || 'testnet'}`,
        });

      // Configure TradingView
      case 'configure_tradingview':
        const { apiUrl, symbol, exchange, timeframes, requireStrong } = body;
        await settingsService.updateSettings({
          tradingViewEnabled: true,
          tradingViewApiUrl: apiUrl || 'http://tradingview-ta:8000',
          tradingViewSymbol: symbol || 'BTCUSD',
          tradingViewExchange: exchange || 'COINBASE',
          tradingViewTimeframes: timeframes || ['1h', '4h'],
          tradingViewRequireStrong: requireStrong || false,
          useTradingView: true,
        });
        return Response.json({
          success: true,
          message: 'TradingView configured and enabled',
        });

      // Configure Telegram
      case 'configure_telegram':
        const { botToken, chatId } = body;
        if (!botToken || !chatId) {
          return Response.json({ 
            success: false, 
            error: 'botToken and chatId are required' 
          }, { status: 400 });
        }
        await settingsService.updateSettings({
          enableTelegramNotifications: true,
          telegramBotToken: botToken,
          telegramChatId: chatId,
        });
        return Response.json({
          success: true,
          message: 'Telegram notifications configured',
        });

      // Clear cache
      case 'clear_cache':
        settingsService.clearCache();
        return Response.json({
          success: true,
          message: 'Settings cache cleared',
        });

      // Default: update settings directly
      default:
        if (body && typeof body === 'object' && !body.action) {
          await settingsService.updateSettings(body);
          const updatedSettings = await settingsService.getSettingsMasked();
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
