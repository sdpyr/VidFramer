import { IVisualizer, AudioEvents, RenderContext, VisualizerSettings } from '../types';

export class EtherVisualizer implements IVisualizer {
  public name = 'Ether';
  private phase = 0;

  update(audio: AudioEvents) {
    // Çok yavaş, huzurlu bir akış
    this.phase += 0.01 + (audio.energy * 0.02);
  }

  render(context: RenderContext) {
    const { ctx, width, height, audio, settings } = context;
    
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    
    const lines = 5;
    for (let j = 0; j < lines; j++) {
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        
        for (let i = 0; i < width; i += 10) {
            // Yumuşak, düşük frekanslı dalgalanma
            const yOffset = Math.sin((i * 0.005) + this.phase + j) * (50 + audio.midEnergy * 200 * settings.intensity);
            
            ctx.lineTo(i, (height / 2) + yOffset + (j * 20 - (lines * 10)));
        }
        
        ctx.strokeStyle = j % 2 === 0 ? settings.primaryColor : settings.secondaryColor;
        ctx.lineWidth = 2 + (audio.energy * 3);
        ctx.globalAlpha = 0.3 + (audio.highEnergy * 0.2);
        ctx.stroke();
    }
    
    ctx.restore();
  }
}
