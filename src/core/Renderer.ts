import { AudioEvents, RenderContext, IVisualizer, VisualizerSettings, MusicMetadata } from '../types';

export class GlitchRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private visualizer: IVisualizer | null = null;
  private lastTime: number = 0;
  private coverImage: HTMLImageElement | null = null;
  private logoImage: HTMLImageElement | null = null;

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

  public setLogoImage(url: string | null) {
    if (!url) {
      this.logoImage = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { this.logoImage = img; };
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
      coverImage: this.coverImage,
      logoImage: this.logoImage
    };

    // 2. Draw Main Visualizer Layer
    if (this.visualizer) {
      this.visualizer.update(audio, settings);
      this.visualizer.render(context);
    }

    // 3. Draw Metadata (Title/Artist)
    this.renderMetadata(context);

    // 4. Draw Synced Lyrics (Karaoke Effect)
    if (settings.showLyrics && settings.syncedLyrics && settings.syncedLyrics.length > 0 && settings.mode !== 'KINETIC_TYPO') {
      this.renderLyrics(context);
    }
    
    // 4.5. Draw Logo
    this.drawLogo(context);

    // 5. Draw Post-Process Effects (Scanlines, Vignette)
    this.applyPostEffects(context);

    // 6. Draw Branding
    // this.drawBranding(ctx, width, height);
  }

  private drawLogo(context: RenderContext) {
    if (!context.logoImage) return;
    const { ctx, width, height, audio, settings } = context;
    
    ctx.save();
    ctx.translate(width / 2, height / 2);
    
    // Yavaşça dönsün, kick/bass ile hafif tepki versin
    ctx.rotate((audio.time * 0.1) + (audio.energy * 0.05));
    
    // Başlangıç boyutu ve sese göre büyüme
    const baseSize = Math.min(width, height) * 0.3; // Ekranın %30'u kadar
    const size = baseSize + (audio.bassEnergy * baseSize * 0.2); // Bass ile %20 büyür
    
    // Merkezde Parlama (Glow)
    ctx.shadowBlur = 30 + (audio.kick * 40);
    ctx.shadowColor = settings.primaryColor;
    
    // Resmi merkeze çiz
    ctx.drawImage(context.logoImage, -size / 2, -size / 2, size, size);
    
    ctx.restore();
  }

  private drawBranding(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.save();
    ctx.font = '700 24px "JetBrains Mono"';
    ctx.fillStyle = 'rgba(228, 227, 224, 0.3)'; // Yarı saydam antrasit/gri
    ctx.textAlign = 'center';
    ctx.letterSpacing = '10px';
    // Ekranın en altına, ortalayarak markayı/imzayı bas
    ctx.fillText("VIDFRAMER ENGINE", width / 2, height - 50);
    ctx.restore();
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
