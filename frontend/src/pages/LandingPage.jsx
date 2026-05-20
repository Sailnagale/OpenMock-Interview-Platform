import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useInterview } from "../store/interviewStore";
import ResumePreview from "../components/ResumePreview";
import "../styles/LandingPage.css";

// Preset roles for quick selection
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
    user,
    setUser,
    logout,
  } = useInterview();

  // --- UI STATES ---
  const [starting, setStarting] = useState(false);
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handleTypeChange = (type) => {
    setInterviewType(type);
  };

  // --- LOAD HISTORICAL PERFORMANCES ---
  const loadHistory = async (email) => {
    setLoadingHistory(true);
    try {
      const res = await axios.get(`${backendUrl}/api/auth/history/${email}`);
      setHistoryList(res.data);
    } catch (err) {
      console.error("Failed to load user history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (user?.email) {
      loadHistory(user.email);
    } else {
      setHistoryList([]);
    }
  }, [user]);

  // Decode JWT payload on frontend safely
  const decodeJwt = (token) => {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        window
          .atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error("JWT Decode error:", e);
      return null;
    }
  };

  const handleGoogleLoginResponse = async (response) => {
    const cred = response.credential;
    const decoded = decodeJwt(cred);
    if (!decoded) return;

    try {
      const res = await axios.post(`${backendUrl}/api/auth/google-login`, {
        credential: cred,
      });
      if (res.data.status === "success") {
        const loggedUser = {
          ...res.data.user,
          token: cred,
        };
        setUser(loggedUser);
        localStorage.setItem("openmock_user", JSON.stringify(loggedUser));
      }
    } catch (err) {
      console.error("Login endpoint failure:", err);
      alert("Failed to authenticate with backend Google login.");
    }
  };

  useEffect(() => {
    let active = true;
    const initGoogle = () => {
      if (window.google && !user && active) {
        try {
          if (!window.googleInitialized) {
            window.google.accounts.id.initialize({
              client_id:
                import.meta.env.VITE_GOOGLE_CLIENT_ID || "680084462648-qaotu4g5h8io3helueo15l4ks1gque44.apps.googleusercontent.com",
              callback: handleGoogleLoginResponse,
            });
            window.googleInitialized = true;
          }
          const btnElem = document.getElementById("google-signin-btn");
          if (btnElem) {
            window.google.accounts.id.renderButton(
              btnElem,
              { theme: "outline", size: "large", width: "100%", shape: "pill" }
            );
          }
        } catch (e) {
          console.warn("Google Sign-In initialization warning:", e);
        }
      }
    };

    if (window.google) {
      initGoogle();
    } else {
      const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (script) {
        script.onload = initGoogle;
      }
    }
    return () => {
      active = false;
    };
  }, [user]);

  // --- RESUME UPLOAD LOGIC (RAG) ---
  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setExtractedText("");
    setFile(selectedFile);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await axios.post(`${backendUrl}/upload-resume`, formData, {
        headers: { 
          "Content-Type": "multipart/form-data",
          "X-User-Email": user?.email || ""
        },
      });

      if (res.data.status === "success") {
        setExtractedText(res.data.extracted_text);
        setShowPreview(true);
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

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        if (ctx.state === "suspended") {
          ctx.resume();
        }
      }
    } catch (e) {
      console.warn("Failed to unlock audio context:", e);
    }

    reset();
    setStarting(true);

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
          {user ? (
            <div className="user-profile-nav">
              <img src={user.picture || "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"} alt="profile" className="profile-img" />
              <span className="profile-name">Hi, {user.given_name || user.name}</span>
              <button className="btn-signout" onClick={logout}>Sign Out</button>
            </div>
          ) : (
            <div id="google-signin-btn" style={{ minWidth: "150px" }}></div>
          )}
        </div>
      </nav>

      <main className="hero-container">
        <div className="hero-left">
          <h1 className="hero-title">
            Ace Your Next
            <br />
            <span className="gradient-text">Interview</span>
          </h1>
          <p className="hero-sub">
            The most realistic AI-driven interview simulator. Select your round,
            describe your role, and get real-time feedback on your performance.
          </p>

          {/* Past sessions performance list */}
          {user && historyList.length > 0 && (
            <div className="history-section animate-fade-in">
              <h3 className="section-title">Previous Performance History</h3>
              <div className="history-list">
                {historyList.map((sess, idx) => {
                  const date = new Date(sess.timestamp * 1000).toLocaleDateString();
                  const score = sess.results?.[0]?.score || (sess.results?.length ? "Analyzed" : "N/A");
                  return (
                    <div key={sess.id || idx} className="history-item">
                      <div className="history-meta">
                        <span className="history-type">{sess.session_type.toUpperCase()} Round</span>
                        <span className="history-date">{date}</span>
                      </div>
                      <div className="history-score">
                        Score: <span className="score-val">{score}/100</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="hero-right">
          <div className="setup-card">
            {/* RESUME UPLOAD SECTION (RAG) */}
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
        </div>
      </main>

      {/* RESUME PREVIEW MODAL */}
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
        <p>Your session stats will be logged to your account for progressive learning.</p>
      </footer>
    </div>
  );
}
