import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import os from "os";
import { randomUUID } from "crypto";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import { parseResolution } from "../../../lib/text-utils";

ffmpeg.setFfmpegPath(ffmpegPath);

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");
    const bg = String(formData.get("bg") || "#0b0c10");
    const resolution = String(formData.get("resolution") || "1280x720");
    // const title = String(formData.get("title") || ""); // reserved, optional

    if (!audio || typeof audio.arrayBuffer !== "function") {
      return NextResponse.json({ error: "?udio MP3 n?o enviado." }, { status: 400 });
    }
    const { w, h } = parseResolution(resolution);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vid-"));
    const audioPath = path.join(tmpDir, "in.mp3");
    const outPath = path.join(tmpDir, `out-${randomUUID()}.mp4`);

    const audioBuf = Buffer.from(await audio.arrayBuffer());
    fs.writeFileSync(audioPath, audioBuf);

    // Long color source, trimmed with -shortest to match audio
    const colorSrc = `color=c=${bg}:s=${w}x${h}:r=30:d=36000`;
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(`lavfi:${colorSrc}`)
        .inputOptions(["-f lavfi"])
        .input(audioPath)
        .outputOptions([
          "-shortest",
          "-map 0:v:0",
          "-map 1:a:0",
          "-c:v libx264",
          "-profile:v baseline",
          "-pix_fmt yuv420p",
          "-preset veryfast",
          "-crf 23",
          "-c:a aac",
          "-b:a 192k"
        ])
        .on("error", (err) => reject(err))
        .on("end", resolve)
        .save(outPath);
    });

    const data = fs.readFileSync(outPath);
    // Cleanup later
    setTimeout(() => {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }, 5000);

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="video.mp4"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 });
  }
}

