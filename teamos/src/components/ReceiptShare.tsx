"use client";

import { useState } from "react";

type Props =
  | {
      mode: "receipt";
      profileId: string;
      ym: string;
      phone: string | null;
      maskedText: string;
      fullText: string;
    }
  | {
      mode: "copy-account";
      accountText: string;
      unconfirmed: boolean;
    };

export default function ReceiptShare(props: Props) {
  const [copied, setCopied] = useState(false);
  const [includeFull, setIncludeFull] = useState(false); // masked by default — WA gets forwarded

  if (props.mode === "copy-account") {
    return (
      <span className="flex items-center gap-1 text-xs">
        <span className="font-mono">{props.accountText}</span>
        {props.unconfirmed && <span title="Diinput admin, belum dikonfirmasi karyawan">🟡</span>}
        <button
          className="btn-secondary !px-2 !py-0.5"
          onClick={async () => {
            await navigator.clipboard.writeText(props.accountText);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "✓" : "copy"}
        </button>
      </span>
    );
  }

  const text = includeFull ? props.fullText : props.maskedText;

  async function logExport() {
    fetch("/api/wages/log-export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile_id: props.mode === "receipt" ? props.profileId : "", ym: props.mode === "receipt" ? props.ym : "", masked: !includeFull }),
    }).catch(() => {});
  }

  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      {props.phone ? (
        <a
          className="btn-primary !px-2 !py-1"
          href={`https://wa.me/${props.phone}?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          onClick={logExport}
        >
          WA
        </a>
      ) : (
        <span className="text-neutral-400" title="Nomor WA belum diisi">
          WA —
        </span>
      )}
      <button
        className="btn-secondary !px-2 !py-1"
        onClick={async () => {
          if (navigator.share) {
            await navigator.share({ text }).catch(() => {});
          } else {
            await navigator.clipboard.writeText(text);
          }
          logExport();
        }}
      >
        Share
      </button>
      <button
        className="btn-secondary !px-2 !py-1"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          logExport();
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "✓" : "Copy"}
      </button>
      <label className="flex items-center gap-1 text-neutral-400" title="Default: nomor rekening dimask">
        <input type="checkbox" checked={includeFull} onChange={(e) => setIncludeFull(e.target.checked)} />
        no. penuh
      </label>
    </div>
  );
}
