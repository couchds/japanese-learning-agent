import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import './Layout.css';

const Layout: React.FC = () => {
  const location = useLocation();
  const [isDictionaryExpanded, setIsDictionaryExpanded] = useState(
    location.pathname === '/kanji' || location.pathname === '/words'
  );

  const toggleDictionary = () => {
    setIsDictionaryExpanded(!isDictionaryExpanded);
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <h2>Japanese Learning</h2>
        <nav>
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li className="expandable-item">
              <div className="expandable-header" onClick={toggleDictionary}>
                <span>Dictionary</span>
                <span className={`arrow ${isDictionaryExpanded ? 'expanded' : ''}`}>▶</span>
              </div>
              {isDictionaryExpanded && (
                <ul className="submenu">
                  <li>
                    <Link to="/words">Word Dictionary</Link>
                  </li>
                  <li>
                    <Link to="/kanji">Kanji Dictionary</Link>
                  </li>
                </ul>
              )}
            </li>
          </ul>
        </nav>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;

