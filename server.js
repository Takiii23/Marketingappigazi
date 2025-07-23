const express = require("express");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const SQLiteStore = require("connect-sqlite3")(session);
const path = require("path");
const { OpenAI } = require("openai");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// SESSION SETUP
app.use(
    session({
        store: new SQLiteStore({ db: "sessions.sqlite" }),
        secret: "secret-key",
        resave: false,
        saveUninitialized: true,
    })
);

// STATIC FILES & PARSER
app.use(express.static("public"));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// VIEW ENGINE
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// DATABASE INIT
const db = new sqlite3.Database("users.db", (err) => {
    if (err) {
        console.error("DB error:", err.message);
    } else {
        console.log("DB connected.");
    }
});

// CREATE TABLES IF NOT EXISTS
db.serialize(() => {
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      field TEXT,
      platform TEXT
    )
  `);
    db.run(`
    CREATE TABLE IF NOT EXISTS saved_texts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// OPENAI INIT
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// AUTH ROUTES
app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", (req, res) => {
    const { email, password } = req.body;
    db.run(
        "INSERT INTO users (email, password) VALUES (?, ?)",
        [email, password],
        function (err) {
            if (err) {
                console.error(err.message);
                return res.status(400).send("Registration failed.");
            }
            req.session.userId = this.lastID;
            res.redirect("/setup");
        }
    );
});

app.get("/setup", (req, res) => {
    if (!req.session.userId) return res.redirect("/login");
    res.render("setup");
});

app.post("/setup", (req, res) => {
    const { field, platform } = req.body;
    db.run(
        "UPDATE users SET field = ?, platform = ? WHERE id = ?",
        [field, platform, req.session.userId],
        function (err) {
            if (err) {
                console.error(err.message);
                return res.status(500).send("Setup failed.");
            }
            res.redirect("/");
        }
    );
});

app.post("/login", (req, res) => {
    const { email, password } = req.body;
    db.get(
        "SELECT * FROM users WHERE email = ? AND password = ?",
        [email, password],
        (err, user) => {
            if (err || !user) {
                return res.status(401).send("Login failed.");
            }
            req.session.userId = user.id;
            res.redirect("/");
        }
    );
});

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/login");
});

// HOME
app.get("/", (req, res) => {
    if (!req.session.userId) return res.redirect("/login");
    res.render("index");
});

// TEXT GENERATION
app.post("/generate", async (req, res) => {
    const { style, inputText } = req.body;
    if (!req.session.userId) return res.status(401).send("Not logged in");

    let prompt = "";

    switch (style) {
        case "komoly":
            prompt = `Írj egy komoly marketing szöveget erről: ${inputText}`;
            break;
        case "funfact":
            prompt = `Írj egy érdekes fun fact stílusú marketing szöveget erről: ${inputText}`;
            break;
        case "motiváló":
            prompt = `Írj egy motiváló marketing szöveget erről: ${inputText}`;
            break;
        case "fiatalos":
            prompt = `Írj egy fiatalos, trendi stílusú marketing szöveget erről: ${inputText}`;
            break;
        case "drámai":
            prompt = `Írj egy drámai hangvételű marketing szöveget erről: ${inputText}`;
            break;
        case "szarkasztikus":
            prompt = `Írj egy szarkasztikus marketing szöveget erről: ${inputText}`;
            break;
        case "social":
            prompt = `Írj egy közösségi médiára való marketing szöveget erről: ${inputText}`;
            break;
        default:
            prompt = `Írj egy marketing szöveget erről: ${inputText}`;
            break;
    }

    try {
        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "gpt-3.5-turbo",
        });

        const generatedText = completion.choices[0].message.content;
        res.send({ generatedText });
    } catch (error) {
        console.error("OpenAI error:", error);
        res.status(500).send("Error generating text.");
    }
});

// CHATBOT ENDPOINT
app.post("/chat", async (req, res) => {
    const { message } = req.body;
    try {
        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: message }],
            model: "gpt-3.5-turbo",
        });
        res.json({ reply: completion.choices[0].message.content });
    } catch (error) {
        console.error("Chatbot error:", error);
        res.status(500).send("Chatbot error.");
    }
});

// SAVE TEXT
app.post("/save", (req, res) => {
    const { content } = req.body;
    if (!req.session.userId) return res.status(401).send("Unauthorized");

    db.run(
        "INSERT INTO saved_texts (user_id, content) VALUES (?, ?)",
        [req.session.userId, content],
        (err) => {
            if (err) {
                console.error("Save error:", err.message);
                return res.status(500).send("Save failed.");
            }
            res.send("Saved successfully.");
        }
    );
});

// LOAD SAVED TEXTS
app.get("/saved", (req, res) => {
    if (!req.session.userId) return res.status(401).send("Unauthorized");

    db.all(
        "SELECT * FROM saved_texts WHERE user_id = ? ORDER BY created_at DESC",
        [req.session.userId],
        (err, rows) => {
            if (err) {
                console.error("Load error:", err.message);
                return res.status(500).send("Load failed.");
            }
            res.json(rows);
        }
    );
});

// START SERVER
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
