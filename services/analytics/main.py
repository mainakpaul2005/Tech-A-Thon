from fastapi import FastAPI
import paho.mqtt.client as mqtt
import os
from dotenv import load_dotenv
import pandas as pd
import json

load_dotenv()

app = FastAPI(title="NexaCity5G AI Analytics Engine")

# MQTT Configuration
MQTT_BROKER = os.getenv("MQTT_BROKER", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))

def on_connect(client, userdata, flags, rc):
    print(f"Connected to MQTT with result code {rc}")
    client.subscribe("city/analytics/req")

def on_message(client, userdata, msg):
    print(f"Topic: {msg.topic} | Payload: {msg.payload.decode()}")

mqtt_client = mqtt.Client()
mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

try:
    mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
    mqtt_client.loop_start()
except Exception as e:
    print(f"Failed to connect to MQTT: {e}")

@app.get("/")
async def root():
    return {"service": "AI Analytics Engine", "status": "Ready", "models_loaded": ["traffic_predictor_v1", "waste_optimizer_v1"]}

@app.get("/predict/traffic")
async def predict_traffic(zone_id: str):
    # This is a sample predictive logic
    # In a real app, this would query Postgres/Redis and run a sklearn/tf model
    return {
        "zone_id": zone_id,
        "predicted_congestion_index": 0.45,
        "recommendation": "Maintain current signal timing",
        "confidence": 0.92
    }

@app.get("/predict/waste")
async def predict_waste(area_id: str):
    return {
        "area_id": area_id,
        "days_until_full": 1.5,
        "priority": "MEDIUM"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
