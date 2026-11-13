import { useRef, useState } from 'react';
import {
  Anchor,
  ArrowDown,
  ArrowUp,
  Axe,
  Backpack,
  Flame,
  Hand,
  Map as MapIcon,
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
  onToggleInventory: () => void;
  onToggleMap: () => void;
  inventoryOpen: boolean;
  mapOpen: boolean;
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
  onToggleInventory,
  onToggleMap,
  inventoryOpen,
  mapOpen,
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

  const maxRadius = 38;

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
      ? 'Rope'
      : ropeRigState === 'anchor_placed'
        ? 'Attach'
        : 'Mid-Fix';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex items-end justify-between gap-2 px-2.5 pb-2.5 sm:px-5 sm:pb-4">
      {/* Left Thumb Zone: Virtual Movement Joystick + Camera Zoom & Quick Map/Pack */}
      <div className="pointer-events-auto flex items-end gap-1.5 sm:gap-2 shrink-0">
        <div className="flex flex-col items-start gap-1.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onToggleInventory();
              }}
              aria-label="Touch Inventory"
              className={`min-w-[44px] min-h-[44px] px-2.5 rounded-lg border text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 transition-colors ${
                inventoryOpen
                  ? 'bg-amber-500 text-slate-950 border-amber-300'
                  : 'bg-[#09111e]/90 border-white/15 text-slate-100 active:bg-slate-700'
              }`}
            >
              <Backpack className="w-3.5 h-3.5" />
              <span>Pack</span>
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onToggleMap();
              }}
              aria-label="Touch Map"
              className={`min-w-[44px] min-h-[44px] px-2.5 rounded-lg border text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 transition-colors ${
                mapOpen
                  ? 'bg-sky-500 text-slate-950 border-sky-300'
                  : 'bg-[#09111e]/90 border-white/15 text-slate-100 active:bg-slate-700'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Map</span>
            </button>
          </div>

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
            className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#09111e]/85 border border-white/25 flex items-center justify-center touch-none"
            aria-label="Movement joystick"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-white/12" />
            <div
              style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
              className="absolute w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-amber-400/95 border-2 border-slate-100 shadow-md"
            />
          </div>
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

      {/* Subtle Touch Camera Swipe Hint Centered Above Bottom Edge */}
      <div className="hidden sm:block pointer-events-none mb-2 text-[10px] text-slate-300/75 bg-[#09111e]/70 px-2.5 py-1 rounded-md border border-white/10">
        Swipe Upper Screen to Rotate Camera
      </div>

      {/* Right Thumb Zone: QTE + Mountaineering Action Grid (Min 44x44px hitboxes, zero overlap) */}
      <div className="pointer-events-auto flex flex-col items-end gap-1.5 shrink-0">
        {activeQte && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onQteTap();
            }}
            className="px-4 py-2.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs border-2 border-amber-200 shadow-lg min-h-[44px]"
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
            aria-label="Touch Left Ice Axe"
            className="min-w-[46px] min-h-[44px] w-12 sm:w-14 h-11 rounded-lg bg-[#09111e]/90 border border-sky-400/35 text-sky-200 text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 active:bg-sky-400 active:text-slate-950"
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
            aria-label="Touch Right Ice Axe"
            className="min-w-[46px] min-h-[44px] w-12 sm:w-14 h-11 rounded-lg bg-[#09111e]/90 border border-sky-400/35 text-sky-200 text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 active:bg-sky-400 active:text-slate-950"
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
            aria-label="Touch Jump"
            className="min-w-[46px] min-h-[44px] w-12 sm:w-14 h-11 rounded-lg bg-[#09111e]/90 border border-white/20 text-slate-100 text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 active:bg-sky-500 active:text-slate-950"
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
            aria-label="Touch Sprint"
            className={`min-w-[46px] min-h-[44px] w-12 sm:w-14 h-11 rounded-lg border text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 ${
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
            aria-label="Touch Crouch"
            className={`min-w-[46px] min-h-[44px] w-12 sm:w-14 h-11 rounded-lg border text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 ${
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
            aria-label="Touch Climb"
            className={`min-w-[46px] min-h-[44px] w-12 sm:w-14 h-11 rounded-lg border text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 ${
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
            aria-label="Touch Rope"
            className={`min-w-[46px] min-h-[44px] w-12 sm:w-14 h-11 rounded-lg border text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 ${
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
              onInteract();
            }}
            aria-label="Touch Interact"
            className={`min-w-[46px] min-h-[44px] w-12 sm:w-14 h-11 rounded-lg border text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 ${
              hasInteractPrompt
                ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                : 'bg-[#09111e]/90 text-slate-200 border-white/20'
            }`}
          >
            <Hand className="w-3.5 h-3.5" />
            <span>Interact</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onPushObstacle();
            }}
            aria-label="Touch Push"
            className="min-w-[46px] min-h-[44px] w-12 sm:w-14 h-11 rounded-lg bg-[#09111e]/90 border border-orange-400/40 text-orange-200 text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 active:bg-orange-500 active:text-slate-950"
          >
            <MoveHorizontal className="w-3.5 h-3.5" />
            <span>Push</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onFlare();
            }}
            aria-label="Touch Flare"
            className="min-w-[46px] min-h-[44px] w-12 sm:w-14 h-11 rounded-lg bg-[#09111e]/90 border border-rose-400/40 text-rose-200 text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 active:bg-rose-500 active:text-white"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Flare</span>
          </button>

          {ropeRigState !== 'none' && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onRecoverRope();
              }}
              aria-label="Touch Recover Rope"
              className="col-span-2 min-h-[44px] px-2 h-11 rounded-lg border bg-[#09111e]/90 text-amber-200 border-amber-400/40 active:bg-amber-500 active:text-slate-950 text-[10px] font-semibold flex items-center justify-center gap-1"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>Pull Rope</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
