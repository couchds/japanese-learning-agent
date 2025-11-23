import API_URL from '../config';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './ResourceImages.css';

interface ResourceImage {
  id: number;
  resource_id: number;
  image_path: string;
  notes?: string;
  created_at: string;
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
            onClick={() => setSelectedImage(image)}
          >
            <img 
              src={`${API_URL}${image.image_path}`} 
              alt={`Screenshot ${image.id}`}
              loading="lazy"
            />
            <div className="image-overlay">
              <span className="image-date">{formatDate(image.created_at)}</span>
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
    </div>
  );
};

export default ResourceImages;

