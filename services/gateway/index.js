const express = require('express');
const http = require('http');
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



// WebSocket Handling
wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`New client connected from ${ip}`);

    ws.send(JSON.stringify({ 
        type: 'WELCOME', 
        message: 'Connected to NexaCity5G Gateway Real-time Stream' 
    }));

    ws.on('message', (message) => {
        console.log(`Received: ${message}`);
        // Echo for testing
        ws.send(JSON.stringify({ type: 'ECHO', payload: message.toString() }));
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Start Server
server.listen(PORT, () => {
    console.log(`🚀 NexaCity5G Gateway running on port ${PORT}`);
    console.log(`📡 WebSocket server is live on same port`);
});
