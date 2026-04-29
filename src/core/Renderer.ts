import { AudioEvents, RenderContext, IVisualizer, VisualizerSettings, MusicMetadata } from '../types';

export class GlitchRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private visualizer: IVisualizer | null = null;
  private lastTime: number = 0;
  private coverImage: HTMLImageElement | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  public setVisualizer(visualizer: IVisualizer) {
    this.visualizer = visualizer;
  }

  public setCoverImage(url: string | null) {
    if (!url) {
      this.coverImage = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { this.coverImage = img; };
    img.src = url;
  }

  public render(audio: AudioEvents, settings: VisualizerSettings, metadata: MusicMetadata | null) {
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    // 1. Clear Stage / Background
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, width, height);

    const context: RenderContext = {
      ctx,
      width,
      height,
      settings,
      audio,
      metadata,
      coverImage: this.coverImage
    };

    // 2. Draw Main Visualizer Layer
    if (this.visualizer) {
      this.visualizer.update(audio, settings);
      this.visualizer.render(context);
    }

    // 3. Draw Post-Process Effects (Scanlines, Vignette)
    this.applyPostEffects(context);
  }

  private applyPostEffects(context: RenderContext) {
    const { ctx, width, height, settings, audio } = context;

    // Vignette
    if (settings.vignette > 0) {
      const gradient = ctx.createRadialGradient(width / 2, height / 2, width * 0.2, width / 2, height / 2, width * 0.8);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, `rgba(0,0,0,${settings.vignette * 0.8})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    // Scanlines
    if (settings.scanLines > 0) {
      ctx.save();
      ctx.globalAlpha = settings.scanLines * 0.3;
      ctx.fillStyle = '#000';
      for (let i = 0; i < height; i += 4) {
        ctx.fillRect(0, i, width, 1);
      }
      ctx.restore();
    }
    
    // RGB Split / Chromatic Aberration (handled within visualizers for efficiency usually, 
    // but can be a global shift if needed)
  }
}
