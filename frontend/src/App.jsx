import { Routes, Route, Navigate } from 'react-router-dom';
import { InterviewProvider } from './store/interviewStore';
import LandingPage from './pages/LandingPage';
import InterviewPage from './pages/InterviewPage';
import ReportPage from './pages/ReportPage';

export default function App() {
  return (
    <InterviewProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/interview" element={<InterviewPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </InterviewProvider>
  );
}
