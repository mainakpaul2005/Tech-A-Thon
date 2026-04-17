import paho.mqtt.client as mqtt
import json
import os
import time

MQTT_BROKER = os.getenv("MQTT_BROKER", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))

# System State
network_mode = "5G"  # Options: 5G, 4G_FALLBACK
traffic_buffer = {}

def on_connect(client, userdata, flags, rc):
    print(f"Edge Node connected. Result: {rc}")
    client.subscribe("raw/#")
    client.subscribe("city/network/control") # Listening for orchestrator commands

def on_message(client, userdata, msg):
    global network_mode
    topic = msg.topic
    
    # Handle Network Switching Commands
    if topic == "city/network/control":
        payload = json.loads(msg.payload.decode())
        new_mode = payload.get("mode")
        if new_mode in ["5G", "4G_FALLBACK"]:
            network_mode = new_mode
            print(f"📶 NETWORK SWITCH: Now operating in {network_mode} mode")
        return

    payload = json.loads(msg.payload.decode())

    # Strategy: Change aggregation depth based on network mode
    # 5G -> Low aggregation (High data resolution)
    # 4G -> High aggregation (Bandwidth conservation)
    agg_threshold = 1 if network_mode == "5G" else 10

    if "raw/traffic" in topic:
        zone = payload.get("zone_id")
        if zone not in traffic_buffer:
            traffic_buffer[zone] = []
        
        traffic_buffer[zone].append(payload.get("vehicle_count"))
        
        if len(traffic_buffer[zone]) >= agg_threshold:
            avg_count = round(sum(traffic_buffer[zone]) / len(traffic_buffer[zone]), 1)
            processed_payload = {
                "zone_id": zone,
                "vehicle_count": avg_count,
                "timestamp": payload.get("timestamp"),
                "mode": network_mode,
                "compressed": network_mode == "4G_FALLBACK",
                "status": payload.get("status", "NORMAL")
            }
            client.publish(f"city/traffic/{zone}", json.dumps(processed_payload))
            print(f"[{network_mode}] Forwarded traffic for {zone} (agg size: {agg_threshold})")
            traffic_buffer[zone] = []

    elif "raw/waste" in topic:
        # In Fallback mode, only send if bin is critical (>80%)
        waste_threshold = 0 if network_mode == "5G" else 80
        if payload.get("fill_level", 0) >= waste_threshold:
            client.publish(topic.replace("raw/", "city/"), msg.payload)

    elif "raw/emergency" in topic:
        # Emergency alerts NEVER fall back; they always use priority lanes
        client.publish(topic.replace("raw/", "city/"), msg.payload)
        print("🚨 PRIORITY: Emergency alert passed through immediately")

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, "Edge_Node_Adaptive")
client.on_connect = on_connect
client.on_message = on_message

if __name__ == "__main__":
    while True:
        try:
            client.connect(MQTT_BROKER, MQTT_PORT, 60)
            break
        except:
            time.sleep(2)
    
    print(f"🌍 Adaptive Edge Node Online (Initial Mode: {network_mode})")
    client.loop_forever()
