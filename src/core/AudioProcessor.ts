import { AudioEvents } from '../types';

export class AudioProcessor {
  private analyser: AnalyserNode;
  private dataArray: Uint8Array;
  
  // Smoothed values for inertia
  private smoothedKick = 0;
  private smoothedSnare = 0;
  private smoothedHihat = 0;
  private smoothedEnergy = 0;
  
  // History for beat detection
  private energyHistory: number[] = [];
  private historySize = 30;

  constructor(analyser: AnalyserNode) {
    this.analyser = analyser;
    this.analyser.fftSize = 1024;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
  }

  public process(currentTime: number, delta: number): AudioEvents {
    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Band Analysis (1024 FFT -> 512 bins)
    // Sub-Bass/Kick: 0-6 bins (~0-250Hz) - Narrowed to prevent vocal bleed
    let bassSum = 0;
    const bassBins = 6;
    for (let i = 0; i < bassBins; i++) bassSum += this.dataArray[i];
    const bassEnergy = (bassSum / bassBins) / 255;

    // Mids: 6-60 bins (~250Hz - 2.5kHz)
    let midSum = 0;
    for (let i = 6; i < 60; i++) midSum += this.dataArray[i];
    const midEnergy = (midSum / 54) / 255;

    // Highs: 60-512 bins (2.5kHz - 22kHz) - Extended to catch crisp hats
    let highSum = 0;
    for (let i = 60; i < 512; i++) highSum += this.dataArray[i];
    const highEnergy = (highSum / 452) / 255;

    const energy = (bassEnergy * 0.6 + midEnergy * 0.2 + highEnergy * 0.2);
    
    // Smoothing (Lerp)
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const smoothFactor = 0.15; // Slightly slower for more fluid feel
    
    this.smoothedKick = lerp(this.smoothedKick, bassEnergy, smoothFactor);
    this.smoothedSnare = lerp(this.smoothedSnare, midEnergy, smoothFactor);
    this.smoothedHihat = lerp(this.smoothedHihat, highEnergy, smoothFactor);
    this.smoothedEnergy = lerp(this.smoothedEnergy, energy, smoothFactor);

    // Reliable Beat Detection: Focus on Bass energy change
    this.energyHistory.push(bassEnergy);
    if (this.energyHistory.length > this.historySize) this.energyHistory.shift();
    
    const avgBassEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
    // Threshold + sudden jump logic
    const isBeat = bassEnergy > avgBassEnergy * 1.4 && bassEnergy > 0.15;

    // Normalize spectrum for visualizer
    const normalizedSpectrum: number[] = [];
    for (let i = 0; i < 64; i++) {
       normalizedSpectrum.push(this.dataArray[i * 4] / 255);
    }

    return {
      kick: this.smoothedKick,
      snare: this.smoothedSnare,
      hihat: this.smoothedHihat,
      energy: this.smoothedEnergy,
      bassEnergy,
      midEnergy,
      highEnergy,
      spectrum: normalizedSpectrum,
      time: currentTime,
      delta,
      beat: isBeat
    };
  }
}
