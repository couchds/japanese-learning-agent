import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Kanji from './pages/Kanji';
import Words from './pages/Words';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="words" element={<Words />} />
          <Route path="kanji" element={<Kanji />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
