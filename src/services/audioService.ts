/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as mm from 'music-metadata-browser';
import { MusicMetadata } from '../types';

export async function extractMetadata(file: File): Promise<MusicMetadata> {
  const fileName = file.name.replace(/\.[^/.]+$/, "");
  
  try {
    const metadata = await mm.parseBlob(file);
    const { title, artist, album, picture, year, genre } = metadata.common;
    
    let coverUrl = '';
    if (picture && picture.length > 0) {
      const pic = picture[0];
      const blob = new Blob([pic.data], { type: pic.format });
      coverUrl = URL.createObjectURL(blob);
    }

    // Attempt to parse filename if title or artist is missing
    let finalTitle = title;
    let finalArtist = artist;

    if (!finalTitle || !finalArtist) {
      if (fileName.includes(" - ")) {
        const parts = fileName.split(" - ");
        if (!finalArtist) finalArtist = parts[0].trim();
        if (!finalTitle) finalTitle = parts[1].trim();
      }
    }

    return {
      title: finalTitle || fileName,
      artist: finalArtist || "Unknown Artist",
      album: album || "Unknown Album",
      year,
      genre,
      coverUrl
    };
  } catch (error) {
    console.warn("Metadata extraction failed:", error);
    
    // Fallback: try to parse filename at least
    let finalTitle = fileName;
    let finalArtist = "Unknown Artist";
    
    if (fileName.includes(" - ")) {
      const parts = fileName.split(" - ");
      finalArtist = parts[0].trim();
      finalTitle = parts[1].trim();
    }

    return {
      title: finalTitle,
      artist: finalArtist,
      album: "Unknown Album"
    };
  }
}
