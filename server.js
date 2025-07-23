require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { Pool } = require("pg");
const axios = require("axios");

const app = express();
const PORT = 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 🔧 Lokális adatbázis (egyszerűsített teszteléshez)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});


app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use(session({
    secret: "my_secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

const createTables = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS saved_texts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                text TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS user_preferences (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                marketing_field TEXT,
                platform TEXT[],
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("✅ Adatbázis inicializálva!");
    } catch (error) {
        console.error("❌ Hiba az adatbázis inicializálásakor:", error);
    }
};

(async () => {
    await createTables();
    app.listen(PORT, () => console.log(`✅ Server fut a ${PORT} porton!`));
})();

app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    try {
        const userResult = await pool.query(
            "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id",
            [username, password]
        );
        req.session.user_id = userResult.rows[0].id;
        res.json({ success: true });
    } catch (err) {
        console.error("Regisztrációs hiba:", err);
        res.status(500).json({ success: false });
    }
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await pool.query(
            "SELECT id FROM users WHERE username = $1 AND password = $2",
            [username, password]
        );
        if (user.rows.length > 0) {
            req.session.user_id = user.rows[0].id;
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    } catch (err) {
        console.error("Bejelentkezési hiba:", err);
        res.status(500).json({ success: false });
    }
});

app.post("/preferences", async (req, res) => {
    const user_id = req.session.user_id;
    const { marketing_field } = req.body;
    if (!user_id) return res.status(401).json({ error: "Unauthorized" });

    try {
        await pool.query(
            `INSERT INTO user_preferences (user_id, marketing_field, platform)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id) DO UPDATE SET marketing_field = EXCLUDED.marketing_field`,
            [user_id, marketing_field, []]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Preferencia mentés hiba:", err);
        res.status(500).json({ success: false });
    }
});

app.post("/platform", async (req, res) => {
    const user_id = req.session.user_id;
    const { platform } = req.body;
    if (!user_id) return res.status(401).json({ error: "Unauthorized" });

    try {
        await pool.query(
            `UPDATE user_preferences SET platform = $1 WHERE user_id = $2`,
            [platform, user_id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Platform mentés hiba:", err);
        res.status(500).json({ success: false });
    }
});

app.post("/generate-text", async (req, res) => {
    const user_id = req.session.user_id;
    const { prompt, customStyle, postDate, platform } = req.body;
    if (!user_id) return res.status(401).json({ error: "Unauthorized" });

    try {
        const prefs = await pool.query("SELECT marketing_field FROM user_preferences WHERE user_id = $1", [user_id]);
        if (!prefs.rows.length) return res.status(400).json({ error: "Nincsenek beállított preferenciák." });

        const { marketing_field } = prefs.rows[0];
        const styles = ["Komoly", "Fun Fact", "Motiváló", "Fiatalos", "Drámai", "Szarkasztikus", "Közösségi Média"];

        const results = await Promise.all(styles.map(async (style) => {
            const platformList = platform && platform.length > 0 ? platform.join(", ") : "Instagram, Facebook";

            let tonePrompt = "";
            switch (style) {
                case "Komoly":
                    tonePrompt = "Írj egy szakmai és informatív stílusú posztot";
                    break;
                case "Fun Fact":
                    tonePrompt = "Írj egy érdekes tényt vagy meglepő információt";
                    break;
                case "Motiváló":
                    tonePrompt = "Írj egy inspiráló, pozitív üzenetet tartalmazó posztot";
                    break;
                case "Fiatalos":
                    tonePrompt = "Írj egy modern, laza, fiatalos hangvételű posztot szlenggel";
                    break;
                case "Drámai":
                    tonePrompt = "Írj egy érzelmeket kiváltó, drámai stílusú posztot";
                    break;
                case "Szarkasztikus":
                    tonePrompt = "Írj egy csípős, szarkasztikus stílusú posztot humorral";
                    break;
                case "Közösségi Média":
                    tonePrompt = "Írj egy trendi, figyelemfelkeltő social media posztot emojikkal és rövid bekezdésekkel";
                    break;
                default:
                    tonePrompt = "Írj egy kreatív posztot";
            }

            const fullPrompt = `${tonePrompt} a(z) ${marketing_field} témában, ${platformList} platformra. Téma: ${prompt}${customStyle ? ` (${customStyle})` : ""}`;

            const response = await axios.post("https://api.openai.com/v1/chat/completions", {
                model: "gpt-3.5-turbo",
                messages: [{ role: "system", content: fullPrompt }],
                max_tokens: 800
            }, {
                headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
            });

            return {
                type: style,
                text: response.data.choices[0].message.content
            };
        }));

        res.json({ success: true, results });
    } catch (err) {
        console.error("Generálási hiba:", err);
        res.status(500).json({ success: false });
    }
});

app.post("/chatbot", async (req, res) => {
    const user_id = req.session.user_id;
    const { message } = req.body;
    if (!user_id) return res.status(401).json({ success: false });

    try {
        const response = await axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: message }],
            max_tokens: 300
        }, {
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
        });

        const reply = response.data.choices[0].message.content;
        res.json({ success: true, reply });
    } catch (err) {
        console.error("Chatbot hiba:", err);
        res.status(500).json({ success: false });
    }
});

app.post("/save-text", async (req, res) => {
    const user_id = req.session.user_id;
    const { text } = req.body;
    if (!user_id) return res.status(401).json({ success: false });

    try {
        await pool.query("INSERT INTO saved_texts (user_id, text) VALUES ($1, $2)", [user_id, text]);
        res.json({ success: true });
    } catch (err) {
        console.error("Szöveg mentési hiba:", err);
        res.status(500).json({ success: false });
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});
