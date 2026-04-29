/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { VisualizerSettings } from '../types';
import { cn } from '../lib/utils';

interface VisualizerCanvasProps {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  coverUrl?: string;
  isPlaying: boolean;
  settings: VisualizerSettings;
  onUpdateSettings?: (updates: Partial<VisualizerSettings>) => void;
}

export interface VisualizerHandle {
  getStream: () => MediaStream | null;
  getAudioSource: () => MediaElementAudioSourceNode | null;
}

export const VisualizerCanvas = forwardRef<VisualizerHandle, VisualizerCanvasProps>(({ audioRef, coverUrl, isPlaying, settings, onUpdateSettings }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const timeDataRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const particlesRef = useRef<{x: number, y: number, vx: number, vy: number, size: number, color: string}[]>([]);
  const lastIntensityRef = useRef<number>(0);
  const beatCooldownRef = useRef<number>(0);

  const [isAudioReady, setIsAudioReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Resolution handling - Internal high-res for quality
  const resolution = React.useMemo(() => {
    switch (settings.aspectRatio) {
      case '9:16': return { width: 1080, height: 1920, ratio: 'aspect-[9/16]' };
      case '16:9': return { width: 1920, height: 1080, ratio: 'aspect-video' };
      default: return { width: 1080, height: 1080, ratio: 'aspect-square' };
    }
  }, [settings.aspectRatio]);

  // Initialize particles
  useEffect(() => {
    const particles = [];
    const pWidth = resolution.width;
    const pHeight = resolution.height;
    
    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * pWidth,
        y: Math.random() * pHeight,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 3 + 1,
        color: Math.random() > 0.5 ? settings.primaryColor : settings.secondaryColor
      });
    }
    particlesRef.current = particles;
  }, [resolution]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !canvasRef.current || !onUpdateSettings) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onUpdateSettings({ coverX: x, coverY: y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useImperativeHandle(ref, () => ({
    getStream: () => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      
      const canvasStream = canvas.captureStream(60);
      if (!canvasStream) return null;
      
      if (audioCtxRef.current && sourceRef.current) {
        const dest = audioCtxRef.current.createMediaStreamDestination();
        sourceRef.current.connect(dest);
        dest.stream.getAudioTracks().forEach(track => canvasStream.addTrack(track));
      }
      return canvasStream;
    },
    getAudioSource: () => sourceRef.current
  }));

  useEffect(() => {
    const initAudio = () => {
      if (audioCtxRef.current || !audioRef.current) return;
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaElementSource(audioRef.current!);
      
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      
      analyser.fftSize = 512;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const timeData = new Uint8Array(bufferLength);
      
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;
      timeDataRef.current = timeData;
      audioCtxRef.current = audioCtx;
      sourceRef.current = source;
      setIsAudioReady(true);
    };

    const handlePlay = () => {
      initAudio();
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    };

    const audioElement = audioRef.current;
    if (audioElement) {
      audioElement.addEventListener('play', handlePlay);
      if (isPlaying) handlePlay();
    }

    return () => {
      audioElement?.removeEventListener('play', handlePlay);
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [audioRef, isPlaying, isAudioReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    if (coverUrl) img.src = coverUrl;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      let normalizedIntensity = 0;

      // Fill background
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, width, height);

      if (analyserRef.current && dataArrayRef.current && timeDataRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        analyserRef.current.getByteTimeDomainData(timeDataRef.current);
        
        const data = dataArrayRef.current;
        const timeData = timeDataRef.current;
        const avgFreq = data.reduce((a, b) => a + b) / data.length;
        
        let currentIntensity = (avgFreq / 255);
        normalizedIntensity = currentIntensity * settings.intensity;

        // Beat Detection
        let isBeat = false;
        if (settings.beatSync) {
          const threshold = 0.15;
          const delta = currentIntensity - lastIntensityRef.current;
          if (delta > threshold && beatCooldownRef.current <= 0) {
            isBeat = true;
            beatCooldownRef.current = 10; // frames
          }
          if (beatCooldownRef.current > 0) beatCooldownRef.current--;
        }
        lastIntensityRef.current = currentIntensity;

        const dynamicIntensity = isBeat ? normalizedIntensity * 1.5 : normalizedIntensity;

        // Lyrics-Visual Synergy: Boost on word start
        let synergyBoost = 1;
        if (settings.showLyrics && settings.syncedLyrics.length > 0) {
          const currentTime = audioRef.current?.currentTime || 0;
          const currentLine = settings.syncedLyrics.find(l => currentTime >= l.startTime && currentTime <= l.endTime);
          if (currentLine) {
            const isWordStarting = currentLine.words.some(w => Math.abs(currentTime - w.startTime) < 0.03);
            if (isWordStarting) synergyBoost = 1.3;
          }
        }
        
        const finalIntensity = dynamicIntensity * synergyBoost;

        // Base Image Layer
        if (img.complete && coverUrl) {
          const sw = img.width;
          const sh = img.height;
          
          // Responsive Cover Art Scaling Logic
          let dw, dh;
          const targetRatio = width / height;
          const imgRatio = sw / sh;
          
          if (imgRatio > targetRatio) {
            dh = height * settings.coverScale;
            dw = dh * imgRatio;
          } else {
            dw = width * settings.coverScale;
            dh = dw / imgRatio;
          }

          const dx = (width * (settings.coverX / 100)) - (dw / 2);
          const dy = (height * (settings.coverY / 100)) - (dh / 2);

          ctx.save();
          
          // Enhanced Pulse & Jitter Logic
          const pulseAmount = 1 + (finalIntensity * 0.15);
          const jitterX = isBeat ? (Math.random() - 0.5) * 40 * settings.displacement : (Math.random() - 0.5) * 5 * normalizedIntensity;
          const jitterY = isBeat ? (Math.random() - 0.5) * 40 * settings.displacement : (Math.random() - 0.5) * 5 * normalizedIntensity;
          
          const pdw = dw * pulseAmount;
          const pdh = dh * pulseAmount;
          const pdx = dx - (pdw - dw) / 2 + jitterX;
          const pdy = dy - (pdh - dh) / 2 + jitterY;

          // Subtle Floating Animation
          const floatOffset = Math.sin(Date.now() / 1200) * 15;
          const finalY = pdy + floatOffset;

          if (settings.mode === 'GLITCH') {
            const glitchTrigger = Math.random() > (1.1 - finalIntensity) || avgFreq > 180 || isBeat;
            if (glitchTrigger) {
              const sliceCount = Math.floor(15 * settings.intensity * (isBeat ? 2.5 : 1));
              for (let i = 0; i < sliceCount; i++) {
                const sx = Math.random() * sw;
                const sy = Math.random() * sh;
                const sliceW = Math.random() * sw * 0.4 * settings.displacement;
                const sliceH = Math.random() * 40 * settings.intensity;
                
                const drift = isBeat ? (Math.random() - 0.5) * 150 * settings.colorDistortion : (Math.random() - 0.5) * 30 * settings.colorDistortion;
                const targetX = pdx + (sx / sw) * pdw + drift;
                const targetY = finalY + (sy / sh) * pdh + (Math.random() - 0.5) * 10;
                
                ctx.globalCompositeOperation = Math.random() > 0.6 ? 'screen' : 'multiply';
                ctx.globalAlpha = 0.4 + Math.random() * 0.6;
                ctx.drawImage(img, sx, sy, sliceW, sliceH, targetX, targetY, (sliceW / sw) * pdw, (sliceH / sh) * pdh);
              }
              ctx.globalCompositeOperation = 'source-over';
              ctx.globalAlpha = 1;
            } else {
              ctx.drawImage(img, 0, 0, sw, sh, pdx, finalY, pdw, pdh);
            }
          } else {
            // Shadow / Glow Reactivity
            if (isBeat || normalizedIntensity > 0.6) {
              ctx.shadowColor = settings.primaryColor;
              ctx.shadowBlur = 50 * finalIntensity;
            }
            ctx.drawImage(img, 0, 0, sw, sh, pdx, finalY, pdw, pdh);
          }
          ctx.restore();
        }

        // RGB Split (Optimized Performance: Avoid frequent filter changes)
        if (settings.rgbSplit > 0) {
          const splitOffset = settings.rgbSplit * 15 * finalIntensity;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          
          // Note: using drawImage with different globalAlpha is faster than complex filters
          ctx.globalAlpha = 0.4;
          ctx.drawImage(canvas, -splitOffset, 0);
          ctx.drawImage(canvas, splitOffset, 0);
          
          ctx.globalCompositeOperation = 'source-over';
          ctx.restore();
        }

        // Pixel Sorting (Simulated)
        if (settings.pixelSorting > 0 && (normalizedIntensity > 0.4 || isBeat)) {
          const sortIntensity = settings.pixelSorting * finalIntensity;
          const sortCount = Math.floor(5 * sortIntensity);
          for (let i = 0; i < sortCount; i++) {
            const x = Math.floor(Math.random() * (width - 10));
            const y = Math.floor(Math.random() * (height - 100));
            const w = Math.floor(Math.random() * 5 + 1);
            const h = Math.max(1, Math.floor(Math.random() * 200 * sortIntensity));
            
            // Safety Check
            if (x >= 0 && y >= 0 && x + w <= width && y + h <= height) {
              try {
                const data = ctx.getImageData(x, y, w, h);
                ctx.putImageData(data, x, y + Math.floor(Math.random() * 20));
              } catch (e) {
                // Silently skip if bounds are somehow still wrong
              }
            }
          }
        }

        // Advanced Effects
        if (settings.chromaticAberration > 0) {
          const offset = settings.chromaticAberration * 20 * finalIntensity;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = 0.5;
          ctx.drawImage(canvas, -offset, 0);
          ctx.drawImage(canvas, offset, 0);
          ctx.restore();
        }

        if (settings.bloom > 0 && finalIntensity > 0.3) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.3 * settings.bloom * finalIntensity;
          ctx.filter = `blur(${Math.min(20, 10 * settings.bloom)}px)`;
          ctx.drawImage(canvas, 0, 0);
          ctx.restore();
        }

        // Scan Lines
        if (settings.scanLines > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.lineWidth = 1;
          ctx.strokeStyle = `rgba(0,0,0,${0.3 * settings.scanLines})`;
          for (let i = 0; i < height; i += 4) {
            ctx.moveTo(0, i);
            ctx.lineTo(width, i);
          }
          ctx.stroke();
          ctx.restore();
        }

        // Draw Visualizer Mode
        if (settings.mode === 'SPECTRUM') {
          const barWidth = (width / data.length) * 2.5;
          let x = 0;
          for (let i = 0; i < data.length; i++) {
            const barHeight = (data[i] / 255) * height * 0.5;
            ctx.fillStyle = ctx.createLinearGradient(0, height - barHeight, 0, height);
            (ctx.fillStyle as CanvasGradient).addColorStop(0, settings.primaryColor);
            (ctx.fillStyle as CanvasGradient).addColorStop(1, settings.secondaryColor);
            ctx.globalAlpha = 0.8;
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
          }
          ctx.globalAlpha = 1;
        } else if (settings.mode === 'RADIAL') {
          const centerX = width / 2;
          const centerY = height / 2;
          const radius = Math.min(width, height) * 0.25;
          ctx.beginPath();
          ctx.lineWidth = 4;
          for (let i = 0; i < data.length; i++) {
            const angle = (i / data.length) * Math.PI * 2;
            const barHeight = (data[i] / 255) * radius * 1.5 * settings.intensity;
            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius + barHeight);
            const y2 = centerY + Math.sin(angle) * (radius + barHeight);
            ctx.strokeStyle = i % 2 === 0 ? settings.primaryColor : settings.secondaryColor;
            ctx.globalAlpha = 0.7;
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (settings.mode === 'NEBULA') {
          const centerX = width / 2;
          const centerY = height / 2;
          ctx.save();
          // Subtle background glow
          const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, width * 0.8);
          grad.addColorStop(0, `${settings.primaryColor}22`);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);

          // Abstract shapes
          for (let i = 0; i < 8; i++) {
            const val = data[i * 10 % data.length] / 255;
            const r = (width * 0.2) + val * width * 0.3 * settings.intensity;
            ctx.beginPath();
            ctx.strokeStyle = i % 2 === 0 ? settings.primaryColor : settings.secondaryColor;
            ctx.globalAlpha = 0.2;
            ctx.lineWidth = 2 + val * 10;
            ctx.arc(centerX + Math.cos(Date.now()/2000 + i) * 50, centerY + Math.sin(Date.now()/2500 + i) * 50, r, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        } else if (settings.mode === 'TUNNEL') {
          const centerX = width / 2;
          const centerY = height / 2;
          const layers = 12;
          ctx.lineWidth = 2;
          for (let i = 0; i < layers; i++) {
            const offset = (i / layers) * 1000;
            const timeOffset = (Date.now() / 15);
            const radius = ((timeOffset + offset) % 1000) * (width / 1000) * settings.coverScale;
            const opacity = Math.max(0, 1 - (radius / (width * 0.8)));
            const layerFreq = data[i * 4 % data.length];
            const pulse = (layerFreq / 255) * 40 * settings.intensity;
            
            ctx.strokeStyle = i % 2 === 0 ? settings.primaryColor : settings.secondaryColor;
            ctx.globalAlpha = opacity * 0.6;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius + pulse, 0, Math.PI * 2);
            ctx.stroke();

            if (isBeat && i % 3 === 0) {
               ctx.beginPath();
               ctx.lineWidth = 1;
               ctx.moveTo(centerX, centerY);
               const angle = (i / layers) * Math.PI * 2 + (Date.now() / 1000);
               ctx.lineTo(centerX + Math.cos(angle) * width, centerY + Math.sin(angle) * width);
               ctx.stroke();
            }
          }
          ctx.globalAlpha = 1;
        } else if (settings.mode === 'PARTICLES') {
          const centerX = width / 2;
          const centerY = height / 2;
          particlesRef.current.forEach((p, idx) => {
            const freqVal = data[idx % data.length] / 255;
            const speedMult = 1 + freqVal * 5 * settings.intensity;
            
            p.x += p.vx * speedMult;
            p.y += p.vy * speedMult;

            if (p.x < 0 || p.x > width) p.vx *= -1;
            if (p.y < 0 || p.y > height) p.vy *= -1;

            ctx.fillStyle = idx % 2 === 0 ? settings.primaryColor : settings.secondaryColor;
            ctx.globalAlpha = 0.4 + freqVal * 0.6;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (1 + freqVal * 2), 0, Math.PI * 2);
            ctx.fill();

            if (isBeat && idx % 12 === 0) {
              ctx.strokeStyle = ctx.fillStyle;
              ctx.lineWidth = 0.5;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(centerX, centerY);
              ctx.stroke();
            }
          });
          ctx.globalAlpha = 1;
        } else if (settings.mode === 'WAVEFORM') {
          ctx.beginPath();
          ctx.lineWidth = 4;
          ctx.strokeStyle = settings.primaryColor;
          ctx.globalAlpha = 0.8;
          const sliceWidth = width / timeData.length;
          let x = 0;
          for (let i = 0; i < timeData.length; i++) {
            const v = timeData[i] / 128.0;
            const y = v * height / 2;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Vignette
        if (settings.vignette > 0) {
          const grad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.sqrt(width**2 + height**2)/2);
          grad.addColorStop(0, 'transparent');
          grad.addColorStop(1, `rgba(0,0,0,${0.9 * settings.vignette})`);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);
        }

        // Overlays
        if (settings.showTitle && settings.customTitle) {
          ctx.save();
          const fontSize = Math.floor(width * 0.08);
          ctx.font = `900 ${fontSize}px "${settings.titleFont}"`;
          ctx.fillStyle = 'white';
          ctx.textAlign = 'center';
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 20;
          let ty = height * 0.15; // Move title to top
          if (isPlaying && normalizedIntensity > 0.8 && Math.random() > 0.9) {
             ctx.fillText(settings.customTitle.toUpperCase(), width/2 + (Math.random()-0.5)*20, ty);
          } else {
             ctx.fillText(settings.customTitle.toUpperCase(), width/2, ty);
          }
          ctx.restore();
        }

        if (settings.showArtist && settings.customArtist) {
          ctx.save();
          const fontSize = Math.floor(width * 0.03);
          ctx.font = `500 ${fontSize}px "${settings.artistFont}"`;
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.textAlign = 'center';
          ctx.fillText(settings.customArtist.toUpperCase(), width/2, height * 0.20); // Move artist below title
          ctx.restore();
        }

        // Lyrics
        if (settings.showLyrics && settings.syncedLyrics.length > 0) {
          const currentTime = audioRef.current?.currentTime || 0;
          const currentLine = settings.syncedLyrics.find(l => currentTime >= l.startTime && currentTime <= l.endTime) ||
                             [...settings.syncedLyrics].reverse().find(l => currentTime > l.endTime) ||
                             settings.syncedLyrics[0];

          if (currentLine) {
            ctx.save();
            const ly = height * 0.80; // Move lyrics slightly lower, away from visualizer center
            const words = currentLine.words;
            const fontSize = Math.floor(width * 0.045);
            ctx.font = `600 ${fontSize}px "${settings.lyricsFont}"`;
            ctx.textAlign = 'center';
            let totalWidth = 0;
            const gap = fontSize * 0.35;
            const wordWidths = words.map(w => {
              const m = ctx.measureText(w.word);
              totalWidth += m.width + gap;
              return m.width;
            });
            totalWidth -= gap;
            let startX = (width - totalWidth) / 2;

            words.forEach((w, i) => {
              const isPast = currentTime > w.endTime;
              const isCurrent = currentTime >= w.startTime && currentTime <= w.endTime;
              const opacity = isCurrent ? 1 : (isPast ? settings.lyricsPastOpacity : settings.lyricsFutureOpacity);
              const blur = isCurrent ? 0 : settings.lyricsBlur * 10;
              
              let offsetY = 0;
              let scale = 1;
              let skewX = 0;

              // Kinetic Effects
              if (isCurrent) {
                if (settings.typographyStyle === 'BOUNCE') {
                  const prog = (currentTime - w.startTime) / (w.endTime - w.startTime);
                  offsetY = -Math.sin(prog * Math.PI) * fontSize * 0.5 * (1 + finalIntensity);
                } else if (settings.typographyStyle === 'GLITCH') {
                  if (Math.random() > 0.8) {
                    startX += (Math.random() - 0.5) * 10;
                    skewX = (Math.random() - 0.5) * 0.5;
                  }
                } else if (settings.typographyStyle === 'STAGGER') {
                  offsetY = (i % 2 === 0 ? -1 : 1) * fontSize * 0.1;
                }
              }

              ctx.save();
              ctx.translate(startX + wordWidths[i]/2, ly + offsetY);
              ctx.scale(scale, scale);
              if (skewX !== 0) ctx.transform(1, 0, skewX, 1, 0, 0);
              if (blur > 0) ctx.filter = `blur(${blur}px)`;

              if (isCurrent) {
                const prog = Math.min(1, Math.max(0, (currentTime - w.startTime) / (w.endTime - w.startTime)));
                
                // Shadow/Glow for current word
                ctx.shadowColor = settings.primaryColor;
                ctx.shadowBlur = 10 * finalIntensity;
                
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.fillText(w.word, 0, 0);
                
                ctx.save();
                ctx.beginPath();
                ctx.rect(-wordWidths[i]/2, -fontSize, wordWidths[i] * prog, fontSize * 2);
                ctx.clip();
                ctx.fillStyle = settings.primaryColor;
                ctx.fillText(w.word, 0, 0);
                ctx.restore();
              } else {
                ctx.fillStyle = `rgba(255,255,255,${opacity})`;
                ctx.fillText(w.word, 0, 0);
              }
              ctx.restore();
              
              startX += wordWidths[i] + gap;
            });
            ctx.restore();
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [coverUrl, settings, isPlaying, isAudioReady]);

  return (
    <div className={cn(
      "relative w-full mx-auto overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-all duration-500",
      resolution.ratio,
      settings.aspectRatio === '9:16' ? 'max-w-[320px]' : settings.aspectRatio === '16:9' ? 'max-w-[800px]' : 'max-w-[550px]'
    )}>
      <canvas 
        ref={canvasRef} 
        width={resolution.width} 
        height={resolution.height} 
        className="h-full w-full object-contain cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />
    </div>
  );
});

VisualizerCanvas.displayName = 'VisualizerCanvas';
