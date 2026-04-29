import { GoogleGenAI, Type } from "@google/genai";
import { SyncedLine } from "../types";

// Note: In this environment, GEMINI_API_KEY is available in process.env
const apiKey = process.env.GEMINI_API_KEY;

export async function generateSyncedLyrics(audioBase64: string, mimeType: string): Promise<SyncedLine[]> {
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing");
    return [];
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        inlineData: {
          mimeType: mimeType,
          data: audioBase64
        }
      },
      {
        text: `Listen to this audio and perform exact word-by-word lyric transcription. 
        1. Identify the language correctly.
        2. Provide word-level timestamps for every single word.
        3. Do NOT summarize or guess; if you are unsure, transcribe exactly what you hear.
        4. Return a JSON array of sentences.
        5. Each sentence must have startTime, endTime, text, and a detailed 'words' array.
        6. Timing must be perfect – if a word starts slightly before or after, reflect it in the decimals.`
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            startTime: { type: Type.NUMBER },
            endTime: { type: Type.NUMBER },
            text: { type: Type.STRING },
            words: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  startTime: { type: Type.NUMBER },
                  endTime: { type: Type.NUMBER }
                },
                required: ["word", "startTime", "endTime"]
              }
            }
          },
          required: ["startTime", "endTime", "text", "words"]
        }
      }
    }
  });

  try {
    const text = response.text;
    if (!text) return [];
    const data = JSON.parse(text);
    return data as SyncedLine[];
  } catch (e) {
    console.error("Failed to parse synced lyrics:", e);
    return [];
  }
}
