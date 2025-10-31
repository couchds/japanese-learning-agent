import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './Resources.css';

interface Resource {
  id: number;
  name: string;
  type: string;
  status: string;
  description?: string;
  difficulty_level?: string;
  tags: string[];
  created_at: string;
}

const Resources: React.FC = () => {
  const { token } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'book',
    status: 'not_started',
    description: '',
    difficulty_level: '',
    tags: ''
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchResources();
    }
  }, [token]);

  const fetchResources = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/resources', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch resources');
      }

      const data = await response.json();
      setResources(data.resources);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // Use FormData for file upload
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('type', formData.type);
      formDataToSend.append('status', formData.status);
      if (formData.description) formDataToSend.append('description', formData.description);
      if (formData.difficulty_level) formDataToSend.append('difficulty_level', formData.difficulty_level);
      
      // Send tags as JSON string
      const tags = formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(t => t) : [];
      formDataToSend.append('tags', JSON.stringify(tags));
      
      // Add image if selected
      if (selectedImage) {
        formDataToSend.append('image', selectedImage);
      }

      const response = await fetch('http://localhost:3001/api/resources', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // Don't set Content-Type - browser will set it with boundary for multipart/form-data
        },
        body: formDataToSend
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create resource');
      }

      // Reset form and refresh list
      setFormData({
        name: '',
        type: 'book',
        status: 'not_started',
        description: '',
        difficulty_level: '',
        tags: ''
      });
      setSelectedImage(null);
      setImagePreview(null);
      setShowAddForm(false);
      fetchResources();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this resource?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/resources/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete resource');
      }

      fetchResources();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const classes: { [key: string]: string } = {
      'not_started': 'status-not-started',
      'in_progress': 'status-in-progress',
      'completed': 'status-completed',
      'on_hold': 'status-on-hold',
      'dropped': 'status-dropped'
    };
    return classes[status] || '';
  };

  const formatType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading) {
    return <div className="loading">Loading resources...</div>;
  }

  return (
    <div className="resources-page">
      <div className="resources-header">
        <h1>My Learning Resources</h1>
        <button 
          className="add-resource-btn"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : '+ Add Resource'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showAddForm && (
        <div className="add-resource-form">
          <h2>Add New Resource</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">Name *</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="type">Type *</label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  required
                >
                  <option value="book">Book</option>
                  <option value="manga">Manga</option>
                  <option value="anime">Anime</option>
                  <option value="video_game">Video Game</option>
                  <option value="podcast">Podcast</option>
                  <option value="website">Website</option>
                  <option value="news_article">News Article</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                  <option value="dropped">Dropped</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="difficulty_level">Difficulty</label>
                <select
                  id="difficulty_level"
                  value={formData.difficulty_level}
                  onChange={(e) => setFormData({ ...formData, difficulty_level: e.target.value })}
                >
                  <option value="">Select...</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="tags">Tags (comma-separated)</label>
              <input
                type="text"
                id="tags"
                placeholder="e.g. grammar, vocabulary, JLPT"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="image">Image (optional)</label>
              <input
                type="file"
                id="image"
                accept="image/*"
                onChange={handleImageChange}
              />
              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="Preview" />
                </div>
              )}
            </div>

            <button type="submit" className="submit-btn">Add Resource</button>
          </form>
        </div>
      )}

      <div className="resources-list">
        {resources.length === 0 ? (
          <div className="empty-state">
            <p>No resources yet. Add your first learning resource!</p>
          </div>
        ) : (
          <div className="resources-grid">
            {resources.map((resource) => (
              <div key={resource.id} className="resource-card">
                {(resource as any).image_path && (
                  <div className="resource-image">
                    <img 
                      src={`http://localhost:3001${(resource as any).image_path}`} 
                      alt={resource.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                
                <div className="resource-header">
                  <h3>{resource.name}</h3>
                  <button 
                    className="delete-btn"
                    onClick={() => handleDelete(resource.id)}
                    title="Delete resource"
                  >
                    ×
                  </button>
                </div>
                
                <div className="resource-meta">
                  <span className="resource-type">{formatType(resource.type)}</span>
                  <span className={`resource-status ${getStatusBadgeClass(resource.status)}`}>
                    {formatStatus(resource.status)}
                  </span>
                </div>

                {resource.description && (
                  <p className="resource-description">{resource.description}</p>
                )}

                <div className="resource-footer">
                  {resource.difficulty_level && (
                    <span className="difficulty-badge">
                      {resource.difficulty_level.charAt(0).toUpperCase() + resource.difficulty_level.slice(1)}
                    </span>
                  )}
                  {resource.tags && resource.tags.length > 0 && (
                    <div className="resource-tags">
                      {resource.tags.map((tag, idx) => (
                        <span key={idx} className="tag">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Resources;

