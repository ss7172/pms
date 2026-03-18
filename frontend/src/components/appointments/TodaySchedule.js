import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import Navbar from '../common/Navbar';
import { useAuth } from '../../context/AuthContext';

const STATUS_COLORS = {
  scheduled: { bg: '#ebf8ff', color: '#2b6cb0' },
  in_progress: { bg: '#fffaf0', color: '#c05621' },
  completed: { bg: '#f0fff4', color: '#276749' },
  cancelled: { bg: '#fff5f5', color: '#c53030' },
  no_show: { bg: '#fafafa', color: '#718096' },
};

export default function TodaySchedule() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const data = await api.get('/appointments/today');
      // Doctors only see their own appointments
      const filtered = user.role === 'doctor'
        ? data.appointments.filter(a => a.doctor_name === user.full_name)
        : data.appointments;
      setAppointments(filtered);
    } catch (err) {
      setError('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const updateStatus = async (appointmentId, newStatus) => {
    setUpdatingId(appointmentId);
    try {
      await api.patch(`/appointments/${appointmentId}/status`, {
        status: newStatus,
      });
      await fetchAppointments(); // Refresh list
    } catch (err) {
      alert(err.error || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const getNextActions = (appointment) => {
    const { status } = appointment;
    const role = user.role;

    if (status === 'scheduled' && role === 'doctor') {
      return [{ label: 'Start Consultation', status: 'in_progress', color: '#ed8936' }];
    }
    if (status === 'scheduled' && ['front_desk', 'admin'].includes(role)) {
      return [
        { label: 'Mark No Show', status: 'no_show', color: '#718096' },
        { label: 'Cancel', status: 'cancelled', color: '#e53e3e' },
      ];
    }
    if (status === 'in_progress' && role === 'doctor') {
        return [{ label: 'Write Visit Notes', isLink: true, path: `/visits/new?appointment_id=${appointment.id}`, color: '#38a169' }];
    }
    return [];
  };

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f7fafc', fontFamily: 'system-ui, sans-serif' }}>
      <Navbar />
      <div style={{ padding: '2rem' }}>

        {/* Header */}
        <div style={styles.pageHeader}>
          <div>
            <h1 style={styles.title}>Today's Schedule</h1>
            <p style={styles.subtitle}>{today}</p>
          </div>
          {['admin', 'front_desk'].includes(user.role) && (
            <button
              onClick={() => navigate('/appointments/book')}
              style={styles.primaryBtn}
            >
              + Book Appointment
            </button>
          )}
        </div>

        {/* Stats Row */}
        {!loading && (
          <div style={styles.statsRow}>
            {[
              { label: 'Total', value: appointments.length, color: '#3182ce' },
              { label: 'Scheduled', value: appointments.filter(a => a.status === 'scheduled').length, color: '#ed8936' },
              { label: 'In Progress', value: appointments.filter(a => a.status === 'in_progress').length, color: '#dd6b20' },
              { label: 'Completed', value: appointments.filter(a => a.status === 'completed').length, color: '#38a169' },
            ].map(stat => (
              <div key={stat.label} style={styles.statChip}>
                <span style={{ ...styles.statValue, color: stat.color }}>{stat.value}</span>
                <span style={styles.statLabel}>{stat.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Appointments */}
        <div style={styles.tableContainer}>
          {loading ? (
            <div style={styles.center}>Loading appointments...</div>
          ) : error ? (
            <div style={{ padding: '2rem', color: '#e53e3e', textAlign: 'center' }}>{error}</div>
          ) : appointments.length === 0 ? (
            <div style={styles.center}>No appointments today.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Time', 'Patient', 'Doctor', 'Department', 'Status', 'Actions'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {appointments.map(appt => {
                  const actions = getNextActions(appt);
                  const statusStyle = STATUS_COLORS[appt.status] || STATUS_COLORS.scheduled;

                  return (
                    <tr key={appt.id} style={styles.tr}>
                      <td style={styles.td}>
                        <strong>{appt.appointment_time}</strong>
                      </td>
                      <td style={styles.td}>
                        <div
                          style={styles.patientLink}
                          onClick={() => navigate(`/patients/${appt.patient_id}`)}
                        >
                          {appt.patient_name}
                        </div>
                        <div style={styles.patientPhone}>{appt.patient_phone}</div>
                      </td>
                      <td style={styles.td}>{appt.doctor_name}</td>
                      <td style={styles.td}>{appt.department_name}</td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.statusBadge,
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.color,
                        }}>
                          {appt.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actions}>
                          {actions.map(action => (
                            action.isLink ? (
                                <button
                                key={action.path}
                                onClick={() => navigate(action.path)}
                                style={{
                                    ...styles.actionBtn,
                                    borderColor: action.color,
                                    color: action.color,
                                }}
                                >
                                {action.label}
                                </button>
                            ) : (
                                <button
                                key={action.status}
                                onClick={() => updateStatus(appt.id, action.status)}
                                disabled={updatingId === appt.id}
                                style={{
                                    ...styles.actionBtn,
                                    borderColor: action.color,
                                    color: action.color,
                                    opacity: updatingId === appt.id ? 0.5 : 1,
                                }}
                                >
                                {action.label}
                                </button>
                            )
                            ))}
                        </div>
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
  statsRow: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  statChip: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '0.75rem 1.25rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '80px',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: '700',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#718096',
    fontWeight: '600',
    textTransform: 'uppercase',
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
  },
  td: {
    padding: '0.875rem 1rem',
    fontSize: '0.9rem',
    color: '#2d3748',
  },
  patientLink: {
    fontWeight: '600',
    color: '#2b6cb0',
    cursor: 'pointer',
  },
  patientPhone: {
    fontSize: '0.8rem',
    color: '#718096',
  },
  statusBadge: {
    padding: '0.25rem 0.6rem',
    borderRadius: '4px',
    fontSize: '0.8rem',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  actions: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  actionBtn: {
    backgroundColor: 'white',
    border: '1px solid',
    padding: '0.3rem 0.75rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: '600',
    fontFamily: 'system-ui, sans-serif',
  },
};