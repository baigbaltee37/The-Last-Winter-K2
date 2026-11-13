import { useRef, useState } from 'react';
import {
  Anchor,
  ArrowDown,
  ArrowUp,
  Axe,
  Flame,
  Hand,
  Mountain,
  MoveHorizontal,
  Unlink,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { PlayerInputState } from '../game/MountainEngine';
import { ActiveQteEvent, RopeRigState } from '../game/types';

interface TouchControlsProps {
  inputRef: React.MutableRefObject<PlayerInputState>;
  onJump: () => void;
  onInteract: () => void;
  onLeftAxe: () => void;
  onRightAxe: () => void;
  onRopeStep: () => void;
  onRecoverRope: () => void;
  onFlare: () => void;
  onPushObstacle: () => void;
  onZoom: (delta: number) => void;
  isClimbing: boolean;
  isCrouching: boolean;
  isSprinting: boolean;
  ropeRigState: RopeRigState;
  nearAnchorSpot: boolean;
  hasInteractPrompt: boolean;
  activeQte: ActiveQteEvent | null;
  onQteTap: () => void;
}

export function TouchControls({
  inputRef,
  onJump,
  onInteract,
  onLeftAxe,
  onRightAxe,
  onRopeStep,
  onRecoverRope,
  onFlare,
  onPushObstacle,
  onZoom,
  isClimbing,
  isCrouching,
  isSprinting,
  ropeRigState,
  nearAnchorSpot,
  hasInteractPrompt,
  activeQte,
  onQteTap,
}: TouchControlsProps) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [climbActive, setClimbActive] = useState(false);
  const [crouchActive, setCrouchActive] = useState(false);
  const [sprintActive, setSprintActive] = useState(false);

  const maxRadius = 42;

  const updateJoystick = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }
    setKnob({ x: dx, y: dy });
    inputRef.current.moveX = dx / maxRadius;
    inputRef.current.moveY = -dy / maxRadius;
  };

  const resetJoystick = () => {
    pointerIdRef.current = null;
    setKnob({ x: 0, y: 0 });
    inputRef.current.moveX = 0;
    inputRef.current.moveY = 0;
  };

  const ropeLabel =
    ropeRigState === 'none'
      ? 'Anchor'
      : ropeRigState === 'anchor_placed'
        ? 'Attach'
        : 'Mid-Anchor';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex items-end justify-between px-3 pb-3 sm:px-5 sm:pb-5">
      {/* Left: Virtual Joystick + Camera Zoom */}
      <div className="pointer-events-auto flex items-end gap-2">
        <div
          ref={padRef}
          onPointerDown={(e) => {
            e.stopPropagation();
            pointerIdRef.current = e.pointerId;
            e.currentTarget.setPointerCapture(e.pointerId);
            updateJoystick(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (pointerIdRef.current !== e.pointerId) return;
            e.stopPropagation();
            updateJoystick(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            if (pointerIdRef.current === e.pointerId) {
              e.stopPropagation();
              resetJoystick();
            }
          }}
          onPointerCancel={resetJoystick}
          className="relative w-28 h-28 rounded-full bg-[#09111e]/84 border border-white/20 flex items-center justify-center touch-none"
          aria-label="Movement joystick"
        >
          <div className="w-16 h-16 rounded-full border border-white/10" />
          <div
            style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
            className="absolute w-11 h-11 rounded-full bg-amber-400/90 border-2 border-slate-100 shadow-md"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onZoom(-1.2);
            }}
            className="w-11 h-11 rounded-lg bg-[#09111e]/88 border border-white/15 text-slate-200 flex items-center justify-center active:bg-slate-700"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onZoom(1.2);
            }}
            className="w-11 h-11 rounded-lg bg-[#09111e]/88 border border-white/15 text-slate-200 flex items-center justify-center active:bg-slate-700"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right: QTE Tap + Dual Axe + Flare + Push + Mountaineering Action Pad */}
      <div className="pointer-events-auto flex flex-col items-end gap-1.5">
        {activeQte && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onQteTap();
            }}
            className="px-4 py-2.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs border-2 border-amber-200 shadow-lg"
          >
            TAP REFLEX [{activeQte.keyLabel}]
          </button>
        )}

        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onLeftAxe();
            }}
            className="w-14 h-11 rounded-lg bg-[#09111e]/90 border border-sky-400/35 text-sky-200 text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 active:bg-sky-400 active:text-slate-950"
          >
            <Axe className="w-3.5 h-3.5" />
            <span>Axe L</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onRightAxe();
            }}
            className="w-14 h-11 rounded-lg bg-[#09111e]/90 border border-sky-400/35 text-sky-200 text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 active:bg-sky-400 active:text-slate-950"
          >
            <Axe className="w-3.5 h-3.5 -scale-x-100" />
            <span>Axe R</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onJump();
            }}
            className="w-14 h-11 rounded-lg bg-[#09111e]/90 border border-white/20 text-slate-100 text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 active:bg-sky-500 active:text-slate-950"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span>Jump</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              const next = !sprintActive;
              setSprintActive(next);
              inputRef.current.sprint = next;
            }}
            className={`w-14 h-11 rounded-lg border text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 ${
              sprintActive || isSprinting
                ? 'bg-amber-500 text-slate-950 border-amber-300'
                : 'bg-[#09111e]/90 text-slate-200 border-white/20'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Sprint</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              const next = !crouchActive;
              setCrouchActive(next);
              inputRef.current.crouch = next;
            }}
            className={`w-14 h-11 rounded-lg border text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 ${
              crouchActive || isCrouching
                ? 'bg-amber-400 text-slate-950 border-amber-200'
                : 'bg-[#09111e]/90 text-slate-200 border-white/20'
            }`}
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>Crouch</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              const next = !climbActive;
              setClimbActive(next);
              inputRef.current.climb = next;
            }}
            className={`w-14 h-11 rounded-lg border text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 ${
              climbActive || isClimbing
                ? 'bg-sky-500 text-slate-950 border-sky-300'
                : 'bg-[#09111e]/90 text-slate-200 border-white/20'
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />
            <span>Climb</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onRopeStep();
            }}
            className={`w-14 h-11 rounded-lg border text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 ${
              ropeRigState === 'rope_secured'
                ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                : ropeRigState === 'anchor_placed' || nearAnchorSpot
                  ? 'bg-sky-500/80 text-slate-950 border-sky-300'
                  : 'bg-[#09111e]/90 text-slate-200 border-white/20'
            }`}
          >
            <Anchor className="w-3.5 h-3.5" />
            <span>{ropeLabel}</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onRecoverRope();
            }}
            disabled={ropeRigState === 'none'}
            className={`w-14 h-11 rounded-lg border text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 ${
              ropeRigState === 'none'
                ? 'bg-[#09111e]/55 text-slate-500 border-white/10'
                : 'bg-[#09111e]/90 text-amber-200 border-amber-400/40 active:bg-amber-500 active:text-slate-950'
            }`}
          >
            <Unlink className="w-3.5 h-3.5" />
            <span>Pull</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onInteract();
            }}
            className={`w-14 h-11 rounded-lg border text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 ${
              hasInteractPrompt
                ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                : 'bg-[#09111e]/90 text-slate-200 border-white/20'
            }`}
          >
            <Hand className="w-3.5 h-3.5" />
            <span>Action</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onFlare();
            }}
            className="w-14 h-11 rounded-lg bg-[#09111e]/90 border border-rose-400/40 text-rose-200 text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 active:bg-rose-500 active:text-white"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Flare</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onPushObstacle();
            }}
            className="w-14 h-11 rounded-lg bg-[#09111e]/90 border border-orange-400/40 text-orange-200 text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 active:bg-orange-500 active:text-slate-950"
          >
            <MoveHorizontal className="w-3.5 h-3.5" />
            <span>Push</span>
          </button>
        </div>
      </div>
    </div>
  );
}
