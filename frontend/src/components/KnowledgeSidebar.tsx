import API_URL from '../config';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './KnowledgeSidebar.css';

interface KnowledgeSidebarProps {
  elementId: number;
  text: string;
  elementType: string;
  itemId: number | null;
  onClose: () => void;
}

interface KnowledgeEntry {
  id: number;
  proficiency_level: number;
  notes: string | null;
  review_count: number;
  correct_count: number;
  incorrect_count: number;
  created_at: string;
  updated_at: string;
}

const PROFICIENCY_LEVELS = [
  { value: 0, label: 'Unknown', emoji: '❓', color: '#999' },
  { value: 1, label: 'Learning', emoji: '📚', color: '#ff9800' },
  { value: 2, label: 'Familiar', emoji: '👀', color: '#ffc107' },
  { value: 3, label: 'Known', emoji: '✅', color: '#8bc34a' },
  { value: 4, label: 'Mastered', emoji: '⭐', color: '#4caf50' },
  { value: 5, label: 'Native', emoji: '🎯', color: '#2196f3' },
];

const KnowledgeSidebar: React.FC<KnowledgeSidebarProps> = ({
  text,
  elementType,
  itemId,
  onClose,
}) => {
  const { token } = useAuth();
  const [knowledge, setKnowledge] = useState<KnowledgeEntry | null>(null);
  const [itemDetails, setItemDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(1); // Default to "Learning" instead of "Unknown"
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (itemId && (elementType === 'kanji' || elementType === 'vocabulary')) {
      fetchKnowledgeData();
    } else {
      setLoading(false);
    }
  }, [itemId, elementType]);

  const fetchKnowledgeData = async () => {
    if (!itemId) return;

    try {
      setLoading(true);
      const response = await fetch(
        `${API_URL}/api/user-knowledge/${elementType}/${itemId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setKnowledge(data.knowledge);
        setItemDetails(data.itemDetails);
        
        if (data.knowledge) {
          setSelectedLevel(data.knowledge.proficiency_level);
          setNotes(data.knowledge.notes || '');
        }
      }
    } catch (error) {
      console.error('Error fetching knowledge data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTracking = async () => {
    if (!itemId) return;

    try {
      setSaving(true);
      const response = await fetch(
        `${API_URL}/api/user-knowledge`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            item_type: elementType,
            item_id: itemId,
            proficiency_level: selectedLevel,
            notes: notes || null,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setKnowledge(data);
      }
    } catch (error) {
      console.error('Error starting tracking:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateKnowledge = async () => {
    if (!itemId) return;

    try {
      setSaving(true);
      const response = await fetch(
        `${API_URL}/api/user-knowledge/${elementType}/${itemId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            proficiency_level: selectedLevel,
            notes: notes || null,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setKnowledge(data);
      }
    } catch (error) {
      console.error('Error updating knowledge:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleStopTracking = async () => {
    if (!itemId || !window.confirm('Stop tracking this item?')) return;

    try {
      setSaving(true);
      const response = await fetch(
        `${API_URL}/api/user-knowledge/${elementType}/${itemId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        setKnowledge(null);
        setSelectedLevel(0);
        setNotes('');
      }
    } catch (error) {
      console.error('Error deleting knowledge:', error);
    } finally {
      setSaving(false);
    }
  };

  const renderKanjiDetails = () => {
    if (!itemDetails) return null;

    return (
      <div className="item-details">
        <div className="kanji-display">{itemDetails.literal}</div>
        <div className="detail-section">
          <strong>Meanings:</strong>
          <div className="meanings-list">
            {itemDetails.kanji_meanings?.map((m: any, idx: number) => (
              <span key={idx} className="meaning-tag">{m.meaning}</span>
            ))}
          </div>
        </div>
        <div className="detail-section">
          <strong>On-yomi:</strong> {itemDetails.on_readings?.join(', ') || 'N/A'}
        </div>
        <div className="detail-section">
          <strong>Kun-yomi:</strong> {itemDetails.kun_readings?.join(', ') || 'N/A'}
        </div>
        {itemDetails.jlpt_level && (
          <div className="detail-section">
            <strong>JLPT:</strong> N{itemDetails.jlpt_level}
          </div>
        )}
      </div>
    );
  };

  const renderVocabularyDetails = () => {
    if (!itemDetails) return null;

    const kanji = itemDetails.entry_kanji?.map((k: any) => k.kanji).join(', ') || '';
    const readings = itemDetails.entry_readings?.map((r: any) => r.reading).join(', ') || '';

    return (
      <div className="item-details">
        {kanji && <div className="vocab-display">{kanji}</div>}
        <div className="detail-section">
          <strong>Reading:</strong> {readings}
        </div>
        <div className="detail-section">
          <strong>Meanings:</strong>
          {itemDetails.entry_senses?.map((sense: any, idx: number) => (
            <div key={idx} className="sense-group">
              {sense.sense_glosses?.map((gloss: any, gIdx: number) => (
                <div key={gIdx} className="gloss-item">• {gloss.gloss}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="knowledge-sidebar-overlay" onClick={onClose}>
      <div className="knowledge-sidebar" onClick={(e) => e.stopPropagation()}>
        <div className="sidebar-header">
          <h2>{text}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="sidebar-content">
          {loading && <div className="loading">Loading...</div>}

          {!loading && !itemId && (
            <div className="not-in-dictionary">
              {(elementType === 'hiragana' || elementType === 'katakana') ? (
                <>
                  <p>ℹ️ Phonetic Text</p>
                  <p className="hint">
                    "{text}" is {elementType} text. It may be part of a word or grammatical particle.
                  </p>
                  <p className="hint">
                    Since it's not matched to a dictionary word, tracking is not available.
                  </p>
                  <p className="hint">
                    Try capturing a screenshot with the full word/phrase for better results!
                  </p>
                </>
              ) : (
                <>
                  <p>❌ This item is not in the dictionary</p>
                  <p className="hint">We couldn't find "{text}" in our database.</p>
                </>
              )}
            </div>
          )}

          {!loading && itemId && (elementType === 'kanji' || elementType === 'vocabulary') && (
            <>
              {elementType === 'kanji' && renderKanjiDetails()}
              {elementType === 'vocabulary' && renderVocabularyDetails()}

              <div className="knowledge-tracking">
                <h3>📊 Knowledge Tracking</h3>

                {!knowledge && (
                  <div className="not-tracking">
                    <p>You're not tracking this item yet.</p>
                    <button
                      className="start-tracking-btn"
                      onClick={handleStartTracking}
                      disabled={saving}
                    >
                      {saving ? 'Starting...' : '➕ Start Tracking'}
                    </button>
                  </div>
                )}

                {knowledge && (
                  <div className="tracking-active">
                    <div className="stats-grid">
                      <div className="stat-item">
                        <div className="stat-label">Reviews</div>
                        <div className="stat-value">{knowledge.review_count}</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-label">Correct</div>
                        <div className="stat-value">{knowledge.correct_count}</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-label">Incorrect</div>
                        <div className="stat-value">{knowledge.incorrect_count}</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="proficiency-selector">
                  <label>Proficiency Level:</label>
                  <div className="level-buttons">
                    {PROFICIENCY_LEVELS.map((level) => (
                      <button
                        key={level.value}
                        className={`level-btn ${selectedLevel === level.value ? 'active' : ''}`}
                        style={{
                          borderColor: selectedLevel === level.value ? level.color : '#ddd',
                          backgroundColor: selectedLevel === level.value ? level.color : 'white',
                          color: selectedLevel === level.value ? 'white' : '#333',
                        }}
                        onClick={() => setSelectedLevel(level.value)}
                      >
                        <span className="level-emoji">{level.emoji}</span>
                        <span className="level-label">{level.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="notes-section">
                  <label>Personal Notes:</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add your own notes..."
                    rows={3}
                  />
                </div>

                <div className="action-buttons">
                  {knowledge ? (
                    <>
                      <button
                        className="update-btn"
                        onClick={handleUpdateKnowledge}
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : '💾 Update'}
                      </button>
                      <button
                        className="stop-tracking-btn"
                        onClick={handleStopTracking}
                        disabled={saving}
                      >
                        🗑️ Stop Tracking
                      </button>
                    </>
                  ) : (
                    <button
                      className="start-tracking-btn large"
                      onClick={handleStartTracking}
                      disabled={saving}
                    >
                      {saving ? 'Starting...' : '➕ Start Tracking'}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeSidebar;

