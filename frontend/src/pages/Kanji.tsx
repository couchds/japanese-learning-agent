import React, { useState, useEffect } from 'react';
import * as wanakana from 'wanakana';
import './Kanji.css';

interface KanjiData {
  id: number;
  literal: string;
  meanings: string[];
  on_readings: string[] | null;
  kun_readings: string[] | null;
  frequency_rank: number | null;
}

const Kanji: React.FC = () => {
  const [kanji, setKanji] = useState<KanjiData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 50;

  useEffect(() => {
    fetchKanji();
  }, []);

  const fetchKanji = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/kanji?limit=2500`);
      if (!response.ok) {
        throw new Error('Failed to fetch kanji');
      }
      const data = await response.json();
      setKanji(data.kanji);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Filter kanji based on search term
  const filteredKanji = kanji.filter((k) => {
    const searchLower = searchTerm.toLowerCase();
    
    // Convert romaji to hiragana and katakana for reading search
    const searchHiragana = wanakana.toHiragana(searchTerm);
    const searchKatakana = wanakana.toKatakana(searchTerm);
    
    return (
      k.literal.includes(searchTerm) ||
      k.meanings?.some((m) => m.toLowerCase().includes(searchLower)) ||
      // Search on readings using original, hiragana, and katakana versions
      k.on_readings?.some((r) => 
        r.includes(searchTerm) || 
        r.includes(searchHiragana) || 
        r.includes(searchKatakana)
      ) ||
      k.kun_readings?.some((r) => 
        r.includes(searchTerm) || 
        r.includes(searchHiragana) ||
        r.includes(searchKatakana)
      )
    );
  });

  // Paginate filtered results
  const totalPages = Math.ceil(filteredKanji.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentKanji = filteredKanji.slice(startIndex, endIndex);

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
    return <div className="loading">Loading kanji...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="kanji-page">
      <h1>Kanji Dictionary</h1>
      
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by character, meaning, reading, or romaji (e.g. 'kuni')..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span className="search-results">
          Showing {filteredKanji.length} kanji
        </span>
      </div>

      <div className="table-container">
        <table className="kanji-table">
          <thead>
            <tr>
              <th>Character</th>
              <th>Meanings</th>
              <th>Onyomi</th>
              <th>Kunyomi</th>
              <th>Frequency</th>
            </tr>
          </thead>
          <tbody>
            {currentKanji.map((k) => (
              <tr key={k.id}>
                <td className="kanji-character">{k.literal}</td>
                <td className="meanings">
                  {k.meanings?.join(', ') || '-'}
                </td>
                <td className="readings">
                  {k.on_readings?.join('、') || '-'}
                </td>
                <td className="readings">
                  {k.kun_readings?.join('、') || '-'}
                </td>
                <td className="frequency">
                  {k.frequency_rank || '-'}
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

export default Kanji;
