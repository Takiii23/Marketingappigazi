require('dotenv').config();
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
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
    store: new FileStore({ path: "./sessions", retries: 1 }),
    secret: process.env.SESSION_SECRET || 'super_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
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

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Felhasználónév és jelszó megadása szükséges!" });
    }
    if (users[username]) {
        return res.status(400).json({ success: false, message: "A felhasználónév már létezik!" });
    }
    users[username] = password;
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true, message: "Sikeres regisztráció!" });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Felhasználónév és jelszó szükséges!" });
    }
    if (users[username] === password) {
        req.session.user = username;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: "Hibás bejelentkezési adatok!" });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

app.listen(PORT, () => console.log(`✅ Server fut a ${PORT} porton: http://localhost:${PORT}`));
