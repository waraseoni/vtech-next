"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus, Scissors, X } from "lucide-react";

interface LightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
  /** Optional gallery — arrows / keyboard (← →) se prev-next. */
  srcs?: string[];
  index?: number;
  onIndexChange?: (i: number) => void;
  /** Edit/Crop button dikhata hai. Caller lightbox band karke crop flow chalaye. */
  onEdit?: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const WHEEL_STEP = 1.15;
const BTN_STEP = 1.3;

/**
 * Full-screen image viewer with real zoom:
 *   — +/− buttons, mouse wheel, pinch (touch), keyboard (+ − 0), double-click toggle
 *   — zoom > 1 par drag-pan, ESC close, gallery arrows (srcs diya ho to)
 * Portal (document.body) — transformed ancestors (modals waghera) ke andar bhi
 * sahi position karta hai.
 */
export default function Lightbox({
  src,
  alt,
  onClose,
  srcs,
  index = 0,
  onIndexChange,
  onEdit,
}: LightboxProps) {
  const [mounted, setMounted] = useState(false);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [live, setLive] = useState(false); // drag/pinch chal raha → transition off

  const stageRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const movedRef = useRef(false); // pointer drag/pinch hua tha — click ko ignore karne ke liye

  const gallery = srcs && srcs.length > 1 ? srcs : null;

  const applyScale = (n: number) => {
    const v = Math.min(MAX_SCALE, Math.max(MIN_SCALE, n));
    scaleRef.current = v;
    setScale(v);
    if (v === 1) {
      setTx(0);
      setTy(0);
    }
  };
  const zoomBy = (f: number) => applyScale(scaleRef.current * f);
  // Wheel effect ref se latest zoomBy leta hai — effect ko re-bind nahi karna padta
  const zoomByRef = useRef(zoomBy);
  useEffect(() => {
    zoomByRef.current = zoomBy;
  });
  const reset = () => {
    scaleRef.current = 1;
    setScale(1);
    setTx(0);
    setTy(0);
  };
  const nav = (dir: number) => {
    if (!gallery || !onIndexChange) return;
    onIndexChange((((index + dir) % gallery.length) + gallery.length) % gallery.length);
    reset();
  };

  // Portal mount + body scroll lock
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Wheel zoom (non-passive — page scroll rokna zaroori hai)
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => {
      e.preventDefault();
      zoomByRef.current(e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP);
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, [mounted]);

  // Keyboard: ESC close, +/− zoom, 0 fit, ← → gallery
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") zoomBy(BTN_STEP);
      else if (e.key === "-") zoomBy(1 / BTN_STEP);
      else if (e.key === "0") reset();
      else if (gallery && e.key === "ArrowLeft") nav(-1);
      else if (gallery && e.key === "ArrowRight") nav(1);
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  });

  const clampPan = (x: number, y: number): [number, number] => {
    const st = stageRef.current;
    const mx = st ? (st.clientWidth * (scaleRef.current - 1) + 40) / 2 : 0;
    const my = st ? (st.clientHeight * (scaleRef.current - 1) + 40) / 2 : 0;
    return [Math.max(-mx, Math.min(mx, x)), Math.max(-my, Math.min(my, y))];
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (pointersRef.current.size === 0) movedRef.current = false;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 1 && scaleRef.current > 1) {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { x: e.clientX, y: e.clientY, tx, ty };
      setLive(true);
    } else if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: scaleRef.current };
      dragRef.current = null;
      setLive(true);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const ps = pointersRef.current;
    if (!ps.has(e.pointerId)) return;
    ps.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (ps.size === 2 && pinchRef.current) {
      const [a, b] = [...ps.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchRef.current.dist > 0)
        applyScale(pinchRef.current.scale * (d / pinchRef.current.dist));
      return;
    }
    const dx = e.clientX - (dragRef.current?.x ?? e.clientX);
    const dy = e.clientY - (dragRef.current?.y ?? e.clientY);
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedRef.current = true;
    const drag = dragRef.current;
    if (!drag) return;
    const [nx, ny] = clampPan(drag.tx + dx, drag.ty + dy);
    setTx(nx);
    setTy(ny);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) {
      dragRef.current = null;
      setLive(false);
    }
  };

  const onStageClick = (e: React.MouseEvent) => {
    // Backdrop (kaali jagah) par click → close — par drag/pinch ke baad galti se na khule.
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    if (e.target === e.currentTarget && scaleRef.current === 1) onClose();
  };

  const onStageDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (scaleRef.current > 1) reset();
    else applyScale(2.5);
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm select-none">
      <div
        ref={stageRef}
        className="absolute inset-0 overflow-hidden touch-none flex items-center justify-center cursor-grab active:cursor-grabbing"
        onClick={onStageClick}
        onDoubleClick={onStageDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transition: live ? "none" : "transform 0.15s ease",
          }}
          className="will-change-transform"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            draggable={false}
            className="max-w-[90vw] max-h-[76vh] rounded-xl shadow-2xl"
          />
        </div>
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-3 right-3 z-10 w-10 h-10 flex items-center justify-center rounded-xl bg-panel/90 border border-app text-muted hover:text-white transition-all"
      >
        <X size={18} />
      </button>

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center pb-4 px-3">
        <div className="flex items-center gap-1 bg-panel/90 border border-app rounded-2xl px-2 py-1.5 backdrop-blur-xl shadow-2xl">
          {onEdit && (
            <button
              onClick={onEdit}
              aria-label="Edit photo"
              title="Crop / Edit"
              className="h-8 px-2.5 flex items-center gap-1 rounded-lg text-muted hover:text-white hover:bg-white/5 transition-all"
            >
              <Scissors size={14} />
              <span className="text-[11px] font-bold">Edit</span>
            </button>
          )}
          {gallery && (
            <button
              onClick={() => nav(-1)}
              aria-label="Previous"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-white/5 transition-all"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <button
            onClick={() => zoomBy(1 / BTN_STEP)}
            aria-label="Zoom out"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-white/5 transition-all"
          >
            <Minus size={15} />
          </button>
          <span className="w-12 text-center text-[11px] font-black text-app tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => zoomBy(BTN_STEP)}
            aria-label="Zoom in"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-white/5 transition-all"
          >
            <Plus size={15} />
          </button>
          <button
            onClick={reset}
            aria-label="Fit to screen"
            title="Fit (0)"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-white/5 transition-all"
          >
            <Maximize2 size={14} />
          </button>
          {gallery && (
            <>
              <span className="w-12 text-center text-[11px] font-bold text-muted-2 tabular-nums">
                {index + 1}/{gallery.length}
              </span>
              <button
                onClick={() => nav(1)}
                aria-label="Next"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-white/5 transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
