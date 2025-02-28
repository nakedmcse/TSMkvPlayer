// MKV to MP4 streamer with selectable audio track and subtitle track
import express from 'express';
import * as path from "node:path";
import fs from 'fs';
import { pipeline } from 'stream/promises';
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
    // Redirect to stream of pipe
    try {
        const fileStream = fs.createReadStream('the_pipe_goes_here');
        res.setHeader('Content-Type', 'video/mp4');
        await pipeline(fileStream, res);
    } catch (error) {
        console.error("Stream error:", error);
        res.status(500).send('Error streaming file');
    }
})