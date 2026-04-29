import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  Play,
  Pause,
  Download,
  Zap,
  RefreshCw,
  Divide,
  Film,
  Monitor,
} from "lucide-react";
import { extractMetadata, downsampleAudio } from "./services/audioService";
import { generateSyncedLyrics } from "./services/lyricSyncService";
import {
  VisualizerCanvas,
  VisualizerHandle,
} from "./components/VisualizerCanvas";
import {
  MusicMetadata,
  VisualizerSettings,
  VisualizerMode,
  ColorPalette,
} from "./types";
import { cn } from "./lib/utils";

const createSpotifyMastering = (ctx: AudioContext) => {
  const lowEQ = ctx.createBiquadFilter();
  lowEQ.type = 'lowshelf';
  lowEQ.frequency.value = 85;
  lowEQ.gain.value = 2.5;

  const highEQ = ctx.createBiquadFilter();
  highEQ.type = 'highshelf';
  highEQ.frequency.value = 8000;
  highEQ.gain.value = 2.0;

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 30;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1.0; 
  limiter.knee.value = 0.0;
  limiter.ratio.value = 20.0;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;

  const makeupGain = ctx.createGain();
  makeupGain.gain.value = 1.8;

  lowEQ.connect(highEQ);
  highEQ.connect(makeupGain);
  makeupGain.connect(compressor);
  compressor.connect(limiter);

  return { input: lowEQ, output: limiter };
};

