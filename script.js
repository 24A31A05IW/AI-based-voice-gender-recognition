/* ============================================
   Element refs
   ============================================ */
const micBtn = document.getElementById("micBtn");
const recLabel = document.getElementById("recLabel");
const clockEl = document.getElementById("clock");
const statusText = document.getElementById("statusText");
const inputLed = document.getElementById("inputLed");

const spectrogram = document.getElementById("spectrogram");
const sgCtx = spectrogram.getContext("2d");

const dropZone = document.getElementById("dropZone");
const audioUpload = document.getElementById("audioUpload");
const audioPlayer = document.getElementById("audioPlayer");

const outputModule = document.getElementById("outputModule");
const genderTag = document.getElementById("genderTag");
const confidenceValue = document.getElementById("confidenceValue");
const gaugeFill = document.getElementById("gaugeFill");
const needle = document.getElementById("needle");
const gaugeTicks = document.getElementById("gaugeTicks");
const resetBtn = document.getElementById("resetBtn");

/* ============================================
   State
   ============================================ */
let mediaRecorder = null;
let audioChunks = [];
let audioContext = null;
let analyser = null;
let sourceNode = null;
let rafId = null;
let clockInterval = null;
let elapsedSeconds = 0;
let isRecording = false;

/* ============================================
   Mock prediction (placeholder for a trained model)
   ============================================ */
function mockPrediction() {
    const isMale = Math.random() > 0.5;
    const confidence = +(78 + Math.random() * 21).toFixed(1);
    return { gender: isMale ? "Male" : "Female", confidence };
}

/* ============================================
   Clock
   ============================================ */
