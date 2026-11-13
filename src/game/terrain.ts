import * as THREE from 'three';
import { LevelConfig, RouteChoice } from './types';

export interface CrevasseZone {
  zCenter: number;
  halfWidthZ: number;
  xBridgeCenter: number;
  bridgeHalfWidthX: number;
  hasSnowBridge: boolean;
}

export interface IceWallZone {
  zStart: number;
  zEnd: number;
  xCenter: number;
  halfWidth: number;
}

export interface NarrowRidgeZone {
  zStart: number;
  zEnd: number;
  halfSafeWidth: number;
}

export interface IceCaveZone {
  zStart: number;
  zEnd: number;
  xCenter: number;
}

export interface RiverZone {
  zCenter: number;
  halfWidthZ: number;
  bedHeight: number;
}

export interface AnchorSlot {
  id: string;
  x: number;
  z: number;
  quality: 'solid' | 'poor';
  stability: number; // 0..100
  purpose: 'river' | 'icewall' | 'ridge';
}

export interface LandslideZone {
  zStart: number;
  zEnd: number;
  xCenter: number;
}

export class KarakoramTerrain {
  public readonly level: LevelConfig;
  public readonly route: RouteChoice;
  public readonly variationSeed: number;
  public readonly width = 128;
  public readonly length: number;
  public readonly ridgeCenterX: (z: number) => number;

  public readonly crevasses: CrevasseZone[] = [];
  public readonly iceWalls: IceWallZone[] = [];
  public readonly narrowRidges: NarrowRidgeZone[] = [];
  public readonly iceCaves: IceCaveZone[] = [];
  public readonly rivers: RiverZone[] = [];
  public readonly anchorSlots: AnchorSlot[] = [];
  public readonly landslides: LandslideZone[] = [];
  public readonly rockfallZones: { zStart: number; zEnd: number }[] = [];
  public readonly wildlifeZones: { z: number; x: number }[] = [];
  public readonly obstacleSlots: { id: string; z: number; x: number }[] = [];
  public readonly midCampZ: number;

