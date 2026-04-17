const express = require('express');
const http = require('http');
const mqtt = require('mqtt');
const WebSocket = require('ws');
const cors = require('cors');
const morgan = require('morgan');
const proxy = require('express-http-proxy');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.GATEWAY_PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'Gateway', timestamp: new Date() });
});

// Microservice Proxies
app.use('/api/v1/traffic', proxy('traffic-service:3000'));
app.use('/api/v1/emergency', proxy('emergency-service:3000'));
app.use('/api/v1/waste', proxy('waste-service:3000'));
app.use('/api/v1/analytics', proxy('analytics-service:8000'));



// MQTT Setup
const mqttClient = mqtt.connect(process.env.MQTT_URL || 'mqtt://mosquitto:1883');

mqttClient.on('connect', () => {
    console.log('Gateway connected to MQTT Broker');
    mqttClient.subscribe('city/#', (err) => {
        if (!err) console.log('Gateway subscribed to city telemetry');
    });
});

mqttClient.on('message', (topic, message) => {
    const payload = JSON.parse(message.toString());
    const type = topic.includes('traffic') ? 'TRAFFIC_UPDATE' : 
                 topic.includes('waste') ? 'WASTE_UPDATE' : 
                 topic.includes('water') ? 'WATER_UPDATE' :
                 topic.includes('emergency') ? 'EMERGENCY_ALERT' : 'UNKNOWN';
    
    const broadcastData = JSON.stringify({
        type,
        topic,
        ...payload
    });

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(broadcastData);
        }
    });
});

// WebSocket Handling
wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`New client connected from ${ip}`);

    ws.send(JSON.stringify({ 
        type: 'WELCOME', 
        message: 'Connected to NexaCity5G Gateway Real-time Stream' 
    }));

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Start Server
server.listen(PORT, () => {
    console.log(`🚀 NexaCity5G Gateway running on port ${PORT}`);
    console.log(`📡 WebSocket server is live on same port`);
});
