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
    
    // Band Analysis (assuming 1024 FFT -> 512 bins)
    // Bass: 0-20 (0-172Hz)
    // Mids: 20-100 (172Hz-860Hz)
    // Highs: 100-512 (860Hz+)
    
    let bassSum = 0;
    for (let i = 0; i < 20; i++) bassSum += this.dataArray[i];
    const bassEnergy = (bassSum / 20) / 255;

    let midSum = 0;
    for (let i = 20; i < 100; i++) midSum += this.dataArray[i];
    const midEnergy = (midSum / 80) / 255;

    let highSum = 0;
    for (let i = 100; i < 256; i++) highSum += this.dataArray[i];
    const highEnergy = (highSum / 156) / 255;

    const energy = (bassEnergy * 0.5 + midEnergy * 0.3 + highEnergy * 0.2);
    
    // Smoothing (Lerp) to prevent jitter
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const smoothFactor = 0.2;
    
    this.smoothedKick = lerp(this.smoothedKick, bassEnergy, smoothFactor);
    this.smoothedSnare = lerp(this.smoothedSnare, midEnergy, smoothFactor);
    this.smoothedHihat = lerp(this.smoothedHihat, highEnergy, smoothFactor);
    this.smoothedEnergy = lerp(this.smoothedEnergy, energy, smoothFactor);

    // Simple Beat Detection
    this.energyHistory.push(energy);
    if (this.energyHistory.length > this.historySize) this.energyHistory.shift();
    
    const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
    const isBeat = energy > avgEnergy * 1.3 && energy > 0.1;

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
