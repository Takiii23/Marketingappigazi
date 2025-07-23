const express = require("express");
const bodyParser = require("body-parser");
const { Configuration, OpenAIApi } = require("openai");
const session = require("express-session");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(
    session({
        secret: "titkoskulcs",
        resave: false,
        saveUninitialized: false,
    })
);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

app.set("view engine", "ejs");

// Regisztrációs oldal
app.get("/register", (req, res) => {
    res.render("register");
});

// Regisztrációs kérelem
app.post("/register", async (req, res) => {
    const { username, password, marketingField, platform } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        await pool.query(
            "INSERT INTO users (username, password, marketing_field, platform) VALUES ($1, $2, $3, $4)",
            [username, hashedPassword, marketingField, platform]
        );
        res.redirect("/login");
    } catch (err) {
        console.error("Hiba a regisztráció során:", err);
        res.send("Hiba történt.");
    }
});

// Bejelentkezési oldal
app.get("/login", (req, res) => {
    res.render("login");
});

// Bejelentkezési kérelem
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                req.session.user = user;
                return res.redirect("/generate");
            }
        }
        res.send("Hibás felhasználónév vagy jelszó.");
    } catch (err) {
        console.error("Hiba a bejelentkezés során:", err);
        res.send("Hiba történt.");
    }
});

// Szöveg generáló oldal
app.get("/generate", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }
    res.render("generate", {
        username: req.session.user.username,
        marketingField: req.session.user.marketing_field,
        platform: req.session.user.platform,
    });
});

// Generálás kérelem
app.post("/generate", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).send("Nincs bejelentkezve.");
    }

    const { prompt, style } = req.body;
    const user = req.session.user;

    let fullPrompt = `Kérlek, írj egy rövid, max 200 karakteres ${style} stílusú marketing szöveget az alábbiak alapján:\n\n`;
    fullPrompt += `Téma: ${user.marketing_field}\n`;
    fullPrompt += `Platform: ${user.platform}\n`;
    fullPrompt += `Felhasználó által megadott szöveg: ${prompt}\n\n`;

    switch (style) {
        case "komoly":
            fullPrompt += "A hangnem legyen professzionális és informatív.";
            break;
        case "fun_fact":
            fullPrompt += "Adj meg egy érdekes tényt a témáról és írj hozzá egy szórakoztató marketing szöveget.";
            break;
        case "motiváló":
            fullPrompt += "Írj egy inspiráló és bátorító hangvételű szöveget.";
            break;
        case "fiatalos":
            fullPrompt += "Használj fiatalos, trendi nyelvezetet.";
            break;
        case "drámai":
            fullPrompt += "Legyen hatásos, figyelemfelkeltő, drámai.";
            break;
        case "szarkasztikus":
            fullPrompt += "Írj egy enyhén szarkasztikus, de mégis marketing célú szöveget.";
            break;
        case "social":
            fullPrompt += "Formázd úgy a választ, hogy egy Instagram posztnak megfeleljen (hashtagekkel).";
            break;
        default:
            fullPrompt += "Legyen figyelemfelkeltő, tömör és kreatív.";
    }

    try {
        const completion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: fullPrompt }],
        });

        const generatedText = completion.data.choices[0].message.content.trim();
        new Date().toISOString();
        res.json({ text: generatedText });
    } catch (error) {
        console.error("Hiba a szöveg generálásakor:", error?.response?.data || error.message);
        res.status(500).send("Hiba történt a generálás során.");
    }
});

// Kijelentkezés
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/login");
});

app.listen(port, () => {
    console.log(`Szerver fut a következő porton: ${port}`);
});
