import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import './Layout.css';

const Layout: React.FC = () => {
  return (
    <div className="layout">
      <aside className="sidebar">
        <h2>Japanese Learning</h2>
        <nav>
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/kanji">Kanji</Link>
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

