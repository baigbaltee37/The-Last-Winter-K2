import * as THREE from 'three';

export interface MountaineerRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  torsoGroup: THREE.Group;
  leftHip: THREE.Group;
  leftKnee: THREE.Group;
  rightHip: THREE.Group;
  rightKnee: THREE.Group;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  head: THREE.Group;
  breathPuff: THREE.Mesh;
  headlamp: THREE.SpotLight;
  headlampLens: THREE.Mesh;
}

export function createMountaineerModel(
  suitColorHex: string,
  accentColorHex: string,
  helmetColorHex: string,
  skinToneHex = '#b58363'
): MountaineerRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const suitMat = new THREE.MeshStandardMaterial({
    color: suitColorHex,
    roughness: 0.78,
    metalness: 0.04,
  });
  const baffleMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(suitColorHex).multiplyScalar(0.86),
    roughness: 0.82,
    metalness: 0.04,
  });
  const darkGearMat = new THREE.MeshStandardMaterial({
    color: 0x1a2029,
    roughness: 0.88,
    metalness: 0.12,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColorHex,
    roughness: 0.62,
    metalness: 0.08,
  });
  const helmetMat = new THREE.MeshStandardMaterial({
    color: helmetColorHex,
    roughness: 0.36,
    metalness: 0.14,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: skinToneHex,
    roughness: 0.68,
    metalness: 0.02,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xc4ced9,
    roughness: 0.28,
    metalness: 0.88,
  });
  const goggleGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x264463,
    roughness: 0.08,
    metalness: 0.25,
    transparent: true,
    opacity: 0.72,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
  });

  // 1. Anatomically Proportioned Articulated Legs (Hip y = 0.90m, Knee y = -0.42m)
  const buildLeg = (xOffset: number) => {
    const hip = new THREE.Group();
    hip.position.set(xOffset, 0.9, 0);

    // Thigh (tapered Lathe/Cylinder)
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.092, 0.42, 12), darkGearMat);
    thigh.position.y = -0.21;
    thigh.castShadow = true;
    hip.add(thigh);

    // Knee joint & gaiter pad
    const knee = new THREE.Group();
    knee.position.set(0, -0.42, 0);
    hip.add(knee);

    const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.092, 10, 8), darkGearMat);
    knee.add(kneeCap);

    // Calf / shin in insulated shell
    const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.36, 12), suitMat);
    calf.position.y = -0.19;
    calf.castShadow = true;
    knee.add(calf);

    // High-Altitude Double Mountaineering Boot
    const bootUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.086, 0.14, 10), darkGearMat);
    bootUpper.position.set(0, -0.37, 0);
    knee.add(bootUpper);

    const bootFoot = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.1, 0.28), accentMat);
    bootFoot.position.set(0, -0.43, -0.045);
    bootFoot.castShadow = true;
    knee.add(bootFoot);

    // Steel 12-point Crampon frame + front points
    const cramponPlate = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.035, 0.3), steelMat);
    cramponPlate.position.set(0, -0.47, -0.05);
    knee.add(cramponPlate);

    return { hip, knee };
  };

  const leftLegRig = buildLeg(-0.125);
  const rightLegRig = buildLeg(0.125);
  bodyGroup.add(leftLegRig.hip, rightLegRig.hip);

  // 2. Sculpted Torso with Down Jacket Baffles, Harness & Heavy Expedition Pack
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.92, 0);
  bodyGroup.add(torsoGroup);

  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.175, 0.14, 14), darkGearMat);
  pelvis.position.y = 0.04;
  pelvis.scale.set(1.12, 1, 0.78);
  torsoGroup.add(pelvis);

  // Down parka horizontal baffle layers for authentic alpine silhouette
  for (let b = 0; b < 4; b++) {
    const r = 0.18 + b * 0.015;
    const baffle = new THREE.Mesh(
      new THREE.CylinderGeometry(r + 0.012, r, 0.12, 14),
      b % 2 === 0 ? suitMat : baffleMat
    );
    baffle.position.y = 0.14 + b * 0.105;
    baffle.scale.set(1.14, 1, 0.76);
    baffle.castShadow = true;
    torsoGroup.add(baffle);
  }

  // Shoulders yoke
  const shoulders = new THREE.Mesh(new THREE.CapsuleGeometry(0.125, 0.28, 6, 12), accentMat);
  shoulders.rotation.z = Math.PI / 2;
  shoulders.position.y = 0.52;
  shoulders.scale.set(0.85, 1, 0.76);
  shoulders.castShadow = true;
  torsoGroup.add(shoulders);

  // Climbing Harness + Gear Loops & Carabiners
  const harnessBelt = new THREE.Mesh(new THREE.TorusGeometry(0.195, 0.024, 6, 16), darkGearMat);
  harnessBelt.rotation.x = Math.PI / 2;
  harnessBelt.scale.set(1.12, 0.82, 1);
  harnessBelt.position.y = 0.08;
  torsoGroup.add(harnessBelt);

  [-0.17, 0.17].forEach((cx) => {
    const biner = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.008, 6, 10), steelMat);
    biner.position.set(cx, 0.06, -0.02);
    biner.rotation.y = Math.PI / 2;
    torsoGroup.add(biner);
  });

  // Grounding contact shadow beneath boots
  const contactShadowMat = new THREE.MeshBasicMaterial({
    color: 0x050912,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), contactShadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.02;
  bodyGroup.add(contactShadow);

  // Heavy Expedition Backpack (on +Z back side) with high-visibility alpine trim
  const packBody = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.52, 0.22), suitMat);
  packBody.position.set(0, 0.34, 0.24);
  packBody.castShadow = true;
  torsoGroup.add(packBody);

  const packStraps = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.23), accentMat);
  packStraps.position.set(0, 0.34, 0.24);
  torsoGroup.add(packStraps);

  const packLid = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.24), accentMat);
  packLid.position.set(0, 0.6, 0.23);
  torsoGroup.add(packLid);

  const sleepingPad = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.36, 10), baffleMat);
  sleepingPad.rotation.z = Math.PI / 2;
  sleepingPad.position.set(0, 0.08, 0.32);
  torsoGroup.add(sleepingPad);

  const o2Tank = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.38, 12), steelMat);
  o2Tank.position.set(0.11, 0.34, 0.35);
  o2Tank.castShadow = true;
  torsoGroup.add(o2Tank);

  const ropeCoil = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.024, 6, 16), accentMat);
  ropeCoil.position.set(-0.07, 0.56, 0.33);
  ropeCoil.rotation.x = Math.PI * 0.16;
  torsoGroup.add(ropeCoil);

  // 3. Realistic Human Head, Neck, Facial Anatomy, Balaclava, Goggles & Helmet
  const head = new THREE.Group();
  head.position.set(0, 0.66, -0.02);
  torsoGroup.add(head);

  // Neck + thermal gaiter collar
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.085, 0.12, 12), darkGearMat);
  neck.position.y = 0.02;
  head.add(neck);

  // Cranium & sculpted jaw
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.122, 16, 14), skinMat);
  cranium.position.y = 0.14;
  cranium.scale.set(0.92, 1.08, 1.0);
  cranium.castShadow = true;
  head.add(cranium);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.14), skinMat);
  jaw.position.set(0, 0.08, -0.03);
  head.add(jaw);

  // Nose bridge
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.048, 0.045), skinMat);
  nose.position.set(0, 0.13, -0.115);
  nose.rotation.x = -0.25;
  head.add(nose);

  // Eyes & eyebrows (visible behind translucent alpine goggles)
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1e1b18, roughness: 0.3 });
  [-0.038, 0.038].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 8), eyeMat);
    eye.position.set(ex, 0.155, -0.11);
    head.add(eye);
  });

  // Cold-weather storm mask / lower face balaclava
  const balaclava = new THREE.Mesh(
    new THREE.CylinderGeometry(0.112, 0.105, 0.11, 14),
    darkGearMat
  );
  balaclava.position.set(0, 0.075, -0.01);
  head.add(balaclava);

  // Translucent Glacier Goggles with frame
  const goggleFrame = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.068, 0.05), darkGearMat);
  goggleFrame.position.set(0, 0.158, -0.112);
  head.add(goggleFrame);

  const goggleLens = new THREE.Mesh(new THREE.BoxGeometry(0.175, 0.052, 0.056), goggleGlassMat);
  goggleLens.position.set(0, 0.158, -0.116);
  head.add(goggleLens);

  // Impact Climbing Helmet
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.136, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
    helmetMat
  );
  helmet.position.set(0, 0.175, 0);
  helmet.castShadow = true;
  head.add(helmet);

  // Headlamp unit & spotlight
  const headlampLensMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0xbae6fd,
    emissiveIntensity: 0.2,
    roughness: 0.2,
  });
  const headlampLens = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.032, 0.035), headlampLensMat);
  headlampLens.position.set(0, 0.235, -0.13);
  head.add(headlampLens);

  const headlamp = new THREE.SpotLight(0xf1f5f9, 0, 48, Math.PI / 4.2, 0.45, 1.25);
  headlamp.position.set(0, 0.235, -0.16);
  headlamp.target.position.set(0, -0.45, -9);
  head.add(headlamp);
  head.add(headlamp.target);

  // Visible Freezing Breath Vapor Cloud
  const breathMat = new THREE.MeshStandardMaterial({
    color: 0xe2eef8,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    roughness: 1.0,
  });
  const breathPuff = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), breathMat);
  breathPuff.position.set(0, 0.09, -0.2);
  head.add(breathPuff);

  // 4. Articulated Arms, Elbows, Detailed Fingers/Hands & Dual Steel Ice Axes
  const buildArm = (xOffset: number, sideSign: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(xOffset, 0.52, 0);

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.066, 0.29, 10), suitMat);
    upperArm.position.y = -0.145;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.29, 0);
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.054, 0.26, 10), baffleMat);
    forearm.position.y = -0.13;
    forearm.castShadow = true;
    elbow.add(forearm);

    // Detailed Gloved Hand (Palm + Thumb + 4 Articulated Fingers)
    const handGroup = new THREE.Group();
    handGroup.position.set(0, -0.27, -0.01);
    elbow.add(handGroup);

    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.078, 0.048), darkGearMat);
    handGroup.add(palm);

    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.032, 3, 6), darkGearMat);
    thumb.position.set(-sideSign * 0.04, -0.01, -0.02);
    thumb.rotation.z = sideSign * 0.5;
    handGroup.add(thumb);

    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.034, 3, 6), darkGearMat);
      finger.position.set((f - 1.5) * 0.016, -0.052, -0.012);
      finger.rotation.x = 0.4;
      handGroup.add(finger);
    }

    // Technical Ice Axe held in hand
    const axeGroup = new THREE.Group();
    axeGroup.position.set(0, -0.035, -0.04);
    axeGroup.rotation.x = -Math.PI * 0.36;

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.56, 8), accentMat);
    shaft.position.y = -0.14;
    axeGroup.add(shaft);

    const pick = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.042, 0.24), steelMat);
    pick.position.set(0, 0.14, -0.05);
    axeGroup.add(pick);

    handGroup.add(axeGroup);

    return { shoulder, elbow };
  };

  const leftArmRig = buildArm(-0.26, -1);
  const rightArmRig = buildArm(0.26, 1);
  torsoGroup.add(leftArmRig.shoulder, rightArmRig.shoulder);

  return {
    root,
    bodyGroup,
    torsoGroup,
    leftHip: leftLegRig.hip,
    leftKnee: leftLegRig.knee,
    rightHip: rightLegRig.hip,
    rightKnee: rightLegRig.knee,
    leftShoulder: leftArmRig.shoulder,
    leftElbow: leftArmRig.elbow,
    rightShoulder: rightArmRig.shoulder,
    rightElbow: rightArmRig.elbow,
    head,
    breathPuff,
    headlamp,
    headlampLens,
  };
}

