
import { Signal } from '../types';

/**
 * Advanced Telegram Notifier Service
 * Professional formatting with Confluence details and Risk Management metrics.
 */
export const sendTelegramSignal = async (
  token: string,
  chatId: string,
  signal: Signal
): Promise<boolean> => {
  if (!token || !chatId) {
    console.error("TELEGRAM_ERROR: Bot Token or Chat ID is missing in configuration.");
    return false;
  }

  // Calculate R/R Ratio for the message
  const slDistance = Math.abs(signal.entry - (signal.stopLoss || 0));
  const tpDistance = Math.abs((signal.takeProfit || 0) - signal.entry);
  const rrRatio = slDistance > 0 ? (tpDistance / slDistance).toFixed(2) : "0.00";

  // Visual cues based on direction
  const emoji = signal.direction === 'LONG' ? '🟢' : '🔴';
  const directionText = signal.direction === 'LONG' ? 'LONG' : 'SHORT';

  // Constructing the professional Markdown message
  const message = `
${emoji} *${directionText} SIGNAL IDENTIFIED*

*📊 Market Information*
• *Symbol:* ${signal.symbol}
• *Timeframe:* ${signal.timeframe}

*🧠 Confluence Strategy*
• ${signal.strategyName}

*🎯 Trade Parameters*
• Entry: \`${signal.entry.toLocaleString()}\`
• Stop Loss: \`${signal.stopLoss.toLocaleString()}\`
• Take Profit: \`${signal.takeProfit.toLocaleString()}\`

*🛡️ Risk Management*
• Position Size: \`${signal.positionSize || 0}\` ${signal.symbol.replace('USDT', '')}
• Suggested Leverage: \`${signal.suggestedLeverage || 1}\`x
• Risk/Reward Ratio: \`${rrRatio}\`

_⚠️ Disclaimer: This is an automated signal for testing purposes and does NOT constitute financial advice. Trade at your own risk._
  `.trim();

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown', // Standard Markdown V1
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      // Print specific API error reasons as requested
      console.error(`TELEGRAM_API_FAILURE: HTTP ${response.status} - ${errorData.description || 'Unknown Error'}`);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error(`TELEGRAM_NETWORK_ERROR: Failed to connect to API - ${error.message}`);
    return false;
  }
};
