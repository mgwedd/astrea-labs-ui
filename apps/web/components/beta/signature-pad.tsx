'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, cn } from '@astrea/ui';
import {
  DRAWN_ASPECT,
  MAX_POINTS,
  MAX_POINTS_PER_STROKE,
  MAX_STROKES,
  type Strokes,
} from '@/lib/agreements/signed/drawn';

// A pen signature: pointer strokes on a canvas, each point normalized to 0..1 across the pad.
// The pad has the PDF area's aspect ratio, so the drawing keeps its shape when stamped.

const totalPoints = (strokes: Strokes) => strokes.reduce((n, s) => n + s.length, 0);

export function SignaturePad({
  id,
  locked,
  lockedHint,
  error,
  onChange,
}: {
  id: string;
  locked: boolean;
  /** Why the pad is locked, shown over it. */
  lockedHint: string;
  error?: string;
  onChange: (strokes: Strokes) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Strokes>([]);
  const drawingRef = useRef(false);
  const [count, setCount] = useState(0);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = getComputedStyle(canvas).color;
    ctx.lineWidth = 2 * (window.devicePixelRatio || 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of strokesRef.current) {
      ctx.beginPath();
      stroke.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * width, y * height) : ctx.lineTo(x * width, y * height)));
      if (stroke.length === 1) ctx.lineTo(stroke[0][0] * width + 0.1, stroke[0][1] * height);
      ctx.stroke();
    }
  }, []);

  // Match the backing store to the displayed size and pixel ratio.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      redraw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clamp = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000;
    return [clamp((e.clientX - rect.left) / rect.width), clamp((e.clientY - rect.top) / rect.height)];
  };

  const commit = () => {
    setCount(strokesRef.current.length);
    onChange(strokesRef.current.map((s) => [...s]));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (locked || strokesRef.current.length >= MAX_STROKES || totalPoints(strokesRef.current) >= MAX_POINTS) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    strokesRef.current = [...strokesRef.current, [point(e)]];
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const stroke = strokesRef.current[strokesRef.current.length - 1];
    if (stroke.length >= MAX_POINTS_PER_STROKE || totalPoints(strokesRef.current) >= MAX_POINTS) return;
    const p = point(e);
    const last = stroke[stroke.length - 1];
    if (last[0] === p[0] && last[1] === p[1]) return;
    stroke.push(p);
    redraw();
  };

  const onPointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    commit();
  };

  const clear = () => {
    strokesRef.current = [];
    redraw();
    commit();
  };

  // Locking (e.g. the name was edited) wipes the drawing: it must be made after the checks pass.
  useEffect(() => {
    if (locked && strokesRef.current.length) clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span id={`${id}-label`} className="text-sm font-medium leading-snug">
          Draw your signature
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={locked || count === 0}>
          Clear
        </Button>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          id={id}
          role="img"
          aria-labelledby={`${id}-label`}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          style={{ aspectRatio: String(DRAWN_ASPECT), touchAction: 'none' }}
          className={cn(
            'block w-full rounded-md border bg-background text-foreground',
            locked ? 'cursor-not-allowed opacity-50' : 'cursor-crosshair',
            error && 'border-destructive',
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-6 bottom-[22%] border-b border-muted-foreground/50" />
        {locked && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-muted-foreground">
            {lockedHint}
          </div>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          Use a mouse, trackpad, finger or stylus. It&apos;s added to your signed document.
        </p>
      )}
    </div>
  );
}
