import * as THREE from 'three';

export interface AlpineTextures {
  snowAlbedo: THREE.CanvasTexture;
  snowBump: THREE.CanvasTexture;
  rockAlbedo: THREE.CanvasTexture;
  rockBump: THREE.CanvasTexture;
  iceAlbedo: THREE.CanvasTexture;
  particleTex: THREE.CanvasTexture;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createAlpineTextures(maxAnisotropy: number): AlpineTextures {
  // 1. Wind-scoured alpine snow & sastrugi albedo
  const [snowCanvas, sCtx] = makeCanvas(512);
  sCtx.fillStyle = '#dde8f2';
  sCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const w = 12 + Math.random() * 48;
    const h = 1 + Math.random() * 2.5;
    const shade = Math.random() > 0.45 ? 'rgba(255,255,255,0.28)' : 'rgba(155,182,208,0.24)';
    sCtx.fillStyle = shade;
    sCtx.fillRect(x, y, w, h);
  }
  const snowAlbedo = new THREE.CanvasTexture(snowCanvas);
  snowAlbedo.colorSpace = THREE.SRGBColorSpace;
  snowAlbedo.wrapS = THREE.RepeatWrapping;
  snowAlbedo.wrapT = THREE.RepeatWrapping;
  snowAlbedo.repeat.set(16, 48);
  snowAlbedo.anisotropy = maxAnisotropy;

  // 2. Snow & wind-crust micro-bump (linear space)
  const [bumpCanvas, bCtx] = makeCanvas(256);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = Math.floor(88 + Math.random() * 82);
    bCtx.fillStyle = `rgb(${v},${v},${v})`;
    bCtx.fillRect(x, y, 10 + Math.random() * 22, 1.5 + Math.random() * 2);
  }
  const snowBump = new THREE.CanvasTexture(bumpCanvas);
  snowBump.wrapS = THREE.RepeatWrapping;
  snowBump.wrapT = THREE.RepeatWrapping;
  snowBump.repeat.set(24, 72);
  snowBump.anisotropy = maxAnisotropy;

  // 3. Karakoram fractured granite & slate rock albedo
  const [rockCanvas, rCtx] = makeCanvas(512);
  rCtx.fillStyle = '#343b44';
  rCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const w = 3 + Math.random() * 26;
    const h = 2 + Math.random() * 7;
    const lum = 28 + Math.floor(Math.random() * 64);
    rCtx.fillStyle = `rgb(${lum},${lum + 3},${lum + 8})`;
    rCtx.fillRect(x, y, w, h);
  }
  // Fractured rock strata & frost crevices
  rCtx.strokeStyle = 'rgba(20, 24, 30, 0.55)';
  rCtx.lineWidth = 2;
  for (let i = 0; i < 42; i++) {
    rCtx.beginPath();
    const sx = Math.random() * 512;
    const sy = Math.random() * 512;
    rCtx.moveTo(sx, sy);
    rCtx.lineTo(sx + (Math.random() - 0.5) * 110, sy + (Math.random() - 0.5) * 45);
    rCtx.stroke();
  }
  rCtx.strokeStyle = 'rgba(210, 225, 240, 0.22)';
  rCtx.lineWidth = 1.2;
  for (let i = 0; i < 28; i++) {
    rCtx.beginPath();
    const sx = Math.random() * 512;
    const sy = Math.random() * 512;
    rCtx.moveTo(sx, sy);
    rCtx.lineTo(sx + (Math.random() - 0.5) * 90, sy + (Math.random() - 0.5) * 90);
    rCtx.stroke();
  }
  const rockAlbedo = new THREE.CanvasTexture(rockCanvas);
  rockAlbedo.colorSpace = THREE.SRGBColorSpace;
  rockAlbedo.wrapS = THREE.RepeatWrapping;
  rockAlbedo.wrapT = THREE.RepeatWrapping;
  rockAlbedo.repeat.set(8, 24);
  rockAlbedo.anisotropy = maxAnisotropy;

  // 4. Granite cliff fracture bump map (linear space)
  const [rbCanvas, rbCtx] = makeCanvas(256);
  rbCtx.fillStyle = '#7a7a7a';
  rbCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = Math.floor(55 + Math.random() * 145);
    rbCtx.fillStyle = `rgb(${v},${v},${v})`;
    rbCtx.fillRect(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 18, 2 + Math.random() * 6);
  }
  rbCtx.strokeStyle = '#202020';
  rbCtx.lineWidth = 2;
  for (let i = 0; i < 36; i++) {
    rbCtx.beginPath();
    const sx = Math.random() * 256;
    const sy = Math.random() * 256;
    rbCtx.moveTo(sx, sy);
    rbCtx.lineTo(sx + (Math.random() - 0.5) * 68, sy + (Math.random() - 0.5) * 32);
    rbCtx.stroke();
  }
  const rockBump = new THREE.CanvasTexture(rbCanvas);
  rockBump.wrapS = THREE.RepeatWrapping;
  rockBump.wrapT = THREE.RepeatWrapping;
  rockBump.repeat.set(8, 24);
  rockBump.anisotropy = maxAnisotropy;

  // 5. Glacial blue ice
  const [iceCanvas, iCtx] = makeCanvas(256);
  const grad = iCtx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#6aa9cc');
  grad.addColorStop(0.5, '#92cae4');
  grad.addColorStop(1, '#4c8cb4');
  iCtx.fillStyle = grad;
  iCtx.fillRect(0, 0, 256, 256);
  iCtx.strokeStyle = 'rgba(255,255,255,0.38)';
  for (let i = 0; i < 45; i++) {
    iCtx.beginPath();
    iCtx.moveTo(Math.random() * 256, Math.random() * 256);
    iCtx.lineTo(Math.random() * 256, Math.random() * 256);
    iCtx.stroke();
  }
  const iceAlbedo = new THREE.CanvasTexture(iceCanvas);
  iceAlbedo.colorSpace = THREE.SRGBColorSpace;
  iceAlbedo.wrapS = THREE.RepeatWrapping;
  iceAlbedo.wrapT = THREE.RepeatWrapping;
  iceAlbedo.anisotropy = maxAnisotropy;

  // 6. Soft radial snowflake sprite
  const [pCanvas, pCtx] = makeCanvas(64);
  const pGrad = pCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
  pGrad.addColorStop(0, 'rgba(255,255,255,1)');
  pGrad.addColorStop(0.45, 'rgba(235,245,255,0.7)');
  pGrad.addColorStop(1, 'rgba(255,255,255,0)');
  pCtx.fillStyle = pGrad;
  pCtx.fillRect(0, 0, 64, 64);
  const particleTex = new THREE.CanvasTexture(pCanvas);
  particleTex.colorSpace = THREE.SRGBColorSpace;

  return { snowAlbedo, snowBump, rockAlbedo, rockBump, iceAlbedo, particleTex };
}
