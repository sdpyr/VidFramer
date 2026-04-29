/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as mm from 'music-metadata-browser';
import { MusicMetadata } from '../types';

/**
 * Suno AI ve benzeri araçlardan gelen kirli ID3 etiketlerini,
 * promptları ve yapısal parantezleri temizler.
 */
export const cleanLyrics = (rawLyrics: string): string => {
  if (!rawLyrics) return "";
  
  return rawLyrics
    .replace(/\[.*?\]/g, '')  // [Verse], [dark trap] gibi köşeli parantezleri siler
    .replace(/\{.*?\}/g, '')  // {Hook} gibi süslü parantezleri siler
    .replace(/\(.*?\)/g, '')  // (Background vocal) gibi normal parantezleri siler
    .replace(/Prompt:.*$/gim, '') // "Prompt:" kelimesiyle başlayan logları siler
    .replace(/Tags:.*$/gim, '')   // "Tags:" ile başlayan tür etiketlerini siler
    .replace(/\n\s*\n/g, '\n') // Oluşan fazla boş satırları tek satıra indirger
    .trim();
};

export async function extractMetadata(file: File): Promise<MusicMetadata> {
  const fileName = file.name.replace(/\.[^/.]+$/, "");
  
  try {
    const metadata = await mm.parseBlob(file);
    const tags = metadata.common;
    
    // Kapak fotoğrafı çıkarma
    let coverUrl = '';
    if (tags.picture && tags.picture.length > 0) {
      const pic = tags.picture[0];
      const blob = new Blob([pic.data], { type: pic.format });
      coverUrl = URL.createObjectURL(blob);
    }

    // 1. Şarkı Sözlerini Bul ve Temizle
    // Suno sözleri genelde lyrics veya comment içinde tutar.
    const rawLyrics = tags.lyrics?.join('\n') || tags.comment?.join('\n') || "";
    const processedLyrics = cleanLyrics(rawLyrics);

    // 2. İsim ve Sanatçı Ayıklama (Sallamasyon dosya isimlerine karşı)
    let finalTitle = tags.title;
    let finalArtist = tags.artist;

    if (!finalTitle || !finalArtist) {
      if (fileName.includes(" - ")) {
        const parts = fileName.split(" - ");
        if (!finalArtist) finalArtist = parts[0].trim();
        if (!finalTitle) finalTitle = parts[1].trim();
      }
    }

    return {
      title: finalTitle || fileName,
      artist: finalArtist || "Bilinmeyen Sanatçı",
      album: tags.album || "Bilinmeyen Albüm",
      year: tags.year,
      genre: tags.genre,
      coverUrl,
      lyrics: processedLyrics // Temizlenmiş sözleri sisteme besliyoruz
    };
  } catch (error) {
    console.warn("Metadata extraction failed:", error);
    return {
      title: fileName,
      artist: "Bilinmeyen Sanatçı",
      lyrics: ""
    };
  }
}

// Write PCM data to a memory buffer for WAV conversion
function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function bufferToWaveBlob(abuffer: AudioBuffer): Blob {
  const numOfChan = abuffer.numberOfChannels;
  const length = abuffer.length * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  writeString(view, pos, 'RIFF'); pos += 4;
  view.setUint32(pos, length - 8, true); pos += 4;
  writeString(view, pos, 'WAVE'); pos += 4;
  writeString(view, pos, 'fmt '); pos += 4;
  view.setUint32(pos, 16, true); pos += 4; // length of 'fmt' data
  view.setUint16(pos, 1, true); pos += 2; // format: 1 (PCM)
  view.setUint16(pos, numOfChan, true); pos += 2;
  view.setUint32(pos, abuffer.sampleRate, true); pos += 4;
  view.setUint32(pos, abuffer.sampleRate * 2 * numOfChan, true); pos += 4; // byte rate
  view.setUint16(pos, numOfChan * 2, true); pos += 2; // block align
  view.setUint16(pos, 16, true); pos += 2; // bits per sample
  writeString(view, pos, 'data'); pos += 4;
  view.setUint32(pos, length - pos - 4, true); pos += 4; // data chunk length

  // write interleaved data
  for (i = 0; i < abuffer.numberOfChannels; i++)
    channels.push(abuffer.getChannelData(i));

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(pos, sample, true); // write 16-bit sample
      pos += 2;
    }
    offset++;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export async function downsampleAudio(file: File): Promise<Blob> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Sesi 16kHz ve Mono (Tek Kanal) yap. Boyutu %80-90 düşürür.
  const offlineCtx = new OfflineAudioContext(1, audioBuffer.duration * 16000, 16000);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start();

  const renderedBuffer = await offlineCtx.startRendering();
  return bufferToWaveBlob(renderedBuffer); 
}
