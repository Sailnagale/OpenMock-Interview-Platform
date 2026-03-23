import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useInterview } from '../store/interviewStore';
import ChatMessage from '../components/ChatMessage';
import CodeEditor from '../components/CodeEditor';
import QuestionTracker from '../components/QuestionTracker';
import '../styles/InterviewPage.css';

export default function InterviewPage() {
    const navigate = useNavigate();
    const {
        interviewType,
        currentQuestionId,
        backendUrl,
        lmStudioUrl,
        history,
        addMessage,
        technicalCritiques,
        addCritique,
        // Technical round state
        jobRole, setJobRole,
        questions, setQuestions,
        currentQuestionIdx, setCurrentQuestionIdx,
        questionResults, addQuestionResult,
        phase, setPhase,
    } = useInterview();

    const [userInput, setUserInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const isTechnical = interviewType === 'technical';

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, streamingText]);

    // On mount: HR mode → fetch first question; Technical → ask for role
    useEffect(() => {
        if (initialized) return;
        setInitialized(true);

        if (!isTechnical) {
            // HR Mode: same as before
            const startInterview = async () => {
                try {
                    const res = await axios.post(`${backendUrl}/start-or-followup`, {
                        user_input: '',
                        history: [],
                        interview_type: interviewType,
                        current_question_id: currentQuestionId,
                    });
                    addMessage('assistant', res.data.content);
                } catch (err) {
                    addMessage('assistant', '⚠️ Could not connect to backend. Make sure it is running on ' + backendUrl);
                }
            };
            startInterview();
        } else {
            // Technical Mode: ask for job role
            setPhase('intro');
            addMessage('assistant',
                '👋 Welcome to your **Technical Interview**!\n\n' +
                'What job role are you applying for? (e.g. "Web Developer", "Data Scientist", "Backend Engineer")\n\n' +
                'I\'ll generate a set of coding challenges tailored to that role.'
            );
        }
    }, []);

    // Generate questions when user provides their job role
    const generateQuestions = async (role) => {
        setJobRole(role);
        setPhase('loading');
        addMessage('assistant', `🔄 Generating 30 coding challenges for **"${role}"**... This may take a moment.`);

        try {
            const res = await axios.post(`${backendUrl}/generate-questions`, {
                job_role: role,
                count: 2,
            });
            const qs = res.data.questions;
            setQuestions(qs);
            setCurrentQuestionIdx(0);
            setPhase('quiz');
            addMessage('assistant',
                `✅ **${qs.length} questions generated!**\n\n` +
                `📝 **Question 1/${qs.length}:**\n${qs[0]}\n\n` +
                'Write your code in the editor on the right and click **▶ Submit Answer** when ready.'
            );
        } catch (err) {
            const detail = err.response?.data?.detail || 'Failed to generate questions.';
            addMessage('assistant', `⚠️ ${detail}`);
            setPhase('intro');
        }
    };

    const sendMessage = async () => {
        const text = userInput.trim();
        if (!text || isSending) return;

        addMessage('user', text);
        setUserInput('');
        setIsSending(true);

        // Technical intro phase: user provides job role
        if (isTechnical && phase === 'intro') {
            setIsSending(false);
            await generateQuestions(text);
            return;
        }

        // Technical quiz phase: chat messages are conversational only
        if (isTechnical && phase === 'quiz') {
            // Stream a follow-up from Groq
            setIsStreaming(true);
            setStreamingText('');
            try {
                const res = await fetch(`${backendUrl}/start-or-followup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_input: text,
                        history: history,
                        interview_type: interviewType,
                        current_question_id: null,
                    }),
                });
                const contentType = res.headers.get('content-type') || '';
                if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
                    const reader = res.body.getReader();
                    const decoder = new TextDecoder();
                    let full = '';
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        full += decoder.decode(value);
                        setStreamingText(full);
                    }
                    setIsStreaming(false);
                    addMessage('assistant', full);
                    setStreamingText('');
                } else {
                    const data = await res.json();
                    setIsStreaming(false);
                    addMessage('assistant', data.content || JSON.stringify(data));
                    setStreamingText('');
                }
            } catch {
                setIsStreaming(false);
                addMessage('assistant', '⚠️ Network error.');
            }
            setIsSending(false);
            return;
        }

        // HR mode: stream response
        setIsStreaming(true);
        setStreamingText('');
        try {
            const res = await fetch(`${backendUrl}/start-or-followup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_input: text,
                    history: history,
                    interview_type: interviewType,
                    current_question_id: null,
                }),
            });
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let full = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    full += decoder.decode(value);
                    setStreamingText(full);
                }
                setIsStreaming(false);
                addMessage('assistant', full);
                setStreamingText('');
            } else {
                const data = await res.json();
                setIsStreaming(false);
                addMessage('assistant', data.content || data.message || JSON.stringify(data));
                setStreamingText('');
            }
        } catch {
            setIsStreaming(false);
            addMessage('assistant', '⚠️ Network error. Please check your backend connection.');
        } finally {
            setIsSending(false);
            inputRef.current?.focus();
        }
    };

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleEndInterview = () => {
        navigate('/report');
    };

    // Move to next question
    const goToQuestion = (idx) => {
        if (idx < 0 || idx >= questions.length) return;
        setCurrentQuestionIdx(idx);
        addMessage('assistant',
            `📝 **Question ${idx + 1}/${questions.length}:**\n${questions[idx]}`
        );
    };

    // Handle code submission result
    const handleSubmitResult = (result) => {
        addQuestionResult(currentQuestionIdx, result);
        const emoji = result.verdict === 'PASS' ? '✅' : result.verdict === 'PARTIAL' ? '🟡' : '❌';
        addMessage('assistant',
            `${emoji} **${result.verdict}** — Score: ${result.score}/100\n\n` +
            `${result.feedback}\n\n` +
            `💬 ${result.follow_up}`
        );
    };

    const isQuizMode = isTechnical && phase === 'quiz';

    return (
        <div className={`interview-layout ${isQuizMode ? 'quiz-mode' : ''}`}>
            {/* Left sidebar: Question Tracker (Technical quiz only) */}
            {isQuizMode && (
                <QuestionTracker
                    questions={questions}
                    results={questionResults}
                    currentIdx={currentQuestionIdx}
                    onSelect={goToQuestion}
                />
            )}

            {/* Chat Panel */}
            <div className="panel panel-chat">
                <div className="panel-header">
                    <div className="interviewer-avatar">
                        AI
                        <span className="status-dot" />
                    </div>
                    <div className="header-info">
                        <div className="panel-title">AI Interviewer</div>
                        <div className="panel-subtitle">
                            {isTechnical
                                ? (phase === 'quiz' ? `💻 Technical — Q${currentQuestionIdx + 1}/${questions.length}` : '💻 Technical Round')
                                : '👤 HR Round'
                            }
                        </div>
                    </div>
                    <button className="btn-ghost btn-end" onClick={handleEndInterview}>
                        End Session →
                    </button>
                </div>

                <div className="chat-messages">
                    {history.map((msg, i) => (
                        <ChatMessage key={i} role={msg.role} content={msg.content} />
                    ))}
                    {isStreaming && streamingText && (
                        <ChatMessage role="assistant" content={streamingText} streaming />
                    )}
                    {(isSending && !isStreaming) && (
                        <div className="typing-indicator">
                            <span /><span /><span />
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="chat-input-area">
                    <textarea
                        ref={inputRef}
                        className="chat-textarea"
                        placeholder={
                            isTechnical && phase === 'intro'
                                ? 'Type the job role you\'re applying for…'
                                : 'Type your answer… (Enter to send)'
                        }
                        value={userInput}
                        onChange={e => setUserInput(e.target.value)}
                        onKeyDown={handleKey}
                        rows={3}
                        disabled={isSending || phase === 'loading'}
                    />
                    <button
                        className="btn-send"
                        onClick={sendMessage}
                        disabled={isSending || !userInput.trim() || phase === 'loading'}
                    >
                        {isSending ? <span className="spinner-sm" /> : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {/* Right panel: Code Editor */}
            <CodeEditor
                backendUrl={backendUrl}
                lmStudioUrl={lmStudioUrl}
                onCritique={addCritique}
                onQuestion={(q) => addMessage('assistant', q)}
                isTechnical={isTechnical}
                // Quiz mode props
                isQuizMode={isQuizMode}
                currentQuestion={isQuizMode ? questions[currentQuestionIdx] : ''}
                currentIdx={currentQuestionIdx}
                totalQuestions={questions.length}
                jobRole={jobRole}
                onSubmitResult={handleSubmitResult}
                onNextQuestion={() => {
                    if (currentQuestionIdx < questions.length - 1) {
                        goToQuestion(currentQuestionIdx + 1);
                    }
                }}
                lastResult={questionResults[currentQuestionIdx] || null}
            />
        </div>
    );
}
