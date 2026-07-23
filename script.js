const recordBtn = document.getElementById("recordBtn");
const stopBtn = document.getElementById("stopBtn");
const takeAgainBtn = document.getElementById("takeAgainBtn");

const audioPlayer = document.getElementById("audioPlayer");
const result = document.getElementById("result");

const gender = document.getElementById("gender");
const confidence = document.getElementById("confidence");
const progressBar = document.getElementById("progressBar");

let mediaRecorder;
let audioChunks = [];

/* -------------------------
   Mock AI Prediction
------------------------- */

function mockPrediction() {

    const predictedGender =
        Math.random() > 0.5 ? "Male" : "Female";

    const confidenceScore =
        (80 + Math.random() * 20).toFixed(1);

    return {
        gender: predictedGender,
        confidence: confidenceScore
    };
}

/* -------------------------
   Start Recording
------------------------- */

recordBtn.addEventListener("click", async () => {

    try {

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        mediaRecorder = new MediaRecorder(stream);

        audioChunks = [];

        mediaRecorder.start();

        mediaRecorder.addEventListener("dataavailable", event => {
            audioChunks.push(event.data);
        });

        mediaRecorder.addEventListener("stop", () => {

            const audioBlob = new Blob(audioChunks, {
                type: "audio/wav"
            });

            const audioURL =
                URL.createObjectURL(audioBlob);

            audioPlayer.src = audioURL;
            audioPlayer.hidden = false;

            const prediction = mockPrediction();

            gender.textContent = prediction.gender;

            confidence.textContent =
                prediction.confidence + "%";

            progressBar.style.width =
                prediction.confidence + "%";

            result.classList.remove("hidden");

        });

        recordBtn.disabled = true;
        stopBtn.disabled = false;

    } catch (error) {

        alert("Microphone access was denied.");

    }

});

/* -------------------------
   Stop Recording
------------------------- */

stopBtn.addEventListener("click", () => {

    if (mediaRecorder) {

        mediaRecorder.stop();

        recordBtn.disabled = false;
        stopBtn.disabled = true;

    }

});

/* -------------------------
   Analyze Another Voice
------------------------- */

takeAgainBtn.addEventListener("click", () => {

    result.classList.add("hidden");

    audioPlayer.hidden = true;

    audioPlayer.src = "";

    progressBar.style.width = "0%";

});
