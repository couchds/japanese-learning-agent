import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './TestModel.css';

interface ModelInfo {
  is_trained: boolean;
  num_classes: number;
  class_names: string[];
  accuracy: number | null;
}

interface Prediction {
  word: string;
  confidence: number;
}

const TestModel: React.FC = () => {
  const { token } = useAuth();
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    fetchModelInfo();
  }, []);

  const fetchModelInfo = async () => {
    try {
      const response = await fetch('http://localhost:5001/info');
      if (response.ok) {
        const data = await response.json();
        setModelInfo(data.model);
      }
    } catch (err) {
      console.error('Error fetching model info:', err);
    }
  };

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
        setPredictions([]); // Clear previous predictions
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

  const testRecording = async () => {
    if (!audioURL) return;

    setLoading(true);
    try {
      const audioBlob = await fetch(audioURL).then(r => r.blob());
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('top_k', '10'); // Get top 10 predictions

      const response = await fetch('http://localhost:5001/predict', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Prediction failed');
      }

      const data = await response.json();
      setPredictions(data.predictions);
    } catch (err) {
      console.error('Error testing recording:', err);
      alert(`Failed to get prediction: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const clearRecording = () => {
    setAudioURL(null);
    setPredictions([]);
  };

  if (!modelInfo?.is_trained) {
    return (
      <div className="test-model-page">
        <h1>Test Custom Model</h1>
        <div className="no-model-message">
          <h2>No trained model available</h2>
          <p>You need to train a custom model first!</p>
          <ol>
            <li>Go to the <a href="/pronunciation">Pronunciation Training</a> page</li>
            <li>Record multiple words (at least 2 different words, 5+ recordings each)</li>
            <li>Mark them as "Reference" pronunciations</li>
            <li>Click "Train Custom Model"</li>
            <li>Come back here to test!</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="test-model-page">
      <h1>Test Custom Model</h1>
      <p className="subtitle">Record yourself saying a word and see what the model predicts</p>

      <div className="model-stats">
        <div className="stat-item">
          <span className="stat-label">Vocabulary:</span>
          <span className="stat-value">{modelInfo.num_classes} words</span>
        </div>
        {modelInfo.accuracy && (
          <div className="stat-item">
            <span className="stat-label">Accuracy:</span>
            <span className="stat-value">{modelInfo.accuracy.toFixed(1)}%</span>
          </div>
        )}
      </div>

      <div className="test-container">
        <div className="recording-section">
          <h2>Record Audio</h2>
          
          {!audioURL ? (
            <div className="record-controls">
              {!isRecording ? (
                <button onClick={startRecording} className="btn-record-large">
                  🎤 Start Recording
                </button>
              ) : (
                <>
                  <div className="recording-indicator-large">
                    <div className="pulse-dot"></div>
                    Recording...
                  </div>
                  <button onClick={stopRecording} className="btn-stop-large">
                    ⬛ Stop
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="playback-section">
              <h3>Your Recording</h3>
              <audio src={audioURL} controls className="audio-player" />
              
              <div className="action-buttons">
                <button 
                  onClick={testRecording} 
                  className="btn-test"
                  disabled={loading}
                >
                  {loading ? 'Testing...' : '🔍 Test with Model'}
                </button>
                <button 
                  onClick={clearRecording} 
                  className="btn-clear"
                  disabled={loading}
                >
                  🗑️ Clear & Re-record
                </button>
              </div>
            </div>
          )}
        </div>

        {predictions.length > 0 && (
          <div className="results-section">
            <h2>Predictions</h2>
            <div className="predictions-list">
              {predictions.map((pred, index) => (
                <div 
                  key={index} 
                  className={`prediction-item ${index === 0 ? 'top-prediction' : ''}`}
                >
                  <div className="prediction-rank">
                    {index === 0 ? '🏆' : `#${index + 1}`}
                  </div>
                  <div className="prediction-word">{pred.word}</div>
                  <div className="prediction-confidence">
                    <div className="confidence-bar-container">
                      <div 
                        className="confidence-bar-fill"
                        style={{ width: `${pred.confidence * 100}%` }}
                      />
                    </div>
                    <span className="confidence-text">
                      {(pred.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="vocabulary-section">
        <h3>Model Vocabulary ({modelInfo.class_names.length} words)</h3>
        <div className="vocabulary-list">
          {modelInfo.class_names.map((word, index) => (
            <span key={index} className="vocabulary-word">{word}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TestModel;

