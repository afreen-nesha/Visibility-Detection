import cv2
import numpy as np
import math

# --- 1. TOOL DETECTION ---
def detect_tools(frame, model):
    results = model(frame, verbose=False)
    tools = []
    for box in results[0].boxes:
        conf = float(box.conf[0])
        if conf > 0.4:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            tools.append({
                "bbox": [x1, y1, x2, y2], # List format for JSON compatibility
                "confidence": round(conf, 2)
            })
    return tools

# --- 2. BLOOD DETECTION ---
def blood_ratio(frame):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    lower_red1, upper_red1 = np.array([0, 120, 70]), np.array([10, 255, 255])
    lower_red2, upper_red2 = np.array([170, 120, 70]), np.array([180, 255, 255])
    mask = cv2.inRange(hsv, lower_red1, upper_red1) + cv2.inRange(hsv, lower_red2, upper_red2)
    return cv2.countNonZero(mask) / (frame.shape[0] * frame.shape[1])

# --- 3. SMOKE DETECTION ---
def smoke_score(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return np.std(cv2.GaussianBlur(gray, (5, 5), 0))

# --- 4. HELPERS ---
def iou(boxA, boxB):
    xA, yA = max(boxA[0], boxB[0]), max(boxA[1], boxB[1])
    xB, yB = min(boxA[2], boxB[2]), min(boxA[3], boxB[3])
    inter = max(0, xB - xA) * max(0, yB - yA)
    if inter <= 0: return 0.0
    areaA = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    areaB = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
    return inter / float(areaA + areaB - inter)

# --- MAIN PIPELINE ---
def run_inference(frame, models):
    alerts = []
    
    # Run Detections
    tools = detect_tools(frame, models["tool_model"])
    blood = blood_ratio(frame)
    smoke = smoke_score(frame)

    # Critical Region Logic (Center 25% of screen)
    h, w = frame.shape[:2]
    # We define the box here for logic, but frontend will draw the circle
    critical_box = [int(w*0.25), int(h*0.25), int(w*0.75), int(h*0.75)]
    
    for t in tools:
        if iou(t['bbox'], critical_box) > 0.1:
            alerts.append({"type": "Critical Region Entry", "confidence": 0.95})

    # Visibility Logic
    if smoke < 45 or blood > 0.03: visibility = "POOR"
    elif smoke < 60: visibility = "MODERATE"
    else: visibility = "GOOD"

    return {
        "visibility": visibility,
        "blood_ratio": blood,
        "smoke_score": smoke,
        "tool_count": len(tools),
        "raw_tools": tools,  # CRITICAL: Sends coordinates to frontend
        "alerts": alerts
    }