import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity,  
  StatusBar,
  Dimensions,
  Animated,
  Platform,
  TextInput,
  Appearance,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { 
  Activity, 
  Trash2, 
  Zap,
  ChevronRight,
  ShieldAlert,
  Truck,
  Wifi,
  WifiOff,
  Bell,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Radio,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Thermometer,
  Wind,
  Droplets,
  User,
  Home,
  LogOut,
  Camera,
  Save,
  Building,
  Phone,
  TrafficCone,
  Siren,
  Timer,
  Settings2,
  ArrowRightLeft,
  Navigation,
  Eye,
  Gauge,
} from 'lucide-react-native';
import Svg, { Path, LinearGradient, Stop, Defs, Circle as SvgCircle } from 'react-native-svg';

const { width } = Dimensions.get('window');

// ═══════════════════════════════════════════════════
//  SIMULATED REAL-TIME DATA ENGINE
//  (Mirrors the MQTT → Edge → Microservice pipeline)
// ═══════════════════════════════════════════════════

const SIM_ZONES = ['Z1', 'Z2', 'Z3', 'Z4'];
const SIM_BINS = ['B001', 'B002', 'B003', 'B004', 'B005'];
const SIM_EMERGENCY_TYPES = ['FIRE', 'MEDICAL', 'ACCIDENT'];

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

function generateEmergencyEvent() {
  if (Math.random() < 0.08) {
    return {
      timestamp: new Date().toISOString(),
      type: SIM_EMERGENCY_TYPES[Math.floor(Math.random() * SIM_EMERGENCY_TYPES.length)],
      location: { lat: 22.57 + (Math.random() - 0.5) * 0.1, lng: 88.36 + (Math.random() - 0.5) * 0.1 },
      severity: 'HIGH',
    };
  }
  return null;
}

// Edge node aggregation simulation
class MobileEdgeNodeSimulator {
  constructor(networkMode = '5G') {
    this.networkMode = networkMode;
    this.trafficBuffer = {};
  }
  setNetworkMode(mode) { this.networkMode = mode; }
  getAggThreshold() { return this.networkMode === '5G' ? 3 : 10; }
  processTraffic(data) {
    const zone = data.zone_id;
    if (!this.trafficBuffer[zone]) this.trafficBuffer[zone] = [];
    this.trafficBuffer[zone].push(data.vehicle_count);
    const threshold = this.getAggThreshold();
    if (this.trafficBuffer[zone].length >= threshold) {
      const avg = this.trafficBuffer[zone].reduce((a, b) => a + b, 0) / this.trafficBuffer[zone].length;
      this.trafficBuffer[zone] = [];
      return { zone_id: zone, avg_vehicle_count: Math.round(avg * 10) / 10, timestamp: data.timestamp, mode: this.networkMode, compressed: this.networkMode === '4G_FALLBACK' };
    }
    return null;
  }
  processWaste(data) {
    const threshold = this.networkMode === '5G' ? 10 : 80;
    return data.fill_level >= threshold ? data : null;
  }
  processEmergency(data) { return data; }
}

function useRealtimePipeline(enabled, networkMode) {
  const [logs, setLogs] = useState([]);
  const [trafficHistory, setTrafficHistory] = useState([]);
  const [wasteStatus, setWasteStatus] = useState({});
  const [activeEmergencies, setActiveEmergencies] = useState([]);
  const [pipelineStats, setPipelineStats] = useState({ messagesProcessed: 0, messagesFiltered: 0, emergenciesForwarded: 0, avgLatency: 0 });
  const edgeRef = useRef(new MobileEdgeNodeSimulator(networkMode));
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    edgeRef.current.setNetworkMode(networkMode === '5G' ? '5G' : '4G_FALLBACK');
  }, [networkMode]);

  const addLog = useCallback((type, msg) => {
    setLogs(prev => [{ id: Date.now() + Math.random(), type, msg, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 29)]);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // Try WebSocket
    let ws;
    try {
      ws = new WebSocket('ws://localhost:3000');
      ws.onopen = () => { setWsConnected(true); addLog('edge', 'Connected to Gateway WebSocket'); };
      ws.onerror = () => setWsConnected(false);
      ws.onclose = () => setWsConnected(false);
    } catch (e) { setWsConnected(false); }

    const interval = setInterval(() => {
      const edge = edgeRef.current;
      let processed = 0, filtered = 0;
      const zone = SIM_ZONES[Math.floor(Math.random() * SIM_ZONES.length)];
      const trafficRaw = generateTrafficReading(zone);
      const trafficResult = edge.processTraffic(trafficRaw);
      processed++;
      if (trafficResult) {
        setTrafficHistory(prev => [...prev.slice(-15), { time: new Date().toLocaleTimeString(), flow: trafficResult.avg_vehicle_count, zone: trafficResult.zone_id }]);
        addLog('traffic', `${zone}: Avg ${trafficResult.avg_vehicle_count} vehicles (${trafficResult.mode})`);
      } else { filtered++; }
      const bin = SIM_BINS[Math.floor(Math.random() * SIM_BINS.length)];
      const wasteRaw = generateWasteReading(bin);
      const wasteResult = edge.processWaste(wasteRaw);
      processed++;
      if (wasteResult) {
        setWasteStatus(prev => ({ ...prev, [bin]: wasteResult }));
        if (wasteResult.fill_level >= 80) addLog('waste', `⚠️ ${bin} critical: ${wasteResult.fill_level}%`);
      } else { filtered++; }
      const emergencyRaw = generateEmergencyEvent();
      if (emergencyRaw) {
        addLog('emergency', `🚨 ${emergencyRaw.type} — ${emergencyRaw.severity}`);
        setActiveEmergencies(prev => [emergencyRaw, ...prev.slice(0, 4)]);
        setPipelineStats(prev => ({ ...prev, emergenciesForwarded: prev.emergenciesForwarded + 1 }));
      }
      setPipelineStats(prev => ({ ...prev, messagesProcessed: prev.messagesProcessed + processed, messagesFiltered: prev.messagesFiltered + filtered, avgLatency: Math.floor(Math.random() * 5) + (networkMode === '5G' ? 2 : 15) }));
    }, 2500);
    return () => { clearInterval(interval); if (ws) ws.close(); };
  }, [enabled, networkMode, addLog]);

  return { logs, trafficHistory, wasteStatus, activeEmergencies, pipelineStats, wsConnected };
}

// ── Color Palette ──
const isLight = Appearance.getColorScheme() === 'light';

