export type GraphicsQuality = 'low' | 'medium' | 'high' | 'auto';
export type TouchControlsMode = 'auto' | 'always' | 'off';
export type HudLayoutMode = 'full' | 'compact' | 'hidden';

export type WeatherType =
  | 'clear'
  | 'overcast'
  | 'snowfall'
  | 'fog'
  | 'windy'
  | 'snowstorm'
  | 'blizzard'
  | 'thunder_snow';

export type GameScreen =
  | 'menu'
  | 'cutscene'
  | 'playing'
  | 'paused'
  | 'level_complete'
  | 'game_over';

export type RouteChoice = 'abruzzi' | 'cesen';

export type TimeLightingMode = 'day' | 'night' | 'day_to_night' | 'night_to_dawn';

export type SpecialMissionType =
  | 'avalanche_escape'
  | 'injured_evacuation'
  | 'glacier_collapse'
  | 'wildlife_encounter'
  | 'rope_break'
  | 'storm_camp_defense'
  | 'night_search'
  | 'ice_cave_escape'
  | 'helicopter_rescue'
  | 'serac_gauntlet'
  | 'summit_assault';

export interface GameSettings {
  graphics: GraphicsQuality;
  masterVolume: number;
  cameraSensitivity: number;
  invertY: boolean;
  touchControls: TouchControlsMode;
  voiceOver: boolean;
  hudMode: HudLayoutMode;
}

export interface CharacterProfile {
  id: string;
  name: string;
  role: string;
  origin: string;
  bio: string;
  suitColor: string;
  accentColor: string;
  helmetColor: string;
  skinTone: string;
  perks: {
    coldResistance: number;
    o2Efficiency: number;
    climbSpeed: number;
    staminaRecovery: number;
    gripBonus: number;
  };
  traitLabel: string;
  customizable?: boolean;
}

export interface TeamMemberState {
  id: string;
  name: string;
  role: string;
  origin: string;
  health: number;
  stamina: number;
  oxygen: number;
  morale: number;
  status: 'Active' | 'Injured' | 'Missing' | 'Rescued' | 'Fallen';
}

export interface EquipmentItem {
  id: string;
  name: string;
  category: 'climbing' | 'survival' | 'navigation' | 'apparel';
  quantity: number;
  weightKg: number;
  durability: number; // 0..100
  usable: boolean;
  description: string;
}

export type RopeRigState = 'none' | 'anchor_placed' | 'rope_secured';

export interface MissionStep {
  id: string;
  label: string;
  type:
    | 'trek_valley'
    | 'cross_flood'
    | 'survive_rockfall'
    | 'collect_o2'
    | 'install_rope'
    | 'repair_anchor'
    | 'rescue_climber'
    | 'escort_teammate'
    | 'signal_helicopter'
    | 'clear_obstacle'
    | 'repel_wildlife'
    | 'recover_supplies'
    | 'escape_hazard'
    | 'shelter_night'
    | 'reach_checkpoint'
    | 'reach_camp';
  completed: boolean;
  optional?: boolean;
  progressCurrent?: number;
  progressTarget?: number;
}

export interface CutsceneBeat {
  title: string;
  speaker: string;
  subtitle: string;
  durationSec: number;
  cameraPreset: 'aerial_k2' | 'camp_overview' | 'team_prep' | 'climber_closeup';
}

export interface StoryDecision {
  id: string;
  title: string;
  prompt: string;
  optionA: {
    label: string;
    consequence: string;
    effect: 'rescue_sacrifice' | 'route_abruzzi';
  };
  optionB: {
    label: string;
    consequence: string;
    effect: 'push_solo' | 'route_cesen';
  };
}

export interface ActiveQteEvent {
  id: string;
  title: string;
  prompt: string;
  requiredAction: 'axe_left' | 'axe_right' | 'jump' | 'push' | 'flare';
  keyLabel: string;
  timeRemaining: number;
  maxTime: number;
  progress: number; // 0..100
}

export interface TimedEscapeState {
  active: boolean;
  label: string;
  timeRemaining: number;
  maxTime: number;
}

export interface GearUpgradeLevels {
  iceAxes: number; // 0..3
  parka: number; // 0..3
  o2Regulator: number; // 0..3
  ropeLine: number; // 0..3
}

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  pointsReward: number;
}

export interface OutfitUnlock {
  id: string;
  label: string;
  hex: string;
  costPoints: number;
}

