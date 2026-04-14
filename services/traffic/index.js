const express = require('express');
const mqtt = require('mqtt');
const { Pool } = require('pg');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// DB Setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// MQTT Setup
const mqttClient = mqtt.connect(process.env.MQTT_URL || 'mqtt://mosquitto:1883');

app.use(morgan('dev'));
app.use(express.json());

mqttClient.on('connect', () => {
    console.log('Connected to MQTT Broker');
    mqttClient.subscribe('city/traffic/#', (err) => {
        if (!err) console.log('Subscribed to traffic telemetry');
    });
});

mqttClient.on('message', async (topic, message) => {
    console.log(`Traffic Data: ${topic} -> ${message.toString()}`);
    // Here we would parse and save to Postgres
});

app.get('/traffic/status', async (req, res) => {
    res.json({ service: 'Traffic Management', status: 'Active', sensors: 124 });
});

app.listen(PORT, () => {
    console.log(`Traffic Service running on port ${PORT}`);
});
