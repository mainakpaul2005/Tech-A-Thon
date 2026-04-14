# AI_Detect_EmergencyService

Autonomous Incident Detection System built with Python. This project analyzes video or camera input to detect road accidents or anti-social activities using the Gemini Vision API and autonomously triggers emergency responses by making automated phone calls via Twilio to the appropriate authorities.

## Features
- **Video Analysis**: Uses Gemini Vision API to classify scenes (Accidents, Anti-Social, Normal).
- **Automated Alerts**: Utilizes Twilio Voice API to automatically call emergency services with contextual information.
- **Location Aware**: Includes simulated GPS coordinates to accurately dispatch emergency services.

## Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/duttannasha26/AI_Detect_EmergencyService.git
   cd AI_Detect_EmergencyService
   ```

2. **Install dependencies:**
   Make sure you have Python installed. Then run:
   ```bash
   pip install -r requirements.txt
   ```

3. **Environment Setup:**
   Create a `.env` file in the root directory and add your API keys. Do **NOT** commit this file to GitHub!
   
   Example `.env` structure:
   ```env   TWILIO_ACCOUNT_SID=your_twilio_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_phone_number
   TO_PHONE_NUMBER=fallback_phone_number
   GEMINI_API_KEY=your_gemini_api_key
   AMBULANCE_PHONE_NUMBER=specific_ambulance_number
   POLICE_PHONE_NUMBER=specific_police_number
   ```

4. **Run the agent:**
   Execute the python script to start the incident detection agent:
   ```bash
   python incident_agent.py
   ```
