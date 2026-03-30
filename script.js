const recordBtn = document.getElementById("recordBtn");
const stopBtn = document.getElementById("stopBtn");
const takeAgainBtn = document.getElementById("takeAgainBtn");
const resultDiv = document.getElementById("result");
const genderText = document.getElementById("gender");
const confidenceText = document.getElementById("confidence");
const audioPlayer = document.getElementById("audioPlayer");

let mediaRecorder;
let audioChunks = [];

// Mock prediction function
function mockGenderPrediction() {
    const genders = ["Male", "Female"];
    const randomGender = genders[Math.floor(Math.random() * genders.length)];
    const randomConfidence = (Math.random() * (100 - 80) + 80).toFixed(2); // 80% to 100%
    return { gender: randomGender, confidence: randomConfidence };
}

// Start Recording
recordBtn.addEventListener("click", async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Your browser does not support audio recording.");
        return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.start();
    audioChunks = [];

    mediaRecorder.addEventListener("dataavailable", event => {
        audioChunks.push(event.data);
    });

    mediaRecorder.addEventListener("stop", () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        audioPlayer.src = audioUrl;
        audioPlayer.style.display = "block";

        // Show mock prediction
        const prediction = mockGenderPrediction();
        genderText.textContent = `Gender: ${prediction.gender}`;
        confidenceText.textContent = `Confidence: ${prediction.confidence}%`;
        resultDiv.style.display = "block";
    });

    recordBtn.disabled = true;
    stopBtn.disabled = false;
});

// Stop Recording
stopBtn.addEventListener("click", () => {
    mediaRecorder.stop();
    recordBtn.disabled = false;
    stopBtn.disabled = true;
});

// Take Again
takeAgainBtn.addEventListener("click", () => {
    resultDiv.style.display = "none";
    audioPlayer.style.display = "none";
});