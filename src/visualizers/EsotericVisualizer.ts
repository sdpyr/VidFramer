import { IVisualizer, AudioEvents, RenderContext, VisualizerSettings } from '../types';

export class EsotericVisualizer implements IVisualizer {
  public name = 'Esoteric';
  private rotation = 0;
  private mysticNumbers = ['1', '6', '9'];

  update(audio: AudioEvents, settings: VisualizerSettings) {
    // Normalde yavaş döner, ritimle dönüş hızı ivmelenir
    this.rotation += 0.005 + (audio.energy * 0.02 * settings.intensity);
  }

  render(context: RenderContext) {
    const { ctx, width, height, audio, settings } = context;
    const centerX = width / 2;
    const centerY = height / 2;
    
    ctx.save();
    
    // 1. Arka Planda Beliren Numerolojik Şifreler (Hi-hat'e duyarlı)
    if (audio.hihat > 0.6) {
        ctx.font = '900 300px "Space Grotesk"';
        ctx.fillStyle = `rgba(255, 255, 255, ${audio.hihat * 0.1})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 1, 6, 9 rakamlarından birini ekrana rastgele bas
        const num = this.mysticNumbers[Math.floor(Math.random() * this.mysticNumbers.length)];
        const offsetX = (Math.random() - 0.5) * width * 0.5;
        const offsetY = (Math.random() - 0.5) * height * 0.5;
        
        ctx.fillText(num, centerX + offsetX, centerY + offsetY);
    }

    // 2. Merkezdeki Okült Çemberler
    ctx.translate(centerX, centerY);
    ctx.rotate(this.rotation);

    const baseRadius = Math.min(width, height) * 0.3;
    
    for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        // Bas frekansına göre çemberler esner
        const r = baseRadius * (i * 0.3) * (1 + audio.bassEnergy * 0.2);
        
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = i % 2 === 0 ? settings.primaryColor : settings.secondaryColor;
        ctx.lineWidth = i === 3 ? 4 : 1;
        
        // Kesik çizgi efekti (Dash)
        if (i === 2) ctx.setLineDash([15, 15]);
        
        ctx.stroke();
        ctx.setLineDash([]); // Sıfırla
    }

    // İç geometrik bağlantılar
    const points = 6;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const x = Math.cos(angle) * (baseRadius * 0.9);
        const y = Math.sin(angle) * (baseRadius * 0.9);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = settings.secondaryColor;
    ctx.globalAlpha = 0.5 + audio.energy * 0.5;
    ctx.stroke();

    ctx.restore();
  }
}
