import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as wanakana from 'wanakana';
import './ResourceDetail.css';

interface EntryKanji {
  kanji: string;
  is_common?: boolean;
}

interface EntryReading {
  reading: string;
  is_common?: boolean;
}

interface SenseGloss {
  gloss: string;
}

interface EntrySense {
  sense_glosses: SenseGloss[];
  parts_of_speech?: string[];
}

interface DictionaryEntry {
  id: number;
  entry_id: number;
  entry_kanji: EntryKanji[];
  entry_readings: EntryReading[];
  entry_senses: EntrySense[];
}

interface ResourceWord {
  id: number;
  entry_id: number;
  frequency: number;
  notes?: string;
  dictionary_entries: DictionaryEntry;
}

interface CustomVocabulary {
  id: number;
  word: string;
  reading?: string;
  meaning?: string;
  frequency: number;
  notes?: string;
}

interface KanjiMeaning {
  meaning: string;
}

interface ResourceKanji {
  id: number;
  kanji_id: number;
  frequency: number;
  notes?: string;
  kanji: {
    id: number;
    literal: string;
    meanings: string[];
    on_readings: string[] | null;
    kun_readings: string[] | null;
    stroke_count: number | null;
    grade: number | null;
    kanji_meanings: KanjiMeaning[];
  };
}

interface Resource {
  id: number;
  name: string;
  type: string;
  status: string;
  description?: string;
  image_path?: string;
  difficulty_level?: string;
  tags: string[];
  resource_words: ResourceWord[];
  custom_vocabulary: CustomVocabulary[];
  resource_kanji: ResourceKanji[];
}

interface SearchWordResult {
  id: number;
  entry_id: number;
  kanji_forms: string[];
  readings: string[];
  glosses: string[];
  parts_of_speech: string[];
  is_common: boolean;
  frequency_score: number;
}

const ResourceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [wordSearchQuery, setWordSearchQuery] = useState('');
  const [wordSearchResults, setWordSearchResults] = useState<SearchWordResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [wordSearchMode, setWordSearchMode] = useState<'auto' | 'english' | 'japanese'>('auto');

  // Custom vocabulary state
  const [customWord, setCustomWord] = useState('');
  const [customMeaning, setCustomMeaning] = useState('');
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'dictionary' | 'custom' | 'kanji'>('dictionary');

  useEffect(() => {
    if (token && id) {
      fetchResource();
    }
  }, [token, id]);

  // Real-time word search with debouncing
  useEffect(() => {
    if (!token) {
      return;
    }

    if (!wordSearchQuery.trim()) {
      setWordSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchWords();
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [wordSearchQuery, token]);

  const fetchResource = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/resources/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch resource');
      }

      const data = await response.json();
      setResource(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const searchWords = async () => {
    if (!wordSearchQuery.trim()) return;

    try {
      setSearchLoading(true);
      
      let searchTerm = wordSearchQuery;
      
      // Apply conversion based on search mode
      if (wordSearchMode === 'japanese') {
        // Convert romaji to hiragana for Japanese reading search
        searchTerm = wanakana.toHiragana(wordSearchQuery);
      } else if (wordSearchMode === 'english') {
        // Use as-is for English meaning search
        searchTerm = wordSearchQuery;
      } else {
        // Auto mode: detect and convert if it's romaji
        const searchHiragana = wanakana.toHiragana(wordSearchQuery);
        const isRomaji = searchHiragana !== wordSearchQuery;
        searchTerm = isRomaji ? searchHiragana : wordSearchQuery;
      }
      
      const response = await fetch(`http://localhost:3001/api/words?search=${encodeURIComponent(searchTerm)}&limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to search words');
      }

      const data = await response.json();
      setWordSearchResults(data.words || []);
    } catch (err) {
      console.error('Error searching words:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const addWord = async (entryId: number) => {
    try {
      // Check if word already exists in the resource
      const existingWord = resource?.resource_words.find(rw => rw.entry_id === entryId);
      
      if (existingWord) {
        // Word exists, increment frequency by 1
        const response = await fetch(`http://localhost:3001/api/resources/${id}/words/${entryId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ frequency: existingWord.frequency + 1 })
        });

        if (!response.ok) {
          throw new Error('Failed to update word frequency');
        }
      } else {
        // Word doesn't exist, add it with frequency 1
        const response = await fetch(`http://localhost:3001/api/resources/${id}/words`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            entry_id: entryId,
            frequency: 1
          })
        });

        if (!response.ok) {
          throw new Error('Failed to add word');
        }
      }

      // Refresh resource data
      fetchResource();
      setWordSearchQuery('');
      setWordSearchResults([]);
    } catch (err) {
      console.error('Error adding word:', err);
    }
  };

  const removeWord = async (entryId: number) => {
    if (!window.confirm('Remove this word from the resource?')) return;

    try {
      const response = await fetch(`http://localhost:3001/api/resources/${id}/words/${entryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to remove word');
      }

      fetchResource();
    } catch (err) {
      console.error('Error removing word:', err);
    }
  };

  const updateWordFrequency = async (entryId: number, newFrequency: number) => {
    try {
      const response = await fetch(`http://localhost:3001/api/resources/${id}/words/${entryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ frequency: newFrequency })
      });

      if (!response.ok) {
        throw new Error('Failed to update word frequency');
      }

      fetchResource();
    } catch (err) {
      console.error('Error updating word frequency:', err);
    }
  };

  const formatLabel = (text: string): string => {
    return text
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const addCustomWord = async () => {
    if (!customWord.trim()) return;

    try {
      const response = await fetch(`http://localhost:3001/api/resources/${id}/custom-words`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          word: customWord,
          meaning: customMeaning || null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add custom word');
      }

      // Refresh resource data
      fetchResource();
      setCustomWord('');
      setCustomMeaning('');
    } catch (err) {
      console.error('Error adding custom word:', err);
    }
  };

  const updateCustomWordFrequency = async (wordId: number, newFrequency: number) => {
    try {
      const response = await fetch(`http://localhost:3001/api/resources/${id}/custom-words/${wordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ frequency: newFrequency })
      });

      if (!response.ok) {
        throw new Error('Failed to update custom word frequency');
      }

      fetchResource();
    } catch (err) {
      console.error('Error updating custom word frequency:', err);
    }
  };

  const removeCustomWord = async (wordId: number) => {
    if (!window.confirm('Remove this custom word from the resource?')) return;

    try {
      const response = await fetch(`http://localhost:3001/api/resources/${id}/custom-words/${wordId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to remove custom word');
      }

      fetchResource();
    } catch (err) {
      console.error('Error removing custom word:', err);
    }
  };

  if (loading) {
    return <div className="loading">Loading resource...</div>;
  }

  if (error || !resource) {
    return (
      <div className="error-message">
        <p>{error || 'Resource not found'}</p>
        <Link to="/resources">Back to Resources</Link>
      </div>
    );
  }

  return (
    <div className="resource-detail-page">
      <button onClick={() => navigate('/resources')} className="back-button">
        ← Back to Resources
      </button>

      <div className="resource-header-section">
        {resource.image_path && (
          <img 
            src={`http://localhost:3001${resource.image_path}`} 
            alt={resource.name}
            className="resource-header-image"
          />
        )}
        <h1 className="resource-title">{resource.name}</h1>
        <div className="resource-tags">
          <span className="resource-tag type-tag">{formatLabel(resource.type)}</span>
          <span className="resource-tag status-tag">{formatLabel(resource.status)}</span>
          {resource.difficulty_level && (
            <span className="resource-tag difficulty-tag">{formatLabel(resource.difficulty_level)}</span>
          )}
        </div>
      </div>

      <div className="training-banners">
      {resource.resource_kanji && resource.resource_kanji.length > 0 && (
          <div className="training-banner" onClick={() => navigate(`/resources/${id}/train/kanji`)}>
          <div className="training-banner-content">
              <div className="training-icon">✍️</div>
            <div className="training-text">
                <h2>Kanji Recall</h2>
              <p>Practice drawing {resource.resource_kanji.length} kanji from this resource</p>
            </div>
            <div className="training-cta">
              <span>START TRAINING</span>
              <span className="arrow">→</span>
            </div>
          </div>
        </div>
      )}

        {resource.resource_words && resource.resource_words.length > 0 && (
          <div className="training-banner speech-banner" onClick={() => navigate(`/resources/${id}/train/speech`)}>
            <div className="training-banner-content">
              <div className="training-icon">🗣️</div>
              <div className="training-text">
                <h2>Speech Practice</h2>
                <p>Practice pronunciation of {resource.resource_words.length} words from this resource</p>
              </div>
              <div className="training-cta">
                <span>START TRAINING</span>
                <span className="arrow">→</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {(resource.description || (resource.tags && resource.tags.length > 0)) && (
        <div className="resource-info">
          {resource.description && (
            <div className="info-item full-width">
              <strong>Description:</strong> {resource.description}
            </div>
          )}
          {resource.tags && resource.tags.length > 0 && (
            <div className="info-item full-width">
              <strong>Tags:</strong> {resource.tags.join(', ')}
            </div>
          )}
        </div>
      )}

      <div className="vocabulary-section">
        <div className="tabs-container">
          <button
            className={`tab-button ${activeTab === 'dictionary' ? 'active' : ''}`}
            onClick={() => setActiveTab('dictionary')}
          >
            Dictionary Words ({resource.resource_words.length})
          </button>
          <button
            className={`tab-button ${activeTab === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            Custom Words ({resource.custom_vocabulary.length})
          </button>
          <button
            className={`tab-button ${activeTab === 'kanji' ? 'active' : ''}`}
            onClick={() => setActiveTab('kanji')}
          >
            Kanji ({resource.resource_kanji.length})
          </button>
        </div>

        {activeTab === 'dictionary' && (
          <>
            <div className="search-panel">
              <label className="search-label">Search for Word</label>
              <div className="search-mode-toggle">
                <button 
                  className={`mode-button ${wordSearchMode === 'auto' ? 'active' : ''}`}
                  onClick={() => setWordSearchMode('auto')}
                >
                  Auto
                </button>
                <button 
                  className={`mode-button ${wordSearchMode === 'japanese' ? 'active' : ''}`}
                  onClick={() => setWordSearchMode('japanese')}
                >
                  Japanese (romaji/kana)
                </button>
                <button 
                  className={`mode-button ${wordSearchMode === 'english' ? 'active' : ''}`}
                  onClick={() => setWordSearchMode('english')}
                >
                  English
                </button>
              </div>
              <div className="search-input-group">
                <input
                  type="text"
                  placeholder={
                    wordSearchMode === 'japanese' 
                      ? 'Search by Japanese reading (e.g., sekai, せかい)...'
                      : wordSearchMode === 'english'
                      ? 'Search by English meaning (e.g., world)...'
                      : 'Search words...'
                  }
                  value={wordSearchQuery}
                  onChange={(e) => setWordSearchQuery(e.target.value)}
                />
                {searchLoading && <span className="search-loading">Searching...</span>}
              </div>

              {wordSearchResults.length > 0 && (
                <div className="search-results">
                  {wordSearchResults.map((word) => (
                    <div key={word.id} className="search-result-item">
                      <div className="result-content">
                        <div className="word-forms">
                          {word.kanji_forms && word.kanji_forms.length > 0 && (
                            <span className="kanji-forms">{word.kanji_forms.join(', ')}</span>
                          )}
                          <span className="readings">{word.readings?.join(', ') || 'No readings'}</span>
                        </div>
                        <span className="glosses">{word.glosses?.slice(0, 3).join('; ') || 'No definition'}</span>
                      </div>
                      <div className="result-actions">
                        <button onClick={() => addWord(word.id)} className="add-button">
                          Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="vocabulary-list">
              {resource.resource_words.map((rw) => {
                const entry = rw.dictionary_entries;
                const kanjiForm = entry.entry_kanji?.[0]?.kanji || '';
                const reading = entry.entry_readings?.[0]?.reading || '';
                const glosses = entry.entry_senses?.[0]?.sense_glosses?.slice(0, 3).map(g => g.gloss).join('; ') || '';
                
                return (
                  <div key={rw.id} className="vocabulary-card">
                    <div className="vocab-main">
                      <div className="vocab-details">
                        <div className="word-forms">
                          {kanjiForm && <span className="kanji-forms">{kanjiForm}</span>}
                          {reading && <span className="readings">{reading}</span>}
                        </div>
                        {glosses && <div className="glosses">{glosses}</div>}
                        {!kanjiForm && !reading && (
                          <div className="word-entry-id">Entry ID: {rw.entry_id} (dictionary data not loaded)</div>
                        )}
                        {rw.notes && <div className="notes">{rw.notes}</div>}
                      </div>
                    </div>
                    <div className="vocab-meta">
                      <input
                        type="number"
                        min="0"
                        value={rw.frequency}
                        onChange={(e) => updateWordFrequency(rw.entry_id, parseInt(e.target.value) || 0)}
                        className="frequency-input"
                        title="Frequency"
                      />
                      <button 
                        onClick={() => removeWord(rw.entry_id)} 
                        className="remove-button"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
              {resource.resource_words.length === 0 && (
                <p className="empty-message">No dictionary words added yet.</p>
              )}
            </div>
          </>
        )}

        {activeTab === 'custom' && (
          <>
            <div className="custom-word-form">
              <label className="search-label">Add Custom Word</label>
              <div className="custom-inputs">
                <input
                  type="text"
                  placeholder="Katakana (e.g., ゲーム, マリオ)"
                  value={customWord}
                  onChange={(e) => setCustomWord(e.target.value)}
                  className="custom-input"
                />
                <input
                  type="text"
                  placeholder="Meaning (e.g., game, Mario)"
                  value={customMeaning}
                  onChange={(e) => setCustomMeaning(e.target.value)}
                  className="custom-input"
                />
                <button onClick={addCustomWord} className="add-button" disabled={!customWord.trim()}>
                  Add
                </button>
              </div>
            </div>

            <div className="vocabulary-list">
              {resource.custom_vocabulary.map((cv) => (
                <div key={cv.id} className="vocabulary-card">
                  <div className="vocab-main">
                    <div className="vocab-details">
                      <div className="word-forms">
                        <span className="kanji-forms">{cv.word}</span>
                      </div>
                      {cv.meaning && <div className="glosses">{cv.meaning}</div>}
                      {cv.notes && <div className="notes">{cv.notes}</div>}
                    </div>
                  </div>
                  <div className="vocab-meta">
                    <input
                      type="number"
                      min="0"
                      value={cv.frequency}
                      onChange={(e) => updateCustomWordFrequency(cv.id, parseInt(e.target.value) || 0)}
                      className="frequency-input"
                      title="Frequency"
                    />
                    <button 
                      onClick={() => removeCustomWord(cv.id)} 
                      className="remove-button"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
              {resource.custom_vocabulary.length === 0 && (
                <p className="empty-message">No custom words added yet.</p>
              )}
            </div>
          </>
        )}

        {activeTab === 'kanji' && (
          <div className="kanji-list">
            <div className="kanji-description">
              <p>Kanji characters that appear in the words for this resource, sorted by frequency.</p>
            </div>
            
            <div className="kanji-grid">
              {resource.resource_kanji.map((rk) => (
                <div key={rk.id} className="kanji-card">
                  <div className="kanji-character">{rk.kanji.literal}</div>
                  <div className="kanji-info">
                    <div className="kanji-meanings">
                      {rk.kanji.kanji_meanings?.slice(0, 3).map(m => m.meaning).join(', ')}
                    </div>
                    {rk.kanji.on_readings && rk.kanji.on_readings.length > 0 && (
                      <div className="kanji-readings">
                        <span className="reading-label">On:</span> {rk.kanji.on_readings.slice(0, 2).join('、')}
                      </div>
                    )}
                    {rk.kanji.kun_readings && rk.kanji.kun_readings.length > 0 && (
                      <div className="kanji-readings">
                        <span className="reading-label">Kun:</span> {rk.kanji.kun_readings.slice(0, 2).join('、')}
                      </div>
                    )}
                    <div className="kanji-meta">
                      {rk.kanji.grade && <span className="meta-tag">Grade {rk.kanji.grade}</span>}
                      {rk.kanji.stroke_count && <span className="meta-tag">{rk.kanji.stroke_count} strokes</span>}
                      <span className="frequency-badge">{rk.frequency}x</span>
                    </div>
                  </div>
                </div>
              ))}
              {resource.resource_kanji.length === 0 && (
                <p className="empty-message">No kanji data yet. Kanji are automatically extracted from dictionary words you add.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResourceDetail;

