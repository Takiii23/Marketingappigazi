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
const USERS_FILE = path.join(__dirname, 'users.json');
const SAVED_TEXTS_FILE = path.join(__dirname, 'saved_texts.json');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

app.use(
    session({
        secret: process.env.SESSION_SECRET || 'super_secret_key',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000,
        },
    })
);

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({}));
}
if (!fs.existsSync(SAVED_TEXTS_FILE)) {
    fs.writeFileSync(SAVED_TEXTS_FILE, JSON.stringify([]));
}

let users = JSON.parse(fs.readFileSync(USERS_FILE));
let savedTexts = JSON.parse(fs.readFileSync(SAVED_TEXTS_FILE));

// Bejelentkezés és regisztráció
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Felhasználónév és jelszó szükséges!' });
    }
    if (users[username]) {
        return res.status(400).json({ success: false, message: 'A felhasználónév már létezik!' });
    }
    users[username] = password;
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true, message: 'Sikeres regisztráció!' });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Felhasználónév és jelszó szükséges!' });
    }
    if (users[username] === password) {
        req.session.user = username;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Hibás bejelentkezési adatok!' });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

app.get('/check-auth', (req, res) => {
    res.json({ authenticated: !!req.session.user });
});

// AI Szöveg Generálás
app.post('/generate-text', async (req, res) => {
    try {
        const { prompt } = req.body;
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'system', content: `Téma: ${prompt}` }],
                max_tokens: 250,
            },
            {
                headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
            }
        );
        res.json({ text: response.data.choices[0].message.content });
    } catch (error) {
        console.error('AI generálás hiba:', error);
        res.status(500).json({ error: 'AI generálás sikertelen!' });
    }
});

// Szövegek mentése
app.post('/save-text', (req, res) => {
    const { text } = req.body;
    savedTexts.push(text);
    fs.writeFileSync(SAVED_TEXTS_FILE, JSON.stringify(savedTexts));
    res.json({ success: true });
});

app.get('/saved-texts', (req, res) => {
    res.json(savedTexts);
});

// Főoldal és alkalmazás elérési útvonalak
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.listen(PORT, () => console.log(`✅ Server fut a ${PORT} porton: http://localhost:${PORT}`));