export function createTentCampModel(): THREE.Group {
  const group = new THREE.Group();

  const tentMat = new THREE.MeshStandardMaterial({
    color: 0xb95c2d,
    roughness: 0.72,
    metalness: 0.04,
  });
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x18202b,
    roughness: 0.88,
  });
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.3,
    metalness: 0.8,
  });

  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.95, 0.14, 12), baseMat);
  pad.position.y = 0.07;
  pad.receiveShadow = true;
  group.add(pad);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.7, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    tentMat
  );
  dome.position.y = 0.08;
  dome.scale.set(1.1, 0.9, 1.3);
  dome.castShadow = true;
  dome.receiveShadow = true;
  group.add(dome);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.85, 0.25), baseMat);
  door.position.set(0, 0.5, 1.78);
  group.add(door);

  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    emissive: 0xd97706,
    emissiveIntensity: 1.4,
    roughness: 0.3,
  });
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), glowMat);
  lantern.position.set(0, 0.72, 1.85);
  group.add(lantern);

  const tentLight = new THREE.PointLight(0xf59e0b, 1.8, 12, 1.5);
  tentLight.position.set(0, 0.9, 2.2);
  group.add(tentLight);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.7, 6), poleMat);
  pole.position.set(2.15, 1.35, 0.4);
  pole.castShadow = true;
  group.add(pole);

  return group;
}

