/* ============================================
   Element refs
   ============================================ */
const micBtn = document.getElementById("micBtn");
const statusText = document.getElementById("statusText");
const timerEl = document.getElementById("timer");
const waveCanvas = document.getElementById("waveCanvas");
const waveCtx = waveCanvas.getContext("2d");

const dropZone = document.getElementById("dropZone");
const audioUpload = document.getElementById("audioUpload");
const audioPlayer = document.getElementById("audioPlayer");

const resultPanel = document.getElementById("result");
const genderTag = document.getElementById("genderTag");
const confidenceValue = document.getElementById("confidenceValue");
const voiceprint = document.getElementById("voiceprint");
const resetBtn = document.getElementById("resetBtn");

/* ============================================
   State
   ============================================ */
let mediaRecorder = null;
let audioChunks = [];
let audioContext = null;
let analyser = null;
let sourceNode = null;
let animationId = null;
let timerInterval = null;
let elapsedSeconds = 0;
let isRecording = false;

/* ============================================
   Mock prediction (placeholder for future model)
   ============================================ */
function mockPrediction() {
    const isMale = Math.random() > 0.5;
    const confidence = +(80 + Math.random() * 20).toFixed(1);
    return { gender: isMale ? "Male" : "Female", confidence };
}

/* ============================================
   Timer
   ============================================ */
function formatTime(totalSeconds) {
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${m}:${s}`;
}

function startTimer() {
    elapsedSeconds = 0;
    timerEl.textContent = formatTime(0);
    timerEl.classList.add("live");
    timerInterval = setInterval(() => {
        elapsedSeconds += 1;
        timerEl.textContent = formatTime(elapsedSeconds);
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerEl.classList.remove("live");
}

/* ============================================
   Waveform visualization (live, via Web Audio API)
   ============================================ */
function resizeCanvas() {
    const rect = waveCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    waveCanvas.width = rect.width * dpr;
    waveCanvas.height = rect.height * dpr;
    waveCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawIdleWave() {
    resizeCanvas();
    const { width, height } = waveCanvas.getBoundingClientRect();
    waveCtx.clearRect(0, 0, width, height);
}

function drawLiveWave() {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const { width, height } = waveCanvas.getBoundingClientRect();
    const barCount = 40;
    const step = Math.floor(bufferLength / barCount);

    function render() {
        animationId = requestAnimationFrame(render);
        analyser.getByteFrequencyData(dataArray);
        waveCtx.clearRect(0, 0, width, height);

        const barWidth = width / barCount;
        const centerY = height / 2;

        for (let i = 0; i < barCount; i++) {
            const value = dataArray[i * step] || 0;
            const barHeight = Math.max(3, (value / 255) * (height * 0.9));
            const x = i * barWidth + barWidth * 0.2;
            const w = barWidth * 0.6;

            const gradient = waveCtx.createLinearGradient(0, centerY - barHeight / 2, 0, centerY + barHeight / 2);
            gradient.addColorStop(0, "#ff6b4a");
            gradient.addColorStop(1, "#4ade9f");
            waveCtx.fillStyle = gradient;

            waveCtx.beginPath();
            waveCtx.roundRect(x, centerY - barHeight / 2, w, barHeight, 3);
            waveCtx.fill();
        }
    }

    render();
}

function stopLiveWave() {
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
    drawIdleWave();
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
        drawLiveWave();

        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.addEventListener("dataavailable", (e) => audioChunks.push(e.data));
        mediaRecorder.addEventListener("stop", () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
            const audioURL = URL.createObjectURL(audioBlob);
            audioPlayer.src = audioURL;
            audioPlayer.hidden = false;
            stream.getTracks().forEach((track) => track.stop());
            showPrediction();
        });

        mediaRecorder.start();
        isRecording = true;
        micBtn.setAttribute("aria-pressed", "true");
        statusText.textContent = "Listening…";
        startTimer();
    } catch (error) {
        statusText.textContent = "Microphone access was denied.";
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }
    if (audioContext) {
        audioContext.close();
    }
    stopLiveWave();
    stopTimer();
    isRecording = false;
    micBtn.setAttribute("aria-pressed", "false");
    statusText.textContent = "Analyzing…";
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
    const audioURL = URL.createObjectURL(file);
    audioPlayer.src = audioURL;
    audioPlayer.hidden = false;
    statusText.textContent = `Analyzing “${file.name}”…`;
    setTimeout(showPrediction, 600);
}

/* ============================================
   Show prediction + voiceprint bars
   ============================================ */
function buildVoiceprint(confidence) {
    voiceprint.innerHTML = "";
    const barCount = 32;
    for (let i = 0; i < barCount; i++) {
        const bar = document.createElement("span");
        const jitter = 0.55 + Math.random() * 0.45;
        const level = Math.min(1, (confidence / 100) * jitter);
        bar.style.height = `${Math.max(8, level * 100)}%`;
        voiceprint.appendChild(bar);
    }
    requestAnimationFrame(() => {
        [...voiceprint.children].forEach((bar) => {
            bar.style.transform = "scaleY(1)";
        });
    });
}

function showPrediction() {
    const prediction = mockPrediction();

    genderTag.textContent = prediction.gender;
    genderTag.className = "gender-tag " + prediction.gender.toLowerCase();
    confidenceValue.textContent = `${prediction.confidence}%`;
    confidenceValue.style.color = prediction.gender === "Male" ? "var(--accent)" : "var(--accent-2)";

    buildVoiceprint(prediction.confidence);

    resultPanel.classList.remove("hidden");
    statusText.textContent = "Ready when you are";
    timerEl.textContent = "00:00";

    resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ============================================
   Reset
   ============================================ */
resetBtn.addEventListener("click", () => {
    resultPanel.classList.add("hidden");
    audioPlayer.hidden = true;
    audioPlayer.src = "";
    audioUpload.value = "";
    voiceprint.innerHTML = "";
    statusText.textContent = "Ready when you are";
});

/* ============================================
   Init
   ============================================ */
window.addEventListener("resize", () => {
    if (!isRecording) drawIdleWave();
});
drawIdleWave();
