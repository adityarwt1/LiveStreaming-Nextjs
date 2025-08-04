
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const NodeMediaServer = require("node-media-server");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// RTMP Server Configuration
const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: 8000,
    allow_origin: "*",
  },
  relay: {
    ffmpeg: "/usr/local/bin/ffmpeg", // Adjust path as needed
    tasks: [
      {
        app: "live",
        mode: "push",
        edge: "rtmp://127.0.0.1/live",
      },
    ],
  },
};

const nms = new NodeMediaServer(config);

// Create media directory if it doesn't exist
const mediaRoot = path.join(__dirname, "media");
if (!fs.existsSync(mediaRoot)) {
  fs.mkdirSync(mediaRoot, { recursive: true });
}

// RTMP Events
nms.on("preConnect", (id, args) => {
  console.log(
    "[NodeEvent on preConnect]",
    `id=${id} args=${JSON.stringify(args)}`
  );
});

nms.on("postConnect", (id, args) => {
  console.log(
    "[NodeEvent on postConnect]",
    `id=${id} args=${JSON.stringify(args)}`
  );
});

nms.on("doneConnect", (id, args) => {
  console.log(
    "[NodeEvent on doneConnect]",
    `id=${id} args=${JSON.stringify(args)}`
  );
});

nms.on("prePublish", (id, StreamPath, args) => {
  console.log(
    "[NodeEvent on prePublish]",
    `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`
  );

  // Extract stream key from path
  const streamKey = StreamPath.split("/").pop();

  // Validate stream key here (check against database)
  console.log(`Stream key: ${streamKey}`);
});

nms.on("postPublish", (id, StreamPath, args) => {
  console.log(
    "[NodeEvent on postPublish]",
    `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`
  );

  const streamKey = StreamPath.split("/").pop();

  // Notify all clients that stream started
  io.emit("streamStarted", { streamKey, streamPath: StreamPath });
});

nms.on("donePublish", (id, StreamPath, args) => {
  console.log(
    "[NodeEvent on donePublish]",
    `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`
  );

  const streamKey = StreamPath.split("/").pop();

  // Notify all clients that stream ended
  io.emit("streamEnded", streamKey);
});

// WebSocket connections
const streamRooms = new Map();

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("joinStream", (streamId) => {
    socket.join(streamId);

    // Update viewer count
    const roomSize = io.sockets.adapter.rooms.get(streamId)?.size || 0;
    io.to(streamId).emit("viewerCount", roomSize);

    console.log(
      `Client ${socket.id} joined stream ${streamId}. Viewers: ${roomSize}`
    );
  });

  socket.on("leaveStream", (streamId) => {
    socket.leave(streamId);

    // Update viewer count
    const roomSize = io.sockets.adapter.rooms.get(streamId)?.size || 0;
    io.to(streamId).emit("viewerCount", roomSize);

    console.log(
      `Client ${socket.id} left stream ${streamId}. Viewers: ${roomSize}`
    );
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Start servers
nms.run();
server.listen(3001, () => {
  console.log("WebSocket server running on port 3001");
});

console.log("RTMP Server running on port 1935");
console.log("HTTP Server running on port 8000");