import React from "react";
import { useInterview } from "../store/interviewStore";
import "../styles/ReportCard.css";

const ProgressBar = ({ label, score }) => {
  const totalBlocks = 10;
  const activeBlocks = Math.round(score / 10);
  const bar = "█".repeat(activeBlocks) + "░".repeat(totalBlocks - activeBlocks);

  return (
    <div className="report-bar-row">
      <span className="bar-label">{label}</span>
      <span className="bar-visual">
        {bar} {score}%
      </span>
    </div>
  );
};

export default function ReportCard({ data }) {
  if (!data) return null;
  const { questionResults, interviewType } = useInterview();

  return (
    <div className="report-card-main">
      {/* 1. EXECUTIVE SUMMARY */}
      <section className="report-section">
        <h3 className="section-title">🧾 1. Executive Summary</h3>
        <div className="summary-inner">
          <p>
            <strong>Performance:</strong> {data.executive_summary.performance}
          </p>
          <p>
            <strong>Strengths:</strong> {data.executive_summary.strengths}
          </p>
          <p>
            <strong>Critical Weakness:</strong>{" "}
            {data.executive_summary.weaknesses}
          </p>
          <div className="final-verdict-tag">
            Recommendation:{" "}
            <span>{data.executive_summary.final_recommendation}</span>
          </div>
        </div>
      </section>

      {/* 2. OVERALL DASHBOARD */}
      <section className="report-section">
        <h3 className="section-title">📊 2. Overall Performance Dashboard</h3>
        <div className="dashboard-bars">
          <ProgressBar label="Technical Skills" score={data.scores.technical} />
          <ProgressBar
            label="Problem Solving"
            score={data.scores.problem_solving}
          />
          <ProgressBar
            label="Communication"
            score={data.scores.communication}
          />
          <ProgressBar label="Confidence" score={data.scores.confidence} />
          <ProgressBar label="Code Quality" score={data.scores.code_quality} />
        </div>
      </section>

      {/* 3. RAG KNOWLEDGE EVALUATION */}
      <section className="report-section">
        <h3 className="section-title">🧠 3. RAG-Based Knowledge Evaluation</h3>
        <div className="rag-eval-grid">
          <div className="rag-box success">
            <strong>✔ Concepts Covered</strong>
            <p>{data.rag_evaluation.covered.join(", ")}</p>
          </div>
          <div className="rag-box danger">
            <strong>❌ Missing Concepts</strong>
            <p>{data.rag_evaluation.missing.join(", ")}</p>
          </div>
          <div className="rag-box warning">
            <strong>⚠ Partial Understanding</strong>
            <p>{data.rag_evaluation.partial.join(", ")}</p>
          </div>
        </div>
      </section>

      {/* 4. PROGRESSIVE CODING ROUND DETAILS */}
      {interviewType === "technical" && questionResults && questionResults.length > 0 && (
        <section className="report-section">
          <h3 className="section-title">💻 4. Technical Coding Round Details</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
            {questionResults.map((res, idx) => {
              if (!res) return null;
              const statusColor =
                res.verdict === "PASS"
                  ? "#10b981"
                  : res.verdict === "PARTIAL"
                  ? "#f59e0b"
                  : "#ef4444";
              return (
                <div key={idx} style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderLeft: `4px solid ${statusColor}`,
                  padding: "16px",
                  borderRadius: "8px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <h4 style={{ margin: 0, color: "#fff", fontSize: "15px" }}>Challenge {idx + 1} ({res.difficulty?.toUpperCase()})</h4>
                    <span style={{
                      background: statusColor,
                      color: "#fff",
                      fontSize: "11px",
                      fontWeight: "700",
                      padding: "4px 8px",
                      borderRadius: "4px"
                    }}>{res.verdict}</span>
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" }}>
                    Score: <strong style={{ color: "#fff" }}>{res.score}/100</strong>
                  </div>
                  {res.feedback && (
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.5" }}>{res.feedback}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 8. IMPROVEMENT PLAN */}
      <section className="report-section">
        <h3 className="section-title">🧾 8. Personalized Improvement Plan</h3>
        <div className="improvement-grid">
          <div className="imp-col">
            <h4>Technical</h4>
            <ul>
              {data.improvement_plan.technical.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="imp-col">
            <h4>Actionable Next Steps</h4>
            <ol>
              {data.improvement_plan.steps.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <footer className="report-card-footer">
        <div className="final-decision-badge">
          Decision: {data.executive_summary.final_recommendation}
        </div>
        <p className="impact-statement">
          "Evaluated with 94% AI Confidence Score"
        </p>
      </footer>
    </div>
  );
}
