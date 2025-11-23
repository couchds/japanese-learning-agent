import API_URL from '../config';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

interface JLPTLevelStats {
  total: number;
  learning: number;
  mastered: number;
  notStarted: number;
}

interface DashboardStats {
  proficiencyStats: { level: number; count: number }[];
  typeStats: { type: string; count: number }[];
  recentItems: any[];
  itemsToReview: number;
  totalItems: number;
  accuracy: number;
  totalReviews: number;
  jlptStats: {
    N5: JLPTLevelStats;
    N4: JLPTLevelStats;
    N3: JLPTLevelStats;
    N2: JLPTLevelStats;
    N1: JLPTLevelStats;
  };
}

interface KnowledgeItem {
  id: number;
  item_type: string;
  proficiency_level: number;
  review_count: number;
  correct_count: number;
  incorrect_count: number;
  notes: string | null;
  updated_at: string;
  details: any;
}

const PROFICIENCY_LEVELS = [
  { value: 0, label: 'Unknown', emoji: '❓', color: '#999' },
  { value: 1, label: 'Learning', emoji: '📚', color: '#ff9800' },
  { value: 2, label: 'Familiar', emoji: '👀', color: '#ffc107' },
  { value: 3, label: 'Known', emoji: '✅', color: '#8bc34a' },
  { value: 4, label: 'Mastered', emoji: '⭐', color: '#4caf50' },
  { value: 5, label: 'Native', emoji: '🎯', color: '#2196f3' },
];

