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

    // 3. Draw Metadata (Title/Artist)
    this.renderMetadata(context);

    // 4. Draw Synced Lyrics (Karaoke Effect)
    if (settings.showLyrics && settings.syncedLyrics.length > 0) {
      this.renderLyrics(context);
    }

    // 5. Draw Post-Process Effects (Scanlines, Vignette)
    this.applyPostEffects(context);
  }

  private renderMetadata({ ctx, width, height, settings, metadata }: RenderContext) {
    if (!settings.showTitle && !settings.showArtist) return;

    const margin = 40;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    if (settings.showTitle) {
        ctx.font = `900 24px "${settings.titleFont}"`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText((settings.customTitle || metadata?.title || '').toUpperCase(), margin, margin);
    }

    if (settings.showArtist) {
        ctx.font = `600 14px "${settings.artistFont}"`;
        ctx.fillStyle = settings.primaryColor;
        ctx.fillText((settings.customArtist || metadata?.artist || '').toUpperCase(), margin, margin + 30);
    }
  }

  private renderLyrics({ ctx, width, height, settings, audio }: RenderContext) {
    const activeLines = settings.syncedLyrics.filter(l => audio.time >= l.startTime - 1 && audio.time <= l.endTime + 2);
    if (activeLines.length === 0) return;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // We only show the "most" current line usually for a focus effect
    const currentLine = activeLines.find(l => audio.time >= l.startTime && audio.time <= l.endTime) || activeLines[0];
    
    const centerY = height * 0.85; // Position at bottom
    
    // Draw Current Line with Word Highlight
    if (currentLine) {
        const words = currentLine.words;
        const totalText = currentLine.text;
        ctx.font = `700 28px "${settings.lyricsFont}"`;
        
        // Calculate total width to center properly
        const totalWidth = ctx.measureText(totalText).width;
        let currentX = (width / 2) - (totalWidth / 2);

        words.forEach(word => {
            const isActive = audio.time >= word.startTime && audio.time <= word.endTime;
            const isPast = audio.time > word.endTime;
            
            ctx.save();
            if (isActive) {
                ctx.fillStyle = '#ffffff';
                ctx.shadowBlur = 15;
                ctx.shadowColor = settings.primaryColor;
                // Scale up active word slightly
                ctx.translate(currentX + ctx.measureText(word.word).width/2, centerY);
                ctx.scale(1.1, 1.1);
                ctx.translate(-(currentX + ctx.measureText(word.word).width/2), -centerY);
            } else if (isPast) {
                ctx.fillStyle = `rgba(255,255,255,${settings.lyricsPastOpacity})`;
                if (settings.lyricsBlur > 0) ctx.filter = `blur(${settings.lyricsBlur * 10}px)`;
            } else {
                ctx.fillStyle = `rgba(255,255,255,${settings.lyricsFutureOpacity})`;
            }

            ctx.fillText(word.word, currentX + ctx.measureText(word.word).width/2, centerY);
            ctx.restore();
            
            currentX += ctx.measureText(word.word + ' ').width;
        });
    }
  }

  private applyPostEffects(context: RenderContext) {
    // Post-processing is now partially offloaded to CSS overlays in the UI layer
    // to preserve CPU cycles for high-res WebM export and rendering.
    // Use this space only for per-frame dynamic filters if needed.
  }
}
