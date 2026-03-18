import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import Navbar from '../common/Navbar';

const STATUS_COLORS = {
  pending: { bg: '#fffaf0', color: '#c05621' },
  paid: { bg: '#f0fff4', color: '#276749' },
  partially_paid: { bg: '#ebf8ff', color: '#2b6cb0' },
  waived: { bg: '#fafafa', color: '#718096' },
};

export default function BillingList() {
  const [records, setRecords] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  useEffect(() => {
    const fetchBilling = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter) params.append('status', statusFilter);
        const data = await api.get(`/billing?${params}&per_page=50`);
        setRecords(data.billing_records);
      } catch (err) {
        setError('Failed to load billing records');
      } finally {
        setLoading(false);
      }
    };
    fetchBilling();
  }, [statusFilter]);

  const totalPending = records
    .filter(r => r.status === 'pending')
    .reduce((sum, r) => sum + r.total_amount, 0);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f7fafc', fontFamily: 'system-ui, sans-serif' }}>
      <Navbar />
      <div style={{ padding: '2rem' }}>

        {/* Header */}
        <div style={styles.pageHeader}>
          <div>
            <h1 style={styles.title}>Billing</h1>
            <p style={styles.subtitle}>{records.length} records</p>
          </div>
          {statusFilter === 'pending' && records.length > 0 && (
            <div style={styles.pendingAlert}>
              ₹{totalPending.toLocaleString('en-IN')} outstanding
            </div>
          )}
        </div>

        {/* Filter */}
        <div style={styles.filterBar}>
          {['', 'pending', 'paid', 'partially_paid', 'waived'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              style={{
                ...styles.filterBtn,
                ...(statusFilter === status ? styles.filterBtnActive : {}),
              }}
            >
              {status === '' ? 'All' : status.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={styles.tableContainer}>
          {loading ? (
            <div style={styles.center}>Loading billing records...</div>
          ) : error ? (
            <div style={{ padding: '2rem', color: '#e53e3e', textAlign: 'center' }}>{error}</div>
          ) : records.length === 0 ? (
            <div style={styles.center}>No billing records found.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Invoice #', 'Patient', 'Amount', 'Status', 'Date', 'Action'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(record => {
                  const statusStyle = STATUS_COLORS[record.status] || STATUS_COLORS.pending;
                  return (
                    <tr
                      key={record.id}
                      style={styles.tr}
                      onClick={() => navigate(`/billing/${record.id}`)}
                    >
                      <td style={styles.td}>
                        <span style={styles.invoiceNum}>#{record.id}</span>
                      </td>
                      <td style={styles.td}>{record.patient_name}</td>
                      <td style={styles.td}>
                        <strong>₹{record.total_amount.toLocaleString('en-IN')}</strong>
                      </td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.statusBadge,
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.color,
                        }}>
                          {record.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {new Date(record.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td style={styles.td}>
                        <span style={styles.viewLink}>View →</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
  pendingAlert: {
    backgroundColor: '#fffaf0',
    border: '1px solid #fbd38d',
    color: '#c05621',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    fontWeight: '700',
    fontSize: '0.9rem',
  },
  filterBar: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  filterBtn: {
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    color: '#4a5568',
    padding: '0.4rem 1rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontFamily: 'system-ui, sans-serif',
    textTransform: 'capitalize',
  },
  filterBtnActive: {
    backgroundColor: '#3182ce',
    borderColor: '#3182ce',
    color: 'white',
    fontWeight: '600',
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
  },
  td: {
    padding: '0.875rem 1rem',
    fontSize: '0.9rem',
    color: '#2d3748',
  },
  invoiceNum: {
    fontWeight: '700',
    color: '#2b6cb0',
  },
  statusBadge: {
    padding: '0.25rem 0.6rem',
    borderRadius: '4px',
    fontSize: '0.8rem',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  viewLink: {
    color: '#3182ce',
    fontWeight: '600',
    fontSize: '0.875rem',
  },
};