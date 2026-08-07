import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  ExternalLink,
  Music,
  RotateCcw,
  FastForward,
} from "lucide-react";

export interface AudioMarker {
  time: number; // in seconds
  label: string;
}

export interface AudioPlayerProps {
  audioUrl: string;
  title?: string;
  compact?: boolean;
  markers?: AudioMarker[];
  className?: string;
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function convertGoogleDriveUrl(url: string): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (trimmed.includes("drive.google.com") || trimmed.includes("docs.google.com")) {
    let fileId = "";
    const matchFileD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (matchFileD && matchFileD[1]) {
      fileId = matchFileD[1];
    } else {
      const matchIdParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (matchIdParam && matchIdParam[1]) {
        fileId = matchIdParam[1];
      }
    }
    if (fileId) {
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
  }
  return trimmed;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  title,
  compact = false,
  markers = [],
  className = "",
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [hasError, setHasError] = useState(false);

  const formattedUrl = convertGoogleDriveUrl(audioUrl);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setHasError(false);
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => setHasError(true));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioRef.current.muted = nextMuted;
  };

  const cyclePlaybackRate = () => {
    const rates = [1, 1.25, 1.5, 2];
    const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIndex];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const seekTo = (seconds: number) => {
    setCurrentTime(seconds);
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      if (!isPlaying) {
        audioRef.current.play().catch(() => {});
      }
    }
  };

  if (!audioUrl) return null;

  return (
    <div
      className={`glass-panel p-4 rounded-2xl border border-slate-800 shadow-xl space-y-3 ${className}`}
    >
      <audio
        ref={audioRef}
        src={formattedUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={() => setHasError(true)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Title & Waveform Indicator */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={togglePlay}
            disabled={hasError}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white flex items-center justify-center shadow-md shadow-teal-600/30 transition-all cursor-pointer disabled:opacity-50 flex-shrink-0"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>

          <div className="space-y-0.5 min-w-0">
            <div className="font-extrabold text-white text-xs sm:text-sm truncate flex items-center gap-2">
              <Music className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
              <span className="truncate">{title || "Enregistrement de la session"}</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
              <span>{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
              {isPlaying && (
                <div className="flex items-end gap-0.5 h-3 ml-2">
                  <span className="w-0.5 h-3 bg-teal-400 animate-pulse" />
                  <span className="w-0.5 h-2 bg-emerald-400 animate-pulse delay-75" />
                  <span className="w-0.5 h-3.5 bg-indigo-400 animate-pulse delay-150" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Player Action Pills */}
        <div className="flex items-center gap-2 flex-shrink-0 justify-end">
          <button
            type="button"
            onClick={cyclePlaybackRate}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-1"
            title="Changer la vitesse de lecture"
          >
            <FastForward className="w-3 h-3 text-teal-400" />
            {playbackRate}x
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition-all cursor-pointer"
            title={isMuted ? "Activer le son" : "Couper le son"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-slate-300" />}
          </button>

          <a
            href={audioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition-all cursor-pointer"
            title="Ouvrir dans un nouvel onglet"
          >
            <ExternalLink className="w-4 h-4 text-slate-300" />
          </a>
        </div>
      </div>

      {/* Progress Bar Scrubber */}
      <div className="space-y-1">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
        />
      </div>

      {/* Temporal Markers (if any) */}
      {markers.length > 0 && !compact && (
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-800/60">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mr-1">Repères :</span>
          {markers.map((m, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => seekTo(m.time)}
              className="px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-slate-300 hover:text-teal-300 transition-all cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-2.5 h-2.5 text-teal-400" />
              {m.label} ({formatTime(m.time)})
            </button>
          ))}
        </div>
      )}

      {hasError && (
        <div className="text-[11px] text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
          ⚠️ Impossible de lire cet audio directement. Cliquez sur l'icône d'ouverture externe pour l'écouter.
        </div>
      )}
    </div>
  );
};
