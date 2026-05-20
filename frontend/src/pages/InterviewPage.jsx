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
    setHistory,
    technicalCritiques,
    addCritique,
    jobRole,
    questions,
    setQuestions,
    currentQuestionIdx,
    setCurrentQuestionIdx,
    questionResults,
    addQuestionResult,
    setQuestionResults,
    phase,
    setPhase,
    user,
    technicalPhase,
    setTechnicalPhase,
    submittedCode,
    setSubmittedCode,
    followUps,
    setFollowUps,
    currentScore,
    setCurrentScore,
    technicalIntroStage,
    setTechnicalIntroStage,
    reset,
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

  // --- VOICE STABILITY & TTS PLAYBACK ---
  const currentAudioRef = useRef(null);

  const speakText = async (text) => {
    if (!text) return;
    
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
      } catch (e) {}
    }

    const cleanText = text
      .replace(/[#*`_\-]/g, " ")
      .replace(/\[METADATA:.*?\]/g, "")
      .trim();

    if (!cleanText) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const tempCtx = new AudioContext();
        if (tempCtx.state === "suspended") {
          await tempCtx.resume();
        }
      }

      const res = await axios.post(`${backendUrl}/api/voice/tts`, { text: cleanText });
      if (res.data && res.data.audio) {
        const audio = new Audio("data:audio/mp3;base64," + res.data.audio);
        currentAudioRef.current = audio;
        await new Promise((resolve) => {
          audio.onended = resolve;
          audio.onerror = resolve;
          audio.play().catch((e) => {
            console.error("Autoplay/Audio play blocked or failed:", e);
            resolve();
          });
        });
      }
    } catch (err) {
      console.error("TTS speech failed:", err);
    }
  };

  // --- VOICE STATES ---
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // --- NLP & RAG STATES ---
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

  // ================= INITIALIZATION =================
  useEffect(() => {
    if (effectRan.current || initialized) return;
    setInitialized(true);
    effectRan.current = true;

    const startInterview = async () => {
      const displayRole = jobRole || "Software Engineer";
      setIsSending(true);

      try {
        const response = await fetch(
          `${backendUrl}/api/interview/start-or-followup`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_input: "",
              history: [],
              interview_type: interviewType,
              job_role: displayRole,
              current_question_id: currentQuestionId,
              user_email: user?.email || "",
              technical_phase: isTechnical ? "intro" : "coding",
              technical_intro_stage: 0
            }),
          },
        );

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          fullContent += chunk;
          setStreamingText(fullContent);
        }

        addMessage("assistant", fullContent);
        setStreamingText("");
        
        speakText(fullContent);

        if (isTechnical) {
          setTechnicalPhase("intro");
          setTechnicalIntroStage(1);
          setQuestions(["Pending...", "Pending...", "Pending..."]);
          setCurrentQuestionIdx(0);
          
          (async () => {
            try {
              const qRes = await axios.post(`${backendUrl}/api/technical/generate-questions`, {
                job_role: displayRole,
                count: 1,
                difficulty: "easy"
              });
              const q1 = qRes.data.questions[0] || "Given an array of integers, return indices of the two numbers such that they add up to a specific target.";
              setQuestions([q1, "Pending...", "Pending..."]);
            } catch (err) {
              console.error("Coding initial question generation error:", err);
              const fallbackQ = "Given an array of integers, return indices of the two numbers such that they add up to a specific target.";
              setQuestions([fallbackQ, "Pending...", "Pending..."]);
            }
          })();
        }
      } catch (err) {
        console.error("Init Error:", err);
        addMessage(
          "assistant",
          "⚠️ Failed to connect to AI. Please ensure backend is running at " + backendUrl
        );
      } finally {
        setIsSending(false);
      }
    };

    startInterview();
  }, [
    backendUrl,
    interviewType,
    jobRole,
    currentQuestionId,
    isTechnical,
    setPhase,
    addMessage,
    initialized,
    user,
    setQuestions,
    setCurrentQuestionIdx,
    setTechnicalPhase
  ]);

  const handleEndInterview = () => {
    if (
      window.confirm(
        "Ready to wrap up? This will generate your final report with NLP analysis.",
      )
    ) {
      navigate("/report");
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
      const res = await fetch(`${backendUrl}/api/interview/start-or-followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_input: text,
          history,
          interview_type: interviewType,
          job_role: jobRole,
          user_email: user?.email || "",
          technical_phase: technicalPhase,
          technical_intro_stage: isTechnical && technicalPhase === "intro" ? technicalIntroStage : undefined,
          current_question_idx: currentQuestionIdx,
          current_question_text: questions[currentQuestionIdx] || "",
          submitted_code: submittedCode,
          current_score: currentScore,
          follow_ups: followUps
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
        setStreamingText(full.replace(/\[METADATA:\s*\{[\s\S]*?\}\s*\]/g, "").trim());
      }

      let assistantMessage = full;
      let meta = null;

      const metadataMatch = full.match(/\[METADATA:\s*(\{[\s\S]*?\})\]/);
      if (metadataMatch) {
        try {
          meta = JSON.parse(metadataMatch[1]);
          assistantMessage = full.replace(/\[METADATA:\s*\{[\s\S]*?\}\s*\]/g, "").trim();
        } catch (e) {
          console.error("Failed to parse stream metadata:", e);
        }
      }

      addMessage("assistant", assistantMessage);
      setStreamingText("");

      speakText(assistantMessage);

      if (isTechnical && technicalPhase === "intro") {
        setTechnicalIntroStage((prev) => prev + 1);
      }

      if (meta) {
        if (meta.score_adjustment !== undefined) {
          const currentResult = questionResults[currentQuestionIdx];
          if (currentResult) {
            const adjustedScore = Math.max(0, Math.min(100, currentResult.score + meta.score_adjustment));
            addQuestionResult(currentQuestionIdx, {
              ...currentResult,
              score: adjustedScore
            });
          }
        }

        if (meta.next_phase) {
          setTechnicalPhase(meta.next_phase);
        }

        if (meta.transition_to_coding) {
          setTechnicalPhase("coding");
          setPhase("quiz");
          
          const currentQ1 = questions[0];
          if (currentQ1 && currentQ1 !== "Pending...") {
            // Already generated at start, just reuse and display!
            const welcomeCodingMsg = `### Coding Challenge 1 (EASY)\n\n${currentQ1}`;
            addMessage("assistant", welcomeCodingMsg);
            const shortQTitle = currentQ1.split("\n")[0] || "Coding Challenge 1";
            speakText(`I have generated Coding Challenge 1: ${shortQTitle}. Please review the description and write your solution in the editor panel on the right.`);
          } else {
            // Fallback generation if not pre-loaded for some reason
            setQuestions(["Pending...", "Pending...", "Pending..."]);
            setCurrentQuestionIdx(0);
            setIsSending(true);
            setTimeout(async () => {
              const displayRole = jobRole || "Software Engineer";
              try {
                const qRes = await axios.post(`${backendUrl}/api/technical/generate-questions`, {
                  job_role: displayRole,
                  count: 1,
                  difficulty: "easy"
                });
                const q1 = qRes.data.questions[0] || "Given an array of integers, return indices of the two numbers such that they add up to a specific target.";
                
                setQuestions([q1, "Pending...", "Pending..."]);
                setCurrentQuestionIdx(0);

                const welcomeCodingMsg = `### Coding Challenge 1 (EASY)\n\n${q1}`;
                addMessage("assistant", welcomeCodingMsg);
                
                const shortQTitle = q1.split("\n")[0] || "Coding Challenge 1";
                speakText(`I have generated Coding Challenge 1: ${shortQTitle}. Please review the description and write your solution in the editor panel on the right.`);
              } catch (err) {
                console.error("Coding transition question generation error:", err);
                const fallbackQ = "Given an array of integers, return indices of the two numbers such that they add up to a specific target.";
                setQuestions([fallbackQ, "Pending...", "Pending..."]);
                setCurrentQuestionIdx(0);
                const welcomeCodingMsg = `### Coding Challenge 1 (EASY)\n\n${fallbackQ}`;
                addMessage("assistant", welcomeCodingMsg);
                speakText("I had trouble generating the challenge online, so I've loaded a fallback coding question. Please review the details in the editor panel.");
              } finally {
                setIsSending(false);
              }
            }, 100);
          }
        }
      }
    } catch {
      addMessage("assistant", "⚠️ Network error.");
    } finally {
      setIsSending(false);
    }
  };

  // ================= VOICE LOGIC =================
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
          user_email: user?.email || "",
          technical_phase: technicalPhase,
          technical_intro_stage: isTechnical && technicalPhase === "intro" ? technicalIntroStage : undefined,
          current_question_idx: currentQuestionIdx,
          current_question_text: questions[currentQuestionIdx] || "",
          submitted_code: submittedCode,
          current_score: currentScore,
          follow_ups: followUps
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
          if (!line.trim() || !line.startsWith("data:")) continue;

          try {
            const data = JSON.parse(line.replace("data:", ""));

            if (data.user_transcription) {
              addMessage("user", data.user_transcription);
            }

            if (data.text) {
              fullText += data.text;
              setStreamingText(fullText.replace(/\[METADATA:\s*\{[\s\S]*?\}\s*\]/g, "").trim());

              if (data.audio) {
                const audio = new Audio("data:audio/mp3;base64," + data.audio);
                await new Promise((resolveAudio) => {
                  audio.onended = resolveAudio;
                  audio.play().catch((e) => {
                    console.error("Audio Playback Error:", e);
                    resolveAudio();
                  });
                });
              }
            }

            if (data.analysis) {
              setLastAnalysis(data.analysis);
            }
          } catch (e) {
            // Ignore malformed JSON lines in the stream
          }
        }
      }

      let assistantMessage = fullText;
      let meta = null;

      const metadataMatch = fullText.match(/\[METADATA:\s*(\{[\s\S]*?\})\]/);
      if (metadataMatch) {
        try {
          meta = JSON.parse(metadataMatch[1]);
          assistantMessage = fullText.replace(/\[METADATA:\s*\{[\s\S]*?\}\s*\]/g, "").trim();
        } catch (e) {
          console.error("Failed to parse stream metadata:", e);
        }
      }

      addMessage("assistant", assistantMessage);

      if (isTechnical && technicalPhase === "intro") {
        setTechnicalIntroStage((prev) => prev + 1);
      }

      if (meta) {
        if (meta.score_adjustment !== undefined) {
          const currentResult = questionResults[currentQuestionIdx];
          if (currentResult) {
            const adjustedScore = Math.max(0, Math.min(100, currentResult.score + meta.score_adjustment));
            addQuestionResult(currentQuestionIdx, {
              ...currentResult,
              score: adjustedScore
            });
          }
        }

        if (meta.next_phase) {
          setTechnicalPhase(meta.next_phase);
        }

        if (meta.transition_to_coding) {
          setTechnicalPhase("coding");
          setPhase("quiz");
          
          const currentQ1 = questions[0];
          if (currentQ1 && currentQ1 !== "Pending...") {
            const welcomeCodingMsg = `### Coding Challenge 1 (EASY)\n\n${currentQ1}`;
            addMessage("assistant", welcomeCodingMsg);
            
            const shortQTitle = currentQ1.split("\n")[0] || "Coding Challenge 1";
            speakText(`I have generated Coding Challenge 1: ${shortQTitle}. Please review the description and write your solution in the editor panel on the right.`);
          } else {
            setQuestions(["Pending...", "Pending...", "Pending..."]);
            setCurrentQuestionIdx(0);
            setIsSending(true);
            setTimeout(async () => {
              const displayRole = jobRole || "Software Engineer";
              try {
                const qRes = await axios.post(`${backendUrl}/api/technical/generate-questions`, {
                  job_role: displayRole,
                  count: 1,
                  difficulty: "easy"
                });
                const q1 = qRes.data.questions[0] || "Given an array of integers, return indices of the two numbers such that they add up to a specific target.";
                
                setQuestions([q1, "Pending...", "Pending..."]);
                setCurrentQuestionIdx(0);

                const welcomeCodingMsg = `### Coding Challenge 1 (EASY)\n\n${q1}`;
                addMessage("assistant", welcomeCodingMsg);
                
                const shortQTitle = q1.split("\n")[0] || "Coding Challenge 1";
                speakText(`I have generated Coding Challenge 1: ${shortQTitle}. Please review the description and write your solution in the editor panel on the right.`);
              } catch (err) {
                console.error("Coding transition question generation error:", err);
                const fallbackQ = "Given an array of integers, return indices of the two numbers such that they add up to a specific target.";
                setQuestions([fallbackQ, "Pending...", "Pending..."]);
                setCurrentQuestionIdx(0);
                const welcomeCodingMsg = `### Coding Challenge 1 (EASY)\n\n${fallbackQ}`;
                addMessage("assistant", welcomeCodingMsg);
                speakText("I had trouble generating the challenge online, so I've loaded a fallback coding question. Please review the details in the editor panel.");
              } finally {
                setIsSending(false);
              }
            }, 100);
          }
        }
      }
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
    if (questions[idx] === "Pending...") return;
    setCurrentQuestionIdx(idx);
    addMessage("assistant", `📝 Question ${idx + 1}: ${questions[idx]}`);
  };

  const handleSubmitResult = (result) => {
    addQuestionResult(currentQuestionIdx, {
      verdict: result.verdict,
      score: result.score,
      feedback: result.feedback,
      difficulty: currentQuestionIdx === 0 ? "easy" : (currentQuestionIdx === 1 ? "medium" : "hard")
    });

    setTechnicalPhase("followup1");
    setSubmittedCode(result.submittedCode || "");
    setFollowUps(result.all_follow_ups || [result.follow_up]);
    setCurrentScore(result.score);

    const subMessage = `### Code Submitted Successfully!\n\n**Verdict:** ${result.verdict}\n**Score:** ${result.score}/100\n\n**Critique:**\n${result.feedback}\n\n**Follow-up Question 1:** ${result.follow_up}`;
    addMessage("assistant", subMessage);

    const spokenMessage = `Your code scored ${result.score} points with a verdict of ${result.verdict}. Here is my follow up question: ${result.follow_up}`;
    speakText(spokenMessage);
  };

  const handleNextQuestion = async () => {
    if (currentQuestionIdx >= 2) {
      setPhase("done");
      const doneMsg = "Excellent! You have successfully completed all progressive coding rounds. You can now wrap up the session and generate your report by clicking the **'Finish Interview'** button.";
      addMessage("assistant", doneMsg);
      speakText(doneMsg);
      return;
    }

    const nextIdx = currentQuestionIdx + 1;
    
    // Set next element to Pending... and increment index immediately to trigger loading skeletons
    setQuestions((prev) => {
      const updated = [...prev];
      updated[nextIdx] = "Pending...";
      return updated;
    });
    setCurrentQuestionIdx(nextIdx);
    setTechnicalPhase("coding");
    setSubmittedCode("");
    setFollowUps([]);
    setCurrentScore(0);
    
    setIsSending(true);
    setStreamingText("Analyzing performance & generating next progressive coding challenge...");

    try {
      const prevResult = questionResults[currentQuestionIdx] || { score: 70, difficulty: "easy" };
      const prevScore = prevResult.score;
      const prevDiff = prevResult.difficulty || "easy";

      const res = await axios.post(`${backendUrl}/api/technical/next-question`, {
        job_role: jobRole || "Software Engineer",
        current_question_idx: nextIdx,
        previous_score: prevScore,
        previous_difficulty: prevDiff
      });

      const nextQ = res.data.question;
      const nextDifficulty = res.data.difficulty;

      setQuestions((prev) => {
        const updated = [...prev];
        updated[nextIdx] = nextQ;
        return updated;
      });

      const introMessage = `### Coding Challenge ${nextIdx + 1} (${nextDifficulty.toUpperCase()})\n\n${nextQ}`;
      addMessage("assistant", introMessage);
      
      const shortQTitle = nextQ.split("\n")[0] || `Coding Challenge ${nextIdx + 1}`;
      speakText(`I have generated Coding Challenge ${nextIdx + 1}: ${shortQTitle}. Please review the details in the editor panel.`);
    } catch (err) {
      console.error("Next question generation failed:", err);
      const fallbackQuestions = [
        "Given a string containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
        "Given an unsorted integer array, find the smallest missing positive integer."
      ];
      const fallbackQ = fallbackQuestions[nextIdx - 1] || "Given a string containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.";
      setQuestions((prev) => {
        const updated = [...prev];
        updated[nextIdx] = fallbackQ;
        return updated;
      });
      const introMessage = `### Coding Challenge ${nextIdx + 1} (MEDIUM)\n\n${fallbackQ}`;
      addMessage("assistant", introMessage);
      speakText(`I had trouble generating the challenge online, so I've loaded a fallback coding question. Please review the details in the editor panel.`);
    } finally {
      setStreamingText("");
      setIsSending(false);
    }
  };

  const isQuizMode = isTechnical;

  return (
    <div className={`interview-layout ${isQuizMode ? "quiz-mode" : ""}`}>
      <header className="interview-top-bar">
        <div className="logo-section">⚡ OpenMock AI</div>
        <div className="session-info">
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
          {lastAnalysis && (
            <div className="nlp-indicator">
              <span>Tone: {lastAnalysis.tone || "Analyzing..."}</span>
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
                {isSending ? <span className="spinner-sm" /> : "Send"}
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
            questionText={questions[currentQuestionIdx] || ""}
            questionNumber={currentQuestionIdx + 1}
            currentIdx={currentQuestionIdx}
            totalQuestions={questions.length}
            jobRole={jobRole}
            onSubmitResult={handleSubmitResult}
            onNextQuestion={handleNextQuestion}
            lastResult={questionResults[currentQuestionIdx] || null}
            technicalPhase={technicalPhase}
            codingRoundStarted={phase === "quiz"}
          />
        </div>
      </div>
    </div>
  );
}
