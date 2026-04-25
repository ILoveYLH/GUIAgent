import Link from "next/link";
import FilmViewer from "@/components/film/FilmViewer";
import styles from "@/app/cloud-film/cloud-film.module.css";

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

function FieldGrid({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
      {items.map((row) => (
        <div key={row.label} className="min-w-0">
          <div className="text-[13px] font-medium text-[#2563eb]">{row.label}</div>
          <div className="mt-0.5 text-[14px] text-[#334155]">{row.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function CloudFilmView() {
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
        <div className="mx-auto w-full max-w-md lg:max-w-6xl lg:px-6">
          <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm shadow-[0_1px_0_rgba(0,0,0,0.06)]">
            <div className="grid h-11 grid-cols-[2.5rem_1fr_2.5rem] items-center px-2 text-[#1e3a5f] lg:flex lg:h-12 lg:justify-between lg:px-0">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-lg active:bg-black/5 lg:hidden"
                aria-label="关闭"
              >
                <IconClose />
              </button>
              <div className="flex min-w-0 flex-col items-center gap-0.5 text-center lg:order-first lg:items-start lg:text-left">
                <span className="text-[15px] font-semibold tracking-tight lg:text-[16px]">
                  云胶片
                </span>
                <span className="max-w-[200px] truncate text-[11px] text-[#64748b] lg:max-w-none">
                  cloud.example-hospital.cn
                </span>
              </div>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center justify-self-end rounded-lg active:bg-black/5"
                aria-label="更多"
              >
                <IconMore />
              </button>
            </div>
          </header>

          {/* 患者条：窄屏卡片风；宽屏顶栏一行 */}
          <section className="relative overflow-hidden bg-gradient-to-b from-[#c5e0f5] via-[#d9ebf9] to-[#e8f2fb] px-4 pb-6 pt-5 lg:rounded-b-2xl lg:px-6 lg:pb-5 lg:pt-4">
            <div
              className="pointer-events-none absolute -right-6 top-2 h-28 w-28 rounded-2xl bg-white/25 blur-2xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute bottom-0 left-1/4 h-20 w-40 -translate-x-1/2 bg-sky-300/20 blur-3xl"
              aria-hidden
            />

            <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <h1 className="text-[20px] font-bold tracking-tight text-[#0f2942] lg:text-[22px]">
                  <span className="lg:hidden">张** · 女 · 60 岁</span>
                  <span className="hidden lg:inline">
                    张** / 女 / 60 岁 / 19**-**-**
                  </span>
                </h1>
                <p className="mt-2 text-[14px] text-[#3d5a73] lg:hidden">
                  出生日期：19**-**-**
                </p>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-4 lg:justify-end">
                <Link
                  href="/hd"
                  scroll={false}
                  className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#1d4ed8] hover:underline"
                >
                  <IconLungScan />
                  查看影像
                </Link>
                <div className="relative opacity-90 lg:hidden" aria-hidden>
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
            </div>
          </section>

          <main className="-mt-3 px-3 pb-28 pt-0 lg:mt-4 lg:px-0 lg:pb-12">
            <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,220px)_1fr] lg:items-start lg:gap-8">
              {/* 时间线 / 检查摘要：宽屏左侧；窄屏顶部条 */}
              <aside className="order-first lg:sticky lg:top-[52px] lg:self-start">
                <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-4 shadow-sm lg:border-slate-100 lg:bg-white lg:shadow-[0_4px_24px_rgba(15,41,66,0.06)]">
                  <div className="flex gap-3 lg:flex-col lg:gap-2">
                    <div className="flex shrink-0 flex-col items-center pt-1 lg:items-start lg:pt-0">
                      <span className="h-3 w-3 rounded-full bg-[#2563eb] ring-4 ring-sky-100" />
                      <div className="mt-1 hidden w-px flex-1 min-h-[2rem] bg-slate-200 lg:block" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold leading-snug text-[#0f2942]">
                        肺部小结节薄层平扫
                      </p>
                      <p className="mt-1 text-[12px] text-[#64748b]">
                        2025-10-28 14:31:38
                      </p>
                    </div>
                  </div>
                </div>
              </aside>

              <div className="flex min-w-0 flex-col gap-5">
                <article className="overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_rgba(15,41,66,0.08)]">
                  <div className="border-b border-slate-100 px-4 pb-3 pt-4 lg:flex lg:items-start lg:justify-between lg:gap-6">
                    <div>
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
                    </div>
                    <div className="mt-3 space-y-1 text-[13px] text-[#64748b] lg:mt-0 lg:text-right">
                      <p>医技号：ZS********</p>
                      <p>检查号：ZS**********</p>
                      <p>检查时间：2025/10/28 14:31</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[13px] text-[#64748b]">
                      审核时间：2025-10-29 09:08:21
                    </p>
                    <Link
                      href="/film"
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] font-medium text-[#64748b] hover:bg-slate-50 lg:hidden"
                    >
                      全屏胶片
                    </Link>
                  </div>

                  <div className="space-y-6 px-4 py-5">
                    <section>
                      <h3 className="mb-3 text-[15px] font-semibold text-[#2563eb]">
                        报告内容
                      </h3>
                      <div className="mb-4">
                        <div className="text-[13px] font-medium text-[#2563eb]">检查项目</div>
                        <p className="mt-1 text-[14px] text-[#334155]">肺部小结节薄层平扫</p>
                      </div>
                      <h4 className="mb-2 text-[14px] font-semibold text-[#5b7a94]">检查所见</h4>
                      <div className="text-[14px] leading-[1.75] text-[#334155]">
                        <p>
                          右肺下叶前基底段可见结节灶（im38），大小18*15mm，边缘光滑锐利，两侧膈肌下可见微小结节影（im23等），直径约3-4，两肺少许纤维点条索影，所见各支气管壁通畅，纵膈小淋巴结，胸腔内无积液，甲状腺右前叶低密度结节。
                        </p>
                      </div>
                    </section>

                    <section>
                      <h4 className="mb-2 text-[14px] font-semibold text-[#5b7a94]">检查提示</h4>
                      <div className="text-[14px] leading-[1.75] text-[#334155]">
                        <p>
                          右肺下叶前基底段结节，较24-04-18片增大；两肺少许慢性炎症及陈旧灶；甲状腺右前叶结节，建议超声检查。
                        </p>
                      </div>
                    </section>

                    <section className="border-t border-slate-100 pt-5">
                      <h3 className="mb-3 text-[15px] font-semibold text-[#2563eb]">基本信息</h3>
                      <FieldGrid
                        items={[
                          { label: "申请科室", value: "呼吸科互联网门诊" },
                          { label: "申请医生", value: "王晓丹" },
                          { label: "病人类型", value: "门诊" },
                          { label: "门诊号", value: "************" },
                          { label: "床号", value: "—" },
                        ]}
                      />
                    </section>

                    <section className="border-t border-slate-100 pt-5">
                      <h3 className="mb-3 text-[15px] font-semibold text-[#2563eb]">检查信息</h3>
                      <FieldGrid
                        items={[
                          { label: "检查号", value: "ZS**********" },
                          { label: "检查类型", value: "CT" },
                          { label: "检查时间", value: "2025-10-28 14:31:38" },
                          { label: "检查医生", value: "杨国奎" },
                          { label: "报告时间", value: "2025-10-28 19:03:11" },
                          { label: "审核医生", value: "王维理" },
                          { label: "审核时间", value: "2025-10-29 09:08:21" },
                        ]}
                      />
                    </section>
                  </div>
                </article>

                {/* 原 /film 页能力：嵌入页面底部 */}
                <section
                  id="cloud-film-viewer"
                  className="scroll-mt-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-[#0a0c0f] shadow-[0_8px_32px_rgba(15,41,66,0.12)]"
                >
                  <div className="border-b border-white/10 bg-[#0c0f14] px-4 py-3">
                    <h2 className="text-[15px] font-semibold text-sky-100">查看胶片</h2>
                    <p className="mt-0.5 text-[12px] text-slate-400">
                      滚轮翻页、拖拽或下方控件浏览序列。
                      <Link href="/film" className="ml-1 text-sky-300 underline-offset-2 hover:underline">
                        全屏胶片页
                      </Link>
                    </p>
                  </div>
                  <div className="p-2 sm:p-3">
                    <FilmViewer variant="embedded" />
                  </div>
                </section>

                <p className="text-center text-[12px] leading-relaxed text-[#64748b] lg:text-left">
                  云胶片仅供临床医生参考，若与您拿到的报告影像结果不符，请以纸质报告为准。
                </p>
              </div>
            </div>
          </main>
        </div>

        <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200/80 bg-white/95 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden">
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
