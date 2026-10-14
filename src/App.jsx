import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Login from './pages/Auth/Login';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminCurriculum from './pages/Admin/AdminCurriculum';
import UserDashboard from './pages/Dashboard/UserDashboard';
import CourseOverview from './pages/Course/CourseOverview';
import LessonViewer from './pages/Course/LessonViewer';
import Flashcards from './pages/Dashboard/Flashcards';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen text-xl bg-gray-50">লোড হচ্ছে...</div>;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={session ? <AdminDashboard /> : <Navigate to="/login" />} />
        <Route path="/admin/course/:courseId" element={session ? <AdminCurriculum /> : <Navigate to="/login" />} />
        
        {/* Student Routes */}
        <Route path="/" element={session ? <UserDashboard /> : <Navigate to="/login" />} />
        <Route path="/course/:courseId" element={session ? <CourseOverview /> : <Navigate to="/login" />} />
        <Route path="/lesson/:lessonId" element={session ? <LessonViewer /> : <Navigate to="/login" />} />
        <Route path="/flashcards" element={session ? <Flashcards /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
