import { GoogleGenAI, Type } from "@google/genai";
import { SyncedLine } from "../types";

// Note: In this environment, GEMINI_API_KEY is available in process.env
const apiKey = process.env.GEMINI_API_KEY;

export async function generateSyncedLyrics(audioBase64: string, mimeType: string): Promise<SyncedLine[]> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            data: audioBase64,
            mimeType: mimeType,
          },
        },
        {
          text: `Listen to this audio and perform exact word-by-word lyric transcription. 
        1. Identify the language correctly.
        2. Provide word-level timestamps for every single word.
        3. Do NOT summarize or guess.
        4. Return a JSON array of sentences.
        5. Each sentence must have startTime, endTime, text, and a detailed 'words' array.
        6. Timing must be perfect.`
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    let text = response.text || "";
    
    // Robust Parsing: Remove markdown code blocks if present
    text = text.replace(/```json\n?/, "").replace(/```\n?/, "").trim();
    
    // Attempt to find the first [ and last ] to extract JSON array
    const startIdx = text.indexOf("[");
    const endIdx = text.lastIndexOf("]");
    if (startIdx !== -1 && endIdx !== -1) {
      text = text.substring(startIdx, endIdx + 1);
    }

    if (!text) return [];
    const data = JSON.parse(text);
    return data as SyncedLine[];
  } catch (e) {
    console.error("Failed to generate/parse synced lyrics:", e);
    return [];
  }
}
