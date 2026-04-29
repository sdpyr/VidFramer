import { IVisualizer, AudioEvents, RenderContext, VisualizerSettings } from '../types';

export class SpectrumVisualizer implements IVisualizer {
  public name = 'Spectrum';
  private bars: number[] = new Array(64).fill(0);

  update(audio: AudioEvents, settings: VisualizerSettings) {
    // Smoothed transition between frames
    this.bars = this.bars.map((bar, i) => {
      const target = audio.spectrum[i] || 0;
      return bar + (target - bar) * 0.3;
    });
  }

  render(context: RenderContext) {
    const { ctx, width, height, audio, settings, coverImage } = context;
    const barWidth = (width / this.bars.length);
    const primary = settings.primaryColor;
    const secondary = settings.secondaryColor;

    // Background Glow
    const grad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width * 0.7);
    grad.addColorStop(0, `${primary}11`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    this.bars.forEach((val, i) => {
      const h = val * height * 0.6 * settings.intensity;
      const x = i * barWidth;
      
      const gradient = ctx.createLinearGradient(x, height - h, x, height);
      gradient.addColorStop(0, primary);
      gradient.addColorStop(1, secondary);
      
      ctx.fillStyle = gradient;
      ctx.globalAlpha = 0.8 + (audio.kick * 0.2);
      ctx.fillRect(x, height - h, barWidth - 1, h);
    });
    ctx.restore();

    if (coverImage) {
        this.renderCover(context);
    }
  }

  private renderCover({ ctx, width, height, audio, settings, coverImage }: RenderContext) {
    if (!coverImage) return;
    const scale = (settings.coverScale || 1.0) * (1 + audio.kick * 0.05);
    const size = Math.min(width, height) * 0.45 * scale;
    const dx = (width * (settings.coverX / 100)) - (size / 2);
    const dy = (height * (settings.coverY / 100)) - (size / 2);

    ctx.save();
    if (audio.beat) {
      ctx.shadowColor = settings.primaryColor;
      ctx.shadowBlur = 40 * audio.energy;
    }
    ctx.drawImage(coverImage, dx, dy, size, size);
    ctx.restore();
  }
}
