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
  ScatterChart,
  Scatter,
  LabelList,
} from 'recharts';
import AIIncidentAnalysis from './AIIncidentAnalysis';

// ═══════════════════════════════════════════════════
//  WASTE COLLECTION OPTIMIZATION ALGORITHM
// ═══════════════════════════════════════════════════
function calculateDistance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function planCollectionRoute(bins, startX = 0, startY = 0, criticalThreshold = 80) {
    let route = [];
    let currentX = startX;
    let currentY = startY;
    
    // Copy the bins to track collected state
    let uncollectedBins = bins.map(b => ({ ...b, is_collected: false }));

    while (true) {
        let remaining = uncollectedBins.filter(b => !b.is_collected);
        if (remaining.length === 0) break;

        let criticalBins = remaining.filter(b => b.fill_level >= criticalThreshold);
        let nextBin = null;

        if (criticalBins.length > 0) {
            // Rule A: Prioritize critically full bins (descending)
            criticalBins.sort((a, b) => b.fill_level - a.fill_level);
            nextBin = criticalBins[0];
        } else {
            // Rule B: Balance Fill Level and Proximity
            let bestScore = -1;
            for (let b of remaining) {
                let dist = calculateDistance(currentX, currentY, b.x, b.y);
                dist = Math.max(dist, 0.1); // Prevent div by 0
                let score = b.fill_level / dist;
                if (score > bestScore) {
                    bestScore = score;
                    nextBin = b;
                }
            }
        }

        if (nextBin) {
            route.push(nextBin);
            nextBin.is_collected = true;
            currentX = nextBin.x;
            currentY = nextBin.y;
        } else {
            break;
        }
    }
    return route;
}


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
  const [trafficLogs, setTrafficLogs] = useState([]);
  const [wasteLogs, setWasteLogs] = useState([]);
  const lastWasteLogTime = useRef(0);
  const [trafficHistory, setTrafficHistory] = useState([]);
  const [trafficWindow, setTrafficWindow] = useState([]); // 30s rolling window
  const [totalVehicleCount, setTotalVehicleCount] = useState(0);
  const [heavyTrafficActive, setHeavyTrafficActive] = useState(false);
  const [wasteStatus, setWasteStatus] = useState({});
  const [activeEmergencies, setActiveEmergencies] = useState([]);
  const [waterStatus, setWaterStatus] = useState({});
  const [waterLogs, setWaterLogs] = useState([]);
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
    const logItem = {
      id: Date.now() + Math.random(),
      type,
      msg,
      time: new Date().toLocaleTimeString(),
      icon,
    };
    if (type === 'traffic') {
      setTrafficLogs(prev => [logItem, ...prev.slice(0, 14)]);
    } else if (type === 'waste') {
      const now = Date.now();
      // Use the passed msg directly or format it cleanly
      const binIdMatch = msg.match(/(B\d{3})/);
      const binId = binIdMatch ? binIdMatch[0] : 'Unknown';
      const levelMatch = msg.match(/(\d+%)/);
      const level = levelMatch ? levelMatch[0] : 'checked';
      const isCritical = msg.includes('critical');
      logItem.msg = `${isCritical ? '⚠️ ' : ''}Bin ${binId} is currently ${level} full`;
      setWasteLogs(prev => [logItem, ...prev.slice(0, 14)]);
      lastWasteLogTime.current = now;
    } else if (type === 'water') {
      setWaterLogs(prev => [logItem, ...prev.slice(0, 14)]);
    } else {
      setTrafficLogs(prev => [logItem, ...prev.slice(0, 14)]);
    }
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
            const now = Date.now();
            const latestCount = data.vehicle_count || data.avg_vehicle_count || 0;
            
            // As hardware is now cumulative, we just take the max seen
            setTotalVehicleCount(prev => Math.max(prev, latestCount));
            
            setTrafficWindow(prevWindow => {
              const updatedWindow = [...prevWindow.filter(t => now - t.timestamp < 30000), { ...data, timestamp: now }];
              // Use the explicit hardware status for congestion alert
              if (data.status === 'CONGESTED') setHeavyTrafficActive(true);
              else setHeavyTrafficActive(false);
              return updatedWindow;
            });

            setPipelineStats(prev => ({ ...prev, messagesProcessed: prev.messagesProcessed + 1 }));
            addLog('traffic', `${data.zone_id}: Detected vehicle movement`, '🚦');
          } else if (data.type === 'WASTE_UPDATE') {
            setWasteStatus(prev => ({ ...prev, [data.bin_id]: data }));
            if (data.fill_level >= 80) {
              addLog('waste', `⚠️ ${data.bin_id} critical: ${data.fill_level}% full`, '🗑️');
            } else {
              addLog('waste', `${data.bin_id} level updated: ${data.fill_level}%`, '🗑️');
            }
          } else if (data.type === 'WATER_UPDATE') {
            setWaterStatus(prev => ({ ...prev, [data.device]: data }));
            if (data.alert) {
              addLog('water', `🚨 FLOOD ALERT: ${data.device} at ${data.percentage}%`, '🌊');
            } else {
              addLog('water', `${data.device} level: ${data.percentage}%`, '💧');
            }
          }
        } catch (e) { /* ignore malformed */ }
      };
      ws.onerror = () => setWsConnected(false);
      ws.onclose = () => setWsConnected(false);
      wsRef.current = ws;
    } catch (e) {
      setWsConnected(false);
    }

    // Simulated pipeline disabled - Only real data from WebSocket/Backend will be used.
    /*
    const interval = setInterval(() => {
      // ... simulation logic ...
    }, 2000);

    return () => {
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
    };
    */
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [enabled, networkMode, addLog]);

  return { trafficLogs, wasteLogs, waterLogs, trafficHistory, trafficWindow, totalVehicleCount, heavyTrafficActive, wasteStatus, waterStatus, activeEmergencies, pipelineStats, wsConnected };
}


