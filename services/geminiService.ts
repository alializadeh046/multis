
import { GoogleGenAI, Type } from "@google/genai";
import { Kline, Timeframe } from "../types";

export const getSmartTimeframes = async (
  symbol: string,
  sampleKlines: Kline[]
): Promise<Timeframe[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return ["15m", "1h"]; // Fallback defaults
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Prepare a snippet of market data for the AI to "feel" the volatility
    const dataSnippet = sampleKlines.slice(-20).map(k => ({
      c: k.close,
      h: k.high,
      l: k.low,
      v: k.volume
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this market data for ${symbol}: ${JSON.stringify(dataSnippet)}. 
      Based on the volatility and trend strength, select the most appropriate timeframes to look for signals. 
      If high volatility, choose larger timeframes. If ranging/low volatility, choose smaller.
      Available: 5m, 15m, 1h, 4h.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedTimeframes: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            reasoning: { type: Type.STRING }
          },
          required: ["suggestedTimeframes"]
        }
      }
    });

    const result = JSON.parse(response.text);
    const validTfs = (result.suggestedTimeframes as string[]).filter(tf => 
      ["5m", "15m", "1h", "4h"].includes(tf)
    ) as Timeframe[];

    return validTfs.length > 0 ? validTfs : ["15m", "1h"];
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return ["15m", "1h"];
  }
};
