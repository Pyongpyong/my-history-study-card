import { Navigate, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import ContentListPage from './routes/ContentListPage';
import ContentDetailPage from './routes/ContentDetailPage';
import ContentEditPage from './routes/ContentEditPage';
import QuizListPage from './routes/QuizListPage';
import UploadJSONPage from './routes/UploadJSONPage';
import StudyListPage from './routes/StudyListPage';
import StudyPage from './routes/StudyPage';
import RewardListPage from './routes/RewardListPage';
import QuizCreatePage from './routes/QuizCreatePage';
import QuizEditPage from './routes/QuizEditPage';
import ContentCreatePage from './routes/ContentCreatePage';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/contents" replace />} />
          <Route path="/contents" element={<ContentListPage />} />
          <Route path="/contents/new" element={<ContentCreatePage />} />
          <Route path="/contents/:id" element={<ContentDetailPage />} />
          <Route path="/contents/:id/edit" element={<ContentEditPage />} />
          <Route path="/contents/:id/quizzes/new" element={<QuizCreatePage />} />
          <Route path="/quizzes" element={<QuizListPage />} />
          <Route path="/quizzes/:id/edit" element={<QuizEditPage />} />
          <Route path="/upload" element={<UploadJSONPage />} />
          <Route path="/rewards" element={<RewardListPage />} />
          <Route path="/studies" element={<StudyListPage />} />
          <Route path="/study/:id" element={<StudyPage />} />
        </Routes>
      </main>
    </div>
  );
}
