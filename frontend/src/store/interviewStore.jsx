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

  const reset = () => {
    setHistory([]);
    setTechnicalCritiques([]);
    // We keep jobRole here because the user usually wants to keep their role
    // if they restart a session from the landing page.
    setQuestions([]);
    setCurrentQuestionIdx(0);
    setQuestionResults([]);
    setPhase("intro");
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
        addQuestionResult,
        phase,
        setPhase,
        reset,
      }}
    >
      {children}
    </InterviewContext.Provider>
  );
};

export const useInterview = () => useContext(InterviewContext);
