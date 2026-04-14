from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import threading
import sys

# Add current directory to path so we can import the agent
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import incident_agent

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "service": "AI Incident Detection"}), 200

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.json
    video_path = data.get('video')
    location = data.get('location', 'Unknown')

    if not video_path:
        return jsonify({"error": "No video source provided"}), 400

    # Start analysis in a separate thread if we want it async
    # For now, let's keep it simple and return the result synchronously
    try:
        # Determine if it's a URL or local file
        is_web_url = video_path.startswith("http://") or video_path.startswith("https://")
        
        final_video_path = video_path
        if is_web_url:
            final_video_path = incident_agent.download_youtube_video(video_path)
        
        incident_type = incident_agent.analyze_video(final_video_path)
        contacts = incident_agent.get_emergency_numbers_for_location(location)
        
        # Cleanup
        if is_web_url and os.path.exists(final_video_path):
            os.remove(final_video_path)
            
        # Trigger call if emergency
        if incident_type == 'ROAD_ACCIDENT':
            incident_agent.make_emergency_call(incident_type, location, contacts["AMBULANCE"])
        elif incident_type == 'ANTI_SOCIAL':
            incident_agent.make_emergency_call(incident_type, location, contacts["POLICE"])
            
        return jsonify({
            "status": "success",
            "incident_type": incident_type,
            "location": location,
            "call_triggered": incident_type in ['ROAD_ACCIDENT', 'ANTI_SOCIAL']
        })
        
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    # Default port for AI service
    app.run(port=5005, debug=True)
