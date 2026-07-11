"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function PushManager() {
  const [status, setStatus] = useState<"unsupported" | "off" | "on" | "denied" | "loading">("loading");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    })().catch(() => setStatus("unsupported"));
  }, []);

  async function enable() {
    setStatus("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string
        ),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), platform: navigator.userAgent.slice(0, 100) }),
      });
      setStatus("on");
    } catch {
      setStatus("off");
    }
  }

  async function disable() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setStatus("off");
  }

  if (status === "loading") return <p className="text-sm text-neutral-400">Memeriksa notifikasi…</p>;
  if (status === "unsupported")
    return (
      <p className="text-sm text-amber-600">
        Browser ini belum mendukung push. Di iPhone: install TeamOS ke Home Screen dulu (iOS 16.4+),
        lalu buka dari sana.
      </p>
    );
  if (status === "denied")
    return (
      <p className="text-sm text-red-600">
        Izin notifikasi ditolak — aktifkan lewat pengaturan browser/HP.
      </p>
    );

  return status === "on" ? (
    <div className="flex items-center justify-between text-sm">
      <span className="text-emerald-700">✅ Push aktif di perangkat ini</span>
      <button onClick={disable} className="btn-secondary !px-3 !py-1 text-xs">
        Nonaktifkan
      </button>
    </div>
  ) : (
    <button onClick={enable} className="btn-primary w-full">
      Aktifkan notifikasi di perangkat ini
    </button>
  );
}
