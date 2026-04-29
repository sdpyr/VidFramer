import { IVisualizer, AudioEvents, RenderContext, VisualizerSettings } from '../types';

export class PhonkWaveVisualizer implements IVisualizer {
  public name = 'PhonkWave';

  update(audio: AudioEvents, settings: VisualizerSettings) {}

  render(context: RenderContext) {
    const { ctx, width, height, audio, settings } = context;
    const centerY = height / 2;
    
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, centerY);

    const sliceWidth = width / audio.spectrum.length;
    let x = 0;

    // Yıkıcı 808 tepkimesi
    const distortion = audio.bassEnergy > 0.8 ? (Math.random() - 0.5) * 50 : 0;

    for (let i = 0; i < audio.spectrum.length; i++) {
      const v = audio.spectrum[i];
      // Hi-hat'lerde (highEnergy) dalga uçlarını sivrilt
      const ySharpness = v * height * 0.4 * settings.intensity * (1 + audio.highEnergy);
      const y = centerY - ySharpness + distortion;

      ctx.lineTo(x, y);
      x += sliceWidth;
    }

    ctx.lineTo(width, centerY);
    
    ctx.lineWidth = 6 + (audio.kick * 10);
    ctx.strokeStyle = settings.primaryColor; // Antrasit arka planda sarı patlamalar
    ctx.shadowBlur = 20 * audio.energy;
    ctx.shadowColor = settings.primaryColor;
    ctx.stroke();

    // Alt yansıma (Mirror)
    ctx.globalAlpha = 0.3;
    ctx.scale(1, -1);
    ctx.translate(0, -height);
    ctx.stroke();
    
    ctx.restore();
  }
}
