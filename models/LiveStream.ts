import mongoose from "mongoose";

const StreamSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    streamKey: {
      type: String,
      required: true,
      unique: true,
    },
    isLive: {
      type: Boolean,
      default: false,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    viewers: {
      type: Number,
      default: 0,
    },
    streamerIp: String,
    thumbnailUrl: String,
  },
  {
    timestamps: true,
  }
);


const Stream = mongoose.models.Stream || mongoose.model("Stream",StreamSchema)

export default Stream;