export function createCampfireModel(): THREE.Group {
  const group = new THREE.Group();
  const logMat = new THREE.MeshStandardMaterial({ color: 0x3b2d22, roughness: 0.9 });
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.75, 7), logMat);
    log.position.y = 0.08;
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i * Math.PI) / 4;
    group.add(log);
  }
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xfb923c,
    emissive: 0xea580c,
    emissiveIntensity: 1.8,
  });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.48, 7), emberMat);
  flame.position.y = 0.28;
  group.add(flame);

  const fireLight = new THREE.PointLight(0xfb923c, 3.2, 16, 1.4);
  fireLight.position.set(0, 0.75, 0);
  group.add(fireLight);
  return group;
}

export function createPineTreeModel(): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3f3024, roughness: 0.92 });
  const needleMat = new THREE.MeshStandardMaterial({ color: 0x243832, roughness: 0.88 });
  const snowTipMat = new THREE.MeshStandardMaterial({ color: 0xdbe5ef, roughness: 0.82 });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 3.0, 7), trunkMat);
  trunk.position.y = 1.5;
  trunk.castShadow = true;
  group.add(trunk);

  [0, 1, 2].forEach((tier) => {
    const baseR = 1.65 - tier * 0.38;
    const h = 2.2 - tier * 0.24;
    const yCenter = 2.75 + tier * 1.25;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(baseR, h, 8), needleMat);
    cone.position.y = yCenter;
    cone.castShadow = true;
    group.add(cone);

    if (tier === 2) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(baseR * 0.58, h * 0.54, 8), snowTipMat);
      cap.position.y = yCenter + h * 0.24;
      group.add(cap);
    }
  });
  return group;
}

