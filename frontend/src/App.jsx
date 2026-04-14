import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { 
  XAxis, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

// We'll fetch real historical/forecast data for the chart instead of fake data

const StatCard = ({ title, value, icon: Icon, color, delta, deltaUp }) => (
  <div className="card">
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

function App() {
  const [role, setRole] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'admin' && password === 'admin') setRole('admin');
    else if (username === 'user' && password === 'user') setRole('user');
    else alert('Invalid credentials');
  };

  const [logs, setLogs] = useState([
    { id: 1, type: 'traffic', msg: 'Peak detection in Zone 2', time: 'Just now', icon: '🚦' },
    { id: 2, type: 'waste', msg: 'Bin B003 requires collection', time: '2 min ago', icon: '🗑️' },
    { id: 3, type: 'emergency', msg: 'Medical alert cleared (Zone 4)', time: '5 min ago', icon: '✅' },
    { id: 4, type: 'edge', msg: 'Edge node Z1 forwarded batch', time: '7 min ago', icon: '⚡' },
  ]);

  const [chartData, setChartData] = useState([]);

  const [weather, setWeather] = useState({
    temp: '--',
    wind: '--',
    precip: '--',
    tempDeltaUp: true,
    pressure: '--',
  });


  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Fetch actual online data
  useEffect(() => {
    // Only fetch if logged in to avoid unnecessary requests on login screen
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

        // Map hourly data map to chart (first 24 hours)
        const hourlyChart = data.hourly.time.slice(0, 24).map((timeStr, idx) => {
          const t = new Date(timeStr);
          return {
            time: `${t.getHours()}:00`,
            flow: data.hourly.temperature_2m[idx] // reusing 'flow' key for temp to minimize chart changes
          };
        });
        setChartData(hourlyChart);
        setLastUpdate(new Date());

      } catch (err) {
        console.error("Failed to fetch actual online data", err);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 60000); // 1 min update
    
    return () => {
      clearInterval(interval);
    };
  }, [role]);

  if (!role) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a', fontFamily: 'sans-serif' }}>
         <form onSubmit={handleLogin} style={{ backgroundColor: '#1e293b', padding: 40, borderRadius: 16, border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: 20, width: 340, boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
             <h2 style={{ textAlign: 'center', margin: 0, color: '#f8fafc', fontSize: '1.5rem', fontWeight: 800 }}>NexaCity5G</h2>
             <p style={{ textAlign: 'center', margin: '-10px 0 10px', color: '#94a3b8', fontSize: '0.85rem' }}>Login to access dashboard</p>
             <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={{ padding: 12, borderRadius: 8, border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', outline: 'none' }} />
             <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ padding: 12, borderRadius: 8, border: '1px solid #475569', background: '#0f172a', color: '#f8fafc', outline: 'none' }} />
             <button type="submit" style={{ padding: 14, borderRadius: 8, background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', marginTop: 10 }}>Sign In</button>
         </form>
      </div>
    );
  }


  return (
    <div className="dashboard-container">
      <header>
        <div className="logo">NexaCity5G</div>
        <div className="status-badge">
          <div className="pulse"></div>
          <span>5G CONNECTED</span>
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
      </div>

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
        <div className="card">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '1.25rem' 
          }}>
            <h3>📈 24h Temperature Forecast</h3>

            <div style={{ 
              fontSize: '0.7rem', 
              color: 'var(--text-muted)',
              background: 'var(--bg-highlight)',
              padding: '3px 8px',
              borderRadius: 6,
            }}>
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
                <XAxis 
                  dataKey="time" 
                  stroke="#475569" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--bg-card)', 
                    border: '1px solid var(--bg-highlight)', 
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                  }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  labelStyle={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="flow" 
                  stroke="#60a5fa" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#colorFlow)" 
                  dot={false}
                  activeDot={{ r: 5, stroke: '#60a5fa', strokeWidth: 2, fill: 'var(--bg-card)' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {role === 'admin' && (
          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>🔔 Operations Feed (Admin only)</h3>
            <div className="feed-container">
              {logs.map(log => (
                <div key={log.id} className="feed-item">
                  <div className="feed-icon" style={{
                    backgroundColor: 
                      log.type === 'traffic' ? '#60a5fa18' :
                      log.type === 'waste'   ? '#fb923c18' :
                      log.type === 'emergency' ? '#34d39918' :
                      '#22d3ee18',
                    color: 
                      log.type === 'traffic' ? '#60a5fa' :
                      log.type === 'waste'   ? '#fb923c' :
                      log.type === 'emergency' ? '#34d399' :
                      '#22d3ee',
                  }}>
                    {log.type === 'traffic' && <Truck size={16} />}
                    {log.type === 'waste' && <Trash2 size={16} />}
                    {log.type === 'emergency' && <CheckCircle2 size={16} />}
                    {log.type === 'edge' && <Zap size={16} />}
                  </div>
                  <div className="feed-content">
                    <h4>{log.msg}</h4>
                    <p>{log.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>


      {role === 'admin' && (
        <div className="card glass">
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
                fontSize: '0.68rem', 
                fontWeight: 700, 
                color: '#22d3ee',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 4,
              }}>
                AI Insight (Admin only)
              </p>
              <p style={{ fontSize: '0.85rem', lineHeight: 1.55 }}>
                Adjust traffic signal timing on 5th Ave to reduce congestion by{' '}
                <span style={{ color: '#22d3ee', fontWeight: '700' }}>12%</span> in the next hour.
                Confidence: <span style={{ color: '#34d399', fontWeight: '700' }}>91%</span>
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
