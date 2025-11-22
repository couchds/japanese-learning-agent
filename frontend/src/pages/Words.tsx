import API_URL from '../config';
import React, { useState, useEffect } from 'react';
import * as wanakana from 'wanakana';
import { useAuth } from '../context/AuthContext';
import './Words.css';

interface WordData {
  id: number;
  entry_id: number;
  kanji_forms: string[] | null;
  readings: string[] | null;
  glosses: string[] | null;
  parts_of_speech: string[] | null;
  is_common: boolean;
  frequency_score: number;
}

const Words: React.FC = () => {
  const { token } = useAuth();
  const [words, setWords] = useState<WordData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 50;

  useEffect(() => {
    if (token) {
      fetchWords();
    }
  }, [token]);

  const fetchWords = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/words?limit=2000`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch words');
      }
      const data = await response.json();
      setWords(data.words);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Filter words based on search term
  const filteredWords = words.filter((w) => {
    const searchLower = searchTerm.toLowerCase();
    
    // Convert romaji to hiragana and katakana for reading search
    const searchHiragana = wanakana.toHiragana(searchTerm);
    const searchKatakana = wanakana.toKatakana(searchTerm);
    
    return (
      w.kanji_forms?.some((k) => k.includes(searchTerm)) ||
      w.readings?.some((r) => 
        r.includes(searchTerm) || 
        r.includes(searchHiragana) || 
        r.includes(searchKatakana)
      ) ||
      w.glosses?.some((g) => g.toLowerCase().includes(searchLower))
    );
  });

  // Paginate filtered results
  const totalPages = Math.ceil(filteredWords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentWords = filteredWords.slice(startIndex, endIndex);

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderPagination = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
      pages.push(
        <button key={1} onClick={() => handlePageChange(1)}>
          1
        </button>
      );
      if (startPage > 2) {
        pages.push(<span key="ellipsis-start">...</span>);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={currentPage === i ? 'active' : ''}
        >
          {i}
        </button>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(<span key="ellipsis-end">...</span>);
      }
      pages.push(
        <button key={totalPages} onClick={() => handlePageChange(totalPages)}>
          {totalPages}
        </button>
      );
    }

    return pages;
  };

  if (loading) {
    return <div className="loading">Loading words...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="words-page">
      <h1>Word Dictionary</h1>
      
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by kanji, reading, romaji, or English meaning..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span className="search-results">
          Showing {filteredWords.length} words
        </span>
      </div>

      <div className="table-container">
        <table className="words-table">
          <thead>
            <tr>
              <th>Kanji</th>
              <th>Reading</th>
              <th>Meaning</th>
              <th>Part of Speech</th>
            </tr>
          </thead>
          <tbody>
            {currentWords.map((w) => (
              <tr key={w.id} className={w.is_common ? 'common-word' : ''}>
                <td className="word-kanji">
                  {w.kanji_forms && w.kanji_forms.length > 0
                    ? w.kanji_forms.join('、')
                    : '-'}
                </td>
                <td className="word-reading">
                  {w.readings && w.readings.length > 0
                    ? w.readings.join('、')
                    : '-'}
                </td>
                <td className="word-meaning">
                  {w.glosses && w.glosses.length > 0
                    ? w.glosses.slice(0, 3).join('; ')
                    : '-'}
                  {w.glosses && w.glosses.length > 3 && '...'}
                </td>
                <td className="word-pos">
                  {w.parts_of_speech && w.parts_of_speech.length > 0
                    ? w.parts_of_speech.slice(0, 2).join(', ')
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          {renderPagination()}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}

      <div className="page-info">
        Page {currentPage} of {totalPages}
      </div>
    </div>
  );
};

export default Words;