export function createCoverBoulderModel(): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x47505c,
    roughness: 0.92,
    metalness: 0.06,
  });
  const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(1.7, 1), mat);
  boulder.position.y = 0.9;
  boulder.scale.set(1.25, 0.95, 1.0);
  boulder.castShadow = true;
  boulder.receiveShadow = true;
  group.add(boulder);
  return group;
}

export function createAnchorSlotMarker(quality: 'solid' | 'poor'): THREE.Group {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({
    color: quality === 'solid' ? 0x475569 : 0x64748b,
    roughness: 0.85,
  });
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), baseMat);
  rock.position.y = 0.18;
  group.add(rock);

  const ringMat = new THREE.MeshStandardMaterial({
    color: quality === 'solid' ? 0x7dd3fc : 0xfbbf24,
    emissive: quality === 'solid' ? 0x0284c7 : 0xb45309,
    emissiveIntensity: 0.8,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 6, 18), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.28;
  group.add(ring);

  return group;
}

export function createBeaconModel(isSummit: boolean): { group: THREE.Group; flag: THREE.Mesh; ring: THREE.Mesh } {
  const group = new THREE.Group();

  const poleMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    roughness: 0.28,
    metalness: 0.85,
  });
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.75,
  });
  const flagMat = new THREE.MeshStandardMaterial({
    color: isSummit ? 0x1e7a48 : 0xc26d27,
    emissive: isSummit ? 0x14532d : 0x7c2d12,
    emissiveIntensity: 0.4,
    roughness: 0.65,
    side: THREE.DoubleSide,
  });

  const cairn = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 0.48, 7), baseMat);
  cairn.position.y = 0.24;
  cairn.castShadow = true;
  group.add(cairn);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 3.8, 8), poleMat);
  pole.position.y = 1.9;
  pole.castShadow = true;
  group.add(pole);

  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8, 4, 2), flagMat);
  flag.position.set(0.72, 3.3, 0);
  flag.castShadow = true;
  group.add(flag);

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x0369a1,
    emissiveIntensity: 1.0,
    roughness: 0.3,
    transparent: true,
    opacity: 0.75,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.07, 8, 32), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.16;
  group.add(ring);

  return { group, flag, ring };
}

