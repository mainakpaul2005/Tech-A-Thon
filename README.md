# 🏙️ NexaCity | 5G-Enabled Smart Urban Ecosystem

![Project Version](https://img.shields.io/badge/Version-1.2.0--Hardware--Sync-blue?style=for-the-badge&logo=iot)
![5G Ready](https://img.shields.io/badge/Network-5G_Adaptive-06b6d4?style=for-the-badge&logo=5g)
![Docker](https://img.shields.io/badge/Architecture-Microservices-2496ed?style=for-the-badge&logo=docker)

NexaCity is a state-of-the-art smart city infrastructure platform that bridges the gap between physical IoT hardware and AI-driven urban management. Built for high-stakes hackathon demos, it features real-time 5G telemetry, adaptive edge computing, and a premium glassmorphic dashboard.

---

## 🚀 Key Innovation Pillars

### 📡 5G Adaptive Edge Computing
NexaCity utilize a custom **Adaptive Edge Node** (`edge_node.py`) that monitors network conditions.
- **5G Mode**: High-resolution, instantaneous data forwarding for real-time traffic signal adjustments.
- **4G Fallback**: Aggregates telemetry to conserve bandwidth while maintaining city-wide monitoring.

### 🚦 Smart Traffic Command Center
Beyond simple monitoring, NexaCity provides:
- **Sustained Traffic Detection**: Automated **Red Alerts** triggered by 30-second continuous vehicle detection (synchronized with hardware PIR reset times).
- **Emergency Corridor Clearing**: Instant manual signal override for first responders.
- **Traffic Flow Adjectives**: Non-tech friendly status (Smooth, Busy, Crowded) driven by live averages.

### 🗑️ Smart Waste Management
- **30s Status Resolution**: Intelligent dashboard throttling that prevents UI flicker while maintaining strict monitoring of bin fill levels and battery health.
- **Priority Collection Optimizer**: Predictive bin statuses sorted by urgency.

---

## 🛠️ Tech Stack & Architecture

- **Hardware**: ESP32 (32-bit SoC), HC-SR04 (Ultrasonic), PIR (Motion).
- **Communication**: MQTT (Mosquitto), WebSockets (Real-time Gateway).
- **Backend**: Node.js Microservices, Python (Adaptive Edge Logic).
- **Frontend**: React (Vite), Glassmorphism, Premium Dark UI.
- **Infrastructure**: Docker Compose (7+ interconnected services).

---

## 🔌 Hardware Setup (ESP32)

Built for high reliability with a "Zero-Resistor" wiring path.

| Component | ESP32 Pin | Purpose |
| :--- | :--- | :--- |
| **VCC** | VIN (5V) | Powering Sensors |
| **GND** | GND | Common Ground |
| **HC-SR04 Trig** | GPIO 5 | Ultrasonic Trigger |
| **HC-SR04 Echo** | GPIO 18 | Ultrasonic Echo |
| **PIR Signal** | GPIO 19 | Motion Detection |

> [!IMPORTANT]
> **PIR Calibration:** Adjust the 'Delay' potentiometer on your HC-SR501 to the minimum (fully counter-clockwise) to match the **6-second reporting interval** configured in the firmware.

---

## 🐳 Getting Started (Docker)

The entire ecosystem is containerized for "One-Command Deployment."

1. **Clone & Environment**:
   ```bash
   git clone https://github.com/mainakpaul2005/Tech-A-Thon.git
   cd Tech-A-Thon
   ```

2. **Sync Settings**:
   Ensure your `.env` contains the MQTT server's local IP for the hardware.

3. **Deploy Infrastructure**:
   ```bash
   docker-compose up -d --build
   ```

4. **Access Dashboard**:
   Open `http://localhost:8080` in your browser.

---

## 📂 Project Anatomy

```text
├── frontend/        # React Dashboard (Vite) - Live WebSocket telemetry
├── hardware/        # ESP32 Firmware (6s reporting sync)
├── services/
│   ├── gateway/     # MQTT-to-WebSocket Bridge (3000)
│   ├── edge/        # Adaptive Edge Node (5G/4G Logic)
│   ├── traffic/     # Traffic Status Microservice
│   └── waste/       # Waste Management Microservice
├── infra/           # Mosquitto & DB configurations
└── docker-compose.yml # Orchestration layer
```

---

## 📄 Documentation & Workflows
- [Implementation Walkthrough](walkthrough.md) - *Detailed integration steps*
- [Scalability Roadmap](SCALABILITY.md) - *Planned future expansions*
- [Implementation Plan](implementation_plan.md) - *Wiring & Logic specs*

---
Developed with ❤️ by **Mainak Paul** for the **Tech-A-Thon** Hackathon.
