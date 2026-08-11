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
  Radio,
  Tv,
  AlertCircle,
  GripVertical,
  Minimize2,
  Maximize2,
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

  // ── FULL CARD MODE ────────────────────────────────────────────────────────
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
        onPause={handleAudioPause}
        onEnded={() => setIsPlaying(false)}
        onError={handleAudioError}
      />

      {/* HEADER CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Title & Waveform Indicator */}
        <div className="flex items-center gap-3 min-w-0">
          {playerMode === "custom" && (
            <button
              type="button"
              onClick={togglePlay}
              disabled={hasError && !driveFileId}
              className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white flex items-center justify-center shadow-md shadow-teal-600/30 transition-all cursor-pointer disabled:opacity-50 flex-shrink-0"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
          )}

          <div className="space-y-0.5 min-w-0">
            <div className="font-extrabold text-white text-xs sm:text-sm truncate flex items-center gap-2">
              <Music className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
              <span className="truncate">{title || "Enregistrement de la session"}</span>
            </div>
            {playerMode === "custom" && (
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
            )}
          </div>
        </div>

        {/* Action Pills */}
        <div className="flex items-center gap-2 flex-shrink-0 justify-end">
          {/* Switch Mode Button if Drive URL */}
          {driveFileId && (
            <button
              type="button"
              onClick={() => setPlayerMode(playerMode === "custom" ? "drive" : "custom")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                playerMode === "drive"
                  ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
              }`}
              title={playerMode === "custom" ? "Basculer vers le lecteur Google Drive" : "Basculer vers le lecteur standard"}
            >
              {playerMode === "custom" ? (
                <>
                  <Tv className="w-3.5 h-3.5 text-teal-400" /> Lecteur Drive
                </>
              ) : (
                <>
                  <Radio className="w-3.5 h-3.5 text-teal-400" /> Lecteur Standard
                </>
              )}
            </button>
          )}

          {playerMode === "custom" && (
            <>
              <button
                type="button"
                onClick={cyclePlaybackRate}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold font-mono transition-all cursor-pointer"
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
            </>
          )}

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

      {/* RENDER DRIVE IFRAME PLAYER */}
      {playerMode === "drive" && driveFileId ? (
        <div className="space-y-2 pt-1">
          <div className="text-[11px] text-teal-300 font-semibold flex items-center gap-1.5 bg-teal-500/10 p-2 rounded-xl border border-teal-500/20">
            <Tv className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
            Lecteur Intégré Google Drive — Cliquez sur le bouton de lecture ci-dessous :
          </div>
          <iframe
            src={`https://drive.google.com/file/d/${driveFileId}/preview`}
            className="w-full h-36 rounded-xl border border-slate-800 bg-slate-950 shadow-inner"
            allow="autoplay"
          />
        </div>
      ) : (
        /* RENDER CUSTOM SCRUBBER */
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
      )}

      {/* Temporal Markers (if any) */}
      {markers.length > 0 && (
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

      {/* Fallback Notice if Custom HTML5 fails and no Drive file ID */}
      {hasError && !driveFileId && (
        <div className="text-[11px] text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Impossible de lire cet audio directement. Cliquez sur l'icône d'ouverture externe pour l'écouter.</span>
        </div>
      )}
    </div>
  );
};
