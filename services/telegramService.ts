
import { Signal } from '../types';

export const sendTelegramSignal = async (
  token: string,
  chatId: string,
  signal: Signal
): Promise<boolean> => {
  if (!token || !chatId) {
    console.error("Telegram credentials missing");
    return false;
  }

  const message = `
🚨 *Crypto Signal* 🚨

*Strategy:* ${signal.strategyName}
*Symbol:* ${signal.symbol}
*Timeframe:* ${signal.timeframe}
*Direction:* ${signal.direction}
*Entry:* ${signal.entry.toLocaleString()}
*Stop Loss:* ${signal.stopLoss.toLocaleString()}
*Take Profit:* ${signal.takeProfit.toLocaleString()}
*Position Size:* ${signal.positionSize} ${signal.symbol.replace('USDT', '')}

_Status: Automated Scan_
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
        parse_mode: 'Markdown',
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Telegram API error:", error);
    return false;
  }
};
