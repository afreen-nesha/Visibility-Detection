from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import cv2
import tempfile
import os
from model_loader import load_models
from inference import run_inference

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models = load_models()

@app.post("/analyze_video")
async def analyze_video(file: UploadFile = File(...)):
    content = await file.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        tmp.write(content)
        video_path = tmp.name

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    events_list = []
    max_blood = 0.0
    max_smoke = 0.0
    max_tools = 0
    frame_no = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret: break
            frame_no += 1

            # Analyze every 10th frame (faster processing)
            if frame_no % 10 == 0:
                result = run_inference(frame, models)
                timestamp = round(frame_no / fps, 2)

                # Dashboard Aggregates
                max_blood = max(max_blood, result["blood_ratio"])
                # Convert smoke std_dev to percentage (approximate)
                smoke_pct = max(0, min(100, (100 - result["smoke_score"])))
                max_smoke = max(max_smoke, smoke_pct)
                max_tools = max(max_tools, result["tool_count"])

                # Store frame data for the overlay
                events_list.append({
                    "time": timestamp,
                    "visibility": result["visibility"],
                    "tools": result["raw_tools"], # Passing boxes for drawing
                    "alerts": result.get("alerts", [])
                })

    finally:
        cap.release()
        if os.path.exists(video_path): os.remove(video_path)

    return {
        "events": events_list,
        "blood_ratio": round(max_blood * 100, 1),
        "smoke_score": round(max_smoke, 1),
        "overall_visibility": "Clear" if max_smoke < 50 else "Poor",
        "tool_count": max_tools
    }