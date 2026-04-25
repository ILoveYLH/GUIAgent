"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QrAccessPage() {
  "use no memo";

  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [genError, setGenError] = useState(false);

  useEffect(() => {
    const url = `${window.location.origin}/`;
    setTargetUrl(url);
    setGenError(false);
    void QRCode.toDataURL(url, { width: 220, margin: 2, errorCorrectionLevel: "M" })
      .then((u) => {
        setDataUrl(u);
        setGenError(false);
      })
      .catch(() => {
        setDataUrl(null);
        setGenError(true);
      });
  }, []);

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 bg-slate-50 px-4 py-10">
      <h1 className="text-lg font-semibold text-slate-800">手机访问</h1>
      <p className="max-w-md text-center text-sm text-slate-600">
        在电脑浏览器用局域网地址打开本页（例如{" "}
        <span className="font-mono text-slate-700">http://你的IP:3000/qr</span>
        ），再用手机扫描下方二维码即可打开同一站点。
      </p>
      {dataUrl && targetUrl ? (
        <>
          <div className="rounded-2xl bg-white p-4 shadow-md">
            <img
              src={dataUrl}
              alt={`打开 ${targetUrl}`}
              width={220}
              height={220}
              className="block h-[220px] w-[220px]"
            />
          </div>
          <p className="max-w-[min(100%,320px)] break-all text-center text-xs text-slate-500">
            {targetUrl}
          </p>
        </>
      ) : genError && targetUrl ? (
        <div className="max-w-sm rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
          二维码生成失败。请刷新页面，或按 F12 打开控制台查看报错。
          <p className="mt-2 break-all font-mono text-xs text-amber-800/90">
            {targetUrl}
          </p>
        </div>
      ) : (
        <div
          className="h-[252px] w-[252px] animate-pulse rounded-2xl bg-slate-200"
          aria-hidden
        />
      )}
    </main>
  );
}
