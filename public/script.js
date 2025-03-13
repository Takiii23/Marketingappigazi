async function generateText() {
    const prompt = document.getElementById("prompt").value;
    if (!prompt) return alert("Adj meg egy témát!");

    document.getElementById("results").innerHTML = "<p>📶 Generálás folyamatban...</p>";

    try {
        const response = await fetch("/generate-text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt })
        });

        const data = await response.json();
        if (!data.results) throw new Error("Nem sikerült a generálás!");

        document.getElementById("results").innerHTML = data.results
            .map(res => `<b>${res.type}</b><br>${res.text}<br>
            <button onclick="saveText('${res.text.replace(/'/g, "\\'")}')">💾 Mentés</button><br><br>`)
            .join("");

    } catch (error) {
        console.error("Generálási hiba:", error);
        document.getElementById("results").innerHTML = "<p>❌ Hiba történt a generálás során!</p>";
    }
}

async function sendMessage() {
    const message = document.getElementById("chat-input").value;
    if (!message) return;

    try {
        const response = await fetch("/chatbot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message })
        });

        const data = await response.json();
        document.getElementById("chat-history").innerHTML += `<p><b>Bot:</b> ${data.text}</p>`;
        document.getElementById("chat-input").value = "";

    } catch (error) {
        console.error("Chatbot hiba:", error);
        document.getElementById("chat-history").innerHTML += "<p>❌ Hiba történt!</p>";
    }
}

async function saveText(text) {
    try {
        await fetch("/save-text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text })
        });
        alert("✅ Szöveg mentve!");
    } catch (error) {
        console.error("Mentési hiba:", error);
        alert("❌ Hiba történt a mentés során!");
    }
}

async function toggleSaved() {
    const savedPopup = document.getElementById("saved-popup");
    savedPopup.classList.toggle("hidden");

    try {
        const response = await fetch("/saved-texts");
        const texts = await response.json();
        document.getElementById("saved-list").innerHTML = texts.map(txt => `<p>${txt}</p>`).join("");
    } catch (error) {
        console.error("Mentett szövegek hiba:", error);
        document.getElementById("saved-list").innerHTML = "<p>❌ Nem sikerült betölteni!</p>";
    }
}

function toggleChat() {
    document.getElementById("chat-popup").classList.toggle("hidden");
}

async function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
        const response = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (data.success) {
            window.location.href = "app.html";
        } else {
            alert("❌ Sikertelen bejelentkezés!");
        }

    } catch (error) {
        console.error("Bejelentkezési hiba:", error);
        alert("❌ Hiba történt a bejelentkezés során!");
    }
}

async function register() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
        const response = await fetch("/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        alert(data.message);
    } catch (error) {
        console.error("Regisztrációs hiba:", error);
        alert("❌ Hiba történt a regisztráció során!");
    }
}

// ✅ Külön függvényként kell lennie
function goBack() {
    window.history.back();
}
