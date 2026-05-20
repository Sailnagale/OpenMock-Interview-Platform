import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useInterview } from "../store/interviewStore";
import ReportCard from "../components/ReportCard";
import "../styles/ReportPage.css";

export default function ReportPage() {
  const navigate = useNavigate();
  const {
    backendUrl,
    history,
    technicalCritiques,
    questionResults,
    reset,
    interviewType,
  } = useInterview();

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Safety: Redirect if no history exists
    if (!history || history.length === 0) {
      navigate("/");
      return;
    }
    generateReport();
  }, []);

  const generateReport = async () => {
    setLoading(true);
    setError("");

    try {
      // session_live matches the dynamic route in main.py
      const sessionId = "session_live";

      // We use GET to match the @app.get in your updated main.py
      const res = await axios.get(
        `${backendUrl}/api/report/generate/${sessionId}`,
        {
          params: {
            interview_type: interviewType,
            // We pass context for the NLP engine to process
            has_critiques: technicalCritiques && technicalCritiques.length > 0,
          },
        },
      );

      if (!res.data) {
        throw new Error("Invalid response from backend");
      }

      setReportData(res.data);
    } catch (err) {
      console.error("Report error:", err);
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Failed to generate report. Check backend console for 404/500 errors.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    reset();
    navigate("/");
  };

  return (
    <div className="report-page">
      <div className="orb orb-r1" />
      <div className="orb orb-r2" />

      <div className="report-layout">
        <header className="report-header">
          <div className="logo">
            <span className="logo-icon">⚡</span> OpenMock AI
          </div>
          <h2>Session Complete</h2>
          <p className="report-type">
            {interviewType === "hr" ? "👤 HR Round" : "💻 Technical Round"}
          </p>
          <button className="btn-ghost" onClick={handleRestart}>
            ← New Session
          </button>
        </header>

        {loading && (
          <div className="report-loading">
            <div className="spinner-large" />
            <p>Analyzing transcript and RAG metadata...</p>
          </div>
        )}

        {error && (
          <div className="report-error">
            <p>{error}</p>
            <button
              className="btn-primary"
              onClick={generateReport}
              style={{ marginTop: "20px" }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && reportData && (
          <div className="report-content">
            {/* The professional dashboard component */}
            <ReportCard data={reportData} />

            <div className="report-actions">
              <button className="btn-primary" onClick={() => window.print()}>
                🖨️ Print Report
              </button>
              <button className="btn-ghost" onClick={handleRestart}>
                🔄 Start Over
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
