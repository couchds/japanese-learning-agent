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
  const [showWordSearch, setShowWordSearch] = useState(false);
  const [wordSearchQuery, setWordSearchQuery] = useState('');
  const [wordSearchResults, setWordSearchResults] = useState<SearchWordResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [wordSearchMode, setWordSearchMode] = useState<'auto' | 'english' | 'japanese'>('auto');

  // Frequency input state
  const [frequencyInputs, setFrequencyInputs] = useState<Record<string, number>>({});

  useEffect(() => {
    if (token && id) {
      fetchResource();
    }
  }, [token, id]);

  // Real-time word search with debouncing
  useEffect(() => {
    if (!showWordSearch || !token) {
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
  }, [wordSearchQuery, showWordSearch, token]);

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
            <p className="empty-message">No words added yet. Click "+ Add Word" to get started!</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResourceDetail;

