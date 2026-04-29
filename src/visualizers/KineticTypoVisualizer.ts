import { IVisualizer, AudioEvents, RenderContext, VisualizerSettings } from '../types';

export class KineticTypoVisualizer implements IVisualizer {
  public name = 'KineticTypo';

  update() {}

  render(context: RenderContext) {
    const { ctx, width, height, audio, settings, metadata } = context;
    
    let displayText = "";

    // 1. Sadece Magic Sync (Yapay Zeka) zamanlamalarını kullan
    if (settings.syncedLyrics && settings.syncedLyrics.length > 0) {
        // O anki saniyeye denk gelen satırı bul
        const activeLine = settings.syncedLyrics.find(
            line => audio.time >= line.startTime && audio.time <= line.endTime
        );
        
        if (activeLine) {
            // Satırın içindeki o anki KELİMEYİ bul (Kelime kelime patlaması için)
            const activeWord = activeLine.words?.find(
                w => audio.time >= w.startTime && audio.time <= w.endTime
            );
            // Eğer tam o saniyede kelime varsa onu, yoksa satırın tamamını bas
            displayText = activeWord ? activeWord.word : activeLine.text;
        }
    }

    // 2. Şarkıda söz yoksa (intro/outro) Sanatçı Adını göster
    if (!displayText) {
        displayText = metadata?.artist || "22noir"; 
    }

    ctx.save();
    ctx.translate(width / 2, height / 2);
    
    // 3. AGRESİF KİNETİK ÇARPMA EFEKTİ (Kick ve Bass şiddetine göre)
    const kickImpact = audio.kick * settings.intensity;
    const scale = 1 + (kickImpact * 0.8); // Ritimde metni aniden büyüt
    
    // Ağır 808'lerde ekranı sağa sola sars (Camera Shake)
    if (audio.bassEnergy > 0.8) {
        ctx.translate(
            (Math.random() - 0.5) * 50 * kickImpact, 
            (Math.random() - 0.5) * 50 * kickImpact
        );
    }

    ctx.scale(scale, scale);

    // Dinamik Font: Tek kelimeyse devasa, uzun cümleyse ekrana sığacak kadar
    const isSingleWord = displayText.split(' ').length === 1;
    const baseFontSize = isSingleWord ? 180 : 80;
    
    ctx.font = `900 ${baseFontSize + (audio.snare * 40)}px "Space Grotesk"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // RGB Glitch Parçalanması (Yüksek enerjide devreye girer)
    if (audio.energy > 0.75) {
        ctx.fillStyle = '#FF0000'; // Kırmızı yansıma
        ctx.fillText(displayText, -15 * audio.energy, 0);
        ctx.fillStyle = '#00FFFF'; // Camgöbeği yansıma
        ctx.fillText(displayText, 15 * audio.energy, 0);
    }

    // Ana Kelimeyi Bas
    ctx.fillStyle = settings.primaryColor;
    ctx.fillText(displayText, 0, 0);
    
    ctx.restore();
  }
}
