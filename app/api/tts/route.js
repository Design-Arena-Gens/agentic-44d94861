import { NextResponse } from "next/server";
import { getAudioUrl as googleGetAudioUrl } from "google-tts-api";
import { splitTextForTTS } from "../../../lib/text-utils";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import os from "os";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";

ffmpeg.setFfmpegPath(ffmpegPath);

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { text, lang = "pt-BR", speed = 1.0 } = await request.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Texto inv?lido." }, { status: 400 });
    }
    const trimmed = text.trim();
    if (!trimmed) return NextResponse.json({ error: "Texto vazio." }, { status: 400 });
    if (trimmed.length > 200000) {
      return NextResponse.json({ error: "Limite: 200.000 caracteres." }, { status: 400 });
    }
    const safeSpeed = Math.min(1.5, Math.max(0.5, Number(speed) || 1.0));
    const chunks = splitTextForTTS(trimmed, 200);
    if (chunks.length === 0) {
      return NextResponse.json({ error: "Nada para sintetizar." }, { status: 400 });
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tts-"));
    const audioFiles = [];

    // Simple concurrency limiter
    const concurrency = 6;
    let index = 0;
    async function worker() {
      while (index < chunks.length) {
        const myIndex = index++;
        const part = chunks[myIndex];
        const url = googleGetAudioUrl(part, { lang, slow: false, host: "https://translate.google.com" });
        const res = await fetch(url);
        if (!res.ok) throw new Error("Falha ao baixar segmento TTS");
        const buf = Buffer.from(await res.arrayBuffer());
        const filePath = path.join(tmpDir, `part-${String(myIndex).padStart(5, "0")}.mp3`);
        fs.writeFileSync(filePath, buf);
        audioFiles[myIndex] = filePath;
      }
    }
    const workers = Array.from({ length: Math.min(concurrency, chunks.length) }, () => worker());
    await Promise.all(workers);

    // Build concat list file
    const listPath = path.join(tmpDir, "concat.txt");
    const listBody = audioFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n");
    fs.writeFileSync(listPath, listBody);

    const outPath = path.join(tmpDir, `out-${randomUUID()}.mp3`);
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(["-f concat", "-safe 0"])
        .audioFilter(`atempo=${safeSpeed}`)
        .outputOptions(["-c:a libmp3lame", "-b:a 192k"])
        .on("error", (err) => reject(err))
        .on("end", resolve)
        .save(outPath);
    });

    const data = fs.readFileSync(outPath);
    // Cleanup asynchronously
    setTimeout(() => {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }, 5000);

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'attachment; filename="audio.mp3"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 });
  }
}

