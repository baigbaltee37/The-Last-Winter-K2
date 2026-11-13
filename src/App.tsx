import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CutsceneOverlay } from './components/CutsceneOverlay';
import { GameOverModal, LevelCompleteModal, PauseModal } from './components/EndScreens';
import { GameHUD } from './components/GameHUD';
import { MainMenu } from './components/MainMenu';
import { TouchControls } from './components/TouchControls';
import { audioEngine } from './game/audio';
import {
  CHARACTERS,
  createInitialEquipment,
  DEFAULT_SAVE,
  DEFAULT_SETTINGS,
  GEAR_UPGRADE_COSTS,
  INITIAL_TEAM_ROSTER,
  LEVELS,
  UNLOCKABLE_OUTFITS,
} from './game/data';
import { MountainEngine, PlayerInputState } from './game/MountainEngine';
import {
  CharacterProfile,
  CutsceneBeat,
  GameScreen,
  GameSettings,
  GameTelemetry,
  GearUpgradeLevels,
  LevelConfig,
  SaveProgress,
} from './game/types';

const SAVE_KEY = 'last_winter_k2_sim_save_v3';
const SETTINGS_KEY = 'last_winter_k2_sim_settings_v3';

function loadSave(): SaveProgress {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return DEFAULT_SAVE;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SAVE,
      ...parsed,
      teamRoster: parsed.teamRoster || INITIAL_TEAM_ROSTER,
      gearUpgrades: {
        ...DEFAULT_SAVE.gearUpgrades,
        ...(parsed.gearUpgrades || {}),
      },
      unlockedBadges: parsed.unlockedBadges || [],
      unlockedOutfits: parsed.unlockedOutfits || DEFAULT_SAVE.unlockedOutfits,
      expeditionPoints: parsed.expeditionPoints ?? 0,
    };
  } catch {
    return DEFAULT_SAVE;
  }
}

