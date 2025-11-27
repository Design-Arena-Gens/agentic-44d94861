/* eslint-disable react/no-unescaped-entities */
"use client";
import { useEffect, useMemo, useRef, useState } from "react";

const MAX_CHARS = 200000;

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue];
}

export default function HomePage() {
  const [text, setText] = useLocalStorage("ttv:text", "");
  const [lang, setLang] = useLocalStorage("ttv:lang", "pt-BR");
  const [voice, setVoice] = useLocalStorage("ttv:voice", "female");
  const [speed, setSpeed] = useLocalStorage("ttv:speed", 1.0);
  const [bg, setBg] = useLocalStorage("ttv:bg", "#0b0c10");
  const [resolution, setResolution] = useLocalStorage("ttv:res", "1280x720");
  const [title, setTitle] = useLocalStorage("ttv:title", "TextToVideo Converter Pro");

  const [audioUrl, setAudioUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const audioRef = useRef(null);
  const videoRef = useRef(null);

  const charCount = text.length;
  const tooLong = charCount > MAX_CHARS;
  const disabled = tooLong || processing || !text.trim();

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [audioUrl, videoUrl]);

  const [w, h] = useMemo(() => {
    const [rw, rh] = resolution.split("x").map(Number);
    return [rw, rh];
  }, [resolution]);

  async function handleGenerateMp3() {
    setProcessing(true);
    setProgress(5);
    setMessage("Gerando ?udio (MP3)...");
    setVideoUrl(null);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang, voice, speed: Number(speed) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Falha ao gerar MP3");
      }
      setProgress(60);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setMessage("MP3 pronto.");
      setProgress(100);
      setTimeout(() => setProgress(0), 1000);
    } catch (e) {
      setMessage(e.message);
      setProgress(0);
    } finally {
      setProcessing(false);
    }
  }

  async function handleGenerateMp4() {
    if (!audioUrl) {
      setMessage("Gere o MP3 antes do MP4.");
      return;
    }
    setProcessing(true);
    setProgress(10);
    setMessage("Renderizando v?deo (MP4)...");
    try {
      const audioBlob = await (await fetch(audioUrl)).blob();
      const form = new FormData();
      form.append("audio", audioBlob, "audio.mp3");
      form.append("bg", bg);
      form.append("resolution", resolution);
      form.append("title", title);

      const res = await fetch("/api/video", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Falha ao gerar MP4");
      }
      setProgress(80);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setMessage("MP4 pronto.");
      setProgress(100);
      setTimeout(() => setProgress(0), 1000);
    } catch (e) {
      setMessage(e.message);
      setProgress(0);
    } finally {
      setProcessing(false);
    }
  }

  function download(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }

  return (
    <div className="container">
      <header className="header">
        <div className="brand">
          <div style={{ width: 10, height: 10, background: "var(--primary)", borderRadius: 999 }} />
          <strong>TextToVideo Converter Pro</strong>
          <span className="badge">v1.0</span>
        </div>
        <div className="row">
          <button
            className="btn secondary"
            onClick={() => {
              const root = document.documentElement;
              const light = getComputedStyle(root).getPropertyValue("--bg").trim() === "#0b0c10";
              root.style.colorScheme = light ? "light" : "dark";
            }}
          >
            Alternar tema
          </button>
          <a className="btn secondary" href="https://agentic-44d94861.vercel.app" target="_blank" rel="noreferrer">
            Produ??o
          </a>
        </div>
      </header>

      <div className="grid">
        <section className="panel">
          <div className="label">Texto ({charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()})</div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Cole seu texto aqui (at? 200.000 caracteres)..."
          />
          {tooLong && <div className="muted">Texto muito longo. Remova caracteres.</div>}

          <div style={{ height: 12 }} />
          <div className="controls">
            <div>
              <div className="label">Idioma</div>
              <select value={lang} onChange={(e) => setLang(e.target.value)}>
                <option value="pt-BR">Portugu?s (Brasil)</option>
                <option value="en-US">English (US)</option>
                <option value="es-ES">Espa?ol</option>
                <option value="fr-FR">Fran?ais</option>
                <option value="de-DE">Deutsch</option>
              </select>
            </div>
            <div>
              <div className="label">Voz</div>
              <select value={voice} onChange={(e) => setVoice(e.target.value)}>
                <option value="female">Feminina</option>
                <option value="male">Masculina</option>
              </select>
            </div>
            <div>
              <div className="label">Velocidade: {Number(speed).toFixed(2)}x</div>
              <input type="range" min="0.5" max="1.5" step="0.05" value={speed} onChange={(e) => setSpeed(e.target.value)} />
            </div>
            <div>
              <div className="label">Cor de fundo do v?deo</div>
              <input type="text" value={bg} onChange={(e) => setBg(e.target.value)} placeholder="#0b0c10" />
            </div>
            <div>
              <div className="label">Resolu??o</div>
              <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
                <option value="1280x720">HD (1280x720)</option>
                <option value="1920x1080">Full HD (1920x1080)</option>
                <option value="1080x1080">Quadrado (1080x1080)</option>
                <option value="1080x1920">Vertical (1080x1920)</option>
              </select>
            </div>
            <div className="full">
              <div className="label">T?tulo do v?deo (overlay)</div>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="T?tulo opcional" />
            </div>
          </div>

          <div style={{ height: 16 }} />
          <div className="row">
            <button className="btn" disabled={disabled} onClick={handleGenerateMp3}>Gerar MP3</button>
            <button className="btn secondary" disabled={!audioUrl || processing} onClick={() => audioUrl && download(audioUrl, "audio.mp3")}>Baixar MP3</button>
            <button className="btn" disabled={!audioUrl || processing} onClick={handleGenerateMp4}>Gerar MP4</button>
            <button className="btn secondary" disabled={!videoUrl || processing} onClick={() => videoUrl && download(videoUrl, "video.mp4")}>Baixar MP4</button>
          </div>
          <div style={{ height: 8 }} />
          <div className="progress"><span style={{ width: `${progress}%` }} /></div>
          <div className="muted" style={{ marginTop: 8 }}>{message}</div>
        </section>

        <aside className="panel">
          <div className="label">Preview</div>
          <div className="row">
            <div className="panel" style={{ width: "100%" }}>
              <div className="label">?udio (MP3)</div>
              {audioUrl ? (
                <audio ref={audioRef} controls src={audioUrl} style={{ width: "100%" }} />
              ) : (
                <div className="muted">Sem ?udio gerado ainda.</div>
              )}
            </div>
            <div className="panel" style={{ width: "100%" }}>
              <div className="label">V?deo (MP4)</div>
              <div style={{ width: "100%", aspectRatio: `${w} / ${h}`, background: bg, borderRadius: 8, border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {videoUrl ? (
                  <video ref={videoRef} controls src={videoUrl} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (
                  <div className="muted" style={{ textAlign: "center" }}>
                    O v?deo aparecer? aqui ap?s a renderiza??o.
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="footer">
            Renderiza??o otimizada com FFmpeg. Compat?vel com players modernos (H.264 + AAC).
          </div>
        </aside>
      </div>
    </div>
  );
}

