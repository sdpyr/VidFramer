import { IVisualizer, AudioEvents, RenderContext, VisualizerSettings } from '../types';

export class RadialVisualizer implements IVisualizer {
  public name = 'Radial';

  update(audio: AudioEvents, settings: VisualizerSettings) {
    // Basic logic
  }

  render(context: RenderContext) {
    const { ctx, width, height, audio, settings, coverImage } = context;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.25;

    ctx.save();
    ctx.translate(centerX, centerY);
    
    const count = audio.spectrum.length;
    const step = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
      const angle = i * step;
      const val = audio.spectrum[i] || 0;
      const h = val * radius * 1.5 * settings.intensity;
      
      const x1 = Math.cos(angle) * radius;
      const y1 = Math.sin(angle) * radius;
      const x2 = Math.cos(angle) * (radius + h);
      const y2 = Math.sin(angle) * (radius + h);

      ctx.beginPath();
      ctx.lineWidth = 4 + audio.kick * 4;
      ctx.strokeStyle = i % 2 === 0 ? settings.primaryColor : settings.secondaryColor;
      ctx.globalAlpha = 0.5 + val * 0.5;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();

    if (coverImage) {
        this.renderCover(context);
    }
  }

  private renderCover({ ctx, width, height, audio, settings, coverImage }: RenderContext) {
    if (!coverImage) return;
    const pulse = 1 + (audio.kick * 0.1);
    const size = Math.min(width, height) * 0.4 * settings.coverScale * pulse;
    const dx = (width * (settings.coverX / 100)) - (size / 2);
    const dy = (height * (settings.coverY / 100)) - (size / 2);

    ctx.save();
    ctx.drawImage(coverImage, dx, dy, size, size);
    ctx.restore();
  }
}
