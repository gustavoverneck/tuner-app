import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function getNoteFromFrequency(freq: number) {
  const A4 = 440;
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const n = Math.round(12 * Math.log2(freq / A4)) + 57; // 57 = nota A4 (440 Hz)
  const note = noteNames[n % 12];
  const octave = Math.floor(n / 12);
  return `${note}${octave}`;
}


export default function App() {
  const [frequency, setFrequency] = useState<number | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((allDevices) => {
      const audioInputs = allDevices.filter((d) => d.kind === "audioinput");
      setDevices(audioInputs);
      if (audioInputs.length > 0) setSelectedDeviceId(audioInputs[0].deviceId);
    });
  }, []);

  const [volume, setVolume] = useState(0);
  useEffect(() => {
    if (!selectedDeviceId) return;
    let stream: MediaStream | null = null;
    const startTuner = async () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: selectedDeviceId } });
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 2048;

      source.connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);

      const detectPitch = async () => {
        analyser.getFloatTimeDomainData(buffer);
        // Calcular volume RMS
        let rms = 0;
        for (let i = 0; i < buffer.length; i++) {
          rms += buffer[i] * buffer[i];
        }
        rms = Math.sqrt(rms / buffer.length);
        setVolume(rms);

        const pitch = await invoke<number | null>("detect_pitch", {
          buffer: Array.from(buffer),
          sampleRate: audioContextRef.current!.sampleRate,
        });
        setFrequency(pitch);
        requestAnimationFrame(detectPitch);
      };

      detectPitch();
    };

    startTuner();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [selectedDeviceId]);

  // Cálculo de desafinação
  const note = frequency ? getNoteFromFrequency(frequency) : "";
  const isDetecting = frequency === null;
  // Frequências das notas para desafinação
  const noteFreqs = [
    261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.00, 415.30, 440.00, 466.16, 493.88
  ];
  let detune = 0;
  let detuneLabel = "";
  let idealFreq = 0;
  let n = 0;
  let detuneCents = 0;
  if (frequency) {
    const A4 = 440;
    n = Math.round(12 * Math.log2(frequency / A4)) + 57;
    idealFreq = A4 * Math.pow(2, (n - 57) / 12);
    detune = frequency - idealFreq;
    detuneCents = 1200 * Math.log2(frequency / idealFreq);
    // Mostra se está acima ou abaixo
    if (Math.abs(detune) < 0.5) detuneLabel = "Afinado";
    else if (detune > 0) detuneLabel = "+" + detune.toFixed(1) + " Hz (acima)";
    else detuneLabel = detune.toFixed(1) + " Hz (abaixo)";
  }

  // Para barra visual: -50 a +50 cents
  const detuneCentsClamped = Math.max(-50, Math.min(50, detuneCents)); // Clamp detuneCents
  const detuneBarRef = useRef<HTMLDivElement>(null);
  let detunePx = 0;
  if (detuneBarRef.current) {
    const barWidth = detuneBarRef.current.offsetWidth;
    detunePx = ((detuneCentsClamped + 50) / 100) * barWidth;
  }
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="tuner-card" style={{ width: "calc(100vw - 40px)", height: "calc(100vh - 40px)", maxWidth: "100vw", maxHeight: "100vh", margin: "20px", boxSizing: "border-box" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold", color: "#7c3aed", marginBottom: "1.5rem" }}>Afinador</h1>
        <div style={{ marginBottom: "1.2rem", width: "100%", textAlign: "center" }}>
          <select
            id="device-select"
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            style={{
              borderRadius: "8px",
              padding: "0.5rem",
              border: "1px solid #a78bfa",
              width: "220px",
              fontSize: "1rem",
              height: "2.5rem",
              boxSizing: "border-box"
            }}
          >
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microfone ${device.deviceId}`}
              </option>
            ))}
          </select>
        </div>
        <div style={{ position: "relative", width: "180px", height: "180px", minWidth: "180px", minHeight: "180px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Efeito de barras radiais animadas */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              zIndex: 0,
              pointerEvents: "none"
            }}
          >
            <svg width="180" height="180" style={{ position: "absolute", left: 0, top: 0, width: "180px", height: "180px", pointerEvents: "none" }}>
              {Array.from({ length: 32 }).map((_, i) => {
                const angle = (i / 32) * 2 * Math.PI;
                const center = 90;
                const baseRadius = 60;
                const barLength = Math.min(60, volume * 120);
                const x1 = center + baseRadius * Math.cos(angle);
                const y1 = center + baseRadius * Math.sin(angle);
                const x2 = center + (baseRadius + barLength) * Math.cos(angle);
                const y2 = center + (baseRadius + barLength) * Math.sin(angle);
                return (
                  <line
                    key={"bar-" + i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#a78bfa"
                    strokeWidth={2}
                    opacity={0.5 + 0.5 * Math.min(1, volume)}
                    style={{ transition: "x2 0.2s, y2 0.2s, opacity 0.2s" }}
                  />
                );
              })}
            </svg>
          </div>
          <div className="note-circle" style={{ width: "120px", height: "120px", minWidth: "120px", minHeight: "120px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
            <span className="note-text" style={{ fontSize: "3rem", minWidth: "80px", textAlign: "center", display: "inline-block" }}>{note}</span>
          </div>
        </div>
        <div className="freq-text" style={{ minHeight: "2.2rem", fontSize: "1.5rem", width: "100%", textAlign: "center" }}>
          {isDetecting ? <span style={{ opacity: 0 }}>0000.00 Hz</span> : `${frequency.toFixed(2)} Hz`}
        </div>
        <div className="detune-label" style={{ minHeight: "1.5rem", width: "100%", textAlign: "center" }}>{!isDetecting && detuneLabel}</div>
        <div
          className="detune-bar"
          ref={detuneBarRef}
          style={{ position: "relative", marginBottom: "1.2rem", width: "100%", minHeight: "18px" }}
        >
          {/* Linha central de referência */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "47.5%",
              height: "18px",
              width: "10px",
              background: "#a78bfa",
              opacity: 0.5,
              zIndex: 1
            }}
          />
          {/* Indicador de desafinação */}
          <div
            className="detune-indicator"
            style={{
              position: "absolute",
              top: 0,
              left: detuneBarRef.current ? `${detunePx}px` : "50%",
              height: "18px",
              width: "2px",
              background: "#f472b6",
              transition: "left 0.2s",
              zIndex: 2
            }}
          />
        </div>
      </div>
    </div>
  );
}