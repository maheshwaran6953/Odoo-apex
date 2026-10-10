"use client";
import { QRCodeSVG } from "qrcode.react";
import { useRef, useState } from "react";
export function TicketQR({ token, code }: { token: string; code: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  function download() {
    const svg = container.current?.querySelector("svg");
    if (!svg) return;
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(svg)], {
        type: "image/svg+xml",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${code}.svg`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="ticket-qr">
      <div ref={container} className="bg-white p-5 rounded-xl w-fit mx-auto">
        <QRCodeSVG
          value={`skyline:${token}`}
          size={220}
          level="M"
          marginSize={4}
          title="Event entry QR code"
        />
      </div>
      <p className="ticket-code text-center mt-4 break-all">{code}</p>
      <p className="subtext text-center mt-2">
        Keep this ticket private. Each code permits one entry.
      </p>
      <div className="flex flex-wrap gap-3 justify-center mt-5 print:hidden">
        <button className="button secondary" onClick={download}>
          Download QR
        </button>
        <button className="button secondary" onClick={() => window.print()}>
          Print ticket
        </button>
        <button
          className="button secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Code copied" : "Copy code"}
        </button>
      </div>
    </div>
  );
}
