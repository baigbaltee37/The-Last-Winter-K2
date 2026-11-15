import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { audioEngine } from './audio';
import { createInitialEquipment } from './data';
import { AlpineTextures, createAlpineTextures } from './materials';
import {
  createAnchorModel,
  createAnchorSlotMarker,
  createAvalancheWallModel,
  createBeaconModel,
  createCampfireModel,
  createCoverBoulderModel,
  createEmergencyShelterModel,
  createFirstPersonRig,
  createFlareEffectModel,
  createHelicopterModel,
  createIceCaveModel,
  createLadderModel,
  createMountaineerModel,
  createMovableObstacleModel,
  createPineTreeModel,
  createSafetyPitonModel,
  createSnowBridgeModel,
  createStrandedClimberModel,
  createSupplyCacheModel,
  createTentCampModel,
  createWildlifeModel,
  FirstPersonRig,
  HelicopterRig,
  MountaineerRig,
  WildlifeRig,
} from './models';
import { AnchorSlot, KarakoramTerrain } from './terrain';
import {
  ActiveQteEvent,
  CameraMode,
  CharacterProfile,
  CutsceneBeat,
  EquipmentItem,
  GameSettings,
  GameTelemetry,
  GearUpgradeLevels,
  LevelConfig,
  MiniMapPoint,
  MissionStep,
  RopeRigState,
  RouteChoice,
  StartingTimePreset,
  StoryDecision,
  TimedEscapeState,
  TimeOfDayMode,
  WeatherType,
} from './types';

export interface PlayerInputState {
  moveX: number;
  moveY: number;
  sprint: boolean;
  climb: boolean;
  crouch: boolean;
  jumpQueued: boolean;
  interactQueued: boolean;
  axeLeftQueued: boolean;
  axeRightQueued: boolean;
  ropeQueued: boolean;
  recoverRopeQueued: boolean;
  pushQueued: boolean;
}

interface InteractiveProp {
  id: string;
  type: 'o2' | 'ration' | 'anchor' | 'npc' | 'shelter' | 'midcamp' | 'checkpoint' | 'helipad';
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  active: boolean;
  extraMesh?: THREE.Mesh;
}

interface WildlifeRuntime {
  rig: WildlifeRig;
  pos: THREE.Vector3;
  homePos: THREE.Vector3;
  hp: number;
  repelled: boolean;
  attackCooldown: number;
  fleeTimer: number;
  growlCooldown: number;
}

interface MovableObstacleRuntime {
  id: string;
  mesh: THREE.Group;
  pos: THREE.Vector3;
  cleared: boolean;
  targetX: number;
}

interface SnowBridgeRuntime {
  index: number;
  mesh: THREE.Group;
  triggered: boolean;
  timer: number;
  collapsed: boolean;
}

interface HazardBoulder {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  active: boolean;
  kind: 'avalanche' | 'ice' | 'rock';
}

interface RiverRuntime {
  zCenter: number;
  halfWidthZ: number;
  bedHeight: number;
  mesh: THREE.Mesh;
}

// Zero-GC scratchpads
const _vec3 = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _skyColor = new THREE.Color();
const _fogColor = new THREE.Color();
const _sunColor = new THREE.Color();
const _dummy = new THREE.Object3D();

