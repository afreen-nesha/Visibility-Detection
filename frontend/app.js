
let videoData = [];

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("videoInput");
    const video = document.getElementById("videoPlayer");
    const canvas = document.getElementById("videoCanvas");
    const ctx = canvas.getContext("2d");
    const btn = document.getElementById("analyzeBtn");

    // Load Preview
    input.addEventListener("change", () => {
        if (input.files[0]) {
            video.src = URL.createObjectURL(input.files[0]);
            video.style.display = "block";
        }
    });

    // DRAWING LOOP
    video.addEventListener("timeupdate", () => {
        if (!video.videoWidth) return;

        // Match Canvas to Video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. DRAW CRITICAL REGION (Purple Circle)
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const r = Math.min(canvas.width, canvas.height) * 0.25;

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#d946ef"; // Magenta/Purple
        ctx.stroke();
        
        ctx.font = "bold 16px Arial";
        ctx.fillStyle = "#d946ef";
        ctx.fillText("Critical Region", cx - 50, cy - r - 10);

        // 2. FIND DATA FOR CURRENT FRAME
        const t = video.currentTime;
        const frameData = videoData.find(d => Math.abs(d.time - t) < 0.2);

        if (frameData) {
            // Draw Status Text (Top Left)
            ctx.font = "bold 24px Arial";
            if (frameData.visibility === "GOOD") ctx.fillStyle = "#4ade80"; // Green
            else if (frameData.visibility === "MODERATE") ctx.fillStyle = "orange";
            else ctx.fillStyle = "red";
            
            ctx.fillText(`Visibility: ${frameData.visibility}`, 20, 40);

            // Draw Tools
            frameData.tools.forEach(tool => {
                const [x1, y1, x2, y2] = tool.bbox;
                const w = x2 - x1;
                const h = y2 - y1;

                // Check distance to center
                const tx = x1 + w/2;
                const ty = y1 + h/2;
                const dist = Math.sqrt((tx-cx)**2 + (ty-cy)**2);
                
                // Color Logic: Red if inside circle, Blue if outside
                ctx.strokeStyle = dist < r ? "red" : "#38bdf8";
                ctx.lineWidth = 3;
                ctx.strokeRect(x1, y1, w, h);
                
                ctx.fillStyle = ctx.strokeStyle;
                ctx.font = "14px Arial";
                ctx.fillText(`Tool ${Math.round(tool.confidence*100)}%`, x1, y1 - 5);
            });
        }
    });

    // Analysis Logic
    if (btn) btn.addEventListener("click", async () => {
        const status = document.getElementById("status");
        const output = document.getElementById("output");
        
        if (!input.files[0]) return alert("Select file!");
        
        const formData = new FormData();
        formData.append("file", input.files[0]);
        status.innerText = "⏳ Processing...";

        try {
            const res = await fetch("http://127.0.0.1:8000/analyze_video", { method: "POST", body: formData });
            const data = await res.json();
            
            videoData = data.events; // Store for drawing
            status.innerText = " Done! Playing Visuals.";
            
            // Render Dashboard
            output.innerHTML = `
                <div class="summary-container">
                    <div class="stats-row">
                        <div><div class="progress-circle" style="--value:${data.blood_ratio}"><span>${data.blood_ratio}%</span></div><p>Blood</p></div>
                        <div><div class="progress-circle" style="--value:${data.smoke_score}"><span>${data.smoke_score}%</span></div><p>Smoke</p></div>
                    </div>
                </div>`;
            
            video.play();
        } catch (e) {
            status.innerText = " Connection Error";
            console.error(e);
        }
    });
});