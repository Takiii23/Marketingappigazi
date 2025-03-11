require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const USERS_FILE = path.join(__dirname, "users.json");
const SAVED_TEXTS_FILE = path.join(__dirname, "saved_texts.json");

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// **📌 Felhasználók betöltése**
let users = [];
try {
    if (fs.existsSync(USERS_FILE)) {
        const rawData = fs.readFileSync(USERS_FILE, "utf8");
        users = JSON.parse(rawData);

        // Ha nem tömb, alakítsuk át
        if (!Array.isArray(users)) {
            users = Object.entries(users).map(([username, password]) => ({ username, password }));
            fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        }
    } else {
        fs.writeFileSync(USERS_FILE, JSON.stringify([])); // Ha nincs fájl, létrehozzuk
    }
} catch (error) {
    console.error("❌ Hiba a users.json betöltésekor:", error);
    users = [];
}

// **📌 Regisztráció**
app.post("/register", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Felhasználónév és jelszó szükséges!" });
    }

    if (users.some(user => user.username === username)) {
        return res.status(400).json({ error: "A felhasználónév már létezik!" });
    }

    users.push({ username, password });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true, message: "Sikeres regisztráció!" });
});

// **📌 Bejelentkezés**
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Felhasználónév és jelszó szükséges!" });
    }

    const user = users.find(user => user.username === username && user.password === password);
    if (!user) {
        return res.status(401).json({ error: "Hibás bejelentkezési adatok!" });
    }

    res.json({ success: true, message: "Sikeres bejelentkezés!" });
});

// **📌 AI Szöveg generátor API**
app.post("/generate-text", async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: "Téma szükséges!" });

        const styles = [
            { type: "Komoly", instruction: "Adj egy részletes, de tömör magyarázatot erről a témáról.", max_tokens: 500 },
            { type: "Fun Fact", instruction: "Mondj egy rövid, meglepő tényt erről a témáról.", max_tokens: 300 },
            { type: "Motiváló", instruction: "Írj egy inspiráló üzenetet erről a témáról.", max_tokens: 400 },
            { type: "Fiatalos", instruction: "Írj egy könnyed, fiatalos szöveget erről a témáról.", max_tokens: 400 },
            { type: "Drámai", instruction: "Írj egy érzelmekkel teli, drámai szöveget erről a témáról.", max_tokens: 450 },
            { type: "Szarkasztikus", instruction: "Adj egy szarkasztikus és ironikus véleményt erről a témáról.", max_tokens: 300 },
            { type: "Közösségi Média", instruction: "Írj egy rövid, ütős szöveget közösségi médiára.", max_tokens: 250 }
        ];

        const results = await Promise.all(styles.map(async (style) => {
            const response = await axios.post("https://api.openai.com/v1/chat/completions", {
                model: "gpt-3.5-turbo",
                messages: [{ role: "system", content: `${style.instruction} A téma: ${prompt}` }],
                max_tokens: style.max_tokens
            }, {
                headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
            });

            return { type: style.type, text: response.data.choices[0].message.content };
        }));

        res.json({ results });
    } catch (error) {
        console.error("AI generálás hiba:", error);
        res.status(500).json({ error: "AI generálási hiba történt." });
    }
});

// **📌 Mentett szövegek kezelése**
app.post("/save-text", (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Szöveg szükséges!" });

    let savedTexts = [];
    if (fs.existsSync(SAVED_TEXTS_FILE)) {
        savedTexts = JSON.parse(fs.readFileSync(SAVED_TEXTS_FILE, "utf8"));
    }

    savedTexts.push(text);
    fs.writeFileSync(SAVED_TEXTS_FILE, JSON.stringify(savedTexts, null, 2));

    res.json({ success: true });
});

app.get("/saved-texts", (req, res) => {
    if (!fs.existsSync(SAVED_TEXTS_FILE)) {
        return res.json([]);
    }

    const savedTexts = JSON.parse(fs.readFileSync(SAVED_TEXTS_FILE, "utf8"));
    res.json(savedTexts);
});

// **📌 Chatbot API**
app.post("/chatbot", async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: "Üzenet szükséges!" });

        const response = await axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: message }],
            max_tokens: 200
        }, {
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
        });

        res.json({ text: response.data.choices[0].message.content });
    } catch (error) {
        console.error("Chatbot hiba:", error);
        res.status(500).json({ error: "Chatbot hiba történt." });
    }
});

// **📌 Oldalak kezelése**
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

app.get("/app", (req, res) => {
    res.sendFile(__dirname + "/public/app.html");
});

// **📌 Szerver indítása**
app.listen(PORT, () => console.log(`✅ Server fut a ${PORT} porton!`));
