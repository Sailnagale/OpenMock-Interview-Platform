import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useInterview } from "../store/interviewStore";
import ChatMessage from "../components/ChatMessage";
import CodeEditor from "../components/CodeEditor";
import QuestionTracker from "../components/QuestionTracker";
import "../styles/InterviewPage.css";

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
    jobRole,
    questions,
    currentQuestionIdx,
    setCurrentQuestionIdx,
    questionResults,
    addQuestionResult,
    phase,
    setPhase,
  } = useInterview();

  const [userInput, setUserInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [initialized, setInitialized] = useState(false);

  // --- TIMER STATES ---
  const [timeLeft, setTimeLeft] = useState(1800); // 30 mins
  const timerRef = useRef(null);

  const messagesEndRef = useRef(null);
  const effectRan = useRef(false);
  const isTechnical = interviewType === "technical";

  // --- VOICE STATES ---
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // --- NLP & RAG STATES (NEW) ---
  const [lastAnalysis, setLastAnalysis] = useState(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, streamingText]);

  // ================= TIMER LOGIC =================
  useEffect(() => {
    if (!initialized) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          clearInterval(timerRef.current);
          alert("Time is up! Redirecting to your report.");
          navigate("/report");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [initialized, navigate]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // ================= INITIALIZATION (RAG AWARE) =================
  useEffect(() => {
    if (effectRan.current || initialized) return;
    setInitialized(true);
    effectRan.current = true;

    const startInterview = async () => {
      const displayRole = jobRole || "Software Engineer";
      try {
        // Updated to use the unified API that now pulls from RAG modules
        const res = await axios.post(
          `${backendUrl}/api/interview/start-or-followup`,
          {
            user_input: "",
            history: [],
            interview_type: interviewType,
            job_role: displayRole,
            current_question_id: currentQuestionId,
          },
        );

        if (res.data?.content) {
          addMessage("assistant", res.data.content);
        }

        if (isTechnical) {
          setPhase("quiz");
        }
      } catch (err) {
        addMessage(
          "assistant",
          "⚠️ Backend connection failed. Ensure server is on port 8000.",
        );
      }
    };
    startInterview();
  }, []);

  const handleEndInterview = () => {
    if (
      window.confirm(
        "Ready to wrap up? This will generate your final report with NLP analysis.",
      )
    ) {
      navigate("/report");
    }
  };

  // ================= TEXT LOGIC (NLP & RAG AWARE) =================
  const sendMessage = async () => {
    const text = userInput.trim();
    if (!text || isSending) return;
    addMessage("user", text);
    setUserInput("");
    setIsSending(true);
    setStreamingText("");

    try {
      const res = await fetch(`${backendUrl}/api/interview/start-or-followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_input: text,
          history,
          interview_type: interviewType,
          job_role: jobRole,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        full += chunk;
        setStreamingText(full);
      }

      addMessage("assistant", full);
      setStreamingText("");
    } catch {
      addMessage("assistant", "⚠️ Network error.");
    } finally {
      setIsSending(false);
    }
  };

  // ================= VOICE LOGIC (NLP & RAG AWARE) =================
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        handleVoiceSend();
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic error:", err);
      addMessage(
        "assistant",
        "⚠️ Mic error. Please ensure permissions are granted.",
      );
      setIsRecording(false);
    }
  };

  const handleVoiceSend = async () => {
    if (audioChunksRef.current.length === 0) {
      setIsRecording(false);
      return;
    }

    setIsSending(true);
    try {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const base64 = await new Promise((resolve) => {
        const fr = new FileReader();
        fr.readAsDataURL(blob);
        fr.onloadend = () => resolve(fr.result.split(",")[1]);
      });

      const res = await fetch(`${backendUrl}/api/voice/voice-interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_input: base64,
          history,
          interview_type: interviewType,
          job_role: jobRole,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = JSON.parse(line.replace("data:", ""));

          if (data.user_transcription) {
            addMessage("user", data.user_transcription);
          }

          if (data.text) {
            fullText += data.text;
            setStreamingText(fullText);

            // Handle real-time audio playback from AI
            if (data.audio) {
              const audio = new Audio("data:audio/mp3;base64," + data.audio);
              await new Promise((res) => {
                audio.onended = res;
                audio.play();
              });
            }
          }

          // Capture hidden NLP analysis for the dashboard if sent
          if (data.analysis) {
            setLastAnalysis(data.analysis);
          }
        }
      }
      addMessage("assistant", fullText);
    } catch (err) {
      console.error("Voice Error:", err);
      addMessage("assistant", "⚠️ Voice processing failed.");
    } finally {
      setIsSending(false);
      setIsRecording(false);
      setStreamingText("");
    }
  };

  const goToQuestion = (idx) => {
    setCurrentQuestionIdx(idx);
    addMessage("assistant", `📝 Question ${idx + 1}: ${questions[idx]}`);
  };

  const handleSubmitResult = (result) => {
    addQuestionResult(currentQuestionIdx, result);
    addMessage(
      "assistant",
      `Verdict: ${result.verdict} | Score: ${result.score}`,
    );
  };

  const isQuizMode = isTechnical && phase === "quiz";

  return (
    <div className={`interview-layout ${isQuizMode ? "quiz-mode" : ""}`}>
      <header className="interview-top-bar">
        <div className="logo-section">⚡ OpenMock AI</div>
        <div className="session-info">
          {/* Timer with Warning state */}
          <div className={`timer-display ${timeLeft < 300 ? "urgent" : ""}`}>
            {formatTime(timeLeft)}
          </div>
          <span className="badge">{interviewType.toUpperCase()} ROUND</span>
          <button className="btn-end-session" onClick={handleEndInterview}>
            Finish Interview
          </button>
        </div>
      </header>

      <div className="panels-container">
        {isQuizMode && (
          <QuestionTracker
            questions={questions}
            results={questionResults}
            currentIdx={currentQuestionIdx}
            onSelect={goToQuestion}
          />
        )}

        <div className="panel panel-chat">
          {/* Added a subtle NLP status indicator if analysis is active */}
          {lastAnalysis && (
            <div className="nlp-indicator">
              <span>Confidence: {lastAnalysis.tone || "Analyzing..."}</span>
            </div>
          )}

          <div className="chat-messages">
            {history.map((msg, i) => (
              <ChatMessage key={i} role={msg.role} content={msg.content} />
            ))}
            {streamingText && (
              <ChatMessage role="assistant" content={streamingText} />
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            <textarea
              className="chat-textarea"
              placeholder={isRecording ? "Listening..." : "Type your answer..."}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && sendMessage()
              }
              disabled={isSending}
            />
            <div className="input-controls">
              <button
                className={`btn-mic ${isRecording ? "recording" : ""}`}
                onClick={() =>
                  isRecording
                    ? mediaRecorderRef.current.stop()
                    : startRecording()
                }
              >
                {isRecording ? "⏹️" : "🎤"}
              </button>
              <button
                className="btn-send"
                onClick={sendMessage}
                disabled={isSending || !userInput.trim()}
              >
                Send
              </button>
            </div>
          </div>
        </div>

        <div className="panel panel-editor">
          <CodeEditor
            backendUrl={backendUrl}
            lmStudioUrl={lmStudioUrl}
            onCritique={addCritique}
            onQuestion={(q) => addMessage("assistant", q)}
            isTechnical={isTechnical}
            isQuizMode={isQuizMode}
            currentQuestion={questions[currentQuestionIdx] || ""}
            currentIdx={currentQuestionIdx}
            totalQuestions={questions.length}
            jobRole={jobRole}
            onSubmitResult={handleSubmitResult}
            lastResult={questionResults[currentQuestionIdx] || null}
          />
        </div>
      </div>
    </div>
  );
}
