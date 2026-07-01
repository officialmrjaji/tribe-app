"use client";

import { Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import { useRef, useState } from "react";

type VoiceIntroPlayerProps = {
  durationSeconds?: number | null;
  label?: string;
  src: string;
};

export function VoiceIntroPlayer({
  durationSeconds,
  label = "Voice intro",
  src,
}: VoiceIntroPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState(durationSeconds ?? 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.85);

  function togglePlayback() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (audio.paused) {
      void audio.play();
      return;
    }

    audio.pause();
  }

  function updateProgress() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    setProgress(audio.currentTime);
    setDuration(audio.duration || durationSeconds || 0);
  }

  function seek(value: number) {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.currentTime = value;
    setProgress(value);
  }

  function changeRate() {
    const nextRate = playbackRate === 1 ? 1.25 : playbackRate === 1.25 ? 1.5 : 1;
    const audio = audioRef.current;

    if (audio) {
      audio.playbackRate = nextRate;
    }

    setPlaybackRate(nextRate);
  }

  function changeVolume(value: number) {
    const audio = audioRef.current;

    if (audio) {
      audio.volume = value;
    }

    setVolume(value);
  }

  function restart() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.currentTime = 0;
    setProgress(0);
    void audio.play();
  }

  return (
    <div className="rounded-md border border-[#e2e6dc] bg-white p-3">
      <audio
        onEnded={() => setIsPlaying(false)}
        onLoadedMetadata={updateProgress}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={updateProgress}
        ref={audioRef}
        src={src}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          aria-label={isPlaying ? `Pause ${label}` : `Play ${label}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#17251f] text-white transition hover:bg-[#253b32]"
          onClick={togglePlayback}
          type="button"
        >
          {isPlaying ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold text-[#34443a]">
              {label}
            </p>
            <p className="text-xs font-semibold text-[#607265]">
              {formatTime(progress)} / {formatTime(duration)}
            </p>
          </div>
          <input
            aria-label={`${label} progress`}
            className="mt-2 h-2 w-full accent-[#17251f]"
            max={Math.max(duration, 1)}
            min={0}
            onChange={(event) => seek(Number(event.target.value))}
            step="0.1"
            type="range"
            value={Math.min(progress, Math.max(duration, 1))}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label={`Restart ${label}`}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[#cbd4c6] text-[#34443a] transition hover:bg-[#f3f0e6]"
            onClick={restart}
            type="button"
          >
            <RotateCcw size={15} />
          </button>
          <button
            className="flex h-9 min-w-12 items-center justify-center rounded-md border border-[#cbd4c6] px-2 text-xs font-bold text-[#34443a] transition hover:bg-[#f3f0e6]"
            onClick={changeRate}
            type="button"
          >
            {playbackRate}x
          </button>
          <label className="flex items-center gap-1 text-[#607265]">
            <Volume2 size={15} />
            <span className="sr-only">Volume</span>
            <input
              aria-label={`${label} volume`}
              className="h-2 w-16 accent-[#17251f]"
              max={1}
              min={0}
              onChange={(event) => changeVolume(Number(event.target.value))}
              step={0.05}
              type="range"
              value={volume}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0:00";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}
