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
    if (initialized) return;
    setInitialized(true);

    if (!isTechnical) {
      const startInterview = async () => {
        try {
          const res = await axios.post(`${backendUrl}/start-or-followup`, {
            user_input: "",
            history: [],
            interview_type: interviewType,
            current_question_id: currentQuestionId,
          });
          addMessage("assistant", res.data.content);
        } catch {
          addMessage("assistant", "⚠️ Backend not running");
        }
      };
      startInterview();
    } else {
      setPhase("intro");
      addMessage(
        "assistant",
        "👋 Welcome to Technical Interview!\nWhat role are you applying for?",
      );
    }
  }, []);

  // ================= VOICE LOGIC =================
  const startRecording = async () => {
    if (isRecording || isSending) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = handleVoiceSend;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      addMessage("assistant", "⚠️ Mic permission denied or hardware error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleVoiceSend = async () => {
    if (!audioChunksRef.current.length) return;

    setIsSending(true);
    setStreamingText("");

    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    const base64Audio = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
    });

    try {
      const res = await fetch(`${backendUrl}/voice-interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio_input: base64Audio,
          history,
          interview_type: interviewType,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantFullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split(/\n+/);

        for (const line of lines) {
          const cleanedLine = line.trim();
          if (!cleanedLine.startsWith("data:")) continue;

          const rawJson = cleanedLine.replace("data:", "").trim();
          try {
            const data = JSON.parse(rawJson);

            // ✅ SHOW USER RESPONSE
            if (data.user_transcription && data.user_transcription !== "...") {
              addMessage("user", data.user_transcription);
            }

            // ✅ SHOW AI RESPONSE (STREAMING)
            if (data.text) {
              assistantFullText += data.text;
              setStreamingText(assistantFullText);

              if (data.audio) {
                const audio = new Audio("data:audio/mp3;base64," + data.audio);
                await new Promise((resolve) => {
                  audio.onended = resolve;
                  audio.play();
                });
              }
            }
          } catch (e) {
            console.warn("Could not parse JSON chunk", e);
          }
        }
      }

      if (assistantFullText) {
        addMessage("assistant", assistantFullText);
      }
      setStreamingText("");
    } catch (err) {
      console.error("Voice Error:", err);
      addMessage("assistant", "⚠️ Voice connection failed");
    } finally {
      setIsSending(false);
    }
  };

  // ================= TEXT LOGIC =================
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
          current_question_id: null,
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
      addMessage("assistant", "⚠️ Network error");
    } finally {
      setIsSending(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const goToQuestion = (idx) => {
    if (idx < 0 || idx >= questions.length) return;
    setCurrentQuestionIdx(idx);
    addMessage("assistant", `Question ${idx + 1}: ${questions[idx]}`);
  };

  const handleSubmitResult = (result) => {
    addQuestionResult(currentQuestionIdx, result);
    addMessage("assistant", `${result.verdict} - Score: ${result.score}`);
  };

  const isQuizMode = isTechnical && phase === "quiz";

  return (
    <div className={`interview-layout ${isQuizMode ? "quiz-mode" : ""}`}>
      {isQuizMode && (
        <QuestionTracker
          questions={questions}
          results={questionResults}
          currentIdx={currentQuestionIdx}
          onSelect={goToQuestion}
        />
      )}

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
            ref={inputRef}
            className="chat-textarea"
            placeholder={
              isSending ? "AI is thinking..." : "Type your answer..."
            }
            value={userInput}
            disabled={isSending}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={handleKey}
          />

          <button
            className={`btn-mic ${isRecording ? "recording" : ""} ${isSending ? "disabled" : ""}`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isSending}
          >
            {isRecording ? "⏹️ Stop" : "🎤 Mic"}
          </button>

          <button
            className="btn-send"
            onClick={sendMessage}
            disabled={isSending || isRecording}
          >
            {isSending ? "..." : "Send"}
          </button>
        </div>
      </div>

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
  );
}
