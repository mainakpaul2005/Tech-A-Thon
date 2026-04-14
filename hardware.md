# 🛠️ NEXACITY5G: HARDWARE GUIDE (₹500 VERSION)

This guide provides a "Zero-Resistor" wiring path and the data flow implementation.

## 1. Finding Your Host IP (MQTT Broker)
Your ESP32 needs to know where to send data. Run this on your PC:
- **Windows**: Open PowerShell and type `ipconfig`. Look for "IPv4 Address" (e.g., `192.168.1.15`).
- **Mac/Linux**: Open Terminal and type `ifconfig` or `ip a`.

## 2. No-Resistor Wiring Diagram
By powering the HC-SR04 with 3.3V, we ensure the Echo signal is safe for the ESP32.

| Component | Sensor Pin | ESP32 Pin | Notes |
| :--- | :--- | :--- | :--- |
| **HC-SR04** | **VCC** | **3V3** | Safe mode (no resistors needed) |
| | GND | GND | |
| | Trig | GPIO 5  | |
| | Echo | GPIO 18 | |
| **HC-SR501 (PIR)**| VCC | VIN / 5V | PIRs strictly need 5V to work well |
| | GND | GND | |
| | OUT | GPIO 19 | Signal is 3.3V safe natively |

## 3. Implementation Flow
1. **Physical Trigger**: A car moves (PIR) or trash rises (Ultrasonic).
2. **Translation**: The ESP32 converts time-of-flight to percentage (Waste) and motion to count (Traffic).
3. **Transmission**: The node sends an MQTT JSON payload to your PC over WiFi.
4. **Edge Processing**: `edge_node.py` receives the data and forwards it to the microservices.