export function createSupplyCacheModel(type: 'o2' | 'ration'): THREE.Group {
  const group = new THREE.Group();
  if (type === 'o2') {
    const tankMat = new THREE.MeshStandardMaterial({
      color: 0x2b6cb0,
      roughness: 0.35,
      metalness: 0.65,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.25,
      metalness: 0.9,
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.75, 12), tankMat);
    body.position.y = 0.4;
    body.castShadow = true;
    group.add(body);

    const neck = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), tankMat);
    neck.position.y = 0.76;
    group.add(neck);

    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 8), brassMat);
    valve.position.y = 0.95;
    group.add(valve);
  } else {
    const crateMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.65,
      metalness: 0.1,
    });
    const latchMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.5,
      metalness: 0.7,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.42, 0.48), crateMat);
    box.position.y = 0.22;
    box.castShadow = true;
    group.add(box);

    const band = new THREE.Mesh(new THREE.BoxGeometry(0.67, 0.08, 0.5), latchMat);
    band.position.y = 0.24;
    group.add(band);
  }
  return group;
}

export function createAnchorModel(): { group: THREE.Group; statusOrb: THREE.Mesh } {
  const group = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.3,
    metalness: 0.85,
  });
  const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 1.4, 8), metalMat);
  stake.position.y = 0.7;
  stake.castShadow = true;
  group.add(stake);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 6, 12), metalMat);
  ring.position.set(0, 1.25, 0.08);
  group.add(ring);

  const orbMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0xdc2626,
    emissiveIntensity: 0.9,
    roughness: 0.3,
  });
  const statusOrb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), orbMat);
  statusOrb.position.y = 1.52;
  group.add(statusOrb);

  return { group, statusOrb };
}

export function createLadderModel(length: number): THREE.Group {
  const group = new THREE.Group();
  const railMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.3,
    metalness: 0.82,
  });

  const railL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, length), railMat);
  railL.position.set(-0.32, 0.05, 0);
  railL.castShadow = true;
  const railR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, length), railMat);
  railR.position.set(0.32, 0.05, 0);
  railR.castShadow = true;
  group.add(railL, railR);

  const rungs = Math.max(4, Math.floor(length / 0.45));
  for (let i = 0; i < rungs; i++) {
    const rz = -length / 2 + 0.3 + i * ((length - 0.6) / (rungs - 1));
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.64, 6), railMat);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(0, 0.05, rz);
    group.add(rung);
  }
  return group;
}

export function createStrandedClimberModel(): THREE.Group {
  return createMountaineerModel('#9c422c', '#d97706', '#cbd5e1', '#b58363').root;
}

export function createSnowBridgeModel(widthX: number, lengthZ: number): THREE.Group {
  const group = new THREE.Group();
  const bridgeMat = new THREE.MeshStandardMaterial({
    color: 0xdbe4ee,
    roughness: 0.82,
    metalness: 0.04,
  });
  const iceUndersideMat = new THREE.MeshStandardMaterial({
    color: 0x6398b8,
    roughness: 0.35,
    metalness: 0.1,
  });

  const slab = new THREE.Mesh(new THREE.BoxGeometry(widthX, 0.45, lengthZ), bridgeMat);
  slab.position.y = -0.15;
  slab.receiveShadow = true;
  slab.castShadow = true;
  group.add(slab);

  const iceCore = new THREE.Mesh(
    new THREE.BoxGeometry(widthX * 0.9, 0.25, lengthZ * 0.85),
    iceUndersideMat
  );
  iceCore.position.y = -0.4;
  group.add(iceCore);

  return group;
}

export function createIceCaveModel(lengthZ: number): THREE.Group {
  const group = new THREE.Group();
  const iceMat = new THREE.MeshPhysicalMaterial({
    color: 0x5c90b0,
    roughness: 0.22,
    metalness: 0.08,
    clearcoat: 0.8,
    side: THREE.DoubleSide,
  });

  const archCount = 4;
  for (let i = 0; i < archCount; i++) {
    const zPos = -lengthZ / 2 + (i + 0.5) * (lengthZ / archCount);
    const arch = new THREE.Mesh(
      new THREE.CylinderGeometry(4.6, 5.1, lengthZ / archCount + 0.6, 10, 1, true, 0, Math.PI),
      iceMat
    );
    arch.rotation.z = Math.PI / 2;
    arch.rotation.y = Math.PI / 2;
    arch.position.set(0, 0.2, zPos);
    arch.receiveShadow = true;
    group.add(arch);
  }
  return group;
}

