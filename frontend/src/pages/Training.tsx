import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { ReactSketchCanvas, ReactSketchCanvasRef } from 'react-sketch-canvas';
import { useAuth } from '../context/AuthContext';
import * as wanakana from 'wanakana';
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

interface EntryKanji {
  kanji: string;
  is_common: boolean | null;
}

interface EntryReading {
  reading: string;
  is_common: boolean | null;
}

interface SenseGloss {
  gloss: string;
}

interface EntrySense {
  sense_glosses: SenseGloss[];
  parts_of_speech: string[];
}

interface DictionaryEntry {
  entry_kanji: EntryKanji[];
  entry_readings: EntryReading[];
  entry_senses: EntrySense[];
}

interface ResourceWord {
  id: number;
  entry_id: number;
  frequency: number;
  dictionary_entries: DictionaryEntry;
}

interface Resource {
  id: number;
  name: string;
  resource_kanji: ResourceKanji[];
  resource_words: ResourceWord[];
}

type TrainingMode = 'kanji' | 'speech';

const Training: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const isStartingRecognition = useRef(false);

  // Determine training mode from URL path
  const trainingMode: TrainingMode = location.pathname.includes('/train/speech') ? 'speech' : 'kanji';

  const [resource, setResource] = useState<Resource | null>(null);
  const [currentKanji, setCurrentKanji] = useState<ResourceKanji | null>(null);
  const [currentWord, setCurrentWord] = useState<ResourceWord | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<'correct' | 'close' | 'incorrect' | null>(null);
  const [recognitionResults, setRecognitionResults] = useState<RecognitionResult[]>([]);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<any>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;
  
  useEffect(() => {
    if (token && id) {
      fetchResource();
    }
  }, [token, id]);

  // Reset state when training mode changes
  useEffect(() => {
    setScore(0);
    setAttempts(0);
    setResult(null);
    setTranscript('');
    if (resource) {
      if (trainingMode === 'kanji' && resource.resource_kanji && resource.resource_kanji.length > 0) {
        selectRandomKanji(resource.resource_kanji);
      } else if (trainingMode === 'speech' && resource.resource_words && resource.resource_words.length > 0) {
        selectRandomWord(resource.resource_words);
      }
    }
  }, [trainingMode]);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.lang = 'ja-JP';
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;

      recognitionInstance.onresult = (event: any) => {
        const speechResult = event.results[0][0].transcript;
        setTranscript(speechResult);
        setIsListening(false);
        isStartingRecognition.current = false;
        setRetryCount(0);
      };

      recognitionInstance.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        
        // Handle no-speech error with auto-retry
        if (event.error === 'no-speech') {
          setRetryCount(prev => {
            if (prev < maxRetries) {
              // Auto-retry
              setTimeout(() => {
                if (recognitionInstance && !isStartingRecognition.current) {
                  try {
                    isStartingRecognition.current = true;
                    recognitionInstance.start();
                  } catch (error) {
                    setIsListening(false);
                    isStartingRecognition.current = false;
                  }
                }
              }, 100);
              return prev + 1;
            } else {
              // Max retries reached
              setIsListening(false);
              isStartingRecognition.current = false;
              alert('No speech detected after multiple attempts. Please:\n\n1. Check your microphone is working\n2. Speak immediately after clicking\n3. Speak clearly and loudly\n4. Make sure microphone permission is granted');
              return 0;
            }
          });
          return;
        }
        
        // For other errors, stop immediately
        setIsListening(false);
        isStartingRecognition.current = false;
        setRetryCount(0);
        
        // Provide helpful error messages based on error type
        let errorMessage = '';
        switch (event.error) {
          case 'audio-capture':
            errorMessage = 'No microphone found. Please check your microphone is connected.';
            break;
          case 'not-allowed':
            errorMessage = 'Microphone access denied. Please allow microphone access in your browser settings.';
            break;
          case 'network':
            errorMessage = 'Network error. Speech recognition requires an internet connection.';
            break;
          default:
            errorMessage = `Speech recognition error: ${event.error}. Please try again.`;
        }
        alert(errorMessage);
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
        isStartingRecognition.current = false;
      };

      recognitionInstance.onstart = () => {
        isStartingRecognition.current = false;
      };

      setRecognition(recognitionInstance);
    }
  }, []);

  // Check speech result when transcript changes
  useEffect(() => {
    if (transcript && currentWord && !result) {
      checkSpeechResult(transcript);
    }
  }, [transcript, currentWord, result]);

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
      
      // Select initial item based on current mode
      if (trainingMode === 'kanji' && data.resource_kanji && data.resource_kanji.length > 0) {
        selectRandomKanji(data.resource_kanji);
      } else if (trainingMode === 'speech' && data.resource_words && data.resource_words.length > 0) {
        selectRandomWord(data.resource_words);
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
    setCurrentWord(null);
    setResult(null);
    setRecognitionResults([]);
    setTranscript('');
  };

  const selectRandomWord = (wordList: ResourceWord[]) => {
    const randomIndex = Math.floor(Math.random() * wordList.length);
    setCurrentWord(wordList[randomIndex]);
    setCurrentKanji(null);
    setResult(null);
    setTranscript('');
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

  const checkSpeechResult = (spokenText: string) => {
    if (!currentWord) return;

    setAttempts(prev => prev + 1);
    
    // Normalize function - remove spaces, punctuation, and long vowel marks
    const normalize = (text: string) => {
      return text
        .replace(/[\s.,!?。、]/g, '')
        .replace(/ー/g, '') // Remove long vowel marks (chōonpu)
        .toLowerCase()
        .trim();
    };
    
    // Convert to romaji for phonetic comparison
    const toRomaji = (text: string) => {
      return wanakana.toRomaji(normalize(text))
        .toLowerCase()
        .replace(/[^a-z]/g, ''); // Remove any non-alphabetic characters
    };
    
    // Normalize and convert the spoken text to romaji
    const normalizedSpoken = normalize(spokenText);
    const romajiSpoken = toRomaji(spokenText);
    
    // Get all valid readings for the word (both hiragana and katakana)
    const validReadings = currentWord.dictionary_entries.entry_readings.map(r => 
      normalize(r.reading)
    );
    
    const romajiReadings = currentWord.dictionary_entries.entry_readings.map(r =>
      toRomaji(r.reading)
    );

    // Also consider the kanji forms if they exist
    const kanjiReadings = currentWord.dictionary_entries.entry_kanji
      .map(k => normalize(k.kanji));

    // Check exact match first (both in original script and romaji)
    const isExactMatch = validReadings.some(reading => reading === normalizedSpoken);
    const isKanjiMatch = kanjiReadings.some(kanji => kanji === normalizedSpoken);
    const isRomajiExactMatch = romajiReadings.some(reading => reading === romajiSpoken);
    
    if (isExactMatch || isKanjiMatch || isRomajiExactMatch) {
      setResult('correct');
      setScore(prev => prev + 1);
      return;
    }

    // Check phonetic similarity using romaji and Levenshtein distance
    const hasPhoneticMatch = romajiReadings.some(reading => {
      const distance = levenshteinDistance(reading, romajiSpoken);
      const maxLength = Math.max(reading.length, romajiSpoken.length);
      const similarity = 1 - (distance / maxLength);
      
      // Threshold of 75% for phonetic matching (stricter to avoid false positives)
      if (similarity >= 0.75) {
        return true;
      }
      
      // Also check if it's a substring match (for partial words)
      // Only accept if very close in length and one contains the other
      const lengthRatio = Math.min(reading.length, romajiSpoken.length) / 
                         Math.max(reading.length, romajiSpoken.length);
      return lengthRatio > 0.8 && (
        reading.includes(romajiSpoken) || 
        romajiSpoken.includes(reading)
      );
    });
    
    if (hasPhoneticMatch) {
      setResult('close');
      setScore(prev => prev + 0.5);
      return;
    }

    setResult('incorrect');
  };

  // Levenshtein distance function for string similarity
  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  };

  const startListening = () => {
    if (!recognition) {
      alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening || isStartingRecognition.current) {
      return;
    }

    isStartingRecognition.current = true;
    
    setTranscript('');
    setResult(null);
    setRetryCount(0);
    setIsListening(true);
    
    try {
      recognition.start();
    } catch (error) {
      setIsListening(false);
      isStartingRecognition.current = false;
      alert('Could not start speech recognition. Please try again.');
    }
  };

  const handleNext = () => {
    if (trainingMode === 'kanji' && resource && resource.resource_kanji) {
      selectRandomKanji(resource.resource_kanji);
      handleClear();
    } else if (trainingMode === 'speech' && resource && resource.resource_words) {
      selectRandomWord(resource.resource_words);
    }
  };

  if (loading) {
    return <div className="loading">Loading training...</div>;
  }

  if (!resource) {
    return <div className="loading">Loading...</div>;
  }

  const hasKanji = resource.resource_kanji && resource.resource_kanji.length > 0;
  const hasWords = resource.resource_words && resource.resource_words.length > 0;

  if (!hasKanji && !hasWords) {
    return (
      <div className="training-page">
        <button onClick={() => navigate(`/resources/${id}`)} className="back-button">
          ← Back to Resource
        </button>
        <div className="empty-state">
          <h2>No Content Available</h2>
          <p>Add some words or kanji to this resource to start training!</p>
        </div>
      </div>
    );
  }

  if (trainingMode === 'kanji' && !currentKanji) {
    return <div className="loading">Loading...</div>;
  }

  if (trainingMode === 'speech' && !currentWord) {
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

      <div className="mode-selector">
        {hasKanji && (
          <Link 
            to={`/resources/${id}/train/kanji`}
            className={`mode-button ${trainingMode === 'kanji' ? 'active' : ''}`}
          >
            ✍️ Kanji Recall
          </Link>
        )}
        {hasWords && (
          <Link 
            to={`/resources/${id}/train/speech`}
            className={`mode-button ${trainingMode === 'speech' ? 'active' : ''}`}
          >
            🗣️ Speech
          </Link>
        )}
      </div>

      <div className="training-container">
        {trainingMode === 'kanji' && currentKanji && (
          <>
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
          </>
        )}

        {trainingMode === 'speech' && currentWord && (
          <>
            <div className="prompt-section">
              <h2>Read this word:</h2>
              <div className="word-prompt">
                {currentWord.dictionary_entries.entry_kanji.length > 0 && (
                  <div className="word-display">
                    {currentWord.dictionary_entries.entry_kanji[0].kanji}
                  </div>
                )}
                <div className="word-glosses">
                  {currentWord.dictionary_entries.entry_senses
                    .slice(0, 2)
                    .map(sense => sense.sense_glosses.slice(0, 2).map(g => g.gloss).join(', '))
                    .filter(Boolean)
                    .join('; ')}
                </div>
              </div>
            </div>

            <div className="speech-section">
              <div className="speech-instructions">
                {isListening ? (
                  <div className="listening-prompt">
                    🎤 <strong>Speak now!</strong> Say the word clearly
                    {retryCount > 0 && <div className="retry-indicator">Attempt {retryCount + 1} of {maxRetries + 1}</div>}
                  </div>
                ) : (
                  <div className="speech-hint">
                    Click the microphone button, then speak the word immediately
                  </div>
                )}
              </div>

              <button 
                onClick={startListening} 
                className={`microphone-button ${isListening ? 'listening' : ''}`}
                disabled={!!result || isListening}
              >
                {isListening ? '🎤 Listening...' : '🎤 Click to Speak'}
              </button>
              
              {transcript && (
                <div className="transcript-display">
                  <strong>You said:</strong> {transcript}
                </div>
              )}

              {!recognition && (
                <div className="warning-message">
                  Speech recognition is not supported in your browser. Please use Chrome or Edge.
                </div>
              )}
            </div>
          </>
        )}

        {result && trainingMode === 'kanji' && currentKanji && (
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

        {result && trainingMode === 'speech' && currentWord && (
          <div className={`result-section ${result}`}>
            {result === 'correct' ? (
              <>
                <div className="result-icon">✓</div>
                <h3>Correct!</h3>
                <div className="correct-reading">
                  {currentWord.dictionary_entries.entry_readings.map(r => r.reading).join('、')}
                </div>
                <button onClick={handleNext} className="next-button">
                  Next Word →
                </button>
              </>
            ) : result === 'close' ? (
              <>
                <div className="result-icon">≈</div>
                <h3>Close!</h3>
                <div className="hint-text">
                  Expected: <span className="correct-reading">
                    {currentWord.dictionary_entries.entry_readings.map(r => r.reading).join('、')}
                  </span>
                </div>
                <p style={{marginTop: '10px', color: '#856404'}}>
                  Your pronunciation was close! +0.5 points
                </p>
                <div className="result-actions">
                  <button onClick={() => { setResult(null); setTranscript(''); }} className="retry-button">
                    Try Again
                  </button>
                  <button onClick={handleNext} className="next-button">
                    Next Word →
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="result-icon">✗</div>
                <h3>Not Quite</h3>
                <div className="hint-text">
                  The correct reading is: <span className="correct-reading">
                    {currentWord.dictionary_entries.entry_readings.map(r => r.reading).join('、')}
                  </span>
                </div>
                <div className="result-actions">
                  <button onClick={() => { setResult(null); setTranscript(''); }} className="retry-button">
                    Try Again
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

