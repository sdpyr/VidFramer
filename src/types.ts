/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MusicMetadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  genre?: string[];
  coverUrl?: string;
}

export type VisualizerMode = 'GLITCH' | 'WAVEFORM' | 'SPECTRUM' | 'RADIAL' | 'PARTICLES' | 'TUNNEL' | 'NEBULA';
export type ColorPalette = 'DEFAULT' | 'NEON' | 'SUNSET' | 'CYBER' | 'MONO' | 'CUSTOM';
export type TypographyStyle = 'CLASSIC' | 'BOUNCE' | 'GLITCH' | 'STAGGER';
export type AspectRatio = '9:16' | '1:1' | '16:9';

export interface WordTiming {
  word: string;
  startTime: number; // seconds
  endTime: number;   // seconds
}

export interface SyncedLine {
  startTime: number;
  endTime: number;
  text: string;
  words: WordTiming[];
}

export interface VisualizerSettings {
  intensity: number;
  colorDistortion: number;
  displacement: number;
  mode: VisualizerMode;
  typographyStyle: TypographyStyle;
  palette: ColorPalette;
  primaryColor: string;
  secondaryColor: string;
  aspectRatio: AspectRatio;
  coverScale: number;
  coverX: number;
  coverY: number;
  showTitle: boolean;
  showArtist: boolean;
  showLyrics: boolean;
  customTitle: string;
  customArtist: string;
  customLyrics: string;
  titleFont: string;
  artistFont: string;
  lyricsFont: string;
  syncedLyrics: SyncedLine[];
  // Extra Visuals
  bloom: number;
  chromaticAberration: number;
  vignette: number;
  // Glitch Granular Controls
  pixelSorting: number;
  scanLines: number;
  rgbSplit: number;
  beatSync: boolean;
  // Lyrics Styling
  lyricsPastOpacity: number;
  lyricsFutureOpacity: number;
  lyricsBlur: number;
}

export interface VisualizerPreset {
  id: string;
  name: string;
  settings: VisualizerSettings;
}

export interface LyricLine {
  text: string;
  time?: number;
}
