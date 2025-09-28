import { Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import RequireAuth from './components/RequireAuth';
import RequireAdmin from './components/RequireAdmin';
import HomePage from './routes/HomePage';
import ContentListPage from './routes/ContentListPage';
import ContentDetailPage from './routes/ContentDetailPage';
import ContentEditPage from './routes/ContentEditPage';
import QuizListPage from './routes/QuizListPage';
import UploadJSONPage from './routes/UploadJSONPage';
import StudyListPage from './routes/StudyListPage';
import StudyPage from './routes/StudyPage';
import StudyEditPage from './routes/StudyEditPage';
import RewardListPage from './routes/RewardListPage';
import QuizCreatePage from './routes/QuizCreatePage';
import QuizEditPage from './routes/QuizEditPage';
import ContentCreatePage from './routes/ContentCreatePage';
import AuthPage from './routes/AuthPage';
import UserSettingsPage from './routes/UserSettingsPage';
import ProfilePage from './routes/ProfilePage';
import AdminPage from './routes/AdminPage';
import AiTestPage from './routes/AiTestPage';

export default function App() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route 
          path="/contents" 
          element={
            <main className="app-container mx-auto max-w-6xl px-6 py-8">
              <ContentListPage />
            </main>
          } 
        />
        <Route
          path="/contents/new"
          element={(
            <main className="app-container mx-auto max-w-6xl px-6 py-8">
              <RequireAuth>
                <ContentCreatePage />
              </RequireAuth>
            </main>
          )}
        />
        <Route 
          path="/contents/:id" 
          element={
            <main className="app-container mx-auto max-w-6xl px-6 py-8">
              <ContentDetailPage />
            </main>
          } 
        />
        <Route
          path="/contents/:id/edit"
          element={(
            <main className="app-container mx-auto max-w-6xl px-6 py-8">
              <RequireAuth>
                <ContentEditPage />
              </RequireAuth>
            </main>
          )}
        />
        <Route
          path="/contents/:id/quizzes/new"
          element={(
            <main className="app-container mx-auto max-w-6xl px-6 py-8">
              <RequireAuth>
                <QuizCreatePage />
              </RequireAuth>
            </main>
          )}
        />
        <Route 
          path="/quizzes" 
          element={
            <main className="app-container mx-auto max-w-6xl px-6 py-8">
              <QuizListPage />
            </main>
          } 
        />
        <Route
          path="/quizzes/create"
          element={(
            <main className="app-container mx-auto max-w-6xl px-6 py-8">
              <RequireAuth>
                <QuizCreatePage />
              </RequireAuth>
            </main>
          )}
        />
        <Route
          path="/ai"
          element={(
            <main className="app-container mx-auto max-w-6xl px-6 py-8">
              <RequireAdmin>
                <AiTestPage />
              </RequireAdmin>
            </main>
          )}
        />
        <Route
          path="/quizzes/:id/edit"
          element={(
            <main className="app-container mx-auto max-w-6xl px-6 py-8">
              <RequireAuth>
                <QuizEditPage />
              </RequireAuth>
            </main>
          )}
        />
        <Route
          path="/upload"
          element={(
            <main className="app-container mx-auto max-w-6xl px-6 py-8">
              <RequireAuth>
                <UploadJSONPage />
              </RequireAuth>
            </main>
          )}
        />
        <Route
          path="/rewards"
          element={(
            <main className="app-container mx-auto max-w-6xl px-6 py-8">
              <RequireAuth>
                <RewardListPage />
              </RequireAuth>
            </main>
          )}
        />
        <Route
          path="/studies"
          element={(
            <main className="app-container mx-auto max-w-6xl px-6 py-8">
              <StudyListPage />
            </main>
          )}
        />
        <Route 
          path="/study/:id" 
          element={
            <main className="app-container mx-auto max-w-6xl px-6 py-8">
              <StudyPage />
            </main>
          } 
        />
        <Route
          path="/study-edit/:id"
          element={(
            <main className="app-container mx-auto max-w-6xl px-6 py-8">
              <RequireAuth>
                <StudyEditPage />
              </RequireAuth>
            </main>
          )}
        />
        <Route 
          path="/auth" 
          element={
            <main className="app-container mx-auto max-w-6xl px-6 py-8">
              <AuthPage />
            </main>
          } 
        />
        <Route
          path="/settings"
          element={(
            <main className="app-container mx-auto max-w-6xl px-6 py-8">
              <RequireAuth>
                <UserSettingsPage />
              </RequireAuth>
            </main>
          )}
        />
        <Route
          path="/profile"
          element={(
            <main className="app-container mx-auto max-w-6xl px-6 py-8">
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            </main>
          )}
        />
        <Route
          path="/admin"
          element={(
            <main className="app-container mx-auto max-w-6xl px-6 py-8">
              <RequireAdmin>
                <AdminPage />
              </RequireAdmin>
            </main>
          )}
        />
      </Routes>
    </div>
  );
}
