import API_URL from '../config';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import KnowledgeSidebar from './KnowledgeSidebar';
import './ResourceImages.css';

interface ResourceImage {
  id: number;
  resource_id: number;
  image_path: string;
  notes?: string;
  ocr_processed?: boolean;
  ocr_raw_text?: string;
  created_at: string;
}

interface OCRElement {
  id: number;
  text: string;
  element_type: string;
  item_id: number | null;
  details?: any;
}

interface ResourceImagesProps {
  resourceId: number;
}

const ResourceImages: React.FC<ResourceImagesProps> = ({ resourceId }) => {
  const { token } = useAuth();
  const [images, setImages] = useState<ResourceImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<ResourceImage | null>(null);
  const [ocrElements, setOcrElements] = useState<OCRElement[]>([]);
  const [loadingElements, setLoadingElements] = useState(false);
  const [selectedElement, setSelectedElement] = useState<OCRElement | null>(null);

  useEffect(() => {
    if (token && resourceId) {
      fetchImages();
    }
  }, [token, resourceId]);

  const fetchImages = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_URL}/api/resource-images?resource_id=${resourceId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch images');
      }

      const data = await response.json();
      setImages(data.images);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchOcrElements = async (imageId: number) => {
    try {
      setLoadingElements(true);
      const response = await fetch(
        `${API_URL}/api/ocr/elements/${imageId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch OCR elements');
      }

      const data = await response.json();
      setOcrElements(data.elements || []);
    } catch (err) {
      console.error('Error fetching OCR elements:', err);
      setOcrElements([]);
    } finally {
      setLoadingElements(false);
    }
  };

  const handleImageClick = (image: ResourceImage) => {
    setSelectedImage(image);
    if (image.ocr_processed) {
      fetchOcrElements(image.id);
    } else {
      setOcrElements([]);
    }
  };

  const handleDelete = async (imageId: number) => {
    if (!window.confirm('Are you sure you want to delete this image?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/resource-images/${imageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete image');
      }

      fetchImages();
      if (selectedImage?.id === imageId) {
        setSelectedImage(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return <div className="loading">Loading images...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  if (images.length === 0) {
    return (
      <div className="no-images">
        <p>No OCR screenshots yet</p>
        <p className="hint">Use the Yomunami OCR Client to capture and upload screenshots</p>
      </div>
    );
  }

  return (
    <div className="resource-images">
      <h3>📸 OCR Screenshots ({images.length})</h3>
      
      <div className="images-grid">
        {images.map((image) => (
          <div 
            key={image.id} 
            className="image-item"
            onClick={() => handleImageClick(image)}
          >
            <img 
              src={`${API_URL}${image.image_path}`} 
              alt={`Screenshot ${image.id}`}
              loading="lazy"
            />
            <div className="image-overlay">
              <span className="image-date">{formatDate(image.created_at)}</span>
              {image.ocr_processed && (
                <span className="ocr-badge" title="OCR processed">📝</span>
              )}
              <button 
                className="delete-image-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(image.id);
                }}
                title="Delete image"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div className="image-modal" onClick={() => setSelectedImage(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={() => setSelectedImage(null)}
            >
              ×
            </button>
            
            <img 
              src={`${API_URL}${selectedImage.image_path}`} 
              alt={`Screenshot ${selectedImage.id}`}
            />
            
            <div className="modal-info">
              <p><strong>Created:</strong> {formatDate(selectedImage.created_at)}</p>
              {selectedImage.notes && (
                <p><strong>Notes:</strong> {selectedImage.notes}</p>
              )}
              
              {selectedImage.ocr_processed && (
                <div className="ocr-result">
                  <p><strong>📝 Recognized Elements:</strong></p>
                  
                  {loadingElements && (
                    <p className="ocr-status">Loading elements...</p>
                  )}
                  
                  {!loadingElements && ocrElements.length > 0 && (
                    <div className="ocr-elements">
                      {/* Group by element type */}
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
                              {elementsOfType.map((element, idx) => (
                                <span 
                                  key={`${element.id}-${idx}`} 
                                  className={`element-chip ${element.item_id ? 'matched' : 'unmatched'}`}
                                  title={element.item_id ? 'Click to view details' : 'Not in dictionary'}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedElement(element);
                                  }}
                                >
                                  {element.text}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Raw text at the bottom */}
                      {selectedImage.ocr_raw_text && (
                        <details className="raw-text-details">
                          <summary>View Raw Text</summary>
                          <div className="ocr-text">{selectedImage.ocr_raw_text}</div>
                        </details>
                      )}
                    </div>
                  )}
                  
                  {!loadingElements && ocrElements.length === 0 && (
                    <p className="ocr-status">No text elements found</p>
                  )}
                </div>
              )}
              
              {!selectedImage.ocr_processed && (
                <p className="ocr-status">⏳ OCR processing in progress...</p>
              )}
              
              <button 
                className="modal-delete-btn"
                onClick={() => handleDelete(selectedImage.id)}
              >
                Delete Image
              </button>
            </div>
          </div>
        </div>
      )}

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

export default ResourceImages;

