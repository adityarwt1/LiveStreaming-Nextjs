// components/LiveStream.js
"use client"
import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const LiveStream = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamKey, setStreamKey] = useState("");
  const [viewers, setViewers] = useState(0);
  const [streamTitle, setStreamTitle] = useState("");
  const [streamDescription, setStreamDescription] = useState("");
  const [streams, setStreams] = useState([]);
  const [selectedStream, setSelectedStream] = useState(null);
  const videoRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io("http://localhost:3001");

    socketRef.current.on("viewerCount", (count) => {
      setViewers(count);
    });

    socketRef.current.on("streamStarted", (streamData) => {
      console.log("Stream started:", streamData);
    });

    socketRef.current.on("streamEnded", (streamId) => {
      console.log("Stream ended:", streamId);
      fetchStreams();
    });

    fetchStreams();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const fetchStreams = async () => {
    try {
      const response = await fetch("/api/streams");
      const data = await response.json();
      setStreams(data);
    } catch (error) {
      console.error("Error fetching streams:", error);
    }
  };

  const generateStreamKey = () => {
    const key =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    setStreamKey(key);
  };

  const startStream = async () => {
    if (!streamTitle || !streamKey) {
      alert("Please enter stream title and generate stream key");
      return;
    }

    try {
      const response = await fetch("/api/streams/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: streamTitle,
          description: streamDescription,
          streamKey: streamKey,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setIsStreaming(true);
        socketRef.current.emit("joinStream", data.streamId);
        fetchStreams();
      }
    } catch (error) {
      console.error("Error starting stream:", error);
    }
  };

  const stopStream = async () => {
    try {
      const response = await fetch("/api/streams/stop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ streamKey }),
      });

      if (response.ok) {
        setIsStreaming(false);
        setViewers(0);
        fetchStreams();
      }
    } catch (error) {
      console.error("Error stopping stream:", error);
    }
  };

  const watchStream = (stream) => {
    setSelectedStream(stream);
    if (videoRef.current) {
      videoRef.current.src = `/api/streams/watch/${stream._id}`;
      videoRef.current.load();
    }
    socketRef.current.emit("joinStream", stream._id);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-8 text-center">
        Live Streaming Platform
      </h1>

      {/* Stream Control Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Stream Controls</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Stream Title
              </label>
              <input
                type="text"
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500"
                placeholder="Enter stream title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Description
              </label>
              <textarea
                value={streamDescription}
                onChange={(e) => setStreamDescription(e.target.value)}
                className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 h-20"
                placeholder="Enter stream description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Stream Key
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={streamKey}
                  readOnly
                  className="flex-1 p-2 bg-gray-700 rounded border border-gray-600"
                  placeholder="Generate stream key"
                />
                <button
                  onClick={generateStreamKey}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
                >
                  Generate
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              {!isStreaming ? (
                <button
                  onClick={startStream}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded font-medium"
                >
                  Start Stream
                </button>
              ) : (
                <button
                  onClick={stopStream}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded font-medium"
                >
                  Stop Stream
                </button>
              )}
            </div>

            {isStreaming && (
              <div className="text-center">
                <p className="text-green-400">🔴 LIVE</p>
                <p className="text-sm text-gray-400">{viewers} viewers</p>
              </div>
            )}
          </div>
        </div>

        {/* OBS Setup Instructions */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">OBS Setup</h2>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium text-blue-400">Server URL:</p>
              <code className="bg-gray-700 p-1 rounded">
                rtmp://localhost:1935/live
              </code>
            </div>
            <div>
              <p className="font-medium text-blue-400">Stream Key:</p>
              <code className="bg-gray-700 p-1 rounded break-all">
                {streamKey || "Generate a stream key first"}
              </code>
            </div>
            <div className="mt-4">
              <p className="font-medium mb-2">Steps:</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-300">
                <li>Open OBS Studio</li>
                <li>Go to Settings → Stream</li>
                <li>Select "Custom..." as Service</li>
                <li>Enter the Server URL above</li>
                <li>Enter your Stream Key</li>
                <li>Click "Start Streaming"</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Video Player */}
      <div className="mb-8">
        <div className="bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-64 md:h-96"
            controls
            autoPlay
            muted
            poster="/api/placeholder/800/400"
          >
            Your browser does not support the video tag.
          </video>
          {selectedStream && (
            <div className="p-4 bg-gray-800">
              <h3 className="font-semibold">{selectedStream.title}</h3>
              <p className="text-sm text-gray-400">
                {selectedStream.description}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Started: {new Date(selectedStream.startTime).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Live Streams List */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Live Streams</h2>
        {streams.length === 0 ? (
          <p className="text-gray-400">No live streams available</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {streams.map((stream) => (
              <div
                key={stream._id}
                className="bg-gray-700 p-4 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors"
                onClick={() => watchStream(stream)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  <span className="text-red-400 text-sm font-medium">LIVE</span>
                </div>
                <h3 className="font-semibold truncate">{stream.title}</h3>
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                  {stream.description}
                </p>
                <div className="mt-2 text-xs text-gray-500">
                  <p>{stream.viewers || 0} viewers</p>
                  <p>Started: {new Date(stream.startTime).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveStream;
