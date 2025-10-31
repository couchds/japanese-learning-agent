import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './ResourceDetail.css';

interface KanjiMeaning {
  meaning: string;
}

interface Kanji {
  id: number;
  literal: string;
  kanji_meanings: KanjiMeaning[];
  on_readings: string[];
  kun_readings: string[];
  grade?: number;
  jlpt_level?: number;
  frequency_rank?: number;
}

interface ResourceKanji {
  id: number;
  kanji_id: number;
  frequency: number;
  notes?: string;
  kanji: Kanji;
}

interface DictionaryEntry {
  id: number;
  entry_id: number;
}

interface ResourceWord {
  id: number;
  entry_id: number;
  frequency: number;
  notes?: string;
  dictionary_entries: DictionaryEntry;
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
  resource_kanji: ResourceKanji[];
  resource_words: ResourceWord[];
}

interface SearchKanjiResult {
  id: number;
  literal: string;
  meanings: string[];
  on_readings: string[];
  kun_readings: string[];
}

interface SearchWordResult {
  id: number;
  entry_id: number;
  kanji_forms: string[];
  readings: string[];
  glosses: string[];
  parts_of_speech: string[];
}

const ResourceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [showKanjiSearch, setShowKanjiSearch] = useState(false);
  const [showWordSearch, setShowWordSearch] = useState(false);
  const [kanjiSearchQuery, setKanjiSearchQuery] = useState('');
  const [wordSearchQuery, setWordSearchQuery] = useState('');
  const [kanjiSearchResults, setKanjiSearchResults] = useState<SearchKanjiResult[]>([]);
  const [wordSearchResults, setWordSearchResults] = useState<SearchWordResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Frequency input state
  const [frequencyInputs, setFrequencyInputs] = useState<Record<string, number>>({});

  useEffect(() => {
    if (token && id) {
      fetchResource();
    }
  }, [token, id]);

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

  const searchKanji = async () => {
    if (!kanjiSearchQuery.trim()) return;

    try {
      setSearchLoading(true);
      const response = await fetch(`http://localhost:3001/api/kanji?search=${encodeURIComponent(kanjiSearchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to search kanji');
      }

      const data = await response.json();
      setKanjiSearchResults(data.kanji || []);
    } catch (err) {
      console.error('Error searching kanji:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const searchWords = async () => {
    if (!wordSearchQuery.trim()) return;

    try {
      setSearchLoading(true);
      const response = await fetch(`http://localhost:3001/api/words?search=${encodeURIComponent(wordSearchQuery)}&limit=20`, {
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

  const addKanji = async (kanjiId: number) => {
    const frequency = frequencyInputs[`kanji-${kanjiId}`] || 1;

    try {
      const response = await fetch(`http://localhost:3001/api/resources/${id}/kanji`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          kanji_id: kanjiId,
          frequency: frequency
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add kanji');
      }

      // Refresh resource data
      fetchResource();
      setShowKanjiSearch(false);
      setKanjiSearchQuery('');
      setKanjiSearchResults([]);
      setFrequencyInputs({});
    } catch (err) {
      console.error('Error adding kanji:', err);
    }
  };

  const addWord = async (entryId: number) => {
    const frequency = frequencyInputs[`word-${entryId}`] || 1;

    try {
      const response = await fetch(`http://localhost:3001/api/resources/${id}/words`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          entry_id: entryId,
          frequency: frequency
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add word');
      }

      // Refresh resource data
      fetchResource();
      setShowWordSearch(false);
      setWordSearchQuery('');
      setWordSearchResults([]);
      setFrequencyInputs({});
    } catch (err) {
      console.error('Error adding word:', err);
    }
  };

  const removeKanji = async (kanjiId: number) => {
    if (!window.confirm('Remove this kanji from the resource?')) return;

    try {
      const response = await fetch(`http://localhost:3001/api/resources/${id}/kanji/${kanjiId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to remove kanji');
      }

      fetchResource();
    } catch (err) {
      console.error('Error removing kanji:', err);
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

  const updateKanjiFrequency = async (resourceKanjiId: number, kanjiId: number, newFrequency: number) => {
    try {
      const response = await fetch(`http://localhost:3001/api/resources/${id}/kanji/${kanjiId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ frequency: newFrequency })
      });

      if (!response.ok) {
        throw new Error('Failed to update kanji frequency');
      }

      fetchResource();
    } catch (err) {
      console.error('Error updating kanji frequency:', err);
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
      <div className="detail-header">
        <button onClick={() => navigate('/resources')} className="back-button">
          ← Back to Resources
        </button>
        <h1>{resource.name}</h1>
      </div>

      <div className="resource-info">
        {resource.image_path && (
          <img 
            src={`http://localhost:3001${resource.image_path}`} 
            alt={resource.name}
            className="resource-detail-image"
          />
        )}
        <div className="info-grid">
          <div className="info-item">
            <strong>Type:</strong> {resource.type}
          </div>
          <div className="info-item">
            <strong>Status:</strong> {resource.status}
          </div>
          {resource.difficulty_level && (
            <div className="info-item">
              <strong>Difficulty:</strong> {resource.difficulty_level}
            </div>
          )}
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
      </div>

      <div className="vocabulary-section">
        <div className="section-header">
          <h2>Kanji ({resource.resource_kanji.length})</h2>
          <button 
            onClick={() => setShowKanjiSearch(!showKanjiSearch)}
            className="add-vocab-button"
          >
            {showKanjiSearch ? 'Cancel' : '+ Add Kanji'}
          </button>
        </div>

        {showKanjiSearch && (
          <div className="search-panel">
            <div className="search-input-group">
              <input
                type="text"
                placeholder="Search kanji by character or meaning..."
                value={kanjiSearchQuery}
                onChange={(e) => setKanjiSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchKanji()}
              />
              <button onClick={searchKanji} disabled={searchLoading}>
                {searchLoading ? 'Searching...' : 'Search'}
              </button>
            </div>

            {kanjiSearchResults.length > 0 && (
              <div className="search-results">
                {kanjiSearchResults.map((kanji) => (
                  <div key={kanji.id} className="search-result-item">
                    <div className="result-content">
                      <span className="kanji-literal">{kanji.literal}</span>
                      <span className="kanji-meanings">{kanji.meanings.join(', ')}</span>
                      <span className="kanji-readings">
                        {kanji.on_readings.length > 0 && `On: ${kanji.on_readings.join(', ')}`}
                        {kanji.kun_readings.length > 0 && ` | Kun: ${kanji.kun_readings.join(', ')}`}
                      </span>
                    </div>
                    <div className="result-actions">
                      <input
                        type="number"
                        min="0"
                        placeholder="Freq"
                        value={frequencyInputs[`kanji-${kanji.id}`] || ''}
                        onChange={(e) => setFrequencyInputs({
                          ...frequencyInputs,
                          [`kanji-${kanji.id}`]: parseInt(e.target.value) || 0
                        })}
                        className="frequency-input"
                      />
                      <button onClick={() => addKanji(kanji.id)} className="add-button">
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="vocabulary-list">
          {resource.resource_kanji.map((rk) => (
            <div key={rk.id} className="vocabulary-card">
              <div className="vocab-main">
                <span className="kanji-literal-large">{rk.kanji.literal}</span>
                <div className="vocab-details">
                  <div className="meanings">
                    {rk.kanji.kanji_meanings?.map((m: KanjiMeaning) => m.meaning).join(', ') || 'No meanings'}
                  </div>
                  <div className="readings">
                    {rk.kanji.on_readings.length > 0 && (
                      <span>On: {rk.kanji.on_readings.join(', ')}</span>
                    )}
                    {rk.kanji.kun_readings.length > 0 && (
                      <span>Kun: {rk.kanji.kun_readings.join(', ')}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="vocab-meta">
                <input
                  type="number"
                  min="0"
                  value={rk.frequency}
                  onChange={(e) => updateKanjiFrequency(rk.id, rk.kanji_id, parseInt(e.target.value) || 0)}
                  className="frequency-input"
                  title="Frequency"
                />
                <button 
                  onClick={() => removeKanji(rk.kanji_id)} 
                  className="remove-button"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          {resource.resource_kanji.length === 0 && (
            <p className="empty-message">No kanji added yet. Click "+ Add Kanji" to get started!</p>
          )}
        </div>
      </div>

      <div className="vocabulary-section">
        <div className="section-header">
          <h2>Words ({resource.resource_words.length})</h2>
          <button 
            onClick={() => setShowWordSearch(!showWordSearch)}
            className="add-vocab-button"
          >
            {showWordSearch ? 'Cancel' : '+ Add Word'}
          </button>
        </div>

        {showWordSearch && (
          <div className="search-panel">
            <div className="search-input-group">
              <input
                type="text"
                placeholder="Search words..."
                value={wordSearchQuery}
                onChange={(e) => setWordSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchWords()}
              />
              <button onClick={searchWords} disabled={searchLoading}>
                {searchLoading ? 'Searching...' : 'Search'}
              </button>
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
                        <span className="readings">{word.readings.join(', ')}</span>
                      </div>
                      <span className="glosses">{word.glosses.slice(0, 3).join('; ')}</span>
                    </div>
                    <div className="result-actions">
                      <input
                        type="number"
                        min="0"
                        placeholder="Freq"
                        value={frequencyInputs[`word-${word.id}`] || ''}
                        onChange={(e) => setFrequencyInputs({
                          ...frequencyInputs,
                          [`word-${word.id}`]: parseInt(e.target.value) || 0
                        })}
                        className="frequency-input"
                      />
                      <button onClick={() => addWord(word.id)} className="add-button">
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="vocabulary-list">
          {resource.resource_words.map((rw) => (
            <div key={rw.id} className="vocabulary-card">
              <div className="vocab-main">
                <div className="vocab-details">
                  <div className="word-entry-id">Entry ID: {rw.entry_id}</div>
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
          ))}
          {resource.resource_words.length === 0 && (
            <p className="empty-message">No words added yet. Click "+ Add Word" to get started!</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResourceDetail;

