import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Home from './pages/Home';
import Kanji from './pages/Kanji';
import KanjiDraw from './pages/KanjiDraw';
import Words from './pages/Words';
import Resources from './pages/Resources';
import ResourceDetail from './pages/ResourceDetail';
import Training from './pages/Training';
import PronunciationTraining from './pages/PronunciationTraining';
import TestModel from './pages/TestModel';
import Login from './pages/Login';
import Signup from './pages/Signup';
import VerifyEmail from './pages/VerifyEmail';
import './App.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          
          {/* Protected routes */}
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Home />} />
            <Route path="words" element={<Words />} />
            <Route path="kanji" element={<Kanji />} />
            <Route path="kanji-draw" element={<KanjiDraw />} />
            <Route path="pronunciation" element={<PronunciationTraining />} />
            <Route path="test-model" element={<TestModel />} />
            <Route path="resources" element={<Resources />} />
            <Route path="resources/:id" element={<ResourceDetail />} />
            <Route path="resources/:id/train/kanji" element={<Training />} />
            <Route path="resources/:id/train/speech" element={<Training />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
