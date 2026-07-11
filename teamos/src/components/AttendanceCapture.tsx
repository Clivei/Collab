"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Phase = "idle" | "locating" | "camera" | "submitting" | "done" | "rejected" | "error";

export default function AttendanceCapture({ kind, radius }: { kind: "in" | "out"; radius: number }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string>("");
  const [position, setPosition] = useState<GeolocationPosition | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  async function start() {
    setPhase("locating");
    setMessage("Mengambil lokasi GPS…");
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        })
      );
      setPosition(pos);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      setPhase("camera");
      setMessage("");
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch (err) {
      setPhase("error");
      setMessage(
        "Gagal mengakses lokasi/kamera. Pastikan izin lokasi & kamera diaktifkan. " + String(err)
      );
    }
  }

  async function captureAndSubmit() {
    if (!videoRef.current || !position) return;
    setPhase("submitting");
    setMessage("Mengirim…");

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 480 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.7)
    );

    // Honest browser-level spoof heuristics (PRD v1.1) — raw signals, scored server-side.
    const signals = {
      webdriver: (navigator as Navigator & { webdriver?: boolean }).webdriver === true,
      accuracy: position.coords.accuracy,
      tz_offset_min: new Date().getTimezoneOffset(),
      touch: "ontouchstart" in window,
      platform: navigator.platform ?? "",
      ua: navigator.userAgent.slice(0, 160),
    };

    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("lat", String(position.coords.latitude));
    fd.set("lng", String(position.coords.longitude));
    fd.set("accuracy", String(position.coords.accuracy));
    fd.set("signals", JSON.stringify(signals));
    if (blob) fd.set("selfie", blob, "selfie.jpg");

    const res = await fetch("/api/attendance/clock", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setPhase("done");
      setMessage(
        `✅ Absen ${kind === "in" ? "masuk" : "pulang"} tercatat (${Math.round(data.distance)} m dari kantor)${data.late ? " — kamu tercatat telat" : ""}.`
      );
      router.refresh();
    } else if (res.status === 422) {
      setPhase("rejected");
      setMessage(
        `🚫 Ditolak: kamu ${Math.round(data.distance)} m dari kantor (maks ${radius} m). Percobaan ini dicatat.`
      );
    } else {
      setPhase("error");
      setMessage(data.error || "Terjadi kesalahan. Coba lagi.");
    }
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">{kind === "in" ? "Absen masuk" : "Absen pulang"}</h2>

      {phase === "camera" && (
        <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg bg-black" />
      )}

      {message && (
        <p
          className={`text-sm ${
            phase === "rejected" || phase === "error"
              ? "text-red-600"
              : phase === "done"
                ? "text-emerald-700"
                : "text-neutral-500"
          }`}
        >
          {message}
        </p>
      )}

      {phase === "idle" || phase === "error" || phase === "rejected" ? (
        <button className="btn-primary w-full" onClick={start}>
          📍 Mulai — ambil lokasi & selfie
        </button>
      ) : phase === "camera" ? (
        <button className="btn-primary w-full" onClick={captureAndSubmit}>
          📸 Ambil selfie & kirim
        </button>
      ) : null}
    </div>
  );
}
