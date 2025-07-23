// 📄 script.js – Frissítve: platform eltávolítva a preferenciák mentésből

// 🔐 Bejelentkezés
async function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    const result = await response.json();
    if (result.success) {
        window.location.href = "/app.html";
    } else {
        alert("❌ Hibás bejelentkezés!");
    }
}

// 📝 Regisztráció
async function register() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const response = await fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    const result = await response.json();
    if (result.success) {
        window.location.href = "/preferences.html";
    } else {
        alert("❌ Hiba regisztráció közben!");
    }
}

// 💾 Preferenciák mentése (csak témakör)
async function savePreferences() {
    const select = document.getElementById("marketing_field");
    const selectedFields = Array.from(select.selectedOptions).map(opt => opt.value);
    if (selectedFields.length === 0) return alert("Válassz ki legalább egy témát!");

    const response = await fetch("/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketing_field: selectedFields })
    });

    const result = await response.json();
    if (result.success) {
        window.location.href = "/app.html";
    } else {
        alert("❌ Preferencia mentés hiba!");
    }
}

// 📩 Platform mentés (opcionális funkcióként megmarad, de nem használjuk itt)
async function savePlatform() {
    const select = document.getElementById("platform");
    if (!select) return;
    const selectedPlatforms = Array.from(select.selectedOptions).map(opt => opt.value);

    const response = await fetch("/platform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: selectedPlatforms })
    });

    const result = await response.json();
    if (!result.success) alert("❌ Platform mentési hiba!");
}

// ✨ Szöveg generálás (meghatározható platform)
async function generateText() {
    const prompt = document.getElementById("prompt").value;
    const customStyle = document.getElementById("custom-style")?.value || "";
    const postDate = document.getElementById("post-date")?.value || "";
    const platformSelect = document.getElementById("platform");
    const platform = Array.from(platformSelect.selectedOptions).map(opt => opt.value);

    if (!prompt) return alert("Adj meg egy témát!");

    const response = await fetch("/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, customStyle, postDate, platform })
    });

    const result = await response.json();
    const container = document.getElementById("generated-results");
    container.innerHTML = "";

    if (result.success) {
        result.results.forEach(r => {
            const div = document.createElement("div");
            div.className = "result-block";
            div.innerHTML = `<h4>${r.type}</h4><p>${r.text}</p>`;
            container.appendChild(div);
        });
    } else {
        alert("❌ Generálási hiba történt!");
    }
}

// 📥 Szöveg mentése
async function saveText() {
    const text = prompt("Add meg a szöveget, amit menteni szeretnél:");
    if (!text) return;

    const response = await fetch("/save-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
    });

    const result = await response.json();
    if (result.success) {
        alert("✅ Szöveg mentve!");
    } else {
        alert("❌ Mentési hiba történt!");
    }
}

// 🚪 Kijelentkezés
async function logout() {
    await fetch("/logout");
    window.location.href = "/";
}

// 💬 Chatbot üzenetküldés
async function sendChatbotMessage() {
    const input = document.getElementById("chatbot-input");
    const message = input.value;
    if (!message) return;

    const msgBox = document.getElementById("chatbot-messages");
    msgBox.innerHTML += `<div class='message user'>${message}</div>`;
    input.value = "";

    const res = await fetch("/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
    });
    const data = await res.json();

    msgBox.innerHTML += `<div class='message bot'>${data.reply}</div>`;
    msgBox.scrollTop = msgBox.scrollHeight;
}

// 💬 Emoji gomb – Chatbot ablak nyitása/zárása
function toggleChatbot() {
    const win = document.getElementById("chatbot-window");
    win.style.display = win.style.display === "none" ? "block" : "none";
}
