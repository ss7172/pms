import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import Navbar from '../common/Navbar';

export default function VisitForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get('appointment_id');

  const [appointment, setAppointment] = useState(null);
  const [form, setForm] = useState({
    appointment_id: appointmentId || '',
    symptoms: '',
    diagnosis: '',
    diagnosis_code: '',
    prescription: '',
    follow_up_notes: '',
    follow_up_date: '',
  });

  const [loading, setLoading] = useState(false);
  const [fetchingAppointment, setFetchingAppointment] = useState(Boolean(appointmentId));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!appointmentId) return;

    const fetchAppointment = async () => {
      try {
        const data = await api.get(`/appointments/${appointmentId}`);
        setAppointment(data.appointment);
      } catch (err) {
        setError('Failed to load appointment details');
      } finally {
        setFetchingAppointment(false);
      }
    };

    fetchAppointment();
  }, [appointmentId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        ...form,
        appointment_id: parseInt(form.appointment_id),
        follow_up_date: form.follow_up_date || null,
      };

      await api.post('/visits', payload);
      navigate('/appointments/today');
    } catch (err) {
      setError(err.error || 'Failed to create visit record');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingAppointment) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f7fafc', fontFamily: 'system-ui, sans-serif' }}>
        <Navbar />
        <div style={{ padding: '2rem' }}>Loading appointment...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f7fafc', fontFamily: 'system-ui, sans-serif' }}>
      <Navbar />
      <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>

        {/* Header */}
        <div style={styles.pageHeader}>
          <div>
            <h1 style={styles.title}>Clinical Visit Notes</h1>
            <p style={styles.subtitle}>Record diagnosis and prescription</p>
          </div>
          <button
            onClick={() => navigate('/appointments/today')}
            style={styles.backBtn}
          >
            ← Back
          </button>
        </div>

        {/* Appointment Context */}
        {appointment && (
          <div style={styles.contextCard}>
            <div style={styles.contextRow}>
              <div>
                <span style={styles.contextLabel}>Patient</span>
                <span style={styles.contextValue}>{appointment.patient_name}</span>
              </div>
              <div>
                <span style={styles.contextLabel}>Doctor</span>
                <span style={styles.contextValue}>{appointment.doctor_name}</span>
              </div>
              <div>
                <span style={styles.contextLabel}>Department</span>
                <span style={styles.contextValue}>{appointment.department_name}</span>
              </div>
              <div>
                <span style={styles.contextLabel}>Time</span>
                <span style={styles.contextValue}>{appointment.appointment_time}</span>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <div style={styles.formCard}>
          {error && <div style={styles.errorBanner}>{error}</div>}

          <form onSubmit={handleSubmit}>

            {/* Symptoms */}
            <div style={styles.field}>
              <label style={styles.label}>Symptoms</label>
              <textarea
                name="symptoms"
                value={form.symptoms}
                onChange={handleChange}
                rows={3}
                placeholder="Patient-reported symptoms..."
                style={{ ...styles.input, resize: 'vertical' }}
              />
            </div>

            {/* Diagnosis */}
            <div style={styles.field}>
              <label style={styles.label}>Diagnosis *</label>
              <textarea
                name="diagnosis"
                value={form.diagnosis}
                onChange={handleChange}
                rows={3}
                required
                placeholder="Clinical diagnosis..."
                style={{ ...styles.input, resize: 'vertical' }}
              />
            </div>

            {/* Diagnosis Code */}
            <div style={styles.field}>
              <label style={styles.label}>ICD-10 Code</label>
              <input
                name="diagnosis_code"
                value={form.diagnosis_code}
                onChange={handleChange}
                placeholder="e.g. I20.9"
                style={styles.input}
              />
            </div>

            {/* Prescription */}
            <div style={styles.field}>
              <label style={styles.label}>Prescription</label>
              <textarea
                name="prescription"
                value={form.prescription}
                onChange={handleChange}
                rows={4}
                placeholder="Medications, dosage, frequency..."
                style={{ ...styles.input, resize: 'vertical' }}
              />
            </div>

            {/* Follow-up */}
            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Follow-up Date</label>
                <input
                  type="date"
                  name="follow_up_date"
                  value={form.follow_up_date}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Follow-up Notes</label>
                <input
                  name="follow_up_notes"
                  value={form.follow_up_notes}
                  onChange={handleChange}
                  placeholder="Instructions for follow-up..."
                  style={styles.input}
                />
              </div>
            </div>

            {/* Submit */}
            <div style={styles.actions}>
              <button
                type="button"
                onClick={() => navigate('/appointments/today')}
                style={styles.cancelBtn}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  ...styles.submitBtn,
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Saving...' : 'Save Visit Notes'}
              </button>
            </div>
          </form>
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
  contextCard: {
    backgroundColor: '#ebf8ff',
    border: '1px solid #bee3f8',
    borderRadius: '8px',
    padding: '1rem 1.25rem',
    marginBottom: '1.5rem',
  },
  contextRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1rem',
  },
  contextLabel: {
    display: 'block',
    fontSize: '0.7rem',
    fontWeight: '700',
    color: '#2b6cb0',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.2rem',
  },
  contextValue: {
    display: 'block',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#1a365d',
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: '10px',
    padding: '2rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  errorBanner: {
    backgroundColor: '#fff5f5',
    border: '1px solid #fc8181',
    color: '#c53030',
    padding: '0.75rem 1rem',
    borderRadius: '6px',
    marginBottom: '1.5rem',
    fontSize: '0.875rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    marginBottom: '1.25rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#4a5568',
  },
  input: {
    padding: '0.6rem 0.875rem',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '0.9rem',
    outline: 'none',
    fontFamily: 'system-ui, sans-serif',
    width: '100%',
    boxSizing: 'border-box',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '1rem',
    marginTop: '1.5rem',
    paddingTop: '1.5rem',
    borderTop: '1px solid #e2e8f0',
  },
  cancelBtn: {
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    color: '#4a5568',
    padding: '0.6rem 1.5rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontFamily: 'system-ui, sans-serif',
  },
  submitBtn: {
    backgroundColor: '#38a169',
    color: 'white',
    border: 'none',
    padding: '0.6rem 1.5rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '600',
    fontFamily: 'system-ui, sans-serif',
  },
};