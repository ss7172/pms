import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import Navbar from '../common/Navbar';

export default function PatientList() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page,
        per_page: 20,
        ...(search && { search }),
      });
      const data = await api.get(`/patients?${params}`);
      setPatients(data.items);
      setTotalPages(data.pages);
      setTotal(data.total);
    } catch (err) {
      setError('Failed to load patients');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  // Fetch when page or search changes
  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Reset to page 1 when search changes
  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f7fafc', fontFamily: 'system-ui, sans-serif' }}>
      <Navbar />
      <div style={{ padding: '2rem' }}>

        {/* Page Header */}
        <div style={styles.pageHeader}>
          <div>
            <h1 style={styles.title}>Patients</h1>
            <p style={styles.subtitle}>{total.toLocaleString('en-IN')} total patients</p>
          </div>
          <button
            onClick={() => navigate('/patients/new')}
            style={styles.primaryBtn}
          >
            + Register Patient
          </button>
        </div>

        {/* Search */}
        <div style={styles.searchBar}>
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={handleSearch}
            style={styles.searchInput}
          />
        </div>

        {/* Table */}
        <div style={styles.tableContainer}>
          {loading ? (
            <div style={styles.center}>Loading patients...</div>
          ) : error ? (
            <div style={styles.errorMsg}>{error}</div>
          ) : patients.length === 0 ? (
            <div style={styles.center}>No patients found</div>
          ) : (
            <>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Name', 'Age / Gender', 'Phone', 'Blood Group', 'Registered'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {patients.map(patient => (
                    <tr
                      key={patient.id}
                      style={styles.tr}
                      onClick={() => navigate(`/patients/${patient.id}`)}
                    >
                      <td style={styles.td}>
                        <div style={styles.patientName}>{patient.full_name}</div>
                      </td>
                      <td style={styles.td}>
                        {patient.age}y / {patient.gender}
                      </td>
                      <td style={styles.td}>{patient.phone}</td>
                      <td style={styles.td}>
                        <span style={styles.badge}>
                          {patient.blood_group || '—'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {new Date(patient.created_at).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div style={styles.pagination}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    ...styles.pageBtn,
                    opacity: page === 1 ? 0.4 : 1,
                  }}
                >
                  ← Previous
                </button>
                <span style={styles.pageInfo}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    ...styles.pageBtn,
                    opacity: page === totalPages ? 0.4 : 1,
                  }}
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#1a202c',
    margin: '0 0 0.25rem',
  },
  subtitle: {
    color: '#718096',
    fontSize: '0.875rem',
    margin: 0,
  },
  primaryBtn: {
    backgroundColor: '#3182ce',
    color: 'white',
    border: 'none',
    padding: '0.6rem 1.25rem',
    borderRadius: '6px',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
  },
  searchBar: {
    marginBottom: '1rem',
  },
  searchInput: {
    width: '100%',
    maxWidth: '400px',
    padding: '0.6rem 1rem',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '0.9rem',
    outline: 'none',
    fontFamily: 'system-ui, sans-serif',
    boxSizing: 'border-box',
  },
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  center: {
    padding: '3rem',
    textAlign: 'center',
    color: '#718096',
  },
  errorMsg: {
    padding: '2rem',
    textAlign: 'center',
    color: '#e53e3e',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '0.75rem 1rem',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#718096',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '2px solid #e2e8f0',
    backgroundColor: '#f7fafc',
  },
  tr: {
    borderBottom: '1px solid #f0f4f8',
    cursor: 'pointer',
    transition: 'background-color 0.1s',
  },
  td: {
    padding: '0.875rem 1rem',
    fontSize: '0.9rem',
    color: '#2d3748',
  },
  patientName: {
    fontWeight: '600',
    color: '#2b6cb0',
  },
  badge: {
    backgroundColor: '#ebf8ff',
    color: '#2b6cb0',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.8rem',
    fontWeight: '600',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    borderTop: '1px solid #e2e8f0',
  },
  pageBtn: {
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    padding: '0.4rem 1rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontFamily: 'system-ui, sans-serif',
  },
  pageInfo: {
    fontSize: '0.875rem',
    color: '#718096',
  },
};