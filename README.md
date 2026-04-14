# NexaCity | Smart Infrastructure Platform

NexaCity is a comprehensive smart city management ecosystem designed to optimize urban infrastructure through real-time IoT monitoring, AI-driven traffic management, and secure administrative control.

## 🚀 Key Features

- **Smart Traffic Command Center**: Real-time traffic flow monitoring with automated signal override and emergency corridor clearing.
- **Cross-Platform Dashboards**: Sleek, responsive interfaces for both Web (Vite/React) and Mobile (React Native/Expo).
- **Secure Authentication**: Robust role-based access control (RBAC) powered by Firebase.
- **IoT & Edge Integration**: Support for physical hardware (ESP8266) and simulated data with 5G/4G fallback logic.
- **Real-time Analytics**: Live weather integration and sensor data visualization via WebSockets.

## 📁 Project Structure

```text
├── frontend/        # React-based web dashboard (Vite)
├── mobile/          # React Native mobile application (Expo)
├── hardware/        # ESP8266 firmware and sensor configurations
├── tests/           # End-to-end pipeline validation scripts
└── docs/            # Hardware specs, scalability plans, and design logs
```

## 🛠️ Tech Stack

- **Frontend**: React, Vite, CSS3 (Glassmorphism), Lucide Icons
- **Mobile**: React Native, Expo, Firebase Auth
- **Backend/IoT**: Node.js (Microservices), MQTT, WebSockets, Firebase
- **Sensors**: Ultrasonic (HC-SR04), Motion (PIR), Weather API

## 🚦 Getting Started

### Prerequisites
- Node.js (v18+)
- npm / yarn
- Expo Go (for mobile testing)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/mainakpaul2005/Tech-A-Thon.git
   cd Tech-A-Thon
   ```

2. **Frontend Setup**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Mobile Setup**:
   ```bash
   cd ../mobile
   npm install
   npx expo start
   ```

## 📄 Documentation
- [Implementation Plan](Plan.md)
- [Hardware Specifications](hardware.md)
- [Scalability Roadmap](SCALABILITY.md)

---
Developed for the **Tech-A-Thon** Hackathon.
