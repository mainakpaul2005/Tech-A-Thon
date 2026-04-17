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

mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
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

# --- Greedy Optimization Algorithm (from waste_collection_algo.py) ---
def optimize_route_greedy(bins, depot=(0.0, 0.0), min_threshold=40.0):
    remaining = [b for b in bins if b['fullness'] >= min_threshold]
    route = []
    total_distance = 0.0
    current = depot
    step = 1

    while remaining:
        best_bin = None
        best_score = -1.0
        best_distance = 0.0

        for b in remaining:
            # Euclidean distance
            dist = ((current[0] - b['x'])**2 + (current[1] - b['y'])**2)**0.5
            safe_dist = max(dist, 0.1)
            score = b['fullness'] / safe_dist
            
            if score > best_score:
                best_bin = b
                best_score = score
                best_distance = dist

        if not best_bin:
            break

        route.append({
            "step": step,
            "bin_id": best_bin['id'],
            "position": (best_bin['x'], best_bin['y']),
            "fullness": best_bin['fullness'],
            "distance": round(best_distance, 2)
        })
        total_distance += best_distance
        current = (best_bin['x'], best_bin['y'])
        remaining = [b for b in remaining if b['id'] != best_bin['id']]
        step += 1

    return route, round(total_distance, 2)

@app.post("/optimize/route")
async def optimize_route(data: dict):
    bins = data.get("bins", [])
    depot = data.get("depot", (0.0, 0.0))
    threshold = data.get("threshold", 40.0)
    
    route, total_dist = optimize_route_greedy(bins, depot, threshold)
    return {
        "status": "SUCCESS",
        "route": route,
        "total_distance": total_dist,
        "bins_processed": len(bins)
    }

@app.get("/predict/traffic")
async def predict_traffic(zone_id: str):
    return {
        "zone_id": zone_id,
        "predicted_congestion_index": 0.45,
        "recommendation": "Maintain current signal timing",
        "confidence": 0.92
    }

@app.get("/predict/water")
async def predict_water(node_id: str):
    return {
        "node_id": node_id,
        "flood_probability": 0.85,
        "estimated_time_to_flood": "45 mins",
        "status": "CRITICAL_RISK"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
