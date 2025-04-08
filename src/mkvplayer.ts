// MKV to MP4 streamer with selectable audio track and subtitle track
import express from 'express';
import * as path from "node:path";
import fs from 'node:fs/promises';
import { pipeline } from 'stream/promises';
import { spawn } from 'node:child_process'
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
mkvplayerAPI.get('/playsubs/:filename/:subtitleId', async (req, res) => {
    const filename = req.params.filename;
    const subtitleId = parseInt(req.params.subtitleId, 10);

    try {
        const ffpromise = new Promise<string>((resolve, reject)  => {
            let output = '';
            const ffmpeg = spawn("ffmpeg", [
                "-y",
                "-nostdin",
                "-i", `${process.env.BASEPATH}/${filename}`,
                "-map", `0:s:${subtitleId}`,
                "-f", "webvtt",
                "-"
            ]);

            ffmpeg.stdout.on('data', (data) => {
                output += data.toString();
            });

            ffmpeg.on('close', (code) => {
                if (code !== 0) {
                    reject(code?.toString());
                }
                resolve(output.trim());
            });
        });

        res.setHeader("Content-Type", "text/vtt");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.send(await ffpromise);
    }
    catch (error) {
        console.error("Subtitle stream error:", error);
    }
})

mkvplayerAPI.get('/playvideo/:filename/:audioId', async (req, res) => {
    const filename = req.params.filename;
    const audioId = parseInt(req.params.audioId, 10);

    try {
        // Start FFmpeg writing to the named pipe
        const ffmpeg = spawn("ffmpeg", [
            "-y",
            "-nostdin",
            "-i", `${process.env.BASEPATH}/${filename}`,
            "-map", "0:v:0",
            "-map", `0:a:${audioId}`,
            "-c:v", "copy",
            "-movflags", "+frag_keyframe+empty_moov+default_base_moof",
            "-frag_duration", "8000000",
            "-f", "mp4",
            "pipe:1"
        ]);

        ffmpeg.on("exit", (code) => {
            if (code !== 0) console.error(`FFmpeg exited with code ${code}`);
        });

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader("Access-Control-Allow-Origin", "*");
        await pipeline(ffmpeg.stdout, res);
    } catch (error) {
            console.error("Stream error:", error);
    }
})

mkvplayerAPI.get('/play/:filename/:audioId/:subtitleId', async (req, res) => {
    const filename = req.params.filename;
    const audioId = req.params.audioId;
    const subtitleId = req.params.subtitleId;

    const page = await fs.readFile('src/videoPlayer.html', 'utf8');
    res.send(page.replace('[filename]',filename).replace('[filename]',filename).replace('[subsId]',subtitleId).replace('[audioId]',audioId));
})