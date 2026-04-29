/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function fetchLyrics(title: string, artist: string): Promise<string> {
  if (!title || !artist) return "Lyrics not found.";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a high-accuracy music metadata service. 
      Task: Provide the ORIGINAL full lyrics for the song "${title}" by "${artist}".
      Rules:
      1. Return ONLY the lyrics text.
      2. No introduction, no metadata, no translations.
      3. Use the original language of the song as released.
      4. If the lyrics are unavailable, return exactly: "LYRICS_NOT_FOUND".
      5. DO NOT hallucinate or create fake lyrics if you don't know them.
      6. If it's an instrumental track, return exactly: "INSTRUMENTAL".`,
    });

    const text = response.text.trim();
    if (text === "LYRICS_NOT_FOUND") return "Lyrics unavailable for this track.";
    if (text === "INSTRUMENTAL") return "This is an instrumental track (no lyrics).";
    return text;
  } catch (error) {
    console.error("Error fetching lyrics:", error);
    return "Error retrieving lyrics.";
  }
}
