import { createContext, useContext, useState } from "react";

const InterviewContext = createContext(null);

export const InterviewProvider = ({ children }) => {
  const [interviewType, setInterviewType] = useState("hr");
  const [currentQuestionId, setCurrentQuestionId] = useState("hr_1");
  const [backendUrl, setBackendUrl] = useState("http://localhost:8000");
  const [lmStudioUrl, setLmStudioUrl] = useState("http://localhost:1234");
  const [history, setHistory] = useState([]);
  const [technicalCritiques, setTechnicalCritiques] = useState([]);

  // Phase 2: Technical round state
  const [jobRole, setJobRole] = useState("");
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [questionResults, setQuestionResults] = useState([]);
  const [phase, setPhase] = useState("intro"); // 'intro' | 'loading' | 'quiz' | 'done'

  // User auth state
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("openmock_user") || "null");
    } catch {
      return null;
    }
  });

  // Progressive Coding Round sub-phases: 'coding' | 'evaluating' | 'followup1' | 'followup2' | 'done'
  const [technicalPhase, setTechnicalPhase] = useState("coding");
  const [submittedCode, setSubmittedCode] = useState("");
  const [followUps, setFollowUps] = useState([]);
  const [currentScore, setCurrentScore] = useState(0);
  const [technicalIntroStage, setTechnicalIntroStage] = useState(0);

  const addMessage = (role, content) => {
    setHistory((prev) => [...prev, { role, content }]);
  };

  const addCritique = (critique) => {
    setTechnicalCritiques((prev) => [...prev, critique]);
  };

  const addQuestionResult = (idx, result) => {
    setQuestionResults((prev) => {
      const updated = [...prev];
      updated[idx] = result;
      return updated;
    });
  };

  const logout = () => {
    localStorage.removeItem("openmock_user");
    setUser(null);
  };

  const reset = () => {
    setHistory([]);
    setTechnicalCritiques([]);
    setQuestions([]);
    setCurrentQuestionIdx(0);
    setQuestionResults([]);
    setPhase("intro");
    setTechnicalPhase("coding");
    setSubmittedCode("");
    setFollowUps([]);
    setCurrentScore(0);
    setTechnicalIntroStage(0);
  };

  return (
    <InterviewContext.Provider
      value={{
        interviewType,
        setInterviewType,
        currentQuestionId,
        setCurrentQuestionId,
        backendUrl,
        setBackendUrl,
        lmStudioUrl,
        setLmStudioUrl,
        history,
        addMessage,
        setHistory,
        technicalCritiques,
        addCritique,
        jobRole,
        setJobRole,
        questions,
        setQuestions,
        currentQuestionIdx,
        setCurrentQuestionIdx,
        questionResults,
        setQuestionResults,
        addQuestionResult,
        phase,
        setPhase,
        user,
        setUser,
        logout,
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
      }}
    >
      {children}
    </InterviewContext.Provider>
  );
};

export const useInterview = () => useContext(InterviewContext);
