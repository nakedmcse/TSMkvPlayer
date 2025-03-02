// MKV to MP4 streamer with selectable audio track and subtitle track
import express from 'express';
import * as path from "node:path";
import fs from 'fs';
import { pipeline } from 'stream/promises';
import { spawn } from 'node:child_process'
import { v4 as uuid } from 'uuid';
import dotenv from "dotenv";

// Environment
dotenv.config({
    path: path.resolve(__dirname, "../", ".env")
})

// Express
const mkvplayerAPI = express();
mkvplayerAPI.set('etag', false);
mkvplayerAPI.use(express.json());

// Bootstrap
mkvplayerAPI.listen(process.env.PORT, () => {
    console.log(`MKVPlayer listening on port ${process.env.PORT}`);
});

// Endpoints
mkvplayerAPI.get('/play/:filename/:audioId/:subtitleId', async (req, res) => {
    const filename = req.params.filename;
    const audioId = parseInt(req.params.audioId, 10);
    const subtitleId = parseInt(req.params.subtitleId, 10);

    // Use ffmpeg to stream to a pipe with the correct audio and subs
    const pipePath = "/tmp/video_" + uuid();
    spawn("mkfifo", [pipePath]);

    // Ensure the pipe exists
    if (!fs.existsSync(pipePath)) {
        console.error("Named pipe does not exist.");
        res.status(500).send('Error streaming file - could not create fifo');
    }
    else {
        // Start FFmpeg writing to the named pipe
        const ffmpeg = spawn("ffmpeg", [
            "-i", `${process.env.BASEPATH}/${filename}`,
            "-c", "copy",
            "-map", "0:v:0",
            "-map", `0:a:${audioId}`,
            "-map", `0:s:${subtitleId}`,
            "-movflags", "+faststart+frag_keyframe+empty_moov",
            "-f", "mp4",
            pipePath
        ]);

        // Redirect to stream of pipe
        try {
            const fileStream = fs.createReadStream('the_pipe_goes_here');
            res.setHeader('Content-Type', 'video/mp4');
            await pipeline(fileStream, res);
        } catch (error) {
            console.error("Stream error:", error);
            res.status(500).send('Error streaming file');
        }
    }
})