/**
 * DetectorResultsPanel — displays ASD risk gauge, behavior classification bars,
 * and face analysis. Re-themed for AutiSense sage green palette.
 *
 * Layout: Timer + ASD gauge in a compact top row, then Body & Face side-by-side.
 */
"use client";
import type { PipelineResult } from "../types/inference";
import { BEHAVIOR_CLASSES, BEHAVIOR_LABELS, BEHAVIOR_COLORS, FACE_BEHAVIOR_CLASSES, FACE_BEHAVIOR_LABELS, FACE_BEHAVIOR_COLORS } from "../types/inference";

interface Props {
  result: PipelineResult | null;
  isModelLoaded: boolean;
  backend: string;
  timeLeft: number;
  totalTime: number;
  mode?: "countdown" | "elapsed";
  elapsed?: number;
}

export default function DetectorResultsPanel({ result, isModelLoaded, backend, timeLeft, totalTime, mode = "countdown", elapsed: elapsedSec }: Props) {
  const asdRisk = result?.multimodal?.asdRisk ?? 0;
  const bodyRisk = result?.multimodal?.bodyRisk ?? 0;
  const faceRisk = result?.multimodal?.faceRisk ?? 0;
  const confidence = result?.multimodal?.confidence ?? 0;
  const riskPct = Math.round(asdRisk * 100);
  const riskColor = riskPct >= 70 ? "var(--peach-300)" : riskPct >= 40 ? "#d4a843" : "var(--sage-500)";
  const progressPct = mode === "elapsed" ? 0 : ((totalTime - timeLeft) / totalTime) * 100;
  const isElapsedMode = mode === "elapsed";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Top row: Timer + ASD Gauge side by side */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {/* Timer */}
        <div className="card" style={{ padding: "14px 18px", flex: "1 1 140px", minWidth: 140 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: isElapsedMode ? 0 : 8 }}>
            <span style={{ fontWeight: 700, fontSize: "0.85rem", fontFamily: "'Fredoka',sans-serif" }}>
              {isElapsedMode ? "Elapsed" : "Progress"}
            </span>
            <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--sage-500)" }}>
              {isElapsedMode
                ? `${Math.floor((elapsedSec ?? 0) / 60)}:${String((elapsedSec ?? 0) % 60).padStart(2, "0")}`
                : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, "0")}`
              }
            </span>
          </div>
          {!isElapsedMode && (
            <div style={{ height: 6, background: "var(--sage-100)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${progressPct}%`,
                background: "var(--sage-500)", borderRadius: 3,
                transition: "width 1s linear",
              }} />
            </div>
          )}
        </div>

        {/* ASD Risk Gauge — compact */}
        <div className="card" style={{ padding: "14px 18px", flex: "1 1 220px", minWidth: 220, textAlign: "center" }}>
          <h3 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "0.9rem", marginBottom: 10 }}>
            ASD Risk Assessment
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "center" }}>
            {/* Circular gauge */}
            <div style={{ position: "relative", width: 90, height: 90, flexShrink: 0 }}>
              <svg width="90" height="90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--sage-100)" strokeWidth="10" />
                <circle cx="60" cy="60" r="50" fill="none" stroke={riskColor} strokeWidth="10"
                  strokeDasharray={`${asdRisk * 314} 314`} strokeLinecap="round"
                  transform="rotate(-90 60 60)" style={{ transition: "stroke-dasharray 0.5s" }} />
              </svg>
              <div style={{
                position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: "1.4rem", fontWeight: 700, fontFamily: "'Fredoka',sans-serif", color: riskColor }}>
                  {riskPct}%
                </span>
                <span style={{ fontSize: "0.6rem", color: "var(--text-muted)" }}>ASD Risk</span>
              </div>
            </div>
            {/* Breakdown bars — vertical stack beside gauge */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 80 }}>
              <RiskBar label="Body" value={bodyRisk} color="var(--sage-500)" />
              <RiskBar label="Face" value={faceRisk} color="#9b8ec4" />
              <RiskBar label="Conf" value={confidence} color="var(--sky-300)" />
            </div>
          </div>
        </div>
      </div>

      {/* Body + Face behavior — side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Body behavior bars */}
        <div className="card" style={{ padding: "14px 16px" }}>
          <h3 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "0.9rem", marginBottom: 10 }}>
            Body Behavior
          </h3>
          {result?.behavior ? (
            Array.from(result.behavior.probabilities).map((p, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: 2 }}>
                  <span style={{
                    fontWeight: i === result.behavior!.predictedClass ? 700 : 500,
                    color: i === result.behavior!.predictedClass ? "var(--text-primary)" : "var(--text-secondary)",
                  }}>
                    {BEHAVIOR_LABELS[BEHAVIOR_CLASSES[i]]}
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>{(p * 100).toFixed(1)}%</span>
                </div>
                <div style={{ height: 5, background: "var(--sage-100)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${p * 100}%`,
                    background: BEHAVIOR_COLORS[BEHAVIOR_CLASSES[i]],
                    borderRadius: 3, transition: "width 0.3s",
                  }} />
                </div>
              </div>
            ))
          ) : (
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Waiting for data...</p>
          )}
        </div>

        {/* Face behavior bars */}
        <div className="card" style={{ padding: "14px 16px" }}>
          <h3 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "0.9rem", marginBottom: 10 }}>
            Face Analysis
          </h3>
          {result?.face?.faceBehavior ? (
            Array.from(result.face.faceBehavior.probabilities).map((p, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: 2 }}>
                  <span style={{ fontWeight: 500, color: "var(--text-secondary)" }}>
                    {FACE_BEHAVIOR_LABELS[FACE_BEHAVIOR_CLASSES[i]]}
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>{(p * 100).toFixed(1)}%</span>
                </div>
                <div style={{ height: 5, background: "var(--sage-100)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${p * 100}%`,
                    background: FACE_BEHAVIOR_COLORS[FACE_BEHAVIOR_CLASSES[i]],
                    borderRadius: 3, transition: "width 0.3s",
                  }} />
                </div>
              </div>
            ))
          ) : (
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Waiting for data...</p>
          )}
        </div>
      </div>

      {/* Backend info */}
      {isModelLoaded && (
        <div style={{ textAlign: "center", fontSize: "0.72rem", color: "var(--text-muted)" }}>
          Backend: {backend || "detecting..."} · Latency: {result?.latencyMs?.toFixed(0) ?? "--"}ms
        </div>
      )}
    </div>
  );
}

function RiskBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", marginBottom: 2 }}>
        <span style={{ color: "var(--text-muted)" }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{Math.round(value * 100)}%</span>
      </div>
      <div style={{ height: 5, background: "var(--sage-100)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value * 100}%`, background: color, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}
