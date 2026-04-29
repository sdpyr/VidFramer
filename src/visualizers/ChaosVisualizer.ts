import { IVisualizer, AudioEvents, RenderContext, VisualizerSettings } from '../types';

export class ChaosVisualizer implements IVisualizer {
  public name = 'Chaos';
  private currentShape = 0;
  private lastBeatTime = 0;

  update(audio: AudioEvents) {
    // Şarkıdaki her güçlü ritimde (Kick > 0.85) şekil değiştir (min 1 saniye arayla)
    if (audio.kick > 0.85 && audio.time - this.lastBeatTime > 1.0) {
        this.currentShape = Math.floor(Math.random() * 3);
        this.lastBeatTime = audio.time;
    }
  }

  render(context: RenderContext) {
    const { ctx, width, height, audio, settings } = context;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    // Kaotik rotasyon
    ctx.rotate(audio.time * (this.currentShape === 1 ? -0.5 : 0.5));

    ctx.strokeStyle = settings.primaryColor;
    ctx.lineWidth = 2 + (audio.energy * 10);

    const size = Math.min(width, height) * 0.3 * (1 + audio.bassEnergy);

    ctx.beginPath();
    // Enerjiye göre rastgele geometriler
    if (this.currentShape === 0) {
        // Çarpık üçgenler
        ctx.moveTo(0, -size);
        ctx.lineTo(size, size);
        ctx.lineTo(-size, size);
        ctx.closePath();
    } else if (this.currentShape === 1) {
        // İç içe kareler
        ctx.strokeRect(-size/2, -size/2, size, size);
        ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = settings.secondaryColor;
        ctx.strokeRect(-size/2, -size/2, size, size);
    } else {
        // Şiddetli zikzaklar
        for (let i = -size; i < size; i += 20) {
            ctx.lineTo(i, (Math.random() - 0.5) * size * audio.energy);
        }
    }
    
    ctx.stroke();
    ctx.restore();
  }
}
