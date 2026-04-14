import os
import time
import argparse
import yt_dlp
from twilio.rest import Client
from dotenv import load_dotenv
from google import genai

# Look for .env in current directory or project root
load_dotenv() # checks current dir
if not os.getenv("GEMINI_API_KEY"):
    # Try project root
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

# Setup Twilio Client
account_sid = os.getenv("TWILIO_ACCOUNT_SID")
auth_token = os.getenv("TWILIO_AUTH_TOKEN")
twilio_number = os.getenv("TWILIO_PHONE_NUMBER")

# Assuming we have numbers for authorities configured in .env
AMBULANCE_NUMBER = os.getenv("AMBULANCE_PHONE_NUMBER", os.getenv("TO_PHONE_NUMBER"))
POLICE_NUMBER = os.getenv("POLICE_PHONE_NUMBER", os.getenv("TO_PHONE_NUMBER"))

# Setup Gemini Client
api_key = os.getenv("GEMINI_API_KEY")

def get_emergency_numbers_for_location(location):
    """
    TODO: Integrate with a Real-time GIS or Directory API to fetch 
    dynamic emergency numbers based on the detected locality.
    Currently falls back to static .env configurations.
    """
    return {
        "AMBULANCE": os.getenv("AMBULANCE_PHONE_NUMBER", os.getenv("TO_PHONE_NUMBER")),
        "POLICE": os.getenv("POLICE_PHONE_NUMBER", os.getenv("TO_PHONE_NUMBER"))
    }

def download_youtube_video(url):
    print(f"Downloading video from web: {url}")
    # Always downloads as mp4 and overrides the file
    ydl_opts = {
        'format': 'best[ext=mp4]',
        'outtmpl': 'temp_downloaded_video.%(ext)s',
        'noplaylist': True,
        'quiet': False
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    return 'temp_downloaded_video.mp4'

def analyze_video(video_path):
    if not api_key:
        print("Error: GEMINI_API_KEY missing in .env file.")
        return None
        
    client = genai.Client(api_key=api_key)
    
    print(f"Uploading video {video_path} for analysis...")
    try:
        video_file = client.files.upload(file=video_path)
    except Exception as e:
        print(f"Failed to upload video: {e}")
        return None

    print("Waiting for video processing to complete...")
    while video_file.state.name == "PROCESSING":
        time.sleep(2)
        video_file = client.files.get(name=video_file.name)

    if video_file.state.name == "FAILED":
        print("Video processing failed.")
        return None

    print("Video processed successfully. Analyzing context...")
    
    # We use gemini-2.5-flash for video analysis
    prompt = """
    Watch the video and classify the scene into one of the following exact categories:
    1. 'ROAD_ACCIDENT' (if it shows a vehicle accident, collision, crashed vehicles, someone injured on road)
    2. 'ANTI_SOCIAL' (if it shows violence, fighting, robbery, vandalism, or a crime)
    3. 'NORMAL' (if it shows regular traffic, people walking normally, nothing concerning)
    
    Output ONLY the exact category string from above. Nothing else.
    """
    
    max_retries = 3
    response = None
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[prompt, video_file]
            )
            break # Success, exit retry loop
        except Exception as e:
            if "503" in str(e) and attempt < max_retries - 1:
                print(f"API busy, retrying in 5 seconds... (Attempt {attempt + 1}/{max_retries})")
                time.sleep(5)
            else:
                print(f"Error during analysis: {e}")
                return None
    
    if not response:
        return None
        
    classification = response.text.strip().upper()
    print(f"Analysis Complete. Result: {classification}")
    return classification

def make_emergency_call(incident_type, location, contact_number):
    if not all([account_sid, auth_token, twilio_number, contact_number]):
        print("Missing Twilio credentials or contact number in .env file.")
        return

    client = Client(account_sid, auth_token)
    
    if incident_type == 'ROAD_ACCIDENT':
        message = f"Emergency Alert! A severe road accident has been detected at {location}. Immediate medical assistance and an ambulance are required."
    elif incident_type == 'ANTI_SOCIAL':
        message = f"Security Alert! Anti-social and criminal activities have been detected at {location}. Immediate police intervention is requested."
    else:
        return

    twiml_instructions = f'''
    <Response>
        <Say voice="Polly.Joanna-Neural" language="en-US">{message}</Say>
    </Response>
    '''

    print(f"Initiating call to {contact_number} for {incident_type}...")
    try:
        call = client.calls.create(
            twiml=twiml_instructions,
            to=contact_number,
            from_=twilio_number
        )
        print(f"Call initiated successfully! Call SID: {call.sid}")
    except Exception as e:
        print(f"Failed to initiate call: {e}")

def main():
    parser = argparse.ArgumentParser(description="Autonomous Agent for Incident Detection and Reporting")
    parser.add_argument("--video", type=str, required=True, help="Path to the local video file OR a web URL")
    parser.add_argument("--location", type=str, required=True, help="Location of the incident (to report to authorities)")
    args = parser.parse_args()

    is_web_url = args.video.startswith("http://") or args.video.startswith("https://")
    video_path = args.video

    if is_web_url:
        try:
            video_path = download_youtube_video(args.video)
        except Exception as e:
            print(f"Failed to download video from URL: {e}")
            return
    else:
        if not os.path.exists(video_path):
            print(f"Error: Local video file not found at '{video_path}'.")
            return

    incident_type = analyze_video(video_path)
    contacts = get_emergency_numbers_for_location(args.location)

    # Cleanup downloaded video to save space
    if is_web_url and os.path.exists(video_path):
        os.remove(video_path)

    if incident_type == 'ROAD_ACCIDENT':
        print(f"Action: Triggering Ambulance/Hospital Booking for {args.location}...")
        make_emergency_call(incident_type, args.location, contacts["AMBULANCE"])
    elif incident_type == 'ANTI_SOCIAL':
        print(f"Action: Triggering Police Dispatch for {args.location}...")
        make_emergency_call(incident_type, args.location, contacts["POLICE"])
    elif incident_type:
        print(f"Classification was {incident_type}. No emergency action needed.")

if __name__ == "__main__":
    main()
