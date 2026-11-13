import { useEffect, useRef } from 'react';
import { GameTelemetry } from '../game/types';

interface MiniMapProps {
  telemetry: GameTelemetry;
}

export function MiniMap({ telemetry }: MiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 112;
    ctx.clearRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 24, 0, Math.PI * 2);
    ctx.arc(size / 2, size / 2, 46, 0, Math.PI * 2);
    ctx.stroke();

    const scale = 1.18;
    const px = telemetry.playerPos.x;
    const pz = telemetry.playerPos.z;

    for (const pt of telemetry.mapPoints) {
      if (!pt.active) continue;
      const dx = (pt.x - px) * scale;
      const dz = (pt.z - pz) * scale;
      let sx = size / 2 + dx;
      let sy = size / 2 + dz;

      const dist = Math.hypot(dx, dz);
      const maxR = size / 2 - 8;
      if (pt.type === 'checkpoint' && dist > maxR) {
        sx = size / 2 + (dx / dist) * maxR;
        sy = size / 2 + (dz / dist) * maxR;
      } else if (dist > maxR) {
        continue;
      }

      if (pt.type === 'crevasse') {
        ctx.fillStyle = 'rgba(125, 211, 252, 0.45)';
        ctx.fillRect(sx - 6, sy - 1.5, 12, 3);
        continue;
      }
      if (pt.type === 'river') {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.42)';
        ctx.fillRect(sx - 14, sy - 3, 28, 6);
        continue;
      }
      if (pt.type === 'obstacle') {
        ctx.fillStyle = '#fb923c';
        ctx.fillRect(sx - 3.5, sy - 3.5, 7, 7);
        continue;
      }

      ctx.beginPath();
      if (pt.type === 'checkpoint') {
        ctx.fillStyle = '#f59e0b';
        ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
      } else if (pt.type === 'helipad') {
        ctx.fillStyle = '#eab308';
        ctx.arc(sx, sy, 4.2, 0, Math.PI * 2);
      } else if (pt.type === 'wildlife') {
        ctx.fillStyle = '#ef4444';
        ctx.arc(sx, sy, 3.6, 0, Math.PI * 2);
      } else if (pt.type === 'o2') {
        ctx.fillStyle = '#38bdf8';
        ctx.arc(sx, sy, 3.0, 0, Math.PI * 2);
      } else if (pt.type === 'ration') {
        ctx.fillStyle = '#fb923c';
        ctx.arc(sx, sy, 2.8, 0, Math.PI * 2);
      } else if (pt.type === 'shelter' || pt.type === 'midcamp') {
        ctx.fillStyle = pt.type === 'midcamp' ? '#f97316' : '#22c55e';
        ctx.arc(sx, sy, 3.6, 0, Math.PI * 2);
      } else if (pt.type === 'anchor_spot') {
        ctx.fillStyle = '#7dd3fc';
        ctx.arc(sx, sy, 2.6, 0, Math.PI * 2);
      } else if (pt.type === 'npc') {
        ctx.fillStyle = '#f43f5e';
        ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(-telemetry.playerPos.yaw);
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, [telemetry]);

  return (
    <div className="bg-[#09111e]/92 border border-white/15 rounded-lg p-1.5 flex flex-col items-center">
      <canvas ref={canvasRef} width={112} height={112} className="block rounded" />
      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-300 font-mono-num">
        <span>OBJ {telemetry.distanceToCheckpoint}m</span>
      </div>
    </div>
  );
}
