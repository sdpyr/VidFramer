/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Upload, Music, Play, Pause, RefreshCw, Layers, Layout, Download, Sliders, Save, FolderOpen, ArrowUp, ArrowDown, Zap, PlusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { extractMetadata } from './services/audioService';
import { fetchLyrics } from './services/lyricsService';
import { VisualizerCanvas, VisualizerHandle } from './components/VisualizerCanvas';
import { MusicMetadata, VisualizerSettings, VisualizerMode, VisualizerPreset, ColorPalette } from './types';
import { cn } from './lib/utils';
import { generateSyncedLyrics } from './services/lyricSyncService';

export default function App() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<MusicMetadata | null>(null);
  const [lyrics, setLyrics] = useState<string>('');
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [customCover, setCustomCover] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [presets, setPresets] = useState<VisualizerPreset[]>([]);
  
  const [settings, setSettings] = useState<VisualizerSettings>({
    intensity: 1.0,
    colorDistortion: 0.5,
    displacement: 0.5,
    mode: 'GLITCH',
    aspectRatio: '1:1',
    coverScale: 1.0,
    coverX: 50,
    coverY: 50,
    showTitle: true,
    showArtist: true,
    showLyrics: false,
    customTitle: '',
    customArtist: '',
    customLyrics: '',
    titleFont: 'Space Grotesk',
    artistFont: 'Space Grotesk',
    lyricsFont: 'Space Grotesk',
    syncedLyrics: [],
    bloom: 0.2,
    chromaticAberration: 0.1,
    vignette: 0.5,
    pixelSorting: 0,
    scanLines: 0.2,
    rgbSplit: 0.3,
    beatSync: true,
    typographyStyle: 'CLASSIC',
    palette: 'DEFAULT',
    primaryColor: '#F27D26',
    secondaryColor: '#FF0055',
    lyricsPastOpacity: 0.2,
    lyricsFutureOpacity: 0.1,
    lyricsBlur: 0
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isEditingLyrics, setIsEditingLyrics] = useState(false);

  const palettes: { id: ColorPalette, name: string, primary: string, secondary: string }[] = [
    { id: 'DEFAULT', name: 'Original', primary: '#F27D26', secondary: '#ffffff' },
    { id: 'NEON', name: 'Neon City', primary: '#00ffcc', secondary: '#ff00ff' },
    { id: 'SUNSET', name: 'Deep Sunset', primary: '#ff4e50', secondary: '#f9d423' },
    { id: 'CYBER', name: 'Cyberpunk', primary: '#ffff00', secondary: '#0000ff' },
    { id: 'MONO', name: 'Noir', primary: '#ffffff', secondary: '#333333' },
  ];

  const randomizeVisuals = () => {
    const modes: VisualizerMode[] = ['GLITCH', 'WAVEFORM', 'SPECTRUM', 'RADIAL', 'PARTICLES', 'TUNNEL'];
    const typos: any[] = ['CLASSIC', 'BOUNCE', 'GLITCH', 'STAGGER'];
    
    setSettings(prev => ({
      ...prev,
      mode: modes[Math.floor(Math.random() * modes.length)],
      typographyStyle: typos[Math.floor(Math.random() * typos.length)],
      intensity: 0.5 + Math.random(),
      bloom: Math.random() * 0.5,
      chromaticAberration: Math.random() * 0.3,
      rgbSplit: Math.random() * 0.5,
      pixelSorting: Math.random() > 0.5 ? Math.random() : 0
    }));
  };

  useEffect(() => {
    const saved = localStorage.getItem('glitchframe_presets');
    if (saved) setPresets(JSON.parse(saved));
  }, []);

  const savePreset = () => {
    const name = prompt("Preset Name:");
    if (!name) return;
    const newPreset: VisualizerPreset = {
      id: Date.now().toString(),
      name,
      settings: { ...settings, syncedLyrics: [] } // Don't save lyrics in presets
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    localStorage.setItem('glitchframe_presets', JSON.stringify(updated));
  };

  const loadPreset = (preset: VisualizerPreset) => {
    setSettings(prev => ({ 
      ...preset.settings, 
      syncedLyrics: prev.syncedLyrics,
      customLyrics: prev.customLyrics 
    }));
  };

  const deletePreset = (id: string) => {
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    localStorage.setItem('glitchframe_presets', JSON.stringify(updated));
  };
  
  const handleAutoSync = async () => {
    if (!audioFile) return;
    setIsSyncing(true);
    try {
      const reader = new FileReader();
      const fileDataPromise = new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(audioFile);
      });
      const base64 = await fileDataPromise;
      const synced = await generateSyncedLyrics(base64, audioFile.type);
      if (synced && synced.length > 0) {
        setSettings(prev => ({ 
          ...prev, 
          syncedLyrics: synced,
          showLyrics: true 
        }));
      }
    } catch (e) {
      console.error("Auto-sync error:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const fonts = [
    'Space Grotesk',
    'Inter',
    'JetBrains Mono',
    'Bebas Neue',
    'Montserrat',
    'Playfair Display',
    'Outfit',
    'Syncopate',
    'Kanit'
  ];
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasHandleRef = useRef<VisualizerHandle | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [audioFile]);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setIsPlaying(false);
      const data = await extractMetadata(file);
      setMetadata(data);
      if (data.coverUrl) setCoverUrl(data.coverUrl);
      
      setIsLoadingLyrics(true);
      const lyricsText = await fetchLyrics(data.title || file.name, data.artist || '');
      setLyrics(lyricsText);
      setIsLoadingLyrics(false);

      const modes: VisualizerMode[] = ['GLITCH', 'WAVEFORM', 'SPECTRUM', 'RADIAL', 'PARTICLES', 'TUNNEL'];
      const randomMode = modes[Math.floor(Math.random() * modes.length)];

      setSettings(prev => ({ 
        ...prev, 
        mode: randomMode,
        customTitle: data.title || '', 
        customArtist: data.artist || '',
        customLyrics: lyricsText
      }));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCustomCover(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const startRecording = () => {
    if (!canvasHandleRef.current || !audioFile || !audioRef.current) return;
    
    // Reset to beginning for full export
    audioRef.current.currentTime = 0;
    
    const combinedStream = canvasHandleRef.current.getStream();
    if (!combinedStream) return;
    
    const chunks: Blob[] = [];
    let recorder: MediaRecorder;
    
    const mimeType = MediaRecorder.isTypeSupported('video/mp4') 
      ? 'video/mp4' 
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
        ? 'video/webm;codecs=vp9' 
        : 'video/webm';

    try {
      recorder = new MediaRecorder(combinedStream, { 
        mimeType,
        videoBitsPerSecond: 20000000 // 20Mbps for high quality render
      });
    } catch (e) {
      recorder = new MediaRecorder(combinedStream);
    }
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
      a.download = `${metadata?.title || 'glitchframe'}_${settings.aspectRatio.replace(':', '-')}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setIsRecording(false);
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
    };

    // Auto-stop when audio reaches end
    const onEnded = () => {
      if (recorder.state === 'recording') {
        recorder.stop();
      }
      audioRef.current?.removeEventListener('ended', onEnded);
    };
    audioRef.current.addEventListener('ended', onEnded);

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    
    audioRef.current.play();
    setIsPlaying(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      if (isRecording) stopRecording();
    });
    
    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
    };
  }, [audioFile, isRecording]);

  const [activeTab, setActiveTab] = useState<'visuals' | 'text' | 'lyrics'>('visuals');

  return (
    <div className="min-h-screen bg-[#020202] text-[#F0F0F0] font-sans selection:bg-[#F27D26] selection:text-white flex flex-col">
      {/* Top Studio Bar */}
      <nav className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-50 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#F27D26] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(242,125,38,0.3)]">
            <Layers className="text-black w-5 h-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <h1 className="text-sm font-black tracking-tight uppercase">Glitchframe</h1>
            <span className="text-[8px] font-mono opacity-40 uppercase tracking-widest">Studio_v2.1</span>
          </div>
        </div>

                    <div className="flex gap-4">
                      {[
                        { id: 'visuals', label: 'Nodes', icon: Sliders, sub: 'Visual Engine' },
                        { id: 'text', label: 'Design', icon: Layout, sub: 'Layout & Type' },
                        { id: 'lyrics', label: 'Story', icon: Music, sub: 'Lyrics Sync' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={cn(
                            "flex-1 px-4 py-3 rounded-2xl text-[10px] font-black uppercase transition-all flex flex-col items-center gap-1",
                            activeTab === tab.id 
                              ? "bg-[#F27D26] text-black shadow-[0_10px_20px_-5px_rgba(242,125,38,0.4)]" 
                              : "bg-white/[0.03] text-white/30 hover:text-white hover:bg-white/5 border border-white/5"
                          )}
                        >
                          <tab.icon size={14} />
                          <span>{tab.label}</span>
                        </button>
                      ))}
                    </div>

        <div className="flex items-center gap-3">
          {audioFile && (
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all",
                isRecording 
                  ? "bg-red-500 text-white animate-pulse" 
                  : "bg-white text-black hover:bg-[#F27D26] hover:text-white"
              )}
            >
              {isRecording ? "STOP RECORDING" : <><Download size={12} /> EXPORT 1080P</>}
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1 flex flex-col lg:flex-row lg:h-[calc(100vh-82px)] bg-[#050505] overflow-hidden">
        {/* Left: Interactive Preview (Sticky on mobile, Fixed-ish on desktop) */}
        <div className="lg:flex-1 bg-black p-4 lg:p-12 flex flex-col items-center justify-center relative overflow-hidden h-[50vh] lg:h-full sticky top-0 z-20 border-b lg:border-b-0 border-white/5">
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />
          
          <div className="relative z-10 w-full max-w-2xl h-full lg:h-auto aspect-square flex items-center justify-center overflow-hidden">
            <VisualizerCanvas 
              ref={canvasHandleRef}
              audioRef={audioRef} 
              coverUrl={customCover || coverUrl || undefined}
              isPlaying={isPlaying}
              settings={settings}
              onUpdateSettings={(updates) => setSettings(prev => ({ ...prev, ...updates }))}
              metadata={metadata}
            />
            
            {!audioFile && (
              <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-3xl border-2 border-dashed border-white/10 hover:border-[#F27D26]/50 cursor-pointer transition-all group">
                <Upload className="w-16 h-16 mb-4 opacity-20 group-hover:opacity-100 group-hover:text-[#F27D26] transition-all" />
                <p className="text-sm font-bold opacity-40 uppercase tracking-widest text-center px-12 group-hover:opacity-100">Click to import track</p>
                <input type="file" className="hidden" accept="audio/*" onChange={handleAudioUpload} />
              </label>
            )}
          </div>

          {/* Floating Player - Compact for sticky layout */}
          <div className="mt-4 lg:mt-12 w-full max-w-xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 lg:p-6 flex flex-col gap-3 lg:gap-4 shadow-2xl relative z-20">
            <div className="flex items-center justify-between gap-4 lg:gap-6">
              <div className="flex-1 min-w-0">
                <h2 className="text-sm lg:text-xl font-bold truncate tracking-tight">{metadata?.title || "No Track Selected"}</h2>
                <p className="text-[9px] lg:text-xs text-[#F27D26] font-bold uppercase tracking-wider opacity-80">{metadata?.artist || "AWAITINGPayload"}</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={togglePlay} disabled={!audioFile} className={cn(
                  "w-10 h-10 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl flex items-center justify-center transition-all",
                  audioFile ? "bg-white text-black hover:bg-[#F27D26] hover:scale-105 active:scale-95" : "bg-white/5 opacity-20 cursor-not-allowed"
                )}>
                  {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div 
                className="h-1 lg:h-1.5 w-full bg-white/10 rounded-full overflow-hidden cursor-pointer group"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  audioRef.current && (audioRef.current.currentTime = (x / rect.width) * audioRef.current.duration);
                }}
              >
                <div className="h-full bg-white transition-all duration-100 relative" style={{ width: `${progress}%` }}>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow-[0_0_10px_white]" />
                </div>
              </div>
              <div className="flex justify-between text-[8px] lg:text-[10px] font-bold font-mono opacity-30">
                <span>{audioRef.current ? formatTime(audioRef.current.currentTime) : '00:00'}</span>
                <span>{audioRef.current ? formatTime(audioRef.current.duration) : '00:00'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Studio Controls Pane (Always scrollable) */}
        <div className="w-full lg:w-[450px] bg-[#0A0A0A] border-l border-white/5 flex flex-col overflow-y-auto custom-scrollbar h-auto lg:h-full">
          <div className="p-8 pb-32">
            <AnimatePresence mode="wait">
              {activeTab === 'visuals' && (
                <motion.div
                  key="visuals"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-10"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-[#F27D26] uppercase tracking-[0.2em]">Visual Mood</label>
                      <button 
                        onClick={randomizeVisuals}
                        className="flex items-center gap-1.5 px-3 py-1 bg-[#F27D26]/10 border border-[#F27D26]/20 rounded-lg text-[9px] font-black text-[#F27D26] uppercase transition-all hover:bg-[#F27D26] hover:text-white group"
                      >
                        <RefreshCw size={10} className="group-hover:rotate-180 transition-transform duration-500" /> SURPRISE ME
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'GLITCH', name: 'Glitch Core', icon: Zap },
                        { id: 'NEBULA', name: 'Celestial', icon: PlusCircle },
                        { id: 'TUNNEL', name: 'Hyper Void', icon: Layers },
                        { id: 'PARTICLES', name: 'Molecular', icon: Layout },
                        { id: 'RADIAL', name: 'Circular', icon: RefreshCw },
                        { id: 'SPECTRUM', name: 'Vibrations', icon: Music },
                      ].map(m => (
                        <button 
                          key={m.id}
                          onClick={() => setSettings(prev => ({ ...prev, mode: m.id as VisualizerMode }))}
                          className={cn(
                            "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all relative overflow-hidden group",
                            settings.mode === m.id 
                              ? "bg-white text-black border-white shadow-[0_10px_40px_-10px_rgba(255,255,255,0.3)]" 
                              : "bg-white/[0.02] border-white/5 text-white/40 hover:border-white/20 hover:text-white"
                          )}
                        >
                          <m.icon size={18} className={cn("transition-all duration-500 group-hover:scale-110", settings.mode === m.id ? "text-black" : "text-[#F27D26]")} />
                          <span className="text-[9px] font-black uppercase tracking-widest">{m.name}</span>
                          {settings.mode === m.id && (
                            <motion.div layoutId="mode-active" className="absolute bottom-0 left-0 right-0 h-1 bg-[#F27D26]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-[#F27D26] uppercase tracking-[0.2em]">Color Core</label>
                    <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                       {palettes.map(p => (
                         <button 
                            key={p.id}
                            onClick={() => setSettings(prev => ({ ...prev, palette: p.id, primaryColor: p.primary, secondaryColor: p.secondary }))}
                            className={cn(
                              "w-12 h-12 flex-shrink-0 rounded-2xl border-2 transition-all relative overflow-hidden",
                              settings.palette === p.id ? "border-white scale-110 rotate-12 z-10" : "border-white/5 opacity-40 hover:opacity-100"
                            )}
                         >
                           <div className="absolute inset-0 bg-gradient-to-br" style={{ backgroundImage: `linear-gradient(135deg, ${p.primary}, ${p.secondary})` }} />
                         </button>
                       ))}
                       <button 
                         className="w-12 h-12 flex-shrink-0 rounded-2xl border-2 border-white/10 flex items-center justify-center bg-white/5 hover:bg-white/10"
                         onClick={() => setSettings(prev => ({ ...prev, palette: 'CUSTOM' }))}
                       >
                         <Sliders size={14} className="text-white/40" />
                       </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-[#F27D26] uppercase tracking-[0.2em]">Aspect Ratio</label>
                    <div className="flex gap-2">
                      {(['1:1', '9:16', '16:9'] as const).map(ratio => (
                        <button 
                          key={ratio}
                          onClick={() => setSettings(prev => ({ ...prev, aspectRatio: ratio }))}
                          className={cn(
                            "flex-1 py-3 rounded-xl text-[10px] font-black transition-all uppercase",
                            settings.aspectRatio === ratio ? "bg-[#F27D26] text-black shadow-lg" : "bg-white/5 text-white/40 border border-white/5"
                          )}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    <button 
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className={cn(
                        "w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
                        showAdvanced ? "bg-white text-black" : "bg-white/5 text-white/40 hover:bg-white/10"
                      )}
                    >
                      <Zap size={12} className={showAdvanced ? "text-[#F27D26]" : ""} />
                      {showAdvanced ? 'Hide Lab Controls' : 'Show Lab Controls'}
                    </button>
                  </div>

                  {showAdvanced && (
                    <motion.div 
                      key="advanced-controls"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-8"
                    >
                      <div className="grid grid-cols-1 gap-6 bg-white/[0.02] p-6 rounded-3xl border border-white/5">
                        <label className="text-[10px] font-black text-[#F27D26] uppercase tracking-[0.2em] mb-2 block">Engine Tuning</label>
                        {[
                          { label: 'Energy', key: 'intensity', min: 0, max: 2, step: 0.01 },
                          { label: 'Color Glitch', key: 'colorDistortion', min: 0, max: 2, step: 0.01 },
                          { label: 'Distortion', key: 'displacement', min: 0, max: 2, step: 0.01 },
                          { label: 'Bloom', key: 'bloom', min: 0, max: 1, step: 0.01 },
                          { label: 'RGB Split', key: 'rgbSplit', min: 0, max: 1, step: 0.01 },
                          { label: 'Beat Sync Strength', key: 'intensity', min: 0, max: 2, step: 0.01 },
                        ].map(param => (
                          <div key={param.label} className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold opacity-30 uppercase tracking-tighter">{param.label}</span>
                              <span className="text-[10px] font-mono text-[#F27D26]">{(settings[param.key as keyof VisualizerSettings] as number).toFixed(2)}</span>
                            </div>
                            <input 
                              type="range" min={param.min} max={param.max} step={param.step}
                              value={settings[param.key as keyof VisualizerSettings] as number}
                              onChange={(e) => setSettings(prev => ({ ...prev, [param.key]: parseFloat(e.target.value) }))}
                              className="w-full accent-[#F27D26] h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                            />
                          </div>
                        ))}
                      </div>

      <div className="space-y-4">
        <label className="text-[10px] font-bold text-[#F27D26] uppercase tracking-[0.2em]">Quick Presets</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'neon', name: 'Neon Glitch', settings: { intensity: 1.5, rgbSplit: 0.8, bloom: 0.6, mode: 'GLITCH' as VisualizerMode } },
            { id: 'zen', name: 'Zen Radial', settings: { intensity: 0.5, bloom: 0.2, mode: 'RADIAL' as VisualizerMode, rgbSplit: 0 } },
            { id: 'vhs', name: 'VHS Tape', settings: { scanLines: 0.8, mode: 'GLITCH' as VisualizerMode, rgbSplit: 0.2 } },
            { id: 'cyber', name: 'Cyber Tunnel', settings: { mode: 'TUNNEL' as VisualizerMode, intensity: 1.2, bloom: 0.8, rgbSplit: 0.5 } }
          ].map(t => (
            <button 
              key={t.id}
              onClick={() => setSettings(prev => ({ ...prev, ...t.settings }))}
              className="px-4 py-3 bg-white/5 border border-white/5 rounded-2xl text-[9px] font-bold uppercase hover:bg-[#F27D26] hover:text-black transition-all"
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold text-[#F27D26] uppercase tracking-[0.2em]">Saved</label>
          <button onClick={savePreset} className="text-[10px] font-black text-[#F27D26] uppercase border-b border-[#F27D26]">+ New</button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {presets.map(p => (
            <button 
              key={p.id}
              onClick={() => loadPreset(p)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-bold uppercase hover:border-[#F27D26]/50"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
                    </motion.div>
                  )}

                  <div className="space-y-4 pt-6 border-t border-white/5">
                    <label className="text-[10px] font-bold text-[#F27D26] uppercase tracking-[0.2em]">Media Asset Override</label>
                    <label className="flex items-center gap-3 p-6 border-2 border-dashed border-white/5 rounded-2xl cursor-pointer hover:border-[#F27D26]/30 transition-all bg-white/[0.02]">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                        <Layout size={18} className="text-[#F27D26]" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold uppercase">Replace Artwork</span>
                        <span className="text-[10px] opacity-30 uppercase">JPG/PNG SOURCE</span>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                  </div>
                </motion.div>
              )}

              {activeTab === 'text' && (
                <motion.div
                  key="text"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-10"
                >
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-[#F27D26] uppercase tracking-[0.2em]">Kinetic Typography</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['CLASSIC', 'BOUNCE', 'GLITCH', 'STAGGER'] as any[]).map(t => (
                        <button 
                          key={t}
                          onClick={() => setSettings(prev => ({ ...prev, typographyStyle: t }))}
                          className={cn(
                            "px-4 py-3 rounded-xl text-[10px] font-bold uppercase transition-all border border-white/5",
                            settings.typographyStyle === t ? "bg-white text-black shadow-lg" : "bg-white/[0.03] text-white/40 hover:text-white"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-[#F27D26] uppercase tracking-[0.2em]">Track Identity</label>
                      <input 
                        type="checkbox" checked={settings.showTitle}
                        onChange={(e) => setSettings(prev => ({ ...prev, showTitle: e.target.checked }))}
                        className="w-4 h-4 rounded-md accent-[#F27D26]"
                      />
                    </div>
                    <div className="flex flex-col gap-3">
                      <input 
                        type="text" placeholder="Title..." value={settings.customTitle}
                        onChange={(e) => setSettings(prev => ({ ...prev, customTitle: e.target.value }))}
                        className="bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#F27D26]/50"
                      />
                      <select 
                        value={settings.titleFont}
                        onChange={(e) => setSettings(prev => ({ ...prev, titleFont: e.target.value }))}
                        className="bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-xs focus:outline-none"
                      >
                        {fonts.map(f => <option key={f} value={f} className="bg-black">{f}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-6 pt-6 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-[#F27D26] uppercase tracking-[0.2em]">Artist Branding</label>
                      <input 
                        type="checkbox" checked={settings.showArtist}
                        onChange={(e) => setSettings(prev => ({ ...prev, showArtist: e.target.checked }))}
                        className="w-4 h-4 rounded-md accent-[#F27D26]"
                      />
                    </div>
                    <div className="flex flex-col gap-3">
                      <input 
                        type="text" placeholder="Artist..." value={settings.customArtist}
                        onChange={(e) => setSettings(prev => ({ ...prev, customArtist: e.target.value }))}
                        className="bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#F27D26]/50"
                      />
                      <select 
                        value={settings.artistFont}
                        onChange={(e) => setSettings(prev => ({ ...prev, artistFont: e.target.value }))}
                        className="bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-xs focus:outline-none"
                      >
                        {fonts.map(f => <option key={f} value={f} className="bg-black">{f}</option>)}
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}

                  {activeTab === 'lyrics' && (
                <motion.div
                  key="lyrics"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-8"
                >
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-[#F27D26] uppercase tracking-[0.2em]">Lyrics Engine</label>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setIsEditingLyrics(!isEditingLyrics)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all",
                          isEditingLyrics ? "bg-[#F27D26] text-black" : "bg-white/5 text-white/40 border border-white/10"
                        )}
                      >
                        {isEditingLyrics ? 'SAVE EDITS' : 'EDIT MODE'}
                      </button>
                      <input 
                        type="checkbox" checked={settings.showLyrics}
                        onChange={(e) => setSettings(prev => ({ ...prev, showLyrics: e.target.checked }))}
                        className="w-4 h-4 accent-[#F27D26]"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                     <label className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Presence Styling</label>
                     <div className="grid grid-cols-2 gap-4">
                        {[
                          { label: 'Past Opacity', key: 'lyricsPastOpacity' },
                          { label: 'Future Opacity', key: 'lyricsFutureOpacity' },
                          { label: 'Blur Depth', key: 'lyricsBlur' },
                        ].map((s) => (
                          <div key={s.key} className="space-y-2">
                            <span className="text-[8px] font-bold opacity-30 uppercase">{s.label}</span>
                            <input 
                              type="range" min="0" max="1" step="0.01"
                              value={settings[s.key as keyof VisualizerSettings] as number}
                              onChange={(e) => setSettings(prev => ({ ...prev, [s.key]: parseFloat(e.target.value) }))}
                              className="w-full h-1 accent-[#F27D26] bg-white/5 rounded-full appearance-none"
                            />
                          </div>
                        ))}
                     </div>
                  </div>

                  {!isEditingLyrics ? (
                    <textarea 
                      value={settings.customLyrics}
                      onChange={(e) => setSettings(prev => ({ ...prev, customLyrics: e.target.value }))}
                      placeholder="Paste lines here..."
                      className="w-full min-h-[200px] bg-white/[0.02] border border-white/5 rounded-2xl p-6 text-sm font-serif leading-relaxed text-white/80 focus:outline-none focus:border-[#F27D26]/30 overflow-y-auto custom-scrollbar italic resize-none"
                    />
                  ) : (
                    <div className="bg-[#F27D26]/5 rounded-2xl p-4 border border-[#F27D26]/20">
                      <p className="text-[9px] font-mono text-[#F27D26] uppercase mb-4 opacity-60">Visualizing sync metadata...</p>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {settings.syncedLyrics.map((line, lIdx) => (
                          <div key={lIdx} className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-2 group">
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" step="0.1"
                                value={line.startTime}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setSettings(prev => {
                                    const next = [...prev.syncedLyrics];
                                    next[lIdx] = { ...next[lIdx], startTime: val };
                                    return { ...prev, syncedLyrics: next };
                                  });
                                }}
                                className="w-12 bg-white/5 text-[9px] font-mono text-[#F27D26] p-1 rounded"
                              />
                              <input 
                                value={line.text}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSettings(prev => {
                                    const next = [...prev.syncedLyrics];
                                    next[lIdx] = { ...next[lIdx], text: val };
                                    return { ...prev, syncedLyrics: next };
                                  });
                                }}
                                className="flex-1 bg-transparent text-xs text-white/80 outline-none"
                              />
                            </div>
                            <div className="flex flex-wrap gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {line.words.map((word, wIdx) => (
                                <div key={wIdx} className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded text-[8px]">
                                  <span className="opacity-40">{word.word}</span>
                                  <input 
                                    type="number" step="0.05"
                                    value={word.startTime}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      setSettings(prev => {
                                        const next = [...prev.syncedLyrics];
                                        const newWords = [...next[lIdx].words];
                                        newWords[wIdx] = { ...newWords[wIdx], startTime: val };
                                        next[lIdx] = { ...next[lIdx], words: newWords };
                                        return { ...prev, syncedLyrics: next };
                                      });
                                    }}
                                    className="w-8 bg-transparent text-[#F27D26] outline-none"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-[#F27D26] uppercase tracking-[0.2em] flex items-center gap-2">
                        <Zap size={10} /> Beat-Reaction Engine
                      </label>
                      <input 
                        type="checkbox" checked={settings.beatSync}
                        onChange={(e) => setSettings(prev => ({ ...prev, beatSync: e.target.checked }))}
                        className="w-4 h-4 accent-[#F27D26]"
                      />
                    </div>
                  </div>

                  {settings.syncedLyrics.length > 0 && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-[#F27D26] uppercase tracking-[0.2em] flex justify-between">
                        Synced Timeline
                        <button 
                          onClick={() => {
                            const text = settings.syncedLyrics.map(l => `[${formatTime(l.startTime)}] ${l.text}`).join('\n');
                            const blob = new Blob([text], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `lyrics_${metadata?.title || 'synced'}.txt`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="hover:text-white"
                        >
                          Export TXT
                        </button>
                      </label>
                      <div className="space-y-1 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {settings.syncedLyrics.map((line, idx) => (
                          <div key={idx} className="flex gap-3 bg-white/5 p-2 rounded-lg group">
                            <span className="text-[9px] font-mono text-[#F27D26] whitespace-nowrap mt-1">{formatTime(line.startTime)}</span>
                            <input 
                              value={line.text}
                              onChange={(e) => {
                                const newText = e.target.value;
                                setSettings(prev => {
                                  const lyrics = [...prev.syncedLyrics];
                                  lyrics[idx] = { ...lyrics[idx], text: newText };
                                  return { ...prev, syncedLyrics: lyrics };
                                });
                              }}
                              className="bg-transparent border-none text-[11px] outline-none flex-1 leading-normal text-white"
                            />
                            <div className="flex flex-col opacity-0 group-hover:opacity-100 gap-1">
                              <button 
                                onClick={() => {
                                  if (idx === 0) return;
                                  setSettings(prev => {
                                    const next = [...prev.syncedLyrics];
                                    [next[idx-1], next[idx]] = [next[idx], next[idx-1]];
                                    return { ...prev, syncedLyrics: next };
                                  });
                                }} 
                                className="hover:text-[#F27D26] disabled:opacity-20"
                                disabled={idx === 0}
                              >
                                <ArrowUp size={10} />
                              </button>
                              <button 
                                onClick={() => {
                                  if (idx === settings.syncedLyrics.length - 1) return;
                                  setSettings(prev => {
                                    const next = [...prev.syncedLyrics];
                                    [next[idx+1], next[idx]] = [next[idx], next[idx+1]];
                                    return { ...prev, syncedLyrics: next };
                                  });
                                }} 
                                className="hover:text-[#F27D26] disabled:opacity-20"
                                disabled={idx === settings.syncedLyrics.length - 1}
                              >
                                <ArrowDown size={10} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4 relative">
                    <AnimatePresence>
                      {isSyncing && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 z-10 bg-black/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center gap-3 border border-[#F27D26]/30"
                        >
                          <RefreshCw className="w-6 h-6 animate-spin text-[#F27D26]" />
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F27D26]">AI Processing</span>
                            <span className="text-[8px] opacity-40 uppercase tracking-widest font-mono text-center px-4">Analyzing audio transients and linguistic patterns...</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="flex flex-col gap-4 w-full">
                      <button 
                        onClick={handleAutoSync}
                        disabled={isSyncing || !audioFile}
                        className={cn(
                          "w-full py-4 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-3 transition-all",
                          audioFile && !isSyncing 
                            ? "bg-[#F27D26] text-black hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_rgba(242,125,38,0.2)]" 
                            : "bg-white/5 text-white/20 cursor-not-allowed"
                        )}
                      >
                        <Zap className="w-4 h-4" />
                        One-Click Magic Sync
                      </button>
                      <p className="text-[9px] text-white/30 uppercase tracking-widest font-mono text-center">
                        AI will align text with music and link visual energy to the lyrics display.
                      </p>
                    </div>
                    <button 
                      onClick={() => setSettings(prev => ({ ...prev, customLyrics: '', syncedLyrics: [] }))}
                      className="px-6 py-4 bg-white/5 text-white/40 font-mono uppercase text-[10px] tracking-widest rounded-xl hover:bg-white/10 transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <audio ref={audioRef} src={audioUrl || undefined} className="hidden" />
    </div>
  );
}

function formatTime(seconds: number) {
  if (isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
