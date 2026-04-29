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
  lyrics?: string;
}

export type VisualizerMode = 'GLITCH' | 'WAVEFORM' | 'SPECTRUM' | 'RADIAL' | 'PARTICLES' | 'TUNNEL' | 'NEBULA' | 'SIMULATION' | 'NOIR_GRID' | 'ESOTERIC' | 'PHONK_WAVE' | 'KINETIC_TYPO' | 'MONOLITH' | 'ETHER' | 'CHAOS';
export type ColorPalette = 'DEFAULT' | 'NEON' | 'SUNSET' | 'CYBER' | 'MONO' | 'CUSTOM' | 'BRUTALIST';
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
  showSunoLyrics: boolean;
  autoMastering: boolean;
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

export interface AudioEvents {
  kick: number;     // 0 to 1, smoothed
  snare: number;    // 0 to 1, smoothed
  hihat: number;    // 0 to 1, smoothed
  energy: number;   // 0 to 1, overall volume
  spectrum: number[]; // normalized spectrum
  time: number;     // current track time
  delta: number;    // frame delta time
  beat: boolean;    // true if rhythmic hit detected
  bassEnergy: number;
  midEnergy: number;
  highEnergy: number;
}

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  settings: VisualizerSettings;
  audio: AudioEvents;
  metadata: MusicMetadata | null;
  coverImage?: HTMLImageElement | null;
}

export interface IVisualizer {
  name: string;
  update(audio: AudioEvents, settings: VisualizerSettings): void;
  render(context: RenderContext): void;
}

export interface VisualizerModeMetadata {
  id: VisualizerMode;
  name: string;
  description: string;
}
