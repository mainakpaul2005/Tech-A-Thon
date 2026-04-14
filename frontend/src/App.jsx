import React, { useState, useEffect, useRef, useCallback } from 'react';
import { auth } from './firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { 
  Activity, 
  Truck, 
  Trash2, 
  AlertTriangle, 
  TrendingUp, 
  Zap,
  Radio,
  Clock,
  CheckCircle2,
  Thermometer,
  Wind,
  Droplets,
  Wifi,
  WifiOff,
  BarChart3,
  ShieldAlert,
  Bell,
  TrafficCone,
  CircleDot,
  Siren,
  Timer,
  Settings2,
  ArrowRightLeft,
  MapPin,
  Power,
  Navigation,
  Eye,
  Gauge,
} from 'lucide-react';
import { 
  XAxis, 
  YAxis,
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from 'recharts';
import AIIncidentAnalysis from './AIIncidentAnalysis';

// ═══════════════════════════════════════════════════
//  SIMULATED REAL-TIME DATA ENGINE
//  (Mirrors the MQTT → Edge → Microservice pipeline)
// ═══════════════════════════════════════════════════

const ZONES = ['Z1', 'Z2', 'Z3', 'Z4'];
const BINS = ['B001', 'B002', 'B003', 'B004', 'B005'];
const EMERGENCY_TYPES = ['FIRE', 'MEDICAL', 'ACCIDENT'];

function generateTrafficReading(zone) {
  const vehicleCount = Math.floor(Math.random() * 90) + 10;
  return {
    timestamp: new Date().toISOString(),
    zone_id: zone,
    vehicle_count: vehicleCount,
    avg_speed: Math.floor(Math.random() * 60) + 20,
    status: vehicleCount >= 80 ? 'CONGESTED' : 'NORMAL',
  };
}

function generateWasteReading(binId) {
  return {
    timestamp: new Date().toISOString(),
    bin_id: binId,
    fill_level: Math.floor(Math.random() * 100),
    battery: Math.floor(Math.random() * 80) + 20,
  };
}

function generateEmergency() {
  if (Math.random() < 0.08) {
    return {
      timestamp: new Date().toISOString(),
      type: EMERGENCY_TYPES[Math.floor(Math.random() * EMERGENCY_TYPES.length)],
      location: { lat: 22.57 + (Math.random() - 0.5) * 0.1, lng: 88.36 + (Math.random() - 0.5) * 0.1 },
      severity: 'HIGH',
    };
  }
  return null;
}

// Edge node aggregation simulation
class EdgeNodeSimulator {
  constructor(networkMode = '5G') {
    this.networkMode = networkMode;
    this.trafficBuffer = {};
  }

  setNetworkMode(mode) {
    this.networkMode = mode;
  }

  getAggThreshold() {
    return this.networkMode === '5G' ? 3 : 10;
  }

  processTraffic(data) {
    const zone = data.zone_id;
    if (!this.trafficBuffer[zone]) this.trafficBuffer[zone] = [];
    this.trafficBuffer[zone].push(data.vehicle_count);

    const threshold = this.getAggThreshold();
    if (this.trafficBuffer[zone].length >= threshold) {
      const avg = this.trafficBuffer[zone].reduce((a, b) => a + b, 0) / this.trafficBuffer[zone].length;
      this.trafficBuffer[zone] = [];
      return {
        zone_id: zone,
        avg_vehicle_count: Math.round(avg * 10) / 10,
        timestamp: data.timestamp,
        mode: this.networkMode,
        compressed: this.networkMode === '4G_FALLBACK',
      };
    }
    return null;
  }

  processWaste(data) {
    const threshold = this.networkMode === '5G' ? 10 : 80;
    if (data.fill_level >= threshold) return data;
    return null;
  }

  processEmergency(data) {
    // Emergency ALWAYS passes through — priority lane
    return data;
  }
}


// ═══════════════════════════════════════════════════
//  CUSTOM HOOK: useRealtimePipeline
// ═══════════════════════════════════════════════════

function useRealtimePipeline(enabled, networkMode) {
  const [logs, setLogs] = useState([]);
  const [trafficHistory, setTrafficHistory] = useState([]);
  const [wasteStatus, setWasteStatus] = useState({});
  const [activeEmergencies, setActiveEmergencies] = useState([]);
  const [pipelineStats, setPipelineStats] = useState({
    messagesProcessed: 0,
    messagesFiltered: 0,
    emergenciesForwarded: 0,
    avgLatency: 0,
  });
  const edgeRef = useRef(new EdgeNodeSimulator(networkMode));
  const wsRef = useRef(null);
  const [wsConnected, setWsConnected] = useState(false);

  // Update edge node when networkMode changes
  useEffect(() => {
    edgeRef.current.setNetworkMode(networkMode === '5G' ? '5G' : '4G_FALLBACK');
  }, [networkMode]);

  const addLog = useCallback((type, msg, icon) => {
    setLogs(prev => [{
      id: Date.now() + Math.random(),
      type,
      msg,
      time: new Date().toLocaleTimeString(),
      icon,
    }, ...prev.slice(0, 49)]);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Try WebSocket connection to Gateway first
    try {
      const ws = new WebSocket('ws://localhost:3000');
      ws.onopen = () => {
        setWsConnected(true);
        addLog('edge', 'Connected to Gateway WebSocket', '📡');
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'WELCOME') {
            addLog('edge', data.message, '✅');
          } else if (data.type === 'TRAFFIC_UPDATE') {
            setTrafficHistory(prev => [...prev.slice(-23), {
              time: new Date().toLocaleTimeString(),
              flow: data.avg_vehicle_count,
              zone: data.zone_id,
            }]);
          }
        } catch (e) { /* ignore malformed */ }
      };
      ws.onerror = () => setWsConnected(false);
      ws.onclose = () => setWsConnected(false);
      wsRef.current = ws;
    } catch (e) {
      setWsConnected(false);
    }

    // Simulated pipeline (always runs — provides demo data)
    const interval = setInterval(() => {
      const edge = edgeRef.current;
      let processed = 0;
      let filtered = 0;

      // Generate traffic for random zone
      const zone = ZONES[Math.floor(Math.random() * ZONES.length)];
      const trafficRaw = generateTrafficReading(zone);
      const trafficResult = edge.processTraffic(trafficRaw);
      processed++;
      
      if (trafficResult) {
        setTrafficHistory(prev => [...prev.slice(-23), {
          time: new Date().toLocaleTimeString(),
          flow: trafficResult.avg_vehicle_count,
          zone: trafficResult.zone_id,
        }]);
        addLog('traffic', `${zone}: Avg ${trafficResult.avg_vehicle_count} vehicles (${trafficResult.mode})`, '🚦');
      } else {
        filtered++;
      }

      // Generate waste
      const bin = BINS[Math.floor(Math.random() * BINS.length)];
      const wasteRaw = generateWasteReading(bin);
      const wasteResult = edge.processWaste(wasteRaw);
      processed++;

      if (wasteResult) {
        setWasteStatus(prev => ({ ...prev, [bin]: wasteResult }));
        if (wasteResult.fill_level >= 80) {
          addLog('waste', `⚠️ ${bin} critical: ${wasteResult.fill_level}% full`, '🗑️');
        }
      } else {
        filtered++;
      }

      // Generate emergency (rare)
      const emergencyRaw = generateEmergency();
      if (emergencyRaw) {
        const emergencyResult = edge.processEmergency(emergencyRaw);
        if (emergencyResult) {
          addLog('emergency', `🚨 ${emergencyResult.type} alert — Severity: ${emergencyResult.severity}`, '🚨');
          setActiveEmergencies(prev => [emergencyResult, ...prev.slice(0, 4)]);
          setPipelineStats(prev => ({
            ...prev,
            emergenciesForwarded: prev.emergenciesForwarded + 1,
          }));
        }
      }

      setPipelineStats(prev => ({
        ...prev,
        messagesProcessed: prev.messagesProcessed + processed,
        messagesFiltered: prev.messagesFiltered + filtered,
        avgLatency: Math.floor(Math.random() * 5) + (networkMode === '5G' ? 2 : 15),
      }));
    }, 2000);

    return () => {
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
    };
  }, [enabled, networkMode, addLog]);

  return { logs, trafficHistory, wasteStatus, activeEmergencies, pipelineStats, wsConnected };
}


