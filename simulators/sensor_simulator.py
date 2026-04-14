import paho.mqtt.client as mqtt
import json
import time
import random
import os
from datetime import datetime

MQTT_BROKER = os.getenv("MQTT_BROKER", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))

client = mqtt.Client("NexaCity_Sensor_Sim")

def connect_mqtt():
    while True:
        try:
            client.connect(MQTT_BROKER, MQTT_PORT, 60)
            print("Connected to MQTT Broker for Simulation")
            break
        except Exception as e:
            print(f"Connection failed ({e}), retrying in 5s...")
            time.sleep(5)

def simulate_traffic():
    zones = ["Z1", "Z2", "Z3", "Z4"]
    zone = random.choice(zones)
    vehicle_count = random.randint(10, 100)
    avg_speed = random.randint(20, 80)
    
    payload = {
        "timestamp": datetime.now().isoformat(),
        "zone_id": zone,
        "vehicle_count": vehicle_count,
        "avg_speed": avg_speed,
        "status": "NORMAL" if vehicle_count < 80 else "CONGESTED"
    }
    client.publish(f"raw/traffic/{zone}", json.dumps(payload))

def simulate_waste():
    bins = ["B001", "B002", "B003"]
    bin_id = random.choice(bins)
    fill_level = random.randint(0, 100)
    
    payload = {
        "timestamp": datetime.now().isoformat(),
        "bin_id": bin_id,
        "fill_level": fill_level,
        "battery": random.randint(20, 100)
    }
    client.publish(f"raw/waste/{bin_id}", json.dumps(payload))

def simulate_emergency():
    # Emergency events are rarer
    if random.random() < 0.05:
        types = ["FIRE", "MEDICAL", "ACCIDENT"]
        event_type = random.choice(types)
        payload = {
            "timestamp": datetime.now().isoformat(),
            "type": event_type,
            "location": {"lat": 40.7128, "lng": -74.0060},
            "severity": "HIGH"
        }
        client.publish(f"raw/emergency/alerts", json.dumps(payload))

if __name__ == "__main__":
    connect_mqtt()
    print("🚀 IoT Data Simulation Started...")
    
    while True:
        simulate_traffic()
        simulate_waste()
        simulate_emergency()
        
        # Artificial delay between sensor bursts
        time.sleep(random.uniform(1.0, 3.0))
