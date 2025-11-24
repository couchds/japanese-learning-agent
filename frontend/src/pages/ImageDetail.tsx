import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import KnowledgeSidebar from '../components/KnowledgeSidebar';
import API_URL from '../config';
import './ImageDetail.css';

interface OCRElement {
  id: number;
  text: string;
  element_type: string;
  item_id: number | null;
  position_x?: number | null;
  position_y?: number | null;
  width?: number | null;
  height?: number | null;
  confidence?: number | null;
  details?: any;
}

interface DialogueBreakdown {
  word: string;
  reading: string;
  meaning: string;
}

interface Composite {
  id: number;
  resource_image_id: number;
  dialogue_text: string;
  translation: string | null;
  breakdown: DialogueBreakdown[] | null;
  grammar_notes: string | null;
  context_notes: string | null;
  processed: boolean;
  previous_composite_id: number | null;
  created_at: string;
}

interface ResourceImage {
  id: number;
  resource_id: number;
  image_path: string;
  notes?: string;
  ocr_processed?: boolean;
  ocr_raw_text?: string;
  created_at: string;
  resources?: {
    id: number;
    name: string;
  };
}

interface ImageInSequence {
  id: number;
  image_path: string;
  created_at: string;
}

const ImageDetail: React.FC = () => {
  const { imageId } = useParams<{ imageId: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  
  const [image, setImage] = useState<ResourceImage | null>(null);
  const [ocrElements, setOcrElements] = useState<OCRElement[]>([]);
  const [composites, setComposites] = useState<Composite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedElement, setSelectedElement] = useState<OCRElement | null>(null);
  const [selectedComposite, setSelectedComposite] = useState<Composite | null>(null);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [userQuestion, setUserQuestion] = useState('');
  const [askingQuestion, setAskingQuestion] = useState(false);
  
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedElementIds, setSelectedElementIds] = useState<number[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  
  const [editingElement, setEditingElement] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newElementText, setNewElementText] = useState('');
  const [rawTextInput, setRawTextInput] = useState('');
  const [analyzingRawText, setAnalyzingRawText] = useState(false);
  const [selectedPreviousComposite, setSelectedPreviousComposite] = useState<number | null>(null);
  const [allComposites, setAllComposites] = useState<Composite[]>([]); // All composites from this resource
  const [resourceImages, setResourceImages] = useState<ImageInSequence[]>([]); // All images in this resource
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(-1);

  useEffect(() => {
    if (token && imageId) {
      fetchImageDetails();
      // Reset state when image changes
      setChatMessages([]);
      setUserQuestion('');
    }
  }, [token, imageId]);

  // Auto-populate text area with OCR text when elements are loaded
  useEffect(() => {
    if (ocrElements.length > 0 && !rawTextInput) {
      // Combine all OCR text in order
      const combinedText = ocrElements
        .sort((a, b) => {
          if (a.position_y === b.position_y) {
            return (a.position_x || 0) - (b.position_x || 0);
          }
          return (a.position_y || 0) - (b.position_y || 0);
        })
        .map(el => el.text)
        .join('');
      setRawTextInput(combinedText);
    }
  }, [ocrElements]);

  // Suggest previous image's latest composite when available (but don't auto-select)
  // Users can manually select if the dialogue continues
  const getSuggestedPreviousComposite = () => {
    if (currentImageIndex > 0 && allComposites.length > 0 && resourceImages.length > 0) {
      const previousImageId = resourceImages[currentImageIndex - 1].id;
      const previousImageComposites = allComposites.filter(c => c.resource_image_id === previousImageId);
      
      if (previousImageComposites.length > 0) {
        return previousImageComposites[previousImageComposites.length - 1];
      }
    }
    return null;
  };

  const handleAskSimpleQuestion = async () => {
    if (!userQuestion.trim() || askingQuestion || !rawTextInput.trim()) return;

    const question = userQuestion.trim();
    setUserQuestion('');
    
    const newMessages = [...chatMessages, { role: 'user' as const, content: question }];
    setChatMessages(newMessages);
    setAskingQuestion(true);

    try {
      const response = await fetch(
        `${API_URL}/api/composite/ask-simple`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            japaneseText: rawTextInput.trim(),
            question: question,
            chatHistory: newMessages.slice(0, -1),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get answer');
      }

      const data = await response.json();
      setChatMessages([...newMessages, { role: 'assistant', content: data.answer }]);
    } catch (error: any) {
      console.error('Error asking question:', error);
      setChatMessages([...newMessages, { 
        role: 'assistant', 
        content: `Sorry, I couldn't process your question. ${error.message}` 
      }]);
    } finally {
      setAskingQuestion(false);
    }
  };

  const fetchImageDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch image details
      const imageResponse = await fetch(
        `${API_URL}/api/resource-images/${imageId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!imageResponse.ok) {
        throw new Error('Failed to fetch image');
      }

      const imageData = await imageResponse.json();
      setImage(imageData);

      // Fetch OCR elements
      if (imageData.ocr_processed) {
        const elementsResponse = await fetch(
          `${API_URL}/api/ocr/elements/${imageId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (elementsResponse.ok) {
          const elementsData = await elementsResponse.json();
          setOcrElements(elementsData.elements || []);
        }

        // Fetch composites
        const compositesResponse = await fetch(
          `${API_URL}/api/composite/${imageId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (compositesResponse.ok) {
          const compositesData = await compositesResponse.json();
          setComposites(compositesData);
        }

        // Fetch all composites from this resource (for linking previous dialogue)
        if (imageData.resource_id) {
          const allCompositesResponse = await fetch(
            `${API_URL}/api/composite/resource/${imageData.resource_id}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );

          if (allCompositesResponse.ok) {
            const allCompositesData = await allCompositesResponse.json();
            setAllComposites(allCompositesData);
          }

          // Fetch all images from this resource (for navigation)
          const allImagesResponse = await fetch(
            `${API_URL}/api/resource-images?resource_id=${imageData.resource_id}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }
          );

          if (allImagesResponse.ok) {
            const allImagesData = await allImagesResponse.json();
            const images = allImagesData.images.map((img: any) => ({
              id: img.id,
              image_path: img.image_path,
              created_at: img.created_at,
            }));
            setResourceImages(images);
            
            // Find current image index
            const currentIndex = images.findIndex((img: ImageInSequence) => img.id === parseInt(imageId!));
            setCurrentImageIndex(currentIndex);
          }
        }
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this image?')) return;

    try {
      const response = await fetch(
        `${API_URL}/api/resource-images/${imageId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        navigate(-1); // Go back to previous page
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Failed to delete image');
    }
  };

  const toggleElementSelection = (elementId: number) => {
    if (selectedElementIds.includes(elementId)) {
      setSelectedElementIds(selectedElementIds.filter(id => id !== elementId));
    } else {
      setSelectedElementIds([...selectedElementIds, elementId]);
    }
  };

  const handleAnalyzeDialogue = async () => {
    if (!image || selectedElementIds.length === 0) {
      alert('Please select at least one element to analyze');
      return;
    }

    try {
      setAnalyzing(true);
      const response = await fetch(
        `${API_URL}/api/composite/analyze`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resourceImageId: image.id,
            elementIds: selectedElementIds,
            previousCompositeId: selectedPreviousComposite,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to analyze dialogue');
      }

      const composite = await response.json();
      
      // Refresh composites and exit selection mode
      await fetchImageDetails();
      setSelectionMode(false);
      setSelectedElementIds([]);
      setSelectedComposite(composite);
    } catch (error: any) {
      console.error('Error analyzing dialogue:', error);
      alert(error.message || 'Failed to analyze dialogue. Make sure OPENAI_API_KEY is set.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteElement = async (elementId: number) => {
    if (!window.confirm('Delete this OCR element?')) return;

    try {
      const response = await fetch(
        `${API_URL}/api/ocr/elements/${elementId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        fetchImageDetails();
      }
    } catch (error) {
      console.error('Error deleting element:', error);
      alert('Failed to delete element');
    }
  };

  const handleEditElement = async (elementId: number, newText: string) => {
    if (!newText.trim()) return;

    try {
      const response = await fetch(
        `${API_URL}/api/ocr/elements/${elementId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: newText.trim() }),
        }
      );

      if (response.ok) {
        fetchImageDetails();
        setEditingElement(null);
        setEditText('');
      }
    } catch (error) {
      console.error('Error editing element:', error);
      alert('Failed to edit element');
    }
  };

  const handleAddElement = async () => {
    if (!image || !newElementText.trim()) return;

    try {
      const response = await fetch(
        `${API_URL}/api/ocr/elements`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resource_image_id: image.id,
            text: newElementText.trim(),
          }),
        }
      );

      if (response.ok) {
        fetchImageDetails();
        setShowAddForm(false);
        setNewElementText('');
      }
    } catch (error) {
      console.error('Error adding element:', error);
      alert('Failed to add element');
    }
  };

  const handleDeleteComposite = async (compositeId: number) => {
    if (!window.confirm('Delete this dialogue analysis?')) return;

    try {
      const response = await fetch(
        `${API_URL}/api/composite/${compositeId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        setComposites(composites.filter(c => c.id !== compositeId));
        setSelectedComposite(null);
      }
    } catch (error) {
      console.error('Error deleting composite:', error);
      alert('Failed to delete composite');
    }
  };

  const handleAnalyzeRawText = async () => {
    if (!image || !rawTextInput.trim()) {
      alert('Please enter some Japanese text to analyze');
      return;
    }

    try {
      setAnalyzingRawText(true);
      const response = await fetch(
        `${API_URL}/api/composite/analyze-text`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resourceImageId: image.id,
            text: rawTextInput.trim(),
            previousCompositeId: selectedPreviousComposite,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to analyze text');
      }

      const composite = await response.json();
      
      // Refresh composites and show analysis
      await fetchImageDetails();
      setRawTextInput('');
      setSelectedComposite(composite);
    } catch (error: any) {
      console.error('Error analyzing text:', error);
      alert(error.message || 'Failed to analyze text. Make sure OPENAI_API_KEY is set.');
    } finally {
      setAnalyzingRawText(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className="image-detail-loading">Loading...</div>;
  }

  if (error || !image) {
    return (
      <div className="image-detail-error">
        <p>{error || 'Image not found'}</p>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="image-detail-page">
      {/* Header */}
      <div className="image-detail-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div className="header-info">
          {image.resources && (
            <h2 className="resource-name">{image.resources.name}</h2>
          )}
          <p className="image-date">{formatDate(image.created_at)}</p>
        </div>
        <button className="delete-image-btn" onClick={handleDelete}>
          🗑️ Delete Image
        </button>
      </div>

      {/* Main Content */}
      <div className="image-detail-content">
        {/* Left: Image */}
        <div className="image-section">
          <img 
            src={`${API_URL}${image.image_path}`} 
            alt="Screenshot"
            className="detail-image"
          />
          
          {/* Image Sequence Navigation */}
          {resourceImages.length > 1 && currentImageIndex >= 0 && (
            <div className="image-sequence-nav">
              <div className="sequence-info">
                Image {currentImageIndex + 1} of {resourceImages.length}
              </div>
              
              <div className="sequence-controls">
                {currentImageIndex > 0 ? (
                  <button
                    onClick={() => navigate(`/images/${resourceImages[currentImageIndex - 1].id}`)}
                    className="nav-btn prev-btn"
                  >
                    <span className="nav-arrow">←</span>
                    <div className="nav-preview">
                      <img 
                        src={`${API_URL}${resourceImages[currentImageIndex - 1].image_path}`}
                        alt="Previous"
                      />
                    </div>
                    <span className="nav-label">Previous</span>
                  </button>
                ) : (
                  <div className="nav-btn-placeholder"></div>
                )}

                {currentImageIndex < resourceImages.length - 1 ? (
                  <button
                    onClick={() => navigate(`/images/${resourceImages[currentImageIndex + 1].id}`)}
                    className="nav-btn next-btn"
                  >
                    <span className="nav-label">Next</span>
                    <div className="nav-preview">
                      <img 
                        src={`${API_URL}${resourceImages[currentImageIndex + 1].image_path}`}
                        alt="Next"
                      />
                    </div>
                    <span className="nav-arrow">→</span>
                  </button>
                ) : (
                  <div className="nav-btn-placeholder"></div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: OCR Elements and Analysis */}
        <div className="ocr-section">
          {image.ocr_processed ? (
            <>
              <h3>📝 Recognized Elements</h3>
              
              {ocrElements.length > 0 ? (
                <>
                  {/* OCR Elements */}
                  <div className="elements-container">
                    {['kanji', 'vocabulary', 'hiragana', 'katakana'].map(type => {
                      const elementsOfType = ocrElements.filter(e => e.element_type === type);
                      if (elementsOfType.length === 0) return null;
                      
                      return (
                        <div key={type} className="element-group">
                          <h4 className="element-type-header">
                            {type === 'kanji' && '🈁 Kanji'}
                            {type === 'vocabulary' && '📖 Vocabulary'}
                            {type === 'hiragana' && 'あ Hiragana'}
                            {type === 'katakana' && 'ア Katakana'}
                          </h4>
                          <div className="element-chips">
                            {elementsOfType.map((element) => (
                              <div key={element.id} className="element-chip-wrapper">
                                {editingElement === element.id ? (
                                  <div className="edit-chip-form">
                                    <input
                                      type="text"
                                      value={editText}
                                      onChange={(e) => setEditText(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleEditElement(element.id, editText);
                                        } else if (e.key === 'Escape') {
                                          setEditingElement(null);
                                          setEditText('');
                                        }
                                      }}
                                      autoFocus
                                      className="edit-chip-input"
                                    />
                                    <button
                                      onClick={() => handleEditElement(element.id, editText)}
                                      className="edit-chip-save"
                                    >
                                      ✓
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingElement(null);
                                        setEditText('');
                                      }}
                                      className="edit-chip-cancel"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <span 
                                      className={`element-chip ${element.item_id ? 'matched' : 'unmatched'} ${selectionMode && selectedElementIds.includes(element.id) ? 'selected' : ''}`}
                                      onClick={() => {
                                        if (selectionMode) {
                                          toggleElementSelection(element.id);
                                        } else {
                                          setSelectedElement(element);
                                        }
                                      }}
                                    >
                                      {selectionMode && selectedElementIds.includes(element.id) && '✓ '}
                                      {element.text}
                                    </span>
                                    {!selectionMode && (
                                      <>
                                        <button
                                          onClick={() => {
                                            setEditingElement(element.id);
                                            setEditText(element.text);
                                          }}
                                          className="edit-chip-btn"
                                        >
                                          ✏️
                                        </button>
                                        <button
                                          onClick={() => handleDeleteElement(element.id)}
                                          className="delete-chip-btn"
                                        >
                                          🗑️
                                        </button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Add Element */}
                    {!selectionMode && (
                      <div className="add-element-section">
                        {showAddForm ? (
                          <div className="add-element-form">
                            <input
                              type="text"
                              value={newElementText}
                              onChange={(e) => setNewElementText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddElement();
                                else if (e.key === 'Escape') {
                                  setShowAddForm(false);
                                  setNewElementText('');
                                }
                              }}
                              placeholder="Enter kanji or word..."
                              autoFocus
                            />
                            <button onClick={handleAddElement}>✓ Add</button>
                            <button onClick={() => {
                              setShowAddForm(false);
                              setNewElementText('');
                            }}>Cancel</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowAddForm(true)}
                            className="add-element-btn"
                          >
                            ➕ Add Missing Element
                          </button>
                        )}
                      </div>
                    )}
                  </div>


                  {/* AI Chat Interface */}
                  <div className="ai-chat-section">
                    <h4>🤖 Ask AI About This Japanese Text</h4>
                    <p className="input-hint">
                      {ocrElements.length > 0 
                        ? '✓ OCR text loaded below. Edit if needed, then ask questions!'
                        : 'Paste or type Japanese text, then ask questions about it below'}
                    </p>
                    
                    {/* Japanese Text Input */}
                    <div className="japanese-text-area">
                      <label>Japanese Text:</label>
                      <textarea
                        value={rawTextInput}
                        onChange={(e) => {
                          setRawTextInput(e.target.value);
                          // Clear chat if text changes significantly
                          if (chatMessages.length > 0) {
                            setChatMessages([]);
                          }
                        }}
                        placeholder="Paste Japanese text here: 「……勇者よ。どうしてここに？」"
                        className="raw-text-textarea"
                        rows={6}
                      />
                    </div>

                      {/* Chat Messages */}
                      {chatMessages.length > 0 && (
                        <div className="chat-messages-simple">
                          {chatMessages.map((msg, idx) => (
                            <div key={idx} className={`chat-message-simple ${msg.role}`}>
                              <div className="message-label-simple">
                                {msg.role === 'user' ? '👤 You' : '🤖 AI'}
                              </div>
                              <div className="message-content-simple">{msg.content}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Question Input */}
                      <div className="question-area-simple">
                        <label>Ask AI:</label>
                        <div className="question-input-row">
                          <input
                            type="text"
                            value={userQuestion}
                            onChange={(e) => setUserQuestion(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAskSimpleQuestion();
                              }
                            }}
                            placeholder="e.g., Translate this. What does よ mean? Explain the grammar."
                            className="question-input-simple"
                            disabled={askingQuestion || !rawTextInput.trim()}
                          />
                          <button
                            onClick={handleAskSimpleQuestion}
                            disabled={askingQuestion || !userQuestion.trim() || !rawTextInput.trim()}
                            className="ask-btn-simple"
                          >
                            {askingQuestion ? '⏳' : 'Ask'}
                          </button>
                        </div>
                        {!rawTextInput.trim() && (
                          <p className="warning-hint">⚠️ Add Japanese text above first</p>
                        )}
                      </div>
                    </div>


                  {/* Raw OCR Text (Read-only) */}
                  {image.ocr_raw_text && (
                    <details className="raw-text-section">
                      <summary>View Raw OCR Output</summary>
                      <div className="raw-text">{image.ocr_raw_text}</div>
                    </details>
                  )}
                </>
              ) : (
                <p className="no-elements">No text elements found</p>
              )}
            </>
          ) : (
            <p className="processing">⏳ OCR processing in progress...</p>
          )}
        </div>
      </div>

      {/* Knowledge Sidebar */}
      {selectedElement && (
        <KnowledgeSidebar
          elementId={selectedElement.id}
          text={selectedElement.text}
          elementType={selectedElement.element_type}
          itemId={selectedElement.item_id}
          onClose={() => setSelectedElement(null)}
        />
      )}
    </div>
  );
};

export default ImageDetail;

