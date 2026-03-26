import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInterview } from "../store/interviewStore";
import "../styles/LandingPage.css";

// ✅ Preset roles for quick selection
const PRESET_ROLES = [
  "Frontend Developer",
  "Backend Engineer",
  "Full Stack Developer",
  "DevOps Engineer",
  "Data Scientist",
  "HR Manager",
];

export default function LandingPage() {
  const navigate = useNavigate();
  const {
    interviewType,
    setInterviewType,
    jobRole,
    setJobRole,
    lmStudioUrl,
    setLmStudioUrl,
    reset,
  } = useInterview();

  const [starting, setStarting] = useState(false);

  const handleTypeChange = (type) => {
    setInterviewType(type);
  };

  const handleStart = () => {
    if (!jobRole.trim()) {
      alert("Please enter or select the Job Role you are applying for.");
      return;
    }
    reset();
    setStarting(true);
    // Small delay for the ripple/loading effect
    setTimeout(() => navigate("/interview"), 600);
  };

  return (
    <div className="landing">
      {/* Animated Background Orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <nav className="navbar">
        <div className="logo">
          <span className="logo-icon">⚡</span> OpenMock
        </div>
        <div className="nav-right">
          <span className="badge">v2.0 Beta</span>
          <span className="hero-chip">Powered by Groq & Gemini</span>
        </div>
      </nav>

      <main className="hero">
        <h1 className="hero-title">
          Ace Your Next
          <br />
          <span className="gradient-text">Interview</span>
        </h1>
        <p className="hero-sub">
          The most realistic AI-driven interview simulator. Select your round,
          describe your role, and get real-time feedback on your performance.
        </p>

        <div className="setup-card">
          {/* 1. Interview Type Selection */}
          <div className="form-group">
            <label className="form-label">Select Interview Path</label>
            <div className="toggle-group">
              <button
                className={`toggle-btn ${interviewType === "hr" ? "active" : ""}`}
                onClick={() => handleTypeChange("hr")}
              >
                <span className="icon">👤</span>
                <div className="btn-txt">
                  <strong>HR Round</strong>
                  <span>Behavioral & Cultural</span>
                </div>
              </button>
              <button
                className={`toggle-btn ${interviewType === "technical" ? "active" : ""}`}
                onClick={() => handleTypeChange("technical")}
              >
                <span className="icon">💻</span>
                <div className="btn-txt">
                  <strong>Technical</strong>
                  <span>Coding & Architecture</span>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Job Role Selection (Multiple Options + Custom) */}
          <div className="form-group">
            <label className="form-label">Target Job Role</label>

            <div className="role-suggestions">
              {PRESET_ROLES.map((role) => (
                <button
                  key={role}
                  className={`role-chip ${jobRole === role ? "active" : ""}`}
                  onClick={() => setJobRole(role)}
                >
                  {role}
                </button>
              ))}
            </div>

            <input
              className="text-input"
              type="text"
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              placeholder="Or type a custom role..."
            />
          </div>

          {/* 3. LM Studio URL (Optional - Only for Technical) */}
          {interviewType === "technical" && (
            <div className="form-group animate-fade-in">
              <label className="form-label">
                Local AI Analysis <span className="optional">(LM Studio)</span>
              </label>
              <input
                className="text-input"
                type="text"
                value={lmStudioUrl}
                onChange={(e) => setLmStudioUrl(e.target.value)}
                placeholder="http://localhost:1234"
              />
              <p className="input-hint">
                Enable local Phi-3 for live code critiques.
              </p>
            </div>
          )}

          <button
            className={`btn-primary ${starting ? "loading" : ""}`}
            onClick={handleStart}
            disabled={starting}
          >
            {starting ? (
              <>
                <span className="spinner-sm" /> Initializing AI...
              </>
            ) : (
              "Start Interview →"
            )}
          </button>
        </div>
      </main>

      <footer className="landing-footer">
        <p>No login required. Your data remains private during the session.</p>
      </footer>
    </div>
  );
}
