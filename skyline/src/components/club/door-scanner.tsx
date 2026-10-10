"use client";
import { useRef, useState, useEffect } from "react";
import { ActionForm } from "./action-form";
import { checkInTicket } from "@/server/actions/events";
export function DoorScanner({ eventId }: { eventId: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<{ stop: () => void } | null>(null);
  const alive = useRef(true);
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controls.current?.stop();
    };
  }, []);
  function stop() {
    controls.current?.stop();
    controls.current = null;
    setScanning(false);
  }
  async function start() {
    setError("");
    setScanning(true);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      if (!alive.current || !video.current) return;
      const active = await reader.decodeFromConstraints(
        { video: { facingMode: "environment" }, audio: false },
        video.current,
        (result, _error, scanner) => {
          if (result && alive.current) {
            setCode(result.getText());
            scanner.stop();
            controls.current = null;
            setScanning(false);
          }
        },
      );
      if (!alive.current) active.stop();
      else controls.current = active;
    } catch {
      if (alive.current) {
        setError(
          "Camera unavailable. Allow camera access on HTTPS or localhost, or use the backup code below.",
        );
        setScanning(false);
      }
    }
  }
  return (
    <div>
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        className={`w-full rounded-xl bg-black mb-4 ${scanning ? "" : "hidden"}`}
        aria-label="QR camera preview"
      />
      <div className="flex gap-3 mb-4">
        <button
          className="button secondary"
          type="button"
          onClick={scanning ? stop : start}
        >
          {scanning ? "Stop camera" : "Scan QR with camera"}
        </button>
      </div>
      {error && (
        <p className="form-feedback failure" role="alert">
          {error}
        </p>
      )}
      <ActionForm action={checkInTicket}>
        <input type="hidden" name="eventId" value={eventId} />
        <label className="field">
          <span>Scanned QR or backup code</span>
          <input
            className="input !text-base"
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            maxLength={200}
            required
            placeholder="SKY-… or skyline:…"
          />
        </label>
        <p className="subtext mb-4">
          Selected event only. A scan fills the code; confirm below to record
          entry.
        </p>
        <button className="button w-full">Verify & record entry</button>
      </ActionForm>
    </div>
  );
}
