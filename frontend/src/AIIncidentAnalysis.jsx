import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Video, 
  MapPin, 
  PhoneCall, 
  BrainCircuit, 
  CheckCircle2, 
  AlertTriangle,
  Siren,
  Loader2,
  ExternalLink,
  Play
} from 'lucide-react';

const AIIncidentAnalysis = ({ onIncidentDetected }) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [location, setLocation] = useState('Sector V, Salt Lake');
  const [status, setStatus] = useState('IDLE'); // IDLE | DOWNLOADING | ANALYZING | DONE
  const [result, setResult] = useState(null);
  const [callStatus, setCallStatus] = useState('PENDING'); // PENDING | IN_PROGRESS | COMPLETED

  const handleAnalyze = () => {
    if (!videoUrl) return;

    setStatus('DOWNLOADING');
    setResult(null);
    setCallStatus('PENDING');

    // Simulate the process (since real backend integration depends on API keys)
    setTimeout(() => {
      setStatus('ANALYZING');
      
      setTimeout(() => {
        // Mock result based on URL keywords or random
        const types = ['ROAD_ACCIDENT', 'ANTI_SOCIAL', 'NORMAL'];
        let detected = types[Math.floor(Math.random() * types.length)];
        
        if (videoUrl.toLowerCase().includes('accident') || videoUrl.toLowerCase().includes('crash')) {
          detected = 'ROAD_ACCIDENT';
        } else if (videoUrl.toLowerCase().includes('fight') || videoUrl.toLowerCase().includes('crime')) {
          detected = 'ANTI_SOCIAL';
        }

        setResult(detected);
        setStatus('DONE');

        if (detected !== 'NORMAL') {
          triggerEmergencyCall(detected);
          if (onIncidentDetected) {
            onIncidentDetected(detected, location);
          }
        }
      }, 3000);
    }, 2000);
  };

  const triggerEmergencyCall = (type) => {
    setCallStatus('IN_PROGRESS');
    setTimeout(() => {
      setCallStatus('COMPLETED');
    }, 4000);
  };

  const getResultColor = () => {
    if (result === 'ROAD_ACCIDENT') return '#f87171';
    if (result === 'ANTI_SOCIAL') return '#fb923c';
    if (result === 'NORMAL') return '#34d399';
    return 'var(--text-muted)';
  };

  return (
    <div className="card glass" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <BrainCircuit size={20} color="#fff" />
        </div>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>AI Autonomous Incident Detection</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Powered by Gemini Vision API & Twilio Voice</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Left: Input & Trigger */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="input-group">
            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
              VIDEO SOURCE (Youtube URL or Camera Feed)
            </label>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="https://youtube.com/watch?v=..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: 10,
                  border: '1px solid var(--bg-highlight)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem'
                }}
              />
              <Video size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
            </div>
          </div>

          <div className="input-group">
            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
              INCIDENT LOCATION
            </label>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: 10,
                  border: '1px solid var(--bg-highlight)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem'
                }}
              />
              <MapPin size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 12 }} />
            </div>
          </div>

          <button 
            onClick={handleAnalyze}
            disabled={status !== 'IDLE' && status !== 'DONE'}
            style={{
              padding: '12px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #8b5cf6, #d946ef)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s',
              opacity: (status !== 'IDLE' && status !== 'DONE') ? 0.6 : 1,
            }}
          >
            {status === 'ANALYZING' || status === 'DOWNLOADING' ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                {status}...
              </>
            ) : (
              <>
                <BrainCircuit size={18} />
                Start Autonomous Agent
              </>
            )}
          </button>
        </div>

        {/* Right: Analysis Results */}
        <div style={{ 
          background: 'var(--bg-surface)', 
          borderRadius: 12, 
          padding: 16,
          border: '1px solid var(--bg-highlight)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          minHeight: 180,
          position: 'relative',
          overflow: 'hidden'
        }}>
          {status === 'IDLE' && (
            <div style={{ color: 'var(--text-muted)' }}>
              <Video size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p style={{ fontSize: '0.8rem' }}>Waiting for input to start analysis...</p>
            </div>
          )}

          {(status === 'DOWNLOADING' || status === 'ANALYZING') && (
            <div>
              <Loader2 className="animate-spin" size={32} color="#8b5cf6" style={{ marginBottom: 12 }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{status}...</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {status === 'ANALYZING' ? 'Consulting Gemini Vision model...' : 'Retrieving high-resolution buffer...'}
              </p>
            </div>
          )}

          {status === 'DONE' && result && (
            <div style={{ width: '100%', animation: 'fadeIn 0.5s' }}>
              <div style={{
                padding: '4px 12px', borderRadius: 20,
                background: `${getResultColor()}15`,
                border: `1px solid ${getResultColor()}30`,
                color: getResultColor(),
                fontSize: '0.7rem', fontWeight: 800,
                display: 'inline-flex', alignItems: 'center', gap: 6,
                marginBottom: 10
              }}>
                {result === 'NORMAL' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                {result.replace('_', ' ')}
              </div>
              
              <h4 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 800 }}>
                {result === 'NORMAL' ? 'Safe Environment' : 'Emergency Detected'}
              </h4>
              
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                Detected at <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{location}</span>
              </p>

              {result !== 'NORMAL' && (
                <div style={{ 
                  padding: 12, borderRadius: 10, background: 'var(--bg-card)',
                  border: '1px solid var(--bg-highlight)', textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: callStatus === 'COMPLETED' ? '#34d39915' : '#8b5cf615',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <PhoneCall size={14} color={callStatus === 'COMPLETED' ? '#34d399' : '#8b5cf6'} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700 }}>Twilio Autonomous Call</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {callStatus === 'COMPLETED' ? (
                          <>
                            <CheckCircle2 size={10} color="#34d399" />
                            Report successfully delivered to authorities
                          </>
                        ) : (
                          <>
                            <Loader2 className="animate-spin" size={10} />
                            Initiating emergency dispatch call...
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIIncidentAnalysis;
