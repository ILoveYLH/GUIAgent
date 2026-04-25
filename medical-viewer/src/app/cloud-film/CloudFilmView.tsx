import styles from "./cloud-film.module.css";

function IconClose() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMore() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function IconFilm() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 5v14M11 5v14M15 5v14" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function IconLungScan() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M8.5 10c.8-1.2 2.2-2 3.5-2s2.7.8 3.5 2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <ellipse cx="9" cy="12.5" rx="1.2" ry="2" stroke="currentColor" strokeWidth="1" />
      <ellipse cx="13" cy="12.5" rx="1.2" ry="2" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function HospitalLogo() {
  return (
    <svg width="36" height="36" viewBox="0 0 40 40" aria-hidden>
      <defs>
        <linearGradient id="shield" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <path
        fill="url(#shield)"
        d="M20 2l14 6v10c0 9-6 16-14 20-8-4-14-11-14-20V8l14-6z"
      />
      <text
        x="20"
        y="24"
        textAnchor="middle"
        fill="white"
        fontSize="11"
        fontWeight="700"
        fontFamily="system-ui,sans-serif"
      >
        医
      </text>
    </svg>
  );
}

export default function CloudFilmPage() {
  return (
    <div className={styles.page}>
      <div className={styles.watermark} aria-hidden>
        <svg className={styles.watermarkSvg} preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern
              id="wm"
              width="220"
              height="140"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(-28 110 70)"
            >
              <text
                x="10"
                y="75"
                fill="rgba(30, 58, 95, 0.12)"
                fontSize="15"
                fontWeight="500"
              >
                DEMO 示例患者
              </text>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#wm)" />
        </svg>
      </div>

      <div className={styles.content}>
        {/* Top bar (in-app chrome) */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm shadow-[0_1px_0_rgba(0,0,0,0.06)]">
          <div className="flex h-11 items-center justify-between px-3 text-[#1e3a5f]">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg active:bg-black/5"
              aria-label="关闭"
            >
              <IconClose />
            </button>
            <div className="flex flex-col items-center gap-0.5 text-center">
              <span className="text-[15px] font-semibold tracking-tight">云胶片</span>
              <span className="max-w-[200px] truncate text-[11px] text-[#64748b]">
                cloud.example-hospital.cn
              </span>
            </div>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg active:bg-black/5"
              aria-label="更多"
            >
              <IconMore />
            </button>
          </div>
        </header>

        {/* Hero: patient */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#c5e0f5] via-[#d9ebf9] to-[#e8f2fb] px-4 pb-6 pt-5">
          <div
            className="pointer-events-none absolute -right-6 top-2 h-28 w-28 rounded-2xl bg-white/25 blur-2xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute bottom-0 left-1/4 h-20 w-40 -translate-x-1/2 bg-sky-300/20 blur-3xl"
            aria-hidden
          />

          <div className="relative flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-[#0f2942]">
                张** · 女 · 60 岁
              </h1>
              <p className="mt-2 text-[14px] text-[#3d5a73]">
                出生日期：19**-**-**
              </p>
            </div>
            <div
              className="relative shrink-0 opacity-90"
              aria-hidden
            >
              <svg width="88" height="72" viewBox="0 0 88 72" className="drop-shadow-sm">
                <rect x="28" y="18" width="44" height="38" rx="4" fill="#93c5fd" opacity="0.85" />
                <rect x="32" y="22" width="12" height="10" rx="1" fill="#e0f2fe" />
                <rect x="46" y="22" width="12" height="10" rx="1" fill="#e0f2fe" />
                <rect x="32" y="36" width="12" height="10" rx="1" fill="#e0f2fe" />
                <rect x="46" y="36" width="12" height="10" rx="1" fill="#e0f2fe" />
                <polygon points="50,8 62,18 38,18" fill="#60a5fa" opacity="0.9" />
                <rect x="40" y="52" width="20" height="6" rx="2" fill="#7dd3fc" />
                <text x="62" y="44" fontSize="10" fill="#2563eb" fontWeight="700">
                  AI
                </text>
              </svg>
            </div>
          </div>
        </section>

        {/* Report card */}
        <main className="-mt-3 px-3 pb-28">
          <article className="overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_rgba(15,41,66,0.08)]">
            <div className="border-b border-slate-100 px-4 pb-3 pt-4">
              <div className="flex items-center gap-2">
                <HospitalLogo />
                <span className="text-[15px] font-semibold text-[#1e3a5f]">
                  ****医院
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-[#ede9fe] px-2 py-0.5 text-[12px] font-semibold text-[#6d28d9]">
                  CT
                </span>
                <h2 className="text-[17px] font-bold leading-snug text-[#0f2942]">
                  肺部小结节薄层平扫
                </h2>
              </div>

              <div className="mt-3 space-y-1 text-[13px] text-[#64748b]">
                <p>医技号：ZS********</p>
                <p>检查号：ZS**********</p>
                <p>检查时间：20**/**/** **:**</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 px-4 py-4">
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-xl border border-[#bfdbfe] bg-[#f8fafc] py-3 text-[14px] font-medium text-[#1e40af] active:bg-sky-50"
              >
                <IconFilm />
                胶片
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-xl border border-[#bfdbfe] bg-[#f8fafc] py-3 text-[14px] font-medium text-[#1e40af] active:bg-sky-50"
              >
                <IconLungScan />
                影像
              </button>
            </div>

            <div className="space-y-5 px-4 pb-6">
              <section>
                <h3 className="mb-2 text-[14px] font-semibold text-[#5b7a94]">
                  检查所见
                </h3>
                <div className="text-[14px] leading-[1.75] text-[#334155]">
                  <p>
                    右肺下叶前基底段可见结节灶（im38），大小18*15mm，边缘光滑锐利，两侧膈肌下可见微小结节影（im23等），直径约3-4，两肺少许纤维点条索影，所见各支气管壁通畅，纵膈小淋巴结，胸腔内无积液，甲状腺右前叶低密度结节。
                  </p>
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-[14px] font-semibold text-[#5b7a94]">
                  检查提示
                </h3>
                <div className="text-[14px] leading-[1.75] text-[#334155]">
                  <p>
                    右肺下叶前基底段结节，较24-04-18片增大；两肺少许慢性炎症及陈旧灶；甲状腺右前叶结节，建议超声检查。
                  </p>
                </div>
              </section>
            </div>
          </article>
        </main>

        {/* Browser-like bottom bar (decorative) */}
        <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200/80 bg-white/95 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
          <div className="mx-auto flex max-w-md items-center justify-center gap-10 text-slate-400">
            <span className="text-xl" aria-hidden>
              ‹
            </span>
            <span className="text-xl" aria-hidden>
              ›
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
