const express = require('express');
const mqtt = require('mqtt');
const { Pool } = require('pg');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3003;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const mqttClient = mqtt.connect(process.env.MQTT_URL || 'mqtt://mosquitto:1883');

app.use(morgan('dev'));
app.use(express.json());

mqttClient.on('connect', () => {
    console.log('Connected to MQTT Broker');
    mqttClient.subscribe('city/waste/#', (err) => {
        if (!err) console.log('Subscribed to waste monitoring data');
    });
});

mqttClient.on('message', (topic, message) => {
    console.log(`Waste Level Update: ${topic} -> ${message.toString()}`);
});

app.get('/waste/bins', async (req, res) => {
    res.json({ service: 'Waste Monitoring', status: 'Operational', bins_to_collect: 5 });
});

app.listen(PORT, () => {
    console.log(`Waste Service running on port ${PORT}`);
});
