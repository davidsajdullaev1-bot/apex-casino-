const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- ВАЖНОЕ ИЗМЕНЕНИЕ: ИЩЕМ ФАЙЛЫ ВЕЗДЕ ---
app.use(express.static(__dirname)); // Ищет в главной папке
app.use(express.static(path.join(__dirname, 'public'))); // Ищет в папке public
app.use(express.json()); // Вместо body-parser (встроено в Express)

// --- БАЗА ДАННЫХ ---
const db = new sqlite3.Database('./casino.db');
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, balance REAL DEFAULT 0)");
    db.run("CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, userId INTEGER, type TEXT, amount REAL, method TEXT, status TEXT, date TEXT)");
});

// --- API ---
app.post('/api/login', (req, res) => {
    const { username } = req.body;
    if(!username) return res.json({error: 'No name'});
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
        if (row) res.json(row);
        else db.run("INSERT INTO users (username) VALUES (?)", [username], function(err) {
            res.json({ id: this.lastID, username, balance: 0 });
        });
    });
});

app.post('/api/deposit', (req, res) => {
    const { userId, amount, method } = req.body;
    const date = new Date().toLocaleString();
    db.run("INSERT INTO transactions (userId, type, amount, method, status, date) VALUES (?, 'deposit', ?, ?, 'pending', ?)", 
        [userId, amount, method, date], 
        (err) => res.json({ status: 'ok', message: 'Заявка отправлена!' })
    );
});

app.get('/api/admin/transactions', (req, res) => {
    db.all("SELECT * FROM transactions WHERE status = 'pending'", [], (err, rows) => res.json(rows));
});

app.post('/api/admin/approve', (req, res) => {
    const { transactionId, userId, amount } = req.body;
    db.run("UPDATE transactions SET status = 'approved' WHERE id = ?", [transactionId], (err) => {
        db.run("UPDATE users SET balance = balance + ? WHERE id = ?", [amount, userId], (err) => {
            io.emit('balance_update', { userId, added: parseFloat(amount) });
            res.json({ status: 'success' });
        });
    });
});

// --- ИГРА ---
let multiplier = 1.00;
let isRunning = false;
let crashPoint = 0;

function startGame() {
    if (isRunning) return;
    isRunning = true;
    multiplier = 1.00;
    crashPoint = (Math.random() * 4 + 1).toFixed(2);
    io.emit('game_start', {});
    let gameInterval = setInterval(() => {
        if (multiplier >= crashPoint) {
            clearInterval(gameInterval);
            io.emit('crash', { value: multiplier });
            isRunning = false;
            setTimeout(startGame, 4000);
        } else {
            multiplier += 0.01;
            io.emit('tick', { multiplier: multiplier.toFixed(2) });
        }
    }, 60);
}
startGame();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server started on port ${PORT}`));
