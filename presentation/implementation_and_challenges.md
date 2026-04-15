# Implementation & Challenges

## Key Steps
1. **Sensor Integration:** Interfacing HC-SR04 and PIR motion sensors with the ESP32 microcontroller using optimized wiring pathways to gather raw environmental proximity and motion data.
2. **Data Transmission:** Establishing a highly reliable telemetry pipeline utilizing lightweight MQTT protocols to stream real-time data from the edge node to our Mosquitto broker with strict 6-second dispatch intervals.
3. **App Visualization:** Consolidating backend streams via WebSockets into the Glassmorphism React dashboard and Mobile App, reflecting sub-millisecond updates visually for absolute real-time City Command intelligence.

## Challenges Faced & Overcome
1. **Sensor Accuracy Issues:** Raw ultrasonic and PIR data often generated false positives and noise. We mitigated this by introducing rolling-average data filtering and hardware debouncing logic before the payload ever leaves the microcontroller.
2. **Network Delay:** Traditional HTTP API requests caused UI stuttering under high telemetry loads. By migrating the frontend bridge entirely to WebSockets paired with MQTT, we slashed transmission latency down to nearly zero.
3. **Power Constraints:** Running continuous urban telemetry on the ESP32 draws significant power. We solved this by synchronizing our firmware payload dispatches to a strict 6-second polling cycle, perfectly syncing with the sensor's physical limits while substantially increasing battery longevity.

---

## 💡 Key Innovation Points
*Judges look for innovation—here is where NexaCity stands out:*

1. **Adaptive Edge-Computing Architecture:** Instead of forcefully pushing all raw data directly to a centralized server, our platform features an intelligent *Adaptive Edge Node*. It actively monitors network connection strength and, under low-bandwidth connections (e.g., a 4G fallback), it autonomously switches to local edge-aggregation to perfectly optimize bandwidth usage without losing data integrity.
2. **Autonomous "Red-Alert" Emergency Recognition:** We didn't just build a system that displays data; we built a system that interprets it. By running native threshold algorithms over 30 seconds of continuous hardware tracking, the system can independently identify heavy traffic blockages and autonomously execute *"Emergency Response Corridors,"* overriding standard logic without requiring human intervention.
