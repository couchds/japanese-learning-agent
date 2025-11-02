import React, { useRef, useState } from 'react';
import { ReactSketchCanvas, ReactSketchCanvasRef } from 'react-sketch-canvas';
import { useAuth } from '../context/AuthContext';
import './KanjiDraw.css';

interface RecognitionResult {
  kanji: string;
  score: number;
}

interface KanjiDetails {
  id: number;
  literal: string;
  meanings: string[];
  on_readings: string[] | null;
  kun_readings: string[] | null;
  stroke_count: number | null;
  grade: number | null;
  jlpt_level: number | null;
}

const KanjiDraw: React.FC = () => {
  const { token } = useAuth();
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const [strokeWidth, setStrokeWidth] = useState(20);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 400 });
  const [recognitionResults, setRecognitionResults] = useState<RecognitionResult[]>([]);
  const [kanjiDetails, setKanjiDetails] = useState<KanjiDetails[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClear = () => {
    if (canvasRef.current) {
      canvasRef.current.clearCanvas();
    }
    setRecognitionResults([]);
    setKanjiDetails([]);
    setError(null);
  };

  const handleUndo = () => {
    if (canvasRef.current) {
      canvasRef.current.undo();
    }
  };

  const handleRedo = () => {
    if (canvasRef.current) {
      canvasRef.current.redo();
    }
  };

  const handleExportImage = async () => {
    if (canvasRef.current) {
      const image = await canvasRef.current.exportImage('png');
      console.log('Exported image data:', image);
      // This is where you would send the image to the backend for recognition
      alert('Image exported! In the future, this will be sent to a recognition service.');
    }
  };

  const handleSearch = async () => {
    if (canvasRef.current) {
      const paths = await canvasRef.current.exportPaths();
      if (paths.length === 0) {
        setError('Please draw something first!');
        return;
      }
      
      setIsRecognizing(true);
      setError(null);
      
      try {
        // Send stroke paths directly to backend for recognition
        console.log('Sending paths:', paths);
        
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
        
        if (!response.ok) {
          throw new Error(data.error || 'Recognition failed');
        }

        if (data.success && data.results) {
          setRecognitionResults(data.results);
          
          // Fetch details for each recognized kanji
          await fetchKanjiDetails(data.results.map((r: RecognitionResult) => r.kanji));
        } else {
          setError(data.error || 'No results found');
        }
      } catch (err) {
        console.error('Recognition error:', err);
        setError(err instanceof Error ? err.message : 'Failed to recognize kanji. Make sure the Python recognition service is running.');
      } finally {
        setIsRecognizing(false);
      }
    }
  };

  const fetchKanjiDetails = async (kanjiList: string[]) => {
    try {
      const detailsPromises = kanjiList.map(async (kanji) => {
        const response = await fetch(`http://localhost:3001/api/kanji?search=${encodeURIComponent(kanji)}&limit=1`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          return data.kanji && data.kanji.length > 0 ? data.kanji[0] : null;
        }
        return null;
      });

      const details = await Promise.all(detailsPromises);
      setKanjiDetails(details.filter((d): d is KanjiDetails => d !== null));
    } catch (err) {
      console.error('Error fetching kanji details:', err);
    }
  };

  return (
    <div className="kanji-draw-page">
      <h1>Draw Kanji</h1>
      <p className="subtitle">Draw a kanji character to search for it</p>

      <div className="draw-container">
        <div className="canvas-wrapper">
          <ReactSketchCanvas
            ref={canvasRef}
            width={`${canvasSize.width}px`}
            height={`${canvasSize.height}px`}
            strokeWidth={strokeWidth}
            strokeColor={strokeColor}
            canvasColor="#ffffff"
            style={{
              border: '2px solid #333',
              borderRadius: '8px',
            }}
            eraserWidth={20}
            exportWithBackgroundImage={false}
            allowOnlyPointerType="all"
          />
        </div>

        <div className="controls-panel">
          <div className="control-section">
            <h3>Drawing Tools</h3>
            
            <div className="control-group">
              <label htmlFor="stroke-width">
                Stroke Width: {strokeWidth}px
              </label>
              <input
                id="stroke-width"
                type="range"
                min="1"
                max="20"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                className="slider"
              />
            </div>

            <div className="control-group">
              <label htmlFor="stroke-color">
                Stroke Color
              </label>
              <div className="color-picker-wrapper">
                <input
                  id="stroke-color"
                  type="color"
                  value={strokeColor}
                  onChange={(e) => setStrokeColor(e.target.value)}
                  className="color-picker"
                />
                <span className="color-value">{strokeColor}</span>
              </div>
            </div>

            <div className="button-group">
              <button onClick={handleUndo} className="control-button">
                ↶ Undo
              </button>
              <button onClick={handleRedo} className="control-button">
                ↷ Redo
              </button>
              <button onClick={handleClear} className="control-button clear-button">
                Clear
              </button>
            </div>
          </div>

          <div className="control-section">
            <h3>Recognition</h3>
            <button 
              onClick={handleSearch} 
              className="search-button"
              disabled={isRecognizing}
            >
              {isRecognizing ? 'Recognizing...' : 'Search Kanji'}
            </button>
            <p className="help-text">
              Draw a kanji character in the canvas and click "Search Kanji" to find it.
            </p>
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
          </div>

          <div className="control-section tips">
            <h3>Tips</h3>
            <ul>
              <li>Draw strokes in the correct order for best results</li>
              <li>Try to keep the character centered</li>
              <li>Use a thicker stroke width for better recognition</li>
              <li>Works with mouse, touchpad, or stylus/pen</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="results-section">
        <h2>Recognition Results</h2>
        {recognitionResults.length === 0 ? (
          <p className="placeholder-text">
            Draw a kanji and click "Search Kanji" to see recognition results.
          </p>
        ) : (
          <>
            <div className="results-grid">
              {recognitionResults.map((result, index) => {
                const details = kanjiDetails.find(k => k.literal === result.kanji);
                return (
                  <div key={index} className="result-card">
                    <div className="result-kanji">{result.kanji}</div>
                    <div className="result-confidence">
                      Confidence: {(result.score * 100).toFixed(1)}%
                    </div>
                    {details && (
                      <div className="result-details">
                        <div className="result-meanings">
                          {details.meanings?.join(', ')}
                        </div>
                        <div className="result-readings">
                          {details.on_readings && details.on_readings.length > 0 && (
                            <div>On: {details.on_readings.join('、')}</div>
                          )}
                          {details.kun_readings && details.kun_readings.length > 0 && (
                            <div>Kun: {details.kun_readings.join('、')}</div>
                          )}
                        </div>
                        {details.stroke_count && (
                          <div className="result-strokes">
                            {details.stroke_count} strokes
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default KanjiDraw;

