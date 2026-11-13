import * as THREE from 'three';

export interface AlpineTextures {
  snowAlbedo: THREE.CanvasTexture;
  snowBump: THREE.CanvasTexture;
  rockAlbedo: THREE.CanvasTexture;
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
  // 1. Wind-scoured snow albedo
  const [snowCanvas, sCtx] = makeCanvas(512);
  sCtx.fillStyle = '#e8f1f8';
  sCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const w = 10 + Math.random() * 44;
    const h = 1 + Math.random() * 2.5;
    const shade = Math.random() > 0.5 ? 'rgba(255,255,255,0.28)' : 'rgba(186,210,232,0.22)';
    sCtx.fillStyle = shade;
    sCtx.fillRect(x, y, w, h);
  }
  const snowAlbedo = new THREE.CanvasTexture(snowCanvas);
  snowAlbedo.colorSpace = THREE.SRGBColorSpace;
  snowAlbedo.wrapS = THREE.RepeatWrapping;
  snowAlbedo.wrapT = THREE.RepeatWrapping;
  snowAlbedo.repeat.set(16, 48);
  snowAlbedo.anisotropy = maxAnisotropy;

  // 2. Snow micro-bump (linear space)
  const [bumpCanvas, bCtx] = makeCanvas(256);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = Math.floor(105 + Math.random() * 50);
    bCtx.fillStyle = `rgb(${v},${v},${v})`;
    bCtx.fillRect(x, y, 8 + Math.random() * 18, 2);
  }
  const snowBump = new THREE.CanvasTexture(bumpCanvas);
  snowBump.wrapS = THREE.RepeatWrapping;
  snowBump.wrapT = THREE.RepeatWrapping;
  snowBump.repeat.set(24, 72);
  snowBump.anisotropy = maxAnisotropy;

  // 3. Karakoram granite/gneiss rock albedo
  const [rockCanvas, rCtx] = makeCanvas(512);
  rCtx.fillStyle = '#3c434d';
  rCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const w = 4 + Math.random() * 28;
    const h = 2 + Math.random() * 8;
    const lum = 36 + Math.floor(Math.random() * 58);
    rCtx.fillStyle = `rgb(${lum},${lum + 4},${lum + 10})`;
    rCtx.fillRect(x, y, w, h);
  }
  // Sharp quartz/ice veins
  rCtx.strokeStyle = 'rgba(210, 225, 240, 0.22)';
  rCtx.lineWidth = 1.5;
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

  // 4. Glacial blue ice
  const [iceCanvas, iCtx] = makeCanvas(256);
  const grad = iCtx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#78b7d9');
  grad.addColorStop(0.5, '#9ed5ee');
  grad.addColorStop(1, '#589ac2');
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

  // 5. Soft radial snowflake sprite
  const [pCanvas, pCtx] = makeCanvas(64);
  const pGrad = pCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
  pGrad.addColorStop(0, 'rgba(255,255,255,1)');
  pGrad.addColorStop(0.45, 'rgba(235,245,255,0.7)');
  pGrad.addColorStop(1, 'rgba(255,255,255,0)');
  pCtx.fillStyle = pGrad;
  pCtx.fillRect(0, 0, 64, 64);
  const particleTex = new THREE.CanvasTexture(pCanvas);
  particleTex.colorSpace = THREE.SRGBColorSpace;

  return { snowAlbedo, snowBump, rockAlbedo, iceAlbedo, particleTex };
}
