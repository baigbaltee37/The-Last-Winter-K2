import { useState } from 'react';
import {
  AlertTriangle,
  Anchor,
  Backpack,
  BatteryCharging,
  Check,
  Compass,
  Droplets,
  Flame,
  Flashlight,
  Heart,
  MoveHorizontal,
  Pause,
  Radio,
  ShieldAlert,
  Snowflake,
  Timer,
  Unlink,
  Users,
  Waves,
  Wind,
  Wrench,
  X,
} from 'lucide-react';
import { GameTelemetry, LevelConfig } from '../game/types';
import { MiniMap } from './MiniMap';

interface GameHUDProps {
  telemetry: GameTelemetry;
  level: LevelConfig;
  onPause: () => void;
  onUseEquipment: (id: string) => void;
  onRepairGear: () => void;
  onToggleHeadlamp: () => void;
  onRopeStep: () => void;
  onRecoverRope: () => void;
  onPushObstacle: () => void;
  onQteAction: () => void;
  onDecision: (choice: 'A' | 'B') => void;
  showTouchControls: boolean;
}

function VitalBar({
  label,
  value,
  colorClass,
  warning,
}: {
  label: string;
  value: number;
  colorClass: string;
  warning?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between text-[11px] leading-none">
        <span className={warning ? 'text-rose-300 font-semibold' : 'text-slate-300'}>{label}</span>
        <span className="font-mono-num text-slate-100">{value}%</span>
      </div>
      <div className="h-1.5 w-full rounded-sm bg-slate-800 overflow-hidden">
        <div
          className={`h-full transition-all duration-150 ${colorClass}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

const WEATHER_LABELS: Record<string, string> = {
  clear: 'Clear Alpine Sky',
  overcast: 'Overcast Ridge',
  snowfall: 'Heavy Snowfall',
  fog: 'Glacial Fog',
  windy: 'Gale Ridge Winds',
  snowstorm: 'Snowstorm',
  blizzard: 'Whiteout Blizzard',
  thunder_snow: 'Mountain Lightning Storm',
};

function compassLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

export function GameHUD({
  telemetry,
  level,
  onPause,
  onUseEquipment,
  onRepairGear,
  onToggleHeadlamp,
  onRopeStep,
  onRecoverRope,
  onPushObstacle,
  onQteAction,
  onDecision,
  showTouchControls,
}: GameHUDProps) {
  const [inventoryOpen, setInventoryOpen] = useState(false);

  const countOf = (id: string) =>
    telemetry.equipment.find((e) => e.id === id)?.quantity ?? 0;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-3 sm:p-4">
      {/* Top Row: Vitals | Compass, GPS & Missions | MiniMap & Pause */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left: Survival Vitals */}
        <div className="pointer-events-auto w-48 sm:w-56 bg-[#09111e]/92 border border-white/12 rounded-lg p-2.5 space-y-1.5">
          <VitalBar
            label="Health"
            value={telemetry.health}
            colorClass={telemetry.health < 30 ? 'bg-rose-500' : 'bg-emerald-500'}
            warning={telemetry.health < 30}
          />
          <VitalBar
            label="Oxygen"
            value={telemetry.oxygen}
            colorClass={telemetry.oxygen < 30 ? 'bg-rose-500' : 'bg-sky-400'}
            warning={telemetry.altitudeSicknessRisk}
          />
          <VitalBar label="Stamina" value={telemetry.stamina} colorClass="bg-amber-400" />
          <VitalBar
            label="Ice Grip"
            value={telemetry.gripStrength}
            colorClass={telemetry.gripStrength < 30 ? 'bg-rose-400' : 'bg-cyan-400'}
            warning={telemetry.gripStrength < 30}
          />
          <VitalBar
            label={`Warmth (${telemetry.coreTempC}°C)`}
            value={telemetry.temperature}
            colorClass={telemetry.frostbiteRisk ? 'bg-cyan-300' : 'bg-orange-400'}
            warning={telemetry.frostbiteRisk}
          />
          <VitalBar
            label="Headlamp Battery"
            value={telemetry.headlampBattery}
            colorClass={telemetry.headlampBattery < 20 ? 'bg-rose-400' : 'bg-amber-300'}
            warning={telemetry.headlampBattery < 20}
          />

          <div className="pt-1 border-t border-white/10 grid grid-cols-3 gap-x-1 gap-y-0.5 text-[10px] text-slate-300 font-mono-num">
            <span>Food {telemetry.hunger}%</span>
            <span>H2O {telemetry.thirst}%</span>
            <span>Gear {telemetry.gearIntegrity}%</span>
            <span>Fatigue {telemetry.fatigue}%</span>
            <span>Head {telemetry.headacheSeverity}%</span>
            <span>{telemetry.packWeightKg}kg</span>
          </div>

          {/* Rope Rigging Status */}
          <div className="pt-1 border-t border-white/10 text-[10px] space-y-0.5">
            {telemetry.ropeRigState === 'none' && (
              <div className="text-slate-400 flex items-center justify-between">
                <span>Rope Rig: Unroped</span>
                {telemetry.nearAnchorSpot && (
                  <span
                    className={
                      telemetry.anchorSpotQuality === 'solid'
                        ? 'text-sky-300 font-semibold'
                        : 'text-amber-300 font-semibold'
                    }
                  >
                    {telemetry.anchorSpotQuality === 'solid' ? 'Solid Slot' : 'Loose Slot'}
                  </span>
                )}
              </div>
            )}
            {telemetry.ropeRigState === 'anchor_placed' && (
              <div className="text-sky-300 font-semibold">
                Anchor Set ({telemetry.anchorStability}%) · Press R to attach rope
              </div>
            )}
            {telemetry.ropeRigState === 'rope_secured' && (
              <div className="text-emerald-300 font-semibold font-mono-num">
                Rope Secured · {telemetry.ropeDistanceM}m · Stab {telemetry.anchorStability}% · Tension {telemetry.ropeTension}%
              </div>
            )}
          </div>

          {/* Action-Adventure Dynamic Alerts */}
          {(telemetry.carryingTeammate ||
            telemetry.wildlifeNearby ||
            telemetry.flareActive ||
            telemetry.helicopterInbound ||
            level.specialMission === 'night_search' ||
            telemetry.frostbiteRisk ||
            telemetry.hypothermiaRisk ||
            telemetry.altitudeSicknessRisk ||
            telemetry.avalancheWarning ||
            telemetry.rockfallWarning ||
            telemetry.floodWarning ||
            telemetry.landslideWarning) && (
            <div className="pt-1 flex flex-col gap-1 text-[11px] font-semibold">
              {telemetry.carryingTeammate && (
                <div className="flex items-center gap-1.5 text-amber-300">
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span>Evacuating Injured Teammate</span>
                </div>
              )}
              {telemetry.wildlifeNearby && (
                <div className="flex items-center gap-1.5 text-rose-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Snow Predator ({telemetry.wildlifeThreatDist}m) · Q/E or Flare [6]</span>
                </div>
              )}
              {telemetry.helicopterInbound && (
                <div className="flex items-center gap-1.5 text-emerald-300">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Rescue Helicopter Descending</span>
                </div>
              )}
              {telemetry.flareActive && (
                <div className="flex items-center gap-1.5 text-orange-300">
                  <Flame className="w-3.5 h-3.5 shrink-0" />
                  <span>Emergency Flare Lit</span>
                </div>
              )}
              {level.specialMission === 'night_search' && (
                <div className="flex items-center gap-1.5 text-sky-300 font-mono-num">
                  <Radio className="w-3.5 h-3.5 shrink-0" />
                  <span>Distress Signal: {telemetry.radioSignalStrength}%</span>
                </div>
              )}
              {telemetry.rockfallWarning && (
                <div className="flex items-center gap-1.5 text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Rockfall Warning · Seek Cover</span>
                </div>
              )}
              {telemetry.floodWarning && (
                <div className="flex items-center gap-1.5 text-sky-300">
                  <Waves className="w-3.5 h-3.5 shrink-0" />
                  <span>Glacial Flood Surge</span>
                </div>
              )}
              {telemetry.landslideWarning && (
                <div className="flex items-center gap-1.5 text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Unstable Landslide Scree</span>
                </div>
              )}
              {telemetry.avalancheWarning && (
                <div className="flex items-center gap-1.5 text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Avalanche Danger</span>
                </div>
              )}
              {telemetry.frostbiteRisk && (
                <div className="flex items-center gap-1.5 text-cyan-300">
                  <Snowflake className="w-3.5 h-3.5 shrink-0" />
                  <span>{telemetry.hypothermiaRisk ? 'Hypothermia Alert' : 'Frostbite Risk'}</span>
                </div>
              )}
              {telemetry.altitudeSicknessRisk && (
                <div className="flex items-center gap-1.5 text-rose-300">
                  <Heart className="w-3.5 h-3.5 shrink-0" />
                  <span>Altitude Sickness / Hypoxia</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Top-Center: Compass, GPS, Missions, Timed Escape */}
        <div className="hidden md:flex flex-col items-center gap-2 max-w-xl">
          <div className="bg-[#09111e]/92 border border-white/12 rounded-lg px-4 py-1.5 flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-amber-300 font-mono-num">
              <Compass className="w-3.5 h-3.5" />
              <span>
                {compassLabel(telemetry.compassHeadingDeg)} {telemetry.compassHeadingDeg}°
              </span>
            </div>
            <span className="text-slate-600">·</span>
            <div className="flex items-baseline gap-1">
              <span className="text-slate-400">ALT</span>
              <span className="font-mono-num text-sm font-semibold text-white">
                {telemetry.altitude.toLocaleString()}m
              </span>
            </div>
            <span className="text-slate-600">·</span>
            <div className="flex items-center gap-1.5 text-slate-200">
              <Wind className="w-3.5 h-3.5 text-sky-300" />
              <span className="whitespace-nowrap">{WEATHER_LABELS[telemetry.weather] || telemetry.weather}</span>
              <span className="font-mono-num text-slate-400">{telemetry.windSpeedKmh} km/h</span>
            </div>
            <span className="text-slate-600">·</span>
            <span className="font-mono-num text-slate-300">{telemetry.ambientTempC}°C</span>
            <span className="text-slate-600">·</span>
            <span className="font-mono-num text-amber-300">+{telemetry.sessionPoints} PTS</span>
          </div>

          <div className="bg-[#09111e]/88 border border-white/10 rounded-lg px-3.5 py-2 w-full">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span className="font-medium text-slate-200">
                {level.code} · {level.name} · <span className="text-sky-300">{telemetry.terrainSurface}</span>
              </span>
              <span className="font-mono-num">
                {telemetry.variationLabel} · {telemetry.timeOfDayLabel} · {telemetry.gpsCoords}
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-0.5">
              {telemetry.missions.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center gap-1.5 text-[11px] ${
                    m.completed ? 'text-emerald-400 line-through' : 'text-slate-200'
                  }`}
                >
                  <Check
                    className={`w-3 h-3 shrink-0 ${
                      m.completed ? 'text-emerald-400' : 'text-slate-600'
                    }`}
                  />
                  <span className="truncate">{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {telemetry.timedEscape && telemetry.timedEscape.active && (
            <div className="w-full bg-rose-950/95 border border-rose-400/60 rounded-lg px-4 py-2 space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-rose-100">
                <span className="flex items-center gap-1.5">
                  <Timer className="w-4 h-4 text-rose-300" />
                  <span>{telemetry.timedEscape.label}</span>
                </span>
                <span className="font-mono-num text-amber-300">
                  {telemetry.timedEscape.timeRemaining.toFixed(1)}s
                </span>
              </div>
              <div className="h-1.5 w-full rounded-sm bg-slate-900 overflow-hidden">
                <div
                  className="h-full bg-rose-400 transition-all duration-100"
                  style={{
                    width: `${Math.max(
                      0,
                      (telemetry.timedEscape.timeRemaining / telemetry.timedEscape.maxTime) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Top-Right: MiniMap, Inventory & Pause */}
        <div className="pointer-events-auto flex items-start gap-2">
          <div className="hidden sm:block">
            <MiniMap telemetry={telemetry} />
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={onPause}
              className="h-10 px-3 bg-[#09111e]/92 border border-white/15 rounded-lg text-slate-100 hover:bg-slate-800 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors"
              aria-label="Pause Expedition"
            >
              <Pause className="w-4 h-4" />
              <span className="hidden sm:inline">Pause</span>
            </button>
            <button
              type="button"
              onClick={() => setInventoryOpen((v) => !v)}
              className={`h-10 px-3 border rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium transition-colors ${
                inventoryOpen
                  ? 'bg-amber-500 text-slate-950 border-amber-300'
                  : 'bg-[#09111e]/92 border-white/15 text-slate-100 hover:bg-slate-800'
              }`}
              aria-label="Toggle Expedition Pack"
            >
              <Backpack className="w-4 h-4" />
              <span className="hidden sm:inline">Pack ({telemetry.equipment.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Center Status / QTE Urgent Prompt / Narrow Ridge Balance Meter / Interact */}
      <div className="flex flex-col items-center gap-2 my-auto pointer-events-none">
        {telemetry.activeQte && (
          <div className="pointer-events-auto bg-[#0b1322]/96 border-2 border-amber-400 rounded-xl px-5 py-3.5 w-80 sm:w-96 space-y-2.5 shadow-2xl">
            <div className="flex items-center justify-between text-xs font-bold text-amber-300">
              <span>{telemetry.activeQte.title}</span>
              <span className="font-mono-num text-rose-300">
                {telemetry.activeQte.timeRemaining.toFixed(1)}s
              </span>
            </div>
            <p className="text-xs text-slate-200 leading-snug">{telemetry.activeQte.prompt}</p>
            <div className="h-2 w-full rounded-sm bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-75"
                style={{
                  width: `${Math.max(
                    0,
                    (telemetry.activeQte.timeRemaining / telemetry.activeQte.maxTime) * 100
                  )}%`,
                }}
              />
            </div>
            <button
              type="button"
              onClick={onQteAction}
              className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors"
            >
              EXECUTE [{telemetry.activeQte.keyLabel}] NOW
            </button>
          </div>
        )}

        {telemetry.onNarrowRidge && (
          <div className="bg-[#09111e]/94 border border-amber-400/50 rounded-lg px-4 py-2 flex flex-col items-center gap-1.5 w-64">
            <div className="text-[11px] font-semibold text-amber-300">
              Narrow Ridge Balance · Hold Crouch to Stabilize
            </div>
            <div className="relative w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/40" />
              <div
                className={`absolute top-0 bottom-0 w-3 rounded-full -ml-1.5 ${
                  Math.abs(telemetry.balance) > 0.65 ? 'bg-rose-500' : 'bg-emerald-400'
                }`}
                style={{ left: `${50 + telemetry.balance * 45}%` }}
              />
            </div>
          </div>
        )}

        {telemetry.statusBanner && (
          <div className="bg-[#09111e]/94 border border-amber-400/35 rounded-lg px-4 py-2 text-xs sm:text-sm text-amber-100 text-center max-w-lg">
            {telemetry.statusBanner}
          </div>
        )}

        {telemetry.interactPrompt && (
          <div className="bg-emerald-950/94 border border-emerald-400/45 rounded-lg px-4 py-2 text-xs sm:text-sm font-medium text-emerald-100 text-center">
            {telemetry.interactPrompt}
          </div>
        )}
      </div>

      {/* Bottom: Equipment Quick-Bar & Controls Hint */}
      <div className="flex flex-col items-center gap-2">
        <div className="md:hidden bg-[#09111e]/92 border border-white/12 rounded-lg px-3 py-1.5 flex items-center gap-2.5 text-[11px] font-mono-num">
          <span className="text-amber-300">
            {compassLabel(telemetry.compassHeadingDeg)} {telemetry.compassHeadingDeg}°
          </span>
          <span className="text-slate-500">·</span>
          <span className="text-white font-semibold">{telemetry.altitude.toLocaleString()}m</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-300">{telemetry.distanceToCheckpoint}m</span>
          {telemetry.timedEscape?.active && (
            <>
              <span className="text-slate-500">·</span>
              <span className="text-rose-300 font-semibold">
                {telemetry.timedEscape.timeRemaining.toFixed(0)}s
              </span>
            </>
          )}
        </div>

        <div
          className={`pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 bg-[#09111e]/92 border border-white/15 rounded-lg p-1.5 ${
            showTouchControls ? 'mb-40 sm:mb-2' : ''
          }`}
        >
          <button
            type="button"
            onClick={() => onUseEquipment('oxygen')}
            className="px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs text-slate-100 flex items-center gap-1.5 whitespace-nowrap"
          >
            <span className="font-mono-num text-sky-300 font-semibold">[1] O2</span>
            <span className="font-mono-num text-slate-300">×{countOf('oxygen')}</span>
          </button>

          <button
            type="button"
            onClick={() => onUseEquipment('food')}
            className="px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs text-slate-100 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span className="font-mono-num text-orange-300 font-semibold">[2] Food</span>
            <span className="font-mono-num text-slate-300">×{countOf('food')}</span>
          </button>

          <button
            type="button"
            onClick={onToggleHeadlamp}
            className={`px-2.5 py-1.5 rounded-md border text-xs flex items-center gap-1.5 whitespace-nowrap ${
              telemetry.headlampOn
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                : 'bg-slate-900 border-white/10 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Flashlight className="w-3.5 h-3.5" />
            <span className="font-mono-num">[3] Lamp {telemetry.headlampBattery}%</span>
          </button>

          <button
            type="button"
            onClick={() => onUseEquipment('water')}
            className="px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs text-slate-100 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Droplets className="w-3.5 h-3.5 text-cyan-300" />
            <span className="font-mono-num text-cyan-300 font-semibold">[4] H2O</span>
            <span className="font-mono-num text-slate-300">×{countOf('water')}</span>
          </button>

          <button
            type="button"
            onClick={() => onUseEquipment('first_aid')}
            className="px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs text-slate-100 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Heart className="w-3.5 h-3.5 text-rose-400" />
            <span className="font-mono-num text-rose-300 font-semibold">[5] Meds</span>
            <span className="font-mono-num text-slate-300">×{countOf('first_aid')}</span>
          </button>

          <button
            type="button"
            onClick={() => onUseEquipment('flare')}
            className={`px-2.5 py-1.5 rounded-md border text-xs flex items-center gap-1.5 whitespace-nowrap ${
              telemetry.flareActive
                ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                : 'bg-slate-900 border-white/10 text-slate-100 hover:bg-slate-800'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span className="font-mono-num text-rose-300 font-semibold">[6] Flare</span>
            <span className="font-mono-num text-slate-300">×{countOf('flare')}</span>
          </button>

          <button
            type="button"
            onClick={onPushObstacle}
            className="px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs text-orange-200 flex items-center gap-1.5 whitespace-nowrap"
          >
            <MoveHorizontal className="w-3.5 h-3.5 text-orange-400" />
            <span className="font-mono-num">[X] Push</span>
          </button>

          <button
            type="button"
            onClick={onRopeStep}
            className={`px-2.5 py-1.5 rounded-md border text-xs flex items-center gap-1.5 whitespace-nowrap ${
              telemetry.ropeRigState === 'rope_secured'
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                : telemetry.ropeRigState === 'anchor_placed'
                  ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                  : 'bg-slate-900 border-white/10 text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Anchor className="w-3.5 h-3.5" />
            <span className="font-mono-num">
              [R] {telemetry.ropeRigState === 'none' ? 'Anchor' : telemetry.ropeRigState === 'anchor_placed' ? 'Attach Rope' : 'Mid-Anchor'} ×{countOf('carabiners')}
            </span>
          </button>

          {telemetry.ropeRigState !== 'none' && (
            <button
              type="button"
              onClick={onRecoverRope}
              className="px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-amber-400/35 text-xs text-amber-200 flex items-center gap-1.5 whitespace-nowrap"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span className="font-mono-num">[Shift+R] Pull Rope</span>
            </button>
          )}
        </div>

        {!showTouchControls && (
          <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-300/85 bg-[#09111e]/85 border border-white/10 rounded-md px-3 py-1">
            <span>WASD Move</span>
            <span>·</span>
            <span>Shift Sprint</span>
            <span>·</span>
            <span>V Crouch</span>
            <span>·</span>
            <span>Space Jump</span>
            <span>·</span>
            <span>C Climb</span>
            <span>·</span>
            <span>Q/E Axes & Defense</span>
            <span>·</span>
            <span>X Push Debris</span>
            <span>·</span>
            <span>6 Flare</span>
            <span>·</span>
            <span>R Rope</span>
            <span>·</span>
            <span>F Interact</span>
          </div>
        )}
      </div>

      {/* Interactive 19-Item Expedition Pack Drawer */}
      {inventoryOpen && (
        <div className="pointer-events-auto fixed right-4 top-24 bottom-24 z-30 w-80 bg-[#0b1322] border border-white/15 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div>
              <div className="text-sm font-semibold text-white">Expedition Pack ({telemetry.equipment.length} Items)</div>
              <div className="text-[11px] text-slate-400 font-mono-num">
                Load: {telemetry.packWeightKg} kg · Integrity: {telemetry.gearIntegrity}%
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInventoryOpen(false)}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Close pack"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {telemetry.equipment.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-lg bg-slate-900/85 border border-white/10 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-100">{item.name}</span>
                  <span className="text-[11px] font-mono-num text-amber-300 shrink-0">
                    ×{item.quantity} · {item.weightKg}kg
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">{item.description}</p>
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[10px] font-mono-num text-slate-400">
                    Cond {Math.round(item.durability)}% · {item.category}
                  </span>
                  {item.usable && (
                    <button
                      type="button"
                      onClick={() => onUseEquipment(item.id)}
                      className="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/40 text-[10px] font-semibold text-sky-200"
                    >
                      {item.id === 'headlamp' ? 'Battery / Toggle' : item.id === 'tent' ? 'Pitch / Pack' : 'Use'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
            <button
              type="button"
              onClick={onRepairGear}
              className="py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs text-slate-100 flex items-center justify-center gap-1.5"
            >
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span>Repair Gear</span>
            </button>
            <button
              type="button"
              onClick={() => onUseEquipment('headlamp')}
              className="py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs text-slate-100 flex items-center justify-center gap-1.5"
            >
              <BatteryCharging className="w-3.5 h-3.5 text-sky-400" />
              <span>Spare Cell</span>
            </button>
          </div>
        </div>
      )}

      {/* Critical Story Decision Modal */}
      {telemetry.activeDecision && (
        <div className="pointer-events-auto fixed inset-0 z-40 bg-[#060b14]/86 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0b1322] border border-amber-400/40 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
              <span className="text-xs font-semibold tracking-wider">
                {telemetry.activeDecision.title}
              </span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">
              {telemetry.activeDecision.prompt}
            </p>
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={() => onDecision('A')}
                className="w-full text-left p-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-amber-400/40 transition-colors"
              >
                <div className="text-sm font-semibold text-white">
                  {telemetry.activeDecision.optionA.label}
                </div>
                <div className="text-xs text-amber-300 mt-0.5">
                  {telemetry.activeDecision.optionA.consequence}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onDecision('B')}
                className="w-full text-left p-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/15 transition-colors"
              >
                <div className="text-sm font-semibold text-white">
                  {telemetry.activeDecision.optionB.label}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {telemetry.activeDecision.optionB.consequence}
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
