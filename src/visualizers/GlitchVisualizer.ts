import { IVisualizer, AudioEvents, RenderContext, VisualizerSettings } from '../types';

export class GlitchVisualizer implements IVisualizer {
  public name = 'Glitch';
  private particles: { x: number, y: number, vx: number, vy: number, size: number, color: string }[] = [];
  private lastBeatTime: number = 0;

  constructor() {
    this.initParticles();
  }

  private initParticles() {
    this.particles = Array.from({ length: 50 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      size: Math.random() * 3 + 1,
      color: Math.random() > 0.5 ? '#fff' : '#444'
    }));
  }

  update(audio: AudioEvents, settings: VisualizerSettings) {
    // Persistent state updates go here
    this.particles.forEach(p => {
      p.x += p.vx * (1 + audio.kick * 5);
      p.y += p.vy * (1 + audio.kick * 5);
      if (p.x < 0) p.x = 100;
      if (p.x > 100) p.x = 0;
      if (p.y < 0) p.y = 100;
      if (p.y > 100) p.y = 0;
    });
  }

  render(context: RenderContext) {
    const { ctx, width, height, audio, settings, coverImage } = context;
    
    // Background Pulse
    const bgOpacity = audio.kick * 0.15 * settings.intensity;
    ctx.fillStyle = `rgba(242, 125, 38, ${bgOpacity})`;
    ctx.fillRect(0, 0, width, height);

    // Spectrum Bars (Low opacity background)
    const padding = 20;
    const barWidth = (width - padding * 2) / audio.spectrum.length;
    ctx.fillStyle = settings.primaryColor;
    ctx.globalAlpha = 0.1;
    audio.spectrum.forEach((val, i) => {
      const h = val * height * 0.5;
      ctx.fillRect(padding + i * barWidth, height - h, barWidth - 1, h);
    });
    ctx.globalAlpha = 1;

    // Cover Image Handling
    if (coverImage) {
      this.renderCover(context);
    }

    // Particle field
    ctx.save();
    this.particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.5 + audio.snare * 0.5;
      ctx.beginPath();
      ctx.arc(p.x / 100 * width, p.y / 100 * height, p.size * (1 + audio.kick), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  private renderCover({ ctx, width, height, audio, settings, coverImage }: RenderContext) {
    if (!coverImage) return;

    const scale = (settings.coverScale || 1.0) * (1 + audio.kick * 0.1 * settings.intensity);
    const sw = coverImage.width;
    const sh = coverImage.height;
    const size = Math.min(width, height) * 0.5 * scale;
    
    const dx = (width * (settings.coverX / 100)) - (size / 2);
    const dy = (height * (settings.coverY / 100)) - (size / 2);

    // Glitch Shifting: Strictly audio-triggered to prevent "random jitter"
    const isGlitchTriggered = settings.mode === 'GLITCH' && (audio.beat || audio.energy > 0.85);
    
    if (isGlitchTriggered) {
      const slices = Math.floor(15 + audio.kick * 40);
      for (let i = 0; i < slices; i++) {
        const sy = Math.random() * sh;
        const sh_slice = Math.random() * (40 * settings.intensity);
        const offset = (Math.random() - 0.5) * 150 * audio.energy * settings.displacement;
        
        ctx.globalAlpha = 0.5 + Math.random() * 0.5;
        ctx.drawImage(
          coverImage, 
          0, sy, sw, sh_slice, 
          dx + offset, dy + (sy / sh) * size, size, (sh_slice / sh) * size
        );
      }
      ctx.globalAlpha = 1;
    } else {
      // Clean draw with subtle floating
      const float = Math.sin(Date.now() / 1200) * 8;
      ctx.drawImage(coverImage, dx, dy + float, size, size);
    }
  }
}
