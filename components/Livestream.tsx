"use client";
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
  const [cameraStream, setCameraStream] = useState(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [devices, setDevices] = useState({ cameras: [], microphones: [] });
  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedMicrophone, setSelectedMicrophone] = useState("");

  const videoRef = useRef(null);
  const webcamRef = useRef(null);
  const socketRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

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
    getAvailableDevices();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      stopWebcam();
    };
  }, []);

  const getAvailableDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((device) => device.kind === "videoinput");
      const microphones = devices.filter(
        (device) => device.kind === "audioinput"
      );

      setDevices({ cameras, microphones });

      if (cameras.length > 0) setSelectedCamera(cameras[0].deviceId);
      if (microphones.length > 0)
        setSelectedMicrophone(microphones[0].deviceId);
    } catch (error) {
      console.error("Error getting devices:", error);
    }
  };

  const startWebcam = async () => {
    try {
      const constraints = {
        video: {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: {
          deviceId: selectedMicrophone
            ? { exact: selectedMicrophone }
            : undefined,
          echoCancellation: true,
          noiseSuppression: true,
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      setIsWebcamActive(true);

      if (webcamRef.current) {
        webcamRef.current.srcObject = stream;
      }

      streamRef.current = stream;
    } catch (error) {
      console.error("Error accessing camera:", error);
      alert("Could not access camera. Please check permissions.");
    }
  };

  const stopWebcam = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
      setIsWebcamActive(false);
    }
    if (webcamRef.current) {
      webcamRef.current.srcObject = null;
    }
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  };

  const startRecording = () => {
    if (!cameraStream) return;

    try {
      const recorder = new MediaRecorder(cameraStream, {
        mimeType: "video/webm;codecs=vp9",
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setRecordedChunks((prev) => [...prev, event.data]);
          // Send chunks to server for processing
          sendChunkToServer(event.data);
        }
      };

      recorder.onstop = () => {
        console.log("Recording stopped");
      };

      recorder.start(1000); // Record in 1-second chunks
      setMediaRecorder(recorder);
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setRecordedChunks([]);
    }
  };

  const sendChunkToServer = async (chunk) => {
    if (!streamKey) return;

    const formData = new FormData();
    formData.append("chunk", chunk);
    formData.append("streamKey", streamKey);

    try {
      await fetch("/api/streams/chunk", {
        method: "POST",
        body: formData,
      });
    } catch (error) {
      console.error("Error sending chunk:", error);
    }
  };

  const fetchStreams = async () => {
    try {
      const response = await fetch("/api/streams");
      const data = await response.json();
      setStreams(data.streams);
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

    if (!isWebcamActive) {
      alert("Please start your webcam first");
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
        startRecording();
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
        stopRecording();
        fetchStreams();
      }
    } catch (error) {
      console.error("Error stopping stream:", error);
    }
  };

  const watchStream = (stream) => {
    setSelectedStream(stream);
    if (videoRef.current) {
      videoRef.current.src = `/api/streams/watch?id=${stream._id}`;
      videoRef.current.load();
    }
    socketRef.current.emit("joinStream", stream._id);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-8 text-center">
        Live Streaming Platform
      </h1>

      {/* Camera Setup */}
      <div className="bg-gray-800 p-6 rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">Camera Setup</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Camera</label>
                <select
                  value={selectedCamera}
                  onChange={(e) => setSelectedCamera(e.target.value)}
                  className="w-full p-2 bg-gray-700 rounded border border-gray-600"
                >
                  {devices.cameras.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label || `Camera ${camera.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Microphone
                </label>
                <select
                  value={selectedMicrophone}
                  onChange={(e) => setSelectedMicrophone(e.target.value)}
                  className="w-full p-2 bg-gray-700 rounded border border-gray-600"
                >
                  {devices.microphones.map((mic) => (
                    <option key={mic.deviceId} value={mic.deviceId}>
                      {mic.label || `Microphone ${mic.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                {!isWebcamActive ? (
                  <button
                    onClick={startWebcam}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium"
                  >
                    Start Camera
                  </button>
                ) : (
                  <button
                    onClick={stopWebcam}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded font-medium"
                  >
                    Stop Camera
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="bg-black rounded-lg overflow-hidden">
              <video
                ref={webcamRef}
                className="w-full h-48 object-cover"
                autoPlay
                muted
                playsInline
              />
              <div className="p-2 bg-gray-700 text-center">
                <span
                  className={`text-sm ${
                    isWebcamActive ? "text-green-400" : "text-gray-400"
                  }`}
                >
                  {isWebcamActive ? "🟢 Camera Active" : "⚫ Camera Inactive"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

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
                  disabled={!isWebcamActive}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium"
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
                <p className="text-xs text-gray-500">
                  Recording and streaming...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Stream Setup Instructions */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Quick Setup</h2>
          <div className="space-y-3 text-sm">
            <div className="bg-gray-700 p-3 rounded">
              <p className="font-medium text-blue-400 mb-2">
                Browser Streaming (Current):
              </p>
              <ol className="list-decimal list-inside space-y-1 text-gray-300">
                <li>Select your camera and microphone</li>
                <li>Click "Start Camera" to preview</li>
                <li>Enter stream title and generate key</li>
                <li>Click "Start Stream" to go live</li>
              </ol>
            </div>

            <div className="bg-gray-700 p-3 rounded">
              <p className="font-medium text-blue-400 mb-2">
                OBS Setup (Alternative):
              </p>
              <div className="space-y-2">
                <div>
                  <span className="text-gray-400">Server:</span>
                  <code className="bg-gray-600 px-2 py-1 rounded ml-2">
                    rtmp://localhost:1935/live
                  </code>
                </div>
                <div>
                  <span className="text-gray-400">Key:</span>
                  <code className="bg-gray-600 px-2 py-1 rounded ml-2">
                    {streamKey || "Generate key first"}
                  </code>
                </div>
              </div>
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
