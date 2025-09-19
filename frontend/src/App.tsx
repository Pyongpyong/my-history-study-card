import { Navigate, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import RequireAuth from './components/RequireAuth';
import RequireAdmin from './components/RequireAdmin';
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
import AuthPage from './routes/AuthPage';
import UserSettingsPage from './routes/UserSettingsPage';
import AdminPage from './routes/AdminPage';

export default function App() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />
      <main className="app-container mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/contents" replace />} />
          <Route path="/contents" element={<ContentListPage />} />
          <Route
            path="/contents/new"
            element={(
              <RequireAuth>
                <ContentCreatePage />
              </RequireAuth>
            )}
          />
          <Route path="/contents/:id" element={<ContentDetailPage />} />
          <Route
            path="/contents/:id/edit"
            element={(
              <RequireAuth>
                <ContentEditPage />
              </RequireAuth>
            )}
          />
          <Route
            path="/contents/:id/quizzes/new"
            element={(
              <RequireAuth>
                <QuizCreatePage />
              </RequireAuth>
            )}
          />
          <Route path="/quizzes" element={<QuizListPage />} />
          <Route
            path="/quizzes/:id/edit"
            element={(
              <RequireAuth>
                <QuizEditPage />
              </RequireAuth>
            )}
          />
          <Route
            path="/upload"
            element={(
              <RequireAuth>
                <UploadJSONPage />
              </RequireAuth>
            )}
          />
          <Route
            path="/rewards"
            element={(
              <RequireAuth>
                <RewardListPage />
              </RequireAuth>
            )}
          />
          <Route
            path="/studies"
            element={(
              <RequireAuth>
                <StudyListPage />
              </RequireAuth>
            )}
          />
          <Route path="/study/:id" element={<StudyPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/settings"
            element={(
              <RequireAuth>
                <UserSettingsPage />
              </RequireAuth>
            )}
          />
          <Route
            path="/admin"
            element={(
              <RequireAdmin>
                <AdminPage />
              </RequireAdmin>
            )}
          />
        </Routes>
      </main>
    </div>
  );
}
