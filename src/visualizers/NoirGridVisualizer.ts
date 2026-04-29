import { IVisualizer, AudioEvents, RenderContext, VisualizerSettings } from '../types';

export class NoirGridVisualizer implements IVisualizer {
  public name = 'NoirGrid';

  update() {}

  render(context: RenderContext) {
    const { ctx, width, height, audio, settings } = context;
    
    const gridSize = 50 + (audio.bassEnergy * 20 * settings.intensity);
    const cols = Math.ceil(width / gridSize);
    const rows = Math.ceil(height / gridSize);

    ctx.save();
    ctx.lineWidth = 1 + (audio.kick * 3);
    
    // Ağır bass vuruşlarında ekran sarsıntısı (Camera Shake)
    if (audio.kick > 0.6) {
        ctx.translate((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
    }

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = i * gridSize;
        const y = j * gridSize;

        // Izgara çizgileri
        ctx.strokeStyle = `rgba(228, 227, 224, ${0.1 + audio.highEnergy * 0.2})`;
        ctx.strokeRect(x, y, gridSize, gridSize);

        // Sub-bass seviyesi yüksekse bazı kareleri rastgele doldur (Brütalist Glitch)
        if (audio.bassEnergy > 0.7 && Math.random() > 0.8) {
          ctx.fillStyle = settings.primaryColor; // Uyarı Sarısı
          ctx.globalAlpha = audio.kick;
          ctx.fillRect(x + 2, y + 2, gridSize - 4, gridSize - 4);
          ctx.globalAlpha = 1.0;
        }
      }
    }
    ctx.restore();
  }
}
