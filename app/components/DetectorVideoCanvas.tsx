/**
 * DetectorVideoCanvas — displays live webcam feed with skeleton overlay.
 * Re-themed for AutiSense (sage green palette, Fredoka/Nunito fonts).
 * Ported from Autism_code/web/src/components/VideoCanvas.tsx
 */
"use client";
import { useRef, useEffect } from "react";
import type { PipelineResult } from "../types/inference";

// COCO-17 skeleton connections
const SKELETON: [number, number][] = [
  [0, 1], [0, 2], [1, 3], [2, 4],
  [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 6], [5, 11], [6, 12], [11, 12],
  [11, 13], [13, 15], [12, 14], [14, 16],
];

const SMOOTH = 0.6;

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  result: PipelineResult | null;
  isCamReady: boolean;
  isModelLoaded: boolean;
}

export default function DetectorVideoCanvas({ videoRef, canvasRef, result, isCamReady, isModelLoaded }: Props) {
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const smoothKps = useRef<Float32Array | null>(null);
  const smoothConf = useRef<Float32Array | null>(null);

  // Draw skeleton overlay
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !result) {
      if (!result) { smoothKps.current = null; smoothConf.current = null; }
      return;
    }
    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    const w = overlay.width, h = overlay.height;
    ctx.clearRect(0, 0, w, h);

    const kps = result.keypoints;
    const conf = result.confidence;
    if (!kps || !conf || kps.length < 34) return;

    // EMA smoothing
    let dk: Float32Array, dc: Float32Array;
    if (smoothKps.current && smoothKps.current.length === kps.length) {
      dk = new Float32Array(kps.length);
      dc = new Float32Array(conf.length);
      for (let i = 0; i < kps.length; i++) dk[i] = smoothKps.current[i] * (1 - SMOOTH) + kps[i] * SMOOTH;
      for (let i = 0; i < conf.length; i++) dc[i] = smoothConf.current![i] * (1 - SMOOTH) + conf[i] * SMOOTH;
    } else {
      dk = new Float32Array(kps); dc = new Float32Array(conf);
    }
    smoothKps.current = dk; smoothConf.current = dc;

    // Bones — sage green
    ctx.lineWidth = 3;
    for (const [a, b] of SKELETON) {
      if (dc[a] < 0.3 || dc[b] < 0.3) continue;
      ctx.strokeStyle = "rgba(77, 128, 88, 0.8)"; // --sage-500
      ctx.beginPath();
      ctx.moveTo(dk[a * 2], dk[a * 2 + 1]);
      ctx.lineTo(dk[b * 2], dk[b * 2 + 1]);
      ctx.stroke();
    }

    // Keypoints
    for (let i = 0; i < 17; i++) {
      if (dc[i] < 0.3) continue;
      ctx.fillStyle = "rgba(107, 158, 118, 1.0)"; // --sage-400
      ctx.beginPath();
      ctx.arc(dk[i * 2], dk[i * 2 + 1], 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Body bounding box
    if (result.bbox && result.bbox[2] > 0) {
      const [bx, by, bw, bh] = result.bbox;
      ctx.strokeStyle = "rgba(107,158,118,0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(bx - bw / 2, by - bh / 2, bw, bh);
      ctx.setLineDash([]);
    }

    // Face bounding box
    if (result.face?.faceBbox) {
      const [fx, fy, fw, fh] = result.face.faceBbox;
      ctx.strokeStyle = "rgba(155, 142, 196, 0.6)"; // lavender
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(fx - fw / 2, fy - fh / 2, fw, fh);
      ctx.setLineDash([]);
    }
  }, [result]);

  // Sync overlay size
  useEffect(() => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) return;
    const sync = () => {
      if (video.videoWidth && video.videoHeight) {
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;
      }
    };
    video.addEventListener("loadedmetadata", sync);
    sync();
    return () => video.removeEventListener("loadedmetadata", sync);
  }, [videoRef]);

  const fmt = (s: string) => s.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

  return (
    <div style={{
      position: "relative", width: "100%", aspectRatio: "4/3",
      background: "var(--bg-secondary)", borderRadius: "var(--r-lg)",
      overflow: "hidden", border: "2px solid var(--border)",
      boxShadow: "var(--shadow-md)",
    }}>
      <video ref={videoRef} autoPlay playsInline muted
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <canvas ref={overlayRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Status overlays */}
      {!isCamReady && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.6)", color: "white", fontSize: "0.9rem",
        }}>
          Requesting camera...
        </div>
      )}

      {isCamReady && !isModelLoaded && (
        <div style={{
          position: "absolute", bottom: 8, left: 8, padding: "4px 12px",
          borderRadius: "var(--r-sm)", fontSize: "0.8rem", fontWeight: 600,
          background: "rgba(240,168,130,0.9)", color: "white",
        }}>
          Loading AI models...
        </div>
      )}

      {isModelLoaded && (
        <div style={{
          position: "absolute", bottom: 8, left: 8, padding: "4px 12px",
          borderRadius: "var(--r-sm)", fontSize: "0.8rem", fontWeight: 600,
          background: "rgba(77,128,88,0.9)", color: "white",
        }}>
          Live
        </div>
      )}

      {/* Behavior label */}
      {result?.behavior && (
        <div style={{
          position: "absolute", top: 8, left: 8, padding: "6px 14px",
          borderRadius: "var(--r-md)", fontSize: "0.85rem", fontWeight: 700,
          fontFamily: "'Fredoka',sans-serif",
          background: "rgba(0,0,0,0.65)", color: "white",
          border: "1px solid rgba(255,255,255,0.15)",
        }}>
          {fmt(result.behavior.className)}
          <span style={{ marginLeft: 8, fontSize: "0.75rem", opacity: 0.7 }}>
            {(result.behavior.probabilities[result.behavior.predictedClass] * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
}
