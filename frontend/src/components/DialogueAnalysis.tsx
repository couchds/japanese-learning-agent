import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import API_URL from '../config';
import './DialogueAnalysis.css';

interface DialogueBreakdown {
  word: string;
  reading: string;
  meaning: string;
}

interface Composite {
  id: number;
  dialogue_text: string;
  translation: string | null;
  breakdown: DialogueBreakdown[] | null;
  grammar_notes: string | null;
  context_notes: string | null;
  processed: boolean;
  created_at: string;
}

interface DialogueAnalysisProps {
  composite: Composite;
  onClose: () => void;
  onDelete?: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const DialogueAnalysis: React.FC<DialogueAnalysisProps> = ({ composite, onClose, onDelete }) => {
  const { token } = useAuth();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userQuestion, setUserQuestion] = useState('');
  const [askingQuestion, setAskingQuestion] = useState(false);

  const handleAskQuestion = async () => {
    if (!userQuestion.trim() || askingQuestion) return;

    const question = userQuestion.trim();
    setUserQuestion('');
    
    // Add user message to chat
    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: question }];
    setChatMessages(newMessages);
    setAskingQuestion(true);

    try {
      const response = await fetch(
        `${API_URL}/api/composite/${composite.id}/ask`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question: question,
            chatHistory: newMessages.slice(0, -1),
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get answer');
      }

      const data = await response.json();
      
      // Add assistant response to chat
      setChatMessages([...newMessages, { role: 'assistant', content: data.answer }]);
    } catch (error) {
      console.error('Error asking question:', error);
      setChatMessages([...newMessages, { 
        role: 'assistant', 
        content: 'Sorry, I couldn\'t process your question. Make sure OPENAI_API_KEY is configured.' 
      }]);
    } finally {
      setAskingQuestion(false);
    }
  };

  return (
    <div className="dialogue-analysis-overlay" onClick={onClose}>
      <div className="dialogue-analysis-panel" onClick={(e) => e.stopPropagation()}>
        <div className="dialogue-header">
          <h3>🌐 Dialogue Analysis</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="dialogue-content">
          {/* Original Japanese Text */}
          <div className="dialogue-section">
            <h4>🈁 Original Japanese</h4>
            <div className="original-text">{composite.dialogue_text}</div>
          </div>

          {!composite.processed && (
            <div className="processing-message">
              <p>⏳ Analysis in progress...</p>
            </div>
          )}

          {composite.processed && (
            <>
              {/* Translation */}
              {composite.translation && (
                <div className="dialogue-section">
                  <h4>🌐 Translation</h4>
                  <div className="translation-text">{composite.translation}</div>
                </div>
              )}

              {/* Word Breakdown */}
              {composite.breakdown && composite.breakdown.length > 0 && (
                <div className="dialogue-section">
                  <h4>📖 Word Breakdown</h4>
                  <div className="breakdown-grid">
                    {composite.breakdown.map((item, idx) => (
                      <div key={idx} className="breakdown-item">
                        <div className="breakdown-word">{item.word}</div>
                        <div className="breakdown-reading">{item.reading}</div>
                        <div className="breakdown-meaning">{item.meaning}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grammar Notes */}
              {composite.grammar_notes && (
                <div className="dialogue-section">
                  <h4>📚 Grammar Notes</h4>
                  <div className="notes-text">{composite.grammar_notes}</div>
                </div>
              )}

              {/* Context Notes */}
              {composite.context_notes && (
                <div className="dialogue-section">
                  <h4>💡 Context Notes</h4>
                  <div className="notes-text">{composite.context_notes}</div>
                </div>
              )}
            </>
          )}

          {/* Ask Questions Section */}
          {composite.processed && (
            <div className="dialogue-section chat-section">
              <h4>💬 Ask Questions About This Dialogue</h4>
              
              {/* Chat Messages */}
              {chatMessages.length > 0 && (
                <div className="chat-messages">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`chat-message ${msg.role}`}>
                      <div className="message-label">
                        {msg.role === 'user' ? '👤 You' : '🤖 AI'}
                      </div>
                      <div className="message-content">{msg.content}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Question Input */}
              <div className="question-input-area">
                <input
                  type="text"
                  value={userQuestion}
                  onChange={(e) => setUserQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAskQuestion();
                    }
                  }}
                  placeholder="e.g., Why is 'よ' used here? What's the formality level?"
                  className="question-input"
                  disabled={askingQuestion}
                />
                <button
                  onClick={handleAskQuestion}
                  disabled={askingQuestion || !userQuestion.trim()}
                  className="ask-btn"
                >
                  {askingQuestion ? '⏳' : '💬 Ask'}
                </button>
              </div>
            </div>
          )}
        </div>

        {onDelete && (
          <div className="dialogue-footer">
            <button className="delete-analysis-btn" onClick={onDelete}>
              🗑️ Delete Analysis
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DialogueAnalysis;

