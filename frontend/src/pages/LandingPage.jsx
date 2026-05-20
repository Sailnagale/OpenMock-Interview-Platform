import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useInterview } from "../store/interviewStore";
import ResumePreview from "../components/ResumePreview";
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
    backendUrl,
    lmStudioUrl,
    setLmStudioUrl,
    reset,
  } = useInterview();

  // --- UI STATES ---
  const [starting, setStarting] = useState(false);
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const handleTypeChange = (type) => {
    setInterviewType(type);
  };

  // --- RESUME UPLOAD LOGIC (RAG) ---
  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Reset previous data if a new file is picked
    setExtractedText("");
    setFile(selectedFile);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      // Hits the /upload-resume endpoint we defined in main.py
      const res = await axios.post(`${backendUrl}/upload-resume`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.status === "success") {
        setExtractedText(res.data.extracted_text);
        setShowPreview(true); // Open the modal to show extracted content
      }
    } catch (err) {
      console.error("Upload Error:", err);
      alert(
        err.response?.data?.detail ||
          "Failed to analyze resume. Please try again.",
      );
      setFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleStart = () => {
    if (!jobRole.trim()) {
      alert("Please enter or select the Job Role you are applying for.");
      return;
    }

    // Reset store state for a fresh session
    reset();
    setStarting(true);

    // Visual delay to allow orbs/animations to transition
    setTimeout(() => {
      navigate("/interview");
    }, 800);
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
          {/* ✅ RESUME UPLOAD SECTION (RAG) */}
          <div className="form-group">
            <label className="form-label">
              Personalize with Resume{" "}
              <span className="optional">(Recommended)</span>
            </label>
            <div
              className={`upload-zone ${file ? "file-selected" : ""} ${isUploading ? "uploading" : ""}`}
            >
              <input
                type="file"
                id="resume-input"
                hidden
                accept=".pdf,.docx,.txt"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              <label htmlFor="resume-input" className="upload-label">
                {isUploading ? (
                  <span className="upload-loading-text">
                    <span className="spinner-sm" /> Processing RAG Knowledge...
                  </span>
                ) : file ? (
                  <span className="file-name-display">
                    📄 {file.name} (Stored in Vector DB)
                  </span>
                ) : (
                  "📤 Click to upload Resume for Personalized Q&A"
                )}
              </label>
            </div>
            {extractedText && (
              <p className="input-hint success">
                ✓ Knowledge base updated with your experience.
              </p>
            )}
          </div>

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

          {/* 2. Job Role Selection */}
          <div className="form-group">
            <label className="form-label">Target Job Role</label>
            <div className="role-suggestions">
              {PRESET_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
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

          {/* 3. LM Studio URL (Technical Only) */}
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
                Enable local Phi-3 or Llama for real-time code critiques.
              </p>
            </div>
          )}

          <button
            className={`btn-primary ${starting ? "loading" : ""}`}
            onClick={handleStart}
            disabled={starting || isUploading}
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

      {/* ✅ RESUME PREVIEW MODAL */}
      {showPreview && (
        <ResumePreview
          text={extractedText}
          onConfirm={() => setShowPreview(false)}
          onCancel={() => {
            setShowPreview(false);
            setFile(null);
            setExtractedText("");
          }}
        />
      )}

      <footer className="landing-footer">
        <p>No login required. Your data remains private during the session.</p>
      </footer>
    </div>
  );
}
