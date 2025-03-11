async function generateText() {
    const prompt = document.getElementById("prompt").value;
    if (!prompt) return alert("Adj meg egy témát!");

    document.getElementById("results").innerHTML = "<p>📶 Generálás folyamatban...</p>";

    const response = await fetch("/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
    });

    const data = await response.json();
    document.getElementById("results").innerHTML = data.results
        .map(res => `<b>${res.type}</b><br>${res.text}<br><button onclick="saveText('${res.text}')">💾 Mentés</button><br><br>`)
        .join("");
}

async function sendMessage() {
    const message = document.getElementById("chat-input").value;
    if (!message) return;

    const response = await fetch("/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
    });

    const data = await response.json();
    document.getElementById("chat-history").innerHTML += `<p><b>Bot:</b> ${data.text}</p>`;
    document.getElementById("chat-input").value = "";
}

async function saveText(text) {
    await fetch("/save-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
    });
    alert("✅ Szöveg mentve!");
}

async function toggleSaved() {
    const savedPopup = document.getElementById("saved-popup");
    savedPopup.classList.toggle("hidden");

    const response = await fetch("/saved-texts");
    const texts = await response.json();
    document.getElementById("saved-list").innerHTML = texts.map(txt => `<p>${txt}</p>`).join("");
}

function toggleChat() {
    document.getElementById("chat-popup").classList.toggle("hidden");
}
