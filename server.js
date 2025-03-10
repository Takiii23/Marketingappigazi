require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, "users.json");
const SAVED_TEXTS_FILE = path.join(__dirname, "saved_texts.json");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'super_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Ha nem léteznek a fájlok, hozzuk létre
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({}));
if (!fs.existsSync(SAVED_TEXTS_FILE)) fs.writeFileSync(SAVED_TEXTS_FILE, JSON.stringify([]));

let users = JSON.parse(fs.readFileSync(USERS_FILE));
let savedTexts = JSON.parse(fs.readFileSync(SAVED_TEXTS_FILE));

// 🔐 Felhasználói hitelesítés
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: "Felhasználónév és jelszó szükséges!" });
    if (users[username]) return res.status(400).json({ success: false, message: "A felhasználónév már létezik!" });

    users[username] = password;
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true, message: "Sikeres regisztráció!" });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: "Felhasználónév és jelszó szükséges!" });
    if (users[username] === password) {
        req.session.user = username;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: "Hibás bejelentkezési adatok!" });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

app.get('/check-auth', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, user: req.session.user });
    } else {
        res.json({ authenticated: false });
    }
});

// 📌 AI Szöveg generátor API (Tömör és hatékony szövegek)
app.post('/generate-text', async (req, res) => {
    try {
        const { prompt } = req.body;

        const styles = [
            { type: "Komoly", instruction: "Adj egy tömör, de informatív magyarázatot erről a témáról.", max_tokens: 250 },
            { type: "Fun Fact", instruction: "Mondj egy rövid, érdekes tényt erről a témáról.", max_tokens: 150 },
            { type: "Motiváló", instruction: "Írj egy inspiráló, lényegre törő üzenetet erről a témáról.", max_tokens: 200 },
            { type: "Fiatalos", instruction: "Írj egy laza, figyelemfelkeltő szöveget erről a témáról.", max_tokens: 200 },
            { type: "Drámai", instruction: "Írj egy rövid, érzelmekkel teli drámai megfogalmazást erről a témáról.", max_tokens: 250 },
            { type: "Szarkasztikus", instruction: "Adj egy rövid, szarkasztikus véleményt erről a témáról.", max_tokens: 150 },
            { type: "Közösségi Média", instruction: "Írj egy rövid, ütős és figyelemfelkeltő szöveget közösségi média posztként.", max_tokens: 180 }
        ];

        const responses = await Promise.all(styles.map(async (style) => {
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: "gpt-3.5-turbo",
                messages: [{ role: "system", content: `${style.instruction} Téma: ${prompt}` }],
                max_tokens: style.max_tokens
            }, {
                headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }
            });

            return { type: style.type, text: response.data.choices[0].message.content };
        }));

        res.json({ variations: responses });
    } catch (error) {
        console.error("AI generálás hiba:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "AI generálás sikertelen! Ellenőrizd az API-kulcsot!" });
    }
});

// 📌 Chatbot API
app.post('/chatbot', async (req, res) => {
    try {
        const { message } = req.body;
        const response = await axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: message }],
            max_tokens: 150
        }, {
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }
        });
        res.json({ response: response.data.choices[0].message.content });
    } catch (error) {
        console.error("Chatbot hiba:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Chatbot hiba!" });
    }
});

// 📌 Mentett szövegek kezelése
app.get('/saved-texts', (req, res) => {
    res.json(savedTexts);
});

app.post('/save-text', (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: "Nincs megadva szöveg!" });

    savedTexts.push(text);
    fs.writeFileSync(SAVED_TEXTS_FILE, JSON.stringify(savedTexts, null, 2));
    res.json({ success: true, message: "Szöveg mentve!" });
});

// 📌 Alapértelmezett oldal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 📌 App oldal
app.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// Szerver indítása
app.listen(PORT, () => console.log(`✅ Server fut a ${PORT} porton: http://localhost:${PORT}`));
