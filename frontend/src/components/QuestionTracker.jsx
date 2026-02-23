import '../styles/QuestionTracker.css';

export default function QuestionTracker({ questions, results, currentIdx, onSelect }) {
    const getIcon = (idx) => {
        const r = results[idx];
        if (!r) return <span className="qt-icon qt-pending">—</span>;
        if (r.verdict === 'PASS') return <span className="qt-icon qt-pass">✓</span>;
        if (r.verdict === 'PARTIAL') return <span className="qt-icon qt-partial">◐</span>;
        return <span className="qt-icon qt-fail">✕</span>;
    };

    const passCount = results.filter(r => r && r.verdict === 'PASS').length;
    const attemptedCount = results.filter(r => r).length;

    return (
        <div className="panel panel-tracker">
            <div className="panel-header tracker-header">
                <div className="panel-title">Questions</div>
                <div className="tracker-score">
                    {passCount}/{attemptedCount} passed
                </div>
            </div>
            <div className="tracker-list">
                {questions.map((q, i) => (
                    <button
                        key={i}
                        className={`tracker-item ${i === currentIdx ? 'active' : ''} ${results[i] ? 'done' : ''}`}
                        onClick={() => onSelect(i)}
                        title={q}
                    >
                        <span className="tracker-num">Q{i + 1}</span>
                        {getIcon(i)}
                    </button>
                ))}
            </div>
            <div className="tracker-progress">
                <div className="progress-bar">
                    <div
                        className="progress-fill"
                        style={{ width: `${(attemptedCount / Math.max(questions.length, 1)) * 100}%` }}
                    />
                </div>
                <span className="progress-label">{attemptedCount}/{questions.length} attempted</span>
            </div>
        </div>
    );
}
