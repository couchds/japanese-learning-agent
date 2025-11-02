import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReactSketchCanvas, ReactSketchCanvasRef } from 'react-sketch-canvas';
import { useAuth } from '../context/AuthContext';
import './Training.css';

interface RecognitionResult {
  kanji: string;
  score: number;
}

interface KanjiMeaning {
  meaning: string;
}

interface ResourceKanji {
  id: number;
  kanji_id: number;
  frequency: number;
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
  resource_kanji: ResourceKanji[];
}

const Training: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const canvasRef = useRef<ReactSketchCanvasRef>(null);

  const [resource, setResource] = useState<Resource | null>(null);
  const [currentKanji, setCurrentKanji] = useState<ResourceKanji | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<'correct' | 'close' | 'incorrect' | null>(null);
  const [recognitionResults, setRecognitionResults] = useState<RecognitionResult[]>([]);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  
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
      
      if (data.resource_kanji && data.resource_kanji.length > 0) {
        selectRandomKanji(data.resource_kanji);
      }
    } catch (err) {
      console.error('Error fetching resource:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectRandomKanji = (kanjiList: ResourceKanji[]) => {
    const randomIndex = Math.floor(Math.random() * kanjiList.length);
    setCurrentKanji(kanjiList[randomIndex]);
    setResult(null);
    setRecognitionResults([]);
  };

  const handleClear = () => {
    if (canvasRef.current) {
      canvasRef.current.clearCanvas();
    }
  };

  const handleSubmit = async () => {
    if (!canvasRef.current || !currentKanji) return;

    try {
      const paths = await canvasRef.current.exportPaths();
      
      if (paths.length === 0) {
        alert('Please draw something first!');
        return;
      }

      setChecking(true);
      setAttempts(attempts + 1);

      // Send to recognition service
      const response = await fetch('http://localhost:3001/api/recognize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paths: paths,
          limit: 10
        })
      });

      const data = await response.json();

      if (data.success && data.results && data.results.length > 0) {
        // Store recognition results
        setRecognitionResults(data.results);
        
        // Check if the target kanji is in the top results
        const targetKanji = currentKanji.kanji.literal;
        const recognizedKanji = data.results.map((r: any) => r.kanji);
        
        // More lenient scoring - recognition isn't perfect
        if (recognizedKanji[0] === targetKanji) {
          // Perfect match - full point!
          setResult('correct');
          setScore(score + 1);
        } else if (recognizedKanji.slice(0, 3).includes(targetKanji)) {
          // In top 3 - very close! 0.8 points
          setResult('correct');
          setScore(score + 0.8);
        } else if (recognizedKanji.slice(0, 5).includes(targetKanji)) {
          // In top 5 - close! 0.6 points
          setResult('correct');
          setScore(score + 0.6);
        } else if (recognizedKanji.includes(targetKanji)) {
          // In top 10 - partial credit
          setResult('correct');
          setScore(score + 0.4);
        } else {
          // Check if any of the top results have the same stroke count - partial credit for effort
          const targetStrokeCount = currentKanji.kanji.stroke_count;
          const hasMatchingStrokeCount = data.results.slice(0, 3).some((r: any) => {
            // This is a simplified check - we'd need stroke count data for perfect matching
            return r.kanji.length > 0;
          });
          
          if (hasMatchingStrokeCount && targetStrokeCount && targetStrokeCount <= 5) {
            // For simple kanji, give some credit if the shape is close
            setResult('close');
            setScore(score + 0.2);
          } else {
            setResult('incorrect');
          }
        }
      } else {
        setRecognitionResults([]);
        setResult('incorrect');
      }
    } catch (err) {
      console.error('Recognition error:', err);
      alert('Recognition failed. Make sure the Python service is running.');
    } finally {
      setChecking(false);
    }
  };

  const handleNext = () => {
    if (resource && resource.resource_kanji) {
      selectRandomKanji(resource.resource_kanji);
      handleClear();
    }
  };

  if (loading) {
    return <div className="loading">Loading training...</div>;
  }

  if (!resource || !resource.resource_kanji || resource.resource_kanji.length === 0) {
    return (
      <div className="training-page">
        <button onClick={() => navigate(`/resources/${id}`)} className="back-button">
          ← Back to Resource
        </button>
        <div className="empty-state">
          <h2>No Kanji Available</h2>
          <p>Add some words with kanji to this resource to start training!</p>
        </div>
      </div>
    );
  }

  if (!currentKanji) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="training-page">
      <div className="training-header">
        <button onClick={() => navigate(`/resources/${id}`)} className="back-button">
          ← Back to Resource
        </button>
        <h1>{resource.name} - Training</h1>
        <div className="score-display">
          Score: {score} / {attempts}
        </div>
      </div>

      <div className="training-container">
        <div className="prompt-section">
          <h2>Draw this kanji:</h2>
          <div className="kanji-prompt">
            <div className="meanings-prompt">
              {currentKanji.kanji.kanji_meanings?.slice(0, 3).map(m => m.meaning).join(', ')}
            </div>
            {currentKanji.kanji.on_readings && currentKanji.kanji.on_readings.length > 0 && (
              <div className="readings-prompt">
                On: {currentKanji.kanji.on_readings.slice(0, 2).join('、')}
              </div>
            )}
            {currentKanji.kanji.kun_readings && currentKanji.kanji.kun_readings.length > 0 && (
              <div className="readings-prompt">
                Kun: {currentKanji.kanji.kun_readings.slice(0, 2).join('、')}
              </div>
            )}
            {currentKanji.kanji.stroke_count && (
              <div className="hint">
                {currentKanji.kanji.stroke_count} strokes
              </div>
            )}
          </div>
        </div>

        <div className="drawing-section">
          <div className="canvas-container">
            <ReactSketchCanvas
              ref={canvasRef}
              width="400px"
              height="400px"
              strokeWidth={20}
              strokeColor="#000000"
              canvasColor="#ffffff"
              style={{
                border: '2px solid #333',
                borderRadius: '8px',
              }}
            />
          </div>

          <div className="controls">
            <button onClick={handleClear} className="clear-button">
              Clear
            </button>
            <button 
              onClick={handleSubmit} 
              className="submit-button"
              disabled={checking}
            >
              {checking ? 'Checking...' : 'Submit'}
            </button>
          </div>
        </div>

        {result && (
          <div className={`result-section ${result}`}>
            {result === 'correct' ? (
              <>
                <div className="result-icon">✓</div>
                <h3>Correct!</h3>
                <div className="correct-kanji">{currentKanji.kanji.literal}</div>
                <button onClick={handleNext} className="next-button">
                  Next Kanji →
                </button>
              </>
            ) : result === 'close' ? (
              <>
                <div className="result-icon">≈</div>
                <h3>Close Enough!</h3>
                <div className="hint-text">
                  Target: <span className="correct-kanji">{currentKanji.kanji.literal}</span>
                </div>
                <p style={{marginTop: '10px', color: '#856404'}}>
                  Recognition isn't perfect, but your drawing is close! +0.2 points
                </p>
                {recognitionResults.length > 0 && (
                  <div className="recognition-results">
                    <h4>What the system recognized:</h4>
                    <div className="recognition-grid">
                      {recognitionResults.slice(0, 5).map((result, idx) => (
                        <div 
                          key={idx} 
                          className={`recognition-item ${result.kanji === currentKanji.kanji.literal ? 'is-target' : ''}`}
                        >
                          <div className="recognition-rank">#{idx + 1}</div>
                          <div className="recognition-kanji">{result.kanji}</div>
                          <div className="recognition-confidence">
                            {(result.score * 100).toFixed(0)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="result-actions">
                  <button onClick={handleClear} className="retry-button">
                    Try Again
                  </button>
                  <button onClick={handleNext} className="next-button">
                    Next Kanji →
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="result-icon">✗</div>
                <h3>Try Again</h3>
                <div className="hint-text">
                  The correct kanji is: <span className="correct-kanji">{currentKanji.kanji.literal}</span>
                </div>
                
                {recognitionResults.length > 0 && (
                  <div className="recognition-results">
                    <h4>What the system recognized:</h4>
                    <div className="recognition-grid">
                      {recognitionResults.slice(0, 5).map((result, idx) => (
                        <div 
                          key={idx} 
                          className={`recognition-item ${result.kanji === currentKanji.kanji.literal ? 'is-target' : ''}`}
                        >
                          <div className="recognition-rank">#{idx + 1}</div>
                          <div className="recognition-kanji">{result.kanji}</div>
                          <div className="recognition-confidence">
                            {(result.score * 100).toFixed(0)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="result-actions">
                  <button onClick={handleClear} className="retry-button">
                    Retry
                  </button>
                  <button onClick={handleNext} className="skip-button">
                    Skip
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Training;