const Dashboard: React.FC = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardStats();
  }, [token]);

  useEffect(() => {
    if (selectedLevel !== null || selectedType !== null) {
      fetchItems();
    }
  }, [selectedLevel, selectedType]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedLevel !== null) params.append('proficiency_level', selectedLevel.toString());
      if (selectedType) params.append('item_type', selectedType);

      const response = await fetch(
        `${API_URL}/api/dashboard/items?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setItems(data.items);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const renderItemDetails = (item: KnowledgeItem) => {
    if (item.item_type === 'kanji' && item.details) {
      const meanings = item.details.kanji_meanings?.map((m: any) => m.meaning).join(', ') || '';
      return (
        <div className="item-card-text">
          <div className="item-type-badge kanji">Kanji</div>
          <div className="item-main">{item.details.literal}</div>
          <div className="item-meaning">{meanings}</div>
        </div>
      );
    } else if (item.item_type === 'vocabulary' && item.details) {
      const kanji = item.details.entry_kanji?.[0]?.kanji || '';
      const reading = item.details.entry_readings?.[0]?.reading || '';
      const glosses = item.details.entry_senses?.[0]?.sense_glosses?.map((g: any) => g.gloss).join(', ') || '';
      
      return (
        <div className="item-card-text">
          <div className="item-type-badge vocab">Vocabulary</div>
          <div className="item-main">{kanji || reading}</div>
          {kanji && reading && kanji !== reading && (
            <div className="item-reading">{reading}</div>
          )}
          <div className="item-meaning">{glosses}</div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <div className="dashboard-loading">Loading dashboard...</div>;
  }

  if (!stats) {
    return <div className="dashboard-error">Failed to load dashboard</div>;
  }

  const proficiencyData = PROFICIENCY_LEVELS.map(level => ({
    ...level,
    count: stats.proficiencyStats.find(s => s.level === level.value)?.count || 0,
  }));

  return (
    <div className="dashboard">
      <h1>📊 Learning Dashboard</h1>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon">📝</div>
          <div className="card-content">
            <div className="card-value">{stats.totalItems}</div>
            <div className="card-label">Total Items Tracked</div>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon">🔄</div>
          <div className="card-content">
            <div className="card-value">{stats.itemsToReview}</div>
            <div className="card-label">Ready to Review</div>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon">🎯</div>
          <div className="card-content">
            <div className="card-value">{stats.accuracy}%</div>
            <div className="card-label">Accuracy</div>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon">✅</div>
          <div className="card-content">
            <div className="card-value">{stats.totalReviews}</div>
            <div className="card-label">Total Reviews</div>
          </div>
        </div>
      </div>

      {/* Proficiency Breakdown */}
      <div className="section">
        <h2>📈 Progress by Proficiency Level</h2>
        <div className="proficiency-grid">
          {proficiencyData.map((level) => (
            <div
              key={level.value}
              className={`proficiency-card ${selectedLevel === level.value ? 'selected' : ''}`}
              style={{ borderColor: level.color }}
              onClick={() => setSelectedLevel(selectedLevel === level.value ? null : level.value)}
            >
              <div className="proficiency-emoji">{level.emoji}</div>
              <div className="proficiency-label">{level.label}</div>
              <div className="proficiency-count" style={{ color: level.color }}>
                {level.count}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Type Breakdown */}
      <div className="section">
        <h2>📚 Items by Type</h2>
        <div className="type-chips">
          {stats.typeStats.map((typeStat) => (
            <div
              key={typeStat.type}
              className={`type-chip ${selectedType === typeStat.type ? 'selected' : ''}`}
              onClick={() => setSelectedType(selectedType === typeStat.type ? null : typeStat.type)}
            >
              <span className="type-icon">
                {typeStat.type === 'kanji' && '🈁'}
                {typeStat.type === 'vocabulary' && '📖'}
                {typeStat.type === 'grammar' && '📝'}
              </span>
              <span className="type-label">{typeStat.type}</span>
              <span className="type-count">{typeStat.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* JLPT Progress */}
      <div className="section">
        <h2>🎌 JLPT Progress</h2>
        <p className="section-subtitle">Track your progress across JLPT levels (Kanji only)</p>
        <div className="jlpt-grid">
          {(['N5', 'N4', 'N3', 'N2', 'N1'] as const).map((level) => {
            const data = stats.jlptStats[level];
            const masteredPercent = data.total > 0 ? (data.mastered / data.total) * 100 : 0;
            const learningPercent = data.total > 0 ? (data.learning / data.total) * 100 : 0;
            
            return (
              <div key={level} className="jlpt-card">
                <div className="jlpt-header">
                  <h3>{level}</h3>
                  <span className="jlpt-total">{data.total} total</span>
                </div>
                
                <div className="progress-bar">
                  <div
                    className="progress-fill mastered"
                    style={{ width: `${masteredPercent}%` }}
                    title={`${data.mastered} mastered`}
                  />
                  <div
                    className="progress-fill learning"
                    style={{ width: `${learningPercent}%`, left: `${masteredPercent}%` }}
                    title={`${data.learning} learning`}
                  />
                </div>
                
                <div className="jlpt-stats">
                  <div className="jlpt-stat mastered">
                    <span className="stat-dot mastered-dot"></span>
                    <span className="stat-label">Mastered:</span>
                    <span className="stat-value">{data.mastered}</span>
                  </div>
                  <div className="jlpt-stat learning">
                    <span className="stat-dot learning-dot"></span>
                    <span className="stat-label">Learning:</span>
                    <span className="stat-value">{data.learning}</span>
                  </div>
                  <div className="jlpt-stat not-started">
                    <span className="stat-dot not-started-dot"></span>
                    <span className="stat-label">Not Started:</span>
                    <span className="stat-value">{data.notStarted}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filtered Items */}
      {(selectedLevel !== null || selectedType !== null) && (
        <div className="section">
          <h2>
            🔍 Filtered Items
            {selectedLevel !== null && ` - ${PROFICIENCY_LEVELS[selectedLevel].label}`}
            {selectedType && ` - ${selectedType}`}
          </h2>
          <button
            className="clear-filters-btn"
            onClick={() => {
              setSelectedLevel(null);
              setSelectedType(null);
              setItems([]);
            }}
          >
            Clear Filters
          </button>

          <div className="items-grid">
            {items.map((item) => (
              <div key={item.id} className="item-card">
                {renderItemDetails(item)}
                <div className="item-stats">
                  <span className="stat">Reviews: {item.review_count}</span>
                  <span className="stat success">✓ {item.correct_count}</span>
                  <span className="stat error">✗ {item.incorrect_count}</span>
                </div>
              </div>
            ))}
          </div>

          {items.length === 0 && (
            <div className="no-items">No items found with these filters</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;