function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const INITIAL_TELEMETRY: GameTelemetry = {
  health: 100,
  oxygen: 100,
  stamina: 100,
  gripStrength: 100,
  gearIntegrity: 100,
  temperature: 86,
  coreTempC: 36.2,
  hunger: 90,
  thirst: 90,
  fatigue: 8,
  headacheSeverity: 0,
  headlampBattery: 100,
  packWeightKg: 18.8,
  balance: 0,
  altitude: 4200,
  altitudeProgress: 0,
  terrainSurface: 'Rocky Alpine Trail',
  weather: 'overcast',
  windSpeedKmh: 32,
  ambientTempC: -12,
  timeOfDayLabel: 'Alpine Dawn',
  isNight: false,
  headlampOn: false,
  isClimbing: false,
  isCrouching: false,
  isSprinting: false,
  onNarrowRidge: false,
  inDeepSnow: false,
  inWaterCurrent: false,
  floodWaterLevel: 0.35,
  nearAnchorSpot: false,
  anchorSpotQuality: 'none',
  ropeRigState: 'none',
  anchorStability: 100,
  ropeTension: 0,
  ropeDistanceM: 0,
  insideShelter: false,
  nearCampfire: false,
  carryingTeammate: false,
  wildlifeNearby: false,
  wildlifeThreatDist: 99,
  flareActive: false,
  helicopterInbound: false,
  radioSignalStrength: 0,
  frostbiteRisk: false,
  hypothermiaRisk: false,
  altitudeSicknessRisk: false,
  avalancheWarning: false,
  rockfallWarning: false,
  floodWarning: false,
  landslideWarning: false,
  elapsedTime: 0,
  distanceToCheckpoint: 520,
  compassHeadingDeg: 0,
  gpsCoords: '35.8800°N 76.5130°E',
  interactPrompt: null,
  statusBanner: null,
  missionNotification: null,
  activeDecision: null,
  activeQte: null,
  timedEscape: null,
  sessionPoints: 0,
  newlyEarnedBadges: [],
  variationLabel: 'Route Pattern A',
  equipment: createInitialEquipment(1),
  missions: [],
  playerPos: { x: 0, z: 0, yaw: 0 },
  mapPoints: [],
  ridgeLength: 520,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<MountainEngine | null>(null);
  const inputFallbackRef = useRef<PlayerInputState>({
    moveX: 0,
    moveY: 0,
    sprint: false,
    climb: false,
    crouch: false,
    jumpQueued: false,
    interactQueued: false,
    axeLeftQueued: false,
    axeRightQueued: false,
    ropeQueued: false,
    recoverRopeQueued: false,
    pushQueued: false,
  });

  const [save, setSave] = useState<SaveProgress>(loadSave);
  const [settings, setSettings] = useState<GameSettings>(loadSettings);
  const [selectedLevelId, setSelectedLevelId] = useState<number>(
    () => loadSave().highestUnlockedLevel || 1
  );
  const [screen, setScreen] = useState<GameScreen>('menu');
  const [telemetry, setTelemetry] = useState<GameTelemetry>(INITIAL_TELEMETRY);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const screenRef = useRef<GameScreen>(screen);
  screenRef.current = screen;

  const selectedLevel = useMemo(
    () => LEVELS.find((l) => l.id === selectedLevelId) || LEVELS[0],
    [selectedLevelId]
  );

  const selectedCharacter = useMemo<CharacterProfile>(() => {
    const base = CHARACTERS.find((c) => c.id === save.selectedCharacterId) || CHARACTERS[0];
    if (base.customizable) {
      return {
        ...base,
        name: save.customName || base.name,
        suitColor: save.customSuitColor || base.suitColor,
      };
    }
    return base;
  }, [save.selectedCharacterId, save.customName, save.customSuitColor]);

  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch {
      // ignore
    }
  }, [save]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  useEffect(() => {
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(hasTouch);
  }, []);

  const handleLevelComplete = useCallback(
    (finalTelemetry: GameTelemetry) => {
      setTelemetry(finalTelemetry);
      setScreen('level_complete');

      setSave((prev) => {
        const lvlId = selectedLevel.id;
        const completed = prev.completedLevels.includes(lvlId)
          ? prev.completedLevels
          : [...prev.completedLevels, lvlId];
        const nextUnlocked = Math.min(
          LEVELS.length,
          Math.max(prev.highestUnlockedLevel, lvlId + 1)
        );
        const prevBest = prev.bestTimes[lvlId];
        const bestTimes = {
          ...prev.bestTimes,
          [lvlId]:
            prevBest === undefined
              ? finalTelemetry.elapsedTime
              : Math.min(prevBest, finalTelemetry.elapsedTime),
        };
        const updatedRoster = prev.teamRoster.map((tm) => ({
          ...tm,
          stamina: Math.max(55, tm.stamina - 4),
          oxygen: Math.max(60, tm.oxygen - 3),
        }));
        const mergedBadges = Array.from(
          new Set([...prev.unlockedBadges, ...(finalTelemetry.newlyEarnedBadges || [])])
        );
        return {
          ...prev,
          completedLevels: completed,
          highestUnlockedLevel: nextUnlocked,
          bestTimes,
          teamRoster: updatedRoster,
          expeditionPoints: prev.expeditionPoints + (finalTelemetry.sessionPoints || 0),
          unlockedBadges: mergedBadges,
        };
      });
    },
    [selectedLevel.id]
  );

  const handleGameOver = useCallback((finalTelemetry: GameTelemetry) => {
    setTelemetry(finalTelemetry);
    setScreen('game_over');
  }, []);

  const completeCbRef = useRef(handleLevelComplete);
  completeCbRef.current = handleLevelComplete;
  const gameOverCbRef = useRef(handleGameOver);
  gameOverCbRef.current = handleGameOver;

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new MountainEngine(
      mount,
      settings,
      selectedLevel,
      selectedCharacter,
      {
        onTelemetry: (t) => setTelemetry(t),
        onLevelComplete: (t) => completeCbRef.current(t),
        onGameOver: (t) => gameOverCbRef.current(t),
      },
      save.routeChoice,
      save.gearUpgrades
    );
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.updateSettings(settings);
  }, [settings]);

  // Keyboard Controls
  useEffect(() => {
    const pressed = new Set<string>();

    const syncMovement = () => {
      const engine = engineRef.current;
      if (!engine) return;
      let mx = 0;
      let my = 0;
      if (pressed.has('KeyW') || pressed.has('ArrowUp')) my += 1;
      if (pressed.has('KeyS') || pressed.has('ArrowDown')) my -= 1;
      if (pressed.has('KeyD') || pressed.has('ArrowRight')) mx += 1;
      if (pressed.has('KeyA') || pressed.has('ArrowLeft')) mx -= 1;
      engine.input.moveX = mx;
      engine.input.moveY = my;
      engine.input.sprint = pressed.has('ShiftLeft') || pressed.has('ShiftRight');
      engine.input.climb = pressed.has('KeyC');
      engine.input.crouch = pressed.has('KeyV') || pressed.has('ControlLeft');
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (screenRef.current === 'playing') {
          engineRef.current?.setMode('paused');
          setScreen('paused');
        } else if (screenRef.current === 'paused') {
          engineRef.current?.setMode('playing');
          setScreen('playing');
        }
        return;
      }

      if (screenRef.current !== 'playing') return;

      pressed.add(e.code);
      syncMovement();

      if (e.code === 'Space') {
        e.preventDefault();
        engineRef.current?.triggerJump();
      } else if (e.code === 'KeyQ') {
        engineRef.current?.triggerLeftIceAxe();
      } else if (e.code === 'KeyE') {
        engineRef.current?.triggerRightIceAxe();
      } else if (e.code === 'KeyR') {
        if (e.shiftKey) engineRef.current?.triggerRecoverRope();
        else engineRef.current?.triggerRopeStep();
      } else if (e.code === 'KeyF') {
        engineRef.current?.triggerInteract();
      } else if (e.code === 'KeyX') {
        engineRef.current?.triggerPushObstacle();
      } else if (e.code === 'Digit1') {
        engineRef.current?.useEquipment('oxygen');
      } else if (e.code === 'Digit2') {
        engineRef.current?.useEquipment('food');
      } else if (e.code === 'Digit3') {
        engineRef.current?.toggleHeadlamp();
      } else if (e.code === 'Digit4') {
        engineRef.current?.useEquipment('water');
      } else if (e.code === 'Digit5') {
        engineRef.current?.useEquipment('first_aid');
      } else if (e.code === 'Digit6') {
        engineRef.current?.useEquipment('flare');
      } else if (e.code === 'Equal') {
        engineRef.current?.adjustZoom(-1.0);
      } else if (e.code === 'Minus') {
        engineRef.current?.adjustZoom(1.0);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      pressed.delete(e.code);
      syncMovement();
    };

    const onBlur = () => {
      pressed.clear();
      syncMovement();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const launchStage = (
    level: LevelConfig,
    withCutscene: boolean,
    charOverride?: CharacterProfile,
    upgradesOverride?: GearUpgradeLevels
  ) => {
    audioEngine.init();
    setSelectedLevelId(level.id);
    setSave((prev) => ({
      ...prev,
      expeditionAttempts: prev.expeditionAttempts + 1,
    }));
    const startMode = withCutscene && level.cutscene.length > 0 ? 'cutscene' : 'playing';
    engineRef.current?.loadExpedition(
      level,
      charOverride || selectedCharacter,
      startMode,
      save.routeChoice,
      upgradesOverride || save.gearUpgrades
    );
    setScreen(startMode);
  };

  const handleDecision = (choice: 'A' | 'B') => {
    const decision = telemetry.activeDecision;
    if (!decision) return;
    const picked = choice === 'A' ? decision.optionA : decision.optionB;

    engineRef.current?.resolveDecision(choice);

    setSave((prev) => {
      let nextRoster = [...prev.teamRoster];
      let nextRoute = prev.routeChoice;

      if (picked.effect === 'rescue_sacrifice') {
        nextRoster = nextRoster.map((tm) =>
          tm.id === 'hussain'
            ? { ...tm, status: 'Rescued', health: 78, morale: 100 }
            : { ...tm, morale: Math.min(100, tm.morale + 10) }
        );
      } else if (picked.effect === 'push_solo') {
        nextRoster = nextRoster.map((tm) =>
          tm.id === 'hussain'
            ? { ...tm, status: 'Injured', health: 32, morale: 45 }
            : { ...tm, morale: Math.max(20, tm.morale - 15) }
        );
      } else if (picked.effect === 'route_abruzzi') {
        nextRoute = 'abruzzi';
      } else if (picked.effect === 'route_cesen') {
        nextRoute = 'cesen';
      }

      return {
        ...prev,
        routeChoice: nextRoute,
        teamRoster: nextRoster,
        decisionsLog: [...prev.decisionsLog, `${selectedLevel.code}: ${picked.label}`],
      };
    });
  };

  const handleCutsceneBeat = useCallback((preset: CutsceneBeat['cameraPreset']) => {
    engineRef.current?.setCutscenePreset(preset);
  }, []);

  const handleFinishCutscene = useCallback(() => {
    engineRef.current?.setMode('playing');
    setScreen('playing');
  }, []);

  const previewInMenu = (level: LevelConfig, char: CharacterProfile) => {
    engineRef.current?.loadExpedition(
      level,
      char,
      'menu',
      save.routeChoice,
      save.gearUpgrades
    );
  };

  const handlePurchaseUpgrade = (key: keyof GearUpgradeLevels) => {
    setSave((prev) => {
      const currentLvl = prev.gearUpgrades[key] || 0;
      if (currentLvl >= 3) return prev;
      const cost = GEAR_UPGRADE_COSTS[currentLvl];
      if (prev.expeditionPoints < cost) return prev;
      return {
        ...prev,
        expeditionPoints: prev.expeditionPoints - cost,
        gearUpgrades: {
          ...prev.gearUpgrades,
          [key]: currentLvl + 1,
        },
      };
    });
  };

  const handleUnlockOutfit = (outfitId: string) => {
    const outfit = UNLOCKABLE_OUTFITS.find((o) => o.id === outfitId);
    if (!outfit) return;
    setSave((prev) => {
      if (prev.unlockedOutfits.includes(outfitId)) return prev;
      if (prev.expeditionPoints < outfit.costPoints) return prev;
      const base = CHARACTERS.find((c) => c.id === 'custom_climber')!;
      previewInMenu(selectedLevel, {
        ...base,
        name: prev.customName,
        suitColor: outfit.hex,
      });
      return {
        ...prev,
        expeditionPoints: prev.expeditionPoints - outfit.costPoints,
        unlockedOutfits: [...prev.unlockedOutfits, outfitId],
        selectedCharacterId: 'custom_climber',
        customSuitColor: outfit.hex,
      };
    });
  };

  const showTouchControls =
    settings.touchControls === 'always' ||
    (settings.touchControls === 'auto' && isTouchDevice);

  const engineInputRef = useRef<PlayerInputState>(inputFallbackRef.current);
  if (engineRef.current) {
    engineInputRef.current = engineRef.current.input;
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#070d18]">
      <div ref={canvasMountRef} className="fixed inset-0 z-0" />

      {screen === 'menu' && (
        <MainMenu
          save={save}
          settings={settings}
          selectedLevel={selectedLevel}
          selectedCharacter={selectedCharacter}
          onStartNewExpedition={() => {
            setSave((prev) => ({
              ...DEFAULT_SAVE,
              selectedCharacterId: prev.selectedCharacterId,
              customName: prev.customName,
              customSuitColor: prev.customSuitColor,
              expeditionPoints: prev.expeditionPoints,
              unlockedBadges: prev.unlockedBadges,
              unlockedOutfits: prev.unlockedOutfits,
              gearUpgrades: prev.gearUpgrades,
            }));
            launchStage(LEVELS[0], true, selectedCharacter, save.gearUpgrades);
          }}
          onContinueExpedition={(lvl) => launchStage(lvl, true)}
          onSelectLevel={(lvl) => {
            setSelectedLevelId(lvl.id);
            previewInMenu(lvl, selectedCharacter);
          }}
          onSelectCharacter={(charId) => {
            setSave((prev) => ({ ...prev, selectedCharacterId: charId }));
            const nextChar = CHARACTERS.find((c) => c.id === charId) || CHARACTERS[0];
            const resolved = nextChar.customizable
              ? { ...nextChar, name: save.customName, suitColor: save.customSuitColor }
              : nextChar;
            previewInMenu(selectedLevel, resolved);
          }}
          onUpdateCustomChar={(name, suitColor) => {
            setSave((prev) => ({ ...prev, customName: name, customSuitColor: suitColor }));
            const base = CHARACTERS.find((c) => c.id === 'custom_climber')!;
            previewInMenu(selectedLevel, { ...base, name, suitColor });
          }}
          onPurchaseUpgrade={handlePurchaseUpgrade}
          onUnlockOutfit={handleUnlockOutfit}
          onUpdateSettings={(s) => setSettings(s)}
          onResetProgress={() => {
            setSave(DEFAULT_SAVE);
            setSelectedLevelId(1);
            engineRef.current?.loadExpedition(
              LEVELS[0],
              CHARACTERS[0],
              'menu',
              DEFAULT_SAVE.routeChoice,
              DEFAULT_SAVE.gearUpgrades
            );
          }}
        />
      )}

      {screen === 'cutscene' && (
        <CutsceneOverlay
          level={selectedLevel}
          voiceOver={settings.voiceOver}
          onBeatChange={handleCutsceneBeat}
          onFinish={handleFinishCutscene}
        />
      )}

      {screen === 'playing' && (
        <>
          <GameHUD
            telemetry={telemetry}
            level={selectedLevel}
            onPause={() => {
              engineRef.current?.setMode('paused');
              setScreen('paused');
            }}
            onUseEquipment={(id) => engineRef.current?.useEquipment(id)}
            onRepairGear={() => engineRef.current?.repairGear()}
            onToggleHeadlamp={() => engineRef.current?.toggleHeadlamp()}
            onRopeStep={() => engineRef.current?.triggerRopeStep()}
            onRecoverRope={() => engineRef.current?.triggerRecoverRope()}
            onPushObstacle={() => engineRef.current?.triggerPushObstacle()}
            onQteAction={() => engineRef.current?.triggerQteResponse()}
            onDecision={handleDecision}
            showTouchControls={showTouchControls}
          />
          {showTouchControls && (
            <TouchControls
              inputRef={engineInputRef}
              onJump={() => engineRef.current?.triggerJump()}
              onInteract={() => engineRef.current?.triggerInteract()}
              onLeftAxe={() => engineRef.current?.triggerLeftIceAxe()}
              onRightAxe={() => engineRef.current?.triggerRightIceAxe()}
              onRopeStep={() => engineRef.current?.triggerRopeStep()}
              onRecoverRope={() => engineRef.current?.triggerRecoverRope()}
              onFlare={() => engineRef.current?.useEquipment('flare')}
              onPushObstacle={() => engineRef.current?.triggerPushObstacle()}
              onZoom={(d) => engineRef.current?.adjustZoom(d)}
              isClimbing={telemetry.isClimbing}
              isCrouching={telemetry.isCrouching}
              isSprinting={telemetry.isSprinting}
              ropeRigState={telemetry.ropeRigState}
              nearAnchorSpot={telemetry.nearAnchorSpot}
              hasInteractPrompt={Boolean(telemetry.interactPrompt)}
              activeQte={telemetry.activeQte}
              onQteTap={() => engineRef.current?.triggerQteResponse()}
            />
          )}
        </>
      )}

      {screen === 'paused' && !telemetry.activeDecision && (
        <PauseModal
          level={selectedLevel}
          telemetry={telemetry}
          onResume={() => {
            engineRef.current?.setMode('playing');
            setScreen('playing');
          }}
          onRestart={() => launchStage(selectedLevel, false)}
          onExitMenu={() => {
            audioEngine.stopSpeech();
            previewInMenu(selectedLevel, selectedCharacter);
            setScreen('menu');
          }}
        />
      )}

      {screen === 'level_complete' && (
        <LevelCompleteModal
          level={selectedLevel}
          telemetry={telemetry}
          onNextLevel={(next) => launchStage(next, true)}
          onReplay={() => launchStage(selectedLevel, false)}
          onExitMenu={() => {
            previewInMenu(selectedLevel, selectedCharacter);
            setScreen('menu');
          }}
        />
      )}

      {screen === 'game_over' && (
        <GameOverModal
          level={selectedLevel}
          telemetry={telemetry}
          onRetry={() => launchStage(selectedLevel, false)}
          onExitMenu={() => {
            previewInMenu(selectedLevel, selectedCharacter);
            setScreen('menu');
          }}
        />
      )}
    </div>
  );
}
