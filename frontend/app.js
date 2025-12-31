let videoData = [];

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("videoInput");
    const video = document.getElementById("videoPlayer");
    const canvas = document.getElementById("videoCanvas");
    const ctx = canvas.getContext("2d");
    const btn = document.getElementById("analyzeBtn");

    // 1. Load Video Preview
    input.addEventListener("change", () => {
        if (input.files[0]) {
            video.src = URL.createObjectURL(input.files[0]);
            video.style.display = "block";
        }
    });

    // 2. DRAWING LOOP (The Visual Overlay)
    video.addEventListener("timeupdate", () => {
        if (!video.videoWidth) return;

        // Match Canvas to Video dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // A. DRAW CRITICAL REGION (Purple Circle)
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        // Radius is 25% of the smallest dimension (matches backend logic)
        const r = Math.min(canvas.width, canvas.height) * 0.25;

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#d946ef"; // Magenta/Purple color
        ctx.stroke();
        
        ctx.font = "bold 16px Arial";
        ctx.fillStyle = "#d946ef";
        ctx.fillText("Critical Region", cx - 50, cy - r - 10);

        // B. FIND DATA FOR CURRENT FRAME
        const t = video.currentTime;
        // Find backend data that matches current timestamp (within 0.2s margin)
        const frameData = videoData.find(d => Math.abs(d.time - t) < 0.2);

        if (frameData) {
            // Draw Status Text (Top Left)
            ctx.font = "bold 24px Arial";
            if (frameData.visibility === "GOOD") ctx.fillStyle = "#4ade80"; // Green
            else if (frameData.visibility === "MODERATE") ctx.fillStyle = "orange";
            else ctx.fillStyle = "red";
            
            ctx.fillText(`Visibility: ${frameData.visibility}`, 20, 40);

            // Draw Tools (Bounding Boxes)
            if (frameData.tools) {
                frameData.tools.forEach(tool => {
                    const [x1, y1, x2, y2] = tool.bbox;
                    const w = x2 - x1;
                    const h = y2 - y1;

                    // Distance Check for Color Logic
                    const tx = x1 + w/2;
                    const ty = y1 + h/2;
                    const dist = Math.sqrt((tx-cx)**2 + (ty-cy)**2);
                    
                    // Red box if inside circle, Blue if outside
                    ctx.strokeStyle = dist < r ? "red" : "#38bdf8";
                    ctx.lineWidth = 3;
                    ctx.strokeRect(x1, y1, w, h);
                    
                    ctx.fillStyle = ctx.strokeStyle;
                    ctx.font = "14px Arial";
                    ctx.fillText(`Tool ${Math.round(tool.confidence*100)}%`, x1, y1 - 5);
                });
            }
        }
    });

    // 3. ANALYSIS LOGIC (Connecting to Render)
    if (btn) btn.addEventListener("click", async () => {
        const status = document.getElementById("status");
        const output = document.getElementById("output");
        
        if (!input.files[0]) return alert("Please select a video file!");
        
        const formData = new FormData();
        formData.append("file", input.files[0]);
        
        status.innerText = "⏳ Sending video to Cloud Server... (This may take 30-60s)";
        
        try {
            // --- UPDATED URL HERE ---
            const res = await fetch("https://visibility-detection.onrender.com/analyze_video", { 
                method: "POST", 
                body: formData 
            });

            if (!res.ok) throw new Error(`Server Error: ${res.status}`);

            const data = await res.json();
            console.log("Data from Render:", data);
            
            videoData = data.events; // Save data for the drawing loop
            status.innerText = "✅ Analysis Done! Playing Visuals.";
            
            // Render the Dashboard Stats
            output.innerHTML = `
                <div class="summary-container">
                    <h3>📊 Cloud Analysis Results</h3>
                    <div class="stats-row">
                        <div class="stat-card">
                            <div class="progress-circle" style="--value:${data.blood_ratio}">
                                <span>${data.blood_ratio}%</span>
                            </div>
                            <p>Blood Level</p>
                        </div>
                        <div class="stat-card">
                            <div class="progress-circle" style="--value:${data.smoke_score}">
                                <span>${data.smoke_score}%</span>
                            </div>
                            <p>Smoke/Dust</p>
                        </div>
                    </div>
                </div>`;
            
            video.play();

        } catch (e) {
            console.error(e);
            status.innerText = "❌ Error: Could not reach Render server. Check console.";
            output.innerHTML = `<p style="color:red; background:rgba(255,0,0,0.1); padding:10px;">
                <strong>Troubleshooting:</strong><br>
                1. The free Render server spins down after 15 mins of inactivity.<br>
                2. The first request might take 50+ seconds to "wake up".<br>
                3. Check if your backend logs show any errors.
            </p>`;
        }
    });
});
