import { useEffect, useState } from 'react';
import { FastForward } from 'lucide-react';
import { audioEngine } from '../game/audio';
import { CutsceneBeat, LevelConfig } from '../game/types';

interface CutsceneOverlayProps {
  level: LevelConfig;
  voiceOver: boolean;
  onBeatChange: (preset: CutsceneBeat['cameraPreset']) => void;
  onFinish: () => void;
}

export function CutsceneOverlay({
  level,
  voiceOver,
  onBeatChange,
  onFinish,
}: CutsceneOverlayProps) {
  const [beatIndex, setBeatIndex] = useState(0);
  const beats = level.cutscene;
  const currentBeat = beats[beatIndex];

  useEffect(() => {
    if (!currentBeat) {
      onFinish();
      return;
    }
    onBeatChange(currentBeat.cameraPreset);
    audioEngine.speakSubtitle(currentBeat.subtitle, voiceOver);

    const timer = window.setTimeout(() => {
      if (beatIndex + 1 < beats.length) {
        setBeatIndex(beatIndex + 1);
      } else {
        audioEngine.stopSpeech();
        onFinish();
      }
    }, currentBeat.durationSec * 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [beatIndex, beats.length, currentBeat, onBeatChange, onFinish, voiceOver]);

  if (!currentBeat) return null;

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-auto">
      {/* Letterbox Cinema Bars */}
      <div className="h-14 sm:h-16 bg-[#04070c]/95 border-b border-white/10 px-6 flex items-center justify-between">
        <div className="text-xs text-slate-300 font-mono-num">
          <span>{level.code}</span>
          <span className="mx-2 text-slate-600">·</span>
          <span className="text-amber-300">{level.name}</span>
        </div>

        <button
          type="button"
          onClick={() => {
            audioEngine.stopSpeech();
            onFinish();
          }}
          className="px-3.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-white/15 text-xs text-slate-200 flex items-center gap-1.5 transition-colors"
        >
          <span>Skip Briefing</span>
          <FastForward className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bottom Subtitle Letterbox */}
      <div className="bg-[#04070c]/95 border-t border-white/10 px-6 py-5 sm:py-6 flex flex-col items-center text-center">
        <div className="text-[11px] font-semibold tracking-widest text-amber-400 mb-1">
          {currentBeat.title}
        </div>
        <div className="text-xs text-sky-300 mb-1.5">{currentBeat.speaker}</div>
        <p className="text-sm sm:text-base text-slate-100 max-w-2xl leading-relaxed">
          “{currentBeat.subtitle}”
        </p>
        <div className="mt-3 flex items-center gap-1.5">
          {beats.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === beatIndex ? 'w-6 bg-amber-400' : 'w-2 bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
