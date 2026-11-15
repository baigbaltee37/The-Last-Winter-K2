import { useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Compass,
  Eye,
  Lock,
  Play,
  RotateCcw,
  Settings as SettingsIcon,
  Shield,
  Sliders,
  User,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import {
  BADGES,
  CHARACTERS,
  GEAR_UPGRADE_COSTS,
  LEVELS,
  UNLOCKABLE_OUTFITS,
} from '../game/data';
import {
  CameraMode,
  CharacterProfile,
  GameSettings,
  GearUpgradeLevels,
  GraphicsQuality,
  HudLayoutMode,
  LevelConfig,
  SaveProgress,
  StartingTimePreset,
  TimeOfDayMode,
  TouchControlsMode,
} from '../game/types';

type MenuModal =
  | 'none'
  | 'mountains'
  | 'characters'
  | 'armory'
  | 'records'
  | 'settings'
  | 'guide';

interface MainMenuProps {
  save: SaveProgress;
  settings: GameSettings;
  selectedLevel: LevelConfig;
  selectedCharacter: CharacterProfile;
  onStartNewExpedition: () => void;
  onContinueExpedition: (level: LevelConfig) => void;
  onSelectLevel: (level: LevelConfig) => void;
  onSelectCharacter: (charId: string) => void;
  onUpdateCustomChar: (name: string, suitColor: string) => void;
  onPurchaseUpgrade: (key: keyof GearUpgradeLevels) => void;
  onUnlockOutfit: (outfitId: string) => void;
  onUpdateSettings: (s: GameSettings) => void;
  onResetProgress: () => void;
}

export function MainMenu({
  save,
  settings,
  selectedLevel,
  selectedCharacter,
  onStartNewExpedition,
  onContinueExpedition,
  onSelectLevel,
  onSelectCharacter,
  onUpdateCustomChar,
  onPurchaseUpgrade,
  onUnlockOutfit,
  onUpdateSettings,
  onResetProgress,
}: MainMenuProps) {
  const [modal, setModal] = useState<MenuModal>('none');

  const hasProgress = save.completedLevels.length > 0 || save.highestUnlockedLevel > 1;
  const continueLevel =
    LEVELS.find((l) => l.id === save.highestUnlockedLevel) || LEVELS[0];

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-10 pointer-events-none overflow-y-auto">
      <div className="fixed inset-y-0 left-0 w-full md:w-[560px] bg-gradient-to-r from-[#060910]/96 via-[#060910]/80 to-transparent pointer-events-none" />

      {/* Top Header */}
      <div className="relative z-10 flex items-center justify-between gap-2 pointer-events-auto">
        <div className="text-xs text-slate-300 tracking-wide flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>Story Mode · Legendary Difficulty</span>
          <span className="text-slate-500">·</span>
          <span className="font-mono-num text-amber-300">K2 8,611 m</span>
          <span className="text-slate-500">·</span>
          <span className="font-mono-num text-emerald-300">
            {save.expeditionPoints.toLocaleString()} PTS
          </span>
        </div>

        <button
          type="button"
          onClick={() => setModal('guide')}
          className="px-3 py-1.5 rounded-md bg-[#0b121e]/90 border border-white/15 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-1.5 transition-colors whitespace-nowrap"
        >
          <BookOpen className="w-3.5 h-3.5 text-sky-400" />
          <span>Controls & Manual</span>
        </button>
      </div>

      {/* Main Title & Navigation Stack */}
      <div className="relative z-10 my-auto max-w-md pointer-events-auto py-3">
        <p className="text-xs font-medium text-amber-400 tracking-widest mb-1.5 uppercase">
          Pakistan · Karakoram Winter Expedition · Beyond The Summit
        </p>
        <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight text-white leading-[0.94] mb-2.5">
          THE LAST WINTER K2
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4 max-w-sm">
          Beyond the Summit: climb in first-person or third-person across day, sunset, and moonlit night storms in the 8,611m Karakoram Death Zone.
        </p>

        {/* Active Loadout Summary */}
        <div className="mb-4 pb-3 border-b border-white/10 text-xs text-slate-300 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-white font-medium">{selectedLevel.name}</span>
          <span className="text-slate-500">·</span>
          <span className="font-mono-num text-sky-300">
            {selectedLevel.altitudeStart.toLocaleString()}–{selectedLevel.altitudeEnd.toLocaleString()}m
          </span>
          <span className="text-slate-500">·</span>
          <span>{selectedCharacter.name}</span>
          <span className="text-slate-500">·</span>
          <span className="font-mono-num text-emerald-300">
            {save.expeditionPoints.toLocaleString()} PTS
          </span>
        </div>

        {/* Navigation Buttons */}
        <div className="flex flex-col gap-2 max-w-xs">
          <button
            type="button"
            onClick={() =>
              hasProgress ? onContinueExpedition(selectedLevel) : onStartNewExpedition()
            }
            className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <Play className="w-4 h-4 fill-current" />
              <span>Start Game</span>
            </span>
            <span className="flex items-center gap-1 text-xs font-mono-num">
              <span>{selectedLevel.code}</span>
              <ChevronRight className="w-4 h-4" />
            </span>
          </button>

          {hasProgress && (
            <button
              type="button"
              onClick={onStartNewExpedition}
              className="w-full py-2 px-4 rounded-lg bg-slate-900/95 hover:bg-slate-800 border border-white/15 text-slate-100 font-medium text-sm flex items-center justify-between transition-colors"
            >
              <span>New Game (Stage 1)</span>
              <span className="font-mono-num text-xs text-slate-400">4,200m</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setModal('mountains')}
            className="w-full py-2 px-4 rounded-lg bg-[#0d1522]/90 hover:bg-slate-800 border border-white/12 text-slate-100 text-sm flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <Compass className="w-4 h-4 text-sky-400" />
              <span>Campaign Stages</span>
            </span>
            <span className="font-mono-num text-xs text-slate-400">
              {save.highestUnlockedLevel}/11
            </span>
          </button>

          <button
            type="button"
            onClick={() => setModal('characters')}
            className="w-full py-2 px-4 rounded-lg bg-[#0d1522]/90 hover:bg-slate-800 border border-white/12 text-slate-100 text-sm flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <User className="w-4 h-4 text-amber-400" />
              <span>Character Selection</span>
            </span>
            <span className="text-xs text-slate-400 truncate max-w-[115px]">
              {selectedCharacter.name}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setModal('armory')}
            className="w-full py-2 px-4 rounded-lg bg-[#0d1522]/90 hover:bg-slate-800 border border-white/12 text-slate-100 text-sm flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <Wrench className="w-4 h-4 text-emerald-400" />
              <span>Armory & Upgrades</span>
            </span>
            <span className="font-mono-num text-xs text-emerald-300">
              {save.expeditionPoints.toLocaleString()} PTS
            </span>
          </button>

          <button
            type="button"
            onClick={() => setModal('records')}
            className="w-full py-2 px-4 rounded-lg bg-[#0d1522]/90 hover:bg-slate-800 border border-white/12 text-slate-100 text-sm flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <Award className="w-4 h-4 text-amber-300" />
              <span>Records & Badges</span>
            </span>
            <span className="font-mono-num text-xs text-slate-400">
              {save.completedLevels.length}/11 · {save.unlockedBadges.length}/{BADGES.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setModal('settings')}
            className="w-full py-2 px-4 rounded-lg bg-[#0d1522]/90 hover:bg-slate-800 border border-white/12 text-slate-100 text-sm flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <SettingsIcon className="w-4 h-4 text-slate-300" />
              <span>Settings</span>
            </span>
            <span className="text-xs text-slate-400 capitalize">{settings.graphics}</span>
          </button>
        </div>

        {hasProgress && (
          <p className="mt-2.5 text-xs text-slate-400">
            Next unlocked stage: <span className="text-sky-300">{continueLevel.name}</span>
          </p>
        )}
      </div>

      {/* Footer Note */}
      <div className="relative z-10 text-[11px] text-slate-400 flex items-center gap-3 pointer-events-auto">
        <span>1st & 3rd-Person 3D Mountaineering</span>
        <span>·</span>
        <span>Dynamic Day/Night Cycle · Desktop & Android Touch</span>
      </div>

      {/* MODALS */}
      {modal !== 'none' && (
        <div className="fixed inset-0 z-30 bg-[#05080f]/88 flex items-center justify-center p-4 pointer-events-auto">
          <div className="w-full max-w-3xl max-h-[88vh] bg-[#0b121e] border border-white/15 rounded-xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-white tracking-wide">
                {modal === 'mountains' && 'Story Campaign Stages (1–11)'}
                {modal === 'characters' && 'Select Mountaineer'}
                {modal === 'armory' && 'Base Camp Armory & Gear Upgrades'}
                {modal === 'records' && 'Expedition Records, Badges & Roster'}
                {modal === 'settings' && 'Graphics, Audio, HUD & Controls'}
                {modal === 'guide' && 'Controls & Field Manual'}
              </h2>
              <button
                type="button"
                onClick={() => setModal('none')}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {modal === 'mountains' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {LEVELS.map((lvl) => {
                    const unlocked = lvl.id <= save.highestUnlockedLevel;
                    const completed = save.completedLevels.includes(lvl.id);
                    const isSelected = selectedLevel.id === lvl.id;
                    const best = save.bestTimes[lvl.id];

                    return (
                      <button
                        key={lvl.id}
                        type="button"
                        disabled={!unlocked}
                        onClick={() => {
                          onSelectLevel(lvl);
                          setModal('none');
                        }}
                        className={`text-left p-4 rounded-lg border transition-colors ${
                          !unlocked
                            ? 'bg-slate-900/40 border-white/5 opacity-55 cursor-not-allowed'
                            : isSelected
                              ? 'bg-slate-800/90 border-amber-400'
                              : 'bg-slate-900/80 border-white/10 hover:border-white/30'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                          <span className="font-mono-num">
                            Level {lvl.id} · {lvl.code}
                          </span>
                          {completed ? (
                            <span className="flex items-center gap-1 text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Cleared
                            </span>
                          ) : !unlocked ? (
                            <span className="flex items-center gap-1 text-slate-500">
                              <Lock className="w-3.5 h-3.5" />
                              Locked
                            </span>
                          ) : (
                            <span className="text-amber-300">{lvl.difficultyLabel}</span>
                          )}
                        </div>
                        <div className="text-base font-semibold text-white">{lvl.name}</div>
                        <div className="text-xs text-slate-400 mb-2">{lvl.subtitle}</div>
                        <div className="text-xs text-slate-300 line-clamp-2 mb-2">
                          {lvl.storyBrief}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono-num text-sky-300">
                          <span>
                            {lvl.altitudeStart.toLocaleString()}m → {lvl.altitudeEnd.toLocaleString()}m
                          </span>
                          {best !== undefined && (
                            <>
                              <span className="text-slate-600">·</span>
                              <span className="text-slate-300">
                                Best {Math.floor(best / 60)}m {Math.round(best % 60)}s
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {modal === 'characters' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CHARACTERS.map((c) => {
                      const active = selectedCharacter.id === c.id;
                      const displayName =
                        c.customizable && save.customName ? save.customName : c.name;
                      const displaySuit =
                        c.customizable && save.customSuitColor
                          ? save.customSuitColor
                          : c.suitColor;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => onSelectCharacter(c.id)}
                          className={`text-left p-4 rounded-lg border transition-colors ${
                            active
                              ? 'bg-slate-800/95 border-amber-400'
                              : 'bg-slate-900/75 border-white/10 hover:border-white/25'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="w-4 h-4 rounded-sm border border-white/25 shrink-0"
                                style={{ backgroundColor: displaySuit }}
                              />
                              <span className="text-base font-semibold text-white">
                                {displayName}
                              </span>
                            </div>
                            <span className="text-xs text-amber-300 font-medium">
                              {c.traitLabel}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mb-2">
                            {c.role} · {c.origin}
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{c.bio}</p>
                        </button>
                      );
                    })}
                  </div>

                  {selectedCharacter.customizable && (
                    <div className="p-4 rounded-lg bg-slate-900/90 border border-white/10 space-y-3">
                      <div className="text-sm font-semibold text-white">
                        Customize Alpinist Gear
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1.5">
                            Climber Name
                          </label>
                          <input
                            type="text"
                            maxLength={22}
                            value={save.customName}
                            onChange={(e) =>
                              onUpdateCustomChar(e.target.value, save.customSuitColor)
                            }
                            className="w-full px-3 py-2 rounded-md bg-slate-950 border border-white/15 text-sm text-white focus:outline-none focus:border-amber-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-400 mb-1.5">
                            Unlocked Expedition Suits
                          </label>
                          <div className="flex flex-wrap items-center gap-2">
                            {UNLOCKABLE_OUTFITS.filter((o) =>
                              save.unlockedOutfits.includes(o.id)
                            ).map((swatch) => (
                              <button
                                key={swatch.hex}
                                type="button"
                                title={swatch.label}
                                onClick={() =>
                                  onUpdateCustomChar(save.customName, swatch.hex)
                                }
                                className={`w-8 h-8 rounded-md border-2 transition-transform ${
                                  save.customSuitColor === swatch.hex
                                    ? 'border-white scale-105'
                                    : 'border-white/20'
                                }`}
                                style={{ backgroundColor: swatch.hex }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {modal === 'armory' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between p-3.5 rounded-lg bg-slate-900/85 border border-emerald-400/25">
                    <div>
                      <div className="text-xs text-slate-400">Available Expedition Points</div>
                      <div className="text-xs text-slate-300 mt-0.5">
                        Earn points by clearing stages, surviving QTEs, repelling wildlife, and unlocking badges.
                      </div>
                    </div>
                    <div className="font-mono-num text-2xl font-bold text-emerald-300 shrink-0 pl-4">
                      {save.expeditionPoints.toLocaleString()} PTS
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-white mb-2.5 flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-amber-400" />
                      <span>Expedition Gear Upgrades</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(
                        [
                          {
                            key: 'iceAxes',
                            title: 'Forged Ice Axes',
                            desc: '+14% climb surge & stronger snow predator strike per tier.',
                          },
                          {
                            key: 'parka',
                            title: '8000m Down Parka',
                            desc: '+10% sub-zero thermal insulation & warmer start per tier.',
                          },
                          {
                            key: 'o2Regulator',
                            title: 'High-Flow O2 Regulator',
                            desc: '-10% altitude oxygen consumption rate per tier.',
                          },
                          {
                            key: 'ropeLine',
                            title: 'Dyneema Pro Rope',
                            desc: '+15% anchor stability & reduced rope fray per tier.',
                          },
                        ] as { key: keyof GearUpgradeLevels; title: string; desc: string }[]
                      ).map((item) => {
                        const lvl = save.gearUpgrades[item.key] || 0;
                        const maxed = lvl >= 3;
                        const cost = maxed ? 0 : GEAR_UPGRADE_COSTS[lvl];
                        const canBuy = !maxed && save.expeditionPoints >= cost;

                        return (
                          <div
                            key={item.key}
                            className="p-3.5 rounded-lg bg-slate-900/80 border border-white/10 flex flex-col justify-between gap-3"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold text-white">
                                  {item.title}
                                </span>
                                <span className="font-mono-num text-xs text-sky-300">
                                  Lvl {lvl}/3
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 leading-relaxed">
                                {item.desc}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={!canBuy}
                              onClick={() => onPurchaseUpgrade(item.key)}
                              className={`w-full py-2 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                                maxed
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/25 cursor-default'
                                  : canBuy
                                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                                    : 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
                              }`}
                            >
                              {maxed ? 'MAXED TIER 3' : `Upgrade · ${cost} PTS`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-white mb-2.5 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-sky-400" />
                      <span>Expedition Down Outfits (Custom Alpinist)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {UNLOCKABLE_OUTFITS.map((outfit) => {
                        const unlocked = save.unlockedOutfits.includes(outfit.id);
                        const equipped =
                          save.selectedCharacterId === 'custom_climber' &&
                          save.customSuitColor === outfit.hex;
                        const canUnlock =
                          !unlocked && save.expeditionPoints >= outfit.costPoints;

                        return (
                          <div
                            key={outfit.id}
                            className="p-3 rounded-lg bg-slate-900/80 border border-white/10 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className="w-6 h-6 rounded border border-white/25 shrink-0"
                                style={{ backgroundColor: outfit.hex }}
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-white truncate">
                                  {outfit.label}
                                </div>
                                <div className="text-[11px] font-mono-num text-slate-400">
                                  {unlocked ? 'Owned' : `${outfit.costPoints} PTS`}
                                </div>
                              </div>
                            </div>
                            {unlocked ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectCharacter('custom_climber');
                                  onUpdateCustomChar(save.customName, outfit.hex);
                                }}
                                className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                                  equipped
                                    ? 'bg-sky-500 text-slate-950'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10'
                                }`}
                              >
                                {equipped ? 'Equipped' : 'Equip'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={!canUnlock}
                                onClick={() => onUnlockOutfit(outfit.id)}
                                className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                                  canUnlock
                                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                                    : 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
                                }`}
                              >
                                Unlock
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {modal === 'records' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-4 gap-3 text-center p-3.5 rounded-lg bg-slate-900/80 border border-white/10">
                    <div>
                      <div className="text-[11px] text-slate-400">Stages Cleared</div>
                      <div className="font-mono-num text-xl font-bold text-white">
                        {save.completedLevels.length} / 11
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">K2 Route</div>
                      <div className="text-sm font-semibold text-sky-300 mt-1 capitalize">
                        {save.routeChoice === 'abruzzi' ? 'Abruzzi Spur' : 'Cesen Ridge'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">Attempts</div>
                      <div className="font-mono-num text-xl font-bold text-amber-300">
                        {save.expeditionAttempts}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">Points</div>
                      <div className="font-mono-num text-xl font-bold text-emerald-300">
                        {save.expeditionPoints.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-white mb-2.5 flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-400" />
                      <span>
                        Mountain Badges ({save.unlockedBadges.length} / {BADGES.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {BADGES.map((badge) => {
                        const earned = save.unlockedBadges.includes(badge.id);
                        return (
                          <div
                            key={badge.id}
                            className={`p-3 rounded-lg border ${
                              earned
                                ? 'bg-slate-800/85 border-amber-400/45'
                                : 'bg-slate-900/50 border-white/8 opacity-55'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-semibold text-white">
                                {badge.title}
                              </span>
                              <span
                                className={`font-mono-num text-[11px] font-semibold ${
                                  earned ? 'text-emerald-300' : 'text-slate-400'
                                }`}
                              >
                                +{badge.pointsReward} PTS
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300 leading-snug">
                              {badge.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-white mb-2.5 flex items-center gap-2">
                      <Users className="w-4 h-4 text-sky-400" />
                      <span>Expedition Team Roster</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {save.teamRoster.map((tm) => (
                        <div
                          key={tm.id}
                          className="p-3 rounded-lg bg-slate-900/75 border border-white/10 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-white">{tm.name}</span>
                            <span
                              className={`text-xs font-medium ${
                                tm.status === 'Active' || tm.status === 'Rescued'
                                  ? 'text-emerald-400'
                                  : tm.status === 'Injured'
                                    ? 'text-amber-300'
                                    : 'text-rose-400'
                              }`}
                            >
                              {tm.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">
                            {tm.role} · {tm.origin}
                          </div>
                          <div className="grid grid-cols-4 gap-1 pt-1 text-[11px] font-mono-num text-slate-300">
                            <span>HP {tm.health}%</span>
                            <span>O2 {tm.oxygen}%</span>
                            <span>STM {tm.stamina}%</span>
                            <span>MRL {tm.morale}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {save.decisionsLog.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold text-white mb-2">
                        Campaign Decisions Log
                      </div>
                      <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
                        {save.decisionsLog.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {modal === 'settings' && (
                <div className="space-y-5">
                  <div>
                    <div className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-sky-400" />
                      <span>Graphics Quality (Hardware Auto-Scaling)</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {(['auto', 'low', 'medium', 'high'] as GraphicsQuality[]).map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => onUpdateSettings({ ...settings, graphics: q })}
                          className={`py-2.5 px-3 rounded-lg border text-sm capitalize font-medium transition-colors ${
                            settings.graphics === q
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-slate-900 text-slate-200 border-white/10 hover:bg-slate-800'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-white mb-2">
                      Camera Perspective [T / F5]
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { id: 'third_person', label: 'Third-Person Follow' },
                          { id: 'first_person', label: 'First-Person Helmet' },
                        ] as { id: CameraMode; label: string }[]
                      ).map((cam) => (
                        <button
                          key={cam.id}
                          type="button"
                          onClick={() => onUpdateSettings({ ...settings, cameraMode: cam.id })}
                          className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                            settings.cameraMode === cam.id
                              ? 'bg-sky-500 text-slate-950 border-sky-400'
                              : 'bg-slate-900 text-slate-200 border-white/10 hover:bg-slate-800'
                          }`}
                        >
                          {cam.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-white mb-2">
                      Day & Night Lighting System
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                      {(
                        [
                          { id: 'auto', label: 'Stage Default' },
                          { id: 'day', label: 'Day Mode' },
                          { id: 'night', label: 'Night Mode' },
                          { id: 'dynamic', label: 'Dynamic 24h' },
                        ] as { id: TimeOfDayMode; label: string }[]
                      ).map((tm) => (
                        <button
                          key={tm.id}
                          type="button"
                          onClick={() => onUpdateSettings({ ...settings, timeMode: tm.id })}
                          className={`py-2 px-2.5 rounded-lg border text-xs font-medium transition-colors ${
                            settings.timeMode === tm.id
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-slate-900 text-slate-200 border-white/10 hover:bg-slate-800'
                          }`}
                        >
                          {tm.label}
                        </button>
                      ))}
                    </div>

                    {(settings.timeMode === 'auto' || settings.timeMode === 'dynamic') && (
                      <div>
                        <div className="text-xs text-slate-400 mb-1.5">Starting Time of Day</div>
                        <div className="grid grid-cols-5 gap-1.5">
                          {(
                            [
                              { id: 'expedition', label: 'Stage' },
                              { id: 'sunrise', label: 'Sunrise' },
                              { id: 'midday', label: 'Midday' },
                              { id: 'sunset', label: 'Sunset' },
                              { id: 'midnight', label: 'Night' },
                            ] as { id: StartingTimePreset; label: string }[]
                          ).map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() =>
                                onUpdateSettings({ ...settings, startTimePreset: preset.id })
                              }
                              className={`py-1.5 px-2 rounded-md border text-[11px] font-medium transition-colors ${
                                settings.startTimePreset === preset.id
                                  ? 'bg-sky-500 text-slate-950 border-sky-400'
                                  : 'bg-slate-900 text-slate-300 border-white/10 hover:bg-slate-800'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                      <Eye className="w-4 h-4 text-sky-400" />
                      <span>In-Game HUD Density [H]</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['full', 'compact', 'hidden'] as HudLayoutMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => onUpdateSettings({ ...settings, hudMode: mode })}
                          className={`py-2 px-3 rounded-lg border text-xs capitalize font-medium transition-colors ${
                            settings.hudMode === mode
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-slate-900 text-slate-200 border-white/10 hover:bg-slate-800'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm text-white mb-1.5">
                      <span>Master Audio Volume</span>
                      <span className="font-mono-num text-slate-300">
                        {Math.round(settings.masterVolume * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={settings.masterVolume}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          masterVolume: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-amber-400"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm text-white mb-1.5">
                      <span>Camera Look Sensitivity</span>
                      <span className="font-mono-num text-slate-300">
                        {settings.cameraSensitivity.toFixed(1)}×
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.4}
                      max={2.0}
                      step={0.1}
                      value={settings.cameraSensitivity}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          cameraSensitivity: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-amber-400"
                    />
                  </div>

                  <div>
                    <div className="text-sm font-medium text-white mb-2">
                      Android Touch Controls Overlay
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['auto', 'always', 'off'] as TouchControlsMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() =>
                            onUpdateSettings({ ...settings, touchControls: mode })
                          }
                          className={`py-2 px-3 rounded-lg border text-xs capitalize font-medium transition-colors ${
                            settings.touchControls === mode
                              ? 'bg-sky-500 text-slate-950 border-sky-400'
                              : 'bg-slate-900 text-slate-200 border-white/10 hover:bg-slate-800'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.invertY}
                          onChange={(e) =>
                            onUpdateSettings({ ...settings, invertY: e.target.checked })
                          }
                          className="accent-amber-400 w-4 h-4"
                        />
                        <span>Invert Camera Vertical Axis</span>
                      </label>
                      <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.voiceOver}
                          onChange={(e) =>
                            onUpdateSettings({ ...settings, voiceOver: e.target.checked })
                          }
                          className="accent-amber-400 w-4 h-4"
                        />
                        <span>Cutscene Voice-Over Narration</span>
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onResetProgress();
                        setModal('none');
                      }}
                      className="px-3 py-1.5 rounded-md border border-rose-500/40 text-xs text-rose-300 hover:bg-rose-950/50 flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Expedition Save</span>
                    </button>
                  </div>
                </div>
              )}

              {modal === 'guide' && (
                <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
                  <div>
                    <h3 className="text-base font-semibold text-white mb-1.5">
                      1. PC Keyboard & Mouse Controls
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-900/75 p-3 rounded-lg border border-white/10">
                      <div><strong>WASD / Arrows:</strong> Move & Traverse</div>
                      <div><strong>Mouse Drag / Wheel:</strong> Orbit Camera & Zoom</div>
                      <div><strong>Shift:</strong> Sprint</div>
                      <div><strong>Space:</strong> Jump Crevasses</div>
                      <div><strong>C / Ctrl:</strong> Crouch / Cover / Balance</div>
                      <div><strong>V:</strong> Ice Wall Climb Mode</div>
                      <div><strong>Q / F:</strong> Left & Right Ice Axes / Defense</div>
                      <div><strong>E:</strong> Interact / Rescue / Repair</div>
                      <div><strong>X:</strong> Shove Debris Obstacle</div>
                      <div><strong>R / Shift+R:</strong> Rig / Pull Climbing Rope</div>
                      <div><strong>T / F5:</strong> Switch 1st-Person / 3rd-Person</div>
                      <div><strong>1 – 6:</strong> O2, Ration, Lamp, Water, Meds, Flare</div>
                      <div><strong>I / M / H / Esc:</strong> Pack / Map / HUD Mode / Pause</div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-1">
                      2. Android Landscape Touch Controls
                    </h3>
                    <p>
                      Use the lower-left <strong>Virtual Joystick</strong> to move, swipe upper screen space to rotate the third-person camera, and use the lower-right tactile pads for <strong>Axe L/R, Jump, Sprint, Crouch, Climb, Rope, Interact, Push, and Flare</strong>. Quick <strong>Pack</strong> and <strong>Map</strong> buttons sit above the left joystick.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-1">
                      3. Survival Systems & Offline Storage
                    </h3>
                    <p>
                      Progress, gear upgrades, unlocked outfits, and Expedition Pack inventory persist automatically across web sessions (`localStorage` + `IndexedDB`) and native Capacitor Android builds.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
