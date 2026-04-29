import { IVisualizer, AudioEvents, RenderContext, VisualizerSettings } from '../types';

export class SimulationVisualizer implements IVisualizer {
  public name = 'Simulation';
  private blinkTimer = 0;
  private isBlinking = false;
  private pupilSize = 1;

  update(audio: AudioEvents, settings: VisualizerSettings) {
    // Pupil dilation based on overall energy
    this.pupilSize = 1 + audio.energy * 0.8 * settings.intensity;
    
    // Random blinking
    if (!this.isBlinking && Math.random() > 0.98) {
      this.isBlinking = true;
      this.blinkTimer = 0;
    }

    if (this.isBlinking) {
      this.blinkTimer += 0.15;
      if (this.blinkTimer >= 1) {
        this.isBlinking = false;
      }
    }
  }

  render(context: RenderContext) {
    const { ctx, width, height, audio, settings } = context;
    const centerX = width / 2;
    const centerY = height / 2;
    const eyeWidth = Math.min(width, height) * 0.6;
    const eyeHeight = eyeWidth * 0.4;

    ctx.save();
    
    // Background Pulse (Brutalist style)
    if (audio.beat) {
        ctx.fillStyle = `${settings.primaryColor}11`;
        ctx.fillRect(0, 0, width, height);
    }

    // 1. Draw Eye Shape (The Sclera)
    ctx.beginPath();
    const blinkFactor = this.isBlinking ? Math.sin(this.blinkTimer * Math.PI) : 0;
    const currentHeight = eyeHeight * (1 - blinkFactor);
    
    ctx.ellipse(centerX, centerY, eyeWidth / 2, currentHeight / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#E4E3E0';
    ctx.fill();
    ctx.strokeStyle = settings.primaryColor;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.clip(); // Keep everything inside the eye

    // 2. Iris
    const irisRadius = (eyeHeight * 0.8) / 2;
    ctx.beginPath();
    ctx.arc(centerX + (Math.random() - 0.5) * audio.hihat * 10, centerY, irisRadius, 0, Math.PI * 2);
    ctx.fillStyle = settings.primaryColor;
    ctx.fill();

    // 3. Pupil (Reacts to Bass)
    const pupilRadius = irisRadius * 0.4 * this.pupilSize;
    ctx.beginPath();
    ctx.arc(centerX, centerY, pupilRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#050505';
    ctx.fill();

    // 4. Glitch Rings (Radiation from eye)
    if (audio.beat || audio.hihat > 0.7) {
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = settings.secondaryColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        const ringCount = 3;
        for(let i=0; i<ringCount; i++) {
            const r = (eyeWidth * 0.6) + (i * 40) + (audio.kick * 100);
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, r, r * 0.4, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    ctx.restore();

    // 5. Brutalist Scanlines (Horizontal glitch lines)
    if (audio.snare > 0.6) {
        ctx.fillStyle = settings.primaryColor;
        const lineH = 2;
        const y = Math.random() * height;
        ctx.fillRect(0, y, width, lineH);
    }
  }
}
