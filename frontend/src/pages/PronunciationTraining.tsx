import React, { useState, useEffect, useRef } from 'react';
import * as wanakana from 'wanakana';
import { useAuth } from '../context/AuthContext';
import './PronunciationTraining.css';

interface WordData {
  id: number;
  entry_id: number;
  kanji_forms: string[] | null;
  readings: string[] | null;
  glosses: string[] | null;
}

interface Recording {
  id: number;
  entry_id: number;
  audio_path: string;
  is_reference: boolean;
  duration_ms: number | null;
  notes: string | null;
  created_at: string;
}

const PronunciationTraining: React.FC = () => {
  const { token } = useAuth();
  const [words, setWords] = useState<WordData[]>([]);
  const [selectedWord, setSelectedWord] = useState<WordData | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (token) {
      fetchWords();
    }
  }, [token]);

  useEffect(() => {
    if (selectedWord && token) {
      fetchRecordings(selectedWord.id);
    }
  }, [selectedWord, token]);

  const fetchWords = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/words?limit=2000&in_resources=true`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch words');
      }
      const data = await response.json();
      setWords(data.words);
    } catch (err) {
      console.error('Error fetching words:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecordings = async (entryId: number) => {
    try {
      const response = await fetch(`http://localhost:3001/api/pronunciations?entry_id=${entryId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch recordings');
      }
      const data = await response.json();
      setRecordings(data.recordings);
    } catch (err) {
      console.error('Error fetching recordings:', err);
    }
  };

  const filteredWords = words.filter((w) => {
    const searchLower = searchTerm.toLowerCase();
    const searchHiragana = wanakana.toHiragana(searchTerm);
    const searchKatakana = wanakana.toKatakana(searchTerm);
    
    return (
      w.kanji_forms?.some((k) => k.includes(searchTerm)) ||
      w.readings?.some((r) => 
        r.includes(searchTerm) || 
        r.includes(searchHiragana) || 
        r.includes(searchKatakana)
      ) ||
      w.glosses?.some((g) => g.toLowerCase().includes(searchLower))
    );
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error starting recording:', err);
      alert('Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const uploadRecording = async (isReference: boolean) => {
    if (!audioURL || !selectedWord) return;

    try {
      const audioBlob = await fetch(audioURL).then(r => r.blob());
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('entry_id', selectedWord.id.toString());
      formData.append('is_reference', isReference.toString());

      const response = await fetch('http://localhost:3001/api/pronunciations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload recording');
      }

      // Refresh recordings and clear the current recording
      await fetchRecordings(selectedWord.id);
      setAudioURL(null);
      alert(isReference ? 'Reference recording saved!' : 'Practice recording saved!');
    } catch (err) {
      console.error('Error uploading recording:', err);
      alert('Failed to upload recording');
    }
  };

  const deleteRecording = async (recordingId: number) => {
    if (!window.confirm('Are you sure you want to delete this recording?')) return;

    try {
      const response = await fetch(`http://localhost:3001/api/pronunciations/${recordingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete recording');
      }

      if (selectedWord) {
        await fetchRecordings(selectedWord.id);
      }
    } catch (err) {
      console.error('Error deleting recording:', err);
      alert('Failed to delete recording');
    }
  };

  const toggleReference = async (recording: Recording) => {
    try {
      const response = await fetch(`http://localhost:3001/api/pronunciations/${recording.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_reference: !recording.is_reference })
      });

      if (!response.ok) {
        throw new Error('Failed to update recording');
      }

      if (selectedWord) {
        await fetchRecordings(selectedWord.id);
      }
    } catch (err) {
      console.error('Error updating recording:', err);
      alert('Failed to update recording');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (words.length === 0) {
    return (
      <div className="pronunciation-training-page">
        <h1>Pronunciation Training</h1>
        <p className="subtitle">Record and manage pronunciation data for words from your resources</p>
        <div className="no-words-message">
          <h2>No words found in your resources</h2>
          <p>To get started:</p>
          <ol>
            <li>Go to the <a href="/resources">Resources</a> page</li>
            <li>Create a resource (e.g., "Dragon Quest III", "Naruto Volume 1")</li>
            <li>Add words from the Word Dictionary to your resource</li>
            <li>Come back here to practice pronunciation!</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="pronunciation-training-page">
      <h1>Pronunciation Training</h1>
      <p className="subtitle">Record and manage pronunciation data for words from your resources</p>

      <div className="training-container">
        {/* Left panel: Word search */}
        <div className="word-search-panel">
          <h2>Search Words</h2>
          <input
            type="text"
            placeholder="Search by kanji, reading, or meaning..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          
          <div className="word-list">
            {filteredWords.slice(0, 50).map((word) => (
              <div
                key={word.id}
                className={`word-item ${selectedWord?.id === word.id ? 'selected' : ''}`}
                onClick={() => setSelectedWord(word)}
              >
                <div className="word-kanji">
                  {word.kanji_forms?.[0] || word.readings?.[0] || '-'}
                </div>
                <div className="word-reading">
                  {word.readings?.[0] || '-'}
                </div>
                <div className="word-meaning">
                  {word.glosses?.[0] || '-'}
                </div>
              </div>
            ))}
            {filteredWords.length === 0 && (
              <div className="no-results">No words found</div>
            )}
            {filteredWords.length > 50 && (
              <div className="more-results">
                Showing first 50 of {filteredWords.length} results. Refine your search.
              </div>
            )}
          </div>
        </div>

        {/* Right panel: Recording interface */}
        <div className="recording-panel">
          {selectedWord ? (
            <>
              <div className="selected-word-info">
                <h2>
                  {selectedWord.kanji_forms?.[0] || selectedWord.readings?.[0]}
                </h2>
                <div className="word-details">
                  <div><strong>Reading:</strong> {selectedWord.readings?.join('、') || '-'}</div>
                  <div><strong>Meaning:</strong> {selectedWord.glosses?.join('; ') || '-'}</div>
                </div>
              </div>

              {/* New recording controls */}
              <div className="recording-controls">
                <h3>New Recording</h3>
                {!audioURL ? (
                  <div className="record-buttons">
                    {!isRecording ? (
                      <button onClick={startRecording} className="btn-record">
                        Start Recording
                      </button>
                    ) : (
                      <button onClick={stopRecording} className="btn-stop">
                        Stop Recording
                      </button>
                    )}
                    {isRecording && <div className="recording-indicator">● Recording...</div>}
                  </div>
                ) : (
                  <div className="recording-preview">
                    <audio src={audioURL} controls />
                    <div className="preview-buttons">
                      <button onClick={() => uploadRecording(true)} className="btn-save-reference">
                        Save as Reference
                      </button>
                      <button onClick={() => uploadRecording(false)} className="btn-save-practice">
                        Save as Practice
                      </button>
                      <button onClick={() => setAudioURL(null)} className="btn-discard">
                        Discard
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Existing recordings */}
              <div className="recordings-list">
                <h3>Recordings ({recordings.length})</h3>
                {recordings.length === 0 ? (
                  <div className="no-recordings">No recordings yet. Start by recording a reference pronunciation!</div>
                ) : (
                  recordings.map((recording) => (
                    <div key={recording.id} className={`recording-item ${recording.is_reference ? 'reference' : ''}`}>
                      <div className="recording-info">
                        <div className="recording-label">
                          {recording.is_reference && <span className="reference-badge">Reference</span>}
                          {!recording.is_reference && <span className="practice-badge">Practice</span>}
                          <span className="recording-date">
                            {new Date(recording.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <audio src={`http://localhost:3001${recording.audio_path}`} controls />
                      </div>
                      <div className="recording-actions">
                        <button
                          onClick={() => toggleReference(recording)}
                          className="btn-toggle"
                          title={recording.is_reference ? 'Mark as practice' : 'Mark as reference'}
                        >
                          {recording.is_reference ? '📌' : '📍'}
                        </button>
                        <button
                          onClick={() => deleteRecording(recording.id)}
                          className="btn-delete"
                          title="Delete recording"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="no-word-selected">
              <p>Select a word from the left to start recording</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PronunciationTraining;

