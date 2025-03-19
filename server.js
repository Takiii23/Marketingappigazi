require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 🔹 **PostgreSQL adatbázis kapcsolat**
const pool = new Pool({
    user: "marketing_app_6c9g_user",
    host: "dpg-cv9ll7lds78s73bqdqcg-a.oregon-postgres.render.com",
    database: "marketing_app_6c9g",
    password: "pW4opGynriIX9y8HGHr8cP4GHg3OIxIy",
    port: 5432,
    ssl: {
        rejectUnauthorized: false
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// 📌 **Táblák létrehozása, ha nem léteznek**
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
                text TEXT NOT NULL
            );
        `);
        console.log("✅ Adatbázis inicializálva!");
    } catch (error) {
        console.error("❌ Hiba az adatbázis inicializálásakor:", error);
    }
};

// 📌 **Szerver indítás táblakészítéssel**
(async () => {
    await createTables();
    app.listen(PORT, () => console.log(`✅ Server fut a ${PORT} porton!`));
})();

// **📌 Regisztráció PostgreSQL-ben**
app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Felhasználónév és jelszó szükséges!" });
    }

    try {
        await pool.query("INSERT INTO users (username, password) VALUES ($1, $2)", [username, password]);
        res.json({ success: true, message: "✅ Sikeres regisztráció!" });
    } catch (error) {
        console.error("Regisztrációs hiba:", error);
        res.status(500).json({ error: "Hiba történt a regisztráció során." });
    }
});

// **📌 Bejelentkezés PostgreSQL-ből**
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Felhasználónév és jelszó szükséges!" });
    }

    try {
        const result = await pool.query("SELECT * FROM users WHERE username = $1 AND password = $2", [username, password]);

        if (result.rows.length > 0) {
            res.json({ success: true, message: "✅ Sikeres bejelentkezés!" });
        } else {
            res.json({ success: false, message: "❌ Hibás felhasználónév vagy jelszó!" });
        }
    } catch (error) {
        console.error("Bejelentkezési hiba:", error);
        res.status(500).json({ error: "Hiba történt a bejelentkezés során." });
    }
});

// **📌 AI Szöveg generátor API**
app.post("/generate-text", async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: "Téma szükséges!" });

        const styles = [
            { type: "Komoly", instruction: "Adj egy részletes magyarázatot erről a témáról.", max_tokens: 900 },
            { type: "Fun Fact", instruction: "Mondj egy rövid, meglepő tényt erről a témáról.", max_tokens: 500 },
            { type: "Motiváló", instruction: "Írj egy inspiráló üzenetet erről a témáról.", max_tokens: 600 },
            { type: "Fiatalos", instruction: "Írj egy könnyed, fiatalos szöveget erről a témáról.", max_tokens: 800 },
            { type: "Drámai", instruction: "Írj egy érzelmekkel teli, drámai szöveget erről a témáról.", max_tokens: 650 },
            { type: "Szarkasztikus", instruction: "Adj egy szarkasztikus és ironikus véleményt erről a témáról.", max_tokens: 700 },
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

            return { type: style.type, text: response.data.choices?.[0]?.message?.content || "Hiba történt az AI válaszban." };
        }));

        res.json({ results });
    } catch (error) {
        console.error("AI generálás hiba:", error);
        res.status(500).json({ error: "AI generálási hiba történt." });
    }
});

// **📌 Mentett szövegek kezelése**
app.post("/save-text", async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Szöveg szükséges!" });

    try {
        await pool.query("INSERT INTO saved_texts (text) VALUES ($1)", [text]);
        res.json({ success: true, message: "✅ Szöveg mentve!" });
    } catch (error) {
        console.error("Mentési hiba:", error);
        res.status(500).json({ error: "Hiba történt a mentés során!" });
    }
});

app.get("/saved-texts", async (req, res) => {
    try {
        const result = await pool.query("SELECT text FROM saved_texts");
        res.json(result.rows.map(row => row.text));
    } catch (error) {
        console.error("Mentett szövegek hiba:", error);
        res.status(500).json({ error: "Nem sikerült betölteni a mentett szövegeket." });
    }
});

// **📌 Oldalak kezelése**
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

app.get("/app", (req, res) => {
    res.sendFile(__dirname + "/public/app.html");
});
