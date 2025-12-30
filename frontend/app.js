let videoAlerts = []; // Global variable to store alerts

document.addEventListener("DOMContentLoaded", () => {
    console.log("app.js loaded & DOM ready");

    const input = document.getElementById("videoInput");
    const video = document.getElementById("videoPlayer");
    const btn = document.getElementById("analyzeBtn");

    // PREVIEW LOGIC: Show video as soon as file is selected
    input.addEventListener("change", () => {
        if (input.files && input.files[0]) {
            const videoURL = URL.createObjectURL(input.files[0]);
            video.src = videoURL;
            video.style.display = "block";
            video.load();
            console.log("Video preview loaded");
        }
    });

    // TIME SYNC LOGIC: Fires as the video plays
    video.addEventListener("timeupdate", () => {
        const currentTime = video.currentTime;
        const alertList = document.getElementById("alertList");
        
        if (!alertList) return;

        videoAlerts.forEach((alert) => {
            // If video reaches the alert timestamp and we haven't shown it yet
            if (currentTime >= alert.time && !alert.shown) {
                const entry = document.createElement("p");
                entry.style.borderLeft = "3px solid #38bdf8";
                entry.style.padding = "8px";
                entry.style.marginBottom = "5px";
                entry.style.background = "rgba(56, 189, 248, 0.1)";
                entry.innerHTML = `⏱ ${alert.time.toFixed(2)}s: <strong>${alert.type}</strong> (Conf: ${(alert.confidence * 100).toFixed(1)}%)`;
                
                alertList.prepend(entry); // Add newest alerts to the top
                alert.shown = true;      // Mark as shown so it doesn't repeat
            }
        });
    });

    if (btn) btn.addEventListener("click", analyzeVideo);
});

async function analyzeVideo() {
    console.log("Analyze button clicked");

    const input = document.getElementById("videoInput");
    const status = document.getElementById("status");
    const output = document.getElementById("output");
    const video = document.getElementById("videoPlayer");

    if (!input.files[0]) {
        alert("Please select a video file first.");
        return;
    }

    const formData = new FormData();
    formData.append("file", input.files[0]);

    status.innerText = "⏳ Analyzing video... please wait";
    output.innerHTML = "";
    videoAlerts = []; // Reset alerts for new analysis

    try {
        const response = await fetch(
  "https://visibility-detection.onrender.com/analyze_video",
  {
    method: "POST",
    body: formData
  }
   );


        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const data = await response.json();
        console.log("Data received from server:", data);

        // ✅ Check if events exist and is an array before mapping
        if (data.events && Array.isArray(data.events)) {
            videoAlerts = data.events.map(event => ({
                time: event.time,
                type: event.alerts[0]?.type || "Alert Detected",
                confidence: event.alerts[0]?.confidence || 0,
                shown: false
            }));

            status.innerText = "▶️ Analysis Complete. Playing with Live Alerts.";
            
            // Show summary and create the alert log container
            output.innerHTML = `
                <h3>📊 Summary</h3>
                <p>Overall Visibility: ${data.overall_visibility ?? "N/A"}</p>
                <hr/>
                <h3>🚨 Live Alerts</h3>
                <div id="alertList"></div>
            `;

            video.play();
        } else {
            status.innerText = "✅ Analysis finished (No safety alerts detected)";
        }

    } catch (err) {
        console.error("Fetch Error:", err);
        status.innerText = "❌ Error analyzing video";
        output.innerHTML = `
            <div style="color: #f87171;">
                <strong>Failed to connect to server.</strong><br>
                1. Ensure your FastAPI server is running (Uvicorn).<br>
                2. Check the console (F12) for detailed error logs.
            </div>
        `;
    }

}
