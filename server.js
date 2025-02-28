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
    secret: 'super_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({}));
}
if (!fs.existsSync(SAVED_TEXTS_FILE)) {
    fs.writeFileSync(SAVED_TEXTS_FILE, JSON.stringify([]));
}

let users = JSON.parse(fs.readFileSync(USERS_FILE));
let savedTexts = JSON.parse(fs.readFileSync(SAVED_TEXTS_FILE));

app.get('/check-auth', (req, res) => {
    if (req.session.user) {
        res.json({ authenticated: true, user: req.session.user });
    } else {
        res.json({ authenticated: false });
    }
});

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (users[username]) {
        return res.status(400).json({ success: false, message: "A felhasználónév már létezik!" });
    }
    users[username] = password;
    fs.writeFileSync(USERS_FILE, JSON.stringify(users));
    res.json({ success: true });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (users[username] === password) {
        req.session.user = username;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// 📌 AI Szöveg generátor API (NEM marketinges megfogalmazás)
app.post('/generate-text', async (req, res) => {
    try {
        const { prompt } = req.body;

        const styles = [
            { type: "Komoly", instruction: "Adj egy részletes és informatív magyarázatot erről a témáról.", max_tokens: 500 },
            { type: "Fun Fact", instruction: "Mondj egy érdekes és meglepő tényt erről a témáról.", max_tokens: 200 },
            { type: "Motiváló", instruction: "Írj egy inspiráló és pozitív üzenetet erről a témáról.", max_tokens: 400 },
            { type: "Fiatalos", instruction: "Írj egy könnyed, fiatalos és laza szöveget erről a témáról.", max_tokens: 300 },
            { type: "Drámai", instruction: "Írj egy érzelmekkel teli, drámai megfogalmazást erről a témáról.", max_tokens: 450 },
            { type: "Szarkasztikus", instruction: "Adj egy szarkasztikus és ironikus véleményt erről a témáról.", max_tokens: 250 }
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

app.post('/save-text', (req, res) => {
    const { text } = req.body;
    savedTexts.push(text);
    fs.writeFileSync(SAVED_TEXTS_FILE, JSON.stringify(savedTexts));
    res.json({ success: true });
});

app.get('/saved-texts', (req, res) => {
    res.json(savedTexts);
});

app.listen(PORT, () => console.log(`✅ Server fut a ${PORT} porton: http://localhost:${PORT}`));