export class MountainEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private textures: AlpineTextures;

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;
  private headlampLight: THREE.SpotLight;
  private fog: THREE.FogExp2;

  private worldGroup = new THREE.Group();
  private skyDome: THREE.Mesh | null = null;
  private skyUniforms = {
    uZenithColor: { value: new THREE.Color(0x1f3d66) },
    uHorizonColor: { value: new THREE.Color(0x8bb2d6) },
    uSunColor: { value: new THREE.Color(0xfff1d6) },
    uSunDir: { value: new THREE.Vector3(0.4, 0.7, -0.5).normalize() },
    uMoonDir: { value: new THREE.Vector3(-0.4, 0.55, -0.6).normalize() },
    uDayFactor: { value: 0.9 },
    uSunsetFactor: { value: 0.0 },
    uNightFactor: { value: 0.1 },
    uCloudDensity: { value: 0.35 },
    uTime: { value: 0 },
    uLightning: { value: 0 },
  };
  private starField: THREE.Points | null = null;
  private snowParticles: THREE.Points | null = null;
  private snowPositions: Float32Array | null = null;
  private snowVelocities: Float32Array | null = null;
  private snowCount = 0;

  private terrain: KarakoramTerrain | null = null;
  private terrainMat: THREE.MeshStandardMaterial | null = null;
  private playerRig: MountaineerRig | null = null;
  private firstPersonRig: FirstPersonRig | null = null;
  private cameraMode: CameraMode = 'third_person';
  private props: InteractiveProp[] = [];
  private bridges: SnowBridgeRuntime[] = [];
  private boulders: HazardBoulder[] = [];
  private rivers: RiverRuntime[] = [];
  private coverBoulders: THREE.Vector3[] = [];
  private solidColliders: { x: number; z: number; radius: number }[] = [];
  private wildlifeList: WildlifeRuntime[] = [];
  private obstacles: MovableObstacleRuntime[] = [];
  private beaconFlag: THREE.Mesh | null = null;
  private beaconRing: THREE.Mesh | null = null;

  // Action-Adventure Rescue, Flare & Avalanche Wall
  private heliRig: HelicopterRig | null = null;
  private helipadPos: THREE.Vector3 | null = null;
  private helicopterInbound = false;
  private heliHeight = 36;
  private heliRescued = false;
  private flareRig: { group: THREE.Group; light: THREE.PointLight; flame: THREE.Mesh } | null = null;
  private flareTimer = 0;
  private flarePos = new THREE.Vector3();
  private carriedNpcMesh: THREE.Group | null = null;
  private carryingTeammate = false;
  private avalancheWallMesh: THREE.Group | null = null;
  private avalancheWallZ = 0;
  private avalancheStarted = false;

  // Manual Rope & Anchor Rig
  private ropeRigState: RopeRigState = 'none';
  private anchorPos: THREE.Vector3 | null = null;
  private anchorMesh: THREE.Group | null = null;
  private anchorStability = 100;
  private ropeTension = 0;
  private tetherLine: THREE.Line | null = null;

  // Bivy tent deployed by player
  private pitchedTentPos: THREE.Vector3 | null = null;
  private pitchedTentMesh: THREE.Group | null = null;

  private level!: LevelConfig;
  private character!: CharacterProfile;
  private routeChoice: RouteChoice = 'abruzzi';
  private gearUpgrades: GearUpgradeLevels = { iceAxes: 0, parka: 0, o2Regulator: 0, ropeLine: 0 };
  private variationSeed = 0;
  private variationLabel = 'Route Pattern A';
  private settings: GameSettings;

  private onTelemetry: (t: GameTelemetry) => void;
  private onLevelComplete: (t: GameTelemetry) => void;
  private onGameOver: (t: GameTelemetry) => void;
  private onProgressSync?: (data: {
    levelId: number;
    completedMissionIds: string[];
    inventory: Record<string, { quantity: number; durability: number }>;
  }) => void;

  private frameId = 0;
  private softwareTimerId = 0;
  private disposed = false;
  private clock = new THREE.Clock();
  private mode: 'menu' | 'cutscene' | 'playing' | 'paused' = 'menu';
  private cutscenePreset: CutsceneBeat['cameraPreset'] = 'aerial_k2';
  private lastHudPush = 0;

  // Player physics & camera
  private playerPos = new THREE.Vector3(0, 0, 0);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private playerYaw = 0;
  private cameraYaw = 0;
  private cameraPitch = 0.11;
  private cameraZoom = 6.2;
  private grounded = true;
  private stepTimer = 0;
  private climbSoundTimer = 0;
  private safeReturnPos = new THREE.Vector3(0, 0, 0);

  // Dual ice-axe swing state
  private lastAxeSide: 'left' | 'right' | null = null;
  private leftAxeSwingTimer = 0;
  private rightAxeSwingTimer = 0;

  public input: PlayerInputState = {
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
  };

  // Hardcore survival & equipment state
  private health = 100;
  private oxygen = 100;
  private stamina = 100;
  private gripStrength = 100;
  private temperature = 88;
  private hunger = 90;
  private thirst = 90;
  private fatigue = 8;
  private headacheSeverity = 0;
  private headlampBattery = 100;
  private balance = 0;
  private equipment: EquipmentItem[] = [];
  private headlampOn = false;

  // Environment / Hazards / Action Events state
  private elapsedTime = 0;
  private timeOfDay = 0.34;
  private visibilityMeters = 420;
  private nightHintShown = false;
  private weatherIndex = 0;
  private weatherTimer = 0;
  private avalancheTimer = 18;
  private fallingIceTimer = 9;
  private rockfallTimer = 6;
  private rockfallWarningTimer = 0;
  private avalancheActiveTimer = 0;
  private landslideWarningTimer = 0;
  private lightningTimer = 11;
  private lightningFlash = 0;
  private floodWaterLevel = 0.35;
  private shelterTimer = 0;
  private statusBanner: string | null = null;
  private statusBannerTimer = 0;
  private missionNotification: { title: string; subtitle: string } | null = null;
  private missionNotificationTimer = 0;
  private missions: MissionStep[] = [];
  private o2CollectedCount = 0;
  private activeDecision: StoryDecision | null = null;
  private decisionTriggered = false;
  private activeQte: ActiveQteEvent | null = null;
  private timedEscape: TimedEscapeState | null = null;
  private ropeBreakTriggered = false;
  private iceCaveCollapseTriggered = false;
  private glacierCollapseTriggered = false;
  private bossWaveTimer = 15;
  private dynamicSurpriseTimer = 38;
  private radioSignalStrength = 0;
  private sessionPoints = 0;
  private newlyEarnedBadges: string[] = [];

  // Pointer drag look
  private draggingLook = false;
  private activePointerId: number | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;

  constructor(
    container: HTMLElement,
    initialSettings: GameSettings,
    initialLevel: LevelConfig,
    initialChar: CharacterProfile,
    callbacks: {
      onTelemetry: (t: GameTelemetry) => void;
      onLevelComplete: (t: GameTelemetry) => void;
      onGameOver: (t: GameTelemetry) => void;
      onProgressSync?: (data: {
        levelId: number;
        completedMissionIds: string[];
        inventory: Record<string, { quantity: number; durability: number }>;
      }) => void;
    },
    initialRoute: RouteChoice = 'abruzzi',
    initialGearUpgrades: GearUpgradeLevels = { iceAxes: 0, parka: 0, o2Regulator: 0, ropeLine: 0 },
    initialSavedInventory?: Record<string, { quantity: number; durability: number }>
  ) {
    this.container = container;
    this.settings = initialSettings;
    this.onTelemetry = callbacks.onTelemetry;
    this.onLevelComplete = callbacks.onLevelComplete;
    this.onGameOver = callbacks.onGameOver;
    this.onProgressSync = callbacks.onProgressSync;

    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const effectiveInitQuality = this.resolveEffectiveGraphics(initialSettings.graphics);
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && effectiveInitQuality !== 'low',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.applyGraphicsPixelRatio();
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && effectiveInitQuality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight
    );

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault());

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x4b6a88);
    this.fog = new THREE.FogExp2(0x7d97b0, 0.0015);
    this.scene.fog = this.fog;

    const aspect =
      (container.clientWidth || window.innerWidth) /
      (container.clientHeight || window.innerHeight);
    const farDist = this.isSoftwareGl
      ? 680
      : effectiveInitQuality === 'low'
        ? 1050
        : effectiveInitQuality === 'medium'
          ? 1400
          : 1650;
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.14, farDist);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.cameraMode = initialSettings.cameraMode || 'third_person';

    if (!this.isSoftwareGl) {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
      this.scene.environmentIntensity = 0.82;
    }

    this.buildSkyDome(farDist);

    this.hemiLight = new THREE.HemisphereLight(0xaad0f2, 0x3b495c, 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff4e2, 1.9);
    this.sunLight.position.set(45, 70, 35);
    this.sunLight.castShadow = !this.isSoftwareGl && effectiveInitQuality !== 'low';
    const smSize = effectiveInitQuality === 'high' ? 2048 : 1024;
    this.sunLight.shadow.mapSize.set(smSize, smSize);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 220;
    const d = 44;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight(0x9bc4ec, 0.65);
    this.rimLight.position.set(-40, 28, -55);
    this.scene.add(this.rimLight);
    this.scene.add(this.rimLight.target);

    this.headlampLight = new THREE.SpotLight(0xeef6ff, 0, 66, Math.PI / 4.3, 0.54, 1.12);
    this.scene.add(this.headlampLight);
    this.scene.add(this.headlampLight.target);

    this.scene.add(this.worldGroup);

    const maxAniso =
      effectiveInitQuality === 'low'
        ? 1
        : Math.min(
            effectiveInitQuality === 'high' ? 8 : 4,
            this.renderer.capabilities.getMaxAnisotropy()
          );
    this.textures = createAlpineTextures(maxAniso);

    this.loadExpedition(
      initialLevel,
      initialChar,
      'menu',
      initialRoute,
      initialGearUpgrades,
      undefined,
      initialSavedInventory
    );

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.clock.start();
    this.tick();
  }

  public getEffectiveGraphics(): 'low' | 'medium' | 'high' {
    return this.resolveEffectiveGraphics(this.settings.graphics);
  }

  private resolveEffectiveGraphics(requested: GameSettings['graphics']): 'low' | 'medium' | 'high' {
    if (requested !== 'auto') return requested;
    if (this.isSoftwareGl) return 'low';
    const nav = navigator as Navigator & { deviceMemory?: number };
    const mem = nav.deviceMemory ?? 4;
    const cores = navigator.hardwareConcurrency ?? 4;
    const isNarrowMobile =
      window.innerWidth < 840 || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (mem <= 2 || cores <= 2) return 'low';
    if (isNarrowMobile || mem <= 4 || cores <= 4) return 'medium';
    return 'high';
  }

  private applyGraphicsPixelRatio() {
    const q = this.resolveEffectiveGraphics(this.settings.graphics);
    if (this.isSoftwareGl || q === 'low') {
      this.renderer.setPixelRatio(1);
    } else if (q === 'medium') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    }
  }

  public updateSettings(newSettings: GameSettings) {
    const prevEff = this.resolveEffectiveGraphics(this.settings.graphics);
    const prevTimeMode = this.settings.timeMode;
    const prevPreset = this.settings.startTimePreset;
    const prevCam = this.cameraMode;
    this.settings = newSettings;
    const nextEff = this.resolveEffectiveGraphics(newSettings.graphics);
    audioEngine.setVolume(newSettings.masterVolume);
    this.applyGraphicsPixelRatio();
    const shadowsEnabled = !this.isSoftwareGl && nextEff !== 'low';
    this.renderer.shadowMap.enabled = shadowsEnabled;
    this.sunLight.castShadow = shadowsEnabled;
    this.camera.far = this.isSoftwareGl
      ? 680
      : nextEff === 'low'
        ? 1050
        : nextEff === 'medium'
          ? 1400
          : 1650;
    this.camera.updateProjectionMatrix();
    if (prevEff !== nextEff && this.level && this.character) {
      this.rebuildSnowParticles();
    }
    if (newSettings.cameraMode && newSettings.cameraMode !== prevCam) {
      this.setCameraMode(newSettings.cameraMode, false);
    }
    if (
      this.level &&
      (newSettings.timeMode !== prevTimeMode || newSettings.startTimePreset !== prevPreset)
    ) {
      this.applyTimeModeSelection(newSettings.timeMode, newSettings.startTimePreset);
    }
  }

  public setCameraMode(mode: CameraMode, announce = true) {
    this.cameraMode = mode;
    if (mode === 'first_person') {
      this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch, -0.82, 0.82);
    } else {
      this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch, -0.1, 0.72);
    }
    const isFpPlaying =
      mode === 'first_person' && (this.mode === 'playing' || this.mode === 'paused');
    if (this.playerRig) {
      this.playerRig.bodyGroup.visible = !isFpPlaying;
    }
    if (this.firstPersonRig) {
      this.firstPersonRig.root.visible = isFpPlaying;
    }
    this.applyHeadlampVisual();
    if (this.mode === 'playing' || this.mode === 'paused') {
      this.snapCameraToPlayer();
      if (announce) {
        this.showBanner(
          mode === 'first_person'
            ? 'Camera: First-Person Mountaineer View [T]'
            : 'Camera: Third-Person Expedition Follow [T]'
        );
      }
      this.pushTelemetry();
    }
  }

  public toggleCameraMode(): CameraMode {
    const next: CameraMode = this.cameraMode === 'third_person' ? 'first_person' : 'third_person';
    this.setCameraMode(next, true);
    return next;
  }

  public setTimeMode(mode: TimeOfDayMode) {
    this.settings = { ...this.settings, timeMode: mode };
    this.applyTimeModeSelection(mode, this.settings.startTimePreset);
    const label =
      mode === 'day'
        ? 'Daylight Mode'
        : mode === 'night'
          ? 'Moonlit Night Mode'
          : mode === 'dynamic'
            ? 'Dynamic 24h Day/Night Cycle'
            : 'Stage Expedition Time';
    this.showBanner(`Time System: ${label}`);
    this.pushTelemetry();
  }

  private resolveInitialTimeOfDay(level: LevelConfig, settings: GameSettings): number {
    if (settings.timeMode === 'day') return 0.48;
    if (settings.timeMode === 'night') return 0.94;
    switch (settings.startTimePreset) {
      case 'sunrise':
        return 0.26;
      case 'midday':
        return 0.5;
      case 'sunset':
        return 0.74;
      case 'midnight':
        return 0.94;
      case 'expedition':
      default:
        return level.startTimeOfDay;
    }
  }

  private applyTimeModeSelection(mode: TimeOfDayMode, preset: StartingTimePreset) {
    if (mode === 'day') {
      this.timeOfDay = 0.48;
      this.headlampOn = false;
    } else if (mode === 'night') {
      this.timeOfDay = 0.94;
      if (this.headlampBattery > 0) this.headlampOn = true;
    } else if (this.level) {
      this.timeOfDay = this.resolveInitialTimeOfDay(this.level, {
        ...this.settings,
        timeMode: mode,
        startTimePreset: preset,
      });
      const dark = this.timeOfDay > 0.78 || this.timeOfDay < 0.22;
      if (dark && this.headlampBattery > 0) this.headlampOn = true;
    }
    this.applyHeadlampVisual();
    this.updateAtmosphere(0.016, this.elapsedTime);
  }

  public setMode(mode: 'menu' | 'cutscene' | 'playing' | 'paused') {
    const prevMode = this.mode;
    this.mode = mode;
    const isFpActive =
      this.cameraMode === 'first_person' && (mode === 'playing' || mode === 'paused');
    if (this.playerRig) {
      this.playerRig.bodyGroup.visible = !isFpActive;
    }
    if (this.firstPersonRig) {
      this.firstPersonRig.root.visible = isFpActive;
    }
    this.applyHeadlampVisual();

    if (mode === 'playing') {
      this.clock.getDelta();
      audioEngine.setMusicIntensity(0.05);
      if (prevMode !== 'paused') {
        this.snapCameraToPlayer();
        const currentPrimary = this.getCurrentPrimaryMission();
        if (currentPrimary && !this.missionNotification) {
          this.notifyMission('CURRENT OBJECTIVE', currentPrimary.label);
        }
      }
      this.pushTelemetry();
    } else if (mode === 'cutscene') {
      audioEngine.setMusicIntensity(0.16);
      audioEngine.setRiverVolume(0);
    } else {
      audioEngine.setMusicIntensity(0.08);
      audioEngine.setRiverVolume(0);
    }
  }

  public setCutscenePreset(preset: CutsceneBeat['cameraPreset']) {
    this.cutscenePreset = preset;
  }

  public adjustZoom(delta: number) {
    this.cameraZoom = THREE.MathUtils.clamp(this.cameraZoom + delta, 3.8, 12.5);
  }

  public resolveDecision(choice: 'A' | 'B') {
    if (!this.activeDecision) return;
    const picked = choice === 'A' ? this.activeDecision.optionA : this.activeDecision.optionB;
    if (picked.effect === 'rescue_sacrifice') {
      const o2 = this.getItem('oxygen');
      if (o2 && o2.quantity > 0) o2.quantity -= 1;
      this.showBanner('Shared spare O2! Teammate evacuated safely.');
    } else if (picked.effect === 'push_solo') {
      this.showBanner('Emergency beacon dropped. Pushing up the ridge alone.');
    } else if (picked.effect === 'route_abruzzi') {
      this.routeChoice = 'abruzzi';
      this.showBanner('Abruzzi Spur selected for upper K2 camps.');
    } else if (picked.effect === 'route_cesen') {
      this.routeChoice = 'cesen';
      this.showBanner('Cesen Ridge selected for upper K2 camps.');
    }
    this.activeDecision = null;
    this.mode = 'playing';
    this.pushTelemetry();
  }

  public loadExpedition(
    level: LevelConfig,
    character: CharacterProfile,
    mode: 'menu' | 'cutscene' | 'playing',
    route: RouteChoice = 'abruzzi',
    gearUpgrades: GearUpgradeLevels = { iceAxes: 0, parka: 0, o2Regulator: 0, ropeLine: 0 },
    variationSeed?: number,
    savedInventory?: Record<string, { quantity: number; durability: number }>
  ) {
    this.level = level;
    this.character = character;
    this.routeChoice = route;
    this.gearUpgrades = { ...gearUpgrades };
    this.variationSeed = variationSeed ?? Math.floor(Math.random() * 3);
    this.variationLabel =
      this.variationSeed === 0
        ? 'Route Pattern A'
        : this.variationSeed === 1
          ? 'Route Pattern B'
          : 'Route Pattern C';
    this.mode = mode;

    this.clearWorld();

    // Survival & 19-item Equipment Baseline (hydrated from persistent save when available)
    this.health = 100;
    this.oxygen = level.altitudeStart > 7500 ? 88 : 100;
    this.stamina = 100;
    this.gripStrength = 100;
    this.temperature = 86 + this.gearUpgrades.parka * 3;
    this.hunger = 90;
    this.thirst = 90;
    this.fatigue = 8;
    this.headacheSeverity = level.altitudeStart > 7600 ? 18 : 0;
    this.headlampBattery = 100;
    this.balance = 0;
    this.equipment = createInitialEquipment(level.id);
    if (savedInventory) {
      for (const item of this.equipment) {
        const savedItem = savedInventory[item.id];
        if (savedItem) {
          const minQty = item.id === 'rope' ? 1 : item.id === 'carabiners' ? 2 : 0;
          item.quantity = Math.max(minQty, savedItem.quantity);
          item.durability = THREE.MathUtils.clamp(savedItem.durability, 15, 100);
        }
      }
    }

    const resolvedTime = this.resolveInitialTimeOfDay(level, this.settings);
    const startsDark = resolvedTime > 0.78 || resolvedTime < 0.22;
    this.headlampOn = startsDark;
    this.nightHintShown = startsDark;

    this.elapsedTime = 0;
    this.timeOfDay = resolvedTime;
    this.weatherIndex = 0;
    this.weatherTimer = 0;
    this.avalancheTimer = 18 + Math.random() * 8;
    this.fallingIceTimer = 8 + Math.random() * 5;
    this.rockfallTimer = 6 + Math.random() * 4;
    this.rockfallWarningTimer = 0;
    this.avalancheActiveTimer = 0;
    this.landslideWarningTimer = 0;
    this.lightningTimer = 10 + Math.random() * 6;
    this.lightningFlash = 0;
    this.floodWaterLevel = 0.35;
    this.shelterTimer = 0;
    this.statusBanner = null;
    this.statusBannerTimer = 0;
    this.missionNotification = null;
    this.missionNotificationTimer = 0;
    this.o2CollectedCount = 0;
    this.activeDecision = null;
    this.decisionTriggered = false;
    this.activeQte = null;
    this.timedEscape = null;
    this.ropeBreakTriggered = false;
    this.iceCaveCollapseTriggered = false;
    this.glacierCollapseTriggered = false;
    this.avalancheStarted = false;
    this.carryingTeammate = false;
    this.helicopterInbound = false;
    this.heliRescued = false;
    this.heliHeight = 36;
    this.flareTimer = 0;
    this.bossWaveTimer = 14;
    this.dynamicSurpriseTimer = 36 + this.variationSeed * 7;
    this.radioSignalStrength = 0;
    this.sessionPoints = 0;
    this.newlyEarnedBadges = [];

    this.ropeRigState = 'none';
    this.anchorPos = null;
    this.anchorMesh = null;
    this.anchorStability = 100;
    this.ropeTension = 0;
    this.tetherLine = null;
    this.pitchedTentPos = null;
    this.pitchedTentMesh = null;
    this.lastAxeSide = null;
    this.leftAxeSwingTimer = 0;
    this.rightAxeSwingTimer = 0;

    // Build Terrain first so exact progress targets can be computed
    this.terrain = new KarakoramTerrain(level, route, this.variationSeed);

    // Build Sequential Primary + Optional Mission Steps (in ridge encounter order)
    this.missions = [];
    if (level.hasForestValley) {
      const valleyMeters = Math.round(level.ridgeLength * 0.16);
      this.missions.push({
        id: 'trek_valley',
        label: 'Trek through the pine & rocky valley approach',
        type: 'trek_valley',
        completed: false,
        optional: false,
        progressCurrent: 0,
        progressTarget: valleyMeters,
      });
    }
    if (level.hasGlacierRiver && this.terrain.rivers.length > 0) {
      this.missions.push({
        id: 'cross_flood',
        label: 'Rig safety rope & cross the glacial meltwater river',
        type: 'cross_flood',
        completed: false,
        optional: false,
        progressCurrent: 0,
        progressTarget: 1,
      });
    }
    if (level.hasRockfall && this.terrain.rockfallZones.length > 0) {
      const rockTarget = Math.max(1, Math.round(Math.abs(this.terrain.rockfallZones[0].zEnd - 2)));
      this.missions.push({
        id: 'survive_rockfall',
        label: 'Take boulder cover & clear the rockfall couloir',
        type: 'survive_rockfall',
        completed: false,
        optional: false,
        progressCurrent: 0,
        progressTarget: rockTarget,
      });
    }
    if (level.hasObstacles && this.terrain.obstacleSlots.length > 0) {
      this.missions.push({
        id: 'clear_obstacle',
        label: 'Shove fallen debris barricade off the ridge [X]',
        type: 'clear_obstacle',
        completed: false,
        optional: false,
        progressCurrent: 0,
        progressTarget: this.terrain.obstacleSlots.length,
      });
    }
    if (level.hasWildlife && this.terrain.wildlifeZones.length > 0) {
      this.missions.push({
        id: 'repel_wildlife',
        label: 'Repel stalking snow predators (Ice Axe Q/F or Flare 6)',
        type: 'repel_wildlife',
        completed: false,
        optional: false,
        progressCurrent: 0,
        progressTarget: this.terrain.wildlifeZones.length,
      });
    }
    if (level.requiredO2Collect > 0) {
      this.missions.push({
        id: 'collect_o2',
        label: `Recover ${level.requiredO2Collect} Lost Oxygen Cylinder${level.requiredO2Collect > 1 ? 's' : ''}`,
        type: 'collect_o2',
        completed: false,
        optional: true,
        progressCurrent: 0,
        progressTarget: level.requiredO2Collect,
      });
    }
    if (level.hasIceWall) {
      this.missions.push({
        id: 'install_rope',
        label: 'Anchor & rig climbing rope [R] on the steep ice wall',
        type: 'install_rope',
        completed: false,
        optional: false,
        progressCurrent: 0,
        progressTarget: 1,
      });
    }
    if (level.hasBrokenAnchor) {
      this.missions.push({
        id: 'repair_anchor',
        label: 'Repair damaged belay anchor along upper pitch [E]',
        type: 'repair_anchor',
        completed: false,
        optional: true,
        progressCurrent: 0,
        progressTarget: 1,
      });
    }
    if (
      level.specialMission === 'avalanche_escape' ||
      level.specialMission === 'ice_cave_escape' ||
      level.specialMission === 'glacier_collapse'
    ) {
      this.missions.push({
        id: 'escape_hazard',
        label:
          level.specialMission === 'avalanche_escape'
            ? 'Outrun the sudden slab avalanche to high ground'
            : level.specialMission === 'ice_cave_escape'
              ? 'Escape the collapsing ice cavern before cave-in'
              : 'Escape rising floodwaters to upper glacier shelf',
        type: 'escape_hazard',
        completed: false,
        optional: false,
        progressCurrent: 0,
        progressTarget: 1,
      });
    }
    if (level.hasRescueNpc || level.hasMissingMember) {
      this.missions.push({
        id: 'rescue_climber',
        label: level.hasMissingMember
          ? 'Locate missing climber via radio & headlamp [E]'
          : 'Reach & stabilize injured expedition teammate [E]',
        type: 'rescue_climber',
        completed: false,
        optional: false,
        progressCurrent: 0,
        progressTarget: 1,
      });
      if (
        level.specialMission === 'injured_evacuation' ||
        level.specialMission === 'helicopter_rescue' ||
        level.specialMission === 'summit_assault'
      ) {
        this.missions.push({
          id: 'escort_teammate',
          label: 'Evacuate injured teammate to Camp / Helipad safety',
          type: 'escort_teammate',
          completed: false,
          optional: false,
          progressCurrent: 0,
          progressTarget: 1,
        });
      }
    }
    if (level.hasHelicopterRescue) {
      this.missions.push({
        id: 'signal_helicopter',
        label: 'Ignite Emergency Flare [6] at Helipad to guide rescue chopper',
        type: 'signal_helicopter',
        completed: false,
        optional: false,
        progressCurrent: 0,
        progressTarget: 1,
      });
    }
    if (level.hasEmergencyShelter && !level.hasHelicopterRescue) {
      this.missions.push({
        id: 'shelter_night',
        label: 'Warm up inside emergency shelter or Mid-Camp fire',
        type: 'shelter_night',
        completed: false,
        optional: true,
        progressCurrent: 0,
        progressTarget: 3,
      });
    }
    this.missions.push({
      id: 'reach_camp',
      label:
        level.id === 11
          ? 'Summit K2 — The Last Winter (8,611m)'
          : `Reach ${level.name} Summit Checkpoint`,
      type: 'reach_camp',
      completed: false,
      optional: false,
      progressCurrent: 0,
      progressTarget: level.ridgeLength,
    });

    // Build Terrain Geometry with Variation Seed
    const effGraphics = this.resolveEffectiveGraphics(this.settings.graphics);
    const segX = this.isSoftwareGl ? 42 : effGraphics === 'low' ? 60 : effGraphics === 'medium' ? 88 : 112;
    const segZ = this.isSoftwareGl ? 96 : effGraphics === 'low' ? 140 : effGraphics === 'medium' ? 195 : 250;
    const terrainGeo = this.terrain.buildGeometry(segX, segZ);
    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: this.textures.snowAlbedo,
      bumpMap: this.isSoftwareGl ? null : this.textures.snowBump,
      bumpScale: 0.08,
      roughness: 0.86,
      metalness: 0.04,
      envMapIntensity: 0.65,
    });
    this.terrainMat = terrainMat;
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    this.worldGroup.add(terrainMesh);

    this.buildStarfield();
    this.buildKarakoramBackdrop();
    this.buildInstancedRocks();
    this.buildValleyForestAndRivers();
    this.buildClimbingInfrastructure();
    this.buildMissionProps();
    this.buildActionProps();
    this.buildHazardPool();
    this.rebuildSnowParticles();

    // Realistic Human Player Rig (Third-Person) + First-Person Hands & Ice Axes Rig
    this.playerRig = createMountaineerModel(
      character.suitColor,
      character.accentColor,
      character.helmetColor,
      character.skinTone
    );
    this.firstPersonRig = createFirstPersonRig(character.suitColor, character.accentColor);
    this.camera.add(this.firstPersonRig.root);

    const startX = this.terrain.ridgeCenterX(0);
    const startY = this.terrain.getHeightAt(startX, 0);
    this.playerPos.set(startX, startY, 0);
    this.safeReturnPos.copy(this.playerPos);
    this.playerVel.set(0, 0, 0);
    this.playerYaw = 0;
    this.cameraYaw = 0;
    this.cameraPitch = 0.11;
    this.cameraZoom = 6.2;
    this.playerRig.root.position.copy(this.playerPos);
    this.worldGroup.add(this.playerRig.root);

    this.setMode(mode);
    this.updateAtmosphere(0.016, 0);
    if (mode === 'menu') {
      this.camera.position.set(startX - 4.4, startY + 2.8, 8.8);
      this.camera.lookAt(startX, startY + 2.2, -24);
    } else if (mode === 'cutscene') {
      this.camera.position.set(startX - 3.8, startY + 2.9, 8.4);
      this.camera.lookAt(startX, startY + 2.5, -36);
    }
    this.pushTelemetry();
  }

  private clearWorld() {
    this.props = [];
    this.bridges = [];
    this.boulders = [];
    this.rivers = [];
    this.coverBoulders = [];
    this.solidColliders = [];
    this.terrainMat = null;
    this.wildlifeList = [];
    this.obstacles = [];
    this.beaconFlag = null;
    this.beaconRing = null;
    this.heliRig = null;
    this.helipadPos = null;
    this.flareRig = null;
    this.carriedNpcMesh = null;
    this.avalancheWallMesh = null;
    this.snowParticles = null;
    this.starField = null;
    this.anchorMesh = null;
    this.tetherLine = null;
    this.pitchedTentMesh = null;
    audioEngine.setHelicopterVolume(0);

    if (this.firstPersonRig) {
      this.camera.remove(this.firstPersonRig.root);
      this.firstPersonRig.root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material?.dispose();
          }
        }
      });
      this.firstPersonRig = null;
    }

    while (this.worldGroup.children.length > 0) {
      const child = this.worldGroup.children[0];
      this.worldGroup.remove(child);
      child.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material?.dispose();
          }
        }
      });
    }
  }

  private buildSkyDome(farDist: number) {
    const skyGeo = new THREE.SphereGeometry(Math.max(420, farDist * 0.85), 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenithColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        uniform vec3 uMoonDir;
        uniform float uDayFactor;
        uniform float uSunsetFactor;
        uniform float uNightFactor;
        uniform float uCloudDensity;
        uniform float uTime;
        uniform float uLightning;
        varying vec3 vWorldDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(234.34, 435.345));
          p += dot(p, p + 34.23);
          return fract(p.x * p.y);
        }

        float noise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 3; i++) {
            v += a * noise2(p);
            p *= 2.04;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float h = clamp(dir.y, 0.0, 1.0);
          float horizonBand = pow(1.0 - h, 2.6);

          vec3 sky = mix(uHorizonColor, uZenithColor, pow(h, 0.55));

          // Golden-hour / twilight horizon scattering toward solar azimuth
          float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
          vec3 sunsetGlow = vec3(0.95, 0.42, 0.16) * uSunsetFactor * horizonBand * (0.45 + 0.75 * pow(sunDot, 3.0));
          sky += sunsetGlow;

          // Solar disc & atmospheric corona
          if (uDayFactor > 0.04) {
            float sunHalo = pow(sunDot, 16.0) * 0.45 + pow(sunDot, 160.0) * 0.9;
            float sunDisc = smoothstep(0.9986, 0.9994, sunDot);
            sky += uSunColor * (sunHalo * 0.65 + sunDisc * 1.45) * uDayFactor;
          }

          // Moon disc & cold silver corona at night
          if (uNightFactor > 0.08) {
            float moonDot = max(dot(dir, normalize(uMoonDir)), 0.0);
            float moonHalo = pow(moonDot, 42.0) * 0.24;
            float moonDisc = smoothstep(0.9989, 0.9995, moonDot);
            sky += vec3(0.75, 0.85, 0.98) * (moonHalo + moonDisc * 1.15) * uNightFactor;
          }

          // High-altitude alpine cloud bands
          if (dir.y > 0.01) {
            vec2 uv = dir.xz / (dir.y + 0.18) * 1.4 + vec2(uTime * 0.008, uTime * 0.004);
            float c = fbm(uv);
            float cloudMask = smoothstep(0.56 - uCloudDensity * 0.34, 0.86, c) * smoothstep(0.01, 0.22, dir.y);
            vec3 cloudCol = mix(
              mix(vec3(0.16, 0.21, 0.3), vec3(0.86, 0.9, 0.96), uDayFactor),
              vec3(0.95, 0.58, 0.34),
              uSunsetFactor * 0.72
            );
            sky = mix(sky, cloudCol, cloudMask * 0.55);
          }

          // Storm lightning sky pulse
          sky += vec3(0.78, 0.88, 1.0) * uLightning * 0.65;

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.skyDome.frustumCulled = false;
    this.skyDome.renderOrder = -10;
    this.scene.add(this.skyDome);
  }

  private buildStarfield() {
    const count = 900;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.44;
      const r = 340;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) + 30;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) - this.level.ridgeLength * 0.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xd8e8fa,
      size: 1.5,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    this.starField = new THREE.Points(geo, mat);
    this.starField.frustumCulled = false;
    this.worldGroup.add(this.starField);
  }

  private buildKarakoramBackdrop() {
    if (!this.terrain) return;
    const effQ = this.resolveEffectiveGraphics(this.settings.graphics);
    const radSegs = this.isSoftwareGl || effQ === 'low' ? 10 : 18;
    const hSegs = this.isSoftwareGl || effQ === 'low' ? 6 : 10;

    // Serrated alpine mountain geometry with multi-ridge vertex displacement (replaces low-poly cones)
    const peakGeo = new THREE.ConeGeometry(1, 1, radSegs, hSegs);
    const pos = peakGeo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const col = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i); // -0.5 .. +0.5
      let z = pos.getZ(i);
      const radius = Math.hypot(x, z);
      const angle = Math.atan2(z, x);
      const hNorm = y + 0.5; // 0 bottom -> 1 peak

      // Sculpt sharp Karakoram arêtes, gullies & strata ledges
      const ridgeNoise =
        Math.sin(angle * 3.0 + hNorm * 4.2) * 0.16 +
        Math.cos(angle * 5.0 - hNorm * 6.5) * 0.09 +
        Math.sin((x + z) * 9.0) * 0.04;
      const radialScale = 1 + ridgeNoise * Math.min(1, hNorm * 2.2) * (1 - hNorm * 0.45);
      x *= radialScale;
      z *= radialScale;
      if (hNorm > 0.05 && hNorm < 0.96) {
        y += Math.sin(angle * 4.0 + radius * 6.0) * 0.032;
      }
      pos.setXYZ(i, x, y, z);

      // Slope-aware snow deposition: ridges & upper faces hold crisp wind-packed snow; steep couloirs expose dark granite
      const snowBias = y + Math.sin(angle * 3.0 + hNorm * 3.5) * 0.11;
      if (snowBias > 0.08) {
        col.setHex(0xe8f1fa);
      } else if (snowBias > -0.1) {
        col.setHex(0x8fa4bc);
      } else {
        col.setHex(0x3f4c5c);
      }
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    peakGeo.computeVertexNormals();
    peakGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const peakMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: this.textures.rockAlbedo,
      bumpMap: this.isSoftwareGl || effQ === 'low' ? null : this.textures.rockBump,
      bumpScale: 0.35,
      roughness: 0.9,
      metalness: 0.04,
    });

    const peakCount = this.isSoftwareGl ? 32 : 46;
    const peaks = new THREE.InstancedMesh(peakGeo, peakMat, peakCount);
    const c = new THREE.Color();

    for (let i = 0; i < peakCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const distX = 76 + (i % 5) * 28 + Math.random() * 18;
      const zPos = 35 - (i / peakCount) * (this.level.ridgeLength + 290);
      const scaleXZ = 54 + Math.random() * 48;
      const scaleY = 128 + Math.random() * 120;
      _dummy.position.set(side * distX, scaleY * 0.4 - 8, zPos);
      _dummy.rotation.set(0, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.08);
      _dummy.scale.set(scaleXZ, scaleY, scaleXZ * (0.85 + Math.random() * 0.35));
      _dummy.updateMatrix();
      peaks.setMatrixAt(i, _dummy.matrix);

      const tint = 0.88 + Math.random() * 0.12;
      c.setRGB(tint, tint, Math.min(1, tint + 0.04));
      peaks.setColorAt(i, c);
    }
    peaks.instanceMatrix.needsUpdate = true;
    if (peaks.instanceColor) peaks.instanceColor.needsUpdate = true;
    peaks.computeBoundingSphere();
    this.worldGroup.add(peaks);

    // Iconic K2 Savage Mountain Massif on Horizon (multi-ribbed Abruzzi & Broad Peak silhouette)
    const k2RadSegs = this.isSoftwareGl || effQ === 'low' ? 14 : 28;
    const k2HSegs = this.isSoftwareGl || effQ === 'low' ? 8 : 16;
    const k2Geo = new THREE.ConeGeometry(185, 375, k2RadSegs, k2HSegs);
    const k2Pos = k2Geo.attributes.position as THREE.BufferAttribute;
    const k2Colors = new Float32Array(k2Pos.count * 3);
    for (let i = 0; i < k2Pos.count; i++) {
      let kx = k2Pos.getX(i);
      let ky = k2Pos.getY(i);
      let kz = k2Pos.getZ(i);
      const ny = ky / 375; // -0.5 .. +0.5
      const hNorm = ny + 0.5;
      const ang = Math.atan2(kz, kx);

      const spur =
        Math.sin(ang * 4.0 + hNorm * 3.1) * 0.18 +
        Math.cos(ang * 7.0 - hNorm * 5.2) * 0.08 +
        Math.sin(ang * 11.0 + hNorm * 9.0) * 0.035;
      const factor = 1 + spur * (1 - hNorm * 0.35);
      kx *= factor;
      kz *= factor * 0.84; // authentic asymmetrical massif profile
      if (hNorm > 0.12 && hNorm < 0.94) {
        ky += Math.sin(ang * 3.0 + hNorm * 8.0) * 9.5;
      }
      k2Pos.setXYZ(i, kx, ky, kz);

      const snowMask = ny + Math.sin(ang * 4.0 + hNorm * 4.2) * 0.08;
      if (snowMask > 0.02) {
        col.setHex(0xf1f7fe);
      } else if (snowMask > -0.18) {
        col.setHex(0x9cb3cb);
      } else {
        col.setHex(0x475669);
      }
      k2Colors[i * 3] = col.r;
      k2Colors[i * 3 + 1] = col.g;
      k2Colors[i * 3 + 2] = col.b;
    }
    k2Geo.computeVertexNormals();
    k2Geo.setAttribute('color', new THREE.BufferAttribute(k2Colors, 3));

    const k2Pyramid = new THREE.Mesh(
      k2Geo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        map: this.textures.rockAlbedo,
        bumpMap: this.isSoftwareGl || effQ === 'low' ? null : this.textures.rockBump,
        bumpScale: 0.45,
        roughness: 0.88,
        metalness: 0.03,
      })
    );
    k2Pyramid.position.set(16, 152, -(this.level.ridgeLength + 178));
    k2Pyramid.rotation.y = 0.44;
    this.worldGroup.add(k2Pyramid);
  }

  private buildInstancedRocks() {
    if (!this.terrain) return;
    const rockGeo = new THREE.DodecahedronGeometry(1.0, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      map: this.textures.rockAlbedo,
      bumpMap: this.textures.rockBump,
      bumpScale: 0.18,
      roughness: 0.93,
      metalness: 0.05,
    });

    const effQ = this.resolveEffectiveGraphics(this.settings.graphics);
    const maxCount = effQ === 'low' ? 65 : effQ === 'medium' ? 105 : 135;
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, maxCount);
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    const color = new THREE.Color();

    let placed = 0;
    let attempts = 0;
    while (placed < maxCount && attempts < maxCount * 5) {
      attempts += 1;
      const z = -8 - Math.random() * (this.level.ridgeLength + 8);
      const cx = this.terrain.ridgeCenterX(z);
      const side = Math.random() > 0.5 ? 1 : -1;
      const offset = 5.4 + Math.random() * 9.5;
      const x = cx + side * offset;
      if (this.terrain.getSlopeDegrees(x, z) > 34) continue;
      const y = this.terrain.getHeightAt(x, z);

      const s = 0.65 + Math.random() * 1.45;
      _dummy.position.set(x, y - 0.62 * s, z);
      _dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      _dummy.scale.set(
        s * (0.9 + Math.random() * 0.3),
        s * (0.65 + Math.random() * 0.4),
        s
      );
      _dummy.updateMatrix();
      rocks.setMatrixAt(placed, _dummy.matrix);

      const shade = 0.62 + Math.random() * 0.25;
      color.setRGB(shade, shade, shade + 0.04);
      rocks.setColorAt(placed, color);
      placed += 1;
    }
    rocks.count = placed;
    rocks.instanceMatrix.needsUpdate = true;
    if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
    rocks.computeBoundingSphere();
    this.worldGroup.add(rocks);
  }

  private buildValleyForestAndRivers() {
    if (!this.terrain) return;

    // 1. Pine Forest Approach (keep z <= -10 and flatter ground so trees never block camera or float)
    if (this.level.hasForestValley) {
      const treeZoneLen = this.level.ridgeLength * 0.16;
      const treeCount = this.settings.graphics === 'low' ? 22 : 38;
      let placed = 0;
      let attempts = 0;
      while (placed < treeCount && attempts < treeCount * 4) {
        attempts += 1;
        const z = -10 - Math.random() * Math.max(24, treeZoneLen - 6);
        const cx = this.terrain.ridgeCenterX(z);
        const side = placed % 2 === 0 ? -1 : 1;
        const x = cx + side * (6.0 + Math.random() * 7.5);
        if (this.terrain.getSlopeDegrees(x, z) > 28) continue;
        const y = this.terrain.getHeightAt(x, z);
        const tree = createPineTreeModel();
        const scale = 0.78 + Math.random() * 0.48;
        tree.position.set(x, y - 0.55, z);
        tree.scale.setScalar(scale);
        tree.rotation.y = Math.random() * Math.PI * 2;
        this.worldGroup.add(tree);
        this.solidColliders.push({ x, z, radius: 0.58 * scale });
        placed += 1;
      }
    }

    // 2. Glacial Meltwater River Channels
    for (const r of this.terrain.rivers) {
      const riverMat = new THREE.MeshStandardMaterial({
        color: 0x26546e,
        roughness: 0.16,
        metalness: 0.22,
        transparent: true,
        opacity: 0.8,
      });
      const riverGeo = new THREE.PlaneGeometry(58, r.halfWidthZ * 2.0, 12, 6);
      riverGeo.rotateX(-Math.PI / 2);
      const riverMesh = new THREE.Mesh(riverGeo, riverMat);
      riverMesh.position.set(
        this.terrain.ridgeCenterX(r.zCenter),
        r.bedHeight + 0.35,
        r.zCenter
      );
      riverMesh.receiveShadow = true;
      this.worldGroup.add(riverMesh);
      this.rivers.push({
        zCenter: r.zCenter,
        halfWidthZ: r.halfWidthZ,
        bedHeight: r.bedHeight,
        mesh: riverMesh,
      });
    }

    // 3. Rockfall Cover Boulders along Rockfall Couloirs (with solid collision)
    for (const rf of this.terrain.rockfallZones) {
      const steps = 4;
      for (let i = 0; i < steps; i++) {
        const z = THREE.MathUtils.lerp(rf.zStart - 6, rf.zEnd + 6, i / (steps - 1));
        const x = this.terrain.ridgeCenterX(z) + (i % 2 === 0 ? -2.8 : 2.8);
        const y = this.terrain.getHeightAt(x, z);
        const boulder = createCoverBoulderModel();
        boulder.position.set(x, y - 0.15, z);
        this.worldGroup.add(boulder);
        this.coverBoulders.push(new THREE.Vector3(x, y, z));
        this.solidColliders.push({ x, z, radius: 1.5 });
      }
    }
  }

  private buildClimbingInfrastructure() {
    if (!this.terrain) return;

    // Starting Base Camp Tent (placed on left margin ahead of spawn so camera view stays clear)
    const baseTent = createTentCampModel();
    const bx = this.terrain.ridgeCenterX(-4.0) - 5.4;
    const by = this.terrain.getHeightAt(bx, -4.0);
    baseTent.position.set(bx, by - 0.1, -4.0);
    baseTent.rotation.y = 0.38;
    this.worldGroup.add(baseTent);
    this.solidColliders.push({ x: bx, z: -4.0, radius: 1.75 });

    // Mid-Camp Tent & Campfire
    const mz = this.terrain.midCampZ;
    const mx = this.terrain.ridgeCenterX(mz) - 3.4;
    const my = this.terrain.getHeightAt(mx, mz);
    const midTent = createTentCampModel();
    midTent.position.set(mx, my, mz);
    midTent.rotation.y = 0.45;
    this.worldGroup.add(midTent);
    this.solidColliders.push({ x: mx, z: mz, radius: 1.75 });

    const firePos = new THREE.Vector3(mx + 2.6, this.terrain.getHeightAt(mx + 2.6, mz + 1.2), mz + 1.2);
    const campfire = createCampfireModel();
    campfire.position.copy(firePos);
    this.worldGroup.add(campfire);
    this.props.push({
      id: 'midcamp_fire',
      type: 'midcamp',
      mesh: campfire,
      position: firePos,
      active: true,
    });

    // Anchor Slot Visual Markers (Solid vs Poor rock/ice anchor spots)
    for (const slot of this.terrain.anchorSlots) {
      const marker = createAnchorSlotMarker(slot.quality);
      const sy = this.terrain.getHeightAt(slot.x, slot.z);
      marker.position.set(slot.x, sy, slot.z);
      this.worldGroup.add(marker);
    }

    // Crevasse Snow Bridges or Ladders
    this.terrain.crevasses.forEach((crev, idx) => {
      if (!this.terrain) return;
      const ly = this.terrain.getHeightAt(
        crev.xBridgeCenter,
        crev.zCenter + crev.halfWidthZ + 0.4
      );
      if (crev.hasSnowBridge) {
        const bridge = createSnowBridgeModel(crev.bridgeHalfWidthX * 2.0, crev.halfWidthZ * 2.1);
        bridge.position.set(crev.xBridgeCenter, ly + 0.05, crev.zCenter);
        this.worldGroup.add(bridge);
        this.bridges.push({
          index: idx,
          mesh: bridge,
          triggered: false,
          timer: 1.15,
          collapsed: false,
        });
      } else {
        const ladder = createLadderModel(crev.halfWidthZ * 2.4);
        ladder.position.set(crev.xBridgeCenter, ly + 0.08, crev.zCenter);
        this.worldGroup.add(ladder);
      }
    });

    // Ice Caves
    for (const cave of this.terrain.iceCaves) {
      const cz = (cave.zStart + cave.zEnd) * 0.5;
      const cy = this.terrain.getHeightAt(cave.xCenter, cz);
      const caveMesh = createIceCaveModel(cave.zStart - cave.zEnd);
      caveMesh.position.set(cave.xCenter, cy, cz);
      this.worldGroup.add(caveMesh);
    }

    // Trail Flag Markers every 42m
    const markerGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.45, 6);
    const flagGeo = new THREE.BoxGeometry(0.32, 0.2, 0.03);
    const markerMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.7,
      roughness: 0.3,
    });
    const markerFlagMat = new THREE.MeshStandardMaterial({
      color: 0xb94a2c,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.35,
      roughness: 0.65,
    });

    for (let z = -26; z > -this.level.ridgeLength + 16; z -= 42) {
      const mxTrail = this.terrain.ridgeCenterX(z) + 2.4;
      const myTrail = this.terrain.getHeightAt(mxTrail, z);
      const pole = new THREE.Mesh(markerGeo, markerMat);
      pole.position.set(mxTrail, myTrail + 0.72, z);
      const cloth = new THREE.Mesh(flagGeo, markerFlagMat);
      cloth.position.set(mxTrail + 0.16, myTrail + 1.32, z);
      this.worldGroup.add(pole, cloth);
    }
  }

  private buildMissionProps() {
    if (!this.terrain) return;
    const len = this.level.ridgeLength;

    // Oxygen Caches
    [-len * 0.28, -len * 0.68].forEach((z, idx) => {
      if (!this.terrain) return;
      const x = this.terrain.ridgeCenterX(z) + (idx === 0 ? -2.2 : 2.4);
      const y = this.terrain.getHeightAt(x, z);
      const mesh = createSupplyCacheModel('o2');
      mesh.position.set(x, y, z);
      this.worldGroup.add(mesh);
      this.props.push({
        id: `o2_${idx}`,
        type: 'o2',
        mesh,
        position: new THREE.Vector3(x, y, z),
        active: true,
      });
    });

    // Thermal Ration & Water Crate
    const rz = -len * 0.45;
    const rx = this.terrain.ridgeCenterX(rz) - 2.4;
    const ry = this.terrain.getHeightAt(rx, rz);
    const rationMesh = createSupplyCacheModel('ration');
    rationMesh.position.set(rx, ry, rz);
    this.worldGroup.add(rationMesh);
    this.props.push({
      id: 'ration_1',
      type: 'ration',
      mesh: rationMesh,
      position: new THREE.Vector3(rx, ry, rz),
      active: true,
    });

    // Damaged Belay Anchor to Repair
    if (this.level.hasBrokenAnchor) {
      const az = -len * 0.61;
      const ax = this.terrain.ridgeCenterX(az) + 1.4;
      const ay = this.terrain.getHeightAt(ax, az);
      const { group, statusOrb } = createAnchorModel();
      group.position.set(ax, ay, az);
      this.worldGroup.add(group);
      this.props.push({
        id: 'anchor_1',
        type: 'anchor',
        mesh: group,
        position: new THREE.Vector3(ax, ay, az),
        active: true,
        extraMesh: statusOrb,
      });
    }

    // Stranded / Missing Team Member
    if (this.level.hasRescueNpc || this.level.hasMissingMember) {
      const nz = -len * 0.72;
      const nx = this.terrain.ridgeCenterX(nz) - 2.2;
      const ny = this.terrain.getHeightAt(nx, nz);
      const npc = createStrandedClimberModel();
      npc.position.set(nx, ny, nz);
      npc.rotation.y = 0.6;
      this.worldGroup.add(npc);
      this.props.push({
        id: 'npc_1',
        type: 'npc',
        mesh: npc,
        position: new THREE.Vector3(nx, ny, nz),
        active: true,
      });
    }

    // Emergency Storm Shelter Tent
    if (this.level.hasEmergencyShelter) {
      const sz = -len * 0.78;
      const sx = this.terrain.ridgeCenterX(sz) - 3.2;
      const sy = this.terrain.getHeightAt(sx, sz);
      const shelter = createEmergencyShelterModel();
      shelter.group.position.set(sx, sy, sz);
      this.worldGroup.add(shelter.group);
      this.props.push({
        id: 'shelter_1',
        type: 'shelter',
        mesh: shelter.group,
        position: new THREE.Vector3(sx, sy, sz),
        active: true,
      });
    }

    // Final Camp / Summit Beacon
    const cz = -len;
    const cx = this.terrain.ridgeCenterX(cz);
    const cy = this.terrain.getHeightAt(cx, cz);

    if (this.level.id < 11) {
      const campTent = createTentCampModel();
      campTent.position.set(cx - 3.2, this.terrain.getHeightAt(cx - 3.2, cz - 1.5), cz - 1.5);
      campTent.rotation.y = 0.2;
      this.worldGroup.add(campTent);
    }

    const beacon = createBeaconModel(this.level.id === 11);
    beacon.group.position.set(cx, cy, cz);
    this.worldGroup.add(beacon.group);
    this.beaconFlag = beacon.flag;
    this.beaconRing = beacon.ring;

    this.props.push({
      id: 'checkpoint',
      type: 'checkpoint',
      mesh: beacon.group,
      position: new THREE.Vector3(cx, cy, cz),
      active: true,
    });
  }

  private buildActionProps() {
    if (!this.terrain) return;

    // 1. Snow Predators
    for (const wz of this.terrain.wildlifeZones) {
      const rig = createWildlifeModel();
      const wy = this.terrain.getHeightAt(wz.x, wz.z);
      rig.group.position.set(wz.x, wy, wz.z);
      this.worldGroup.add(rig.group);
      this.wildlifeList.push({
        rig,
        pos: new THREE.Vector3(wz.x, wy, wz.z),
        homePos: new THREE.Vector3(wz.x, wy, wz.z),
        hp: 2,
        repelled: false,
        attackCooldown: 1.5,
        fleeTimer: 0,
        growlCooldown: 2,
      });
    }

    // 2. Pushable Debris / Ice Barricades
    for (const obs of this.terrain.obstacleSlots) {
      const mesh = createMovableObstacleModel();
      const oy = this.terrain.getHeightAt(obs.x, obs.z);
      mesh.position.set(obs.x, oy, obs.z);
      this.worldGroup.add(mesh);
      this.obstacles.push({
        id: obs.id,
        mesh,
        pos: new THREE.Vector3(obs.x, oy, obs.z),
        cleared: false,
        targetX: obs.x + 5.0,
      });
    }

    // 3. Rescue Helicopter & Helipad Landing Pad (Stage 8)
    if (this.level.hasHelicopterRescue) {
      const hz = -this.level.ridgeLength * 0.86;
      const hx = this.terrain.ridgeCenterX(hz);
      const hy = this.terrain.getHeightAt(hx, hz);
      this.helipadPos = new THREE.Vector3(hx, hy, hz);

      const padMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.85,
      });
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.85,
      });
      const padGroup = new THREE.Group();
      padGroup.position.copy(this.helipadPos);
      const circle = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.16, 20), padMat);
      circle.position.y = 0.08;
      padGroup.add(circle);
      const hRing = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.1, 6, 28), ringMat);
      hRing.rotation.x = Math.PI / 2;
      hRing.position.y = 0.18;
      padGroup.add(hRing);
      this.worldGroup.add(padGroup);

      this.props.push({
        id: 'helipad_1',
        type: 'helipad',
        mesh: padGroup,
        position: this.helipadPos.clone(),
        active: true,
      });

      this.heliRig = createHelicopterModel();
      this.heliRig.group.position.set(hx + 16, hy + this.heliHeight, hz - 24);
      this.worldGroup.add(this.heliRig.group);
    }

    // 4. Rolling Avalanche Wall (Stages 1 & 11)
    if (this.level.specialMission === 'avalanche_escape' || this.level.id === 11) {
      this.avalancheWallMesh = createAvalancheWallModel();
      this.avalancheWallMesh.visible = false;
      this.worldGroup.add(this.avalancheWallMesh);
    }
  }

  private buildHazardPool() {
    const geo = new THREE.DodecahedronGeometry(1.1, 0);
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.78 });
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0x67a9cf,
      roughness: 0.28,
      metalness: 0.1,
    });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.94 });

    for (let i = 0; i < 12; i++) {
      const kind: HazardBoulder['kind'] = i < 4 ? 'avalanche' : i < 8 ? 'ice' : 'rock';
      const mat = kind === 'avalanche' ? snowMat : kind === 'ice' ? iceMat : rockMat;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.castShadow = true;
      this.worldGroup.add(mesh);
      this.boulders.push({
        mesh,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        active: false,
        kind,
      });
    }
  }

  private rebuildSnowParticles() {
    if (this.snowParticles) {
      this.worldGroup.remove(this.snowParticles);
      this.snowParticles.geometry.dispose();
      (this.snowParticles.material as THREE.Material).dispose();
    }

    const effSnowQ = this.resolveEffectiveGraphics(this.settings.graphics);
    this.snowCount = this.isSoftwareGl
      ? 260
      : effSnowQ === 'low'
        ? 420
        : effSnowQ === 'medium'
          ? 1000
          : 1800;
    this.snowPositions = new Float32Array(this.snowCount * 3);
    this.snowVelocities = new Float32Array(this.snowCount * 3);

    for (let i = 0; i < this.snowCount; i++) {
      this.snowPositions[i * 3] = (Math.random() - 0.5) * 48;
      this.snowPositions[i * 3 + 1] = Math.random() * 24;
      this.snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 48;

      this.snowVelocities[i * 3] = -1.6 - Math.random() * 2.6;
      this.snowVelocities[i * 3 + 1] = -3.2 - Math.random() * 3.5;
      this.snowVelocities[i * 3 + 2] = (Math.random() - 0.5) * 2.2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.snowPositions, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.22,
      map: this.textures.particleTex,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      color: 0xe2ecf5,
    });

    this.snowParticles = new THREE.Points(geo, mat);
    this.snowParticles.frustumCulled = false;
    this.worldGroup.add(this.snowParticles);
  }

  private getItem(id: string): EquipmentItem | undefined {
    return this.equipment.find((e) => e.id === id);
  }

  private getPackWeightKg(): number {
    let total = 0;
    for (const item of this.equipment) {
      total += item.quantity * item.weightKg;
    }
    return Number(total.toFixed(1));
  }

  private getGearIntegrity(): number {
    const ids = ['ice_axes', 'crampons', 'boots', 'helmet', 'gloves', 'harness', 'rope', 'goggles'];
    let sum = 0;
    let count = 0;
    for (const id of ids) {
      const it = this.getItem(id);
      if (it) {
        sum += it.durability;
        count += 1;
      }
    }
    return count > 0 ? Math.round(sum / count) : 100;
  }

  private degradeGear(ids: string[], amount: number) {
    for (const id of ids) {
      const it = this.getItem(id);
      if (it) it.durability = Math.max(10, it.durability - amount);
    }
  }

  private applyHeadlampVisual() {
    if (!this.playerRig) return;
    const batteryFactor =
      this.headlampBattery <= 0
        ? 0
        : this.headlampBattery < 15
          ? 0.45 + 0.45 * Math.sin(this.elapsedTime * 19)
          : 1.0;

    const isFp =
      this.cameraMode === 'first_person' && (this.mode === 'playing' || this.mode === 'paused');
    const active = this.headlampOn && this.headlampBattery > 0;
    const isDarkEnv =
      this.timeOfDay > 0.76 ||
      this.timeOfDay < 0.24 ||
      Boolean(this.terrain?.isInsideIceCave(this.playerPos.x, this.playerPos.z));
    const coneAlpha = active ? (isDarkEnv ? 0.22 : 0.06) * batteryFactor : 0;

    // Single shared SpotLight drives whichever camera perspective is active (zero extra shader cost)
    this.headlampLight.intensity = active ? (isFp ? 5.8 : 5.2) * batteryFactor : 0;
    const tpConeMat = this.playerRig.headlampCone.material as THREE.ShaderMaterial;
    const tpConeAlpha = !isFp ? coneAlpha : 0;
    if (tpConeMat.uniforms?.uOpacity) {
      tpConeMat.uniforms.uOpacity.value = tpConeAlpha;
    }
    this.playerRig.headlampCone.visible = tpConeAlpha > 0.002;
    (this.playerRig.headlampLens.material as THREE.MeshStandardMaterial).emissiveIntensity =
      active ? 1.9 * batteryFactor : 0.15;

    if (this.firstPersonRig) {
      const fpConeMat = this.firstPersonRig.headlampCone.material as THREE.ShaderMaterial;
      const fpConeAlpha = isFp ? coneAlpha * 0.65 : 0;
      if (fpConeMat.uniforms?.uOpacity) {
        fpConeMat.uniforms.uOpacity.value = fpConeAlpha;
      }
      this.firstPersonRig.headlampCone.visible = fpConeAlpha > 0.002;
    }
  }

  public useEquipment(id: string) {
    if (this.mode !== 'playing') return;
    const item = this.getItem(id);
    if (!item) return;

    if (id === 'rope' || id === 'carabiners') {
      this.triggerRopeStep();
      return;
    }

    if (id === 'oxygen') {
      if (item.quantity <= 0) {
        this.showBanner('Out of Oxygen Cylinders!');
        return;
      }
      item.quantity -= 1;
      this.oxygen = Math.min(100, this.oxygen + 48);
      this.headacheSeverity = Math.max(0, this.headacheSeverity - 28);
      this.fatigue = Math.max(0, this.fatigue - 18);
      audioEngine.playOxygenHiss();
      this.showBanner('Connected fresh Oxygen Cylinder (+48% O2, -Headache)');
      this.syncPersistentProgress();
      this.pushTelemetry();
      return;
    }

    if (id === 'food') {
      if (item.quantity <= 0) {
        this.showBanner('Out of Alpine Rations!');
        return;
      }
      item.quantity -= 1;
      this.hunger = Math.min(100, this.hunger + 45);
      this.temperature = Math.min(100, this.temperature + 22);
      this.stamina = Math.min(100, this.stamina + 25);
      this.health = Math.min(100, this.health + 10);
      this.showBanner('Ate High-Calorie Ration (+45% Food, +22% Warmth)');
      this.syncPersistentProgress();
      this.pushTelemetry();
      return;
    }

    if (id === 'water') {
      if (item.quantity <= 0) {
        this.showBanner('Thermal Water Flasks empty!');
        return;
      }
      item.quantity -= 1;
      this.thirst = Math.min(100, this.thirst + 48);
      this.stamina = Math.min(100, this.stamina + 16);
      this.headacheSeverity = Math.max(0, this.headacheSeverity - 10);
      this.showBanner('Drank warm insulated water (+48% Hydration)');
      this.syncPersistentProgress();
      this.pushTelemetry();
      return;
    }

    if (id === 'first_aid') {
      if (item.quantity <= 0) {
        this.showBanner('No First Aid kits remaining!');
        return;
      }
      item.quantity -= 1;
      this.health = Math.min(100, this.health + 38);
      this.headacheSeverity = Math.max(0, this.headacheSeverity - 40);
      this.temperature = Math.min(100, this.temperature + 12);
      this.showBanner('First Aid administered (+38% Health, -40% Headache)');
      this.syncPersistentProgress();
      this.pushTelemetry();
      return;
    }

    if (id === 'headlamp') {
      if (item.quantity > 1 && this.headlampBattery < 95) {
        item.quantity -= 1;
        this.headlampBattery = 100;
        this.headlampOn = true;
        audioEngine.playHeadlampClick();
        this.applyHeadlampVisual();
        this.showBanner('Swapped spare headlamp cell (Battery 100%)');
        this.syncPersistentProgress();
        this.pushTelemetry();
      } else {
        this.toggleHeadlamp();
      }
      return;
    }

    if (id === 'tent') {
      if (this.pitchedTentPos) {
        // Pack up pitched tent
        if (this.pitchedTentMesh) {
          this.worldGroup.remove(this.pitchedTentMesh);
          this.pitchedTentMesh = null;
        }
        this.pitchedTentPos = null;
        item.quantity = 1;
        this.showBanner('Storm bivy tent packed back into backpack');
        this.pushTelemetry();
        return;
      }
      if (item.quantity <= 0) return;
      const slope = this.terrain ? this.terrain.getSlopeDegrees(this.playerPos.x, this.playerPos.z) : 0;
      if (slope > 24) {
        this.showBanner('Slope too steep to pitch storm tent here!');
        return;
      }
      item.quantity = 0;
      this.pitchedTentPos = this.playerPos.clone();
      const bivy = createEmergencyShelterModel();
      bivy.group.position.copy(this.pitchedTentPos);
      this.worldGroup.add(bivy.group);
      this.pitchedTentMesh = bivy.group;
      this.showBanner('4-Season Bivy Tent pitched! Step inside to warm up & sleep.');
      this.pushTelemetry();
      return;
    }

    if (id === 'sleeping_bag') {
      const nearShelter = this.isPlayerInsideShelter();
      const nearFire = this.isPlayerNearCampfire();
      if (!nearShelter && !nearFire) {
        this.showBanner('Pitch Bivy Tent or reach Campfire/Shelter before sleeping!');
        return;
      }
      this.fatigue = Math.max(0, this.fatigue - 45);
      this.stamina = Math.min(100, this.stamina + 35);
      this.temperature = Math.min(100, this.temperature + 22);
      this.headacheSeverity = Math.max(0, this.headacheSeverity - 18);
      this.showBanner('Rested in Down Sleeping Bag (-45% Fatigue, +Warmth)');
      this.pushTelemetry();
      return;
    }

    if (id === 'flare') {
      if (item.quantity <= 0) {
        this.showBanner('Out of Emergency Magnesium Flares!');
        return;
      }
      item.quantity -= 1;
      audioEngine.playFlareIgnite();
      this.flareTimer = 18.0;
      this.flarePos.copy(this.playerPos);
      if (this.flareRig) {
        this.worldGroup.remove(this.flareRig.group);
      }
      this.flareRig = createFlareEffectModel();
      this.flareRig.group.position.copy(this.flarePos);
      this.worldGroup.add(this.flareRig.group);
      this.temperature = Math.min(100, this.temperature + 8);

      // Scare wildlife
      let scaredCount = 0;
      for (const w of this.wildlifeList) {
        if (!w.repelled && w.pos.distanceTo(this.playerPos) < 28) {
          w.fleeTimer = 14.0;
          scaredCount += 1;
        }
      }

      if (this.activeQte && this.activeQte.requiredAction === 'flare') {
        this.completeQte();
      }

      // Check Night Search completion boost
      if (this.level.specialMission === 'night_search') {
        const npc = this.props.find((p) => p.type === 'npc');
        if (npc && npc.position.distanceTo(this.playerPos) < 26) {
          this.awardBadge('night_navigator', 170);
        }
      }

      // Check Helicopter Rescue flare signal
      if (this.level.hasHelicopterRescue && this.helipadPos) {
        const dHeli = this.helipadPos.distanceTo(this.playerPos);
        if (dHeli < 18) {
          this.helicopterInbound = true;
          this.showBanner('Flare spotted! Rescue helicopter descending to Helipad!');
          const hm = this.missions.find((m) => m.type === 'signal_helicopter');
          if (hm && !hm.completed) {
            this.completePrimaryMission(hm);
            this.awardPoints(120);
            this.awardBadge('heli_signal', 180);
          }
          this.pushTelemetry();
          return;
        }
      }

      if (this.level.id === 11 && -this.playerPos.z > this.level.ridgeLength * 0.92) {
        this.awardPoints(150);
        this.showBanner('Summit Flare blazing across the Karakoram sky!');
      } else if (scaredCount > 0) {
        this.showBanner('Magnesium Flare ignited — snow predator fleeing in panic!');
        for (const w of this.wildlifeList) {
          if (w.pos.distanceTo(this.playerPos) < 28) {
            w.repelled = true;
          }
        }
        const wm = this.missions.find((m) => m.type === 'repel_wildlife');
        if (wm && !wm.completed && this.wildlifeList.every((wl) => wl.repelled)) {
          this.completePrimaryMission(wm);
          this.awardPoints(100);
          this.awardBadge('predator_deterrent', 150);
        }
      } else {
        this.showBanner('Emergency Flare lit (18s illumination & wildlife deterrent)');
      }
      this.syncPersistentProgress();
      this.pushTelemetry();
      return;
    }

    if (id === 'radio') {
      const w = this.getCurrentWeather();
      const nextW = this.level.weatherCycle[(this.weatherIndex + 1) % this.level.weatherCycle.length];
      if (this.level.specialMission === 'night_search') {
        this.showBanner(
          `VHF Beacon Lock: ${this.radioSignalStrength}% signal strength — follow rising meter!`
        );
      } else {
        this.showBanner(
          `Base Camp Radio: Current ${w.toUpperCase()} — Next front: ${nextW.toUpperCase()}. Hold steady.`
        );
      }
      this.pushTelemetry();
    }
  }

  public useOxygenCanister() {
    this.useEquipment('oxygen');
  }

  public useRation() {
    this.useEquipment('food');
  }

  public useWater() {
    this.useEquipment('water');
  }

  public repairGear() {
    if (this.mode !== 'playing') return;
    const biners = this.getItem('carabiners');
    if (!this.isPlayerNearCampfire() && (!biners || biners.quantity <= 0)) {
      this.showBanner('Need Mid-Camp fire or spare hardware to repair gear!');
      return;
    }
    if (!this.isPlayerNearCampfire() && biners) {
      biners.quantity -= 1;
    }
    for (const item of this.equipment) {
      item.durability = Math.min(100, item.durability + 42);
    }
    audioEngine.playRepair();
    this.showBanner('Crampons, axes & boots repaired (+42% Durability)');
    this.syncPersistentProgress();
    this.pushTelemetry();
  }

  public toggleHeadlamp() {
    if (!this.headlampOn && this.headlampBattery <= 0) {
      this.showBanner('Headlamp battery depleted! Swap spare cell in Pack or visit Mid-Camp.');
      return;
    }
    this.headlampOn = !this.headlampOn;
    audioEngine.playHeadlampClick();
    this.applyHeadlampVisual();
    this.pushTelemetry();
  }

  public triggerInteract() {
    this.input.interactQueued = true;
  }

  public triggerJump() {
    this.input.jumpQueued = true;
    if (this.activeQte && this.activeQte.requiredAction === 'jump') {
      this.completeQte();
    }
  }

  public triggerLeftIceAxe() {
    this.input.axeLeftQueued = true;
    if (this.activeQte && this.activeQte.requiredAction === 'axe_left') {
      this.completeQte();
    }
  }

  public triggerRightIceAxe() {
    this.input.axeRightQueued = true;
    if (this.activeQte && this.activeQte.requiredAction === 'axe_right') {
      this.completeQte();
    }
  }

  public triggerRopeStep() {
    this.input.ropeQueued = true;
  }

  public triggerRecoverRope() {
    this.input.recoverRopeQueued = true;
  }

  public triggerPushObstacle() {
    this.input.pushQueued = true;
    if (this.activeQte && this.activeQte.requiredAction === 'push') {
      this.completeQte();
    }
  }

  public triggerQteResponse() {
    if (!this.activeQte) return;
    if (this.activeQte.requiredAction === 'axe_left') this.triggerLeftIceAxe();
    else if (this.activeQte.requiredAction === 'axe_right') this.triggerRightIceAxe();
    else if (this.activeQte.requiredAction === 'jump') this.triggerJump();
    else if (this.activeQte.requiredAction === 'push') this.triggerPushObstacle();
    else if (this.activeQte.requiredAction === 'flare') this.useEquipment('flare');
  }

  private awardPoints(pts: number) {
    this.sessionPoints += pts;
  }

  private awardBadge(badgeId: string, bonusPoints: number) {
    if (!this.newlyEarnedBadges.includes(badgeId)) {
      this.newlyEarnedBadges.push(badgeId);
      this.sessionPoints += bonusPoints;
    }
  }

  private startQte(
    id: string,
    title: string,
    prompt: string,
    requiredAction: ActiveQteEvent['requiredAction'],
    keyLabel: string,
    durationSec: number
  ) {
    if (this.activeQte) return;
    audioEngine.playQteAlert();
    this.activeQte = {
      id,
      title,
      prompt,
      requiredAction,
      keyLabel,
      timeRemaining: durationSec,
      maxTime: durationSec,
      progress: 0,
    };
  }

  private completeQte() {
    if (!this.activeQte) return;
    const finished = this.activeQte;
    this.activeQte = null;
    audioEngine.playQteSuccess();
    this.awardPoints(120);
    if (finished.id === 'rope_break_qte') {
      this.awardBadge('quick_reflex', 140);
      this.showBanner('DEAD-STOP ICE AXE ARREST! Caught the snapped rope fall (+120 pts)');
    } else {
      this.showBanner(`${finished.title} — Survived! (+120 pts)`);
    }
    this.pushTelemetry();
  }

  private showBanner(text: string) {
    this.statusBanner = text;
    this.statusBannerTimer = 3.2;
  }

  private notifyMission(title: string, subtitle: string) {
    this.missionNotification = { title, subtitle };
    this.missionNotificationTimer = 4.2;
  }

  private getCurrentPrimaryMission(): MissionStep | undefined {
    const primary = this.missions.filter((m) => !m.optional);
    return primary.find((m) => !m.completed) || primary[primary.length - 1];
  }

  private syncPersistentProgress() {
    if (!this.onProgressSync || !this.level) return;
    const completedMissionIds = this.missions.filter((m) => m.completed).map((m) => m.id);
    const inventory: Record<string, { quantity: number; durability: number }> = {};
    for (const item of this.equipment) {
      inventory[item.id] = {
        quantity: item.quantity,
        durability: Math.round(item.durability),
      };
    }
    this.onProgressSync({
      levelId: this.level.id,
      completedMissionIds,
      inventory,
    });
  }

  private completePrimaryMission(mission: MissionStep) {
    if (mission.completed) return;
    mission.completed = true;
    if (mission.progressTarget !== undefined) {
      mission.progressCurrent = mission.progressTarget;
    }
    if (!mission.optional) {
      const next = this.missions.find((m) => !m.optional && !m.completed);
      if (next) {
        this.notifyMission('OBJECTIVE COMPLETE', `Next: ${next.label}`);
      } else {
        this.notifyMission('OBJECTIVE COMPLETE', 'Proceed to final Summit / Camp');
      }
    } else {
      this.notifyMission('OPTIONAL OBJECTIVE COMPLETE', mission.label);
    }
    this.syncPersistentProgress();
  }

  private findNearestAnchorSlot(): { slot: AnchorSlot | null; dist: number } {
    if (!this.terrain) return { slot: null, dist: Infinity };
    let best: AnchorSlot | null = null;
    let bestDist = Infinity;
    for (const slot of this.terrain.anchorSlots) {
      const sy = this.terrain.getHeightAt(slot.x, slot.z);
      const d = Math.hypot(this.playerPos.x - slot.x, this.playerPos.y - sy, this.playerPos.z - slot.z);
      if (d < bestDist) {
        bestDist = d;
        best = slot;
      }
    }
    return { slot: best, dist: bestDist };
  }

  private clearRopeRig(refundRope: boolean, refundPiton: boolean) {
    if (refundRope) {
      const rope = this.getItem('rope');
      if (rope) rope.quantity += 1;
    }
    if (refundPiton) {
      const biners = this.getItem('carabiners');
      if (biners) biners.quantity += 1;
    }
    this.ropeRigState = 'none';
    this.anchorPos = null;
    this.ropeTension = 0;
    if (this.anchorMesh) {
      this.worldGroup.remove(this.anchorMesh);
      this.anchorMesh = null;
    }
    if (this.tetherLine) {
      this.worldGroup.remove(this.tetherLine);
      this.tetherLine.geometry.dispose();
      (this.tetherLine.material as THREE.Material).dispose();
      this.tetherLine = null;
    }
  }

  private handleManualRopeInput() {
    const biners = this.getItem('carabiners');
    const rope = this.getItem('rope');
    const { slot, dist } = this.findNearestAnchorSlot();
    const nearSlot = slot && dist < 3.8 ? slot : null;

    if (this.input.recoverRopeQueued) {
      this.input.recoverRopeQueued = false;
      if (this.ropeRigState === 'none') return;
      const distToAnchor = this.anchorPos ? this.anchorPos.distanceTo(this.playerPos) : 99;
      const wasSecured = this.ropeRigState === 'rope_secured';
      this.clearRopeRig(wasSecured, distToAnchor < 3.8);
      audioEngine.playRopeClip();
      this.showBanner(
        distToAnchor < 3.8
          ? 'Rope & anchor piton recovered into pack'
          : 'Unclipped from anchor (piton left behind)'
      );
      return;
    }

    if (!this.input.ropeQueued) return;
    this.input.ropeQueued = false;

    // Step 1: Place anchor piton
    if (this.ropeRigState === 'none') {
      if (!biners || biners.quantity <= 0) {
        this.showBanner('No Carabiners / Pitons left to set an anchor!');
        return;
      }
      biners.quantity -= 1;

      if (nearSlot) {
        const sy = this.terrain!.getHeightAt(nearSlot.x, nearSlot.z);
        this.anchorPos = new THREE.Vector3(nearSlot.x, sy, nearSlot.z);
        this.anchorStability = nearSlot.stability;
      } else {
        this.anchorPos = this.playerPos.clone();
        const inSnow = this.terrain ? this.terrain.isInDeepSnow(this.playerPos.x, this.playerPos.z) : false;
        this.anchorStability = inSnow ? 40 : 78;
      }

      this.anchorMesh = createSafetyPitonModel();
      this.anchorMesh.position.copy(this.anchorPos);
      this.worldGroup.add(this.anchorMesh);
      this.ropeRigState = 'anchor_placed';
      this.ropeTension = 5;
      audioEngine.playRopeClip();

      if (this.anchorStability < 50) {
        this.showBanner(
          `WARNING: Loose anchor (${this.anchorStability}% stability)! Press R to attach rope or Shift+R to pull.`
        );
      } else {
        this.showBanner(
          `Solid Anchor placed (${this.anchorStability}% stability) — Press R again to attach rope`
        );
      }
      return;
    }

    // Step 2: Attach dynamic climbing rope to placed anchor
    if (this.ropeRigState === 'anchor_placed' && this.anchorPos) {
      if (this.anchorPos.distanceTo(this.playerPos) > 5.0) {
        this.showBanner('Move back within 5m of your anchor to thread the rope!');
        return;
      }
      if (!rope || rope.quantity <= 0) {
        this.showBanner('No Climbing Rope left in pack!');
        return;
      }
      rope.quantity -= 1;

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        this.anchorPos.clone().add(new THREE.Vector3(0, 0.55, 0)),
        this.playerPos.clone().add(new THREE.Vector3(0, 0.95, 0)),
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: this.anchorStability < 50 ? 0xf59e0b : 0x38bdf8,
      });
      this.tetherLine = new THREE.Line(lineGeo, lineMat);
      this.worldGroup.add(this.tetherLine);
      this.ropeRigState = 'rope_secured';
      this.ropeTension = 18;
      audioEngine.playRopeClip();
      this.showBanner('Climbing Rope secured! Max pitch 28m. Press R near anchor to recover.');

      const slope = this.terrain ? this.terrain.getSlopeDegrees(this.playerPos.x, this.playerPos.z) : 0;
      const installM = this.missions.find((m) => m.type === 'install_rope');
      if (installM && !installM.completed && (slope > 22 || (nearSlot && nearSlot.purpose === 'icewall'))) {
        this.completePrimaryMission(installM);
      }
      return;
    }

    // Step 3: While secured — either recover near anchor OR leapfrog an intermediate anchor
    if (this.ropeRigState === 'rope_secured' && this.anchorPos) {
      const distToAnchor = this.anchorPos.distanceTo(this.playerPos);
      if (distToAnchor < 3.6) {
        this.clearRopeRig(true, true);
        audioEngine.playRopeClip();
        this.showBanner('Recovered climbing rope and piton into pack');
        return;
      }

      if (!biners || biners.quantity <= 0) {
        this.showBanner('Out of pitons for intermediate anchor (press Shift+R to unclip)');
        return;
      }
      biners.quantity -= 1;

      if (this.anchorMesh) {
        this.worldGroup.remove(this.anchorMesh);
      }
      if (nearSlot) {
        const sy = this.terrain!.getHeightAt(nearSlot.x, nearSlot.z);
        this.anchorPos = new THREE.Vector3(nearSlot.x, sy, nearSlot.z);
        this.anchorStability = nearSlot.stability;
      } else {
        this.anchorPos = this.playerPos.clone();
        this.anchorStability = 82;
      }
      this.anchorMesh = createSafetyPitonModel();
      this.anchorMesh.position.copy(this.anchorPos);
      this.worldGroup.add(this.anchorMesh);
      this.ropeTension = 16;
      audioEngine.playRopeClip();
      this.showBanner(`Intermediate anchor set (${this.anchorStability}% stability) — rope line extended!`);

      const slope = this.terrain ? this.terrain.getSlopeDegrees(this.playerPos.x, this.playerPos.z) : 0;
      const installM = this.missions.find((m) => m.type === 'install_rope');
      if (installM && !installM.completed && (slope > 22 || (nearSlot && nearSlot.purpose === 'icewall'))) {
        this.completePrimaryMission(installM);
      }
    }
  }

  private updateRopeTetherPhysics(dt: number) {
    if (!this.anchorPos) return;

    if (this.ropeRigState === 'anchor_placed') {
      const d = this.anchorPos.distanceTo(this.playerPos);
      if (d > 14) {
        this.showBanner('Walked away from unroped piton anchor');
        this.clearRopeRig(false, false);
      }
      return;
    }

    if (this.ropeRigState !== 'rope_secured' || !this.tetherLine) return;

    const dist = this.anchorPos.distanceTo(this.playerPos);
    const maxPitch = 28.0 + this.gearUpgrades.ropeLine * 4.0;

    if (dist > maxPitch) {
      this.ropeTension = Math.min(100, this.ropeTension + 55 * dt);
      // Physical rope tension pulls back toward anchor
      _vec3.copy(this.anchorPos).sub(this.playerPos).normalize();
      this.playerPos.addScaledVector(_vec3, (dist - maxPitch) * 0.85);
      if (this.statusBannerTimer <= 0) {
        this.showBanner(`Rope at ${Math.round(maxPitch)}m limit! Press R for mid-anchor or Shift+R to unclip.`);
      }
    } else {
      this.ropeTension = THREE.MathUtils.damp(this.ropeTension, 15 + (dist / maxPitch) * 35, 3, dt);
    }

    // Poor anchor pull-out failure under high load
    if (this.anchorStability < 50 && this.ropeTension > 76) {
      audioEngine.playIceCrack();
      this.clearRopeRig(false, false);
      this.showBanner('POOR ANCHOR PULLED OUT UNDER TENSION!');
      return;
    }

    const posAttr = this.tetherLine.geometry.attributes.position as THREE.BufferAttribute;
    posAttr.setXYZ(0, this.anchorPos.x, this.anchorPos.y + 0.55, this.anchorPos.z);
    posAttr.setXYZ(1, this.playerPos.x, this.playerPos.y + 0.95, this.playerPos.z);
    posAttr.needsUpdate = true;
  }

  private bindEvents() {
    const canvas = this.renderer.domElement;

    const onResize = () => {
      if (this.disposed) return;
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const onWheel = (e: WheelEvent) => {
      if (this.mode !== 'playing') return;
      this.adjustZoom(e.deltaY * 0.005);
    };
    canvas.addEventListener('wheel', onWheel, { passive: true });

    const onPointerDown = (e: PointerEvent) => {
      audioEngine.init();
      if (this.mode !== 'playing') return;
      this.activePointerId = e.pointerId;
      this.draggingLook = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!this.draggingLook) return;
      if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      const sens =
        (this.cameraMode === 'first_person' ? 0.0058 : 0.0048) * this.settings.cameraSensitivity;
      this.cameraYaw -= dx * sens;
      const ySign = this.settings.invertY ? -1 : 1;
      const minPitch = this.cameraMode === 'first_person' ? -0.82 : -0.1;
      const maxPitch = this.cameraMode === 'first_person' ? 0.82 : 0.72;
      this.cameraPitch = THREE.MathUtils.clamp(
        this.cameraPitch + dy * sens * ySign,
        minPitch,
        maxPitch
      );
    };

    const onPointerUp = (e: PointerEvent) => {
      if (this.activePointerId === null || e.pointerId === this.activePointerId) {
        this.draggingLook = false;
        this.activePointerId = null;
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    this.cleanupListeners = () => {
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }

  private cleanupListeners: () => void = () => {};

  private getCurrentWeather(): WeatherType {
    const cycle = this.level.weatherCycle;
    return cycle[this.weatherIndex % cycle.length];
  }

  private isPlayerInsideShelter(): boolean {
    const shelterProp = this.props.find((p) => p.type === 'shelter');
    if (shelterProp && shelterProp.position.distanceTo(this.playerPos) < 3.6) return true;
    if (this.pitchedTentPos && this.pitchedTentPos.distanceTo(this.playerPos) < 3.4) return true;
    return false;
  }

  private isPlayerNearCampfire(): boolean {
    const fireProp = this.props.find((p) => p.type === 'midcamp');
    return Boolean(fireProp && fireProp.position.distanceTo(this.playerPos) < 4.2);
  }

  private updateAtmosphere(dt: number, elapsed: number) {
    const tMode = this.settings.timeMode || 'auto';
    if (tMode === 'day') {
      this.timeOfDay = 0.48;
    } else if (tMode === 'night') {
      this.timeOfDay = 0.94;
    } else if (tMode === 'dynamic') {
      this.timeOfDay = (this.timeOfDay + dt * 0.0028) % 1.0;
    } else {
      this.timeOfDay = (this.timeOfDay + dt * this.level.daySpeed) % 1.0;
    }

    this.weatherTimer += dt;
    if (this.weatherTimer > 38) {
      this.weatherTimer = 0;
      this.weatherIndex = (this.weatherIndex + 1) % this.level.weatherCycle.length;
      const w = this.getCurrentWeather();
      if (this.mode === 'playing') {
        if (w === 'blizzard') this.showBanner('Blizzard Warning: Near-zero visibility & biting gusts!');
        else if (w === 'thunder_snow') this.showBanner('High-altitude lightning storm approaching!');
        else if (w === 'snowstorm') this.showBanner('Snowstorm intensifying along the ridge');
        else if (w === 'clear') this.showBanner('Clouds parting briefly across the Karakoram');
      }
    }

    const weather = this.getCurrentWeather();
    const sunAngle = (this.timeOfDay - 0.25) * Math.PI * 2;
    const sunElev = Math.sin(sunAngle);
    const sunCos = Math.cos(sunAngle);
    const dayFactor = THREE.MathUtils.clamp((sunElev + 0.14) / 0.56, 0, 1);
    const nightFactor = 1 - dayFactor;
    const sunsetFactor = THREE.MathUtils.clamp(1 - Math.abs(sunElev - 0.04) / 0.24, 0, 1);

    if (this.mode === 'playing' && nightFactor > 0.72 && !this.headlampOn && !this.nightHintShown) {
      this.nightHintShown = true;
      this.showBanner('Nightfall across the Karakoram — Press [3] to ignite your Headlamp!');
    }

    // Low-angle sunrise/sunset casts long shadows; night switches directional light to moonlight arc
    const lightDirX = sunElev >= -0.05 ? sunCos : -sunCos;
    const lightDirY = Math.max(0.24, Math.abs(sunElev));
    const lightDirZ = sunElev >= -0.05 ? -0.42 : -0.58;
    this.sunLight.position.set(
      this.playerPos.x + lightDirX * 72,
      this.playerPos.y + lightDirY * 68,
      this.playerPos.z + lightDirZ * 56
    );
    this.sunLight.target.position.copy(this.playerPos);
    this.sunLight.target.updateMatrixWorld();

    this.rimLight.position.set(
      this.playerPos.x - lightDirX * 42,
      this.playerPos.y + 24,
      this.playerPos.z - 55
    );
    this.rimLight.target.position.copy(this.playerPos);
    this.rimLight.target.updateMatrixWorld();

    // Update Atmospheric Sky Dome Uniforms (Zenith, Horizon, Solar/Lunar vectors, Clouds)
    this.skyUniforms.uSunDir.value.set(sunCos, sunElev, -0.45).normalize();
    this.skyUniforms.uMoonDir.value.set(-sunCos * 0.85, Math.max(0.18, -sunElev + 0.25), -0.55).normalize();
    this.skyUniforms.uDayFactor.value = dayFactor;
    this.skyUniforms.uSunsetFactor.value = sunsetFactor;
    this.skyUniforms.uNightFactor.value = nightFactor;
    this.skyUniforms.uTime.value = elapsed;

    const nightZenith = 0x050a14;
    const duskZenith = 0x1e3556;
    const dayZenith = 0x204d82;
    const zenithCol = this.skyUniforms.uZenithColor.value;
    if (dayFactor < 0.35) {
      zenithCol.setHex(nightZenith).lerp(_fogColor.setHex(duskZenith), dayFactor / 0.35);
    } else {
      zenithCol.setHex(duskZenith).lerp(_fogColor.setHex(dayZenith), (dayFactor - 0.35) / 0.65);
    }

    const nightHorizon = 0x0d1728;
    const dawnHorizon = 0xc97b52;
    const dayHorizon = 0x99bddb;

    if (dayFactor < 0.38) {
      _skyColor.setHex(nightHorizon).lerp(_fogColor.setHex(dawnHorizon), dayFactor / 0.38);
    } else {
      _skyColor.setHex(dawnHorizon).lerp(_fogColor.setHex(dayHorizon), (dayFactor - 0.38) / 0.62);
    }

    let fogDensity = 0.00095 + nightFactor * 0.00145;
    let snowIntensity = 0.16;
    let cloudDensity = 0.28;
    if (weather === 'overcast') {
      fogDensity = 0.0016 + nightFactor * 0.0012;
      cloudDensity = 0.72;
      _skyColor.lerp(_fogColor.setHex(0x6e849b), 0.35 * (0.4 + 0.6 * dayFactor));
    } else if (weather === 'fog') {
      fogDensity = 0.0044 + nightFactor * 0.0012;
      cloudDensity = 0.85;
      _skyColor.lerp(_fogColor.setHex(0x8aa0b5), 0.45 * (0.35 + 0.65 * dayFactor));
    } else if (weather === 'snowfall') {
      fogDensity = 0.0025 + nightFactor * 0.0013;
      snowIntensity = 0.65;
      cloudDensity = 0.78;
      _skyColor.lerp(_fogColor.setHex(0x758ca3), 0.38 * (0.35 + 0.65 * dayFactor));
    } else if (weather === 'snowstorm' || weather === 'thunder_snow') {
      fogDensity = 0.0041 + nightFactor * 0.0014;
      snowIntensity = 1.08;
      cloudDensity = 0.92;
      _skyColor.lerp(_fogColor.setHex(0x4f6378), 0.55 * (0.35 + 0.65 * dayFactor));
    } else if (weather === 'blizzard') {
      fogDensity = 0.0056 + nightFactor * 0.0015;
      snowIntensity = 1.48;
      cloudDensity = 0.98;
      _skyColor.lerp(_fogColor.setHex(0x5a6e82), 0.6 * (0.35 + 0.65 * dayFactor));
    } else if (weather === 'windy') {
      fogDensity = 0.0017 + nightFactor * 0.0012;
      snowIntensity = 0.44;
      cloudDensity = 0.46;
    }

    // Lightning flash in storm stages
    if (this.level.hasLightning && (weather === 'thunder_snow' || weather === 'snowstorm')) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 11 + Math.random() * 10;
        this.lightningFlash = 1.0;
        audioEngine.playThunder();
      }
    }
    this.lightningFlash = Math.max(0, this.lightningFlash - dt * 3.8);
    this.skyUniforms.uLightning.value = this.lightningFlash;
    this.skyUniforms.uCloudDensity.value = cloudDensity;
    this.skyUniforms.uHorizonColor.value.copy(_skyColor);
    if (this.lightningFlash > 0.05) {
      _skyColor.lerp(_fogColor.setHex(0xcbe0f5), this.lightningFlash * 0.55);
    }

    this.scene.background = _skyColor;
    this.fog.color.copy(_skyColor);
    this.fog.density = THREE.MathUtils.damp(this.fog.density, fogDensity, 2.0, dt);
    this.visibilityMeters = Math.round(
      THREE.MathUtils.clamp(3.2 / Math.max(0.001, this.fog.density), 45, 950)
    );

    // True Darkness at Night + Warm Golden Low-Angle Sunset + Crisp Midday Snow Reflection
    const weatherDim = weather === 'blizzard' ? 0.7 : weather === 'snowstorm' ? 0.8 : 1.0;
    const moonIntensity = 0.36;
    const sunBase = 2.15 - sunsetFactor * 0.5;
    this.sunLight.intensity =
      THREE.MathUtils.lerp(moonIntensity, sunBase, dayFactor) * weatherDim + this.lightningFlash * 1.6;
    if (dayFactor < 0.18) {
      _sunColor.setHex(0x88acd6); // cool silver-blue moonlight
    } else if (sunsetFactor > 0.38) {
      _sunColor.setHex(0xf6985a); // golden-orange sunset/sunrise light
    } else {
      _sunColor.setHex(0xfff5e8);
    }
    this.sunLight.color.copy(_sunColor);
    this.skyUniforms.uSunColor.value.copy(_sunColor);

    this.hemiLight.intensity = THREE.MathUtils.lerp(0.16, 0.86, dayFactor) * weatherDim;
    this.hemiLight.color.setHex(dayFactor < 0.25 ? 0x263f66 : 0xaad0f2);
    this.hemiLight.groundColor.setHex(dayFactor < 0.25 ? 0x0d1522 : 0x3b495c);
    this.rimLight.intensity = THREE.MathUtils.lerp(0.2, 0.58, dayFactor);

    if (!this.isSoftwareGl) {
      this.scene.environmentIntensity = THREE.MathUtils.lerp(0.14, 0.84, dayFactor);
    }
    if (this.terrainMat) {
      this.terrainMat.roughness = THREE.MathUtils.clamp(
        0.86 - sunsetFactor * 0.1 + nightFactor * 0.05,
        0.7,
        0.94
      );
      this.terrainMat.envMapIntensity = THREE.MathUtils.lerp(0.18, 0.75, dayFactor);
    }

    if (this.starField) {
      const starMat = this.starField.material as THREE.PointsMaterial;
      const weatherClear = weather === 'clear' || weather === 'windy' || weather === 'overcast' ? 1 : 0.28;
      starMat.opacity = Math.max(0, (1 - dayFactor * 1.45) * 0.92 * weatherClear);
    }

    // Animate Glacial Rivers & Flood Surge
    if (this.rivers.length > 0) {
      this.floodWaterLevel = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(elapsed * 0.24));
      let minRiverDist = 999;
      for (const r of this.rivers) {
        r.mesh.position.y = r.bedHeight + 0.25 + this.floodWaterLevel * 1.1;
        minRiverDist = Math.min(minRiverDist, Math.abs(this.playerPos.z - r.zCenter));
      }
      const riverAudio = this.mode === 'playing' ? THREE.MathUtils.clamp(1 - minRiverDist / 45, 0, 1) : 0;
      audioEngine.setRiverVolume(riverAudio * (0.45 + this.floodWaterLevel * 0.55));
    } else {
      audioEngine.setRiverVolume(0);
    }

    if (this.snowParticles && this.snowPositions && this.snowVelocities) {
      const mat = this.snowParticles.material as THREE.PointsMaterial;
      mat.opacity = Math.min(0.92, 0.22 + snowIntensity * 0.52);

      const windMul = 0.55 + snowIntensity * 2.2;
      for (let i = 0; i < this.snowCount; i++) {
        const ix = i * 3;
        this.snowPositions[ix] += this.snowVelocities[ix] * windMul * dt;
        this.snowPositions[ix + 1] +=
          this.snowVelocities[ix + 1] * (0.7 + snowIntensity * 0.5) * dt;
        this.snowPositions[ix + 2] += this.snowVelocities[ix + 2] * windMul * dt;

        if (this.snowPositions[ix + 1] < this.playerPos.y - 4) {
          this.snowPositions[ix] = this.playerPos.x + (Math.random() - 0.5) * 44;
          this.snowPositions[ix + 1] = this.playerPos.y + 16 + Math.random() * 8;
          this.snowPositions[ix + 2] = this.playerPos.z + (Math.random() - 0.5) * 44;
        }
        if (this.snowPositions[ix] < this.playerPos.x - 24) {
          this.snowPositions[ix] = this.playerPos.x + 22;
        }
      }
      this.snowParticles.geometry.attributes.position.needsUpdate = true;
    }

    const windLevel = Math.min(1, this.level.windBase + snowIntensity * 0.42);
    audioEngine.updateWind(windLevel, elapsed);
  }

  private updatePlayer(dt: number, elapsed: number) {
    if (!this.terrain || !this.playerRig) return;

    // 1. Manual Rope Rigging & Anchor Evaluation
    this.handleManualRopeInput();
    this.updateRopeTetherPhysics(dt);

    const insideCave = this.terrain.isInsideIceCave(this.playerPos.x, this.playerPos.z);
    const nrInfo = this.terrain.isOnNarrowRidge(this.playerPos.x, this.playerPos.z);
    const inDeepSnow = this.terrain.isInDeepSnow(this.playerPos.x, this.playerPos.z);
    const inRockfall = this.terrain.isInRockfallZone(this.playerPos.z);
    const slope = this.terrain.getSlopeDegrees(this.playerPos.x, this.playerPos.z);
    const wantsMove = Math.hypot(this.input.moveX, this.input.moveY) > 0.08;
    const isClimbing = this.input.climb && slope > 21 && this.stamina > 3;
    const isCrouching = this.input.crouch && !isClimbing;
    const canSprint =
      this.input.sprint &&
      !isClimbing &&
      !isCrouching &&
      !inDeepSnow &&
      this.stamina > 6 &&
      this.hunger > 10;

    // Update Live Mission Progress & Check Strictly Performed Completions
    const valleyM = this.missions.find((m) => m.type === 'trek_valley');
    if (valleyM && !valleyM.completed) {
      const targetZ = this.level.ridgeLength * 0.16;
      valleyM.progressCurrent = Math.min(Math.round(targetZ), Math.max(0, Math.round(-this.playerPos.z)));
      if (this.playerPos.z < -targetZ) {
        this.completePrimaryMission(valleyM);
      }
    }

    const rockM = this.missions.find((m) => m.type === 'survive_rockfall');
    if (rockM && !rockM.completed && this.terrain.rockfallZones.length > 0) {
      const endZ = this.terrain.rockfallZones[0].zEnd;
      const rockTarget = Math.max(1, Math.round(Math.abs(endZ - 2)));
      rockM.progressCurrent = Math.min(rockTarget, Math.max(0, Math.round(-this.playerPos.z)));
      if (this.playerPos.z < endZ - 2) {
        this.completePrimaryMission(rockM);
      }
    }

    let inWaterCurrent = false;
    for (const r of this.rivers) {
      if (Math.abs(this.playerPos.z - r.zCenter) < r.halfWidthZ) {
        inWaterCurrent = true;
      }
      const floodM = this.missions.find((m) => m.type === 'cross_flood');
      if (floodM && !floodM.completed && this.playerPos.z < r.zCenter - r.halfWidthZ - 2) {
        this.completePrimaryMission(floodM);
      }
    }

    const campM = this.missions.find((m) => m.type === 'reach_camp');
    if (campM && !campM.completed) {
      campM.progressCurrent = Math.min(this.level.ridgeLength, Math.max(0, Math.round(-this.playerPos.z)));
    }

    let inLandslide = false;
    for (const ls of this.terrain.landslides) {
      if (this.playerPos.z <= ls.zStart && this.playerPos.z >= ls.zEnd) {
        inLandslide = true;
        if (this.landslideWarningTimer <= 0) {
          this.landslideWarningTimer = 4.0;
          this.showBanner('Unstable landslide scree! Keep moving or anchor.');
        }
      }
    }
    this.landslideWarningTimer = Math.max(0, this.landslideWarningTimer - dt);

    // 2. Dual Independent Ice-Axe Mechanics (Q Left / E Right) — Climbing + Emergency Wildlife Defense
    if (this.leftAxeSwingTimer > 0) this.leftAxeSwingTimer = Math.max(0, this.leftAxeSwingTimer - dt);
    if (this.rightAxeSwingTimer > 0) this.rightAxeSwingTimer = Math.max(0, this.rightAxeSwingTimer - dt);

    const processAxeSwing = (side: 'left' | 'right') => {
      if (this.stamina < 4.5) {
        this.showBanner('Too exhausted to swing ice axe!');
        return;
      }
      audioEngine.playIceAxe();
      if (side === 'left') this.leftAxeSwingTimer = 0.28;
      else this.rightAxeSwingTimer = 0.28;

      const alternated = this.lastAxeSide !== null && this.lastAxeSide !== side;
      this.lastAxeSide = side;
      this.stamina = Math.max(0, this.stamina - 4.2);
      this.degradeGear(['ice_axes', 'gloves'], 0.4);
      this.gripStrength = Math.min(100, this.gripStrength + (alternated ? 28 : 16));

      // Check Emergency Wildlife Defense Strike
      let hitPredator = false;
      for (const w of this.wildlifeList) {
        if (w.repelled) continue;
        const dPred = w.pos.distanceTo(this.playerPos);
        if (dPred < 3.9) {
          hitPredator = true;
          const dmg = 1 + (this.gearUpgrades.iceAxes >= 2 ? 1 : 0);
          w.hp -= dmg;
          audioEngine.playIceCrack();
          // Knock predator back along vector away from player
          _vec3.copy(w.pos).sub(this.playerPos).setY(0).normalize();
          w.pos.addScaledVector(_vec3, 4.2);
          w.attackCooldown = 2.0;
          if (w.hp <= 0) {
            w.repelled = true;
            w.fleeTimer = 10.0;
            this.showBanner('Ice Axe strike drove the snow predator back into the storm! (+150 pts)');
            this.awardPoints(150);
            this.awardBadge('predator_deterrent', 150);
            const wm = this.missions.find((m) => m.type === 'repel_wildlife');
            if (wm) {
              wm.progressCurrent = this.wildlifeList.filter((wl) => wl.repelled).length;
              if (this.wildlifeList.every((wl) => wl.repelled)) {
                this.completePrimaryMission(wm);
              }
            }
          } else {
            this.showBanner('Direct Ice Axe defense hit! Swing again to drive predator away!');
          }
        }
      }

      if (!hitPredator && (slope > 22 || isClimbing)) {
        const axeUpgradeBonus = 1 + this.gearUpgrades.iceAxes * 0.14;
        const surge = (alternated ? 1.45 : 0.65) * axeUpgradeBonus;
        this.playerPos.z -= surge;
        this.playerPos.y = Math.max(
          this.playerPos.y,
          this.terrain!.getHeightAt(this.playerPos.x, this.playerPos.z)
        );
        if (this.statusBannerTimer <= 0) {
          this.showBanner(
            alternated
              ? `${side === 'left' ? 'Left' : 'Right'} Axe Bite! (Alternating Surge)`
              : `Same-side axe hit — alternate Q & E for full climb surge`
          );
        }
      }
    };

    if (this.input.axeLeftQueued) {
      this.input.axeLeftQueued = false;
      processAxeSwing('left');
    }
    if (this.input.axeRightQueued) {
      this.input.axeRightQueued = false;
      processAxeSwing('right');
    }

    // 3. Grip Strength & Slipping on Steep Ice
    const gearIntegrity = this.getGearIntegrity();
    if (isClimbing && slope > 28) {
      const gripDrain =
        (8.2 + (this.temperature < 25 ? 5.5 : 0) + (gearIntegrity < 45 ? 4.5 : 0)) /
        this.character.perks.gripBonus;
      this.gripStrength = Math.max(0, this.gripStrength - gripDrain * dt);

      if (this.gripStrength <= 0) {
        audioEngine.playSlip();
        if (this.ropeRigState === 'rope_secured' && this.anchorPos) {
          this.ropeTension = Math.min(100, this.ropeTension + 48);
          if (this.anchorStability < 50 && this.ropeTension > 76) {
            this.clearRopeRig(false, false);
            this.playerPos.z += 5.0;
            this.playerPos.y = this.terrain.getHeightAt(this.playerPos.x, this.playerPos.z);
            this.health = Math.max(0, this.health - 20);
            this.showBanner('Poor anchor ripped out when your grip failed! (-20 Health)');
          } else {
            this.playerPos.copy(this.anchorPos);
            this.gripStrength = 48;
            this.showBanner('Grip failed! Secured climbing rope caught your fall.');
          }
        } else {
          this.playerPos.z += 5.5;
          this.playerPos.y = this.terrain.getHeightAt(this.playerPos.x, this.playerPos.z);
          this.health = Math.max(0, this.health - 18);
          this.degradeGear(['crampons', 'boots'], 8);
          this.gripStrength = 42;
          this.showBanner('Ice Grip Failed! Slipped unroped (-18 Health)');
        }
      }
    } else {
      this.gripStrength = Math.min(100, this.gripStrength + 14 * dt);
    }

    // 4. Narrow Ridge Balance Physics
    const weather = this.getCurrentWeather();
    if (nrInfo.active) {
      const gust = Math.sin(elapsed * 1.9) * (0.4 + this.level.windBase * 0.52);
      const crouchFactor = isCrouching ? 0.32 : 1.0;
      this.balance += (gust * crouchFactor + this.input.moveX * 0.85) * dt;
      this.balance = THREE.MathUtils.clamp(this.balance, -1.1, 1.1);

      if (Math.abs(this.balance) > 0.96 || Math.abs(nrInfo.offsetFromCenter) > 2.45) {
        audioEngine.playSlip();
        this.balance = 0;
        if (this.ropeRigState === 'rope_secured' && this.anchorPos) {
          this.ropeTension = Math.min(100, this.ropeTension + 45);
          this.playerPos.copy(this.anchorPos);
          this.showBanner('Lost balance on knife-edge! Climbing rope caught you.');
        } else {
          this.health = Math.max(0, this.health - 24);
          this.playerPos.copy(this.safeReturnPos);
          this.playerPos.z += 2.0;
          this.playerPos.y = this.terrain.getHeightAt(this.playerPos.x, this.playerPos.z);
          this.showBanner('Slipped off the narrow ridge! (-24 Health)');
        }
      }
    } else {
      this.balance = THREE.MathUtils.damp(this.balance, 0, 6, dt);
    }

    // 5. Terrain-Aware Movement Speed + Backpack Weight Factor
    const packKg = this.getPackWeightKg();
    const weightFactor = THREE.MathUtils.clamp(1.06 - (packKg - 12) * 0.012, 0.72, 1.05);

    const sinYaw = Math.sin(this.cameraYaw);
    const cosYaw = Math.cos(this.cameraYaw);
    const moveDirX = -sinYaw * this.input.moveY + cosYaw * this.input.moveX;
    const moveDirZ = -cosYaw * this.input.moveY - sinYaw * this.input.moveX;
    const moveLen = Math.hypot(moveDirX, moveDirZ);

    let speed = 4.6;
    if (canSprint) speed = 7.1;
    if (isCrouching) speed = 2.6;
    if (isClimbing) speed = 3.25 * this.character.perks.climbSpeed;

    speed *= weightFactor;
    if (inDeepSnow && !isClimbing) speed *= 0.66;
    if (inWaterCurrent) speed *= 0.56;
    if (inLandslide) speed *= 0.68;
    if (this.carryingTeammate) speed *= 0.88;
    if (weather === 'blizzard' && !insideCave) speed *= 0.76;
    else if ((weather === 'snowstorm' || weather === 'thunder_snow') && !insideCave) speed *= 0.86;
    if (this.oxygen < 22) speed *= 0.72;
    if (gearIntegrity < 35) speed *= 0.82;

    let slopeBlocked = false;
    if (slope > 38 && !isClimbing && moveDirZ < -0.1) {
      slopeBlocked = true;
      speed *= 0.22;
      if (this.statusBannerTimer <= 0) {
        this.showBanner('Steep Ice Face! Hold Climb (C) & alternate Left/Right Ice Axes (Q / E)');
      }
    }

    if (wantsMove && moveLen > 0.01) {
      const nx = moveDirX / moveLen;
      const nz = moveDirZ / moveLen;
      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, nx * speed, 10, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, nz * speed, 10, dt);

      if (this.cameraMode === 'first_person') {
        this.playerYaw = this.cameraYaw;
      } else {
        const targetYaw = Math.atan2(-nx, -nz);
        let diff = targetYaw - this.playerYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.playerYaw += diff * Math.min(1, dt * 10);
      }
    } else {
      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, 0, 12, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, 0, 12, dt);
      if (this.cameraMode === 'first_person') {
        this.playerYaw = this.cameraYaw;
      }
    }

    // Glacial flood lateral current push when wading unroped
    if (inWaterCurrent && this.grounded) {
      const currentPush = (1.15 + this.floodWaterLevel * 2.2) * (this.ropeRigState === 'rope_secured' ? 0.16 : 1.0);
      this.playerVel.x += currentPush * dt * 3.5;
      if (this.ropeRigState !== 'rope_secured' && this.floodWaterLevel > 0.72 && this.statusBannerTimer <= 0) {
        this.showBanner('Strong glacial current! Rig a safety rope (R) at the riverbank anchor!');
      }
    }

    // 6. Jump
    if (this.input.jumpQueued) {
      this.input.jumpQueued = false;
      if (this.grounded && this.stamina >= 11) {
        this.playerVel.y = 6.4;
        this.grounded = false;
        this.stamina = Math.max(0, this.stamina - 11);
      }
    }

    if (!this.grounded) {
      this.playerVel.y -= 17.5 * dt;
    }

    let nextX = this.playerPos.x + this.playerVel.x * dt;
    let nextZ = THREE.MathUtils.clamp(
      this.playerPos.z + this.playerVel.z * dt,
      -(this.level.ridgeLength + 12),
      10
    );

    // Block movement across uncleared fallen debris barricades
    for (const obs of this.obstacles) {
      if (obs.cleared) continue;
      if (Math.abs(nextZ - obs.pos.z) < 1.65 && Math.abs(nextX - obs.pos.x) < 2.2) {
        nextZ = Math.max(nextZ, obs.pos.z + 1.65);
        if (this.statusBannerTimer <= 0) {
          this.showBanner('Debris blocking ridge! Press [X] or Push button to shove clear.');
        }
      }
    }

    // Resolve solid environmental colliders (boulders, tree trunks, expedition tents)
    const playerRadius = 0.48;
    for (const col of this.solidColliders) {
      const dx = nextX - col.x;
      const dz = nextZ - col.z;
      const dist = Math.hypot(dx, dz);
      const minD = col.radius + playerRadius;
      if (dist < minD) {
        const inv = dist > 0.001 ? 1 / dist : 1;
        nextX = col.x + (dist > 0.001 ? dx * inv : 0) * minD;
        nextZ = col.z + (dist > 0.001 ? dz * inv : 1) * minD;
      }
    }

    const ridgeCenter = this.terrain.ridgeCenterX(nextZ);
    const clampedX = THREE.MathUtils.clamp(nextX, ridgeCenter - 15.5, ridgeCenter + 15.5);

    this.playerPos.x = clampedX;
    this.playerPos.z = nextZ;
    this.playerPos.y += this.playerVel.y * dt;

    const groundY = this.terrain.getHeightAt(this.playerPos.x, this.playerPos.z);
    if (this.playerPos.y <= groundY + 0.04) {
      this.playerPos.y = groundY;
      this.playerVel.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    // 7. Snow Bridge collapse logic
    const collapsedStates = this.bridges.map((b) => b.collapsed);
    this.bridges.forEach((b) => {
      if (!this.terrain || b.collapsed) return;
      const crev = this.terrain.crevasses[b.index];
      const onBridge =
        Math.abs(this.playerPos.z - crev.zCenter) < crev.halfWidthZ &&
        Math.abs(this.playerPos.x - crev.xBridgeCenter) <= crev.bridgeHalfWidthX;

      if (onBridge && this.grounded && !b.triggered) {
        b.triggered = true;
        audioEngine.playIceCrack();
        this.showBanner('Snow bridge cracking! Sprint or Jump across!');
      }
      if (b.triggered) {
        b.timer -= dt;
        b.mesh.position.y -= dt * 0.25;
        if (b.timer <= 0) {
          b.collapsed = true;
          b.mesh.visible = false;
        }
      }
    });

    if (
      this.grounded &&
      !this.terrain.isInsideCrevasse(this.playerPos.x, this.playerPos.z, collapsedStates) &&
      slope < 30 &&
      !nrInfo.active &&
      !inWaterCurrent
    ) {
      this.safeReturnPos.copy(this.playerPos);
    }

    // 8. Crevasse fall check
    if (
      this.grounded &&
      this.terrain.isInsideCrevasse(this.playerPos.x, this.playerPos.z, collapsedStates)
    ) {
      audioEngine.playIceCrack();
      if (this.ropeRigState === 'rope_secured' && this.anchorPos) {
        this.ropeTension = Math.min(100, this.ropeTension + 50);
        this.playerPos.copy(this.anchorPos);
        this.showBanner('Fell into crevasse — safety rope arrested the fall!');
      } else {
        this.health = Math.max(0, this.health - 32);
        this.temperature = Math.max(0, this.temperature - 14);
        this.degradeGear(['crampons', 'boots'], 10);
        this.playerPos.copy(this.safeReturnPos);
        this.playerPos.z += 2.2;
        this.playerPos.y = this.terrain.getHeightAt(this.playerPos.x, this.playerPos.z);
        this.playerVel.set(0, 0, 0);
        this.showBanner('Plunged into crevasse! Severe fall trauma (-32 Health)');
        if (this.health <= 0) {
          this.triggerFailure('Lost in a deep Karakoram glacial crevasse');
          return;
        }
      }
    }

    // 9. Realistic Human Skeletal Animation (Hips, Knees, Shoulders, Elbows, Breathing Vapor)
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    this.playerRig.root.position.copy(this.playerPos);
    this.playerRig.root.rotation.y = this.playerYaw;

    const targetBodyY = isCrouching ? -0.32 : 0;
    this.playerRig.bodyGroup.position.y = THREE.MathUtils.damp(
      this.playerRig.bodyGroup.position.y,
      targetBodyY,
      10,
      dt
    );
    this.playerRig.torsoGroup.rotation.x = THREE.MathUtils.damp(
      this.playerRig.torsoGroup.rotation.x,
      isCrouching ? 0.34 : isClimbing ? -0.14 : canSprint ? 0.16 : 0.07 + Math.min(0.14, slope * 0.002),
      8,
      dt
    );

    if (isClimbing && horizSpeed > 0.25) {
      const cycle = elapsed * 9.5;
      this.playerRig.leftShoulder.rotation.x = -Math.PI * 0.72 + Math.sin(cycle) * 0.48;
      this.playerRig.rightShoulder.rotation.x = -Math.PI * 0.72 - Math.sin(cycle) * 0.48;
      this.playerRig.leftElbow.rotation.x = -0.75 + Math.cos(cycle) * 0.3;
      this.playerRig.rightElbow.rotation.x = -0.75 - Math.cos(cycle) * 0.3;
      this.playerRig.leftHip.rotation.x = Math.cos(cycle) * 0.48;
      this.playerRig.rightHip.rotation.x = -Math.cos(cycle) * 0.48;
      this.playerRig.leftKnee.rotation.x = Math.max(0, -Math.cos(cycle) * 0.7);
      this.playerRig.rightKnee.rotation.x = Math.max(0, Math.cos(cycle) * 0.7);

      this.climbSoundTimer += dt;
      if (this.climbSoundTimer > 0.44) {
        this.climbSoundTimer = 0;
        audioEngine.playIceAxe();
      }
    } else if (!this.grounded) {
      this.playerRig.leftHip.rotation.x = 0.55;
      this.playerRig.leftKnee.rotation.x = 0.75;
      this.playerRig.rightHip.rotation.x = -0.25;
      this.playerRig.rightKnee.rotation.x = 0.35;
      this.playerRig.leftShoulder.rotation.x = -0.65;
      this.playerRig.rightShoulder.rotation.x = -0.55;
    } else if (horizSpeed > 0.3 && !slopeBlocked) {
      const freq = canSprint ? 11.0 : inDeepSnow ? 5.6 : 7.4;
      const amp = canSprint ? 0.65 : inDeepSnow ? 0.52 : 0.42;
      const swing = Math.sin(elapsed * freq) * amp;
      this.playerRig.leftHip.rotation.x = swing;
      this.playerRig.rightHip.rotation.x = -swing;
      this.playerRig.leftKnee.rotation.x = Math.max(0, -swing * 1.15) + (isCrouching ? 0.6 : 0.1);
      this.playerRig.rightKnee.rotation.x = Math.max(0, swing * 1.15) + (isCrouching ? 0.6 : 0.1);
      this.playerRig.leftShoulder.rotation.x = -swing * 0.68 - 0.12;
      this.playerRig.rightShoulder.rotation.x = swing * 0.68 - 0.12;
      this.playerRig.leftElbow.rotation.x = -0.42;
      this.playerRig.rightElbow.rotation.x = -0.42;

      this.stepTimer += dt;
      const stepRate = canSprint ? 0.28 : inDeepSnow ? 0.52 : 0.43;
      if (this.stepTimer > stepRate) {
        this.stepTimer = 0;
        audioEngine.playFootstep(canSprint);
        this.degradeGear(['boots', 'crampons'], 0.08);
      }
    } else {
      const kneeIdle = isCrouching ? 0.72 : 0.04;
      this.playerRig.leftHip.rotation.x = THREE.MathUtils.damp(this.playerRig.leftHip.rotation.x, isCrouching ? -0.4 : 0, 8, dt);
      this.playerRig.rightHip.rotation.x = THREE.MathUtils.damp(this.playerRig.rightHip.rotation.x, isCrouching ? -0.4 : 0, 8, dt);
      this.playerRig.leftKnee.rotation.x = THREE.MathUtils.damp(this.playerRig.leftKnee.rotation.x, kneeIdle, 8, dt);
      this.playerRig.rightKnee.rotation.x = THREE.MathUtils.damp(this.playerRig.rightKnee.rotation.x, kneeIdle, 8, dt);
      this.playerRig.leftShoulder.rotation.x = THREE.MathUtils.damp(this.playerRig.leftShoulder.rotation.x, -0.15, 8, dt);
      this.playerRig.rightShoulder.rotation.x = THREE.MathUtils.damp(this.playerRig.rightShoulder.rotation.x, -0.15, 8, dt);
      this.playerRig.leftElbow.rotation.x = THREE.MathUtils.damp(this.playerRig.leftElbow.rotation.x, -0.35, 8, dt);
      this.playerRig.rightElbow.rotation.x = THREE.MathUtils.damp(this.playerRig.rightElbow.rotation.x, -0.35, 8, dt);
    }

    // Override arm swing during Q / E dual ice-axe strikes
    if (this.leftAxeSwingTimer > 0) {
      const p = this.leftAxeSwingTimer / 0.28;
      this.playerRig.leftShoulder.rotation.x = -Math.PI * 0.92 * p - 0.35;
      this.playerRig.leftElbow.rotation.x = -0.85 * p;
    }
    if (this.rightAxeSwingTimer > 0) {
      const p = this.rightAxeSwingTimer / 0.28;
      this.playerRig.rightShoulder.rotation.x = -Math.PI * 0.92 * p - 0.35;
      this.playerRig.rightElbow.rotation.x = -0.85 * p;
    }

    // Visible breathing vapor & cold/fatigue head reaction (amplified in cold night air)
    const isDarkCold = this.timeOfDay > 0.76 || this.timeOfDay < 0.24 || this.temperature < 48;
    const breathFreq = 2.0 + (1 - this.oxygen / 100) * 2.5 + (canSprint ? 1.5 : 0);
    const breathWave = 0.5 + 0.5 * Math.sin(elapsed * breathFreq);
    const breathMat = this.playerRig.breathPuff.material as THREE.MeshStandardMaterial;
    breathMat.opacity = THREE.MathUtils.clamp(breathWave * (isDarkCold ? 0.56 : 0.38), 0, 0.62);
    this.playerRig.breathPuff.scale.setScalar(0.85 + breathWave * 0.78);
    this.playerRig.breathPuff.position.z = -0.19 - breathWave * 0.14;

    if (this.firstPersonRig) {
      const moving = horizSpeed > 0.3 && !slopeBlocked;
      const bobFreq = canSprint ? 10.5 : isClimbing ? 8.5 : 6.4;
      const bobAmp = moving ? (canSprint ? 0.026 : 0.014) : 0.004;
      const bobX = Math.cos(elapsed * (bobFreq * 0.5)) * bobAmp * 0.8;
      const bobY = Math.sin(elapsed * bobFreq) * bobAmp;
      const climbOffset = isClimbing ? 0.09 : 0;

      const lSwing = this.leftAxeSwingTimer > 0 ? Math.sin((this.leftAxeSwingTimer / 0.28) * Math.PI) : 0;
      const rSwing = this.rightAxeSwingTimer > 0 ? Math.sin((this.rightAxeSwingTimer / 0.28) * Math.PI) : 0;
      const lClimb = isClimbing && moving ? Math.sin(elapsed * 8.5) * 0.16 : 0;
      const rClimb = isClimbing && moving ? -Math.sin(elapsed * 8.5) * 0.16 : 0;

      this.firstPersonRig.leftArm.position.set(
        -0.25 + bobX,
        -0.225 + bobY + climbOffset + lClimb * 0.35 + lSwing * 0.12,
        -0.31 - lSwing * 0.24
      );
      this.firstPersonRig.leftArm.rotation.x = lClimb - lSwing * 0.85;

      this.firstPersonRig.rightArm.position.set(
        0.25 + bobX,
        -0.225 - bobY + climbOffset + rClimb * 0.35 + rSwing * 0.12,
        -0.31 - rSwing * 0.24
      );
      this.firstPersonRig.rightArm.rotation.x = rClimb - rSwing * 0.85;

      const fpBreathMat = this.firstPersonRig.breathPuff.material as THREE.MeshBasicMaterial;
      fpBreathMat.opacity = isDarkCold ? THREE.MathUtils.clamp(breathWave * 0.18, 0, 0.22) : 0;
      this.firstPersonRig.breathPuff.scale.setScalar(0.9 + breathWave * 0.65);
      this.firstPersonRig.breathPuff.position.set(0.02, -0.14 + breathWave * 0.05, -0.35 - breathWave * 0.08);
    }

    if (this.temperature < 32) {
      this.playerRig.head.rotation.y = Math.sin(elapsed * 22) * 0.04;
    } else {
      this.playerRig.head.rotation.y = THREE.MathUtils.damp(this.playerRig.head.rotation.y, 0, 8, dt);
    }

    // 10. Headlamp Battery Simulation
    if (this.headlampOn) {
      this.headlampBattery = Math.max(0, this.headlampBattery - 0.58 * dt);
      if (this.headlampBattery <= 0) {
        this.headlampOn = false;
        this.showBanner('Headlamp battery empty! Recharge in Pack or at Mid-Camp fire.');
      }
      this.applyHeadlampVisual();
    }

    // 11. Hardcore Survival & Altitude Sickness Simulation
    const altProgress = THREE.MathUtils.clamp(-this.playerPos.z / this.level.ridgeLength, 0, 1);
    const currentAlt = Math.round(
      THREE.MathUtils.lerp(this.level.altitudeStart, this.level.altitudeEnd, altProgress)
    );

    const exertion = isClimbing ? 11.5 : canSprint && horizSpeed > 1 ? 14.5 : inDeepSnow && horizSpeed > 0.3 ? 6.5 : 0;
    const weightStaminaMul = 0.85 + packKg * 0.015;
    if (exertion > 0) {
      this.stamina = Math.max(0, this.stamina - exertion * weightStaminaMul * dt);
    } else {
      const regen = (horizSpeed < 0.2 ? 13.5 : 6.2) * this.character.perks.staminaRecovery * (1 - this.fatigue / 200);
      this.stamina = Math.min(100, this.stamina + regen * dt);
    }

    const altFactor = currentAlt > 7800 ? 1.85 : currentAlt > 7000 ? 1.32 : 0.78;
    const exertionFactor = isClimbing ? 1.4 : canSprint ? 1.32 : 1.0;
    const o2UpgradeMul = 1 - this.gearUpgrades.o2Regulator * 0.12;
    const o2Drain = 0.62 * altFactor * exertionFactor * this.character.perks.o2Efficiency * o2UpgradeMul;
    this.oxygen = Math.max(0, this.oxygen - o2Drain * dt);

    // Altitude Sickness & Headache progression
    if (currentAlt > 6800 && this.oxygen < 48) {
      this.headacheSeverity = Math.min(100, this.headacheSeverity + 1.8 * dt);
    } else if (this.oxygen > 70) {
      this.headacheSeverity = Math.max(0, this.headacheSeverity - 1.1 * dt);
    }

    const insideShelter = this.isPlayerInsideShelter();
    const nearFire = this.isPlayerNearCampfire();
    if (nearFire) {
      this.headlampBattery = Math.min(100, this.headlampBattery + 14 * dt);
      this.applyHeadlampVisual();
    }

    if (insideShelter || insideCave || nearFire) {
      const warmRate = nearFire ? 9.5 : insideShelter ? 7.2 : 2.6;
      this.temperature = Math.min(100, this.temperature + warmRate * dt);
      if (insideShelter || nearFire) {
        this.shelterTimer += dt;
        const sm = this.missions.find((m) => m.type === 'shelter_night');
        if (sm && !sm.completed) {
          sm.progressCurrent = Math.min(3, Math.floor(this.shelterTimer));
          if (this.shelterTimer >= 3.2) {
            this.completePrimaryMission(sm);
          }
        }
      }
    } else {
      const weatherCold =
        weather === 'blizzard'
          ? 2.45
          : weather === 'snowstorm' || weather === 'thunder_snow'
            ? 1.75
            : weather === 'windy'
              ? 1.25
              : 0.82;
      const isNight = this.timeOfDay > 0.78 || this.timeOfDay < 0.22;
      const nightCold = isNight ? 1.45 : 1.0;
      const wetCold = inWaterCurrent ? 2.4 : 1.0;
      const flareWarmthMul = this.flareTimer > 0 ? 0.6 : 1.0;
      const parkaMul = 1 - this.gearUpgrades.parka * 0.13;
      const tempDrain =
        0.56 *
        weatherCold *
        nightCold *
        wetCold *
        flareWarmthMul *
        parkaMul *
        this.character.perks.coldResistance;
      this.temperature = Math.max(0, this.temperature - tempDrain * dt);
    }

    this.hunger = Math.max(0, this.hunger - 0.34 * dt);
    this.thirst = Math.max(0, this.thirst - 0.44 * dt);
    this.fatigue = Math.min(100, this.fatigue + (canSprint || isClimbing ? 0.45 : 0.16) * dt);

    if (this.oxygen <= 0) this.health = Math.max(0, this.health - 4.8 * dt);
    if (this.temperature <= 14) this.health = Math.max(0, this.health - 3.8 * dt);
    if (this.hunger <= 0 || this.thirst <= 0) this.health = Math.max(0, this.health - 1.3 * dt);

    const stress = Math.max(1 - this.oxygen / 60, 1 - this.stamina / 45, this.headacheSeverity / 100);
    audioEngine.updateBreathing(stress, elapsed);

    if (this.health <= 0) {
      const reason =
        this.oxygen <= 0
          ? 'Fatal hypoxia in the Karakoram Death Zone'
          : this.temperature <= 14
            ? 'Fatal hypothermia in freezing winter wind'
            : 'Expedition vitals exhausted';
      this.triggerFailure(reason);
      return;
    }

    // 12. Natural Disasters: Rockfall (Pebble Warning + Boulder Cover), Avalanches, Falling Ice
    if (this.level.hasRockfall && inRockfall) {
      this.rockfallTimer -= dt;
      if (this.rockfallTimer <= 2.2 && this.rockfallTimer > 0 && this.rockfallWarningTimer <= 0) {
        this.rockfallWarningTimer = 2.4;
        audioEngine.playRockfallPebbles();
        this.showBanner('WARNING PEBBLES! Crouch behind boulder cover now!');
      }
      if (this.rockfallTimer <= 0) {
        this.rockfallTimer = 6.5 + Math.random() * 4.5;
        this.spawnHazard('rock');
      }
    }
    this.rockfallWarningTimer = Math.max(0, this.rockfallWarningTimer - dt);

    if (this.level.hasAvalanches) {
      this.avalancheTimer -= dt;
      if (this.avalancheTimer <= 3.0 && this.avalancheTimer > 0) {
        this.avalancheActiveTimer = this.avalancheTimer;
      }
      if (this.avalancheTimer <= 0) {
        this.avalancheTimer = 18 + Math.random() * 10;
        this.avalancheActiveTimer = 0;
        this.spawnHazard('avalanche');
      }
    }

    if (this.level.hasFallingIce) {
      this.fallingIceTimer -= dt;
      if (this.fallingIceTimer <= 0) {
        this.fallingIceTimer = 9 + Math.random() * 6;
        this.spawnHazard('ice');
      }
    }

    this.updateHazards(dt);
    this.updateActionEvents(dt, elapsed);
    this.updateProps(dt, elapsed);
  }

  private updateActionEvents(dt: number, elapsed: number) {
    if (!this.terrain) return;

    // A. Push Obstacles [X]
    if (this.input.pushQueued) {
      this.input.pushQueued = false;
      for (const obs of this.obstacles) {
        if (obs.cleared) continue;
        if (obs.pos.distanceTo(this.playerPos) < 3.8) {
          obs.cleared = true;
          audioEngine.playObstaclePush();
          this.stamina = Math.max(0, this.stamina - 10);
          this.awardPoints(70);
          this.showBanner('Cleared fallen debris barricade off the trail! (+70 pts)');
          const cm = this.missions.find((m) => m.type === 'clear_obstacle');
          if (cm) {
            cm.progressCurrent = this.obstacles.filter((o) => o.cleared).length;
            if (this.obstacles.every((o) => o.cleared)) {
              this.completePrimaryMission(cm);
            }
          }
          break;
        }
      }
    }
    for (const obs of this.obstacles) {
      if (obs.cleared) {
        obs.mesh.position.x = THREE.MathUtils.damp(obs.mesh.position.x, obs.targetX, 6, dt);
      }
    }

    // B. Emergency Flare Effect
    if (this.flareTimer > 0) {
      this.flareTimer = Math.max(0, this.flareTimer - dt);
      if (this.flareRig) {
        this.flareRig.light.intensity = 6.5 + Math.sin(elapsed * 24) * 1.6;
        this.flareRig.flame.scale.y = 0.85 + Math.sin(elapsed * 30) * 0.25;
        if (this.flareTimer <= 0) {
          this.worldGroup.remove(this.flareRig.group);
          this.flareRig = null;
        }
      }
    }

    // C. Wildlife Predator AI
    for (const w of this.wildlifeList) {
      w.attackCooldown = Math.max(0, w.attackCooldown - dt);
      w.growlCooldown = Math.max(0, w.growlCooldown - dt);
      if (w.fleeTimer > 0) {
        w.fleeTimer = Math.max(0, w.fleeTimer - dt);
        _vec3.copy(w.pos).sub(this.playerPos).setY(0).normalize();
        w.pos.addScaledVector(_vec3, 7.2 * dt);
        w.pos.y = this.terrain.getHeightAt(w.pos.x, w.pos.z);
        w.rig.group.position.copy(w.pos);
        w.rig.group.rotation.y = Math.atan2(-_vec3.x, -_vec3.z);
        if (w.repelled && w.fleeTimer <= 0) {
          w.rig.group.visible = false;
        }
        continue;
      }
      if (w.repelled) continue;

      const dist = w.pos.distanceTo(this.playerPos);
      if (dist < 26) {
        if (this.flareTimer > 0 && this.flarePos.distanceTo(w.pos) < 16) {
          w.fleeTimer = 8.0;
          continue;
        }
        if (w.growlCooldown <= 0) {
          w.growlCooldown = 5.5;
          audioEngine.playWildlifeGrowl();
          this.showBanner('Snow Predator stalking! Swing Ice Axe [Q/F] or light Flare [6]!');
        }
        _vec3.copy(this.playerPos).sub(w.pos).setY(0);
        const len = _vec3.length();
        if (len > 1.7) {
          _vec3.divideScalar(len);
          const chaseSpeed = dist < 10 ? 5.1 : 3.4;
          w.pos.addScaledVector(_vec3, chaseSpeed * dt);
          w.pos.y = this.terrain.getHeightAt(w.pos.x, w.pos.z);
          w.rig.group.position.copy(w.pos);
          w.rig.group.rotation.y = Math.atan2(-_vec3.x, -_vec3.z);
          // Animate 4 legs
          const stride = Math.sin(elapsed * 11) * 0.55;
          w.rig.legs[0].rotation.x = stride;
          w.rig.legs[1].rotation.x = -stride;
          w.rig.legs[2].rotation.x = -stride;
          w.rig.legs[3].rotation.x = stride;
        } else if (w.attackCooldown <= 0) {
          w.attackCooldown = 2.6;
          audioEngine.playWildlifeGrowl();
          this.health = Math.max(0, this.health - 18);
          this.temperature = Math.max(0, this.temperature - 8);
          this.showBanner('Predator lunged! (-18 Health) Strike with Ice Axe [Q/F]!');
          if (this.health <= 0) {
            this.triggerFailure('Overwhelmed by a Himalayan snow predator in the storm');
            return;
          }
        }
      }
    }

    // D. Active Quick-Time Event (QTE) Countdown
    if (this.activeQte) {
      this.activeQte.timeRemaining -= dt;
      if (this.activeQte.timeRemaining <= 0) {
        const failed = this.activeQte;
        this.activeQte = null;
        audioEngine.playSlip();
        this.health = Math.max(0, this.health - 24);
        this.playerPos.z += 4.5;
        this.playerPos.y = this.terrain.getHeightAt(this.playerPos.x, this.playerPos.z);
        this.showBanner(`${failed.title} FAILED! (-24 Health)`);
        if (this.health <= 0) {
          this.triggerFailure(`Failed survival reflex during ${failed.title}`);
          return;
        }
      }
    }

    // E. Special Mission Triggers & Timed Escapes
    const progress = THREE.MathUtils.clamp(-this.playerPos.z / this.level.ridgeLength, 0, 1);

    // 1. Broken Rope Emergency QTE
    if (this.level.hasRopeBreakEvent && !this.ropeBreakTriggered && progress > 0.53) {
      this.ropeBreakTriggered = true;
      audioEngine.playIceCrack();
      const side = Math.random() > 0.5 ? 'axe_left' : 'axe_right';
      this.startQte(
        'rope_break_qte',
        'ROPE SNAPPED OVER DROP!',
        `Granite sheared your fixed line! Strike ${side === 'axe_left' ? '[Q] Left Axe' : '[F] Right Axe'} to arrest your fall!`,
        side,
        side === 'axe_left' ? 'Q' : 'F',
        3.6
      );
    }

    // 2. Avalanche Escape (Stages 1 & 11)
    if (
      (this.level.specialMission === 'avalanche_escape' || this.level.id === 11) &&
      !this.avalancheStarted &&
      progress > 0.36
    ) {
      this.avalancheStarted = true;
      audioEngine.playAvalanche();
      this.avalancheWallZ = this.playerPos.z + 28;
      if (this.avalancheWallMesh) {
        this.avalancheWallMesh.visible = true;
      }
      this.timedEscape = {
        active: true,
        label: 'AVALANCHE ESCAPE — Reach Upper Ice Shelf!',
        timeRemaining: 42,
        maxTime: 42,
      };
      this.showBanner('MASSIVE SLAB AVALANCHE! Sprint & climb past 72% ridge mark!');
    }

    if (this.avalancheStarted && this.timedEscape?.active && this.avalancheWallMesh) {
      this.avalancheWallZ -= 4.05 * dt;
      const wx = this.terrain.ridgeCenterX(this.avalancheWallZ);
      const wy = this.terrain.getHeightAt(wx, this.avalancheWallZ);
      this.avalancheWallMesh.position.set(wx, wy, this.avalancheWallZ);
      this.avalancheActiveTimer = 1.0;

      if (progress >= 0.72) {
        this.timedEscape = null;
        this.avalancheWallMesh.visible = false;
        this.avalancheActiveTimer = 0;
        const em = this.missions.find((m) => m.type === 'escape_hazard');
        if (em) this.completePrimaryMission(em);
        this.awardPoints(150);
        this.awardBadge('avalanche_survivor', 150);
        this.showBanner('Cleared the avalanche path above the ice wall! (+150 pts)');
      } else if (this.avalancheWallZ <= this.playerPos.z + 1.5 || this.timedEscape.timeRemaining <= 0) {
        this.timedEscape = null;
        this.avalancheWallMesh.visible = false;
        this.health = Math.max(0, this.health - 42);
        this.temperature = Math.max(0, this.temperature - 16);
        this.showBanner('Caught in avalanche tail! (-42 Health)');
        if (this.health <= 0) {
          this.triggerFailure('Buried by the Karakoram slab avalanche');
          return;
        }
      }
    }

    // 3. Ice Cave Collapse Escape (Stage 9)
    if (this.level.specialMission === 'ice_cave_escape' && !this.iceCaveCollapseTriggered) {
      if (this.terrain.isInsideIceCave(this.playerPos.x, this.playerPos.z)) {
        this.iceCaveCollapseTriggered = true;
        audioEngine.playIceCrack();
        this.timedEscape = {
          active: true,
          label: 'ICE CAVERN COLLAPSING — Exit Tunnel!',
          timeRemaining: 28,
          maxTime: 28,
        };
        this.showBanner('CEILING FRACTURING! Shove debris [X] & sprint out of the ice cave!');
      }
    }

    if (
      this.iceCaveCollapseTriggered &&
      this.timedEscape?.active &&
      this.terrain.iceCaves.length > 0
    ) {
      const cave = this.terrain.iceCaves[0];
      if (this.playerPos.z < cave.zEnd - 4) {
        this.timedEscape = null;
        const em = this.missions.find((m) => m.type === 'escape_hazard');
        if (em) this.completePrimaryMission(em);
        this.awardPoints(200);
        this.awardBadge('tunnel_runner', 200);
        this.showBanner('Escaped the collapsing glacial tunnel! (+200 pts)');
      } else if (this.timedEscape.timeRemaining <= 0) {
        this.timedEscape = null;
        this.health = Math.max(0, this.health - 36);
        this.playerPos.z = cave.zEnd - 5;
        this.playerPos.y = this.terrain.getHeightAt(this.playerPos.x, this.playerPos.z);
        this.showBanner('Struck by falling ice cavern ceiling! (-36 Health)');
        if (this.health <= 0) {
          this.triggerFailure('Crushed inside collapsing glacial ice tunnel');
          return;
        }
      }
    }

    // 4. Glacier Collapse Surge (Stage 4)
    if (
      this.level.specialMission === 'glacier_collapse' &&
      !this.glacierCollapseTriggered &&
      progress > 0.44
    ) {
      this.glacierCollapseTriggered = true;
      audioEngine.playIceCrack();
      this.timedEscape = {
        active: true,
        label: 'GLACIER SURGE — Climb Above Icefall!',
        timeRemaining: 30,
        maxTime: 30,
      };
      this.showBanner('Glacier shelf collapsed! Reach high ground past 60% mark!');
    }

    if (this.glacierCollapseTriggered && this.timedEscape?.active) {
      if (progress > 0.6) {
        this.timedEscape = null;
        const em = this.missions.find((m) => m.type === 'escape_hazard');
        if (em) this.completePrimaryMission(em);
        this.awardPoints(160);
        this.showBanner('Reached high ground above the collapsing glacier! (+160 pts)');
      } else if (this.timedEscape.timeRemaining <= 0) {
        this.timedEscape = null;
        this.health = Math.max(0, this.health - 30);
        this.showBanner('Swept by icy meltwater surge! (-30 Health)');
      }
    }

    if (this.timedEscape?.active) {
      this.timedEscape.timeRemaining = Math.max(0, this.timedEscape.timeRemaining - dt);
    }

    // 5. Boss Encounter: The Great Serac (Stage 10)
    if (this.level.specialMission === 'serac_gauntlet') {
      this.bossWaveTimer -= dt;
      if (this.bossWaveTimer <= 0) {
        this.bossWaveTimer = 17;
        this.spawnHazard('ice');
        if (!this.activeQte && progress > 0.25 && progress < 0.88) {
          this.startQte(
            'serac_wave_qte',
            'GREAT SERAC ICE WAVE!',
            'Massive hanging ice calves overhead! Press [SPACE] to leap clear!',
            'jump',
            'SPACE',
            3.4
          );
        }
      }
    }

    // 6. Dynamic Event System (Surprise near-falls or squalls per Variation)
    this.dynamicSurpriseTimer -= dt;
    if (this.dynamicSurpriseTimer <= 0 && !this.activeQte && progress > 0.2 && progress < 0.85) {
      this.dynamicSurpriseTimer = 46;
      if (this.variationSeed === 1) {
        this.startQte(
          'dynamic_slip_qte',
          'SUDDEN CORNICE GIVEWAY!',
          'Snow cornice cracked beneath your boots! Press [SPACE] to lunge onto solid ice!',
          'jump',
          'SPACE',
          3.4
        );
      } else if (this.variationSeed === 2 && this.obstacles.length > 0) {
        this.spawnHazard('rock');
      } else {
        this.weatherIndex = (this.weatherIndex + 1) % this.level.weatherCycle.length;
        this.showBanner('Sudden Karakoram wind shear! Hold position or anchor.');
      }
    }

    // 7. Injured Teammate Carry & Escort
    if (this.carryingTeammate && this.carriedNpcMesh) {
      const backX = this.playerPos.x + Math.sin(this.playerYaw) * 0.9;
      const backZ = this.playerPos.z + Math.cos(this.playerYaw) * 0.9;
      this.carriedNpcMesh.position.set(backX, this.playerPos.y + 0.15, backZ);
      this.carriedNpcMesh.rotation.y = this.playerYaw;

      const midCampProp = this.props.find((p) => p.type === 'midcamp');
      const cpProp = this.props.find((p) => p.type === 'checkpoint');
      const nearSafeZone =
        (this.helipadPos && this.helipadPos.distanceTo(this.playerPos) < 6.5) ||
        (cpProp && cpProp.position.distanceTo(this.playerPos) < 6.5) ||
        (this.level.specialMission === 'injured_evacuation' &&
          midCampProp &&
          midCampProp.position.distanceTo(this.playerPos) < 6.5);

      if (nearSafeZone) {
        this.carryingTeammate = false;
        const escortM = this.missions.find((m) => m.type === 'escort_teammate');
        if (escortM && !escortM.completed) {
          this.completePrimaryMission(escortM);
          this.awardPoints(180);
          this.awardBadge('brothers_keeper', 180);
          this.showBanner('Teammate evacuated safely! (+180 pts)');
        }
      }
    }

    // 8. Night Search Radio Signal Meter (Stage 3)
    if (this.level.specialMission === 'night_search') {
      const npc = this.props.find((p) => p.type === 'npc');
      if (npc && npc.active) {
        const d = npc.position.distanceTo(this.playerPos);
        this.radioSignalStrength = Math.round(THREE.MathUtils.clamp(100 - (d / 160) * 100, 5, 100));
      } else {
        this.radioSignalStrength = 100;
      }
    }

    // 9. Helicopter Animation & Audio (Stage 8)
    if (this.heliRig && this.helipadPos) {
      this.heliRig.mainRotor.rotation.y += dt * 18;
      this.heliRig.tailRotor.rotation.x += dt * 24;
      const targetY = this.helicopterInbound ? 1.9 : 34;
      this.heliHeight = THREE.MathUtils.damp(this.heliHeight, targetY, 1.4, dt);
      const targetX = this.helicopterInbound
        ? this.helipadPos.x
        : this.helipadPos.x + Math.sin(elapsed * 0.35) * 20;
      const targetZ = this.helicopterInbound
        ? this.helipadPos.z
        : this.helipadPos.z - 18 + Math.cos(elapsed * 0.35) * 12;

      this.heliRig.group.position.x = THREE.MathUtils.damp(this.heliRig.group.position.x, targetX, 1.2, dt);
      this.heliRig.group.position.y = this.helipadPos.y + this.heliHeight;
      this.heliRig.group.position.z = THREE.MathUtils.damp(this.heliRig.group.position.z, targetZ, 1.2, dt);

      const dPlayer = this.heliRig.group.position.distanceTo(this.playerPos);
      const heliVol = this.mode === 'playing' ? THREE.MathUtils.clamp(1 - dPlayer / 95, 0.08, 1) : 0;
      audioEngine.setHelicopterVolume(this.helicopterInbound ? Math.max(0.55, heliVol) : heliVol * 0.45);
    }
  }

  private spawnHazard(kind: HazardBoulder['kind']) {
    if (!this.terrain) return;
    if (kind === 'avalanche') {
      audioEngine.playAvalanche();
      this.showBanner('AVALANCHE! Crouch or clear the slope!');
    } else if (kind === 'ice') {
      audioEngine.playIceCrack();
      this.showBanner('Overhead serac calving — watch for falling ice!');
    } else {
      audioEngine.playBoulderImpact();
    }

    let count = 0;
    for (const b of this.boulders) {
      if (b.kind !== kind) continue;
      count += 1;
      b.active = true;
      b.mesh.visible = true;
      const z = this.playerPos.z - 16 - count * 3.5;
      const x = this.terrain.ridgeCenterX(z) + (Math.random() - 0.5) * 10;
      const y = this.terrain.getHeightAt(x, z) + (kind === 'avalanche' ? 2.5 : 14);
      b.pos.set(x, y, z);
      b.vel.set(
        (Math.random() - 0.5) * 2.4,
        kind === 'avalanche' ? 0 : -10,
        kind === 'avalanche' ? 13 + Math.random() * 5 : 6.5
      );
      b.mesh.position.copy(b.pos);
    }
  }

  private isBehindCoverBoulder(): boolean {
    for (const cb of this.coverBoulders) {
      if (cb.distanceTo(this.playerPos) < 2.8) return true;
    }
    return false;
  }

  private updateHazards(dt: number) {
    if (!this.terrain) return;
    for (const b of this.boulders) {
      if (!b.active) continue;
      b.pos.x += b.vel.x * dt;
      b.pos.z += b.vel.z * dt;
      const gy = this.terrain.getHeightAt(b.pos.x, b.pos.z) + 0.85;
      if (b.kind !== 'avalanche' && b.pos.y > gy) {
        b.pos.y += b.vel.y * dt;
      } else {
        b.pos.y = THREE.MathUtils.damp(b.pos.y, gy, 10, dt);
      }
      b.mesh.position.copy(b.pos);
      b.mesh.rotation.x += dt * 4.5;
      b.mesh.rotation.z += dt * 2.5;

      if (b.pos.distanceTo(this.playerPos) < 1.8) {
        b.active = false;
        b.mesh.visible = false;
        if (b.kind === 'rock' && this.isBehindCoverBoulder()) {
          this.showBanner('Boulder cover deflected falling rock!');
          continue;
        }
        const dmg = this.input.crouch ? 12 : 24;
        this.health = Math.max(0, this.health - dmg);
        this.degradeGear(['helmet', 'crampons', 'boots'], 12);
        this.stamina = Math.max(0, this.stamina - 18);
        this.showBanner(`Struck by ${b.kind}! (-${dmg} Health)`);
        if (this.health <= 0) {
          this.triggerFailure(`Overwhelmed by Karakoram ${b.kind}`);
          return;
        }
      }

      if (b.pos.z > this.playerPos.z + 18) {
        b.active = false;
        b.mesh.visible = false;
      }
    }
  }

  private updateProps(_dt: number, elapsed: number) {
    if (this.beaconFlag) {
      this.beaconFlag.rotation.y = Math.sin(elapsed * 5.2) * 0.25;
    }
    if (this.beaconRing) {
      const s = 1 + Math.sin(elapsed * 3) * 0.06;
      this.beaconRing.scale.set(s, s, 1);
    }

    const doInteract = this.input.interactQueued;
    this.input.interactQueued = false;

    for (const p of this.props) {
      if (!p.active) continue;
      const dist = _vec3.copy(p.position).distanceTo(this.playerPos);

      if (p.type === 'o2' && (dist < 2.4 || (doInteract && dist < 4.2))) {
        p.active = false;
        p.mesh.visible = false;
        const o2 = this.getItem('oxygen');
        if (o2) o2.quantity += 1;
        this.oxygen = Math.min(100, this.oxygen + 30);
        this.o2CollectedCount += 1;
        this.awardPoints(50);
        audioEngine.playOxygenHiss();
        this.showBanner('Recovered Oxygen Cylinder (+1 Cylinder, +30% O2)');

        const m = this.missions.find((ms) => ms.type === 'collect_o2');
        if (m) {
          m.progressCurrent = Math.min(this.level.requiredO2Collect, this.o2CollectedCount);
          if (this.o2CollectedCount >= this.level.requiredO2Collect) {
            this.completePrimaryMission(m);
          }
        }
      } else if (p.type === 'ration' && (dist < 2.4 || (doInteract && dist < 4.2))) {
        p.active = false;
        p.mesh.visible = false;
        const food = this.getItem('food');
        const water = this.getItem('water');
        if (food) food.quantity += 1;
        if (water) water.quantity += 1;
        this.temperature = Math.min(100, this.temperature + 16);
        this.awardPoints(40);
        this.showBanner('Supply Cache (+1 Alpine Ration, +1 Water Flask)');
      } else if (p.type === 'anchor' && doInteract && dist < 4.5) {
        p.active = false;
        if (p.extraMesh) {
          const mat = p.extraMesh.material as THREE.MeshStandardMaterial;
          mat.color.setHex(0x22c55e);
          mat.emissive.setHex(0x16a34a);
        }
        audioEngine.playRepair();
        this.awardPoints(75);
        this.showBanner('Damaged belay anchor repaired!');
        const m = this.missions.find((ms) => ms.type === 'repair_anchor');
        if (m) this.completePrimaryMission(m);
      } else if (p.type === 'npc' && doInteract && dist < 4.8) {
        p.active = false;
        audioEngine.playOxygenHiss();
        const m = this.missions.find((ms) => ms.type === 'rescue_climber');
        if (m) this.completePrimaryMission(m);

        const needsEscort = this.missions.some((ms) => ms.type === 'escort_teammate');
        if (needsEscort) {
          this.carryingTeammate = true;
          this.carriedNpcMesh = p.mesh as THREE.Group;
          this.showBanner('Teammate stabilized! Carrying injured climber to Camp / Helipad safety!');
        } else {
          p.mesh.position.y += 0.35;
          this.showBanner('Teammate stabilized and roped in safely!');
          if (this.level.specialMission === 'night_search') {
            this.awardBadge('night_navigator', 170);
          }
        }

        if (this.level.decision && !this.decisionTriggered) {
          this.decisionTriggered = true;
          this.activeDecision = this.level.decision;
          this.mode = 'paused';
          this.pushTelemetry();
        }
      } else if (p.type === 'helipad' && doInteract && dist < 6.5) {
        if (this.flareTimer > 0) {
          this.helicopterInbound = true;
          const hm = this.missions.find((m) => m.type === 'signal_helicopter');
          if (hm && !hm.completed) {
            this.completePrimaryMission(hm);
            this.awardPoints(120);
            this.awardBadge('heli_signal', 180);
            this.showBanner('Helicopter rescue beacon confirmed!');
          }
        } else {
          this.showBanner('Press [6] to ignite an Emergency Flare at the Helipad!');
        }
      } else if (p.type === 'checkpoint' && dist < 4.6) {
        if (this.level.decision && !this.decisionTriggered) {
          this.decisionTriggered = true;
          this.activeDecision = this.level.decision;
          this.mode = 'paused';
          this.pushTelemetry();
          return;
        }

        const prerequisitesDone = this.missions
          .filter((ms) => !ms.optional && ms.type !== 'reach_camp')
          .every((ms) => ms.completed);

        if (prerequisitesDone) {
          const campM = this.missions.find((ms) => ms.type === 'reach_camp');
          if (campM) campM.completed = true;
          p.active = false;
          this.awardPoints(180 + this.level.id * 25);
          if (this.level.id === 11) {
            this.awardBadge('k2_winter_summiteer', 500);
          }
          this.mode = 'paused';
          audioEngine.setHelicopterVolume(0);
          audioEngine.playVictory();
          this.onLevelComplete(this.buildTelemetrySnapshot());
          return;
        } else if (doInteract || dist < 3.6) {
          if (this.statusBannerTimer <= 0) {
            const pending = this.getCurrentPrimaryMission();
            this.showBanner(
              pending
                ? `Complete current objective first: ${pending.label}`
                : 'Complete all primary mission steps before securing summit/camp!'
            );
          }
        }
      }
    }
  }

  private triggerFailure(reason: string) {
    this.mode = 'paused';
    const snap = this.buildTelemetrySnapshot();
    snap.failureReason = reason;
    this.onGameOver(snap);
  }

  private snapCameraToPlayer() {
    if (!this.terrain) return;
    if (this.cameraMode === 'first_person') {
      const eyeH = this.input.crouch ? 1.18 : 1.66;
      this.camera.position.set(
        this.playerPos.x - Math.sin(this.cameraYaw) * 0.06,
        this.playerPos.y + eyeH,
        this.playerPos.z - Math.cos(this.cameraYaw) * 0.06
      );
      this.camera.rotation.set(-this.cameraPitch, this.cameraYaw, 0, 'YXZ');
      return;
    }
    const horizDist = this.cameraZoom * Math.cos(this.cameraPitch);
    const vertDist = this.cameraZoom * Math.sin(this.cameraPitch) + 1.25;
    const desiredX = this.playerPos.x + Math.sin(this.cameraYaw) * horizDist;
    const desiredZ = this.playerPos.z + Math.cos(this.cameraYaw) * horizDist;
    const minGroundY = this.terrain.getHeightAt(desiredX, desiredZ) + 1.1;
    const desiredY = Math.max(minGroundY, this.playerPos.y + vertDist);

    this.camera.position.set(desiredX, desiredY, desiredZ);
    const lookX = this.playerPos.x - Math.sin(this.cameraYaw) * 2.2;
    const lookZ = this.playerPos.z - Math.cos(this.cameraYaw) * 2.2;
    this.camera.lookAt(lookX, this.playerPos.y + 1.85, lookZ);
  }

  private updateCamera(dt: number, elapsed: number) {
    if (!this.terrain) return;

    if (this.mode === 'menu') {
      const sway = Math.sin(elapsed * 0.25) * 3.8;
      _camDesired.set(
        this.playerPos.x - 3.8 + sway,
        this.playerPos.y + 2.8,
        this.playerPos.z + 8.8
      );
      this.camera.position.lerp(_camDesired, 1 - Math.exp(-4 * dt));
      _camTarget.set(this.playerPos.x, this.playerPos.y + 2.2, this.playerPos.z - 24);
      this.camera.lookAt(_camTarget);
      if (this.skyDome) this.skyDome.position.copy(this.camera.position);
      return;
    }

    if (this.mode === 'cutscene') {
      if (this.cutscenePreset === 'aerial_k2') {
        _camDesired.set(
          this.playerPos.x + Math.sin(elapsed * 0.28) * 4.5,
          this.playerPos.y + 3.2,
          this.playerPos.z + 8.6
        );
        _camTarget.set(this.playerPos.x, this.playerPos.y + 2.6, this.playerPos.z - 36);
      } else if (this.cutscenePreset === 'camp_overview') {
        _camDesired.set(this.playerPos.x - 5.2, this.playerPos.y + 2.9, this.playerPos.z + 8.6);
        _camTarget.set(this.playerPos.x - 1.2, this.playerPos.y + 1.8, this.playerPos.z - 8);
      } else if (this.cutscenePreset === 'team_prep') {
        _camDesired.set(this.playerPos.x + 4.4, this.playerPos.y + 2.5, this.playerPos.z + 6.4);
        _camTarget.set(this.playerPos.x, this.playerPos.y + 1.7, this.playerPos.z - 10);
      } else {
        _camDesired.set(this.playerPos.x + 2.0, this.playerPos.y + 1.9, this.playerPos.z + 3.6);
        _camTarget.set(this.playerPos.x, this.playerPos.y + 1.6, this.playerPos.z - 6);
      }
      this.camera.position.lerp(_camDesired, 1 - Math.exp(-4 * dt));
      this.camera.lookAt(_camTarget);
      if (this.skyDome) this.skyDome.position.copy(this.camera.position);
      return;
    }

    if (this.cameraMode === 'first_person') {
      const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
      const bob =
        horizSpeed > 0.35
          ? Math.sin(elapsed * (this.input.sprint ? 11.0 : 7.4)) * 0.042
          : Math.sin(elapsed * 2.0) * 0.008;
      const eyeHeight = (this.input.crouch ? 1.18 : 1.66) + bob;
      _camDesired.set(
        this.playerPos.x - Math.sin(this.cameraYaw) * 0.06,
        this.playerPos.y + eyeHeight,
        this.playerPos.z - Math.cos(this.cameraYaw) * 0.06
      );
      this.camera.position.lerp(_camDesired, 1 - Math.exp(-20 * dt));
      this.camera.rotation.set(-this.cameraPitch, this.cameraYaw, 0, 'YXZ');
      this.syncHeadlampLightPose(true);
      if (this.skyDome) this.skyDome.position.copy(this.camera.position);
      return;
    }

    const slope = this.terrain.getSlopeDegrees(this.playerPos.x, this.playerPos.z);
    const climbingBoost = this.input.climb && slope > 21 ? 0.9 : 0;
    const activeZoom = this.cameraZoom + climbingBoost;
    const horizDist = activeZoom * Math.cos(this.cameraPitch);
    const vertDist = activeZoom * Math.sin(this.cameraPitch) + 1.25 + climbingBoost * 0.35;

    const desiredX = this.playerPos.x + Math.sin(this.cameraYaw) * horizDist;
    const desiredZ = this.playerPos.z + Math.cos(this.cameraYaw) * horizDist;
    const minGroundY = this.terrain.getHeightAt(desiredX, desiredZ) + 1.1;
    const desiredY = Math.max(minGroundY, this.playerPos.y + vertDist);

    _camDesired.set(desiredX, desiredY, desiredZ);
    this.camera.position.lerp(_camDesired, 1 - Math.exp(-12 * dt));

    const lookX = this.playerPos.x - Math.sin(this.cameraYaw) * 2.2;
    const lookZ = this.playerPos.z - Math.cos(this.cameraYaw) * 2.2;
    _camTarget.set(lookX, this.playerPos.y + 1.85, lookZ);
    this.camera.lookAt(_camTarget);
    this.syncHeadlampLightPose(false);
    if (this.skyDome) this.skyDome.position.copy(this.camera.position);
  }

  private syncHeadlampLightPose(isFp: boolean) {
    if (!this.headlampOn || this.headlampBattery <= 0) return;
    if (isFp) {
      this.camera.getWorldDirection(_vec3);
      this.headlampLight.position.set(
        this.camera.position.x,
        this.camera.position.y + 0.08,
        this.camera.position.z
      );
      this.headlampLight.target.position
        .copy(this.headlampLight.position)
        .addScaledVector(_vec3, 14);
      this.headlampLight.target.position.y -= 0.4;
      this.headlampLight.target.updateMatrixWorld();
    } else {
      const fx = -Math.sin(this.playerYaw);
      const fz = -Math.cos(this.playerYaw);
      const headH = this.input.crouch ? 1.46 : 1.78;
      this.headlampLight.position.set(
        this.playerPos.x + fx * 0.16,
        this.playerPos.y + headH,
        this.playerPos.z + fz * 0.16
      );
      this.headlampLight.target.position.set(
        this.playerPos.x + fx * 12,
        this.playerPos.y + headH - 0.85,
        this.playerPos.z + fz * 12
      );
      this.headlampLight.target.updateMatrixWorld();
    }
  }

  private buildTelemetrySnapshot(): GameTelemetry {
    const altProgress = THREE.MathUtils.clamp(-this.playerPos.z / this.level.ridgeLength, 0, 1);
    const altitude = Math.round(
      THREE.MathUtils.lerp(this.level.altitudeStart, this.level.altitudeEnd, altProgress)
    );
    const weather = this.getCurrentWeather();
    const isNight = this.timeOfDay > 0.78 || this.timeOfDay < 0.22;

    const timeOfDayLabel =
      this.timeOfDay < 0.22
        ? 'Pre-Dawn'
        : this.timeOfDay < 0.36
          ? 'Alpine Dawn'
          : this.timeOfDay < 0.68
            ? 'High Day'
            : this.timeOfDay < 0.8
              ? 'Dusk'
              : 'Moonlit Night';

    const windSpeedKmh = Math.round(
      24 +
        this.level.windBase * 60 +
        (weather === 'blizzard'
          ? 50
          : weather === 'snowstorm' || weather === 'thunder_snow'
            ? 34
            : weather === 'windy'
              ? 18
              : 0)
    );
    const ambientTempC = Math.round(
      -12 - (altitude - 4500) * 0.0074 - (isNight ? 9 : 0) - (weather === 'blizzard' ? 8 : 0)
    );

    const checkpoint = this.props.find((p) => p.type === 'checkpoint');
    const distanceToCheckpoint = checkpoint
      ? Math.max(0, Math.round(checkpoint.position.distanceTo(this.playerPos)))
      : 0;

    const { slot, dist } = this.findNearestAnchorSlot();
    const nearAnchorSpot = Boolean(slot && dist < 3.8);
    const anchorSpotQuality: 'solid' | 'poor' | 'none' = nearAnchorSpot && slot ? slot.quality : 'none';

    let interactPrompt: string | null = null;
    for (const obs of this.obstacles) {
      if (!obs.cleared && obs.pos.distanceTo(this.playerPos) < 3.8) {
        interactPrompt = 'Press [X] / Push — Shove Fallen Debris Off Trail';
        break;
      }
    }

    if (!interactPrompt) {
      for (const p of this.props) {
        if (!p.active) continue;
        const d = p.position.distanceTo(this.playerPos);
        if (d < 4.6) {
          if (p.type === 'o2') interactPrompt = 'Press [E] / Interact — Recover Oxygen Cylinder';
          else if (p.type === 'ration') interactPrompt = 'Press [E] / Interact — Collect Ration & Water';
          else if (p.type === 'anchor') interactPrompt = 'Press [E] / Interact — Repair Damaged Anchor';
          else if (p.type === 'npc') interactPrompt = 'Press [E] / Interact — Stabilize & Evacuate Teammate';
          else if (p.type === 'helipad') {
            interactPrompt = this.helicopterInbound
              ? 'Helicopter Inbound to Helipad!'
              : 'Press [6] Flare — Signal Rescue Helicopter';
          } else if (p.type === 'shelter') interactPrompt = 'Inside Storm Shelter — Restoring Core Warmth';
          else if (p.type === 'midcamp') interactPrompt = 'Mid-Camp Fire — Warming Up & Recharging Headlamp';
          else if (p.type === 'checkpoint') {
            const ready = this.missions
              .filter((m) => !m.optional && m.type !== 'reach_camp')
              .every((m) => m.completed);
            interactPrompt = ready
              ? 'Camp Beacon Reached!'
              : 'Complete primary objectives before securing summit/camp';
          }
          break;
        }
      }
    }

    if (!interactPrompt && nearAnchorSpot && this.ropeRigState === 'none') {
      interactPrompt = `Press R — Place ${anchorSpotQuality === 'solid' ? 'Solid' : 'Loose'} Anchor (${slot?.stability}% stability)`;
    } else if (!interactPrompt && this.ropeRigState === 'anchor_placed') {
      interactPrompt = 'Press R — Attach Dynamic Climbing Rope';
    }

    const slope = this.terrain ? this.terrain.getSlopeDegrees(this.playerPos.x, this.playerPos.z) : 0;
    const nrInfo = this.terrain
      ? this.terrain.isOnNarrowRidge(this.playerPos.x, this.playerPos.z)
      : { active: false };
    const inDeepSnow = this.terrain
      ? this.terrain.isInDeepSnow(this.playerPos.x, this.playerPos.z)
      : false;
    const terrainSurface = this.terrain
      ? this.terrain.getSurfaceType(this.playerPos.x, this.playerPos.z)
      : 'Alpine Snow';

    let inWaterCurrent = false;
    let floodWarning = false;
    for (const r of this.rivers) {
      const dz = Math.abs(this.playerPos.z - r.zCenter);
      if (dz < r.halfWidthZ) inWaterCurrent = true;
      if (dz < r.halfWidthZ + 12 && this.floodWaterLevel > 0.65) floodWarning = true;
    }

    let wildlifeNearby = false;
    let wildlifeThreatDist = 99;
    for (const w of this.wildlifeList) {
      if (w.repelled || w.fleeTimer > 0) continue;
      const d = w.pos.distanceTo(this.playerPos);
      if (d < 24) {
        wildlifeNearby = true;
        wildlifeThreatDist = Math.min(wildlifeThreatDist, Math.round(d));
      }
    }

    let headingDeg = Math.round((-THREE.MathUtils.radToDeg(this.cameraYaw) % 360 + 360) % 360);
    if (headingDeg === 360) headingDeg = 0;

    const lat = (35.88 + altProgress * 0.012).toFixed(4);
    const lon = (76.513 + this.playerPos.x * 0.0001).toFixed(4);

    const mapPoints: MiniMapPoint[] = this.props.map((p) => ({
      x: p.position.x,
      z: p.position.z,
      type: p.type === 'anchor' ? 'anchor_spot' : p.type,
      active: p.active,
    }));
    for (const w of this.wildlifeList) {
      if (!w.repelled) {
        mapPoints.push({ x: w.pos.x, z: w.pos.z, type: 'wildlife', active: true });
      }
    }
    for (const obs of this.obstacles) {
      if (!obs.cleared) {
        mapPoints.push({ x: obs.pos.x, z: obs.pos.z, type: 'obstacle', active: true });
      }
    }
    if (this.terrain) {
      for (const s of this.terrain.anchorSlots) {
        mapPoints.push({ x: s.x, z: s.z, type: 'anchor_spot', active: true });
      }
      for (const r of this.terrain.rivers) {
        mapPoints.push({
          x: this.terrain.ridgeCenterX(r.zCenter),
          z: r.zCenter,
          type: 'river',
          active: true,
        });
      }
      for (const crev of this.terrain.crevasses) {
        mapPoints.push({
          x: this.terrain.ridgeCenterX(crev.zCenter),
          z: crev.zCenter,
          type: 'crevasse',
          active: true,
        });
      }
    }

    return {
      health: Math.round(this.health),
      oxygen: Math.round(this.oxygen),
      stamina: Math.round(this.stamina),
      gripStrength: Math.round(this.gripStrength),
      gearIntegrity: this.getGearIntegrity(),
      temperature: Math.round(this.temperature),
      coreTempC: Number((31.2 + (this.temperature / 100) * 5.8).toFixed(1)),
      hunger: Math.round(this.hunger),
      thirst: Math.round(this.thirst),
      fatigue: Math.round(this.fatigue),
      headacheSeverity: Math.round(this.headacheSeverity),
      headlampBattery: Math.round(this.headlampBattery),
      packWeightKg: this.getPackWeightKg(),
      balance: this.balance,
      altitude,
      altitudeProgress: altProgress,
      terrainSurface,
      weather,
      windSpeedKmh,
      ambientTempC,
      timeOfDayLabel,
      timeOfDay: Number(this.timeOfDay.toFixed(3)),
      timeMode: this.settings.timeMode || 'auto',
      visibilityMeters: this.visibilityMeters,
      cameraMode: this.cameraMode,
      isNight,
      headlampOn: this.headlampOn,
      isClimbing: this.input.climb && slope > 21,
      isCrouching: this.input.crouch,
      isSprinting: this.input.sprint,
      onNarrowRidge: nrInfo.active,
      inDeepSnow,
      inWaterCurrent,
      floodWaterLevel: Number(this.floodWaterLevel.toFixed(2)),
      nearAnchorSpot,
      anchorSpotQuality,
      ropeRigState: this.ropeRigState,
      anchorStability: this.anchorStability,
      ropeTension: Math.round(this.ropeTension),
      ropeDistanceM: this.anchorPos ? Math.round(this.anchorPos.distanceTo(this.playerPos)) : 0,
      insideShelter: this.isPlayerInsideShelter(),
      nearCampfire: this.isPlayerNearCampfire(),
      carryingTeammate: this.carryingTeammate,
      wildlifeNearby,
      wildlifeThreatDist,
      flareActive: this.flareTimer > 0,
      helicopterInbound: this.helicopterInbound,
      radioSignalStrength: this.radioSignalStrength,
      frostbiteRisk: this.temperature < 30,
      hypothermiaRisk: this.temperature < 20,
      altitudeSicknessRisk: this.oxygen < 30 || this.headacheSeverity > 55,
      avalancheWarning: this.avalancheActiveTimer > 0,
      rockfallWarning: this.rockfallWarningTimer > 0,
      floodWarning,
      landslideWarning: this.landslideWarningTimer > 0,
      elapsedTime: this.elapsedTime,
      distanceToCheckpoint,
      compassHeadingDeg: headingDeg,
      gpsCoords: `${lat}°N ${lon}°E`,
      interactPrompt,
      statusBanner: this.statusBannerTimer > 0 ? this.statusBanner : null,
      missionNotification:
        this.missionNotificationTimer > 0 ? this.missionNotification : null,
      activeDecision: this.activeDecision,
      activeQte: this.activeQte ? { ...this.activeQte } : null,
      timedEscape: this.timedEscape ? { ...this.timedEscape } : null,
      sessionPoints: this.sessionPoints,
      newlyEarnedBadges: [...this.newlyEarnedBadges],
      variationLabel: this.variationLabel,
      equipment: this.equipment.map((e) => ({ ...e })),
      missions: this.missions.map((m) => ({ ...m })),
      playerPos: { x: this.playerPos.x, z: this.playerPos.z, yaw: this.playerYaw },
      mapPoints,
      ridgeLength: this.level.ridgeLength,
    };
  }

  private pushTelemetry() {
    this.onTelemetry(this.buildTelemetrySnapshot());
  }

  private scheduleNextSoftwareFrame(cb: () => void) {
    this.softwareTimerId = window.setTimeout(() => {
      if (this.disposed) return;
      cb();
    }, 360);
  }

  private tick = () => {
    if (this.disposed) return;

    const dt = Math.min(0.08, this.clock.getDelta());
    const elapsed = this.clock.elapsedTime;

    if (this.mode === 'playing') {
      this.elapsedTime += dt;
      if (this.statusBannerTimer > 0) this.statusBannerTimer -= dt;
      if (this.missionNotificationTimer > 0) this.missionNotificationTimer -= dt;
      if (this.avalancheActiveTimer > 0) {
        this.avalancheActiveTimer = Math.max(0, this.avalancheActiveTimer - dt);
      }

      this.updateAtmosphere(dt, elapsed);
      this.updatePlayer(dt, elapsed);

      if (elapsed - this.lastHudPush > 0.08) {
        this.lastHudPush = elapsed;
        this.pushTelemetry();
      }
    } else if (this.mode === 'menu' || this.mode === 'cutscene') {
      this.updateAtmosphere(dt * 0.45, elapsed);
    }

    this.updateCamera(dt, elapsed);
    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.scheduleNextSoftwareFrame(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.softwareTimerId);
    this.cleanupListeners();
    this.clearWorld();
    if (this.skyDome) {
      this.scene.remove(this.skyDome);
      this.skyDome.geometry.dispose();
      (this.skyDome.material as THREE.Material).dispose();
      this.skyDome = null;
    }
    this.textures.snowAlbedo.dispose();
    this.textures.snowBump.dispose();
    this.textures.rockAlbedo.dispose();
    this.textures.rockBump.dispose();
    this.textures.iceAlbedo.dispose();
    this.textures.particleTex.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
