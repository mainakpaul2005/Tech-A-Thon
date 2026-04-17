#include <WiFi.h>
#include <PubSubClient.h>

/*
 * 🏙️ NexaCity | Water Level Monitoring System (ROBUST VERSION)
 * ---------------------------------------------------------
 * Hardware: ESP32 + HC-SR04 Ultrasonic Sensor
 * Pins: TRIG=5, ECHO=18
 * 
 * Features:
 * - Multi-sample filtering for noise reduction
 * - Trend detection (Rapid water rise)
 * - Flood alert stability (3-cycle confirmation)
 * - MQTT Integration (city/water)
 */

// --- CONFIGURATION ---
const char* ssid = "Test123";      // Replace with your WiFi SSID
const char* password = "12345678"; // Replace with your WiFi Password
const char* mqtt_server = "10.132.154.193"; // Your Host IP
const int mqtt_port = 1883;

// --- HARDWARE PINS ---
#define TRIG 5
#define ECHO 18

// --- WATER LEVEL CONFIG ---
float H = 100.0; // Tank Height (cm)
#define NUM_SAMPLES 5
#define ALERT_THRESHOLD 80.0 // Percentage
#define RAPID_RISE_THRESHOLD 10.0 // Percentage difference

// --- GLOBAL VARIABLES ---
WiFiClient espClient;
PubSubClient client(espClient);

static float lastPercentage = 0;
static int highCount = 0;
unsigned long lastPublishTime = 0;
const long publishInterval = 2000; // 2 Seconds between cycles

// --- SENSOR LOGIC ---

/**
 * Get raw distance from HC-SR04
 */
float getDistance() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);

  long duration = pulseIn(ECHO, HIGH, 30000); // 30ms timeout

  if (duration == 0) return -1; // No echo received

  return duration * 0.034 / 2;
}

/**
 * Filter readings to remove outliers and noise
 */
float getFilteredDistance() {
  int count = 0;
  float sum = 0;

  for (int i = 0; i < NUM_SAMPLES; i++) {
    float d = getDistance();

    // Validate range (HC-SR04 is typically 2cm - 400cm)
    if (d > 2 && d < 400) {
      sum += d;
      count++;
    }
    delay(50); // Pause between samples
  }

  if (count == 0) return -1;

  return sum / count;
}

// --- NETWORK LOGIC ---

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    String clientId = "ESP32_WaterNode-";
    clientId += String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str())) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

// --- ARDUINO CORE ---

void setup() {
  Serial.begin(115200);
  
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);

  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();
  if (now - lastPublishTime > publishInterval) {
    lastPublishTime = now;

    float distance = getFilteredDistance();

    if (distance < 0) {
      Serial.println("🚨 Error: Invalid reading from sensor");
      return;
    }

    // Calculate level
    float waterLevel = H - distance;
    if (waterLevel < 0) waterLevel = 0;
    if (waterLevel > H) waterLevel = H;

    float percentage = (waterLevel / H) * 100.0;

    // 🔬 TREND DETECTION (SMART)
    if (percentage > lastPercentage + RAPID_RISE_THRESHOLD) {
      Serial.println("⚠️ WARNING: Rapid water rise detected!");
    }

    // 🚨 FLOOD ALERT LOGIC (with stability)
    if (percentage > ALERT_THRESHOLD) {
      highCount++;
      if (highCount >= 3) {
        Serial.println("🚨 EMERGENCY: FLOOD ALERT CONFIRMED!");
      }
    } else {
      highCount = 0;
    }

    // 📡 MQTT TRANSMISSION
    char msg[10];
    dtostrf(percentage, 1, 2, msg);
    
    // Construct JSON Payload
    String payload = "{\"device\":\"water_node_01\", \"percentage\":";
    payload += msg;
    payload += ", \"alert\":";
    payload += (highCount >= 3 ? "true" : "false");
    payload += "}";

    client.publish("city/water", payload.c_str());

    // Local Serial Logging
    Serial.print("Distance: "); Serial.print(distance); Serial.print(" cm | ");
    Serial.print("Water Level: "); Serial.print(percentage, 2); Serial.println("%");

    lastPercentage = percentage;
  }
}