  constructor(level: LevelConfig, route: RouteChoice = 'abruzzi', variationSeed = 0) {
    this.level = level;
    this.route = route;
    this.variationSeed = variationSeed;
    this.length = level.ridgeLength + 150;
    this.midCampZ = -level.ridgeLength * 0.56;

    const phase = level.id * 1.37 + (route === 'cesen' ? 0.75 : 0) + variationSeed * 0.22;
    const bridgeFlip = (level.id + variationSeed) % 2 === 0 ? 1 : -1;
    this.ridgeCenterX = (z: number) => {
      const t = Math.max(0, -z) / level.ridgeLength;
      return Math.sin(t * Math.PI * 3.1 + phase) * 9.5 + Math.sin(t * Math.PI * 6.4) * 2.4;
    };

    // 1. Glacial River / Meltwater Flood Zone (around 20% mark)
    if (level.hasGlacierRiver) {
      const rz = -level.ridgeLength * (0.2 + variationSeed * 0.015);
      this.rivers.push({
        zCenter: rz,
        halfWidthZ: 7.5,
        bedHeight: 0, // computed below after construction pass
      });
      // Solid rock bank anchor + weak gravel anchor on riverbank
      this.anchorSlots.push({
        id: 'anchor_river_solid',
        x: this.ridgeCenterX(rz + 8.5) - 2.2,
        z: rz + 8.5,
        quality: 'solid',
        stability: 95,
        purpose: 'river',
      });
      this.anchorSlots.push({
        id: 'anchor_river_poor',
        x: this.ridgeCenterX(rz + 8.5) + 3.4,
        z: rz + 8.5,
        quality: 'poor',
        stability: 38,
        purpose: 'river',
      });
    }

    // 2. Rockfall Couloir (around 32% mark)
    if (level.hasRockfall) {
      this.rockfallZones.push({
        zStart: -level.ridgeLength * 0.28,
        zEnd: -level.ridgeLength * 0.39,
      });
    }

    // 3. Landslide Scree Slope (around 42% mark)
    if (level.hasLandslide) {
      const ls = -level.ridgeLength * 0.41;
      const le = ls - 24;
      this.landslides.push({
        zStart: ls,
        zEnd: le,
        xCenter: this.ridgeCenterX((ls + le) * 0.5),
      });
    }

    // 4. Crevasses & Collapsing Snow Bridges (46% and 74% marks)
    if (level.hasCrevasses) {
      const z1 = -level.ridgeLength * (0.46 + variationSeed * 0.012);
      this.crevasses.push({
        zCenter: z1,
        halfWidthZ: 1.75,
        xBridgeCenter: this.ridgeCenterX(z1) + bridgeFlip * 2.4,
        bridgeHalfWidthX: 1.7,
        hasSnowBridge: level.hasSnowBridge,
      });

      const z2 = -level.ridgeLength * (0.75 - variationSeed * 0.012);
      this.crevasses.push({
        zCenter: z2,
        halfWidthZ: 1.85,
        xBridgeCenter: this.ridgeCenterX(z2) - bridgeFlip * 2.6,
        bridgeHalfWidthX: 1.6,
        hasSnowBridge: level.hasSnowBridge,
      });
    }

    // 5. Steep Climbable Ice Walls (62% and 84% marks) with Manual Anchor Slots
    if (level.hasIceWall) {
      const zS1 = -level.ridgeLength * 0.62;
      const zE1 = zS1 - 15;
      this.iceWalls.push({
        zStart: zS1,
        zEnd: zE1,
        xCenter: this.ridgeCenterX((zS1 + zE1) * 0.5),
        halfWidth: 10.5,
      });

      this.anchorSlots.push({
        id: 'anchor_wall1_solid',
        x: this.ridgeCenterX(zS1 + 1.5) - 1.5,
        z: zS1 + 1.5,
        quality: 'solid',
        stability: 96,
        purpose: 'icewall',
      });
      this.anchorSlots.push({
        id: 'anchor_wall1_mid',
        x: this.ridgeCenterX((zS1 + zE1) * 0.5) + 0.5,
        z: (zS1 + zE1) * 0.5,
        quality: 'solid',
        stability: 92,
        purpose: 'icewall',
      });
      this.anchorSlots.push({
        id: 'anchor_wall1_poor',
        x: this.ridgeCenterX(zS1 + 1.5) + 3.8,
        z: zS1 + 1.5,
        quality: 'poor',
        stability: 34,
        purpose: 'icewall',
      });

      const zS2 = -level.ridgeLength * 0.85;
      const zE2 = zS2 - 14;
      this.iceWalls.push({
        zStart: zS2,
        zEnd: zE2,
        xCenter: this.ridgeCenterX((zS2 + zE2) * 0.5),
        halfWidth: 10.5,
      });
      this.anchorSlots.push({
        id: 'anchor_wall2_solid',
        x: this.ridgeCenterX(zS2 + 1.5),
        z: zS2 + 1.5,
        quality: 'solid',
        stability: 94,
        purpose: 'icewall',
      });
    }

    // 6. Narrow Knife-Edge Ridge (around 90% mark)
    if (level.hasNarrowRidge) {
      const zS = -level.ridgeLength * 0.9;
      const zE = zS - 28;
      this.narrowRidges.push({
        zStart: zS,
        zEnd: zE,
        halfSafeWidth: 2.35,
      });
    }

    // 7. Ice Cave (around 69% mark)
    if (level.hasIceCave) {
      const zS = -level.ridgeLength * 0.69;
      const zE = zS - 12;
      this.iceCaves.push({
        zStart: zS,
        zEnd: zE,
        xCenter: this.ridgeCenterX((zS + zE) * 0.5),
      });
    }

    // 8. Wildlife Stalking Zones
    if (level.hasWildlife) {
      const wz1 = -level.ridgeLength * (0.34 + variationSeed * 0.03);
      this.wildlifeZones.push({ z: wz1, x: this.ridgeCenterX(wz1) + bridgeFlip * 3.5 });
      const wz2 = -level.ridgeLength * (0.64 + variationSeed * 0.02);
      this.wildlifeZones.push({ z: wz2, x: this.ridgeCenterX(wz2) - bridgeFlip * 3.2 });
    }

    // 9. Pushable Debris / Ice Barricades
    if (level.hasObstacles) {
      const oz1 = -level.ridgeLength * (0.52 + variationSeed * 0.02);
      this.obstacleSlots.push({
        id: 'obs_1',
        z: oz1,
        x: this.ridgeCenterX(oz1),
      });
      if (level.hasIceCave) {
        const oz2 = -level.ridgeLength * 0.705;
        this.obstacleSlots.push({
          id: 'obs_cave',
          z: oz2,
          x: this.ridgeCenterX(oz2),
        });
      }
    }

    // Compute exact river bed heights
    for (const r of this.rivers) {
      r.bedHeight = this.getHeightAt(this.ridgeCenterX(r.zCenter), r.zCenter);
    }
  }

