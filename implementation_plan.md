# 🚀 NEXACITY: HARDWARE IMPLEMENTATION PLAN

This plan outlines the steps to transition from simulated data to real-time hardware data using your ESP32, HC-SR04, and PIR sensors.

---

## 🏗️ 1. Physical Assembly
Follow this wiring guide to connect your components to the ESP32 (Zero-Resistor path for simplicity).

### **Pin Connections (Wiring Diagram)**

| Component | Sensor Pin | ESP32 Pin | Notes |
| :--- | :--- | :--- | :--- |
| **HC-SR04** (Ultrasonic) | **VCC** | **3V3** | Safe mode (no resistors needed for Echo) |
| | GND | GND | Connect to any ESP32 GND pin |
| | Trig | GPIO 5  | Triggers the ultrasonic pulse |
| | Echo | GPIO 18 | Reads the returning pulse (3.3V safe) |
| **HC-SR501** (PIR) | VCC | VIN / 5V | PIRs strictly need 5V to work reliably |
| | GND | GND | Connect to any ESP32 GND pin |
| | OUT | GPIO 19 | Signal is 3.3V safe natively |

> [!CAUTION]
> Ensure your ESP32 is powered via USB while testing so that the `VIN` or `5V` pin can provide adequate 5V power to the PIR sensor.

### **Sensor Roles & Placement:**
*   **PIR Motion Sensor (HC-SR501):** Positioned near your "Model Cars" track to detect passing vehicles. Ensure the domed side faces the track. You can adjust the sensitivity and delay potentiometers on the sensor if needed.
*   **Ultrasonic Sensor (HC-SR04):** Mounted at the top of your "Trash Bin Cup", pointing downwards to measure the distance to the "trash" inside. The closer the trash, the higher the fill level.
---

## 💻 2. Software Configuration

### **A. Environment Preparation**
1.  **Find your PC's IP Address**:
    *   Open PowerShell and run `ipconfig`.
    *   Note the **IPv4 Address** (e.g., `192.168.1.15`).
2.  **Start the Backend**:
    *   Ensure Docker is running.
    *   Run `docker-compose up -d` in the project root to start Mosquitto, Edge Node, and Microservices.

### **B. Configure ESP32 Firmware**
Open `hardware/NexaCity5G_Node/NexaCity5G_Node.ino` and update the following variables:
1.  `ssid`: Your Wi-Fi name.
2.  `password`: Your Wi-Fi password.
3.  `mqtt_server`: Your PC's IP Address (noted previously).

### **C. Flashing**
*   Connect ESP32 to your PC via USB.
*   Select "ESP32 Dev Module" in the Arduino IDE.
*   Click **Upload**.

---

## 🚦 3. Testing with Real Data

### **Phase 1: Traffic Monitoring (The Model Car)**
1.  Open the **Serial Monitor** in Arduino IDE (115200 baud).
2.  Move your model car past the PIR sensor.
3.  Observe:
    *   `Motion detected! Vehicle Count: 1` in the Serial Monitor.
    *   Data being published to `raw/traffic/Z1`.
4.  Check the **NexaCity Dashboard** under the Traffic section to see the count update.

### **Phase 2: Waste Management (The Cup Bin)**
1.  Place an empty cup under the Ultrasonic sensor.
2.  Slowly add "trash" (paper bits, small objects) into the cup.
3.  Observe:
    *   `Published Waste: {"bin_id":"B001", "fill_level": 25, ...}` in Serial Monitor.
    *   The fill level percentage increases as the distance to the trash decreases.
4.  Check the **Waste Management** section of the dashboard.

---

## 🔍 4. Verification Flow
If data doesn't appear on the dashboard, check the flow in this order:
1.  **ESP32 Serial Monitor**: Is it connecting to Wi-Fi and MQTT?
2.  **MQTT Explorer (Optional)**: Can you see messages on `raw/traffic/Z1` and `raw/waste/B001`?
3.  **Edge Node Logs**: Run `docker logs nexacity-edge`. Is it forwarding data to `city/` topics?
4.  **Dashboard**: Refresh the web UI.

---

## 📉 5. Scale to 5G vs 4G Logic
The system is already configured for **Adaptive Edge Processing**:
*   **5G Mode**: High resolution. Data is forwarded every 3 sensor reads.
*   **4G Mode**: Bandwidth conservation. Data is aggregated and only forwarded every 10 reads.
*   **Waste Logic**: In 4G mode, only "Critical" waste levels (>80%) are sent immediately to save data.
