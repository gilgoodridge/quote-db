import { useEffect, useState } from 'react';
import { api } from './api';
import './AuthorList.css';

export function AuthorList() {
  const [authors, setAuthors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.authors.list()
      .then(data => {
        setAuthors(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="loading">Loading authors...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="author-list">
      <h2>Authors</h2>
      {authors.length === 0 ? (
        <p className="empty">No authors found</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Given Name</th>
              <th>Family Name</th>
              <th>Date of Birth</th>
              <th>Nationality</th>
            </tr>
          </thead>
          <tbody>
            {authors.map(author => (
              <tr key={author.id}>
                <td>{author.givenName}</td>
                <td>{author.familyName}</td>
                <td>{author.dateOfBirth || '-'}</td>
                <td>{author.nationality || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
