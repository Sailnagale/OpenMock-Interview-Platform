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

  const messagesEndRef = useRef(null);
  const effectRan = useRef(false);
  const inputRef = useRef(null);
  const isTechnical = interviewType === "technical";

  // ================= VOICE STATES =================
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, streamingText]);

  useEffect(() => {
    if (effectRan.current || initialized) return;
    setInitialized(true);
    effectRan.current = true;

    const startInterview = async () => {
      const displayRole = jobRole || "Software Engineer";
      if (!isTechnical) {
        try {
          const res = await axios.post(`${backendUrl}/start-or-followup`, {
            user_input: "",
            history: [],
            interview_type: interviewType,
            job_role: displayRole,
            current_question_id: currentQuestionId,
          });
          if (res.data?.content) addMessage("assistant", res.data.content);
        } catch {
          addMessage("assistant", "⚠️ Backend connection failed.");
        }
      } else {
        setPhase("intro");
        addMessage(
          "assistant",
          `👋 Welcome to your Technical Interview for the **${displayRole}** position. Let's begin!`,
        );
      }
    };
    startInterview();
  }, []);

  const handleEndInterview = () => {
    if (
      window.confirm("Ready to wrap up? This will generate your final report.")
    ) {
      navigate("/report");
    }
  };

  const sendMessage = async () => {
    const text = userInput.trim();
    if (!text || isSending) return;
    addMessage("user", text);
    setUserInput("");
    setIsSending(true);
    setStreamingText("");
    try {
      const res = await fetch(`${backendUrl}/start-or-followup`, {
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
        full += decoder.decode(value);
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = handleVoiceSend;
      recorder.start();
      setIsRecording(true);
    } catch {
      addMessage("assistant", "⚠️ Mic error.");
    }
  };

  const handleVoiceSend = async () => {
    setIsSending(true);
    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    const base64 = await new Promise((r) => {
      const fr = new FileReader();
      fr.readAsDataURL(blob);
      fr.onloadend = () => r(fr.result.split(",")[1]);
    });
    try {
      const res = await fetch(`${backendUrl}/voice-interview`, {
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
          if (data.user_transcription)
            addMessage("user", data.user_transcription);
          if (data.text) {
            fullText += data.text;
            setStreamingText(fullText);
            if (data.audio) {
              const audio = new Audio("data:audio/mp3;base64," + data.audio);
              await new Promise((res) => {
                audio.onended = res;
                audio.play();
              });
            }
          }
        }
      }
      addMessage("assistant", fullText);
    } catch {
      addMessage("assistant", "⚠️ Voice failed.");
    } finally {
      setIsSending(false);
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
      {/* --- TOP NAV BAR --- */}
      <header className="interview-top-bar">
        <div className="logo-section">⚡ OpenMock</div>
        <div className="session-info">
          <span className="badge">{interviewType.toUpperCase()} ROUND</span>
          <button className="btn-end-session" onClick={handleEndInterview}>
            Finish Interview
          </button>
        </div>
      </header>

      {/* --- PANELS CONTAINER --- */}
      <div className="panels-container">
        {isQuizMode && (
          <QuestionTracker
            questions={questions}
            results={questionResults}
            currentIdx={currentQuestionIdx}
            onSelect={goToQuestion}
          />
        )}

        {/* LEFT: CHAT */}
        <div className="panel panel-chat">
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
              placeholder="Type your answer..."
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
                disabled={isSending}
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: CODE EDITOR */}
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
