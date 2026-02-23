import { useState, useRef } from 'react';
import axios from 'axios';
import '../styles/CodeEditor.css';

const LANGS = ['python', 'javascript', 'java', 'cpp', 'go', 'rust'];

export default function CodeEditor({
    backendUrl, lmStudioUrl, onCritique, onQuestion, isTechnical,
    isQuizMode, currentQuestion, currentIdx, totalQuestions,
    jobRole, onSubmitResult, onNextQuestion, lastResult
}) {
    const [code, setCode] = useState('');
    const [language, setLanguage] = useState('python');
    const [analyzing, setAnalyzing] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [feedbackVisible, setFeedbackVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [verdict, setVerdict] = useState(null); // {verdict, score, feedback, follow_up}
    const editorRef = useRef(null);

    const lineCount = Math.max(code.split('\n').length, 1);

    // Legacy: Analyze via LM Studio
    const handleAnalyze = async () => {
        if (!code.trim()) return;
        setAnalyzing(true);
        setFeedbackVisible(false);
        try {
            const res = await axios.post(`${backendUrl}/analyze-code-and-ask`, {
                code, language, lm_studio_url: lmStudioUrl,
            });
            setFeedback(res.data.interviewer_question);
            setFeedbackVisible(true);
            if (res.data.technical_critique_hidden) onCritique(res.data.technical_critique_hidden);
            if (res.data.interviewer_question) onQuestion(res.data.interviewer_question);
        } catch (err) {
            setFeedback(`⚠️ ${err.response?.data?.detail || 'LM Studio unreachable.'}`);
            setFeedbackVisible(true);
        } finally {
            setAnalyzing(false);
        }
    };

    // New: Submit code for grading
    const handleSubmitCode = async () => {
        if (!code.trim()) return;
        setSubmitting(true);
        setVerdict(null);
        try {
            const res = await axios.post(`${backendUrl}/submit-code-answer`, {
                question: currentQuestion,
                code,
                language,
                job_role: jobRole,
            });
            setVerdict(res.data);
            onSubmitResult(res.data);
        } catch (err) {
            const fallback = { verdict: 'FAIL', score: 0, feedback: 'Submission failed. Check backend.', follow_up: '' };
            setVerdict(fallback);
            onSubmitResult(fallback);
        } finally {
            setSubmitting(false);
        }
    };

    const handleNextQuestion = () => {
        setCode('');
        setVerdict(null);
        setFeedbackVisible(false);
        onNextQuestion();
    };

    const verdictColor = verdict?.verdict === 'PASS'
        ? 'var(--green)'
        : verdict?.verdict === 'PARTIAL'
            ? 'var(--yellow)'
            : 'var(--red)';

    return (
        <div className={`panel panel-code ${!isTechnical ? 'panel-code-hint' : ''}`}>
            <div className="panel-header">
                <span className="panel-title">
                    {isQuizMode
                        ? `💻 Q${currentIdx + 1} of ${totalQuestions}`
                        : isTechnical ? '💻 Code Editor' : '📝 Scratch Pad'
                    }
                </span>
                <select
                    className="select-input select-sm"
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                >
                    {LANGS.map(l => (
                        <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                    ))}
                </select>

                {/* Quiz mode: Submit Answer */}
                {isQuizMode && !verdict && (
                    <button
                        className={`btn-accent btn-sm ${submitting ? 'loading' : ''}`}
                        onClick={handleSubmitCode}
                        disabled={submitting || !code.trim()}
                    >
                        {submitting ? <span className="spinner-sm" /> : '▶ Submit Answer'}
                    </button>
                )}

                {/* Quiz mode: Next Question */}
                {isQuizMode && verdict && currentIdx < totalQuestions - 1 && (
                    <button className="btn-accent btn-sm" onClick={handleNextQuestion}>
                        Next Question →
                    </button>
                )}

                {/* Non-quiz technical: Analyze via LM Studio */}
                {isTechnical && !isQuizMode && (
                    <button
                        className={`btn-accent btn-sm ${analyzing ? 'loading' : ''}`}
                        onClick={handleAnalyze}
                        disabled={analyzing || !code.trim()}
                    >
                        {analyzing ? <span className="spinner-sm" /> : '⚡ Analyze'}
                    </button>
                )}
            </div>

            {/* Current question card (quiz mode) */}
            {isQuizMode && (
                <div className="question-card">
                    <div className="question-label">Question {currentIdx + 1}</div>
                    <div className="question-text">{currentQuestion}</div>
                </div>
            )}

            {/* Code editor */}
            <div className="editor-wrapper">
                <div className="line-numbers" aria-hidden="true">
                    {Array.from({ length: lineCount }, (_, i) => (
                        <div key={i + 1} className="line-num">{i + 1}</div>
                    ))}
                </div>
                <textarea
                    ref={editorRef}
                    className="code-textarea"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    spellCheck={false}
                    placeholder={isQuizMode ? '# Write your solution here...' : '# Use this scratch pad...'}
                    wrap="off"
                />
            </div>

            {/* Verdict card (quiz mode) */}
            {verdict && (
                <div className="verdict-card" style={{ borderColor: verdictColor }}>
                    <div className="verdict-header">
                        <span className="verdict-badge" style={{ background: verdictColor }}>
                            {verdict.verdict === 'PASS' ? '✅' : verdict.verdict === 'PARTIAL' ? '🟡' : '❌'}
                            {' '}{verdict.verdict}
                        </span>
                        <span className="verdict-score">{verdict.score}/100</span>
                    </div>
                    <p className="verdict-feedback">{verdict.feedback}</p>
                    {verdict.follow_up && (
                        <p className="verdict-followup">💬 {verdict.follow_up}</p>
                    )}
                </div>
            )}

            {/* Legacy feedback (non-quiz) */}
            {feedbackVisible && !isQuizMode && (
                <div className="code-feedback">
                    <div className="feedback-label">🔍 AI Follow-up Question</div>
                    <p className="feedback-text">{feedback}</p>
                    <button className="feedback-close" onClick={() => setFeedbackVisible(false)}>✕</button>
                </div>
            )}

            {!isTechnical && (
                <div className="scratch-note">
                    Switch to <strong>Technical Round</strong> on the landing page to enable AI code analysis.
                </div>
            )}
        </div>
    );
}
