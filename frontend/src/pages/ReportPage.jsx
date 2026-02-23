import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useInterview } from '../store/interviewStore';
import '../styles/ReportPage.css';

export default function ReportPage() {
    const navigate = useNavigate();
    const { backendUrl, history, technicalCritiques, questionResults, reset, interviewType, questions } = useInterview();
    const [report, setReport] = useState('');
    const [score, setScore] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (history.length === 0) { navigate('/'); return; }
        generateReport();
    }, []);

    const generateReport = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axios.post(`${backendUrl}/generate-final-report`, {
                transcript: history,
                technical_critiques: technicalCritiques,
                question_results: questionResults.filter(Boolean),
            });
            const text = res.data.report;
            setReport(text);
            const match = text.match(/(\d{1,3})\s*\/\s*100/);
            if (match) setScore(parseInt(match[1], 10));
        } catch (err) {
            setError('⚠️ Could not generate report. Make sure the backend is running.');
        } finally {
            setLoading(false);
        }
    };

    const handleRestart = () => { reset(); navigate('/'); };
    const handleCopy = () => { navigator.clipboard.writeText(report); };

    const circumference = 2 * Math.PI * 50;
    const dashOffset = score !== null ? circumference - (score / 100) * circumference : circumference;

    // Stats from question results
    const attempted = questionResults.filter(Boolean);
    const passed = attempted.filter(r => r.verdict === 'PASS').length;
    const partial = attempted.filter(r => r.verdict === 'PARTIAL').length;
    const failed = attempted.filter(r => r.verdict === 'FAIL').length;
    const avgScore = attempted.length > 0
        ? Math.round(attempted.reduce((s, r) => s + r.score, 0) / attempted.length)
        : 0;

    const formatReport = (text) => {
        return text.split('\n').map((line, i) => {
            if (/^#+\s/.test(line)) return <h3 key={i} className="report-heading">{line.replace(/^#+\s/, '')}</h3>;
            if (/^\d+\.\s/.test(line)) return <div key={i} className="report-numbered">{line}</div>;
            if (/^[-•]\s/.test(line)) return <div key={i} className="report-bullet">{line}</div>;
            if (line.includes('**')) return <div key={i} className="report-bold" dangerouslySetInnerHTML={{
                __html: line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            }} />;
            if (line.trim() === '') return <div key={i} className="report-spacer" />;
            return <p key={i} className="report-line">{line}</p>;
        });
    };

    return (
        <div className="report-page">
            <div className="orb orb-r1" />
            <div className="orb orb-r2" />

            <div className="report-layout">
                <div className="report-header">
                    <div className="logo"><span className="logo-icon">⚡</span> OpenMock</div>
                    <h2>Session Complete — Final Report</h2>
                    <p className="report-type">{interviewType === 'hr' ? '👤 HR Round' : '💻 Technical Round'}</p>
                    <button className="btn-ghost" onClick={handleRestart}>← New Session</button>
                </div>

                {loading && (
                    <div className="report-loading">
                        <div className="spinner-large" />
                        <p>Generating your performance report with Gemini AI…</p>
                    </div>
                )}

                {error && (
                    <div className="report-error">
                        <p>{error}</p>
                        <button className="btn-primary" style={{ width: 'auto' }} onClick={generateReport}>Retry</button>
                    </div>
                )}

                {!loading && !error && (
                    <div className="report-content">
                        {/* Score Ring */}
                        <div className="score-section">
                            <div className="score-ring-wrapper">
                                <svg className="score-svg" viewBox="0 0 120 120">
                                    <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
                                    <circle cx="60" cy="60" r="50" fill="none" stroke="url(#grad)" strokeWidth="10" strokeLinecap="round"
                                        strokeDasharray={circumference} strokeDashoffset={dashOffset}
                                        transform="rotate(-90 60 60)"
                                        style={{ transition: 'stroke-dashoffset 1.5s ease' }}
                                    />
                                    <defs>
                                        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#6366f1" />
                                            <stop offset="100%" stopColor="#06b6d4" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div className="score-value">
                                    {score !== null ? `${score}` : '—'}
                                    {score !== null && <span className="score-denom">/100</span>}
                                </div>
                            </div>
                            <div className="score-label">Overall Score</div>
                            <div className={`score-badge ${score >= 75 ? 'good' : score >= 50 ? 'mid' : 'low'}`}>
                                {score >= 75 ? '🌟 Excellent' : score >= 50 ? '📈 Good — Keep Practising' : '💡 Needs Work'}
                            </div>
                        </div>

                        {/* Question Results Breakdown (Technical only) */}
                        {attempted.length > 0 && (
                            <div className="results-breakdown">
                                <h3 className="results-title">📊 Question Breakdown</h3>
                                <div className="results-stats">
                                    <div className="stat-card stat-pass">
                                        <div className="stat-num">{passed}</div>
                                        <div className="stat-label">Passed</div>
                                    </div>
                                    <div className="stat-card stat-partial">
                                        <div className="stat-num">{partial}</div>
                                        <div className="stat-label">Partial</div>
                                    </div>
                                    <div className="stat-card stat-fail">
                                        <div className="stat-num">{failed}</div>
                                        <div className="stat-label">Failed</div>
                                    </div>
                                    <div className="stat-card stat-avg">
                                        <div className="stat-num">{avgScore}</div>
                                        <div className="stat-label">Avg Score</div>
                                    </div>
                                </div>
                                <div className="results-list">
                                    {questionResults.map((r, i) => {
                                        if (!r) return null;
                                        const icon = r.verdict === 'PASS' ? '✅' : r.verdict === 'PARTIAL' ? '🟡' : '❌';
                                        return (
                                            <div key={i} className={`result-row verdict-${r.verdict.toLowerCase()}`}>
                                                <span className="result-q">Q{i + 1}</span>
                                                <span className="result-icon">{icon}</span>
                                                <span className="result-verdict">{r.verdict}</span>
                                                <span className="result-score">{r.score}/100</span>
                                                <span className="result-feedback">{r.feedback}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Report Body */}
                        <div className="report-body">
                            {formatReport(report)}
                        </div>

                        <div className="report-actions">
                            <button className="btn-primary" onClick={handleCopy}>📋 Copy Report</button>
                            <button className="btn-ghost" onClick={handleRestart}>🔄 New Session</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
