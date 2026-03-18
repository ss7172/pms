import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import Navbar from '../common/Navbar';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add line item form
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ description: '', category: 'test', amount: '' });
  const [addingItem, setAddingItem] = useState(false);

  // Payment form
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [processingPayment, setProcessingPayment] = useState(false);

  const fetchRecord = async () => {
    try {
      const data = await api.get(`/billing/${id}`);
      setRecord(data.billing_record);
    } catch (err) {
      setError('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecord();
  }, [id]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    setAddingItem(true);
    try {
      await api.post(`/billing/${id}/items`, {
        ...newItem,
        amount: parseFloat(newItem.amount),
      });
      setNewItem({ description: '', category: 'test', amount: '' });
      setShowAddItem(false);
      await fetchRecord();
    } catch (err) {
      alert(err.error || 'Failed to add item');
    } finally {
      setAddingItem(false);
    }
  };

  const handleRemoveItem = async (itemId) => {
    if (!window.confirm('Remove this line item?')) return;
    try {
      await api.delete(`/billing/${id}/items/${itemId}`);
      await fetchRecord();
    } catch (err) {
      alert(err.error || 'Failed to remove item');
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setProcessingPayment(true);
    try {
      await api.patch(`/billing/${id}/pay`, { payment_method: paymentMethod });
      setShowPayment(false);
      await fetchRecord();
    } catch (err) {
      alert(err.error || 'Failed to process payment');
    } finally {
      setProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f7fafc', fontFamily: 'system-ui, sans-serif' }}>
        <Navbar />
        <div style={{ padding: '2rem' }}>Loading invoice...</div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f7fafc', fontFamily: 'system-ui, sans-serif' }}>
        <Navbar />
        <div style={{ padding: '2rem', color: '#e53e3e' }}>{error}</div>
      </div>
    );
  }

  const isPaid = record.status === 'paid' || record.status === 'waived';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f7fafc', fontFamily: 'system-ui, sans-serif' }}>
      <Navbar />
      <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>

        {/* Header */}
        <div style={styles.pageHeader}>
          <div>
            <h1 style={styles.title}>Invoice #{record.id}</h1>
            <p style={styles.subtitle}>{record.patient_name}</p>
          </div>
          <button onClick={() => navigate('/billing')} style={styles.backBtn}>
            ← Back
          </button>
        </div>

        {/* Invoice Card */}
        <div style={styles.card}>

          {/* Status Banner */}
          <div style={{
            ...styles.statusBanner,
            backgroundColor: record.status === 'paid' ? '#f0fff4' : '#fffaf0',
            borderColor: record.status === 'paid' ? '#9ae6b4' : '#fbd38d',
            color: record.status === 'paid' ? '#276749' : '#c05621',
          }}>
            <span style={styles.statusText}>
              {record.status.replace('_', ' ').toUpperCase()}
            </span>
            {record.payment_method && (
              <span style={styles.paymentMethod}>
                via {record.payment_method}
              </span>
            )}
            {record.payment_date && (
              <span style={styles.paymentDate}>
                on {new Date(record.payment_date).toLocaleDateString('en-IN')}
              </span>
            )}
          </div>

          {/* Line Items */}
          <table style={styles.table}>
            <thead>
              <tr>
                {['Description', 'Category', 'Amount', ''].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {record.items.map(item => (
                <tr key={item.id} style={styles.tr}>
                  <td style={styles.td}>{item.description}</td>
                  <td style={styles.td}>
                    <span style={styles.categoryBadge}>{item.category}</span>
                  </td>
                  <td style={{ ...styles.td, fontWeight: '600' }}>
                    ₹{item.amount.toLocaleString('en-IN')}
                  </td>
                  <td style={styles.td}>
                    {!isPaid && item.category !== 'consultation' && (
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        style={styles.removeBtn}
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total */}
          <div style={styles.totalRow}>
            <span style={styles.totalLabel}>Total Amount</span>
            <span style={styles.totalValue}>
              ₹{record.total_amount.toLocaleString('en-IN')}
            </span>
          </div>

          {/* Add Line Item Form */}
          {!isPaid && showAddItem && (
            <form onSubmit={handleAddItem} style={styles.addItemForm}>
              <div style={styles.addItemRow}>
                <input
                  placeholder="Description (e.g. ECG)"
                  value={newItem.description}
                  onChange={e => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                  required
                  style={styles.input}
                />
                <select
                  value={newItem.category}
                  onChange={e => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                  style={styles.input}
                >
                  <option value="test">Test</option>
                  <option value="procedure">Procedure</option>
                  <option value="other">Other</option>
                </select>
                <input
                  type="number"
                  placeholder="Amount"
                  value={newItem.amount}
                  onChange={e => setNewItem(prev => ({ ...prev, amount: e.target.value }))}
                  required
                  min="0"
                  style={{ ...styles.input, maxWidth: '120px' }}
                />
                <button
                  type="submit"
                  disabled={addingItem}
                  style={styles.addBtn}
                >
                  {addingItem ? 'Adding...' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddItem(false)}
                  style={styles.cancelSmallBtn}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Actions */}
          {!isPaid && (
            <div style={styles.actions}>
              {!showAddItem && (
                <button
                  onClick={() => setShowAddItem(true)}
                  style={styles.secondaryBtn}
                >
                  + Add Test / Procedure
                </button>
              )}
              {!showPayment && (
                <button
                  onClick={() => setShowPayment(true)}
                  style={styles.primaryBtn}
                >
                  Process Payment
                </button>
              )}
            </div>
          )}

          {/* Payment Form */}
          {!isPaid && showPayment && (
            <form onSubmit={handlePayment} style={styles.paymentForm}>
              <h3 style={styles.paymentTitle}>
                Collect ₹{record.total_amount.toLocaleString('en-IN')}
              </h3>
              <div style={styles.paymentMethods}>
                {['cash', 'card', 'upi', 'insurance'].map(method => (
                  <label key={method} style={styles.radioLabel}>
                    <input
                      type="radio"
                      name="payment_method"
                      value={method}
                      checked={paymentMethod === method}
                      onChange={e => setPaymentMethod(e.target.value)}
                    />
                    <span style={styles.radioText}>{method.toUpperCase()}</span>
                  </label>
                ))}
              </div>
              <div style={styles.paymentActions}>
                <button
                  type="button"
                  onClick={() => setShowPayment(false)}
                  style={styles.cancelSmallBtn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingPayment}
                  style={{ ...styles.primaryBtn, opacity: processingPayment ? 0.7 : 1 }}
                >
                  {processingPayment ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
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
  backBtn: {
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    color: '#4a5568',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '10px',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  statusBanner: {
    border: '1px solid',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    marginBottom: '1.5rem',
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
  },
  statusText: {
    fontWeight: '800',
    fontSize: '0.875rem',
    letterSpacing: '0.05em',
  },
  paymentMethod: {
    fontSize: '0.875rem',
    fontWeight: '600',
  },
  paymentDate: {
    fontSize: '0.875rem',
    color: '#718096',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '1rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.6rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: '#718096',
    textTransform: 'uppercase',
    borderBottom: '2px solid #e2e8f0',
  },
  tr: {
    borderBottom: '1px solid #f0f4f8',
  },
  td: {
    padding: '0.75rem',
    fontSize: '0.9rem',
    color: '#2d3748',
  },
  categoryBadge: {
    backgroundColor: '#ebf8ff',
    color: '#2b6cb0',
    padding: '0.15rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  removeBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#fc8181',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '700',
    padding: '0.2rem 0.5rem',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 0.75rem',
    borderTop: '2px solid #e2e8f0',
    marginBottom: '1.5rem',
  },
  totalLabel: {
    fontWeight: '700',
    fontSize: '1rem',
    color: '#2d3748',
  },
  totalValue: {
    fontWeight: '800',
    fontSize: '1.25rem',
    color: '#1a202c',
  },
  addItemForm: {
    backgroundColor: '#f7fafc',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1rem',
  },
  addItemRow: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  input: {
    padding: '0.5rem 0.75rem',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '0.875rem',
    outline: 'none',
    fontFamily: 'system-ui, sans-serif',
    flex: 1,
    minWidth: '120px',
    boxSizing: 'border-box',
  },
  addBtn: {
    backgroundColor: '#3182ce',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '600',
    fontFamily: 'system-ui, sans-serif',
  },
  cancelSmallBtn: {
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    color: '#718096',
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontFamily: 'system-ui, sans-serif',
  },
  actions: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'flex-end',
  },
  secondaryBtn: {
    backgroundColor: 'white',
    border: '1px solid #3182ce',
    color: '#3182ce',
    padding: '0.6rem 1.25rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '600',
    fontFamily: 'system-ui, sans-serif',
  },
  primaryBtn: {
    backgroundColor: '#38a169',
    color: 'white',
    border: 'none',
    padding: '0.6rem 1.25rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '600',
    fontFamily: 'system-ui, sans-serif',
  },
  paymentForm: {
    backgroundColor: '#f7fafc',
    borderRadius: '8px',
    padding: '1.25rem',
    marginTop: '1rem',
  },
  paymentTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: '#2d3748',
    margin: '0 0 1rem',
  },
  paymentMethods: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1rem',
    flexWrap: 'wrap',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    cursor: 'pointer',
  },
  radioText: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#4a5568',
  },
  paymentActions: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'flex-end',
  },
};