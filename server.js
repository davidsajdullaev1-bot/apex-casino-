const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Раздаем статические файлы из папки public
app.use(express.static(path.join(__dirname, 'public')));

// Игровая логика
let multiplier = 1.00;
let isRunning = false;
let crashPoint = 0;

function startGame() {
    if (isRunning) return;
    isRunning = true;
    multiplier = 1.00;
    crashPoint = (Math.random() * 5 + 1).toFixed(2); // Краш от 1 до 6x

    io.emit('game_start', { message: 'Взлет!' });

    let gameInterval = setInterval(() => {
        if (multiplier >= crashPoint) {
            clearInterval(gameInterval);
            io.emit('crash', { value: multiplier.toFixed(2) });
            isRunning = false;
            setTimeout(startGame, 4000); // Пауза 4 сек
        } else {
            multiplier += 0.01;
            io.emit('tick', { multiplier: multiplier.toFixed(2) });
        }
    }, 60); // Скорость обновления
}

// Запуск игры при старте сервера
startGame();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Apex Server running on port ${PORT}`));
