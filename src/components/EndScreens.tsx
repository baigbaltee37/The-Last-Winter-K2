import { Award, Home, Play, RotateCcw, Skull } from 'lucide-react';
import { BADGES, LEVELS } from '../game/data';
import { GameTelemetry, LevelConfig } from '../game/types';

interface PauseModalProps {
  level: LevelConfig;
  onResume: () => void;
  onRestart: () => void;
  onExitMenu: () => void;
}

export function PauseModal({
  level,
  onResume,
  onRestart,
  onExitMenu,
}: PauseModalProps) {
  return (
    <div className="fixed inset-0 z-30 bg-[#05080f]/82 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#0b121e] border border-white/15 rounded-xl p-6 space-y-4">
        <div>
          <div className="text-xs text-amber-400 font-mono-num">{level.code}</div>
          <h2 className="font-display text-3xl font-bold text-white">Expedition Paused</h2>
          <p className="text-xs text-slate-400 mt-1">{level.name}</p>
        </div>

        <div className="flex flex-col gap-2.5 pt-2">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Resume Climb</span>
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-100 text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart Ridge</span>
          </button>
          <button
            type="button"
            onClick={onExitMenu}
            className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface LevelCompleteModalProps {
  level: LevelConfig;
  telemetry: GameTelemetry;
  onNextLevel: (next: LevelConfig) => void;
  onReplay: () => void;
  onExitMenu: () => void;
}

export function LevelCompleteModal({
  level,
  telemetry,
  onNextLevel,
  onReplay,
  onExitMenu,
}: LevelCompleteModalProps) {
  const nextLevel = LEVELS.find((l) => l.id === level.id + 1);
  const mins = Math.floor(telemetry.elapsedTime / 60);
  const secs = Math.round(telemetry.elapsedTime % 60);
  const earnedBadgeObjs = BADGES.filter((b) => telemetry.newlyEarnedBadges.includes(b.id));

  return (
    <div className="fixed inset-0 z-30 bg-[#05080f]/85 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0b121e] border border-emerald-400/35 rounded-xl p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/15 text-emerald-400 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-mono-num text-emerald-400">
              {level.id === 11 ? 'SUMMIT ACHIEVED · 8,611m' : `CAMP SECURED · ${level.code}`}
            </div>
            <h2 className="font-display text-3xl font-bold text-white leading-tight">
              {level.id === 11 ? 'K2 Winter Summit Conquered' : `${level.name} Complete`}
            </h2>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">{level.completionQuote}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-3 border-y border-white/10 text-center">
          <div>
            <div className="text-[11px] text-slate-400">Climb Time</div>
            <div className="font-mono-num text-base font-semibold text-white">
              {mins}m {secs}s
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Peak Altitude</div>
            <div className="font-mono-num text-base font-semibold text-sky-300">
              {level.altitudeEnd.toLocaleString()}m
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">O2 Left</div>
            <div className="font-mono-num text-base font-semibold text-emerald-300">
              {telemetry.oxygen}%
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Earned</div>
            <div className="font-mono-num text-base font-semibold text-amber-300">
              +{telemetry.sessionPoints} PTS
            </div>
          </div>
        </div>

        {earnedBadgeObjs.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
              Unlocked Expedition Badges
            </div>
            <div className="space-y-1.5">
              {earnedBadgeObjs.map((badge) => (
                <div
                  key={badge.id}
                  className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-400/35 flex items-start justify-between gap-2"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">{badge.title}</div>
                    <div className="text-[11px] text-slate-300">{badge.description}</div>
                  </div>
                  <span className="font-mono-num text-[11px] font-semibold text-emerald-300 shrink-0">
                    +{badge.pointsReward} PTS
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {nextLevel && (
            <button
              type="button"
              onClick={() => onNextLevel(nextLevel)}
              className="w-full py-3 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors"
            >
              Proceed to {nextLevel.name} ({nextLevel.altitudeEnd.toLocaleString()}m)
            </button>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onReplay}
              className="py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-100 text-sm transition-colors"
            >
              Replay Stage
            </button>
            <button
              type="button"
              onClick={onExitMenu}
              className="py-2.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 text-sm transition-colors"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface GameOverModalProps {
  level: LevelConfig;
  telemetry: GameTelemetry;
  onRetry: () => void;
  onExitMenu: () => void;
}

export function GameOverModal({
  level,
  telemetry,
  onRetry,
  onExitMenu,
}: GameOverModalProps) {
  return (
    <div className="fixed inset-0 z-30 bg-[#05080f]/88 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0b121e] border border-rose-500/35 rounded-xl p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-rose-500/15 text-rose-400 shrink-0">
            <Skull className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-mono-num text-rose-400">
              EXPEDITION HALTED · {level.code}
            </div>
            <h2 className="font-display text-3xl font-bold text-white leading-tight">
              Turned Back by the Mountain
            </h2>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">
          {telemetry.failureReason || 'Survival vitals dropped below critical threshold.'}
        </p>

        <div className="grid grid-cols-2 gap-3 py-3 border-y border-white/10 text-center">
          <div>
            <div className="text-[11px] text-slate-400">Altitude Reached</div>
            <div className="font-mono-num text-base font-semibold text-white">
              {telemetry.altitude.toLocaleString()}m
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Distance to Camp</div>
            <div className="font-mono-num text-base font-semibold text-amber-300">
              {telemetry.distanceToCheckpoint}m
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onRetry}
            className="py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors"
          >
            Retry Climb
          </button>
          <button
            type="button"
            onClick={onExitMenu}
            className="py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-200 text-sm transition-colors"
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
