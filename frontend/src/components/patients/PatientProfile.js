import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import Navbar from '../common/Navbar';
import { useAuth } from '../../context/AuthContext';

export default function PatientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const patientData = await api.get(`/patients/${id}`);
        setPatient(patientData.patient);

        // Only doctors and admins can see visit history
        if (['doctor', 'admin'].includes(user.role)) {
          const visitsData = await api.get(`/patients/${id}/visits`);
          setVisits(visitsData.items || []);
        }
      } catch (err) {
        setError('Failed to load patient profile');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, user.role]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f7fafc', fontFamily: 'system-ui, sans-serif' }}>
        <Navbar />
        <div style={{ padding: '2rem' }}>Loading patient...</div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f7fafc', fontFamily: 'system-ui, sans-serif' }}>
        <Navbar />
        <div style={{ padding: '2rem', color: '#e53e3e' }}>{error || 'Patient not found'}</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f7fafc', fontFamily: 'system-ui, sans-serif' }}>
      <Navbar />
      <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>

        {/* Header */}
        <div style={styles.pageHeader}>
          <div>
            <h1 style={styles.title}>{patient.full_name}</h1>
            <p style={styles.subtitle}>Patient ID #{patient.id}</p>
          </div>
          <div style={styles.headerActions}>
            <button
              onClick={() => navigate('/patients')}
              style={styles.backBtn}
            >
              ← Back
            </button>
            {['admin', 'front_desk'].includes(user.role) && (
              <button
                onClick={() => navigate(`/patients/${id}/edit`)}
                style={styles.editBtn}
              >
                Edit Patient
              </button>
            )}
            {['admin', 'front_desk'].includes(user.role) && (
              <button
                onClick={() => navigate(`/appointments/book?patient_id=${id}`)}
                style={styles.primaryBtn}
              >
                Book Appointment
              </button>
            )}
          </div>
        </div>

        {/* Patient Info Card */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Patient Information</h2>
          <div style={styles.infoGrid}>
            <InfoRow label="Full Name" value={patient.full_name} />
            <InfoRow label="Age" value={`${patient.age} years`} />
            <InfoRow label="Date of Birth" value={new Date(patient.date_of_birth).toLocaleDateString('en-IN')} />
            <InfoRow label="Gender" value={patient.gender} />
            <InfoRow label="Phone" value={patient.phone} />
            <InfoRow label="Email" value={patient.email || '—'} />
            <InfoRow label="Blood Group" value={patient.blood_group || '—'} />
            <InfoRow label="Address" value={patient.address || '—'} />
            <InfoRow label="Emergency Contact" value={patient.emergency_contact || '—'} />
            <InfoRow
              label="Registered"
              value={new Date(patient.created_at).toLocaleDateString('en-IN')}
            />
          </div>
        </div>

        {/* Visit History — doctors and admin only */}
        {['doctor', 'admin'].includes(user.role) && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>
              Visit History
              <span style={styles.countBadge}>{visits.length}</span>
            </h2>

            {visits.length === 0 ? (
              <p style={styles.emptyMsg}>No visits recorded yet.</p>
            ) : (
              <div style={styles.visitList}>
                {visits.map(visit => (
                  <div key={visit.id} style={styles.visitCard}>
                    <div style={styles.visitHeader}>
                      <div>
                        <span style={styles.visitDate}>
                          {new Date(visit.created_at).toLocaleDateString('en-IN')}
                        </span>
                        <span style={styles.visitDoctor}>
                          {visit.doctor_name} — {visit.department_name}
                        </span>
                      </div>
                      {visit.diagnosis_code && (
                        <span style={styles.icdBadge}>{visit.diagnosis_code}</span>
                      )}
                    </div>
                    <p style={styles.visitDiagnosis}>{visit.diagnosis}</p>
                    {visit.symptoms && (
                      <p style={styles.visitDetail}>
                        <strong>Symptoms:</strong> {visit.symptoms}
                      </p>
                    )}
                    {visit.prescription && (
                      <p style={styles.visitDetail}>
                        <strong>Prescription:</strong> {visit.prescription}
                      </p>
                    )}
                    {visit.follow_up_date && (
                      <p style={styles.visitDetail}>
                        <strong>Follow-up:</strong>{' '}
                        {new Date(visit.follow_up_date).toLocaleDateString('en-IN')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value}</span>
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
  headerActions: {
    display: 'flex',
    gap: '0.75rem',
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
  editBtn: {
    backgroundColor: 'white',
    border: '1px solid #3182ce',
    color: '#3182ce',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '600',
    fontFamily: 'system-ui, sans-serif',
  },
  primaryBtn: {
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
  card: {
    backgroundColor: 'white',
    borderRadius: '10px',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    marginBottom: '1.5rem',
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: '#2d3748',
    margin: '0 0 1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  countBadge: {
    backgroundColor: '#ebf8ff',
    color: '#2b6cb0',
    padding: '0.1rem 0.5rem',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: '700',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem',
  },
  infoRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    padding: '0.75rem',
    backgroundColor: '#f7fafc',
    borderRadius: '6px',
  },
  infoLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#718096',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  infoValue: {
    fontSize: '0.9rem',
    color: '#2d3748',
    fontWeight: '500',
  },
  emptyMsg: {
    color: '#a0aec0',
    fontSize: '0.9rem',
    textAlign: 'center',
    padding: '2rem',
    margin: 0,
  },
  visitList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  visitCard: {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '1rem',
  },
  visitHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.5rem',
  },
  visitDate: {
    fontSize: '0.875rem',
    fontWeight: '700',
    color: '#2d3748',
    display: 'block',
  },
  visitDoctor: {
    fontSize: '0.8rem',
    color: '#718096',
    display: 'block',
  },
  icdBadge: {
    backgroundColor: '#f0fff4',
    color: '#276749',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '700',
  },
  visitDiagnosis: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#2d3748',
    margin: '0 0 0.5rem',
  },
  visitDetail: {
    fontSize: '0.85rem',
    color: '#4a5568',
    margin: '0.25rem 0 0',
  },
};