  private hashNoise(x: number, z: number): number {
    const s = Math.sin(x * 0.17 + z * 0.13 + this.level.id * 3.1) * 43758.5453;
    return s - Math.floor(s);
  }

  private smoothNoise(x: number, z: number): number {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx);
    const uz = fz * fz * (3 - 2 * fz);

    const a = this.hashNoise(ix, iz);
    const b = this.hashNoise(ix + 1, iz);
    const c = this.hashNoise(ix, iz + 1);
    const d = this.hashNoise(ix + 1, iz + 1);

    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
  }

  public isInDeepSnow(x: number, z: number): boolean {
    const progress = Math.max(0, -z) / this.level.ridgeLength;
    if (progress < 0.15 && this.level.hasForestValley) return false;
    const cx = this.ridgeCenterX(z);
    const dist = Math.abs(x - cx);
    // Deep drifts off the packed trail or in upper snow bowls
    const n = this.smoothNoise(x * 0.14, z * 0.14);
    return dist > 3.8 || (progress > 0.45 && n > 0.62);
  }

  public getSurfaceType(x: number, z: number): string {
    const progress = Math.max(0, -z) / this.level.ridgeLength;
    for (const r of this.rivers) {
      if (Math.abs(z - r.zCenter) < r.halfWidthZ) return 'Glacial Stream';
    }
    for (const wall of this.iceWalls) {
      if (z <= wall.zStart && z >= wall.zEnd) return 'Vertical Blue Ice';
    }
    if (this.isOnNarrowRidge(x, z).active) return 'Knife-Edge Ridge';
    if (progress < 0.16 && this.level.hasForestValley) return 'Rocky Alpine Trail';
    if (this.isInDeepSnow(x, z)) return 'Deep Powder Snow';
    return 'Packed Snow & Granite';
  }

  public isOnNarrowRidge(x: number, z: number): { active: boolean; offsetFromCenter: number } {
    for (const nr of this.narrowRidges) {
      if (z <= nr.zStart && z >= nr.zEnd) {
        const cx = this.ridgeCenterX(z);
        return { active: true, offsetFromCenter: x - cx };
      }
    }
    return { active: false, offsetFromCenter: 0 };
  }

  public isInsideIceCave(x: number, z: number): boolean {
    for (const cave of this.iceCaves) {
      if (z <= cave.zStart && z >= cave.zEnd && Math.abs(x - cave.xCenter) < 4.5) {
        return true;
      }
    }
    return false;
  }

  public isInRockfallZone(z: number): boolean {
    for (const rf of this.rockfallZones) {
      if (z <= rf.zStart && z >= rf.zEnd) return true;
    }
    return false;
  }

  public getHeightAt(x: number, z: number): number {
    const progress = Math.max(0, -z) / this.level.ridgeLength;
    const clampedP = Math.min(1.25, progress);

    const steepMul =
      this.route === 'abruzzi' ? this.level.steepness * 1.04 : this.level.steepness * 0.96;
    let h = clampedP * 115 * steepMul;

    if (z > -10) {
      h *= Math.max(0, (10 + z) / 10) * 0.15;
    }

    // Flatten valley basin for glacial river crossing
    for (const r of this.rivers) {
      const dz = Math.abs(z - r.zCenter);
      if (dz < r.halfWidthZ + 4) {
        const baseRiverH = (-r.zCenter / this.level.ridgeLength) * 115 * steepMul;
        const blend = THREE.MathUtils.clamp(1 - dz / (r.halfWidthZ + 4), 0, 1);
        const targetH = baseRiverH - (dz < r.halfWidthZ ? (1 - dz / r.halfWidthZ) * 2.1 : 0);
        h = THREE.MathUtils.lerp(h, targetH, blend);
      }
    }

    // Add vertical Ice Wall pitches (+9.5m each)
    for (const wall of this.iceWalls) {
      if (z < wall.zStart) {
        const span = wall.zStart - wall.zEnd;
        const t = Math.min(1, (wall.zStart - z) / span);
        const step = t * t * (3 - 2 * t) * 9.5;
        h += step;
      }
    }

    const cx = this.ridgeCenterX(z);
    const distFromRidge = Math.abs(x - cx);

    const nrInfo = this.isOnNarrowRidge(x, z);
    if (nrInfo.active) {
      if (distFromRidge > 2.35) {
        h -= Math.min(10.0, (distFromRidge - 2.35) * 1.85);
      }
    } else if (distFromRidge > 11.0) {
      const excess = distFromRidge - 11.0;
      if (distFromRidge < 26) {
        h += Math.pow(excess, 1.32) * 0.58;
      } else {
        h += Math.pow(15.0, 1.32) * 0.58 + (distFromRidge - 26) * 1.15;
      }
    }

    const n1 = (this.smoothNoise(x * 0.08, z * 0.08) - 0.5) * 2.4 * this.level.roughness;
    const n2 = (this.smoothNoise(x * 0.22, z * 0.22) - 0.5) * 0.8 * this.level.roughness;
    const trailFlatten = distFromRidge < 4.5 && progress < 0.94 ? 0.5 : 1.0;
    const midCampFlat = Math.abs(z - this.midCampZ) < 7 && distFromRidge < 7 ? 0.25 : 1.0;
    const summitFlat = progress > 0.96 && distFromRidge < 8 ? 0.25 : 1.0;

    h += (n1 + n2) * trailFlatten * midCampFlat * summitFlat;

    // Carve crevasse trenches
    for (const crev of this.crevasses) {
      const dz = Math.abs(z - crev.zCenter);
      if (dz < crev.halfWidthZ) {
        const dxBridge = Math.abs(x - crev.xBridgeCenter);
        if (crev.hasSnowBridge || dxBridge > crev.bridgeHalfWidthX) {
          const depthFactor = 1 - dz / crev.halfWidthZ;
          h -= depthFactor * 8.5;
        }
      }
    }

    return h;
  }

  public getSlopeDegrees(x: number, z: number): number {
    const eps = 0.6;
    const hL = this.getHeightAt(x - eps, z);
    const hR = this.getHeightAt(x + eps, z);
    const hF = this.getHeightAt(x, z - eps);
    const hB = this.getHeightAt(x, z + eps);
    const dx = (hR - hL) / (2 * eps);
    const dz = (hF - hB) / (2 * eps);
    const slopeRad = Math.atan(Math.sqrt(dx * dx + dz * dz));
    return THREE.MathUtils.radToDeg(slopeRad);
  }

  public isInsideCrevasse(x: number, z: number, activeBridgeCollapsed: boolean[]): boolean {
    for (let i = 0; i < this.crevasses.length; i++) {
      const crev = this.crevasses[i];
      const dz = Math.abs(z - crev.zCenter);
      const dxBridge = Math.abs(x - crev.xBridgeCenter);
      const onBridge = dxBridge <= crev.bridgeHalfWidthX;
      if (dz < crev.halfWidthZ * 0.86) {
        if (!onBridge) return true;
        if (crev.hasSnowBridge && activeBridgeCollapsed[i]) return true;
      }
    }
    return false;
  }

  public buildGeometry(segX: number, segZ: number): THREE.BufferGeometry {
    const geo = new THREE.PlaneGeometry(this.width, this.length, segX, segZ);
    geo.rotateX(-Math.PI / 2);

    const zOffset = -this.length / 2 + 65;
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    const valleyEarth = new THREE.Color(0x4b4a45);
    const snowColor = new THREE.Color(0xdbe4ee);
    const windSnowColor = new THREE.Color(0xaec0d2);
    const rockColor = new THREE.Color(0x363d47);
    const iceColor = new THREE.Color(0x6398b8);
    const crevColor = new THREE.Color(0x132b42);
    const riverBedColor = new THREE.Color(0x283440);
    const tmpColor = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i) + zOffset;
      const vy = this.getHeightAt(vx, vz);
      pos.setXYZ(i, vx, vy, vz);
    }

    geo.computeVertexNormals();
    const norm = geo.attributes.normal;

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const ny = norm.getY(i);
      const progress = Math.max(0, -vz) / this.level.ridgeLength;

      const cx = this.ridgeCenterX(vz);
      const distRidge = Math.abs(vx - cx);

      let inCrev = false;
      for (const crev of this.crevasses) {
        if (
          Math.abs(vz - crev.zCenter) < crev.halfWidthZ &&
          (crev.hasSnowBridge || Math.abs(vx - crev.xBridgeCenter) > crev.bridgeHalfWidthX)
        ) {
          inCrev = true;
          break;
        }
      }

      let inRiver = false;
      for (const r of this.rivers) {
        if (Math.abs(vz - r.zCenter) < r.halfWidthZ) {
          inRiver = true;
          break;
        }
      }

      let onIceWall = false;
      for (const wall of this.iceWalls) {
        if (vz <= wall.zStart && vz >= wall.zEnd && Math.abs(vx - wall.xCenter) < wall.halfWidth) {
          onIceWall = true;
          break;
        }
      }

      const trailMix = distRidge < 2.9 ? 1 - distRidge / 2.9 : 0;
      const trailPathColor = new THREE.Color(0x9fb4c8);

      if (inCrev) {
        tmpColor.copy(crevColor);
      } else if (inRiver) {
        tmpColor.copy(riverBedColor);
      } else if (onIceWall && ny < 0.88) {
        tmpColor.copy(iceColor).lerp(snowColor, 0.16);
      } else if (progress < 0.16 && this.level.hasForestValley) {
        const snowPatch = this.smoothNoise(vx * 0.12, vz * 0.12);
        tmpColor.copy(valleyEarth).lerp(windSnowColor, snowPatch * 0.45);
        if (ny < 0.78) tmpColor.lerp(rockColor, 0.7);
        if (trailMix > 0) tmpColor.lerp(new THREE.Color(0x8c877c), trailMix * 0.55);
      } else if (ny < 0.74 || distRidge > 12.8) {
        const rockMix = THREE.MathUtils.clamp((0.82 - ny) * 2.8, 0, 1);
        tmpColor.copy(windSnowColor).lerp(rockColor, rockMix);
      } else {
        const shade = this.smoothNoise(vx * 0.15, vz * 0.15);
        tmpColor.copy(snowColor).lerp(windSnowColor, shade * 0.45);
        if (trailMix > 0) tmpColor.lerp(trailPathColor, trailMix * 0.42);
      }

      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeBoundingSphere();
    return geo;
  }
}