// ═══════════════════════════════════════════════════
//  COMPONENTS
// ═══════════════════════════════════════════════════

const StatCard = ({ title, value, icon: Icon, color, delta, deltaUp, className }) => (
  <div className={["card", className].filter(Boolean).join(' ')} id={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
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

const TrafficCommandCenter = ({ pipelineStats, networkMode, trafficWindow, totalVehicleCount, heavyTrafficActive }) => {
  // Signal states per intersection
  const [signals, setSignals] = useState(() => {
    const init = {};
    INTERSECTION_DATA.forEach(i => {
      init[i.id] = {
        current: 'GREEN',
        greenDuration: 45,
        mode: 'AUTO',
        vehicleCount: 0,
        avgSpeed: 40,
        congestion: 0,
        queueLength: 0,
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

  // Update signals based on real trafficWindow (30s volume)
  useEffect(() => {
    const interval = setInterval(() => {
      setSignals(prev => {
        const next = { ...prev };
        INTERSECTION_DATA.forEach(i => {
          const s = { ...next[i.id] };
          
          // Parse latest cumulative stats from hardware for this zone
          const zonePackets = trafficWindow.filter(t => t.zone_id === i.zone);
          const latestPacket = zonePackets.length > 0 ? zonePackets[zonePackets.length - 1] : null;

          if (latestPacket) {
            s.vehicleCount = latestPacket.vehicle_count || latestPacket.avg_vehicle_count || 0;
            s.congestion = latestPacket.status === 'CONGESTED' ? 0.85 : Math.min(0.4, s.vehicleCount / 30);
          }
          
          s.avgSpeed = '-'; // Removed randomly generated average speed
          s.queueLength = Math.max(0, Math.floor(s.vehicleCount * 0.5));
          s.lastUpdate = new Date();

          // AUTO mode logic
          if (s.mode === 'AUTO') {
            if (s.congestion > 0.7) {
              s.current = 'RED'; // Turn RED if congested to clear cross-traffic
            } else {
              s.current = 'GREEN';
            }
          }
          next[i.id] = s;
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [trafficWindow]);

  // Admin Alert on Congestion
  useEffect(() => {
    if (heavyTrafficActive) {
      alert("🚨 ADMIN ALERT: Severe Congestion Detected! Signals automatically updated to RED to clear cross-traffic.");
      // Automatically log an incident for INT-01 if not already present
      setIncidents(prev => {
        if (prev.some(inc => inc.status === 'ACTIVE' && inc.intersection === 'Park Street × Camac St')) return prev;
        return [{
          id: Date.now(),
          intersection: 'Park Street × Camac St',
          zone: 'Z1',
          time: new Date(),
          status: 'ACTIVE - AUTO REPORT'
        }, ...prev];
      });
    }
  }, [heavyTrafficActive]);

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

  const totalVehicles = totalVehicleCount;
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
        <StatCard title="Total Vehicles Today" value={totalVehicles} icon={Truck} color="var(--accent-blue)"
          delta="Real-time Count" deltaUp={true} />
        <StatCard title="Traffic Activity" value={heavyTrafficActive ? 'HEAVY TRAFFIC' : (avgCongestion > 0.4 ? 'Busy' : 'Smooth')} icon={Gauge} 
          color={heavyTrafficActive ? 'var(--accent-red)' : (avgCongestion > 0.4 ? 'var(--accent-orange)' : 'var(--accent-green)')}
          delta={heavyTrafficActive ? '⚠️ RED ALERT' : (avgCongestion > 0.4 ? 'Regular' : 'Clear Road')}
          deltaUp={!heavyTrafficActive && avgCongestion <= 0.4} />
        <StatCard title="Manual Overrides" value={manualCount} icon={Settings2} color="var(--accent-orange)"
          delta={emergencyCount > 0 ? 'Emergency Active' : 'Normal Operations'} deltaUp={emergencyCount === 0} />
        <StatCard title="Network Status" value={pipelineStats.avgLatency < 10 ? 'Excellent' : 'Stable'} icon={Timer} 
          color={networkMode === '5G' ? 'var(--accent-green)' : 'var(--accent-orange)'}
          delta={`${networkMode} Active`} deltaUp={networkMode === '5G'} />
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
//  SMART WASTE ROUTING CONTROLLER (Admin Only)
// ═══════════════════════════════════════════════════

const WasteRoutingService = () => {
  const [bins, setBins] = useState([]);
  const [name, setName] = useState('');
  const [fillLevel, setFillLevel] = useState('');
  const [xPos, setXPos] = useState('');
  const [yPos, setYPos] = useState('');
  const [route, setRoute] = useState(null);

  const cardStyle = {
    background: 'var(--bg-card)', border: '1px solid var(--bg-highlight)',
    borderRadius: 16, padding: 16, marginBottom: 12,
  };

  const handleAddBin = (e) => {
    e.preventDefault();
    if (name && fillLevel && xPos && yPos) {
      setBins([...bins, {
        id: `B${Math.floor(100 + Math.random() * 900)}`,
        name,
        fill_level: Number(fillLevel),
        x: Number(xPos),
        y: Number(yPos)
      }]);
      setName(''); setFillLevel(''); setXPos(''); setYPos('');
    }
  };

  const removeBin = (id) => {
    setBins(bins.filter(b => b.id !== id));
    setRoute(null);
  };

  const loadMockData = () => {
    setBins([
      { id: 'B001', name: 'Park Street Cross', fill_level: 100, x: 10, y: 15 },
      { id: 'B002', name: 'Camac Street Metro', fill_level: 30, x: 11, y: 14 },
      { id: 'B003', name: 'Sector V Ring Road', fill_level: 75, x: 45, y: 60 },
      { id: 'B004', name: 'New Town Plaza', fill_level: 85, x: 50, y: 65 },
      { id: 'B005', name: 'Salt Lake Stadium', fill_level: 40, x: 30, y: 40 },
      { id: 'B006', name: 'Ruby Hospital Bus Stop', fill_level: 95, x: 20, y: 20 },
      { id: 'B007', name: 'Gariahat Market', fill_level: 60, x: 15, y: 18 },
      { id: 'B008', name: 'Esplanade Square', fill_level: 15, x: 5, y: 5 },
    ]);
    setRoute(null);
  };

  const handleCalculateRoute = () => {
    const computedRoute = planCollectionRoute(bins);
    setRoute(computedRoute);
  };

  // Prepare data for the graph
  const scatterData = [];
  for (let i = 0; i < bins.length; i++) {
    scatterData.push({
      x: bins[i].x,
      y: bins[i].y,
      name: bins[i].id,
      fill: bins[i].fill_level,
      type: 'bin'
    });
  }

  let routeLineData = [];
  if (route && route.length > 0) {
    routeLineData = [{ x: 0, y: 0, name: 'Depot' }];
    for (let i = 0; i < route.length; i++) {
        routeLineData.push({ x: route[i].x, y: route[i].y, name: route[i].id });
    }
  }

  const scatterCells = [];
  for (let i = 0; i < scatterData.length; i++) {
    const entry = scatterData[i];
    let fillColor = 'var(--accent-green)';
    if (entry.fill >= 80) fillColor = 'var(--accent-red)';
    else if (entry.fill >= 50) fillColor = 'var(--accent-orange)';
    scatterCells.push(<Cell key={`cell-${i}`} fill={fillColor} />);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
      {/* Route Visualization Graph */}
      <div style={{ ...cardStyle, gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <TrendingUp size={18} color="var(--accent-cyan)" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800 }}>Spatial Route Mapping</h3>
        </div>
        <div style={{ height: '300px', background: 'var(--bg-surface)', borderRadius: 12, padding: 10 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" dataKey="x" name="X" unit="m" stroke="var(--text-muted)" fontSize={10} domain={[0, 100]} />
              <YAxis type="number" dataKey="y" name="Y" unit="m" stroke="var(--text-muted)" fontSize={10} domain={[0, 100]} />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-highlight)', borderRadius: 10, fontSize: '0.75rem' }}
              />
              
              {/* Plot the Route Line Glow (thicker, lower alpha) */}
              {route && (
                <Scatter data={routeLineData} line={{ stroke: 'var(--accent-cyan)', strokeWidth: 8, strokeOpacity: 0.15 }} shape={() => null} />
              )}
              
              {/* Plot the Primary Route Line (solid, vibrant) */}
              {route && (
                <Scatter data={routeLineData} line={{ stroke: 'var(--accent-cyan)', strokeWidth: 4 }} shape={() => null} />
              )}

              {/* Plot the Bins */}
              <Scatter name="Bins" data={scatterData} fill="#8884d8">
                {scatterCells}
                <LabelList dataKey="name" position="top" style={{ fill: 'var(--text-muted)', fontSize: '11px', fontWeight: '800' }} offset={10} />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 15, justifyContent: 'center' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.65rem', color: 'var(--text-muted)' }}>
             <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-red)' }}></div> Depot (0,0)
           </div>
           <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.65rem', color: 'var(--text-muted)' }}>
             <div style={{ width: 8, height: 8, borderRadius: '20%', background: 'var(--accent-green)' }}></div> Safe Bin
           </div>
           <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.65rem', color: 'var(--text-muted)' }}>
             <div style={{ width: 8, height: 8, borderRadius: '20%', background: 'var(--accent-red)' }}></div> Critical Bin
           </div>
        </div>
      </div>
      
      {/* Input Section */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings2 size={18} color="var(--accent-orange)" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800 }}>Configure Dustbins</h3>
          </div>
          <button onClick={loadMockData} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--accent-orange)', background: 'transparent', color: 'var(--accent-orange)', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>
            Load Test Data
          </button>
        </div>
        
        <form onSubmit={handleAddBin} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <input type="text" placeholder="Location Name (e.g., Central Park)" value={name} onChange={e => setName(e.target.value)} required 
            style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--bg-highlight)', color: '#fff', outline: 'none' }} />
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <input type="number" placeholder="Fill %" value={fillLevel} onChange={e => setFillLevel(e.target.value)} required min="0" max="100"
              style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--bg-highlight)', color: '#fff', outline: 'none' }} />
            <input type="number" placeholder="X Coord" value={xPos} onChange={e => setXPos(e.target.value)} required
              style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--bg-highlight)', color: '#fff', outline: 'none' }} />
            <input type="number" placeholder="Y Coord" value={yPos} onChange={e => setYPos(e.target.value)} required
              style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--bg-highlight)', color: '#fff', outline: 'none' }} />
          </div>
          
          <button type="submit" style={{ padding: '10px', borderRadius: 8, border: 'none', background: 'var(--accent-cyan)', color: '#0f172a', fontWeight: 800, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
            <Trash2 size={16} /> Add Bin to Network
          </button>
        </form>

        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
          Current Target Nodes ({bins.length})
        </div>
        
        <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bins.map((b) => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--bg-highlight)' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{b.name}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{b.fill_level}% Full • Coords: ({b.x}, {b.y})</div>
              </div>
              <button onClick={() => removeBin(b.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><XAxis size={14} /> X</button>
            </div>
          ))}
          {bins.length === 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>No bins available. Add some above.</div>}
        </div>
      </div>

      {/* Output / Routing Section */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Navigation size={18} color="var(--accent-green)" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800 }}>Generated Collection Route</h3>
          </div>
          <button onClick={handleCalculateRoute} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--accent-green)', color: '#0f172a', fontWeight: 800, cursor: 'pointer', fontSize: '0.7rem' }}>
            Calculate Path
          </button>
        </div>

        {route ? (
          <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', marginTop: 10 }}>
            {/* Connecting line */}
            <div style={{ position: 'absolute', left: '15px', top: '20px', bottom: '20px', width: '2px', background: 'var(--bg-highlight)' }} />
            
            {route.map((node, index) => (
              <div key={node.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16, position: 'relative' }}>
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '16px', background: 'var(--bg-card)', 
                  border: `2px solid ${node.fill_level >= 80 ? '#f87171' : 'var(--accent-green)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#fff', zIndex: 2
                }}>
                  {index + 1}
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: '10px 14px', borderRadius: 10, flex: 1, border: '1px solid var(--bg-highlight)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{node.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontSize: '0.7rem', color: node.fill_level >= 80 ? '#f87171' : 'var(--text-muted)', fontWeight: node.fill_level >= 80 ? 700 : 500 }}>
                      {node.fill_level}% Full {node.fill_level >= 80 ? '(CRITICAL)' : ''}
                    </span>
                    <span style={{ fontSize: '0.65rem', background: 'var(--bg-highlight)', padding: '2px 6px', borderRadius: 4 }}>
                      Pos: {node.x}, {node.y}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--bg-highlight)' }}>
            <CircleDot size={24} color="var(--text-muted)" style={{ marginBottom: 10 }} />
            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>No Route Generated</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Add bins and click "Calculate Path" to run the algorithm.</div>
          </div>
        )}
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════════════
//  ANALYTICS DASHBOARD TAB
// ═══════════════════════════════════════════════════

const AnalyticsDashboard = ({ trafficHistory, wasteStatus, pipelineStats, networkMode, trafficWindow }) => {
  // Traffic prediction data based on real ESP32 payload
  const trafficPrediction = ZONES.map(zone => {
    const zonePackets = trafficWindow?.filter(t => t.zone_id === zone) || [];
    const latestPacket = zonePackets.length > 0 ? zonePackets[zonePackets.length - 1] : null;
    const vehicleCount = latestPacket ? (latestPacket.vehicle_count || latestPacket.avg_vehicle_count || 0) : 0;
    
    const congestionValue = latestPacket?.status === 'CONGESTED' ? 0.9 : Math.min(0.8, vehicleCount / 30);
    const predictedCongestion = Math.min(1.0, congestionValue * 1.25);
    
    return {
      zone,
      congestion: congestionValue,
      predicted: Math.round(predictedCongestion * 100),
      recommendation: congestionValue > 0.6 ? 'Adjust timing' : 'Maintain current',
      confidence: latestPacket ? 95 : 45,
    };
  });

  // Waste prediction data without randomized flickering
  const wastePrediction = BINS.map(bin => {
    const current = wasteStatus[bin]?.fill_level || 0;
    // Assuming roughly 15% fill rate per day to make it deterministic
    const calculatedDays = current > 0 ? Math.max(0, Math.round(((100 - current) / 15) * 10) / 10) : '> 6';
    return {
      bin,
      current,
      daysUntilFull: current === 100 ? 0 : calculatedDays,
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

        {/* Flood Risk Analytics */}
        <div className="card" id="flood-risk-analytics">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>🌊 Flood Risk Heatmap</h3>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-highlight)', padding: '3px 8px', borderRadius: 6 }}>
              Gemini Vision AI
            </div>
          </div>
          <div style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[
                { time: '10:00', risk: 20 },
                { time: '11:00', risk: 35 },
                { time: '12:00', risk: 45 },
                { time: '13:00', risk: 85 },
                { time: '14:00', risk: 92 },
              ]}>
                <defs>
                  <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f87171" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#475569" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-highlight)', borderRadius: 10 }} />
                <Area type="monotone" dataKey="risk" stroke="#f87171" fillOpacity={1} fill="url(#colorRisk)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ padding: 10, background: 'rgba(248,113,113,0.1)', borderRadius: 10, border: '1px solid rgba(248,113,113,0.2)' }}>
              <div style={{ fontSize: '0.65rem', color: '#f87171', fontWeight: 700, textTransform: 'uppercase' }}>Probability</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f87171' }}>85%</div>
            </div>
            <div style={{ padding: 10, background: 'var(--bg-highlight)', borderRadius: 10 }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Time to Flood</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>45m</div>
            </div>
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
  const { 
    trafficLogs, 
    wasteLogs, 
    waterLogs,
    trafficHistory, 
    trafficWindow, 
    totalVehicleCount, 
    wasteStatus, 
    waterStatus,
    activeEmergencies, 
    pipelineStats, 
    wsConnected 
  } = useRealtimePipeline(!!role, networkMode);

  const waterLevel = waterStatus['water_node_01']?.percentage ?? 0;
  const isFloodAlert = waterStatus['water_node_01']?.alert ?? false;

  const b001Fill = wasteStatus['B001']?.fill_level ?? 0;
  const dashboardStats = [
    {
      title: 'Water Level (Node 01)',
      value: `${waterLevel}%`,
      icon: Droplets,
      color: isFloodAlert ? 'var(--accent-red)' : waterLevel > 50 ? 'var(--accent-cyan)' : 'var(--accent-blue)',
      delta: isFloodAlert ? '🚨 FLOOD ALERT' : 'Normal Tide',
      deltaUp: !isFloodAlert,
    },
    {
      title: 'Bin B001 Fill Level',
      value: `${b001Fill}%`,
      icon: Trash2,
      color: b001Fill > 80 ? 'var(--accent-red)' : b001Fill > 50 ? 'var(--accent-orange)' : 'var(--accent-green)',
      delta: b001Fill > 80 ? 'Critical Level' : 'Live Sensor',
      deltaUp: b001Fill <= 80,
    },
    {
      title: 'Kolkata Temp',
      value: `${weather.temp}°C`,
      icon: Thermometer,
      color: 'var(--accent-orange)',
      delta: weather.tempDelta,
      deltaUp: weather.tempDeltaUp,
    },
    {
      title: 'Wind Speed',
      value: `${weather.wind} km/h`,
      icon: Wind,
      color: 'var(--accent-cyan)',
      delta: 'Kolkata Live',
      deltaUp: true,
    },
  ];

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
      <header className="app-header">
        <div className="logo">NexaCity</div>
        <div className="header-controls">
          {/* Tab Switcher */}
          <div className="tab-switcher">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`tab-button ${activeTab === 'dashboard' ? 'is-active' : ''}`}
              style={{ '--tab-accent': 'var(--accent-blue)' }}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('analytics')}
              className={`tab-button ${activeTab === 'analytics' ? 'is-active' : ''}`}
              style={{ '--tab-accent': 'var(--accent-cyan)' }}
            >
              Analytics
            </button>
            {role === 'admin' && (
              <>
                <button 
                  onClick={() => setActiveTab('traffic')}
                  className={`tab-button ${activeTab === 'traffic' ? 'is-active' : ''}`}
                  style={{ '--tab-accent': 'var(--accent-red)' }}
                >
                  Traffic Control
                </button>
                <button 
                  onClick={() => setActiveTab('waste')}
                  className={`tab-button ${activeTab === 'waste' ? 'is-active' : ''}`}
                  style={{ '--tab-accent': 'var(--accent-orange)' }}
                >
                  Waste Routing
                </button>
                <button 
                  onClick={() => setActiveTab('ai')}
                  className={`tab-button ${activeTab === 'ai' ? 'is-active' : ''}`}
                  style={{ '--tab-accent': 'var(--accent-purple)' }}
                >
                  AI Agent
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
            <span>{wsConnected ? 'SYSTEM ACTIVE' : 'SIMULATED'}</span>
          </div>
          <button onClick={handleLogout} style={{ padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>Logout</button>
        </div>
      </header>

      {/* Timestamp */}
      <div className="dashboard-meta">
        <Clock size={11} />
        <span>Updated {lastUpdate.toLocaleTimeString()}</span>
        <span className="meta-accent">
          - {pipelineStats.messagesProcessed} msgs processed
        </span>
      </div>

      {/* ═══ TAB: DASHBOARD ═══ */}
      {activeTab === 'dashboard' && (
        <>
          <section className="grid-stats">
            {dashboardStats.map((stat) => (
              <StatCard key={stat.title} {...stat} />
            ))}
          </section>

          <main className="main-content">
            <div className="card" id="temperature-chart">
              <div className="card-header">
                <h3>24h Temperature Forecast</h3>
                <div className="card-tag">Live</div>
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

            {/* Split Notification Areas: Traffic and Waste */}
            <div className="dashboard-feed-grid">
              {/* Traffic Feed (Fast/Live) */}
              <div className="card" id="traffic-feed">
                <div className="feed-header">
                  <div className="feed-title">
                    <Truck size={16} color="var(--accent-blue)" />
                    <span>Live Traffic Tracker</span>
                  </div>
                  <span className="feed-tag is-live">Live Feed</span>
                </div>
                <div className="feed-container is-compact">
                  {trafficLogs.length === 0 ? (
                    <div className="empty-state">Waiting for car detection...</div>
                  ) : (
                    trafficLogs.map(log => (
                      <div key={log.id} className="feed-item">
                        <div className="feed-icon" style={{ backgroundColor: '#60a5fa18', color: '#60a5fa' }}>{log.icon}</div>
                        <div className="feed-content">
                          <h4>{log.msg}</h4>
                          <p>{log.time}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Waste Feed (Slow/30s Resolution) */}
              <div className="card" id="waste-feed">
                <div className="feed-header">
                  <div className="feed-title">
                    <Trash2 size={16} color="var(--accent-orange)" />
                    <span>Bin Status Log</span>
                  </div>
                  <span className="feed-tag">System Healthy</span>
                </div>
                <div className="feed-container is-compact">
                  {wasteLogs.length === 0 ? (
                    <div className="empty-state">Awaiting status check...</div>
                  ) : (
                    wasteLogs.map(log => (
                      <div key={log.id} className="feed-item">
                        <div className="feed-icon" style={{ backgroundColor: '#fb923c18', color: '#fb923c' }}>{log.icon}</div>
                        <div className="feed-content">
                          <h4>{log.msg}</h4>
                          <p>{log.time}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Water Feed (Live) */}
              <div className="card" id="water-feed">
                <div className="feed-header">
                  <div className="feed-title">
                    <Droplets size={16} color="var(--accent-cyan)" />
                    <span>Water Monitoring Log</span>
                  </div>
                  <span className="feed-tag" style={{ background: isFloodAlert ? 'var(--accent-red)' : 'var(--accent-cyan)15', color: isFloodAlert ? '#fff' : 'var(--accent-cyan)' }}>
                    {isFloodAlert ? 'FLOOD ALERT' : 'Tide Normal'}
                  </span>
                </div>
                <div className="feed-container is-compact">
                  {waterLogs.length === 0 ? (
                    <div className="empty-state">Waiting for tide data...</div>
                  ) : (
                    waterLogs.map(log => (
                      <div key={log.id} className="feed-item">
                        <div className="feed-icon" style={{ backgroundColor: 'var(--accent-cyan)15', color: 'var(--accent-cyan)' }}>{log.icon}</div>
                        <div className="feed-content">
                          <h4>{log.msg}</h4>
                          <p>{log.time}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </main>

          {/* Emergency Alert Banner */}
          {activeEmergencies.length > 0 && (
            <div className="card alert-card">
              <div className="alert-header">
                <ShieldAlert size={18} color="#f87171" />
                <h3 style={{ fontSize: '0.95rem', color: '#f87171' }}>Active Emergencies ({activeEmergencies.length})</h3>
              </div>
              {activeEmergencies.map((e, i) => (
                <div key={i} className="alert-item">
                  <span>🚨 {e.type} — {e.severity}</span>
                  <span className="alert-time">{new Date(e.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}

          {/* AI Insight - now includes dynamic data */}
          {role === 'admin' && (
            <div className="card glass insight-card" id="ai-insight">
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
                  <p className="insight-label">
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
          trafficWindow={trafficWindow}
        />
      )}

      {/* ═══ TAB: TRAFFIC COMMAND CENTER (Admin Only) ═══ */}
      {activeTab === 'traffic' && role === 'admin' && (
        <TrafficCommandCenter 
          pipelineStats={pipelineStats} 
          networkMode={networkMode} 
          trafficWindow={trafficWindow}
          totalVehicleCount={totalVehicleCount}
          heavyTrafficActive={heavyTrafficActive}
        />
      )}

      {/* ═══ TAB: SMART WASTE ROUTING (Admin Only) ═══ */}
      {activeTab === 'waste' && role === 'admin' && (
        <WasteRoutingService />
      )}

      {/* ═══ TAB: AI AGENT (Admin Only) ═══ */}
      {activeTab === 'ai' && role === 'admin' && (
        <AIIncidentAnalysis />
      )}

    </div>
  );
}

export default App;
