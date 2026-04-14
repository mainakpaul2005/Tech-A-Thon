import paho.mqtt.client as mqtt
import json
import time
import sys

# Verification Script for NexaCity5G
# Checks: Sensor -> Raw -> Edge -> City -> Microservice logic

BROKER = "localhost" # Assuming running locally or via Docker mapping
SUCCESS_FLAG = False

def on_connect(client, userdata, flags, rc):
    client.subscribe("city/traffic/verification_zone")

def on_message(client, userdata, msg):
    global SUCCESS_FLAG
    payload = json.loads(msg.payload.decode())
    if payload.get("zone_id") == "verification_zone":
        print("✅ SUCCESS: Data successfully reached 'city/' topic space after Edge processing")
        SUCCESS_FLAG = True

client = mqtt.Client("Verification_Bot")
client.on_connect = on_connect
client.on_message = on_message

try:
    client.connect(BROKER, 1883, 60)
except:
    print("❌ ERROR: Could not connect to MQTT Broker. Is the platform running?")
    sys.exit(1)

client.loop_start()

print("🔍 Initiating Data Pipeline Verification...")
# 1. Inject Raw Data (Simulating a sensor)
test_payload = {
    "zone_id": "verification_zone",
    "vehicle_count": 50,
    "timestamp": "now"
}

# The edge node needs 3 messages in 5G mode to trigger an update (from my previous logic change)
for _ in range(5):
    client.publish("raw/traffic/verification_zone", json.dumps(test_payload))
    time.sleep(0.5)

# Wait for Edge Node to process and forward
timeout = 5
start_time = time.time()
while not SUCCESS_FLAG and (time.time() - start_time) < timeout:
    time.sleep(1)

client.loop_stop()

if SUCCESS_FLAG:
    print("✨ Pipeline Integrity Verified.")
    sys.exit(0)
else:
    print("❌ FAILED: Data did not flow through the pipeline within timeout.")
    sys.exit(1)