export interface LevelConfig {
  id: number;
  code: string;
  name: string;
  subtitle: string;
  altitudeStart: number;
  altitudeEnd: number;
  lightingMode: TimeLightingMode;
  weatherCycle: WeatherType[];
  startTimeOfDay: number;
  daySpeed: number;
  ridgeLength: number; // ~520-660m for focused 10-12 min action expeditions
  steepness: number;
  roughness: number;
  windBase: number;
  specialMission: SpecialMissionType;
  hasForestValley: boolean;
  hasGlacierRiver: boolean;
  hasRockfall: boolean;
  hasLandslide: boolean;
  hasCrevasses: boolean;
  hasSnowBridge: boolean;
  hasNarrowRidge: boolean;
  hasIceCave: boolean;
  hasAvalanches: boolean;
  hasFallingIce: boolean;
  hasIceWall: boolean;
  hasLightning: boolean;
  hasWildlife: boolean;
  hasObstacles: boolean;
  hasHelicopterRescue: boolean;
  hasRopeBreakEvent: boolean;
  hasRescueNpc: boolean;
  hasMissingMember: boolean;
  hasBrokenAnchor: boolean;
  hasEmergencyShelter: boolean;
  requiredO2Collect: number;
  storyBrief: string;
  completionQuote: string;
  difficultyLabel: string;
  cutscene: CutsceneBeat[];
  decision?: StoryDecision;
}

export interface MiniMapPoint {
  x: number;
  z: number;
  type:
    | 'o2'
    | 'ration'
    | 'anchor_spot'
    | 'npc'
    | 'shelter'
    | 'midcamp'
    | 'river'
    | 'wildlife'
    | 'obstacle'
    | 'helipad'
    | 'checkpoint'
    | 'crevasse';
  active: boolean;
}

export interface GameTelemetry {
  health: number;
  oxygen: number;
  stamina: number;
  gripStrength: number;
  gearIntegrity: number;
  temperature: number;
  coreTempC: number;
  hunger: number;
  thirst: number;
  fatigue: number;
  headacheSeverity: number;
  headlampBattery: number;
  packWeightKg: number;
  balance: number;
  altitude: number;
  altitudeProgress: number;
  terrainSurface: string;
  weather: WeatherType;
  windSpeedKmh: number;
  ambientTempC: number;
  timeOfDayLabel: string;
  isNight: boolean;
  headlampOn: boolean;
  isClimbing: boolean;
  isCrouching: boolean;
  isSprinting: boolean;
  onNarrowRidge: boolean;
  inDeepSnow: boolean;
  inWaterCurrent: boolean;
  floodWaterLevel: number;
  nearAnchorSpot: boolean;
  anchorSpotQuality: 'solid' | 'poor' | 'none';
  ropeRigState: RopeRigState;
  anchorStability: number;
  ropeTension: number;
  ropeDistanceM: number;
  insideShelter: boolean;
  nearCampfire: boolean;
  carryingTeammate: boolean;
  wildlifeNearby: boolean;
  wildlifeThreatDist: number;
  flareActive: boolean;
  helicopterInbound: boolean;
  radioSignalStrength: number; // 0..100 for night search
  frostbiteRisk: boolean;
  hypothermiaRisk: boolean;
  altitudeSicknessRisk: boolean;
  avalancheWarning: boolean;
  rockfallWarning: boolean;
  floodWarning: boolean;
  landslideWarning: boolean;
  elapsedTime: number;
  distanceToCheckpoint: number;
  compassHeadingDeg: number;
  gpsCoords: string;
  interactPrompt: string | null;
  statusBanner: string | null;
  missionNotification: { title: string; subtitle: string } | null;
  activeDecision: StoryDecision | null;
  activeQte: ActiveQteEvent | null;
  timedEscape: TimedEscapeState | null;
  sessionPoints: number;
  newlyEarnedBadges: string[];
  variationLabel: string;
  equipment: EquipmentItem[];
  missions: MissionStep[];
  playerPos: { x: number; z: number; yaw: number };
  mapPoints: MiniMapPoint[];
  ridgeLength: number;
  failureReason?: string;
}

export interface SaveProgress {
  highestUnlockedLevel: number;
  completedLevels: number[];
  selectedCharacterId: string;
  customSuitColor: string;
  customName: string;
  bestTimes: Record<number, number>;
  routeChoice: RouteChoice;
  decisionsLog: string[];
  teamRoster: TeamMemberState[];
  expeditionAttempts: number;
  expeditionPoints: number;
  unlockedBadges: string[];
  unlockedOutfits: string[];
  gearUpgrades: GearUpgradeLevels;
  completedMissions: Record<number, string[]>;
  savedInventory: Record<string, { quantity: number; durability: number }>;
}
