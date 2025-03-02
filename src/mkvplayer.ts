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
    const mkfifo = spawn("mkfifo", [pipePath]);
    await new Promise((resolve, reject) => {mkfifo.on("close",resolve)});

    // Ensure the pipe exists
    if (!fs.existsSync(pipePath)) {
        console.error("Named pipe does not exist.");
        res.status(500).send('Error streaming file - could not create fifo');
    }
    else {
        try {
            // Open readstream before write
            const fileStream = fs.createReadStream(pipePath);

            // Start FFmpeg writing to the named pipe
            const ffmpeg = spawn("ffmpeg", [
                "-y",
                "-nostdin",
                "-i", `${process.env.BASEPATH}/${filename}`,
                "-map", "0:v:0",
                "-map", `0:a:${audioId}`,
                "-vf", `subtitles='${process.env.BASEPATH}/${filename}':si=${subtitleId}`,
                "-movflags", "+faststart+empty_moov",
                "-f", "mp4",
                pipePath
            ], { stdio: ["ignore", "ignore", "pipe"] });

            ffmpeg.stderr.on("data", (data) => {
                console.error("FFmpeg error:", data.toString());
            });

            ffmpeg.on("exit", (code) => {
                if (code !== 0) console.error(`FFmpeg exited with code ${code}`);
            });

            res.setHeader('Content-Type', 'video/mp4');
            await pipeline(fileStream, res);
        }
        catch (error) {
            console.error("Stream error:", error);
        }
        finally {
            if (fs.existsSync(pipePath)) fs.unlinkSync(pipePath); // Cleanup
        }
    }
})