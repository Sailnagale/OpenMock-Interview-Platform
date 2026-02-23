import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInterview } from '../store/interviewStore';
import '../styles/LandingPage.css';

const HR_QUESTIONS = [
    { id: 'hr_1', label: 'Q1 – Team Conflict' },
    { id: 'hr_2', label: 'Q2 – Role Motivation' },
];
const TECH_QUESTIONS = [
    { id: 'cb_1', label: 'Q1 – Sum 1 to N' },
    { id: 'cb_2', label: 'Q2 – Largest Element' },
    { id: 'll_1', label: 'Q3 – FizzBuzz' },
];

export default function LandingPage() {
    const navigate = useNavigate();
    const {
        interviewType, setInterviewType,
        currentQuestionId, setCurrentQuestionId,
        backendUrl, setBackendUrl,
        lmStudioUrl, setLmStudioUrl,
        reset,
    } = useInterview();

    const [starting, setStarting] = useState(false);

    const questions = interviewType === 'hr' ? HR_QUESTIONS : TECH_QUESTIONS;

    const handleTypeChange = (type) => {
        setInterviewType(type);
        setCurrentQuestionId(type === 'hr' ? 'hr_1' : 'cb_1');
    };

    const handleStart = () => {
        reset();
        setStarting(true);
        setTimeout(() => navigate('/interview'), 400);
    };

    return (
        <div className="landing">
            <div className="orb orb-1" />
            <div className="orb orb-2" />
            <div className="orb orb-3" />

            <nav className="navbar">
                <div className="logo">
                    <span className="logo-icon">⚡</span> OpenMock
                </div>
                <span className="badge">AI‑Powered</span>
            </nav>

            <main className="hero">
                <span className="hero-chip">🚀 Groq · Gemini · LM Studio</span>
                <h1 className="hero-title">
                    Ace Your Next<br />
                    <span className="gradient-text">Interview</span>
                </h1>
                <p className="hero-sub">
                    Real‑time AI interviewer that adapts to your answers, analyses your code live,
                    and delivers a final performance report.
                </p>

                <div className="setup-card">
                    {/* Interview Type */}
                    <div className="form-group">
                        <label className="form-label">Interview Type</label>
                        <div className="toggle-group">
                            <button
                                className={`toggle-btn ${interviewType === 'hr' ? 'active' : ''}`}
                                onClick={() => handleTypeChange('hr')}
                            >
                                👤 HR Round
                            </button>
                            <button
                                className={`toggle-btn ${interviewType === 'technical' ? 'active' : ''}`}
                                onClick={() => handleTypeChange('technical')}
                            >
                                💻 Technical Round
                            </button>
                        </div>
                    </div>

                    {/* Question Picker */}
                    <div className="form-group">
                        <label className="form-label">Starting Question</label>
                        <select
                            className="select-input"
                            value={currentQuestionId}
                            onChange={e => setCurrentQuestionId(e.target.value)}
                        >
                            {questions.map(q => (
                                <option key={q.id} value={q.id}>{q.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* LM Studio URL (technical only) */}
                    {interviewType === 'technical' && (
                        <div className="form-group">
                            <label className="form-label">
                                LM Studio URL <span className="optional">(for code analysis)</span>
                            </label>
                            <input
                                className="text-input"
                                type="text"
                                value={lmStudioUrl}
                                onChange={e => setLmStudioUrl(e.target.value)}
                                placeholder="http://localhost:1234"
                            />
                        </div>
                    )}

                    {/* Backend URL */}
                    <div className="form-group">
                        <label className="form-label">Backend URL</label>
                        <input
                            className="text-input"
                            type="text"
                            value={backendUrl}
                            onChange={e => setBackendUrl(e.target.value)}
                            placeholder="http://localhost:8000"
                        />
                    </div>

                    <button
                        className={`btn-primary ${starting ? 'loading' : ''}`}
                        onClick={handleStart}
                        disabled={starting}
                    >
                        {starting ? <span className="spinner-sm" /> : 'Start Interview →'}
                    </button>
                </div>
            </main>
        </div>
    );
}
