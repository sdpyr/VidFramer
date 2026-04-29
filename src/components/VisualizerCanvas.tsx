/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { VisualizerSettings, MusicMetadata, IVisualizer } from '../types';
import { GlitchRenderer } from '../core/Renderer';
import { AudioProcessor } from '../core/AudioProcessor';
import { GlitchVisualizer } from '../visualizers/GlitchVisualizer';
import { SpectrumVisualizer } from '../visualizers/SpectrumVisualizer';
import { RadialVisualizer } from '../visualizers/RadialVisualizer';
import { SimulationVisualizer } from '../visualizers/SimulationVisualizer';
import { PhonkWaveVisualizer } from '../visualizers/PhonkWaveVisualizer';
import { KineticTypoVisualizer } from '../visualizers/KineticTypoVisualizer';
import { NoirGridVisualizer } from '../visualizers/NoirGridVisualizer';
import { EsotericVisualizer } from '../visualizers/EsotericVisualizer';
import { MonolithVisualizer } from '../visualizers/MonolithVisualizer';
import { EtherVisualizer } from '../visualizers/EtherVisualizer';
import { ChaosVisualizer } from '../visualizers/ChaosVisualizer';
import { cn } from '../lib/utils';

interface VisualizerCanvasProps {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  analyserRef?: React.RefObject<AnalyserNode | null>;
  coverUrl?: string;
  isPlaying: boolean;
  settings: VisualizerSettings;
  onUpdateSettings?: (updates: Partial<VisualizerSettings>) => void;
  metadata: MusicMetadata | null;
}

export interface VisualizerHandle {
  getStream: () => MediaStream | null;
}

export const VisualizerCanvas = forwardRef<VisualizerHandle, VisualizerCanvasProps>(({ 
  audioRef,
  analyserRef,
  coverUrl, 
  isPlaying, 
  settings, 
  onUpdateSettings,
  metadata 
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<{
    renderer: GlitchRenderer | null;
    processor: AudioProcessor | null;
    visualizers: Map<string, IVisualizer>;
  }>({
    renderer: null,
    processor: null,
    visualizers: new Map()
  });

  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  const resolution = React.useMemo(() => {
    switch (settings.aspectRatio) {
      case '9:16': return { width: 1080, height: 1920, ratio: 'aspect-[9/16]' };
      case '16:9': return { width: 1920, height: 1080, ratio: 'aspect-video' };
      default: return { width: 1080, height: 1080, ratio: 'aspect-square' };
    }
  }, [settings.aspectRatio]);

  useImperativeHandle(ref, () => ({
    getStream: () => canvasRef.current?.captureStream(60) || null
  }));

  // Initialize Core Logic
  useEffect(() => {
    if (!canvasRef.current || !analyserRef?.current) return;

    const canvas = canvasRef.current;
    
    let processor: AudioProcessor;
    let renderer: GlitchRenderer;

    try {
      processor = new AudioProcessor(analyserRef.current);
      renderer = new GlitchRenderer(canvas);
      
      const visualizers = new Map<string, IVisualizer>();
      visualizers.set('GLITCH', new GlitchVisualizer());
      visualizers.set('SPECTRUM', new SpectrumVisualizer());
      visualizers.set('RADIAL', new RadialVisualizer());
      visualizers.set('SIMULATION', new SimulationVisualizer());
      visualizers.set('PHONK_WAVE', new PhonkWaveVisualizer());
      visualizers.set('KINETIC_TYPO', new KineticTypoVisualizer());
      visualizers.set('NOIR_GRID', new NoirGridVisualizer());
      visualizers.set('ESOTERIC', new EsotericVisualizer());
      visualizers.set('MONOLITH', new MonolithVisualizer());
      visualizers.set('ETHER', new EtherVisualizer());
      visualizers.set('CHAOS', new ChaosVisualizer());

      engineRef.current = { renderer, processor, visualizers };
      renderer.setCoverImage(coverUrl || null);

    } catch (err) {
      console.error("Critical Visualizer Initialization Error:", err);
      return;
    }

    return () => {
      // Cleanup if needed
    };
  }, [analyserRef?.current]);

  // Handle Dynamic Logic Updates (Mode, Cover)
  useEffect(() => {
    const { renderer, visualizers } = engineRef.current;
    if (renderer) {
      const active = visualizers.get(settings.mode) || visualizers.get('GLITCH');
      if (active) renderer.setVisualizer(active);
      renderer.setCoverImage(coverUrl || null);
    }
  }, [settings.mode, coverUrl]);

  // Main Event Loop
  useEffect(() => {
    const animate = (time: number) => {
      const { renderer, processor } = engineRef.current;
      if (renderer && processor && isPlaying) {
        const delta = time - lastTimeRef.current;
        lastTimeRef.current = time;
        const events = processor.process(audioRef.current?.currentTime || 0, delta);
        renderer.render(events, settings, metadata);
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, settings, metadata]);

  // Interactive Dragging
  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !canvasRef.current || !onUpdateSettings) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    onUpdateSettings({ coverX: Math.max(0, Math.min(100, x)), coverY: Math.max(0, Math.min(100, y)) });
  };

  return (
    <div className={cn(
      "relative w-full mx-auto overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl transition-all duration-500",
      resolution.ratio,
      settings.aspectRatio === '9:16' ? 'max-w-[320px]' : settings.aspectRatio === '16:9' ? 'max-w-[800px]' : 'max-w-[550px]'
    )}>
      <canvas 
        ref={canvasRef} 
        width={resolution.width} 
        height={resolution.height} 
        className="h-full w-full object-contain cursor-move"
        onMouseDown={() => setIsDragging(true)}
        onMouseMove={handleInteraction}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onTouchStart={() => setIsDragging(true)}
        onTouchMove={handleInteraction}
        onTouchEnd={() => setIsDragging(false)}
      />
      
      {/* High-Performance CSS Overlays */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
        {settings.vignette > 0 && (
          <div 
            className="absolute inset-0 transition-opacity duration-300" 
            style={{ 
              background: `radial-gradient(circle, transparent 20%, rgba(0,0,0,${settings.vignette * 0.9}))`,
              opacity: 0.8 + (isPlaying ? 0.2 : 0)
            }} 
          />
        )}
        {settings.scanLines > 0 && (
          <div 
            className="absolute inset-0" 
            style={{ 
              backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
              backgroundSize: '100% 4px, 3px 100%',
              opacity: settings.scanLines * 0.5,
            }} 
          />
        )}
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />
    </div>
  );
});

VisualizerCanvas.displayName = 'VisualizerCanvas';
