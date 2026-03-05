/**
 * DetectorResultsPanel — displays ASD risk gauge, behavior classification bars,
 * and face analysis. Re-themed for AutiSense sage green palette.
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
      {/* Timer */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: isElapsedMode ? 0 : 8 }}>
          <span style={{ fontWeight: 700, fontSize: "0.9rem", fontFamily: "'Fredoka',sans-serif" }}>
            {isElapsedMode ? "Elapsed" : "Screening Progress"}
          </span>
          <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--sage-500)" }}>
            {isElapsedMode
              ? `${Math.floor((elapsedSec ?? 0) / 60)}:${String((elapsedSec ?? 0) % 60).padStart(2, "0")}`
              : `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, "0")}`
            }
          </span>
        </div>
        {!isElapsedMode && (
          <div style={{ height: 8, background: "var(--sage-100)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${progressPct}%`,
              background: "var(--sage-500)", borderRadius: 4,
              transition: "width 1s linear",
            }} />
          </div>
        )}
      </div>

      {/* ASD Risk Gauge */}
      <div className="card" style={{ padding: "20px", textAlign: "center" }}>
        <h3 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "1rem", marginBottom: 14 }}>
          ASD Risk Assessment
        </h3>
        {/* Circular gauge */}
        <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto 14px" }}>
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--sage-100)" strokeWidth="10" />
            <circle cx="60" cy="60" r="50" fill="none" stroke={riskColor} strokeWidth="10"
              strokeDasharray={`${asdRisk * 314} 314`} strokeLinecap="round"
              transform="rotate(-90 60 60)" style={{ transition: "stroke-dasharray 0.5s" }} />
          </svg>
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: "1.8rem", fontWeight: 700, fontFamily: "'Fredoka',sans-serif", color: riskColor }}>
              {riskPct}%
            </span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>ASD Risk</span>
          </div>
        </div>
        {/* Breakdown */}
        <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
          <RiskBar label="Body" value={bodyRisk} color="var(--sage-500)" />
          <RiskBar label="Face" value={faceRisk} color="#9b8ec4" />
          <RiskBar label="Confidence" value={confidence} color="var(--sky-300)" />
        </div>
      </div>

      {/* Body behavior bars */}
      {result?.behavior && (
        <div className="card" style={{ padding: "16px 20px" }}>
          <h3 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "0.95rem", marginBottom: 12 }}>
            Body Behavior
          </h3>
          {Array.from(result.behavior.probabilities).map((p, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 3 }}>
                <span style={{
                  fontWeight: i === result.behavior!.predictedClass ? 700 : 500,
                  color: i === result.behavior!.predictedClass ? "var(--text-primary)" : "var(--text-secondary)",
                }}>
                  {BEHAVIOR_LABELS[BEHAVIOR_CLASSES[i]]}
                </span>
                <span style={{ color: "var(--text-muted)" }}>{(p * 100).toFixed(1)}%</span>
              </div>
              <div style={{ height: 6, background: "var(--sage-100)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${p * 100}%`,
                  background: BEHAVIOR_COLORS[BEHAVIOR_CLASSES[i]],
                  borderRadius: 3, transition: "width 0.3s",
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Face behavior bars */}
      {result?.face?.faceBehavior && (
        <div className="card" style={{ padding: "16px 20px" }}>
          <h3 style={{ fontFamily: "'Fredoka',sans-serif", fontWeight: 600, fontSize: "0.95rem", marginBottom: 12 }}>
            Face Analysis
          </h3>
          {Array.from(result.face.faceBehavior.probabilities).map((p, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 3 }}>
                <span style={{ fontWeight: 500, color: "var(--text-secondary)" }}>
                  {FACE_BEHAVIOR_LABELS[FACE_BEHAVIOR_CLASSES[i]]}
                </span>
                <span style={{ color: "var(--text-muted)" }}>{(p * 100).toFixed(1)}%</span>
              </div>
              <div style={{ height: 6, background: "var(--sage-100)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${p * 100}%`,
                  background: FACE_BEHAVIOR_COLORS[FACE_BEHAVIOR_CLASSES[i]],
                  borderRadius: 3, transition: "width 0.3s",
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Backend info */}
      {isModelLoaded && (
        <div style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Backend: {backend || "detecting..."} &nbsp;·&nbsp; Latency: {result?.latencyMs?.toFixed(0) ?? "--"}ms
        </div>
      )}
    </div>
  );
}

function RiskBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ height: 6, background: "var(--sage-100)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value * 100}%`, background: color, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
      <div style={{ fontSize: "0.75rem", fontWeight: 700, color, marginTop: 4 }}>{Math.round(value * 100)}%</div>
    </div>
  );
}
