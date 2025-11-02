import React, { useRef, useState } from 'react';
import { ReactSketchCanvas, ReactSketchCanvasRef } from 'react-sketch-canvas';
import './KanjiDraw.css';

const KanjiDraw: React.FC = () => {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const [strokeWidth, setStrokeWidth] = useState(8);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 400 });

  const handleClear = () => {
    if (canvasRef.current) {
      canvasRef.current.clearCanvas();
    }
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
        alert('Please draw something first!');
        return;
      }
      
      // Export the drawing as an image for future recognition
      const image = await canvasRef.current.exportImage('png');
      console.log('Drawing data:', { paths, image });
      
      // Placeholder for future kanji recognition
      alert('Kanji recognition will be implemented here!\n\nYour drawing has been captured and is ready to be sent to a recognition service.');
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
            <button onClick={handleSearch} className="search-button">
              Search Kanji
            </button>
            <p className="help-text">
              Draw a kanji character in the canvas and click "Search Kanji" to find it.
            </p>
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
        <h2>Search Results</h2>
        <p className="placeholder-text">
          Recognition results will appear here once the backend is implemented.
        </p>
      </div>
    </div>
  );
};

export default KanjiDraw;