export function createSafetyPitonModel(): THREE.Group {
  const group = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.25,
    metalness: 0.9,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x0369a1,
    emissiveIntensity: 1.0,
  });

  const piton = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.02, 0.65, 8), steelMat);
  piton.position.y = 0.28;
  group.add(piton);

  const biner = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 6, 12), glowMat);
  biner.position.set(0, 0.56, 0);
  group.add(biner);

  return group;
}

export function createEmergencyShelterModel(): { group: THREE.Group; ring: THREE.Mesh } {
  const group = createTentCampModel();
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    emissive: 0xb45309,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.78,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.06, 8, 28), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.16;
  group.add(ring);
  return { group, ring };
}

export interface WildlifeRig {
  group: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  legs: THREE.Group[];
  tail: THREE.Mesh;
}

export function createWildlifeModel(): WildlifeRig {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.62;
  group.add(body);

  const furMat = new THREE.MeshStandardMaterial({
    color: 0x646e7a,
    roughness: 0.9,
    metalness: 0.02,
  });
  const bellyMat = new THREE.MeshStandardMaterial({
    color: 0xb8c2cc,
    roughness: 0.85,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xd97706,
    emissiveIntensity: 1.2,
  });

  // Torso & chest ruff
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.72, 6, 12), furMat);
  torso.rotation.x = Math.PI / 2;
  torso.castShadow = true;
  body.add(torso);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 10), bellyMat);
  chest.position.set(0, -0.02, -0.32);
  chest.castShadow = true;
  body.add(chest);

  // Head & snout
  const head = new THREE.Group();
  head.position.set(0, 0.14, -0.52);
  body.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), furMat);
  skull.scale.set(0.95, 0.92, 1.15);
  skull.castShadow = true;
  head.add(skull);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.22), bellyMat);
  snout.position.set(0, -0.03, -0.18);
  head.add(snout);

  [-0.08, 0.08].forEach((ex) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 5), furMat);
    ear.position.set(ex, 0.18, 0.02);
    head.add(ear);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), eyeMat);
    eye.position.set(ex * 0.75, 0.04, -0.15);
    head.add(eye);
  });

  // Tail
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.42, 4, 8), furMat);
  tail.position.set(0, 0.02, 0.56);
  tail.rotation.x = 0.9;
  body.add(tail);

  // 4 Articulated Legs (grounded bottom-center pivot at y = 0)
  const legs: THREE.Group[] = [];
  const legOffsets: [number, number][] = [
    [-0.16, -0.34],
    [0.16, -0.34],
    [-0.16, 0.34],
    [0.16, 0.34],
  ];
  for (const [lx, lz] of legOffsets) {
    const leg = new THREE.Group();
    leg.position.set(lx, -0.1, lz);
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.52, 8), furMat);
    limb.position.y = -0.26;
    limb.castShadow = true;
    leg.add(limb);
    const paw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.13), bellyMat);
    paw.position.set(0, -0.5, -0.02);
    leg.add(paw);
    body.add(leg);
    legs.push(leg);
  }

  return { group, body, head, legs, tail };
}

export interface HelicopterRig {
  group: THREE.Group;
  mainRotor: THREE.Group;
  tailRotor: THREE.Group;
  searchLight: THREE.SpotLight;
}

