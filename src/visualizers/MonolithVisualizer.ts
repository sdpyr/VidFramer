import { IVisualizer, AudioEvents, RenderContext, VisualizerSettings } from '../types';

export class MonolithVisualizer implements IVisualizer {
  public name = 'Monolith';

  update() {}

  render(context: RenderContext) {
    const { ctx, width, height, audio, settings } = context;
    
    ctx.save();
    const padding = 50 + (audio.kick * 100 * settings.intensity);
    
    // Ağır, yavaş hareket eden ana blok
    ctx.fillStyle = '#050505'; // Zemin
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = settings.primaryColor;
    ctx.lineWidth = 15 + (audio.snare * 30);
    
    // Kamera sarsıntısı (Ağır bass'ta)
    if (audio.bassEnergy > 0.8) {
        ctx.translate((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30);
    }

    // Devasa Brütalist Çerçeveler
    ctx.strokeRect(padding, padding, width - padding * 2, height - padding * 2);
    
    // İç Monolit (Sese göre dikeyde büyür)
    const blockHeight = height * 0.3 * (1 + audio.energy);
    ctx.fillStyle = settings.secondaryColor;
    ctx.fillRect(width * 0.2, (height - blockHeight) / 2, width * 0.6, blockHeight);

    // Kaba (Raw) Glitch Çizgileri
    if (audio.hihat > 0.6) {
        ctx.fillStyle = settings.primaryColor;
        ctx.fillRect(0, height * Math.random(), width, 10 + Math.random() * 20);
    }
    
    ctx.restore();
  }
}
