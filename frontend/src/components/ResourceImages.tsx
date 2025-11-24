import API_URL from '../config';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './ResourceImages.css';

interface ResourceImage {
  id: number;
  resource_id: number;
  image_path: string;
  notes?: string;
  ocr_processed?: boolean;
  created_at: string;
}

interface ResourceImagesProps {
  resourceId: number;
}

const ResourceImages: React.FC<ResourceImagesProps> = ({ resourceId }) => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [images, setImages] = useState<ResourceImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const handleImageClick = (imageId: number) => {
    navigate(`/images/${imageId}`);
  };

  const handleDelete = async (e: React.MouseEvent, imageId: number) => {
    e.stopPropagation(); // Prevent navigation when clicking delete
    
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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
            onClick={() => handleImageClick(image.id)}
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
                onClick={(e) => handleDelete(e, image.id)}
                title="Delete image"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResourceImages;