const Colors = {
  light: {
    bg:        '#f8fafc',
    surface:   '#ffffff',
    card:      '#ffffff',
    cardHover: '#f1f5f9',
    highlight: '#e2e8f0',
    elevated:  '#ffffff',
    textPri:   '#0f172a',
    textSec:   '#475569',
    textMuted: '#94a3b8',
    blue:      '#3b82f6',
    cyan:      '#06b6d4',
    green:     '#10b981',
    red:       '#ef4444',
    orange:    '#f97316',
    purple:    '#8b5cf6',
    yellow:    '#fbbf24',
  },
  dark: {
    bg:        '#0a0e17',
    surface:   '#111827',
    card:      '#1a2234',
    cardHover: '#1f2a40',
    highlight: '#263049',
    elevated:  '#1e2a42',
    textPri:   '#f1f5f9',
    textSec:   '#94a3b8',
    textMuted: '#475569',
    blue:      '#60a5fa',
    cyan:      '#22d3ee',
    green:     '#34d399',
    red:       '#f87171',
    orange:    '#fb923c',
    purple:    '#a78bfa',
    yellow:    '#fbbf24',
  }
};

const C = isLight ? Colors.light : Colors.dark;

// ── Animated Stat Card ──
const StatCard = ({ title, value, unit, icon: Icon, color, delta, deltaUp, compact }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  if (compact) {
    return (
      <Animated.View style={[styles.statCardCompact, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.statIconSmall, { backgroundColor: color + '18' }]}>
          <Icon size={18} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.statTitleCompact}>{title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
            <Text style={[styles.statValueCompact, { color }]}>{value}</Text>
            {unit && <Text style={styles.statUnitCompact}>{unit}</Text>}
          </View>
        </View>
        {delta !== undefined && (
          <View style={[styles.deltaBadge, { backgroundColor: deltaUp ? C.green + '15' : C.red + '15' }]}>
            {deltaUp ? <TrendingUp size={10} color={C.green} /> : <TrendingDown size={10} color={C.red} />}
            <Text style={[styles.deltaText, { color: deltaUp ? C.green : C.red }]}>{delta}</Text>
          </View>
        )}
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.statCard, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={[styles.iconContainer, { backgroundColor: color + '18' }]}>
          <Icon size={20} color={color} />
        </View>
        {delta !== undefined && (
          <View style={[styles.deltaBadge, { backgroundColor: deltaUp ? C.green + '15' : C.red + '15' }]}>
            {deltaUp ? <TrendingUp size={11} color={C.green} /> : <TrendingDown size={11} color={C.red} />}
            <Text style={[styles.deltaText, { color: deltaUp ? C.green : C.red }]}>{delta}</Text>
          </View>
        )}
      </View>
      <Text style={styles.statTitle}>{title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        {unit && <Text style={styles.statUnit}>{unit}</Text>}
      </View>
    </Animated.View>
  );
};

// ── Temperature Chart ──
const TemperatureChart = ({ networkMode, points }) => {
  const chartW = width - 72;
  const chartH = 120;

  if (!points || points.length < 2) return null;

  const maxVal = 100;
  const step = chartW / (points.length - 1);
  const padT = 8;
  const padB = 4;
  const plotH = chartH - padT - padB;

  let pathD = '';
  let areaD = '';
  const pts = points.map((v, i) => ({
    x: i * step,
    y: padT + plotH - (v / maxVal) * plotH,
  }));

  pathD = `M${pts[0].x},${pts[0].y}`;
  areaD = `M${pts[0].x},${chartH}L${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cpx = (pts[i - 1].x + pts[i].x) / 2;
    pathD += ` C${cpx},${pts[i - 1].y} ${cpx},${pts[i].y} ${pts[i].x},${pts[i].y}`;
    areaD += ` C${cpx},${pts[i - 1].y} ${cpx},${pts[i].y} ${pts[i].x},${pts[i].y}`;
  }
  areaD += `L${pts[pts.length - 1].x},${chartH}Z`;

  const lineColor = networkMode === '5G' ? C.blue : C.orange;
  const lastPt = pts[pts.length - 1];

  return (
    <View style={styles.chartContainer}>
      <Svg height={chartH} width={chartW} viewBox={`0 0 ${chartW} ${chartH}`}>
        <Defs>
          <LinearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lineColor} stopOpacity="0.2" />
            <Stop offset="1" stopColor={lineColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={areaD} fill="url(#chartGrad)" />
        <Path d={pathD} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" />
        <SvgCircle cx={lastPt.x} cy={lastPt.y} r="4" fill={lineColor} />
        <SvgCircle cx={lastPt.x} cy={lastPt.y} r="8" fill={lineColor} fillOpacity="0.2" />
      </Svg>
      <View style={styles.chartLabels}>
        <Text style={styles.chartLabel}>0h</Text>
        <Text style={styles.chartLabel}>12h</Text>
        <Text style={styles.chartLabel}>24h</Text>
      </View>
    </View>
  );
};

// ── Alert Card ──
const AlertCard = ({ icon: Icon, iconColor, title, subtitle, severity, time }) => (
  <TouchableOpacity 
    activeOpacity={0.7} 
    style={[styles.alertCard, severity === 'critical' && { borderLeftWidth: 3, borderLeftColor: C.red }]}
  >
    <View style={[styles.alertIcon, { backgroundColor: (iconColor || C.blue) + '15' }]}>
      <Icon size={18} color={iconColor || C.blue} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.alertTitle}>{title}</Text>
      <Text style={styles.alertSub}>{subtitle}</Text>
      {time && <Text style={styles.alertTime}>{time}</Text>}
    </View>
    <ChevronRight color={C.textMuted} size={16} />
  </TouchableOpacity>
);

// ── Quick Action ──
const QuickAction = ({ icon: Icon, label, color }) => (
  <TouchableOpacity activeOpacity={0.7} style={styles.quickAction}>
    <View style={[styles.quickActionIcon, { backgroundColor: color + '15' }]}>
      <Icon size={20} color={color} />
    </View>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </TouchableOpacity>
);

// ── Separator ──
const Separator = () => <View style={styles.separator} />;

// ── Section Header ──
const SectionHeader = ({ title, action, onAction }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {action && (
      <TouchableOpacity activeOpacity={0.7} onPress={onAction}>
        <Text style={styles.sectionAction}>{action}</Text>
      </TouchableOpacity>
    )}
  </View>
);

import { auth, db } from './firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';


// ══════════════════════════════════════════════
//   MAIN APP
// ══════════════════════════════════════════════
const INTERSECTIONS = [
  { id: 'INT-01', name: 'Park St × Camac', zone: 'Z1' },
  { id: 'INT-02', name: 'Salt Lake Sec V', zone: 'Z2' },
  { id: 'INT-03', name: 'Howrah Bridge N', zone: 'Z3' },
  { id: 'INT-04', name: 'New Town Biswa', zone: 'Z4' },
  { id: 'INT-05', name: 'EM Bypass Ruby', zone: 'Z1' },
  { id: 'INT-06', name: 'Rajarhat Chow', zone: 'Z4' },
];

const SIGNAL_COLORS_MAP = { GREEN: C.green, YELLOW: '#fbbf24', RED: C.red };

function MainApp() {
  const [role, setRole] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const [networkMode, setNetworkMode] = useState('5G');
  const [weather, setWeather] = useState({
    temp: '--', wind: '--', precip: '--', pressure: '--'
  });
  const [chartData, setChartData] = useState([]);
  const [emergencyCount, setEmergencyCount] = useState(0);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'analytics' | 'traffic' | 'profile'
  const [userData, setUserData] = useState({
    name: 'Mainak Paul',
    phone: '+91 98765 43210',
    address: '123, Tech Street, Salt Lake',
    cityBlock: 'Block-C, Sector V',
    photo: null
  });
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const [signals, setSignals] = useState(() => {
    const init = {};
    INTERSECTIONS.forEach(i => {
      init[i.id] = {
        current: 'GREEN', mode: 'AUTO', greenDuration: 45,
        vehicleCount: Math.floor(Math.random() * 80) + 10,
        avgSpeed: Math.floor(Math.random() * 40) + 20,
        congestion: Math.random(),
      };
    });
    return init;
  });
  const [trafficCorridor, setTrafficCorridor] = useState(null);
  const [trafficIncidents, setTrafficIncidents] = useState([]);
  const [trafficRules, setTrafficRules] = useState([
    { id: 1, name: 'Rush Hour Extension', condition: 'congestion > 70%', action: 'GREEN +20s', zone: 'All', enabled: true },
    { id: 2, name: 'Night Mode', condition: '22:00–06:00', action: 'Blink YELLOW', zone: 'Z3,Z4', enabled: true },
    { id: 3, name: 'School Zone', condition: '07:30–09:00', action: 'Speed 30km/h', zone: 'Z2', enabled: false },
  ]);

  // Simulate IoT sensor updates for traffic
  useEffect(() => {
    const interval = setInterval(() => {
      setSignals(prev => {
        const next = { ...prev };
        INTERSECTIONS.forEach(i => {
          const s = { ...next[i.id] };
          s.vehicleCount = Math.max(5, s.vehicleCount + Math.floor(Math.random() * 20 - 10));
          s.avgSpeed = Math.max(5, Math.min(80, s.avgSpeed + Math.floor(Math.random() * 10 - 5)));
          s.congestion = Math.min(1, Math.max(0, s.vehicleCount / 100));
          if (s.mode === 'AUTO') {
            s.greenDuration = s.congestion > 0.8 ? 60 : s.congestion > 0.5 ? 45 : 30;
          }
          next[i.id] = s;
        });
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchUserData = async (uid) => {
      try {
        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (user.email && (user.email.startsWith('admin') || user.email.includes('admin@'))) setRole('admin');
        else setRole('user');
        fetchUserData(user.uid);
      } else {
        setRole(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveProfile = async () => {
    if (!auth.currentUser) return;
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), userData);
      alert('Profile saved successfully!');
    } catch (err) {
      alert('Error saving profile: ' + err.message);
    }
  };

  const handleAuth = async () => {
    try {
      let finalEmail = email;
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
    try {
      await signOut(auth);
      setUserData({
        name: 'Guest User',
        phone: '',
        address: '',
        cityBlock: '',
        photo: null
      });
      setActiveTab('dashboard');
    } catch (error) {
      alert(error.message);
    }
  };

  // Live simulation
  useEffect(() => {
    if (!role) return;

    const fetchWeather = async () => {
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=22.57&longitude=88.36&current=temperature_2m,wind_speed_10m,precipitation,surface_pressure&hourly=temperature_2m');
        const data = await res.json();
        setWeather({
          temp: data.current.temperature_2m,
          wind: data.current.wind_speed_10m,
          precip: data.current.precipitation,
          pressure: data.current.surface_pressure
        });

        const hourlyData = data.hourly.temperature_2m.slice(0, 24);
        setChartData(hourlyData);
        setLastUpdate(new Date());

      } catch (err) {
        console.error("Failed to fetch weather data", err);
      }
    };
    
    fetchWeather();
    const weatherInterval = setInterval(fetchWeather, 60000); // 1 min update

    return () => {
      clearInterval(weatherInterval);
    };
  }, [role, networkMode]);

  const toggleNetwork = () => {
    setNetworkMode(prev => prev === '5G' ? '4G' : '5G');
  };

  // ── Real-time Pipeline ──
  const { logs: liveLogs, trafficHistory, wasteStatus: liveWasteStatus, activeEmergencies: liveEmergencies, pipelineStats, wsConnected } = 
    useRealtimePipeline(!!role, networkMode);

  if (authLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: C.textPri }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!role) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', padding: 20 }]}>
        <View style={{ backgroundColor: C.card, padding: 30, borderRadius: 16, borderWidth: 1, borderColor: C.highlight }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: C.cyan, textAlign: 'center', marginBottom: 5 }}>NexaCity</Text>
          <Text style={{ fontSize: 12, color: C.textSec, textAlign: 'center', marginBottom: 20 }}>{isRegistering ? 'Create account' : 'Mobile Access'}</Text>
          
          <View style={{ flexDirection: 'row', backgroundColor: C.bg, padding: 4, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: C.highlight }}>
            <TouchableOpacity 
              onPress={() => setIsAdminMode(false)}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: !isAdminMode ? C.blue : 'transparent', alignItems: 'center' }}
            >
              <Text style={{ color: !isAdminMode ? '#fff' : C.textSec, fontWeight: 'bold', fontSize: 12 }}>USER</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setIsAdminMode(true)}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: isAdminMode ? C.red : 'transparent', alignItems: 'center' }}
            >
              <Text style={{ color: isAdminMode ? '#fff' : C.textSec, fontWeight: 'bold', fontSize: 12 }}>ADMIN</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={{ backgroundColor: C.bg, color: C.textPri, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: C.highlight, marginBottom: 15 }}
            placeholder="Email"
            placeholderTextColor={C.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={{ backgroundColor: C.bg, color: C.textPri, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: C.highlight, marginBottom: 15 }}
            placeholder="Password"
            placeholderTextColor={C.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          
          <TouchableOpacity onPress={handleAuth} style={{ backgroundColor: isAdminMode ? C.red : C.blue, padding: 16, borderRadius: 10, alignItems: 'center', marginBottom: 15 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{isRegistering ? 'Sign Up' : 'Sign In'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)}>
            <Text style={{ color: C.blue, textAlign: 'center', fontSize: 12 }}>
              {isRegistering ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderDashboard = () => (
    <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandName}>NexaCity</Text>
            <Text style={styles.greeting}>{role === 'admin' ? 'City Admin Dashboard' : 'City Observer View'}</Text>
          </View>
          <TouchableOpacity 
            activeOpacity={0.7} 
            style={[
              styles.networkBadge, 
              { borderColor: networkMode === '5G' ? C.green + '40' : C.orange + '40' }
            ]}
            onPress={toggleNetwork}
          >
            <View style={[styles.pulse, { backgroundColor: networkMode === '5G' ? C.green : C.orange }]} />
            {networkMode === '5G' 
              ? <Wifi size={12} color={C.green} />
              : <WifiOff size={12} color={C.orange} />
            }
            <Text style={[
              styles.networkText, 
              { color: networkMode === '5G' ? C.green : C.orange }
            ]}>
              {networkMode === '5G' ? '5G LIVE' : '4G'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Updated timestamp ── */}
        <View style={styles.timestampRow}>
          <Clock size={12} color={C.textMuted} />
          <Text style={styles.timestamp}>Updated {lastUpdate.toLocaleTimeString()}</Text>
        </View>

        {/* ── Stats Grid (2x2) ── */}
        <View style={styles.statsRow}>
          <StatCard 
            title="Surface Pressure" 
            value={weather.pressure} 
            unit="hPa" 
            icon={Activity} 
            color={C.blue}
            delta="Live"
            deltaUp={true}
          />
          <StatCard 
            title="Kolkata Temp" 
            value={weather.temp} 
            unit="°C" 
            icon={Thermometer} 
            color={C.orange}
            delta="Live"
            deltaUp={true}
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard 
            title="Wind Speed" 
            value={weather.wind} 
            unit="km/h" 
            icon={Wind} 
            color={C.cyan}
            delta="Live"
            deltaUp={true}
          />
          <StatCard 
            title="Precipitation" 
            value={weather.precip} 
            unit="mm" 
            icon={Droplets} 
            color={C.blue}
            delta={weather.precip === 0 ? "Clear" : "Raining"}
            deltaUp={weather.precip === 0}
          />
        </View>

        {/* ── Emergency Banner — now from live pipeline ── */}
        {liveEmergencies.length > 0 && (
          <View style={styles.emergencyBanner}>
            <AlertCircle size={18} color={isLight ? C.red : "#fff"} />
            <View style={{ flex: 1 }}>
              <Text style={styles.emergencyTitle}>Active Emergency ({liveEmergencies.length})</Text>
              <Text style={styles.emergencySub}>{liveEmergencies[0].type} alert — Dispatching</Text>
            </View>
          </View>
        )}

        {/* ── Pipeline Stats ── */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.highlight }}>
            <Text style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Msgs Processed</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: C.blue }}>{pipelineStats.messagesProcessed}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.highlight }}>
            <Text style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Avg Latency</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: networkMode === '5G' ? C.green : C.orange }}>{pipelineStats.avgLatency}ms</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.highlight }}>
            <Text style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Filtered</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: C.cyan }}>{pipelineStats.messagesFiltered}</Text>
          </View>
        </View>

        <Separator />

        {/* ── Live Operations Feed ── */}
        <SectionHeader title="Live Feed" action={wsConnected ? '● WS' : '● Sim'} />
        {liveLogs.slice(0, 6).map((log) => (
          <View key={log.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, backgroundColor: C.card, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.highlight }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: log.type === 'traffic' ? C.blue + '15' : log.type === 'waste' ? C.orange + '15' : log.type === 'emergency' ? C.red + '15' : C.cyan + '15' }}>
              {log.type === 'traffic' && <Truck size={15} color={C.blue} />}
              {log.type === 'waste' && <Trash2 size={15} color={C.orange} />}
              {log.type === 'emergency' && <AlertTriangle size={15} color={C.red} />}
              {log.type === 'edge' && <Zap size={15} color={C.cyan} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: C.textPri }}>{log.msg}</Text>
              <Text style={{ fontSize: 11, color: C.textMuted }}>{log.time}</Text>
            </View>
          </View>
        ))}

        <Separator />

        {/* ── Quick Actions ── */}
        <SectionHeader title="Quick Actions" />
        <View style={styles.quickActionsRow}>
          <QuickAction icon={BarChart3} label="Analytics" color={C.blue} />
          <QuickAction icon={MapPin} label="City Map" color={C.green} />
          <QuickAction icon={Bell} label="Alerts" color={C.orange} />
          <QuickAction icon={Radio} label="Edge Nodes" color={C.purple} />
        </View>

        <Separator />

        {/* ── Traffic Chart ── */}
        <SectionHeader title="Temperature Trend" action="24h Forecast" />
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartHeaderText}>Hourly variation</Text>
            <View style={[styles.liveChip, { backgroundColor: networkMode === '5G' ? C.green + '18' : C.orange + '18' }]}>
              <View style={[styles.liveDot, { backgroundColor: networkMode === '5G' ? C.green : C.orange }]} />
              <Text style={[styles.liveText, { color: networkMode === '5G' ? C.green : C.orange }]}>
                {networkMode === '5G' ? '5G' : '4G'}
              </Text>
            </View>
          </View>
          <TemperatureChart networkMode={networkMode} points={chartData} />
        </View>

        <Separator />

        {role === 'admin' && (
          <>
            <SectionHeader title="Security & Alerts" action={`${emergencyCount > 0 ? '1' : '0'} active`} />

            {emergencyCount > 0 ? (
              <AlertCard
                icon={ShieldAlert}
                iconColor={C.red}
                title="Critical Incident — Zone 4"
                subtitle="Smoke detected in Metro Sector"
                severity="critical"
                time="Just now"
              />
            ) : (
              <View style={styles.allClearCard}>
                <CheckCircle2 size={24} color={C.green} />
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={styles.allClearTitle}>All Clear</Text>
                  <Text style={styles.allClearSub}>No active emergencies</Text>
                </View>
              </View>
            )}

            <AlertCard
              icon={Truck}
              iconColor={C.blue}
              title="Traffic Congestion"
              subtitle="5th Avenue intersection delay"
              time="2 min ago"
            />

            <Separator />

            <SectionHeader title="Network Mode" />
            <TouchableOpacity activeOpacity={0.7} onPress={toggleNetwork} style={styles.networkCard}>
              <View style={styles.networkCardLeft}>
                <View style={styles.networkModeIndicator}>
                  {networkMode === '5G' 
                    ? <Wifi size={24} color={C.green} />
                    : <WifiOff size={24} color={C.orange} />
                  }
                </View>
                <View>
                  <Text style={styles.networkCardTitle}>
                    {networkMode === '5G' ? '5G Connected' : '4G Fallback'}
                  </Text>
                  <Text style={styles.networkCardSub}>
                    {networkMode === '5G' ? 'Full resolution • Low latency' : 'Bandwidth saving • Compressed'}
                  </Text>
                </View>
              </View>
              <View style={[styles.networkToggle, { backgroundColor: networkMode === '5G' ? C.green + '20' : C.orange + '20' }]}>
                <Text style={[styles.networkToggleText, { color: networkMode === '5G' ? C.green : C.orange }]}>
                  {networkMode === '5G' ? 'Switch to 4G' : 'Switch to 5G'}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.edgeStatsRow}>
              <View style={styles.edgeStat}>
                <Text style={styles.edgeStatValue}>{networkMode === '5G' ? '3' : '10'}</Text>
                <Text style={styles.edgeStatLabel}>Agg Threshold</Text>
              </View>
              <View style={[styles.edgeStat, styles.edgeStatBorder]}>
                <Text style={styles.edgeStatValue}>{networkMode === '5G' ? '>10%' : '>80%'}</Text>
                <Text style={styles.edgeStatLabel}>Waste Forward</Text>
              </View>
              <View style={styles.edgeStat}>
                <Text style={styles.edgeStatValue}>{networkMode === '5G' ? 'HIGH' : 'LOW'}</Text>
                <Text style={styles.edgeStatLabel}>Resolution</Text>
              </View>
            </View>

            <Separator />

            <View style={styles.insightBox}>
              <View style={styles.insightHeader}>
                <View style={styles.insightIconWrap}>
                  <TrendingUp size={16} color={C.cyan} />
                </View>
                <Text style={styles.insightLabel}>AI Insight</Text>
              </View>
              <Text style={styles.insightText}>
                Re-routing public transport through Sector 7 will save{' '}
                <Text style={{ color: C.cyan, fontWeight: '700' }}>1.5 tons</Text> of carbon emissions today. 
                Confidence: <Text style={{ color: C.green, fontWeight: '700' }}>92%</Text>
              </Text>
            </View>
          </>
        )}

        {/* Bottom padding */}
        <View style={{ height: 100 }} />
      </ScrollView>
  );

  // ═══════════════════════════════════════════════
  //   ANALYTICS TAB
  // ═══════════════════════════════════════════════
  const renderAnalytics = () => {
    const trafficPrediction = SIM_ZONES.map(zone => ({
      zone,
      congestion: Math.round(Math.random() * 80 + 10),
      confidence: Math.round(Math.random() * 15 + 85),
      recommendation: Math.random() > 0.5 ? 'Adjust timing' : 'Maintain current',
    }));
    const wastePrediction = SIM_BINS.map(bin => {
      const current = liveWasteStatus[bin]?.fill_level || Math.floor(Math.random() * 60);
      return {
        bin,
        current,
        daysUntilFull: Math.round((100 - current) / (Math.random() * 15 + 5) * 10) / 10,
        priority: current >= 80 ? 'HIGH' : current >= 50 ? 'MEDIUM' : 'LOW',
      };
    });
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandName}>NexaCity</Text>
            <Text style={styles.greeting}>Analytics Dashboard</Text>
          </View>
        </View>

        {/* Pipeline Performance */}
        <SectionHeader title="Pipeline Performance" />
        <View style={styles.statsRow}>
          <StatCard title="Total Msgs" value={pipelineStats.messagesProcessed} icon={Radio} color={C.blue} compact />
          <StatCard title="Latency" value={pipelineStats.avgLatency} unit="ms" icon={Zap} color={networkMode === '5G' ? C.green : C.orange} compact />
        </View>
        <View style={styles.statsRow}>
          <StatCard title="Emergencies" value={pipelineStats.emergenciesForwarded} icon={ShieldAlert} color={C.red} compact />
          <StatCard title="Filtered" value={pipelineStats.messagesFiltered} icon={Activity} color={C.purple} compact />
        </View>

        <Separator />

        {/* Traffic Congestion Predictions */}
        <SectionHeader title="Traffic AI Predictions" action="Per Zone" />
        {trafficPrediction.map((t, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, backgroundColor: C.card, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.highlight }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: (t.congestion >= 70 ? C.red : t.congestion >= 40 ? C.orange : C.green) + '15', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: t.congestion >= 70 ? C.red : t.congestion >= 40 ? C.orange : C.green }}>{t.congestion}%</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.textPri }}>{t.zone}</Text>
              <Text style={{ fontSize: 12, color: C.textSec, marginTop: 1 }}>{t.recommendation}</Text>
            </View>
            <View style={{ backgroundColor: C.green + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: C.green }}>{t.confidence}%</Text>
            </View>
          </View>
        ))}

        <Separator />

        {/* Waste Collection Optimization */}
        <SectionHeader title="Waste Collection Priority" action="Optimizer" />
        {wastePrediction.map((w, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, backgroundColor: C.card, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.highlight }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: (w.priority === 'HIGH' ? C.red : w.priority === 'MEDIUM' ? C.orange : C.green) + '15', justifyContent: 'center', alignItems: 'center' }}>
              <Trash2 size={18} color={w.priority === 'HIGH' ? C.red : w.priority === 'MEDIUM' ? C.orange : C.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.textPri }}>{w.bin} — {w.current}% full</Text>
              <Text style={{ fontSize: 12, color: C.textSec, marginTop: 1 }}>{w.daysUntilFull} days until full</Text>
            </View>
            <View style={{ backgroundColor: (w.priority === 'HIGH' ? C.red : w.priority === 'MEDIUM' ? C.orange : C.green) + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: w.priority === 'HIGH' ? C.red : w.priority === 'MEDIUM' ? C.orange : C.green }}>{w.priority}</Text>
            </View>
          </View>
        ))}

        <Separator />

        {/* Live Traffic History */}
        <SectionHeader title="Traffic Flow History" action="Real-time" />
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartHeaderText}>Edge → Dashboard pipeline</Text>
            <View style={[styles.liveChip, { backgroundColor: (wsConnected ? C.green : C.orange) + '18' }]}>
              <View style={[styles.liveDot, { backgroundColor: wsConnected ? C.green : C.orange }]} />
              <Text style={[styles.liveText, { color: wsConnected ? C.green : C.orange }]}>{wsConnected ? 'WS' : 'SIM'}</Text>
            </View>
          </View>
          <TemperatureChart networkMode={networkMode} points={trafficHistory.map(t => t.flow)} />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  // ═══════════════════════════════════════════════
  //   TRAFFIC COMMAND CENTER TAB (Admin Only)
  // ═══════════════════════════════════════════════

  const renderTrafficControl = () => {
    const totalVehicles = Object.values(signals).reduce((a, s) => a + s.vehicleCount, 0);
    const avgCong = Object.values(signals).reduce((a, s) => a + s.congestion, 0) / INTERSECTIONS.length;
    const manualCount = Object.values(signals).filter(s => s.mode === 'MANUAL').length;

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandName}>NexaCity</Text>
            <Text style={styles.greeting}>🚦 Traffic Command</Text>
          </View>
          {trafficCorridor && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.red + '18', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 }}>
              <Siren size={12} color={C.red} />
              <Text style={{ fontSize: 10, fontWeight: '800', color: C.red }}>CORRIDOR</Text>
            </View>
          )}
        </View>

        {/* KPI Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { padding: 14 }]}>
            <Text style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Vehicles</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: C.blue }}>{totalVehicles}</Text>
          </View>
          <View style={[styles.statCard, { padding: 14 }]}>
            <Text style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Congestion</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: avgCong > 0.7 ? C.red : avgCong > 0.4 ? C.orange : C.green }}>{Math.round(avgCong * 100)}%</Text>
          </View>
          <View style={[styles.statCard, { padding: 14 }]}>
            <Text style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Manual</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: C.orange }}>{manualCount}</Text>
          </View>
        </View>

        {/* Emergency Corridor */}
        <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.highlight, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Siren size={16} color={C.red} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.textPri }}>Emergency Corridor</Text>
          </View>
          {trafficCorridor ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.red + '10', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.red + '30' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Navigation size={16} color={C.red} />
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.red }}>{trafficCorridor.from} → {trafficCorridor.to}</Text>
                  <Text style={{ fontSize: 11, color: C.textMuted }}>All signals GREEN</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => {
                setTrafficCorridor(null);
                setSignals(prev => {
                  const next = { ...prev };
                  Object.keys(next).forEach(k => { if (next[k].mode === 'EMERGENCY') next[k] = { ...next[k], mode: 'AUTO' }; });
                  return next;
                });
              }} style={{ backgroundColor: C.red, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Stop</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[['Z1', 'Z3'], ['Z2', 'Z4'], ['Z1', 'Z4']].map(([from, to], i) => (
                <TouchableOpacity key={i} onPress={() => {
                  setTrafficCorridor({ from, to, time: new Date() });
                  setSignals(prev => {
                    const next = { ...prev };
                    INTERSECTIONS.filter(int => int.zone === from || int.zone === to).forEach(int => {
                      next[int.id] = { ...next[int.id], current: 'GREEN', mode: 'EMERGENCY', greenDuration: 90 };
                    });
                    return next;
                  });
                }} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: C.highlight, borderRadius: 12 }}>
                  <ArrowRightLeft size={16} color={C.red} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.textPri, marginTop: 4 }}>{from}→{to}</Text>
                  <Text style={{ fontSize: 10, color: C.textMuted }}>Clear</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <Separator />

        {/* Live Intersection Monitor */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Eye size={12} color={C.textMuted} />
          <Text style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' }}>Live IoT Intersections</Text>
        </View>

        {INTERSECTIONS.map(intersection => {
          const s = signals[intersection.id];
          const congPct = Math.round(s.congestion * 100);
          return (
            <View key={intersection.id} style={{
              backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 10,
              borderWidth: 1, borderColor: s.mode === 'EMERGENCY' ? C.red + '40' : s.mode === 'MANUAL' ? '#fbbf2440' : C.highlight,
            }}>
              {/* Header row */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: C.textPri }}>{intersection.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MapPin size={9} color={C.textMuted} />
                    <Text style={{ fontSize: 11, color: C.textMuted }}>{intersection.zone} • {intersection.id}</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: (s.mode === 'EMERGENCY' ? C.red : s.mode === 'MANUAL' ? '#fbbf24' : C.green) + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: s.mode === 'EMERGENCY' ? C.red : s.mode === 'MANUAL' ? '#fbbf24' : C.green }}>{s.mode}</Text>
                </View>
              </View>

              {/* Stats */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <View style={{ flex: 1, alignItems: 'center', paddingVertical: 6, backgroundColor: C.highlight, borderRadius: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: congPct > 70 ? C.red : congPct > 40 ? C.orange : C.green }}>{congPct}%</Text>
                  <Text style={{ fontSize: 9, color: C.textMuted }}>CONGEST</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center', paddingVertical: 6, backgroundColor: C.highlight, borderRadius: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: C.textPri }}>{s.vehicleCount}</Text>
                  <Text style={{ fontSize: 9, color: C.textMuted }}>VEHICLES</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center', paddingVertical: 6, backgroundColor: C.highlight, borderRadius: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: C.textPri }}>{s.avgSpeed}</Text>
                  <Text style={{ fontSize: 9, color: C.textMuted }}>KM/H</Text>
                </View>
              </View>

              {/* Signal Override Buttons */}
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                {['GREEN', 'YELLOW', 'RED'].map(state => (
                  <TouchableOpacity key={state} onPress={() => {
                    setSignals(prev => ({ ...prev, [intersection.id]: { ...prev[intersection.id], current: state, mode: 'MANUAL' } }));
                  }} style={{
                    flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
                    backgroundColor: s.current === state ? SIGNAL_COLORS_MAP[state] : C.highlight,
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: s.current === state ? '#fff' : C.textMuted }}>{state}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Footer */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Timer size={10} color={C.textMuted} />
                  <Text style={{ fontSize: 10, color: C.textMuted }}>Green: {s.greenDuration}s</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {s.mode !== 'AUTO' && (
                    <TouchableOpacity onPress={() => {
                      setSignals(prev => ({ ...prev, [intersection.id]: { ...prev[intersection.id], mode: 'AUTO' } }));
                    }} style={{ backgroundColor: C.green + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: C.green }}>AUTO</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => {
                    setTrafficIncidents(prev => [{ id: Date.now(), name: intersection.name, zone: intersection.zone, time: new Date(), status: 'ACTIVE' }, ...prev.slice(0, 9)]);
                  }} style={{ backgroundColor: C.red + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: C.red }}>⚠ Report</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

        <Separator />

        {/* Automation Rules */}
        <SectionHeader title="Automation Rules" action={`${trafficRules.filter(r => r.enabled).length} active`} />
        {trafficRules.map(rule => (
          <TouchableOpacity key={rule.id} onPress={() => setTrafficRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))} style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            backgroundColor: C.card, padding: 14, borderRadius: 14, marginBottom: 8,
            borderWidth: 1, borderColor: C.highlight, opacity: rule.enabled ? 1 : 0.5,
          }}>
            <View style={{
              width: 36, height: 20, borderRadius: 10,
              backgroundColor: rule.enabled ? C.green : C.highlight,
              justifyContent: 'center',
            }}>
              <View style={{
                width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff',
                marginLeft: rule.enabled ? 18 : 2,
              }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.textPri }}>{rule.name}</Text>
              <Text style={{ fontSize: 11, color: C.textMuted }}>IF {rule.condition} → {rule.action} [{rule.zone}]</Text>
            </View>
          </TouchableOpacity>
        ))}

        <Separator />

        {/* Incidents */}
        <SectionHeader title="Incidents" action={`${trafficIncidents.length} reported`} />
        {trafficIncidents.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: C.textMuted }}>No incidents reported</Text>
          </View>
        ) : (
          trafficIncidents.map(inc => (
            <View key={inc.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, backgroundColor: C.card, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.highlight }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: C.orange + '15' }}>
                <AlertTriangle size={15} color={C.orange} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: C.textPri }}>{inc.name}</Text>
                <Text style={{ fontSize: 11, color: C.textMuted }}>{inc.zone} • {inc.time.toLocaleTimeString()} • {inc.status}</Text>
              </View>
            </View>
          ))
        )}

        {/* AI Insight */}
        <View style={[styles.insightBox, { marginTop: 12 }]}>
          <View style={styles.insightHeader}>
            <View style={[styles.insightIconWrap, { backgroundColor: C.blue + '18' }]}>
              <Gauge size={16} color={C.blue} />
            </View>
            <Text style={[styles.insightLabel, { color: C.blue }]}>AI Traffic Optimizer</Text>
          </View>
          <Text style={styles.insightText}>
            City-wide congestion: <Text style={{ color: avgCong > 0.7 ? C.red : C.green, fontWeight: '700' }}>{Math.round(avgCong * 100)}%</Text>.
            {avgCong > 0.6
              ? <Text> Extend GREEN on <Text style={{ color: C.blue, fontWeight: '700' }}>Park St</Text> by 15s to cut queue by <Text style={{ color: C.green, fontWeight: '700' }}>23%</Text>.</Text>
              : <Text> Traffic smooth. Next adjust at peak hour (<Text style={{ color: C.blue, fontWeight: '700' }}>17:30</Text>).</Text>
            }{' '}Monitoring <Text style={{ color: C.cyan, fontWeight: '700' }}>{totalVehicles}</Text> vehicles.
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  const renderProfile = () => (
    <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <Text style={styles.profileTitle}>User Profile</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <LogOut size={16} color={C.red} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
             <View style={styles.avatarPlaceholder}>
                <User size={60} color={C.textMuted} />
             </View>
             <TouchableOpacity style={styles.editAvatarBtn}>
                <Camera size={16} color="#fff" />
             </TouchableOpacity>
          </View>
          <Text style={styles.profileName}>{userData.name}</Text>
          <Text style={styles.profileEmail}>{auth.currentUser?.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: role === 'admin' ? C.red + '15' : C.blue + '15' }]}>
            <Text style={[styles.roleBadgeText, { color: role === 'admin' ? C.red : C.blue }]}>
              {role?.toUpperCase()}
            </Text>
          </View>
        </View>

        <Separator />

        <SectionHeader title="Personal Details" />

        <View style={styles.inputGroup}>
          <View style={styles.inputLabelRow}>
            <User size={14} color={C.textMuted} />
            <Text style={styles.inputLabel}>Full Name</Text>
          </View>
          <TextInput 
            style={styles.profileInput}
            value={userData.name}
            onChangeText={(txt) => setUserData({...userData, name: txt})}
            placeholder="John Doe"
            placeholderTextColor={C.textMuted}
          />
        </View>
        
        <View style={styles.inputGroup}>
          <View style={styles.inputLabelRow}>
            <Phone size={14} color={C.textMuted} />
            <Text style={styles.inputLabel}>Phone Number</Text>
          </View>
          <TextInput 
            style={styles.profileInput}
            value={userData.phone}
            onChangeText={(txt) => setUserData({...userData, phone: txt})}
            keyboardType="phone-pad"
            placeholder="+91 XXXXX XXXXX"
            placeholderTextColor={C.textMuted}
          />
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.inputLabelRow}>
            <MapPin size={14} color={C.textMuted} />
            <Text style={styles.inputLabel}>Residential Address</Text>
          </View>
          <TextInput 
            style={[styles.profileInput, { height: 80, textAlignVertical: 'top' }]}
            value={userData.address}
            onChangeText={(txt) => setUserData({...userData, address: txt})}
            multiline
            placeholder="Enter your full address"
            placeholderTextColor={C.textMuted}
          />
        </View>

        <View style={styles.inputGroup}>
          <View style={styles.inputLabelRow}>
            <Building size={14} color={C.textMuted} />
            <Text style={styles.inputLabel}>City Block / Zone</Text>
          </View>
          <TextInput 
            style={styles.profileInput}
            value={userData.cityBlock}
            onChangeText={(txt) => setUserData({...userData, cityBlock: txt})}
            placeholder="e.g. Block-C, Sector V"
            placeholderTextColor={C.textMuted}
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} activeOpacity={0.8} onPress={handleSaveProfile}>
           <Save size={18} color="#fff" />
           <Text style={styles.saveBtnText}>Save Changes</Text>
        </TouchableOpacity>

        <Separator />

        <SectionHeader title="Account Settings" />
        <TouchableOpacity style={styles.settingItem}>
           <View style={[styles.settingIcon, { backgroundColor: C.purple + '15' }]}>
              <Bell size={18} color={C.purple} />
           </View>
           <Text style={styles.settingText}>Notifications</Text>
           <ChevronRight size={18} color={C.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
           <View style={[styles.settingIcon, { backgroundColor: C.blue + '15' }]}>
              <ShieldAlert size={18} color={C.blue} />
           </View>
           <Text style={styles.settingText}>Privacy & Security</Text>
           <ChevronRight size={18} color={C.textMuted} />
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isLight ? "dark-content" : "light-content"} backgroundColor={C.bg} />
      
      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'analytics' && renderAnalytics()}
      {activeTab === 'traffic' && role === 'admin' && renderTrafficControl()}
      {activeTab === 'profile' && renderProfile()}

      {/* ── Bottom Navbar ── */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          onPress={() => setActiveTab('dashboard')} 
          style={styles.navItem}
        >
          <Home size={20} color={activeTab === 'dashboard' ? C.blue : C.textMuted} />
          <Text style={[styles.navText, { color: activeTab === 'dashboard' ? C.blue : C.textMuted }]}>Home</Text>
          {activeTab === 'dashboard' && <View style={styles.navIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setActiveTab('analytics')} 
          style={styles.navItem}
        >
          <BarChart3 size={20} color={activeTab === 'analytics' ? C.cyan : C.textMuted} />
          <Text style={[styles.navText, { color: activeTab === 'analytics' ? C.cyan : C.textMuted }]}>Analytics</Text>
          {activeTab === 'analytics' && <View style={[styles.navIndicator, { backgroundColor: C.cyan }]} />}
        </TouchableOpacity>

        {role === 'admin' && (
          <TouchableOpacity 
            onPress={() => setActiveTab('traffic')} 
            style={styles.navItem}
          >
            <TrafficCone size={20} color={activeTab === 'traffic' ? C.red : C.textMuted} />
            <Text style={[styles.navText, { color: activeTab === 'traffic' ? C.red : C.textMuted }]}>Traffic</Text>
            {activeTab === 'traffic' && <View style={[styles.navIndicator, { backgroundColor: C.red }]} />}
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          onPress={() => setActiveTab('profile')} 
          style={styles.navItem}
        >
          <User size={20} color={activeTab === 'profile' ? C.blue : C.textMuted} />
          <Text style={[styles.navText, { color: activeTab === 'profile' ? C.blue : C.textMuted }]}>Profile</Text>
          {activeTab === 'profile' && <View style={styles.navIndicator} />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}



// ══════════════════════════════════════════════
//   STYLES
// ══════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 15 : 24,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  brandName: {
    fontSize: 13,
    fontWeight: '700',
    color: C.cyan,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: C.textPri,
    letterSpacing: -0.5,
  },

  // ── Network Badge ──
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
  },
  networkText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pulse: {
    width: 6, height: 6,
    borderRadius: 3,
  },

  // ── Timestamp ──
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
    marginTop: 2,
  },
  timestamp: {
    fontSize: 12,
    color: C.textMuted,
  },

  // ── Stats Grid ──
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.card,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.highlight,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  statCardCompact: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.card,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.highlight,
  },
  statIconSmall: {
    width: 36, height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statTitleCompact: {
    fontSize: 10,
    color: C.textSec,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValueCompact: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statUnitCompact: {
    fontSize: 11,
    color: C.textMuted,
    fontWeight: '600',
  },
  iconContainer: {
    width: 40, height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statTitle: {
    fontSize: 12,
    color: C.textSec,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -1,
  },
  statUnit: {
    fontSize: 14,
    color: C.textMuted,
    fontWeight: '600',
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  deltaText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Emergency Banner ──
  emergencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.red + '18',
    borderWidth: 1,
    borderColor: C.red + '30',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  emergencyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.red,
  },
  emergencySub: {
    fontSize: 12,
    color: C.textSec,
    marginTop: 2,
  },

  // ── Quick Actions ──
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  quickActionIcon: {
    width: 50, height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    color: C.textSec,
    fontWeight: '600',
  },

  // ── Separator ──
  separator: {
    height: 1,
    backgroundColor: C.highlight,
    marginVertical: 24,
    opacity: 0.5,
  },

  // ── Section Header ──
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.textPri,
  },
  sectionAction: {
    fontSize: 14,
    color: C.blue,
    fontWeight: '600',
  },

  // ── Chart ──
  chartCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: C.highlight,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartHeaderText: {
    fontSize: 12,
    color: C.textMuted,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6, height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
  },

  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    marginTop: 8,
  },
  chartLabel: {
    fontSize: 10,
    color: C.textMuted,
    fontWeight: '500',
  },

  // ── Alert Card ──
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.highlight,
    gap: 12,
  },
  alertIcon: {
    width: 40, height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textPri,
  },
  alertSub: {
    fontSize: 12,
    color: C.textSec,
    marginTop: 2,
  },
  alertTime: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 4,
  },

  // ── All Clear ──
  allClearCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.green + '0a',
    borderWidth: 1,
    borderColor: C.green + '20',
    borderRadius: 16,
    padding: 20,
    marginBottom: 10,
  },
  allClearTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.green,
  },
  allClearSub: {
    fontSize: 13,
    color: C.textSec,
  },

  // ── Network Card ──
  networkCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: C.highlight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  networkCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  networkModeIndicator: {
    width: 48, height: 48,
    borderRadius: 14,
    backgroundColor: C.highlight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  networkCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textPri,
  },
  networkCardSub: {
    fontSize: 12,
    color: C.textSec,
    marginTop: 2,
  },
  networkToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  networkToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Edge Stats ──
  edgeStatsRow: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.highlight,
    marginTop: 12,
    overflow: 'hidden',
  },
  edgeStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  edgeStatBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: C.highlight,
    borderRightColor: C.highlight,
  },
  edgeStatValue: {
    fontSize: 16,
    fontWeight: '800',
    color: C.textPri,
    marginBottom: 4,
  },
  edgeStatLabel: {
    fontSize: 10,
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── AI Insight ──
  insightBox: {
    backgroundColor: C.cyan + '08',
    borderWidth: 1,
    borderColor: C.cyan + '18',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  insightIconWrap: {
    width: 28, height: 28,
    borderRadius: 8,
    backgroundColor: C.cyan + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.cyan,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  insightText: {
    color: C.textSec,
    fontSize: 14,
    lineHeight: 22,
  },

  // ── Bottom Nav ──
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: C.surface,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: C.highlight,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 20,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    flex: 1,
  },
  navText: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  navIndicator: {
    position: 'absolute',
    top: 0,
    width: 32,
    height: 3,
    backgroundColor: C.blue,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },

  // ── Profile Styles ──
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  profileTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: C.textPri,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.red + '10',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.red,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    position: 'relative',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: C.highlight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: C.surface,
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: C.blue,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: C.surface,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: C.textPri,
  },
  profileEmail: {
    fontSize: 14,
    color: C.textSec,
    marginTop: 2,
  },
  roleBadge: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    marginLeft: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textSec,
  },
  profileInput: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.highlight,
    color: C.textPri,
    fontSize: 15,
  },
  saveBtn: {
    backgroundColor: C.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 10,
    shadowColor: C.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.highlight,
  },
  settingIcon: {
    width: 36, height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: C.textPri,
  },
});
