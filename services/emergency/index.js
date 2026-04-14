const express = require('express');
const mqtt = require('mqtt');
const { Pool } = require('pg');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const mqttClient = mqtt.connect(process.env.MQTT_URL || 'mqtt://mosquitto:1883');

app.use(morgan('dev'));
app.use(express.json());

mqttClient.on('connect', () => {
    console.log('Connected to MQTT Broker');
    mqttClient.subscribe('city/emergency/#', (err) => {
        if (!err) console.log('Subscribed to emergency alerts');
    });
});

mqttClient.on('message', (topic, message) => {
    console.log(`🚨 EMERGENCY ALERT: ${topic} -> ${message.toString()}`);
});

app.get('/emergency/incidents', async (req, res) => {
    res.json({ service: 'Emergency Response', status: 'Standby', active_incidents: 0 });
});

app.listen(PORT, () => {
    console.log(`Emergency Service running on port ${PORT}`);
});
