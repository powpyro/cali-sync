import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  ExternalLink,
  Music,
  RotateCcw,
  RotateCw,
  FastForward,
  Radio,
  Tv,
  AlertCircle,
  GripVertical,
  Minimize2,
  Maximize2,
  Volume1,
  Headphones,
} from "lucide-react";

export interface AudioMarker {
  time: number; // in seconds
  label: string;
}

export interface AudioPlayerProps {
  audioUrl: string;
  title?: string;
  compact?: boolean;
  floating?: boolean;
  defaultPosition?: { x: number; y: number };
  markers?: AudioMarker[];
  className?: string;
  onPauseTimestamp?: (timestampFormatted: string, seconds: number) => void;
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function extractGoogleDriveFileId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.includes("drive.google.com") || trimmed.includes("docs.google.com")) {
    const matchFileD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (matchFileD && matchFileD[1]) {
      return matchFileD[1];
    }
    const matchIdParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchIdParam && matchIdParam[1]) {
      return matchIdParam[1];
    }
  }
  return null;
}

export function convertGoogleDriveUrl(url: string): string {
  if (!url) return "";
  const trimmed = url.trim();
  const fileId = extractGoogleDriveFileId(trimmed);
  if (fileId) {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  return trimmed;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  title,
  compact = false,
  floating = false,
  defaultPosition,
  markers = [],
  className = "",
  onPauseTimestamp,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [hasError, setHasError] = useState(false);

  // Floating & Dragging State
  const [position, setPosition] = useState<{ x: number; y: number }>(
    defaultPosition || { x: Math.max(16, window.innerWidth - 380), y: 80 }
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);

  const driveFileId = extractGoogleDriveFileId(audioUrl);
  const formattedUrl = convertGoogleDriveUrl(audioUrl);

  // Mode: "custom" (HTML5 audio) or "drive" (Google Drive embedded preview)
  const [playerMode, setPlayerMode] = useState<"custom" | "drive">("custom");

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setHasError(false);
    setPlayerMode("custom");
  }, [audioUrl]);

  // Dragging logic
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    setDragOffset({
      x: clientX - position.x,
      y: clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = "touches" in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = "touches" in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      const maxX = Math.max(10, window.innerWidth - 120);
      const maxY = Math.max(10, window.innerHeight - 60);
      const newX = Math.max(10, Math.min(maxX, clientX - dragOffset.x));
      const newY = Math.max(10, Math.min(maxY, clientY - dragOffset.y));
      setPosition({ x: newX, y: newY });
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleEnd);
      window.addEventListener("touchmove", handleMove);
      window.addEventListener("touchend", handleEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, dragOffset]);

  const handleAudioPause = () => {
    setIsPlaying(false);
    if (audioRef.current) {
      const cur = audioRef.current.currentTime;
      const mins = Math.floor(cur / 60);
      const secs = Math.floor(cur % 60);
      const formatted = `[${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}]`;
      if (onPauseTimestamp) {
        onPauseTimestamp(formatted, cur);
      }
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {
        setHasError(true);
        if (driveFileId) {
          setPlayerMode("drive");
        }
      });
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
    if (playerMode === "drive") {
      setPlayerMode("custom");
    }
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      if (!isPlaying) {
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const [volume, setVolume] = useState<number>(1);

  const skip = (seconds: number) => {
    if (audioRef.current) {
      const targetDuration = duration || 100;
      const newTime = Math.max(0, Math.min(targetDuration, audioRef.current.currentTime + seconds));
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };

  const handleAudioError = () => {
    setHasError(true);
    if (driveFileId) {
      setPlayerMode("drive");
    }
  };

  if (!audioUrl) return null;

  // ── FLOATING DRAGGABLE WIDGET / SIDEBAR MODE ───────────────────────────────
  if (floating) {
    return (
      <div
        style={{
          position: "fixed",
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 9999,
        }}
        className={`bg-slate-950/95 border border-teal-500/40 rounded-2xl shadow-2xl backdrop-blur-xl transition-shadow ${
          isDragging ? "shadow-teal-500/30 ring-2 ring-teal-500/50 cursor-grabbing" : ""
        } ${className}`}
      >
        <audio
          ref={audioRef}
          src={formattedUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={handleAudioPause}
          onEnded={() => setIsPlaying(false)}
          onError={handleAudioError}
        />

        {/* DRAG HANDLE HEADER */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 rounded-t-2xl select-none">
          <div
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            className="flex items-center gap-1.5 cursor-grab active:cursor-grabbing text-slate-400 hover:text-white flex-1 min-w-0"
            title="Maintenir et glisser pour déplacer la barre audio"
          >
            <GripVertical className="w-4 h-4 text-teal-400 flex-shrink-0" />
            <Music className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
            <span className="text-[11px] font-black text-white truncate max-w-[200px]">
              {title || "Lecteur Audio Flottant"}
            </span>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white text-xs transition-colors cursor-pointer"
              title={isMinimized ? "Agrandir le lecteur" : "Réduire le lecteur en barre fine"}
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5 text-teal-400" /> : <Minimize2 className="w-3.5 h-3.5 text-slate-400" />}
            </button>
          </div>
        </div>

        {/* BODY: MINIMIZED OR EXPANDED */}
        {isMinimized ? (
          /* Mini Pill View */
          <div className="p-2 px-3 flex items-center gap-2 text-xs">
            {playerMode === "custom" && (
              <button
                type="button"
                onClick={togglePlay}
                disabled={hasError && !driveFileId}
                className="w-7 h-7 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 flex items-center justify-center font-bold shadow-xs cursor-pointer flex-shrink-0"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 fill-slate-950" /> : <Play className="w-3.5 h-3.5 ml-0.5 fill-slate-950" />}
              </button>
            )}
            <div className="font-mono text-[11px] font-bold text-teal-300">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
        ) : (
          /* Full Floating Player View */
          <div className="p-3 space-y-2.5 w-72 sm:w-80">
            <div className="flex items-center justify-between gap-2 text-xs">
              {playerMode === "custom" && (
                <button
                  type="button"
                  onClick={togglePlay}
                  disabled={hasError && !driveFileId}
                  className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-teal-500/20 transition-all cursor-pointer disabled:opacity-50 flex-shrink-0"
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-slate-950" /> : <Play className="w-4 h-4 ml-0.5 fill-slate-950" />}
                </button>
              )}

              {playerMode === "custom" ? (
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
                  />
                  <div className="font-mono text-[11px] text-slate-400 flex-shrink-0">
                    <span className="text-white font-bold">{formatTime(currentTime)}</span>
                    <span>/</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex-1 text-[11px] text-teal-300 font-semibold truncate flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                  <span>Mode Lecteur Google Drive Intégré</span>
                </div>
              )}
            </div>

            {/* Controls Bar */}
            <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800/80">
              {driveFileId && (
                <button
                  type="button"
                  onClick={() => setPlayerMode(playerMode === "custom" ? "drive" : "custom")}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 border ${
                    playerMode === "drive"
                      ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                      : "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800"
                  }`}
                  title="Changer de lecteur audio"
                >
                  {playerMode === "custom" ? <Tv className="w-3 h-3 text-teal-400" /> : <Radio className="w-3 h-3 text-teal-400" />}
                  <span>{playerMode === "custom" ? "Drive" : "Standard"}</span>
                </button>
              )}

              {playerMode === "custom" && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={cyclePlaybackRate}
                    className="px-2 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-bold font-mono transition-all cursor-pointer"
                    title="Vitesse de lecture"
                  >
                    {playbackRate}x
                  </button>
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs transition-all cursor-pointer"
                    title={isMuted ? "Activer le son" : "Couper le son"}
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-slate-300" />}
                  </button>
                </div>
              )}

              <a
                href={audioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs transition-all cursor-pointer"
                title="Ouvrir dans un nouvel onglet"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
              </a>
            </div>

            {/* DRIVE IFRAME INSIDE FLOATING WIDGET (cleanly contained without overlapping page text) */}
            {playerMode === "drive" && driveFileId && (
              <div className="pt-1">
                <iframe
                  src={`https://drive.google.com/file/d/${driveFileId}/preview`}
                  className="w-full h-36 rounded-xl border border-slate-800 bg-slate-950 shadow-inner"
                  allow="autoplay"
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── COMPACT HORIZONTAL BAR MODE ──────────────────────────────────────────
  if (compact) {
    return (
      <div
        className={`relative bg-slate-950/90 border border-slate-800 rounded-2xl p-2.5 px-4 shadow-xl flex items-center justify-between gap-3 text-xs backdrop-blur-md ${className}`}
      >
        <audio
          ref={audioRef}
          src={formattedUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={handleAudioPause}
          onEnded={() => setIsPlaying(false)}
          onError={handleAudioError}
        />

        {/* Play/Pause Button */}
        {playerMode === "custom" && (
          <button
            type="button"
            onClick={togglePlay}
            disabled={hasError && !driveFileId}
            className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-teal-500/20 transition-all cursor-pointer disabled:opacity-50 flex-shrink-0"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-slate-950" /> : <Play className="w-4 h-4 ml-0.5 fill-slate-950" />}
          </button>
        )}

        {/* Title Badge if present */}
        {title && (
          <div className="hidden md:flex items-center gap-1.5 min-w-0 max-w-[220px] flex-shrink-0">
            <Music className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
            <span className="font-black text-white text-xs truncate">{title}</span>
          </div>
        )}

        {/* Center: Scrubber Range Slider or Drive Toggle notice */}
        {playerMode === "custom" ? (
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
            />
            <div className="font-mono text-[11px] text-slate-400 flex-shrink-0 flex items-center gap-1">
              <span className="text-white font-bold">{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 text-[11px] text-teal-300 font-semibold truncate flex items-center gap-1.5">
            <Tv className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
            <span>Mode Lecteur Google Drive Intégré</span>
          </div>
        )}

        {/* Right side controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {driveFileId && (
            <button
              type="button"
              onClick={() => setPlayerMode(playerMode === "custom" ? "drive" : "custom")}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 border ${
                playerMode === "drive"
                  ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                  : "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800"
              }`}
              title="Changer de lecteur audio"
            >
              {playerMode === "custom" ? <Tv className="w-3 h-3 text-teal-400" /> : <Radio className="w-3 h-3 text-teal-400" />}
              <span>{playerMode === "custom" ? "Drive" : "Standard"}</span>
            </button>
          )}

          {playerMode === "custom" && (
            <>
              <button
                type="button"
                onClick={cyclePlaybackRate}
                className="px-2 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-bold font-mono transition-all cursor-pointer"
                title="Vitesse de lecture"
              >
                {playbackRate}x
              </button>
              <button
                type="button"
                onClick={toggleMute}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs transition-all cursor-pointer"
                title={isMuted ? "Activer le son" : "Couper le son"}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-slate-300" />}
              </button>
            </>
          )}

          <a
            href={audioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs transition-all cursor-pointer"
            title="Ouvrir dans un nouvel onglet"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
          </a>
        </div>

        {/* If Drive Mode is active in compact mode, expand iframe popup below */}
        {playerMode === "drive" && driveFileId && (
          <div className="absolute top-full left-0 right-0 z-50 mt-2 p-2 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl">
            <iframe
              src={`https://drive.google.com/file/d/${driveFileId}/preview`}
              className="w-full h-36 rounded-xl border border-slate-800"
              allow="autoplay"
            />
          </div>
        )}
      </div>
    );
  }

  // ── FULL CARD MODE (EMBEDDED HORIZONTAL PLAYER) ──────────────────────────
  return (
    <div
      className={`bg-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-lg space-y-4 ${className}`}
    >
      <audio
        ref={audioRef}
        src={formattedUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={handleAudioPause}
        onEnded={() => setIsPlaying(false)}
        onError={handleAudioError}
      />

      {/* TOP BAR: Title, Equalizer & Utilities */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        {/* Title & Live Status */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#1dc4ff]/15 border border-[#1dc4ff]/30 text-[#1dc4ff] flex items-center justify-center flex-shrink-0">
            <Headphones className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-white text-xs sm:text-sm truncate flex items-center gap-2">
              <span className="truncate">{title || "Enregistrement audio de l'appel"}</span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2 font-medium">
              <span>{playerMode === "drive" ? "Google Drive Audio Stream" : "Audio synchronisé"}</span>
              {isPlaying && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded-md border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Lecture en cours
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right utility buttons */}
        <div className="flex items-center gap-2 flex-shrink-0 justify-end flex-wrap">
          {driveFileId && (
            <button
              type="button"
              onClick={() => setPlayerMode(playerMode === "custom" ? "drive" : "custom")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                playerMode === "drive"
                  ? "bg-[#1dc4ff]/20 text-[#1dc4ff] border-[#1dc4ff]/40 shadow-xs"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
              }`}
              title={playerMode === "custom" ? "Basculer vers le lecteur Google Drive" : "Basculer vers le lecteur standard"}
            >
              {playerMode === "custom" ? (
                <>
                  <Tv className="w-3.5 h-3.5 text-[#1dc4ff]" /> Mode Lecteur Drive
                </>
              ) : (
                <>
                  <Radio className="w-3.5 h-3.5 text-[#1dc4ff]" /> Mode Lecteur Standard
                </>
              )}
            </button>
          )}

          {playerMode === "custom" && (
            <>
              {/* Speed Button */}
              <button
                type="button"
                onClick={cyclePlaybackRate}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-1"
                title="Vitesse de lecture"
              >
                <FastForward className="w-3 h-3 text-[#1dc4ff]" />
                {playbackRate}x
              </button>

              {/* Volume Slider & Mute Toggle */}
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2 py-1 rounded-xl">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title={isMuted ? "Activer le son" : "Couper le son"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  ) : volume < 0.5 ? (
                    <Volume1 className="w-3.5 h-3.5 text-slate-300" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-[#1dc4ff]" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-14 sm:w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#1dc4ff]"
                  title={`Volume: ${Math.round(volume * 100)}%`}
                />
              </div>
            </>
          )}

          {/* Open in Drive / Tab */}
          <a
            href={audioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition-all cursor-pointer"
            title="Ouvrir dans Google Drive / nouvel onglet"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
          </a>
        </div>
      </div>

      {/* DRIVE MODE EMBED */}
      {playerMode === "drive" && driveFileId ? (
        <div className="space-y-3 pt-1">
          <div className="text-xs text-[#1dc4ff] font-medium flex items-center justify-between bg-[#1dc4ff]/10 p-3 rounded-xl border border-[#1dc4ff]/20">
            <span className="flex items-center gap-2">
              <Tv className="w-4 h-4 text-[#1dc4ff] flex-shrink-0" />
              Lecteur Google Drive intégré — Cliquez sur lecture ci-dessous :
            </span>
            <button
              type="button"
              onClick={() => setPlayerMode("custom")}
              className="text-[11px] font-bold text-slate-300 hover:text-white underline cursor-pointer"
            >
              Essayer le lecteur Standard
            </button>
          </div>
          <iframe
            src={`https://drive.google.com/file/d/${driveFileId}/preview`}
            className="w-full h-32 sm:h-36 rounded-xl border border-slate-800 bg-slate-950 shadow-inner"
            allow="autoplay"
          />
        </div>
      ) : (
        /* CUSTOM INTERACTIVE SCRUBBER BAR */
        <div className="space-y-3">
          {/* Main Controls Row */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Rewind -10s */}
            <button
              type="button"
              onClick={() => skip(-10)}
              disabled={hasError && !driveFileId}
              className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1 flex-shrink-0"
              title="Reculer de 10 secondes"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#1dc4ff]" />
              <span className="text-[10px] font-mono font-black hidden sm:inline">-10s</span>
            </button>

            {/* Central Play/Pause Big Button */}
            <button
              type="button"
              onClick={togglePlay}
              disabled={hasError && !driveFileId}
              className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#009ae5] to-[#1dc4ff] hover:from-[#0088cc] hover:to-[#00b5f5] text-slate-950 flex items-center justify-center font-black shadow-lg shadow-[#1dc4ff]/25 hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex-shrink-0"
              title={isPlaying ? "Pause" : "Lire l'audio"}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-slate-950" />
              ) : (
                <Play className="w-5 h-5 ml-0.5 fill-slate-950" />
              )}
            </button>

            {/* Fast Forward +10s */}
            <button
              type="button"
              onClick={() => skip(10)}
              disabled={hasError && !driveFileId}
              className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1 flex-shrink-0"
              title="Avancer de 10 secondes"
            >
              <span className="text-[10px] font-mono font-black hidden sm:inline">+10s</span>
              <RotateCw className="w-3.5 h-3.5 text-[#1dc4ff]" />
            </button>

            {/* Progress Slider Track with Timestamps */}
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <span className="font-mono text-xs font-bold text-slate-300 w-11 text-right flex-shrink-0">
                {formatTime(currentTime)}
              </span>

              <div className="relative flex-1 flex items-center">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#1dc4ff]"
                />
              </div>

              <span className="font-mono text-xs font-bold text-slate-400 w-11 flex-shrink-0">
                {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Temporal Markers (if any) */}
      {markers.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-800">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1">Repères :</span>
          {markers.map((m, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => seekTo(m.time)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 hover:text-[#1dc4ff] transition-all cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3 text-[#1dc4ff]" />
              {m.label} ({formatTime(m.time)})
            </button>
          ))}
        </div>
      )}

      {/* Fallback Notice if Custom HTML5 fails and no Drive file ID */}
      {hasError && !driveFileId && (
        <div className="text-xs text-rose-300 bg-rose-950/80 p-3 rounded-xl border border-rose-800/80 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>Impossible de lire cet audio directement dans le navigateur. Utilisez le bouton d'ouverture externe pour l'écouter sur Google Drive.</span>
        </div>
      )}
    </div>
  );
};