export default function App() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<MusicMetadata | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [renderStep, setRenderStep] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>("MP3'ü Buraya Bırak");

  const [settings, setSettings] = useState<VisualizerSettings>({
    intensity: 1.6,
    colorDistortion: 0.5,
    displacement: 0.5,
    mode: "SIMULATION",
    aspectRatio: "9:16",
    coverScale: 1.0,
    coverX: 50,
    coverY: 50,
    showTitle: true,
    showArtist: true,
    showLyrics: false,
    showSunoLyrics: false,
    autoMastering: false,
    customTitle: "",
    customArtist: "",
    customLyrics: "",
    titleFont: "Space Grotesk",
    artistFont: "JetBrains Mono",
    lyricsFont: "Inter",
    syncedLyrics: [],
    bloom: 0.8,
    chromaticAberration: 0.4,
    vignette: 0.8,
    pixelSorting: 0.5,
    scanLines: 0.6,
    rgbSplit: 0.8,
    beatSync: true,
    typographyStyle: "GLITCH",
    palette: "BRUTALIST",
    primaryColor: "#FFD700",
    secondaryColor: "#1A1A1A",
    lyricsPastOpacity: 0.5,
    lyricsFutureOpacity: 0.3,
    lyricsBlur: 4,
  });

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const masteringNodesRef = useRef<{ input: BiquadFilterNode; output: DynamicsCompressorNode } | null>(null);
  const isMasteringConnectedRef = useRef(false);
  const canvasHandleRef = useRef<VisualizerHandle | null>(null);

  const setupAudioRouting = () => {
    if (!audioContextRef.current || !sourceRef.current || !analyserRef.current) return;

    // Disconnect previously connected target of source
    sourceRef.current.disconnect();
    if (masteringNodesRef.current) {
        masteringNodesRef.current.output.disconnect();
    }

    if (settings.autoMastering) {
        if (!masteringNodesRef.current) {
            masteringNodesRef.current = createSpotifyMastering(audioContextRef.current);
        }
        sourceRef.current.connect(masteringNodesRef.current.input);
        masteringNodesRef.current.output.connect(analyserRef.current);
        isMasteringConnectedRef.current = true;
    } else {
        sourceRef.current.connect(analyserRef.current);
        isMasteringConnectedRef.current = false;
    }
  };

  useEffect(() => {
    setupAudioRouting();
  }, [settings.autoMastering]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [audioFile]);

  // Sync Audio Progress
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      if (isRecording) stopRecording();
    });

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
    };
  }, [audioFile, isRecording]);

  const handleAudioUpload = async (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | { target: { files: FileList | null } },
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setIsPlaying(false);
      setStatus("Analiz ediliyor...");
      const data = await extractMetadata(file);
      setMetadata(data);

      setSettings((prev) => ({
        ...prev,
        customTitle: data.title || "",
        customArtist: data.artist || "",
      }));

      // Auto-fetch Lyrics for Karaoke effect using Gemini Vision API via proxy
      if (file.type) {
        try {
          setStatus("Ses Sıkıştırılıyor...");
          const downsampledBlob = await downsampleAudio(file);
          
          setStatus("Sözler Çıkarılıyor...");
          const reader = new FileReader();
          const fileDataPromise = new Promise<string>((resolve) => {
            reader.onload = () =>
              resolve((reader.result as string).split(",")[1]);
            reader.readAsDataURL(downsampledBlob);
          });
          const base64 = await fileDataPromise;
          const synced = await generateSyncedLyrics(base64, "audio/wav");
          if (synced && synced.length > 0) {
            setSettings((prev) => ({
              ...prev,
              syncedLyrics: synced,
              showLyrics: true,
            }));
          }
        } catch (e) {
          console.warn("Could not sync lyrics automatically", e);
        }
      }

      setStatus(""); // Ready
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAudioUpload({ target: { files: e.dataTransfer.files } });
    }
  };

  const togglePlay = async () => {
    if (!audioRef.current) return;

    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 1024;
    }

    const ctx = audioContextRef.current;

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    if (!sourceRef.current) {
      try {
        sourceRef.current = ctx.createMediaElementSource(audioRef.current);
        setupAudioRouting();
        analyserRef.current!.connect(ctx.destination);
      } catch (e) {
        console.warn("Source node creation failed or already connected:", e);
      }
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const startRecording = () => {
    if (!canvasHandleRef.current || !audioFile || !audioRef.current) return;

    audioRef.current.currentTime = 0;

    const canvasStream = canvasHandleRef.current.getStream();
    if (!canvasStream) return;

    let combinedStream = canvasStream;
    if (audioContextRef.current && analyserRef.current) {
      const streamDestination = audioContextRef.current.createMediaStreamDestination();
      analyserRef.current.connect(streamDestination);
      combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...streamDestination.stream.getAudioTracks()
      ]);
    }

    const chunks: Blob[] = [];
    let recorder: MediaRecorder;

    const mimeType = MediaRecorder.isTypeSupported("video/mp4")
      ? "video/mp4"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm";

    try {
      recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 20000000,
      });
    } catch (e) {
      recorder = new MediaRecorder(combinedStream);
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    setRenderStep("Sesler analiz ediliyor...");

    recorder.onstart = () => {
      setRenderStep("Görseller işleniyor... (Lütfen bekleyin)");
    };

    recorder.onstop = () => {
      setRenderStep("Video paketleniyor...");
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = recorder.mimeType.includes("mp4") ? "mp4" : "webm";
      a.download = `${metadata?.title || "video"}_${settings.aspectRatio.replace(":", "-")}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsRecording(false);
      setRenderStep("");
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
    };

    const onEnded = () => {
      if (recorder.state === "recording") {
        recorder.stop();
      }
      audioRef.current?.removeEventListener("ended", onEnded);
    };
    audioRef.current.addEventListener("ended", onEnded);

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

  function formatTime(seconds: number) {
    if (isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  const VIBES = [
    {
      id: "trap",
      name: "🔥 Dark Trap",
      settings: {
        mode: "NOIR_GRID",
        palette: "BRUTALIST",
        intensity: 1.6,
        rgbSplit: 0.8,
        pixelSorting: 0.5,
        chromaticAberration: 0.4,
        primaryColor: "#FFD700",
        secondaryColor: "#1A1A1A",
      },
    },
    {
      id: "simulation",
      name: "👁️ Simulation",
      settings: {
        mode: "SIMULATION",
        palette: "MONO",
        intensity: 1.0,
        bloom: 0.8,
        scanLines: 0.6,
        primaryColor: "#ffffff",
        secondaryColor: "#222222",
      },
    },
    {
      id: "phonk",
      name: "⚡ Phonk Wave",
      settings: {
        mode: "PHONK_WAVE",
        palette: "NEON",
        intensity: 1.5,
        bloom: 0.9,
        rgbSplit: 0.6,
        pixelSorting: 0.2,
        primaryColor: "#FFD700",
        secondaryColor: "#1A1A1A",
      },
    },
    {
      id: "esoteric",
      name: "🔮 Esoteric",
      settings: {
        mode: "ESOTERIC",
        palette: "SUNSET",
        intensity: 0.8,
        bloom: 0.6,
        scanLines: 0.2,
        primaryColor: "#ff4e50",
        secondaryColor: "#f9d423",
        rgbSplit: 0.3,
      },
    },
    {
      id: "kinetic",
      name: "💥 Kinetic",
      settings: {
        mode: "KINETIC_TYPO",
        palette: "BRUTALIST",
        intensity: 1.8,
        bloom: 0.5,
        rgbSplit: 0.8,
        pixelSorting: 0.4,
        primaryColor: "#FFD700",
        secondaryColor: "#1A1A1A",
      },
    },
    {
      id: "rad",
      name: "🌌 Lofi Space",
      settings: {
        mode: "RADIAL",
        palette: "SUNSET",
        intensity: 0.6,
        bloom: 0.4,
        vignette: 0.8,
        scanLines: 0.1,
        primaryColor: "#ff4e50",
        secondaryColor: "#f9d423",
        rgbSplit: 0.1,
      },
    },
    {
      id: "monolith",
      name: "🏗️ Monolith",
      settings: {
        mode: "MONOLITH",
        palette: "BRUTALIST",
        intensity: 1.5,
        bloom: 0.2,
        rgbSplit: 0.8,
        pixelSorting: 0.5,
        primaryColor: "#FF0000",
        secondaryColor: "#333333",
      },
    },
    {
      id: "ether",
      name: "🌊 Ether",
      settings: {
        mode: "ETHER",
        palette: "SUNSET",
        intensity: 0.6,
        bloom: 0.8,
        rgbSplit: 0.2,
        pixelSorting: 0,
        primaryColor: "#00E5FF",
        secondaryColor: "#B388FF",
      },
    },
    {
      id: "chaos",
      name: "🌪️ Chaos",
      settings: {
        mode: "CHAOS",
        palette: "NEON",
        intensity: 2.0,
        bloom: 0.9,
        rgbSplit: 0.7,
        pixelSorting: 0.6,
        primaryColor: "#FF00FF",
        secondaryColor: "#00FF00",
      },
    },
  ] as const;

  const FORMATS = [
    { id: "9:16", name: "Reels / TikTok", icon: Monitor, css: "w-4 h-7" },
    { id: "16:9", name: "YouTube", icon: Film, css: "w-7 h-4" },
    { id: "1:1", name: "Instagram", icon: Divide, css: "w-5 h-5" },
  ] as const;

  return (
    <div
      className="min-h-screen bg-[#050505] text-[#E4E3E0] font-sans selection:bg-[#F27D26] selection:text-white flex flex-col relative overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Post-Process UI Scanline Effect (For Brutalist / Simulation Style) */}
      <div
        className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-30 z-[100]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)",
        }}
      ></div>

      {/* Hidden Audio Element */}
      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} crossOrigin="anonymous" />
      )}

      {/* Main Top Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#FFD700] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.4)]">
            <Zap className="text-[#050505] w-6 h-6" />
          </div>
          <div className="flex flex-col leading-tight">
            <h1 className="text-xl font-black tracking-tighter uppercase font-display text-[#FFD700]">
              MUSE.AI
            </h1>
            <span className="text-[10px] font-mono opacity-50 uppercase tracking-widest">
              ONE-CLICK RENDER
            </span>
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full mx-auto p-4 lg:p-8 relative z-10 flex flex-col items-center">
        {!audioFile ? (
          // HUGE DROPZONE (Zero Thought)
          <div className="flex-1 w-full h-full flex items-center justify-center min-h-[60vh]">
            <label className="w-full max-w-4xl aspect-[16/9] border-4 border-dashed border-[#FFD700]/30 bg-[#050505]/80 hover:bg-[#FFD700]/5 hover:border-[#FFD700] transition-all rounded-[40px] flex flex-col items-center justify-center p-12 cursor-pointer group shadow-2xl relative overflow-hidden backdrop-blur-xl">
              <div className="absolute inset-0 bg-[#FFD700]/5 opacity-0 group-hover:opacity-100 transition-opacity" />

              {status !== "MP3'ü Buraya Bırak" ? (
                <div className="text-center relative z-10 animate-pulse">
                  <h2 className="text-4xl lg:text-6xl font-black text-[#FFD700] mb-4 uppercase tracking-tighter">
                    {status}
                  </h2>
                  <p className="text-sm font-mono opacity-50 uppercase tracking-widest text-[#E4E3E0]">
                    Hazırlanıyor...
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center relative z-10">
                  <div className="w-32 h-32 bg-[#FFD700]/10 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-[#FFD700]/20 transition-all duration-500">
                    <Upload className="w-14 h-14 text-[#FFD700]" />
                  </div>
                  <h2 className="text-4xl lg:text-5xl font-black text-[#FFD700] mb-4 uppercase tracking-tighter text-center">
                    MP3'Ü BURAYA BIRAK
                  </h2>
                  <p className="text-sm lg:text-base font-bold opacity-60 uppercase tracking-widest text-center text-[#E4E3E0]">
                    TIKLA VEYA SÜRÜKLE (MAX 50MB)
                  </p>
                </div>
              )}
              <input
                type="file"
                className="hidden"
                accept="audio/*"
                onChange={handleAudioUpload}
              />
            </label>
          </div>
        ) : (
          // 3-PANEL INDUSTRIAL LAYOUT
          <div className="w-full max-w-[1600px] grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT PANEL: Asset Management */}
            <div className="lg:col-span-3 flex flex-col gap-6 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6 shadow-2xl">
              <h2 className="text-xl font-black uppercase tracking-widest text-[#E4E3E0] mb-4 border-b border-[#1a1a1a] pb-4">Assets</h2>
              
              {/* Cover Artwork Upload */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#FFD700] uppercase tracking-widest">Kapak Görseli (Artwork)</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#1a1a1a] bg-[#111] rounded-xl cursor-pointer hover:bg-[#1a1a1a] hover:border-[#FFD700] transition-colors group">
                  <Upload className="w-6 h-6 text-white/30 group-hover:text-[#FFD700] mb-2" />
                  <span className="text-white/50 text-xs font-mono uppercase">Yükle (JPG/PNG)</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const imageUrl = URL.createObjectURL(file);
                      setMetadata(prev => prev ? { ...prev, coverUrl: imageUrl } : { title: '', artist: '', coverUrl: imageUrl });
                    }
                  }} />
                </label>
              </div>

              {/* Logo Upload */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#FFD700] uppercase tracking-widest">Center Logo (Glow)</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#1a1a1a] bg-[#111] rounded-xl cursor-pointer hover:bg-[#1a1a1a] hover:border-[#FFD700] transition-colors group">
                  <Monitor className="w-6 h-6 text-white/30 group-hover:text-[#FFD700] mb-2" />
                  <span className="text-white/50 text-xs font-mono uppercase">Logo Yükle (Saydam PNG)</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const imageUrl = URL.createObjectURL(file);
                      setSettings(prev => ({ ...prev, logoUrl: imageUrl }));
                    }
                  }} />
                </label>
              </div>

              {/* Extras: Metadata Override */}
              <div className="space-y-4 pt-4 border-t border-[#1a1a1a]">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-widest text-[#FFD700]">Şarkı İsmi (Override)</label>
                    <input 
                      type="text" 
                      placeholder={metadata?.title || "İsim gir..."}
                      className="bg-black border border-white/10 p-3 text-sm text-[#E4E3E0] outline-none focus:border-[#FFD700] rounded-lg font-mono placeholder:text-white/20"
                      value={settings.customTitle}
                      onChange={(e) => setSettings(prev => ({ ...prev, customTitle: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-widest text-[#FFD700]">Sanatçı (Override)</label>
                    <input 
                      type="text" 
                      placeholder={metadata?.artist || "Sanatçı gir..."}
                      className="bg-black border border-white/10 p-3 text-sm text-[#E4E3E0] outline-none focus:border-[#FFD700] rounded-lg font-mono placeholder:text-white/20"
                      value={settings.customArtist}
                      onChange={(e) => setSettings(prev => ({ ...prev, customArtist: e.target.value }))}
                    />
                  </div>
              </div>
            </div>

            {/* CENTER PANEL: Viewport & Transport */}
            <div className="lg:col-span-6 flex flex-col items-center gap-6">
              <div className="relative w-full flex justify-center bg-[#000] rounded-[32px] border border-[#222] shadow-[0_0_80px_rgba(0,0,0,1)] overflow-hidden group">
                <VisualizerCanvas
                  ref={canvasHandleRef}
                  audioRef={audioRef}
                  analyserRef={analyserRef}
                  coverUrl={metadata?.coverUrl}
                  isPlaying={isPlaying}
                  settings={settings}
                  onUpdateSettings={() => {}}
                  metadata={metadata}
                />

                {/* Canvas Hover Play Button */}
                <button
                  onClick={togglePlay}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <div className="w-24 h-24 bg-[#FFD700] rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(255,215,0,0.4)] hover:scale-110 active:scale-95 transition-all text-[#050505]">
                    {isPlaying ? (
                      <Pause size={40} fill="currentColor" />
                    ) : (
                      <Play size={40} fill="currentColor" className="ml-2" />
                    )}
                  </div>
                </button>
              </div>

              {/* Transport Controls */}
              <div className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-6">
                <div className="flex flex-col gap-4">
                  {/* Export Progress View */}
                  {isRecording && (
                    <div className="w-full bg-[#FFD700]/10 p-4 rounded-xl border border-[#FFD700]/20 flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                         <div className="w-3 h-3 bg-[#FFD700] rounded-full animate-ping" />
                        <span className="text-sm font-black text-[#FFD700] uppercase tracking-wider">
                          {renderStep}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-[#FFD700]">
                        {Math.round(progress)}%
                      </span>
                    </div>
                  )}

                  <div
                    className="h-4 w-full bg-black rounded-full overflow-hidden cursor-pointer relative border border-white/5"
                    onClick={(e) => {
                      if (isRecording) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      audioRef.current &&
                        (audioRef.current.currentTime =
                          (x / rect.width) * audioRef.current.duration);
                    }}
                  >
                    <div
                      className={cn(
                        "h-full transition-all duration-100 relative",
                        isRecording ? "bg-[#FFD700]" : "bg-white",
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-xs font-mono font-bold text-white/50">
                    <span>
                      {audioRef.current
                        ? formatTime(audioRef.current.currentTime)
                        : "00:00"}
                    </span>
                    <div className="text-center truncate max-w-[200px] uppercase tracking-widest text-[#FFD700]">
                      {metadata?.title || "Unknown Track"}
                    </div>
                    <span>
                      {audioRef.current
                        ? formatTime(audioRef.current.duration)
                        : "00:00"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT PANEL: Inspector */}
            <div className="lg:col-span-3 flex flex-col gap-6 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6 shadow-2xl">
              <h2 className="text-xl font-black uppercase tracking-widest text-[#E4E3E0] m-0 border-b border-[#1a1a1a] pb-4">Inspector</h2>
              {/* Aspect Ratio Picker */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-white/50 uppercase tracking-widest">
                  1. Format Seç (Sosyal Medya)
                </h3>
                <div className="flex gap-2">
                  {FORMATS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          aspectRatio: f.id as any,
                        }))
                      }
                      className={cn(
                        "flex-1 py-4 rounded-xl border transition-all flex flex-col items-center gap-2 group",
                        settings.aspectRatio === f.id
                          ? "bg-[#FFD700] border-[#FFD700] text-[#050505]"
                          : "bg-[#111] border-[#222] text-white/50 hover:border-white/20 hover:text-white",
                      )}
                    >
                      <div
                        className={cn(
                          "border-2 rounded transition-all group-hover:scale-110",
                          f.css,
                          settings.aspectRatio === f.id
                            ? "border-[#050505]"
                            : "border-white/30 group-hover:border-white",
                        )}
                      />
                      <span className="text-[9px] font-black uppercase">
                        {f.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Vibe Selection */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-white/50 uppercase tracking-widest">
                  2. Vibe Belirle (Tarz)
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {VIBES.map((v) => (
                    <button
                      key={v.id}
                      onClick={() =>
                        setSettings(
                          (prev) =>
                            ({
                              ...prev,
                              ...v.settings,
                              aspectRatio: prev.aspectRatio,
                            }) as any,
                        )
                      }
                      className={cn(
                        "p-4 rounded-xl border transition-all flex flex-col items-center justify-center gap-1 text-center",
                        settings.mode === v.settings.mode &&
                          settings.palette === v.settings.palette
                          ? "bg-white border-white text-black"
                          : "bg-[#111] border-[#222] text-white/50 hover:bg-[#222]",
                      )}
                    >
                      <span className="text-xl">{v.name.split(" ")[0]}</span>
                      <span className="text-[9px] font-black uppercase tracking-widest mt-1">
                        {v.name.split(" ").slice(1).join(" ")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-white/50 uppercase tracking-widest">
                  3. Mastering & Logic
                </h3>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={cn("w-5 h-5 rounded border flex items-center justify-center transition-colors", settings.showSunoLyrics ? "bg-[#FFD700] border-[#FFD700]" : "bg-[#111] border-[#333] group-hover:border-[#FFD700]")}>
                      {settings.showSunoLyrics && <div className="w-2.5 h-2.5 bg-black rounded-sm" />}
                    </div>
                    <input 
                      type="checkbox" 
                      className="hidden"
                      checked={settings.showSunoLyrics}
                      onChange={(e) => setSettings(prev => ({ ...prev, showSunoLyrics: e.target.checked }))}
                    />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#E4E3E0] group-hover:text-white transition-colors">Suno Sözlerini Kullan</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={cn("w-5 h-5 rounded border flex items-center justify-center transition-colors", settings.autoMastering ? "bg-[#00ff00] border-[#00ff00]" : "bg-[#111] border-[#333] group-hover:border-[#00ff00]")}>
                      {settings.autoMastering && <div className="w-2.5 h-2.5 bg-black rounded-sm" />}
                    </div>
                    <input 
                      type="checkbox" 
                      className="hidden"
                      checked={settings.autoMastering}
                      onChange={(e) => setSettings(prev => ({ ...prev, autoMastering: e.target.checked }))}
                    />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#E4E3E0] group-hover:text-white transition-colors">⚡ Auto-Mastering (Spotify)</span>
                  </label>
                </div>
              </div>

              {/* Render Button */}
              <div className="space-y-4 mt-auto pt-4 border-t border-[#1a1a1a]">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={cn(
                    "w-full py-5 rounded-xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all",
                    isRecording
                      ? "bg-red-500 text-white animate-pulse"
                      : "bg-[#FFD700] text-[#050505] hover:bg-white shadow-[0_0_40px_rgba(255,215,0,0.4)] hover:shadow-[0_0_50px_rgba(255,255,255,0.6)] hover:scale-[1.02]",
                  )}
                >
                  {isRecording ? (
                    <>İPTAL ET VEYA ZORLA BİTİR</>
                  ) : (
                    <>
                      <Download size={20} /> VİDEOYU İNDİR
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