function formatTime(totalSeconds) {
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${m}:${s}`;
}

function startClock() {
    elapsedSeconds = 0;
    clockEl.textContent = formatTime(0);
    clockInterval = setInterval(() => {
        elapsedSeconds += 1;
        clockEl.textContent = formatTime(elapsedSeconds);
    }, 1000);
}

function stopClock() {
    clearInterval(clockInterval);
}

/* ============================================
   Scrolling spectrogram (waterfall) display
   ============================================ */
function sizeSpectrogram() {
    const rect = spectrogram.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    spectrogram.width = rect.width * dpr;
    spectrogram.height = rect.height * dpr;
    sgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sgCtx.fillStyle = "#ece8db";
    sgCtx.fillRect(0, 0, rect.width, rect.height);
}

function colorForLevel(v) {
    // v: 0..1 amplitude -> paper ink through teal to rust
    if (v < 0.5) {
        const t = v / 0.5;
        return mixColor([236, 232, 219], [36, 83, 74], t);
    }
    const t = (v - 0.5) / 0.5;
    return mixColor([36, 83, 74], [166, 68, 42], t);
}

function mixColor(a, b, t) {
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return `rgb(${r}, ${g}, ${bl})`;
}

function drawSpectrogramColumn() {
    const rect = spectrogram.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // shift existing image left by 2px
    sgCtx.drawImage(spectrogram, 2, 0, width - 2, height, 0, 0, width - 2, height);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    const bins = 48;
    const step = Math.max(1, Math.floor(bufferLength / bins));
    const rowHeight = height / bins;

    for (let i = 0; i < bins; i++) {
        const value = dataArray[i * step] || 0;
        const level = value / 255;
        sgCtx.fillStyle = colorForLevel(level);
        // low frequencies at bottom, high at top
        const y = height - (i + 1) * rowHeight;
        sgCtx.fillRect(width - 2, y, 2, rowHeight + 0.5);
    }
}

function runSpectrogram() {
    function frame() {
        rafId = requestAnimationFrame(frame);
        drawSpectrogramColumn();
    }
    frame();
}

function stopSpectrogram() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
}

/* ============================================
   Gauge ticks (drawn once)
   ============================================ */
function buildGaugeTicks() {
    const center = { x: 110, y: 116 };
    const rInner = 82;
    const rOuter = 92;
    const fractions = [0, 0.25, 0.5, 0.75, 1];

    fractions.forEach((f) => {
        const angleDeg = -90 + f * 180;
        const rad = (angleDeg * Math.PI) / 180;
        const dx = Math.sin(rad);
        const dy = -Math.cos(rad);

        const x1 = center.x + dx * rInner;
        const y1 = center.y + dy * rInner;
        const x2 = center.x + dx * rOuter;
        const y2 = center.y + dy * rOuter;

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x1.toFixed(1));
        line.setAttribute("y1", y1.toFixed(1));
        line.setAttribute("x2", x2.toFixed(1));
        line.setAttribute("y2", y2.toFixed(1));
        line.setAttribute("class", "gauge-ticks");
        gaugeTicks.appendChild(line);
    });
}

/* ============================================
   Recording flow
   ============================================ */
micBtn.addEventListener("click", async () => {
    if (isRecording) {
        stopRecording();
    } else {
        await startRecording();
    }
});

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        sourceNode = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        sourceNode.connect(analyser);
        runSpectrogram();

        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.addEventListener("dataavailable", (e) => audioChunks.push(e.data));
        mediaRecorder.addEventListener("stop", () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
            audioPlayer.src = URL.createObjectURL(audioBlob);
            audioPlayer.hidden = false;
            stream.getTracks().forEach((track) => track.stop());
            statusText.textContent = "PROCESSING — extracting pitch features";
            setTimeout(showPrediction, 500);
        });

        mediaRecorder.start();
        isRecording = true;
        micBtn.setAttribute("aria-pressed", "true");
        recLabel.textContent = "Stop";
        inputLed.classList.add("live");
        statusText.textContent = "REC — listening";
        startClock();
    } catch (error) {
        statusText.textContent = "ERROR — microphone access denied";
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }
    if (audioContext) {
        audioContext.close();
    }
    stopSpectrogram();
    stopClock();
    isRecording = false;
    micBtn.setAttribute("aria-pressed", "false");
    recLabel.textContent = "Record";
    inputLed.classList.remove("live");
}

/* ============================================
   Upload flow
   ============================================ */
audioUpload.addEventListener("change", () => {
    const file = audioUpload.files[0];
    if (file) handleUploadedFile(file);
});

["dragenter", "dragover"].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
    });
});

["dragleave", "drop"].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
    });
});

dropZone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleUploadedFile(file);
});

function handleUploadedFile(file) {
    audioPlayer.src = URL.createObjectURL(file);
    audioPlayer.hidden = false;
    statusText.textContent = `PROCESSING — reading “${file.name}”`;
    setTimeout(showPrediction, 700);
}

/* ============================================
   Show prediction on the gauge
   ============================================ */
function showPrediction() {
    const prediction = mockPrediction();

    genderTag.textContent = prediction.gender;
    confidenceValue.textContent = `${prediction.confidence}%`;

    const angle = -90 + (prediction.confidence / 100) * 180;
    needle.style.transform = `rotate(${angle}deg)`;

    const circumference = 302;
    gaugeFill.style.strokeDashoffset = String(circumference - (prediction.confidence / 100) * circumference);
    gaugeFill.style.stroke = prediction.confidence >= 90 ? "#24534a" : "#a6442a";

    outputModule.classList.remove("hidden");
    statusText.textContent = "STANDBY — awaiting input";
    clockEl.textContent = "00:00";

    outputModule.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ============================================
   Reset
   ============================================ */
resetBtn.addEventListener("click", () => {
    outputModule.classList.add("hidden");
    audioPlayer.hidden = true;
    audioPlayer.src = "";
    audioUpload.value = "";
    needle.style.transform = "rotate(-90deg)";
    gaugeFill.style.strokeDashoffset = "302";
    statusText.textContent = "STANDBY — awaiting input";
});

/* ============================================
   Init
   ============================================ */
window.addEventListener("resize", () => {
    if (!isRecording) sizeSpectrogram();
});
sizeSpectrogram();
buildGaugeTicks();
