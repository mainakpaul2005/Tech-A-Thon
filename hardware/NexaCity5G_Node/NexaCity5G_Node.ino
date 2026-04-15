#include <WiFi.h>
#include <PubSubClient.h>

// ---------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------

// Wi-Fi Credentials
const char* ssid = "Test123";
const char* password = "12345678";

// MQTT Broker (Your PC's IP address)
const char* mqtt_server = "10.132.154.193"; // <-- CHANGE THIS TO YOUR HOST IP
const int mqtt_port = 1883;

// Topic Configurations
const char* traffic_topic = "raw/traffic/Z1";
const char* waste_topic = "raw/waste/B001";

// ---------------------------------------------------------
// PINS & VARIABLES
// ---------------------------------------------------------

// Ultrasonic Sensor (HC-SR04) for Waste Level
const int trigPin = 5;  // GPIO 5
const int echoPin = 18; // GPIO 18

// PIR Motion Sensor (HC-SR501) for Traffic
const int pirPin = 19;  // GPIO 19

WiFiClient espClient;
PubSubClient client(espClient);

// Timing variables
unsigned long lastPublishTime = 0;
const long publishInterval = 5000; // Publish every 5 seconds

// Traffic Tracking
int vehicleCount = 0;
bool pirState = LOW;

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

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Create a random client ID
    String clientId = "ESP32Node-";
    clientId += String(random(0xffff), HEX);
    
    // Attempt to connect
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

void setup() {
  Serial.begin(115200);
  
  // Setup Pins
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(pirPin, INPUT);

  setup_wifi();
  
  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // 1. Read Traffic (PIR Sensor interrupts/polling)
  int pirVal = digitalRead(pirPin);
  if (pirVal == HIGH) {
    if (pirState == LOW) {
      // Motion detected! Vehicle passed
      vehicleCount++;
      Serial.print("Motion detected! Vehicle Count: ");
      Serial.println(vehicleCount);
      pirState = HIGH;
    }
  } else {
    if (pirState == HIGH) {
      pirState = LOW; // Reset state
    }
  }

  // 2. Publish Data every interval
  unsigned long now = millis();
  if (now - lastPublishTime > publishInterval) {
    lastPublishTime = now;

    // --- Measure Waste Level ---
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);
    
    long duration = pulseIn(echoPin, HIGH);
    // Calculate distance in cm
    int distance = duration * 0.034 / 2;
    
    // Calculate fill level % (Assuming 100cm is empty, 10cm is full)
    int fill_level = 0;
    if(distance <= 10) fill_level = 100;
    else if(distance >= 100) fill_level = 0;
    else fill_level = map(distance, 100, 10, 0, 100);

    // --- Create and Send Waste Payload ---
    String wastePayload = "{\"bin_id\":\"B001\", \"fill_level\":";
    wastePayload += fill_level;
    wastePayload += ", \"battery\": 98}"; // Battery simulated static
    
    client.publish(waste_topic, wastePayload.c_str());
    Serial.print("Published Waste: ");
    Serial.println(wastePayload);

    // --- Create and Send Traffic Payload ---
    // Simulating an average speed based on a simple random calculation or static for demo
    int avg_speed = random(20, 60); 
    String trafficStatus = (vehicleCount > 5) ? "CONGESTED" : "NORMAL";
    
    String trafficPayload = "{\"zone_id\":\"Z1\", \"vehicle_count\":";
    trafficPayload += vehicleCount;
    trafficPayload += ", \"avg_speed\":";
    trafficPayload += avg_speed;
    trafficPayload += ", \"status\":\"";
    trafficPayload += trafficStatus;
    trafficPayload += "\"}";
    
    client.publish(traffic_topic, trafficPayload.c_str());
    Serial.print("Published Traffic: ");
    Serial.println(trafficPayload);
    
    // Reset vehicle count for the next interval
    vehicleCount = 0;
  }
}
