import { useState, useRef, useEffect } from "react";
import axios from "axios";
import "../styles/CodeEditor.css";

const LANGS = ["python", "javascript", "java", "cpp", "go", "rust"];

const getStarterCode = (questionText, lang) => {
  if (!questionText || questionText === "Pending...") return "";

  // Heuristics to find a good function name
  let funcName = "solve";
  const cleanText = questionText.toLowerCase();
  
  if (cleanText.includes("two sum") || cleanText.includes("two-sum")) {
    funcName = "twoSum";
  } else if (cleanText.includes("reverse a string") || cleanText.includes("reverse string")) {
    funcName = "reverseString";
  } else if (cleanText.includes("palindrome")) {
    funcName = "isPalindrome";
  } else if (cleanText.includes("fizzbuzz") || cleanText.includes("fizz buzz")) {
    funcName = "fizzBuzz";
  } else if (cleanText.includes("anagram")) {
    funcName = "isAnagram";
  } else if (cleanText.includes("fibonacci")) {
    funcName = "fibonacci";
  } else if (cleanText.includes("factorial")) {
    funcName = "factorial";
  } else if (cleanText.includes("merge sorting") || cleanText.includes("merge sort")) {
    funcName = "mergeSort";
  } else if (cleanText.includes("binary search")) {
    funcName = "binarySearch";
  } else {
    // Try to extract a verb/noun from the first few words of the question title
    const titleMatch = questionText.match(/^(?:Challenge|Question|Problem)?\s*\d*[:.]?\s*([a-zA-Z0-9\s]+)/);
    if (titleMatch && titleMatch[1]) {
      const words = titleMatch[1].trim().split(/\s+/);
      if (words.length > 0 && words[0].length > 1) {
        funcName = words[0].toLowerCase() + words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
        funcName = funcName.replace(/[^a-zA-Z0-9]/g, "");
      }
    }
  }

  if (!funcName || funcName.length > 25) {
    funcName = "solve";
  }

  switch (lang) {
    case "python":
      return `def ${funcName}(self, *args, **kwargs):\n    # Write your Python code here\n    pass\n`;
    case "javascript":
      return `function ${funcName}() {\n    // Write your JavaScript code here\n    \n}\n`;
    case "java":
      return `public class Solution {\n    public void ${funcName}() {\n        // Write your Java code here\n        \n    }\n}`;
    case "cpp":
      return `#include <iostream>\nusing namespace std;\n\nclass Solution {\npublic:\n    void ${funcName}() {\n        // Write your C++ code here\n        \n    }\n};`;
    case "go":
      return `package main\n\nfunc ${funcName}() {\n    // Write your Go code here\n    \n}`;
    case "rust":
      return `impl Solution {\n    pub fn ${funcName}() {\n        // Write your Rust code here\n        \n    }\n}`;
    default:
      return "# Write your solution here...\n";
  }
};

