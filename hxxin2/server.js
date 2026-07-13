const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

/* =========================
   PORT (중요: 배포용 필수)
========================= */
const PORT = process.env.PORT || 3000;

/* =========================
   Socket.IO (배포 안전 설정)
========================= */
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

/* =========================
   Static files (프론트)
========================= */
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   room별 접속자 store
   { roomId: { socketId: name, ... }, ... }
========================= */
let rooms = {};

/* =========================
   Socket logic
========================= */
io.on("connection", (socket) => {

    console.log("user connected:", socket.id);

    // name, roomId 둘 다 받음 (roomId는 클라이언트가 암호로부터 생성)
    socket.on("set nickname", ({ name, roomId }) => {

        if (!roomId) return; // 방 ID 없으면 무시

        socket.join(roomId);

        // 이 소켓이 어느 방/이름인지 기억
        socket.data.roomId = roomId;
        socket.data.name = name;

        if (!rooms[roomId]) rooms[roomId] = {};
        rooms[roomId][socket.id] = name;

        // 같은 방(=같은 암호)에게만 접속자 목록 전송
        io.to(roomId).emit("user list", Object.values(rooms[roomId]));
    });

    socket.on("chat message", (data) => {

        const roomId = socket.data.roomId;

        if (!roomId) return; // 아직 입장 안 한 소켓이면 무시

        // 같은 방에만 메시지 브로드캐스트
        io.to(roomId).emit("chat message", data);
    });

    socket.on("disconnect", () => {

        const roomId = socket.data.roomId;

        if (roomId && rooms[roomId]) {
            delete rooms[roomId][socket.id];

            io.to(roomId).emit("user list", Object.values(rooms[roomId]));

            // 방에 아무도 없으면 정리
            if (Object.keys(rooms[roomId]).length === 0) {
                delete rooms[roomId];
            }
        }

        console.log("user disconnected:", socket.id);
    });
});

/* =========================
   server start (중요 수정)
========================= */
server.listen(PORT, () => {
    console.log("server running on port", PORT);
});