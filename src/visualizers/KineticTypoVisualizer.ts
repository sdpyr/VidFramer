import { IVisualizer, AudioEvents, RenderContext, VisualizerSettings } from '../types';

export class KineticTypoVisualizer implements IVisualizer {
  public name = 'KineticTypo';

  update() {}

  getCurrentLyricBasedOnTime(time: number, lyrics: string): string | null {
    // Basic implementation since we don't have time sync for plain text lyrics here
    // Just display a random chunk or the first part, or maybe based on energy
    // For a real implementation we'd need time synced lyrics.
    // Let's just split by words and pick words based on time loosely
    if (!lyrics) return null;
    const words = lyrics.split(/\s+/).filter(w => w.trim().length > 0);
    if (words.length === 0) return null;
    // Advance 2 words per second as a dummy sync
    const index = Math.floor(time * 2) % words.length;
    // Show 3 words at a time
    return words.slice(index, index + 3).join(" ");
  }

  renderDefaultMetadata(context: RenderContext) {
    const { ctx, width, height, audio, settings, metadata } = context;
    const text = metadata?.artist || "UNKNOWN";
    
    ctx.save();
    ctx.translate(width / 2, height / 2);
    
    const scale = 1 + (audio.kick * 0.5 * settings.intensity);
    ctx.scale(scale, scale);

    ctx.font = `900 ${150 + (audio.snare * 50)}px "Space Grotesk"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (audio.energy > 0.7) {
        ctx.fillStyle = 'red';
        ctx.fillText(text, -10 * audio.energy, 0);
        ctx.fillStyle = 'cyan';
        ctx.fillText(text, 10 * audio.energy, 0);
    }

    ctx.fillStyle = settings.primaryColor;
    ctx.fillText(text, 0, 0);
    
    ctx.restore();
  }

  render(context: RenderContext) {
    const { ctx, width, height, audio, settings, metadata } = context;
    
    if (!settings.showSunoLyrics || !metadata?.lyrics) {
      this.renderDefaultMetadata(context);
      return;
    }

    const currentLyric = this.getCurrentLyricBasedOnTime(audio.time, metadata.lyrics);
    
    if (currentLyric) {
      ctx.save();
      const shake = audio.kick * 10;
      ctx.translate(width / 2 + (Math.random() - 0.5) * shake, height / 2);
      
      ctx.font = `900 ${120 + audio.bassEnergy * 40}px "Space Grotesk"`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      if (audio.hihat > 0.5) {
        ctx.fillStyle = '#ff0000';
        ctx.fillText(currentLyric, -5, 0);
        ctx.fillStyle = '#00ffff';
        ctx.fillText(currentLyric, 5, 0);
      }
      
      ctx.fillStyle = settings.primaryColor;
      ctx.fillText(currentLyric, 0, 0);
      ctx.restore();
    }
  }
}