// ═══════════════════════════════════════════════════
//  COMPONENTS
// ═══════════════════════════════════════════════════

const StatCard = ({ title, value, icon: Icon, color, delta, deltaUp }) => (
  <div className="card" id={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
    <div className="card-title">{title}</div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div className="card-value" style={{ color }}>{value}</div>
      <div className="feed-icon" style={{ backgroundColor: `${color}18`, color, width: 36, height: 36, minWidth: 36 }}>
        <Icon size={18} />
      </div>
    </div>
    {delta && (
      <div style={{ 
        marginTop: 6, 
        fontSize: '0.7rem', 
        fontWeight: 600,
        color: deltaUp ? 'var(--accent-green)' : 'var(--accent-red)',
        display: 'flex',
        alignItems: 'center',
        gap: 3,
      }}>
        {deltaUp ? '▲' : '▼'} {delta}
      </div>
    )}
  </div>
);


// ═══════════════════════════════════════════════════
//  SMART TRAFFIC COMMAND CENTER (Admin Only)
//  IoT-driven traffic management for city corporation
//  & traffic police
// ═══════════════════════════════════════════════════

const SIGNAL_STATES = ['GREEN', 'YELLOW', 'RED'];
const SIGNAL_COLORS = { GREEN: '#34d399', YELLOW: '#fbbf24', RED: '#f87171' };

const INTERSECTION_DATA = [
  { id: 'INT-01', name: 'Park Street × Camac St', zone: 'Z1', lat: 22.5520, lng: 88.3510 },
  { id: 'INT-02', name: 'Salt Lake Sector V Gate', zone: 'Z2', lat: 22.5726, lng: 88.4312 },
  { id: 'INT-03', name: 'Howrah Bridge North', zone: 'Z3', lat: 22.5851, lng: 88.3468 },
  { id: 'INT-04', name: 'New Town Biswa Bangla', zone: 'Z4', lat: 22.5958, lng: 88.4842 },
  { id: 'INT-05', name: 'EM Bypass × Ruby More', zone: 'Z1', lat: 22.5180, lng: 88.3980 },
  { id: 'INT-06', name: 'Rajarhat Chowmatha', zone: 'Z4', lat: 22.6140, lng: 88.4690 },
];

const TrafficCommandCenter = ({ pipelineStats, networkMode, trafficHistory }) => {
  // Signal states per intersection
  const [signals, setSignals] = useState(() => {
    const init = {};
    INTERSECTION_DATA.forEach(i => {
      init[i.id] = {
        current: 'GREEN',
        greenDuration: 45,
        mode: 'AUTO',         // AUTO | MANUAL | EMERGENCY
        vehicleCount: Math.floor(Math.random() * 80) + 10,
        avgSpeed: Math.floor(Math.random() * 40) + 20,
        congestion: Math.random(),
        queueLength: Math.floor(Math.random() * 30),
        lastUpdate: new Date(),
      };
    });
    return init;
  });

  // Automation rules
  const [rules, setRules] = useState([
    { id: 1, name: 'Rush Hour Extension', condition: 'congestion > 70%', action: 'Extend GREEN +20s', zone: 'All', enabled: true },
    { id: 2, name: 'Night Mode', condition: '22:00–06:00', action: 'Blinking YELLOW', zone: 'Z3, Z4', enabled: true },
    { id: 3, name: 'School Zone Safety', condition: '07:30–09:00', action: 'Reduce speed limit to 30km/h', zone: 'Z2', enabled: false },
  ]);

  // Emergency corridor
  const [corridorActive, setCorridorActive] = useState(null);
  const [incidents, setIncidents] = useState([]);

  // Simulate live IoT sensor updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSignals(prev => {
        const next = { ...prev };
        INTERSECTION_DATA.forEach(i => {
          const s = { ...next[i.id] };
          // Simulate fluctuating sensor data
          s.vehicleCount = Math.max(5, s.vehicleCount + Math.floor(Math.random() * 20 - 10));
          s.avgSpeed = Math.max(5, Math.min(80, s.avgSpeed + Math.floor(Math.random() * 10 - 5)));
          s.congestion = Math.min(1, Math.max(0, s.vehicleCount / 100));
          s.queueLength = Math.max(0, Math.floor(s.vehicleCount * 0.4));
          s.lastUpdate = new Date();

          // AUTO mode: AI-driven signal switching
          if (s.mode === 'AUTO') {
            if (s.congestion > 0.8) {
              s.current = 'GREEN';
              s.greenDuration = 60;
            } else if (s.congestion > 0.5) {
              s.greenDuration = 45;
            } else {
              s.greenDuration = 30;
            }
          }
          next[i.id] = s;
        });
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const overrideSignal = (intId, newState) => {
    setSignals(prev => ({
      ...prev,
      [intId]: { ...prev[intId], current: newState, mode: 'MANUAL' },
    }));
  };

  const setAutoMode = (intId) => {
    setSignals(prev => ({
      ...prev,
      [intId]: { ...prev[intId], mode: 'AUTO' },
    }));
  };

  const activateEmergencyCorridor = (fromZone, toZone) => {
    setCorridorActive({ from: fromZone, to: toZone, time: new Date() });
    // Set all intersections in the corridor to GREEN with EMERGENCY mode
    setSignals(prev => {
      const next = { ...prev };
      INTERSECTION_DATA.filter(i => i.zone === fromZone || i.zone === toZone).forEach(i => {
        next[i.id] = { ...next[i.id], current: 'GREEN', mode: 'EMERGENCY', greenDuration: 90 };
      });
      return next;
    });
    // Auto-deactivate after 5 minutes
    setTimeout(() => {
      setCorridorActive(null);
      setSignals(prev => {
        const next = { ...prev };
        INTERSECTION_DATA.forEach(i => {
          if (next[i.id].mode === 'EMERGENCY') {
            next[i.id] = { ...next[i.id], mode: 'AUTO' };
          }
        });
        return next;
      });
    }, 300000);
  };

  const reportIncident = (intId) => {
    const intersection = INTERSECTION_DATA.find(i => i.id === intId);
    setIncidents(prev => [{
      id: Date.now(),
      intersection: intersection.name,
      zone: intersection.zone,
      time: new Date(),
      status: 'ACTIVE',
    }, ...prev.slice(0, 9)]);
  };

  const toggleRule = (ruleId) => {
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
  };

  const totalVehicles = Object.values(signals).reduce((a, s) => a + s.vehicleCount, 0);
  const avgCongestion = Object.values(signals).reduce((a, s) => a + s.congestion, 0) / INTERSECTION_DATA.length;
  const emergencyCount = Object.values(signals).filter(s => s.mode === 'EMERGENCY').length;
  const manualCount = Object.values(signals).filter(s => s.mode === 'MANUAL').length;

  // Card styles shared in this component
  const cardStyle = {
    background: 'var(--bg-card)', border: '1px solid var(--bg-highlight)',
    borderRadius: 16, padding: 16, marginBottom: 12,
  };
  const labelStyle = {
    fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 6, fontWeight: 600,
  };

  return (
    <>
      {/* Header Banner */}
      <div style={{
        ...cardStyle,
        background: 'linear-gradient(135deg, rgba(96,165,250,0.08), rgba(34,211,238,0.08))',
        borderColor: 'rgba(96,165,250,0.15)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'linear-gradient(135deg, #60a5fa, #22d3ee)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <TrafficCone size={20} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Smart Traffic Command Center</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            IoT-powered signal management • Admin access
          </p>
        </div>
        {corridorActive && (
          <div style={{
            padding: '6px 12px', borderRadius: 20,
            background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)',
            display: 'flex', alignItems: 'center', gap: 6,
            animation: 'pulse-kf 1.5s infinite',
          }}>
            <Siren size={14} color="#f87171" />
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f87171' }}>CORRIDOR ACTIVE</span>
          </div>
        )}
      </div>

      {/* KPI Strip */}
      <section className="grid-stats">
        <StatCard title="Total Vehicles" value={totalVehicles} icon={Truck} color="var(--accent-blue)"
          delta={`${INTERSECTION_DATA.length} intersections`} deltaUp={true} />
        <StatCard title="Avg Congestion" value={`${Math.round(avgCongestion * 100)}%`} icon={Gauge} 
          color={avgCongestion > 0.7 ? 'var(--accent-red)' : avgCongestion > 0.4 ? 'var(--accent-orange)' : 'var(--accent-green)'}
          delta={avgCongestion > 0.7 ? 'Heavy' : avgCongestion > 0.4 ? 'Moderate' : 'Smooth'}
          deltaUp={avgCongestion <= 0.4} />
        <StatCard title="Manual Override" value={manualCount} icon={Settings2} color="var(--accent-orange)"
          delta={`${emergencyCount} emergency`} deltaUp={emergencyCount === 0} />
        <StatCard title="Signal Latency" value={`${pipelineStats.avgLatency}ms`} icon={Timer} 
          color={networkMode === '5G' ? 'var(--accent-green)' : 'var(--accent-orange)'}
          delta={`${networkMode} connection`} deltaUp={networkMode === '5G'} />
      </section>

      {/* Emergency Corridor Panel */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Siren size={16} color="#f87171" />
          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Emergency Corridor</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>Clear route for first responders</span>
        </div>
        {corridorActive ? (
          <div style={{
            padding: 12, borderRadius: 12,
            background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Navigation size={16} color="#f87171" />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f87171' }}>
                  {corridorActive.from} → {corridorActive.to} — ALL GREEN
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Activated {corridorActive.time.toLocaleTimeString()}
                </div>
              </div>
            </div>
            <button onClick={() => setCorridorActive(null)} style={{
              padding: '6px 14px', borderRadius: 8, border: 'none',
              background: '#f87171', color: '#fff', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
            }}>Deactivate</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[['Z1', 'Z3'], ['Z2', 'Z4'], ['Z1', 'Z4']].map(([from, to], i) => (
              <button key={i} onClick={() => activateEmergencyCorridor(from, to)} style={{
                padding: '10px 8px', borderRadius: 10, border: '1px solid var(--bg-highlight)',
                background: 'var(--bg-surface)', cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
                <ArrowRightLeft size={16} color="var(--accent-red)" />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>{from} → {to}</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Clear route</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Live Intersection Grid */}
      <div style={{ ...labelStyle, marginTop: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Eye size={12} />
        <span>LIVE INTERSECTION MONITOR — IoT Sensor Feed</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, marginBottom: 16 }}>
        {INTERSECTION_DATA.map(intersection => {
          const s = signals[intersection.id];
          const congPct = Math.round(s.congestion * 100);

          return (
            <div key={intersection.id} style={{
              ...cardStyle, marginBottom: 0,
              borderColor: s.mode === 'EMERGENCY' ? 'rgba(248,113,113,0.4)'
                : s.mode === 'MANUAL' ? 'rgba(251,191,36,0.4)'
                : 'var(--bg-highlight)',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Mode indicator strip */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: s.mode === 'EMERGENCY' ? '#f87171'
                  : s.mode === 'MANUAL' ? '#fbbf24'
                  : 'linear-gradient(90deg, #34d399, #22d3ee)',
              }} />

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, marginTop: 4 }}>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{intersection.name}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={9} /> {intersection.zone} • {intersection.id}
                  </div>
                </div>
                <div style={{
                  padding: '3px 8px', borderRadius: 6,
                  fontSize: '0.6rem', fontWeight: 700, letterSpacing: 0.5,
                  background: s.mode === 'EMERGENCY' ? '#f8717115' : s.mode === 'MANUAL' ? '#fbbf2415' : '#34d39915',
                  color: s.mode === 'EMERGENCY' ? '#f87171' : s.mode === 'MANUAL' ? '#fbbf24' : '#34d399',
                }}>
                  {s.mode}
                </div>
              </div>

              {/* Stats Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
                <div style={{ textAlign: 'center', padding: '6px 0', background: 'var(--bg-surface)', borderRadius: 8 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: congPct > 70 ? '#f87171' : congPct > 40 ? '#fb923c' : '#34d399' }}>{congPct}%</div>
                  <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Congestion</div>
                </div>
                <div style={{ textAlign: 'center', padding: '6px 0', background: 'var(--bg-surface)', borderRadius: 8 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{s.vehicleCount}</div>
                  <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vehicles</div>
                </div>
                <div style={{ textAlign: 'center', padding: '6px 0', background: 'var(--bg-surface)', borderRadius: 8 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{s.avgSpeed}</div>
                  <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>km/h</div>
                </div>
              </div>

              {/* Signal Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600, minWidth: 40 }}>SIGNAL</div>
                {SIGNAL_STATES.map(state => (
                  <button key={state} onClick={() => overrideSignal(intersection.id, state)} style={{
                    flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: s.current === state ? SIGNAL_COLORS[state] : 'var(--bg-surface)',
                    color: s.current === state ? '#fff' : 'var(--text-muted)',
                    fontSize: '0.65rem', fontWeight: 700,
                    boxShadow: s.current === state ? `0 0 12px ${SIGNAL_COLORS[state]}40` : 'none',
                  }}>
                    {state}
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Timer size={10} color="var(--text-muted)" />
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Green: {s.greenDuration}s</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {s.mode !== 'AUTO' && (
                    <button onClick={() => setAutoMode(intersection.id)} style={{
                      padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: '#34d39915', color: '#34d399', fontSize: '0.6rem', fontWeight: 700,
                    }}>AUTO</button>
                  )}
                  <button onClick={() => reportIncident(intersection.id)} style={{
                    padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: '#f8717115', color: '#f87171', fontSize: '0.6rem', fontWeight: 700,
                  }}>⚠ Report</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Section: Rules + Incidents */}
      <main className="main-content">
        {/* Automation Rules */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Settings2 size={16} color="var(--accent-cyan)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Automation Rules</span>
          </div>
          {rules.map(rule => (
            <div key={rule.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10, marginBottom: 6,
              background: rule.enabled ? 'var(--bg-surface)' : 'transparent',
              border: '1px solid var(--bg-highlight)',
              opacity: rule.enabled ? 1 : 0.5,
            }}>
              <button onClick={() => toggleRule(rule.id)} style={{
                width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: rule.enabled ? '#34d399' : 'var(--bg-highlight)',
                position: 'relative', transition: 'all 0.3s',
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius: 8,
                  background: '#fff', position: 'absolute', top: 2,
                  left: rule.enabled ? 18 : 2, transition: 'left 0.3s',
                }} />
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{rule.name}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  IF {rule.condition} → {rule.action} [{rule.zone}]
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Incident Log */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <AlertTriangle size={16} color="var(--accent-orange)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Incident Reports</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{incidents.length} total</span>
          </div>
          {incidents.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No incidents reported. Click "⚠ Report" on any intersection.
            </div>
          ) : (
            incidents.map(inc => (
              <div key={inc.id} className="feed-item">
                <div className="feed-icon" style={{ backgroundColor: '#fb923c18', color: '#fb923c' }}>
                  <AlertTriangle size={16} />
                </div>
                <div className="feed-content">
                  <h4>{inc.intersection}</h4>
                  <p>{inc.zone} • {inc.time.toLocaleTimeString()} • {inc.status}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* AI Traffic Insight */}
      <div className="card glass" style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 32, height: 32, minWidth: 32, borderRadius: 8,
            backgroundColor: '#60a5fa18',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Gauge color="#60a5fa" size={16} />
          </div>
          <div>
            <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
              AI Traffic Optimization
            </p>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.55 }}>
              Current city-wide congestion: <span style={{ color: avgCongestion > 0.7 ? '#f87171' : '#34d399', fontWeight: 700 }}>{Math.round(avgCongestion * 100)}%</span>.
              {avgCongestion > 0.6
                ? <> Recommend extending GREEN on <span style={{ color: '#60a5fa', fontWeight: 700 }}>Park Street</span> and <span style={{ color: '#60a5fa', fontWeight: 700 }}>EM Bypass</span> by 15s to reduce queue by <span style={{ color: '#34d399', fontWeight: 700 }}>23%</span>.</>
                : <> Traffic flowing smoothly. Signal timing is optimal. Next adjustment recommended at peak hour (<span style={{ color: '#60a5fa', fontWeight: 700 }}>17:30</span>).</>
              }{' '}Monitoring <span style={{ color: '#22d3ee', fontWeight: 700 }}>{totalVehicles}</span> vehicles across {INTERSECTION_DATA.length} IoT-connected intersections.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};


// ═══════════════════════════════════════════════════
//  ANALYTICS DASHBOARD TAB
// ═══════════════════════════════════════════════════

const AnalyticsDashboard = ({ trafficHistory, wasteStatus, pipelineStats, networkMode }) => {
  // Traffic prediction data (simulates analytics service /predict/traffic)
  const trafficPrediction = ZONES.map(zone => ({
    zone,
    congestion: Math.round(Math.random() * 80 + 10) / 100,
    predicted: Math.round(Math.random() * 60 + 20),
    recommendation: Math.random() > 0.5 ? 'Adjust timing' : 'Maintain current',
    confidence: Math.round(Math.random() * 15 + 85),
  }));

  // Waste prediction data (simulates analytics service /predict/waste)
  const wastePrediction = BINS.map(bin => {
    const current = wasteStatus[bin]?.fill_level || Math.floor(Math.random() * 60);
    return {
      bin,
      current,
      daysUntilFull: Math.round((100 - current) / (Math.random() * 15 + 5) * 10) / 10,
      priority: current >= 80 ? 'HIGH' : current >= 50 ? 'MEDIUM' : 'LOW',
    };
  });

  const CHART_COLORS = ['#60a5fa', '#22d3ee', '#34d399', '#fb923c', '#a78bfa'];
  const PIE_COLORS = ['#34d399', '#fb923c', '#f87171'];

  const priorityCounts = [
    { name: 'Low', value: wastePrediction.filter(w => w.priority === 'LOW').length, color: '#34d399' },
    { name: 'Medium', value: wastePrediction.filter(w => w.priority === 'MEDIUM').length, color: '#fb923c' },
    { name: 'High', value: wastePrediction.filter(w => w.priority === 'HIGH').length, color: '#f87171' },
  ].filter(p => p.value > 0);

  return (
    <>
      {/* Pipeline Stats */}
      <section className="grid-stats" id="pipeline-stats">
        <StatCard 
          title="Messages Processed" 
          value={pipelineStats.messagesProcessed} 
          icon={Radio} 
          color="var(--accent-blue)" 
          delta={`${pipelineStats.messagesFiltered} filtered`}
          deltaUp={true}
        />
        <StatCard 
          title="Avg Latency" 
          value={`${pipelineStats.avgLatency}ms`} 
          icon={Zap} 
          color={networkMode === '5G' ? 'var(--accent-green)' : 'var(--accent-orange)'} 
          delta={networkMode === '5G' ? '5G Ultra-low' : '4G Elevated'}
          deltaUp={networkMode === '5G'}
        />
        <StatCard 
          title="Emergency Alerts" 
          value={pipelineStats.emergenciesForwarded} 
          icon={ShieldAlert} 
          color="var(--accent-red)" 
          delta="Priority pass-through"
          deltaUp={true}
        />
        <StatCard 
          title="Edge Threshold" 
          value={networkMode === '5G' ? '3' : '10'} 
          icon={Activity} 
          color="var(--accent-purple)" 
          delta={networkMode === '5G' ? 'High resolution' : 'Bandwidth saving'}
          deltaUp={networkMode === '5G'}
        />
      </section>

      {/* Traffic Congestion Prediction Chart */}
      <main className="main-content">
        <div className="card" id="traffic-prediction-chart">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>🚦 Traffic Congestion Prediction</h3>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-highlight)', padding: '3px 8px', borderRadius: 6 }}>
              AI Analytics
            </div>
          </div>
          <div style={{ height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trafficPrediction}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.2)" />
                <XAxis dataKey="zone" stroke="#475569" fontSize={12} />
                <YAxis stroke="#475569" fontSize={11} tickFormatter={(v) => `${Math.round(v * 100)}%`} domain={[0, 1]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-highlight)', borderRadius: 10, fontSize: '0.8rem' }}
                  formatter={(value) => [`${Math.round(value * 100)}%`, 'Congestion Index']}
                />
                <Bar dataKey="congestion" radius={[6, 6, 0, 0]}>
                  {trafficPrediction.map((entry, i) => (
                    <Cell key={i} fill={entry.congestion >= 0.7 ? '#f87171' : entry.congestion >= 0.4 ? '#fb923c' : '#34d399'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            {trafficPrediction.map((t, i) => (
              <div key={i} style={{ padding: '8px 12px', background: 'var(--bg-highlight)', borderRadius: 10, fontSize: '0.75rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{t.zone}</div>
                <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{t.recommendation}</div>
                <div style={{ color: 'var(--accent-green)', fontWeight: 600, marginTop: 2 }}>Confidence: {t.confidence}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Waste Collection Optimization */}
        <div className="card" id="waste-prediction-chart">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>🗑️ Waste Collection Priority</h3>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-highlight)', padding: '3px 8px', borderRadius: 6 }}>
              Optimizer
            </div>
          </div>
          <div style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={priorityCounts}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {priorityCounts.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-highlight)', borderRadius: 10 }} />
                <Legend 
                  formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {wastePrediction.filter(w => w.priority === 'HIGH').length > 0 && (
              <div style={{ color: 'var(--accent-red)', fontWeight: 600, marginBottom: 4 }}>
                ⚠️ {wastePrediction.filter(w => w.priority === 'HIGH').length} bin(s) need immediate collection
              </div>
            )}
            {wastePrediction.map((w, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--bg-highlight)' }}>
                <span>{w.bin} — {w.current}% full</span>
                <span style={{ 
                  color: w.priority === 'HIGH' ? '#f87171' : w.priority === 'MEDIUM' ? '#fb923c' : '#34d399',
                  fontWeight: 600 
                }}>
                  {w.daysUntilFull}d until full
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Real-time Traffic Flow Chart */}
      <div className="card" id="realtime-traffic-chart">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3>📈 Live Traffic Flow (Edge → Dashboard)</h3>
          <div style={{ 
            fontSize: '0.7rem', color: 'var(--text-muted)',
            background: 'var(--bg-highlight)', padding: '3px 8px', borderRadius: 6 
          }}>
            WebSocket Stream
          </div>
        </div>
        <div style={{ height: '250px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trafficHistory.length > 0 ? trafficHistory : [{ time: 'Waiting...', flow: 0 }]}>
              <defs>
                <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.15)" />
              <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#475569" fontSize={11} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-highlight)', borderRadius: 10, fontSize: '0.8rem' }}
                itemStyle={{ color: 'var(--text-primary)' }}
              />
              <Area type="monotone" dataKey="flow" stroke="#22d3ee" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTraffic)" dot={false}
                activeDot={{ r: 5, stroke: '#22d3ee', strokeWidth: 2, fill: 'var(--bg-card)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
};


// ═══════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════

function App() {
  const [role, setRole] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'analytics' | 'traffic' | 'ai'
  const [networkMode, setNetworkMode] = useState('5G');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Robust check: admin prefix or specific domain
        if (user.email && (user.email.startsWith('admin') || user.email.includes('admin@'))) setRole('admin');
        else setRole('user');
      } else {
        setRole(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      let finalEmail = email;
      // If registering as admin, automatically prefix the email
      if (isRegistering && isAdminMode && !email.startsWith('admin')) {
        finalEmail = `admin_${email}`;
      }
      
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, finalEmail, password);
      } else {
        await signInWithEmailAndPassword(auth, finalEmail, password);
      }
    } catch (error) {
      alert(error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // ── Weather data ──
  const [chartData, setChartData] = useState([]);
  const [weather, setWeather] = useState({
    temp: '--', wind: '--', precip: '--', tempDeltaUp: true, pressure: '--',
  });
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    if (!role) return;
    const fetchData = async () => {
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=22.57&longitude=88.36&current=temperature_2m,wind_speed_10m,precipitation,surface_pressure&hourly=temperature_2m');
        const data = await res.json();
        setWeather({
          temp: data.current.temperature_2m,
          wind: data.current.wind_speed_10m,
          precip: data.current.precipitation,
          pressure: data.current.surface_pressure,
          tempDelta: 'Live Data',
          tempDeltaUp: true,
        });
        const hourlyChart = data.hourly.time.slice(0, 24).map((timeStr, idx) => {
          const t = new Date(timeStr);
          return { time: `${t.getHours()}:00`, flow: data.hourly.temperature_2m[idx] };
        });
        setChartData(hourlyChart);
        setLastUpdate(new Date());
      } catch (err) {
        console.error("Failed to fetch actual online data", err);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [role]);

  // ── Real-time Pipeline ──
  const { logs, trafficHistory, wasteStatus, activeEmergencies, pipelineStats, wsConnected } = 
    useRealtimePipeline(!!role, networkMode);

  if (authLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a', color: '#fff' }}>Loading...</div>;

  if (!role) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a', fontFamily: 'sans-serif' }}>
         <form onSubmit={handleAuth} style={{ backgroundColor: '#1e293b', padding: 40, borderRadius: 16, border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: 20, width: 340, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
             <h2 style={{ textAlign: 'center', margin: 0, color: '#f8fafc', fontSize: '1.5rem', fontWeight: 800 }}>NexaCity</h2>
             <p style={{ textAlign: 'center', margin: '-10px 0 10px', color: '#94a3b8', fontSize: '0.85rem' }}>{isRegistering ? 'Create new account' : 'Login to access dashboard'}</p>
             
             <div style={{ 
               display: 'flex', 
               background: '#0f172a', 
               padding: '4px', 
               borderRadius: '10px', 
               border: '1px solid #334155',
               marginBottom: '5px'
             }}>
               <button 
                 type="button"
                 onClick={() => setIsAdminMode(false)}
                 style={{ 
                   flex: 1, 
                   padding: '10px', 
                   borderRadius: '8px', 
                   border: 'none', 
                   background: !isAdminMode ? '#3b82f6' : 'transparent', 
                   color: '#fff',
                   fontSize: '0.8rem',
                   fontWeight: 'bold',
                   cursor: 'pointer',
                   transition: 'all 0.2s'
                 }}>
                 User
               </button>
               <button 
                 type="button"
                 onClick={() => setIsAdminMode(true)}
                 style={{ 
                   flex: 1, 
                   padding: '10px', 
                   borderRadius: '8px', 
                   border: 'none', 
                   background: isAdminMode ? '#ef4444' : 'transparent', 
                   color: '#fff',
                   fontSize: '0.8rem',
                   fontWeight: 'bold',
                   cursor: 'pointer',
                   transition: 'all 0.2s'
                 }}>
                 Admin
               </button>
             </div>

             <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: 12, borderRadius: 8, border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', outline: 'none' }} required />
             <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ padding: 12, borderRadius: 8, border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', outline: 'none' }} required />
             <button type="submit" style={{ padding: 14, borderRadius: 8, background: isAdminMode ? '#ef4444' : '#3b82f6', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', marginTop: 10 }}>{isRegistering ? 'Sign Up' : 'Sign In'}</button>
             <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer', marginTop: 10 }} onClick={() => setIsRegistering(!isRegistering)}>
               {isRegistering ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
             </p>
         </form>
      </div>
    );
  }


  return (
    <div className="dashboard-container">
      <header>
        <div className="logo">NexaCity</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Tab Switcher */}
          <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 10, padding: 3, border: '1px solid var(--bg-highlight)' }}>
            <button 
              onClick={() => setActiveTab('dashboard')}
              style={{ 
                padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: activeTab === 'dashboard' ? 'var(--accent-blue)' : 'transparent',
                color: activeTab === 'dashboard' ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.72rem', fontWeight: 700, transition: 'all 0.2s'
              }}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('analytics')}
              style={{ 
                padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: activeTab === 'analytics' ? 'var(--accent-cyan)' : 'transparent',
                color: activeTab === 'analytics' ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.72rem', fontWeight: 700, transition: 'all 0.2s'
              }}
            >
              Analytics
            </button>
            {role === 'admin' && (
              <>
                <button 
                  onClick={() => setActiveTab('traffic')}
                  style={{ 
                    padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: activeTab === 'traffic' ? '#f87171' : 'transparent',
                    color: activeTab === 'traffic' ? '#fff' : 'var(--text-secondary)',
                    fontSize: '0.72rem', fontWeight: 700, transition: 'all 0.2s'
                  }}
                >
                  🚦 Traffic Control
                </button>
                <button 
                  onClick={() => setActiveTab('ai')}
                  style={{ 
                    padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: activeTab === 'ai' ? '#a78bfa' : 'transparent',
                    color: activeTab === 'ai' ? '#fff' : 'var(--text-secondary)',
                    fontSize: '0.72rem', fontWeight: 700, transition: 'all 0.2s',
                    marginLeft: 4
                  }}
                >
                  🧠 AI Agent
                </button>
              </>
            )}
          </div>

          {/* Network Toggle */}
          <button
            onClick={() => setNetworkMode(prev => prev === '5G' ? '4G' : '5G')}
            className="status-badge"
            style={{ cursor: 'pointer', border: `1px solid ${networkMode === '5G' ? 'var(--accent-green)' : 'var(--accent-orange)'}30`, background: 'var(--bg-card)' }}
          >
            {networkMode === '5G' ? <Wifi size={12} color="var(--accent-green)" /> : <WifiOff size={12} color="var(--accent-orange)" />}
            <span style={{ color: networkMode === '5G' ? 'var(--accent-green)' : 'var(--accent-orange)' }}>
              {networkMode}
            </span>
          </button>

          <div className="status-badge">
            <div className="pulse" style={{ backgroundColor: wsConnected ? 'var(--accent-green)' : 'var(--accent-orange)' }}></div>
            <span>{wsConnected ? 'WS LIVE' : 'SIMULATED'}</span>
          </div>
          <button onClick={handleLogout} style={{ padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>Logout</button>
        </div>
      </header>

      {/* Timestamp */}
      <div style={{ 
        display: 'flex', alignItems: 'center', gap: 5, 
        fontSize: '0.72rem', color: 'var(--text-muted)',
        marginTop: -8, 
      }}>
        <Clock size={11} />
        <span>Updated {lastUpdate.toLocaleTimeString()}</span>
        <span style={{ marginLeft: 8, color: 'var(--accent-cyan)', fontWeight: 600 }}>
          • {pipelineStats.messagesProcessed} msgs processed
        </span>
      </div>

      {/* ═══ TAB: DASHBOARD ═══ */}
      {activeTab === 'dashboard' && (
        <>
          <section className="grid-stats">
            <StatCard 
              title="Surface Pressure" 
              value={`${weather.pressure} hPa`} 
              icon={Activity} 
              color="var(--accent-blue)" 
              delta="Kolkata Live"
              deltaUp={true}
            />
            <StatCard 
              title="Kolkata Temp" 
              value={`${weather.temp}°C`} 
              icon={Thermometer} 
              color="var(--accent-orange)" 
              delta={weather.tempDelta}
              deltaUp={weather.tempDeltaUp}
            />
            <StatCard 
              title="Wind Speed" 
              value={`${weather.wind} km/h`} 
              icon={Wind} 
              color="var(--accent-cyan)"
              delta="Kolkata Live"
              deltaUp={true}
            />
            <StatCard 
              title="Precipitation" 
              value={`${weather.precip} mm`} 
              icon={Droplets} 
              color="var(--accent-blue)" 
              delta="Current Rain"
              deltaUp={weather.precip === 0}
            />
          </section>

          <main className="main-content">
            <div className="card" id="temperature-chart">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3>📈 24h Temperature Forecast</h3>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-highlight)', padding: '3px 8px', borderRadius: 6 }}>
                  Live
                </div>
              </div>
              <div style={{ height: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorFlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-highlight)', borderRadius: '10px', fontSize: '0.8rem' }}
                      itemStyle={{ color: 'var(--text-primary)' }}
                      labelStyle={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}
                    />
                    <Area type="monotone" dataKey="flow" stroke="#60a5fa" strokeWidth={2.5} fillOpacity={1} fill="url(#colorFlow)" dot={false}
                      activeDot={{ r: 5, stroke: '#60a5fa', strokeWidth: 2, fill: 'var(--bg-card)' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Real-time Operations Feed — now LIVE from pipeline */}
            <div className="card" id="operations-feed">
              <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>
                🔔 Live Operations Feed
                <span style={{ fontSize: '0.65rem', marginLeft: 8, color: 'var(--accent-green)', fontWeight: 500 }}>
                  {wsConnected ? '● WebSocket' : '● Simulated Pipeline'}
                </span>
              </h3>
              <div className="feed-container">
                {logs.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Waiting for pipeline data...
                  </div>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className="feed-item">
                      <div className="feed-icon" style={{
                        backgroundColor: 
                          log.type === 'traffic' ? '#60a5fa18' :
                          log.type === 'waste'   ? '#fb923c18' :
                          log.type === 'emergency' ? '#f8717118' :
                          '#22d3ee18',
                        color: 
                          log.type === 'traffic' ? '#60a5fa' :
                          log.type === 'waste'   ? '#fb923c' :
                          log.type === 'emergency' ? '#f87171' :
                          '#22d3ee',
                      }}>
                        {log.type === 'traffic' && <Truck size={16} />}
                        {log.type === 'waste' && <Trash2 size={16} />}
                        {log.type === 'emergency' && <AlertTriangle size={16} />}
                        {log.type === 'edge' && <Zap size={16} />}
                      </div>
                      <div className="feed-content">
                        <h4>{log.msg}</h4>
                        <p>{log.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </main>

          {/* Emergency Alert Banner */}
          {activeEmergencies.length > 0 && (
            <div className="card" style={{ borderColor: 'rgba(248, 113, 113, 0.3)', background: 'rgba(248, 113, 113, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <ShieldAlert size={18} color="#f87171" />
                <h3 style={{ fontSize: '0.95rem', color: '#f87171' }}>Active Emergencies ({activeEmergencies.length})</h3>
              </div>
              {activeEmergencies.map((e, i) => (
                <div key={i} style={{ 
                  padding: '8px 12px', background: 'var(--bg-highlight)', borderRadius: 10, marginBottom: 6,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem'
                }}>
                  <span>🚨 {e.type} — {e.severity}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{new Date(e.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}

          {/* AI Insight - now includes dynamic data */}
          {role === 'admin' && (
            <div className="card glass" id="ai-insight">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: 32, height: 32, minWidth: 32,
                  borderRadius: 8,
                  backgroundColor: '#22d3ee18',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <TrendingUp color="#22d3ee" size={16} />
                </div>
                <div>
                  <p style={{ 
                    fontSize: '0.68rem', fontWeight: 700, color: '#22d3ee',
                    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
                  }}>
                    AI Insight (Admin only)
                  </p>
                  <p style={{ fontSize: '0.85rem', lineHeight: 1.55 }}>
                    Based on {pipelineStats.messagesProcessed} processed messages: 
                    Adjust traffic signal timing on 5th Ave to reduce congestion by{' '}
                    <span style={{ color: '#22d3ee', fontWeight: '700' }}>12%</span> in the next hour.
                    Edge node operating in <span style={{ color: networkMode === '5G' ? '#34d399' : '#fb923c', fontWeight: '700' }}>{networkMode}</span> mode
                    with <span style={{ color: '#22d3ee', fontWeight: '700' }}>{pipelineStats.avgLatency}ms</span> latency.
                    Confidence: <span style={{ color: '#34d399', fontWeight: '700' }}>91%</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ TAB: ANALYTICS ═══ */}
      {activeTab === 'analytics' && (
        <AnalyticsDashboard 
          trafficHistory={trafficHistory}
          wasteStatus={wasteStatus}
          pipelineStats={pipelineStats}
          networkMode={networkMode}
        />
      )}

      {/* ═══ TAB: TRAFFIC COMMAND CENTER (Admin Only) ═══ */}
      {activeTab === 'traffic' && role === 'admin' && (
        <TrafficCommandCenter
          pipelineStats={pipelineStats}
          networkMode={networkMode}
          trafficHistory={trafficHistory}
        />
      )}

      {/* ═══ TAB: AI AGENT (Admin Only) ═══ */}
      {activeTab === 'ai' && role === 'admin' && (
        <AIIncidentAnalysis />
      )}

    </div>
  );
}

export default App;