const renderParsedQuestion = (text, currentIdx) => {
  if (!text) return null;

  if (text.trim() === "Pending...") {
    return (
      <div className="question-loading-state">
        <span className="spinner-sm" />
        <span style={{ marginLeft: "8px" }}>Generating coding challenge...</span>
      </div>
    );
  }

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return <div className="question-text">{text}</div>;

  let title = `Challenge ${currentIdx + 1}`;
  let descriptionLines = [];
  let exampleLines = [];
  let constraintLines = [];

  let currentSection = "description";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    if (i === 0 && !lowerLine.startsWith("example") && !lowerLine.startsWith("constraint") && !line.startsWith("-") && !line.startsWith("*")) {
      title = line.replace(/^[#\d.\s\-]+/, "");
      continue;
    }

    if (lowerLine.startsWith("example") || line.startsWith("### Example") || lowerLine.startsWith("input/output")) {
      currentSection = "examples";
      exampleLines.push(line);
    } else if (lowerLine.startsWith("constraint") || line.startsWith("### Constraint") || lowerLine.startsWith("rules:") || lowerLine.startsWith("note:")) {
      currentSection = "constraints";
      constraintLines.push(line);
    } else {
      if (currentSection === "description") {
        descriptionLines.push(line);
      } else if (currentSection === "examples") {
        exampleLines.push(line);
      } else if (currentSection === "constraints") {
        constraintLines.push(line);
      }
    }
  }

  return (
    <div className="parsed-question">
      <div className="question-label">Question {currentIdx + 1}</div>
      <h3 className="parsed-question-title">{title}</h3>
      
      {descriptionLines.length > 0 && (
        <div className="parsed-section description-sec">
          <p>{descriptionLines.join(" ")}</p>
        </div>
      )}
      
      {exampleLines.length > 0 && (
        <div className="parsed-section examples-sec">
          <h4>Examples</h4>
          <pre className="example-block">{exampleLines.join("\n")}</pre>
        </div>
      )}

      {constraintLines.length > 0 && (
        <div className="parsed-section constraints-sec">
          <h4>Constraints &amp; Rules</h4>
          <ul>
            {constraintLines.map((c, idx) => (
              <li key={idx}>{c.replace(/^[\-\*\s•]+/, "")}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default function CodeEditor({
  backendUrl,
  lmStudioUrl,
  onCritique,
  onQuestion,
  isTechnical,
  isQuizMode,
  currentQuestion,
  questionText,
  starterCode,
  questionNumber,
  currentIdx,
  totalQuestions,
  jobRole,
  onSubmitResult,
  onNextQuestion,
  lastResult,
  technicalPhase,
  codingRoundStarted = true,
}) {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");
  const [analyzing, setAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verdict, setVerdict] = useState(null); // {verdict, score, feedback, follow_up}
  const editorRef = useRef(null);

  const displayQuestion = questionText || currentQuestion;
  const displayQuestionIdx = (questionNumber !== undefined && questionNumber !== null) ? (questionNumber - 1) : currentIdx;

  useEffect(() => {
    setVerdict(null);
    setFeedbackVisible(false);
    if (isQuizMode && displayQuestion && displayQuestion !== "Pending...") {
      const template = starterCode || getStarterCode(displayQuestion, language);
      setCode(template);
      if (editorRef.current) {
        editorRef.current.focus();
      }
    } else {
      setCode("");
    }
  }, [displayQuestionIdx, language, displayQuestion, isQuizMode, starterCode]);

  const lineCount = Math.max(code.split("\n").length, 1);

  // Legacy: Analyze via LM Studio (Updated with /api/technical prefix)
  const handleAnalyze = async () => {
    if (!code.trim()) return;
    setAnalyzing(true);
    setFeedbackVisible(false);
    try {
      const res = await axios.post(
        `${backendUrl}/api/technical/analyze-code-and-ask`,
        {
          code,
          language,
          lm_studio_url: lmStudioUrl,
        },
      );
      setFeedback(res.data.interviewer_question);
      setFeedbackVisible(true);
      if (res.data.technical_critique_hidden)
        onCritique(res.data.technical_critique_hidden);
      if (res.data.interviewer_question)
        onQuestion(res.data.interviewer_question);
    } catch (err) {
      setFeedback(
        `⚠️ ${err.response?.data?.detail || "Analysis failed. Check /api/technical route."}`,
      );
      setFeedbackVisible(true);
    } finally {
      setAnalyzing(false);
    }
  };

  // New: Submit code for grading (Updated with /api/technical prefix)
  const handleSubmitCode = async () => {
    if (!code.trim()) return;
    setSubmitting(true);
    setVerdict(null);
    try {
      const res = await axios.post(
        `${backendUrl}/api/technical/submit-code-answer`,
        {
          question: currentQuestion,
          code,
          language,
          job_role: jobRole,
        },
      );
      setVerdict(res.data);
      onSubmitResult({ ...res.data, submittedCode: code });
    } catch (err) {
      const fallback = {
        verdict: "FAIL",
        score: 0,
        feedback:
          "Submission failed. Ensure backend /api/technical/submit-code-answer is reachable.",
        follow_up: "",
      };
      setVerdict(fallback);
      onSubmitResult({ ...fallback, submittedCode: code });
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextQuestion = () => {
    setCode("");
    setVerdict(null);
    setFeedbackVisible(false);
    onNextQuestion();
  };

  const verdictColor =
    verdict?.verdict === "PASS"
      ? "var(--green)"
      : verdict?.verdict === "PARTIAL"
        ? "var(--yellow)"
        : "var(--red)";

  return (
    <div
      className={`panel panel-code ${!isTechnical ? "panel-code-hint" : ""}`}
    >
      <div className="panel-header">
        <span className="panel-title">
          {isQuizMode
            ? `💻 Q${displayQuestionIdx + 1} of ${totalQuestions}`
            : isTechnical
              ? "💻 Code Editor"
              : "📝 Scratch Pad"}
        </span>
        <select
          className="select-input select-sm"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          {LANGS.map((l) => (
            <option key={l} value={l}>
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </option>
          ))}
        </select>

        {/* Quiz mode: Submit Answer */}
        {isQuizMode && !verdict && (
          <button
            className={`btn-accent btn-sm ${submitting ? "loading" : ""}`}
            onClick={handleSubmitCode}
            disabled={submitting || !code.trim()}
          >
            {submitting ? <span className="spinner-sm" /> : "▶ Submit Answer"}
          </button>
        )}

        {/* Quiz mode: Next Question (Only when follow-up evaluation is done) */}
        {isQuizMode && verdict && technicalPhase === "done" && displayQuestionIdx < totalQuestions - 1 && (
          <button className="btn-accent btn-sm" onClick={handleNextQuestion}>
            Next Question →
          </button>
        )}

        {/* Quiz mode: Next Question status feedback */}
        {isQuizMode && verdict && technicalPhase !== "done" && (
          <span className="badge badge-warning" style={{ fontSize: "11.5px", background: "rgba(245, 158, 11, 0.2)", border: "1px solid rgb(245, 158, 11)" }}>💬 Follow-up Q&A active</span>
        )}

        {/* Quiz mode: Next Question status feedback */}
        {isQuizMode && verdict && technicalPhase === "done" && displayQuestionIdx === totalQuestions - 1 && (
          <span className="badge badge-success" style={{ fontSize: "11.5px", background: "rgba(16, 185, 129, 0.2)", border: "1px solid rgb(16, 185, 129)" }}>✓ All challenges completed</span>
        )}

        {/* Non-quiz technical: Analyze via LM Studio */}
        {isTechnical && !isQuizMode && (
          <button
            className={`btn-accent btn-sm ${analyzing ? "loading" : ""}`}
            onClick={handleAnalyze}
            disabled={analyzing || !code.trim()}
          >
            {analyzing ? <span className="spinner-sm" /> : "⚡ Analyze"}
          </button>
        )}
      </div>

      {/* Current question card (quiz mode) */}
      {isQuizMode && displayQuestion && (
        <div className="question-card">
          {renderParsedQuestion(displayQuestion, displayQuestionIdx)}
        </div>
      )}

      {/* Code editor with Line Numbers */}
      <div className="editor-wrapper">
        <div className="line-numbers" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i + 1} className="line-num">
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={editorRef}
          className="code-textarea"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          placeholder={
            isQuizMode
              ? "# Write your solution here..."
              : "# Use this scratch pad..."
          }
          wrap="off"
        />
      </div>

      {/* Verdict card (quiz mode) */}
      {verdict && (
        <div className="verdict-card" style={{ borderColor: verdictColor }}>
          <div className="verdict-header">
            <span
              className="verdict-badge"
              style={{ background: verdictColor }}
            >
              {verdict.verdict === "PASS"
                ? "✅"
                : verdict.verdict === "PARTIAL"
                  ? "🟡"
                  : "❌"}{" "}
              {verdict.verdict}
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
          <button
            className="feedback-close"
            onClick={() => setFeedbackVisible(false)}
          >
            ✕
          </button>
        </div>
      )}

      {!isTechnical && (
        <div className="scratch-note">
          Switch to <strong>Technical Round</strong> on the landing page to
          enable AI code analysis.
        </div>
      )}
    </div>
  );
}