export function createHelicopterModel(): HelicopterRig {
  const group = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xb93c26,
    roughness: 0.42,
    metalness: 0.25,
  });
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.35,
    metalness: 0.2,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.85,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e3a5f,
    roughness: 0.1,
    metalness: 0.2,
    transparent: true,
    opacity: 0.72,
    clearcoat: 1.0,
  });

  // Fuselage body
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 4.4), hullMat);
  cabin.position.y = 1.6;
  cabin.castShadow = true;
  group.add(cabin);

  const noseGlass = new THREE.Mesh(new THREE.SphereGeometry(1.08, 12, 10), glassMat);
  noseGlass.scale.set(0.95, 0.85, 1.25);
  noseGlass.position.set(0, 1.55, -2.05);
  group.add(noseGlass);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.34, 3.8), stripeMat);
  stripe.position.set(0, 1.62, 0.1);
  group.add(stripe);

  // Tail boom & vertical stabilizer
  const tailBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.42, 4.6, 8), hullMat);
  tailBoom.rotation.x = Math.PI / 2;
  tailBoom.position.set(0, 1.85, 4.3);
  tailBoom.castShadow = true;
  group.add(tailBoom);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.25, 0.85), stripeMat);
  fin.position.set(0, 2.35, 6.4);
  group.add(fin);

  // Landing skids
  [-1.05, 1.05].forEach((sx) => {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.2, 8), metalMat);
    skid.rotation.x = Math.PI / 2;
    skid.position.set(sx, 0.12, -0.2);
    group.add(skid);

    [-1.1, 1.0].forEach((sz) => {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 6), metalMat);
      strut.position.set(sx * 0.86, 0.48, sz);
      strut.rotation.z = sx > 0 ? 0.25 : -0.25;
      group.add(strut);
    });
  });

  // Main 4-blade Rotor
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 2.75, 0);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.45, 8), metalMat);
  mainRotor.add(mast);
  for (let b = 0; b < 4; b++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 5.2), metalMat);
    blade.rotation.y = (b * Math.PI) / 2;
    blade.position.y = 0.22;
    mainRotor.add(blade);
  }
  group.add(mainRotor);

  // Tail Rotor
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.22, 2.55, 6.5);
  for (let b = 0; b < 2; b++) {
    const tBlade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.35, 0.14), stripeMat);
    tBlade.rotation.x = (b * Math.PI) / 2;
    tailRotor.add(tBlade);
  }
  group.add(tailRotor);

  // Rescue Searchlight
  const searchLight = new THREE.SpotLight(0xfef3c7, 6.0, 65, Math.PI / 4.8, 0.4, 1.1);
  searchLight.position.set(0, 0.65, -1.8);
  searchLight.target.position.set(0, -18, -2.5);
  group.add(searchLight);
  group.add(searchLight.target);

  return { group, mainRotor, tailRotor, searchLight };
}

export function createMovableObstacleModel(): THREE.Group {
  const group = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x47505c,
    roughness: 0.92,
    metalness: 0.06,
  });
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0x73a7c8,
    roughness: 0.32,
    metalness: 0.08,
  });

  const offsets = [
    { x: -1.1, y: 0.72, z: 0, r: 0.92, ice: false },
    { x: 0, y: 0.92, z: -0.1, r: 1.05, ice: true },
    { x: 1.1, y: 0.68, z: 0.12, r: 0.88, ice: false },
    { x: -0.45, y: 1.35, z: 0.05, r: 0.64, ice: true },
    { x: 0.55, y: 1.25, z: -0.05, r: 0.62, ice: false },
  ];

  for (const o of offsets) {
    const chunk = new THREE.Mesh(
      new THREE.DodecahedronGeometry(o.r, 0),
      o.ice ? iceMat : rockMat
    );
    chunk.position.set(o.x, o.y, o.z);
    chunk.rotation.set(o.x * 1.1, o.z * 2.0, 0.4);
    chunk.castShadow = true;
    chunk.receiveShadow = true;
    group.add(chunk);
  }
  return group;
}

export function createFlareEffectModel(): {
  group: THREE.Group;
  light: THREE.PointLight;
  flame: THREE.Mesh;
} {
  const group = new THREE.Group();
  const tubeMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.5,
    metalness: 0.2,
  });
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xff6b4a,
    emissive: 0xef4444,
    emissiveIntensity: 3.2,
    roughness: 0.2,
  });

  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.34, 8), tubeMat);
  stick.position.y = 0.17;
  group.add(stick);

  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 8), flameMat);
  flame.position.y = 0.45;
  group.add(flame);

  const light = new THREE.PointLight(0xff5a36, 7.5, 32, 1.25);
  light.position.set(0, 0.65, 0);
  group.add(light);

  return { group, light, flame };
}

export function createAvalancheWallModel(): THREE.Group {
  const group = new THREE.Group();
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.85,
    metalness: 0.02,
  });
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.92,
  });

  for (let i = -3; i <= 3; i++) {
    const billow = new THREE.Mesh(new THREE.DodecahedronGeometry(3.2, 1), snowMat);
    billow.position.set(i * 3.4, 2.2 + (Math.abs(i) % 2) * 0.7, (Math.abs(i) % 2) * 0.9);
    billow.scale.set(1.25, 1.05, 1.15);
    group.add(billow);
  }
  for (let i = -2; i <= 2; i++) {
    const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(1.3, 0), rockMat);
    chunk.position.set(i * 4.5 + 1.2, 1.1, -1.8);
    group.add(chunk);
  }
  return group;
}

