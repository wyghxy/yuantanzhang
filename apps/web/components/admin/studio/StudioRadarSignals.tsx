'use client'

import React, { useEffect, useRef } from 'react'
import { studioCount, studioKnownNumber, studioPlatforms } from './studio-operations-utils'
import { useStudioPrivacy } from './StudioPrivacy'
import type { RecordData } from './studio-client'

/* 八条固定弧：半径 / 基准角 / 摆动幅度 / 周期 / 方向 / 相位。
   角度从右边缘（0°）向下方增大。半径分层、方向交替，轨迹在数值上校过，不会扎堆。
   基准角整体抬了 8–12°：奇点移到卡片中线之后，星群要跟着往上收，
   否则最外圈会拖到「ASR / 正文 / Token」那一排去。外圈同时收窄了摆动幅度，
   免得游到最高点时蹭到顶部「已激活 N 个来源平台」那一行。 */
const ORBITS: Record<string, { r: number; base: number; span: number; period: number; dir: number; ph: number }> = {
  wechat_official: { r: 48, base: -45, span: 19, period: 112, dir: 1, ph: 5.2 },
  tiktok: { r: 72, base: 18, span: 19, period: 150, dir: -1, ph: 3.4 },
  xiaohongshu: { r: 96, base: -42, span: 17, period: 124, dir: 1, ph: 1.3 },
  youtube: { r: 118, base: 5, span: 16, period: 135, dir: -1, ph: 4.1 },
  douyin: { r: 139, base: -34, span: 10, period: 140, dir: 1, ph: 0 },
  bili: { r: 158, base: -3, span: 14, period: 109, dir: -1, ph: 1.75 },
  wechat_channels: { r: 62, base: -18, span: 8, period: 128, dir: -1, ph: 2.4 },
  kuaishou: { r: 108, base: 20, span: 8, period: 144, dir: 1, ph: 5.8 },
}

/* 星群整体上提：奇点落到卡片中线之后，如果星继续挂在奇点上，
   视觉重心会一起掉到下半张卡，上半截就只剩门头那一行。
   整族抬 18px，奇点看上去卧在星群下方，卡片上下的分量才对得上。 */
const LIFT = 18

const SIGNAL: Record<string, { color: string; symbol: string }> = {
  douyin: { color: 'var(--ui-radar-signal)', symbol: '抖' },
  bili: { color: 'var(--ui-radar-blue)', symbol: 'B' },
  xiaohongshu: { color: 'var(--ui-radar-coral)', symbol: '书' },
  youtube: { color: 'var(--ui-radar-amber)', symbol: 'Y' },
  wechat_official: { color: 'var(--ui-radar-purple)', symbol: '公' },
  tiktok: { color: 'var(--ui-radar-system-tiktok)', symbol: 'T' },
  wechat_channels: { color: 'var(--ui-radar-signal)', symbol: '视' },
  kuaishou: { color: 'var(--ui-radar-amber)', symbol: '快' },
}

/* 波速恒定 78px/s（= max / period）。四道错开 2.75s，走完歇 0.83s 下一道才出发。
   peak 是波前主线的不透明度，band 是外包柔光的相对厚度 —— 两种波都压得很淡，
   只有带 hit 的那两道有能量，扫过平台星时把它点亮。 */
const WAVE_SPEC = [
  { period: 11, offset: 0, peak: .165, band: .15, max: 858, hit: true },
  { period: 11, offset: 2.75, peak: .125, band: .058, max: 858, hit: false },
  { period: 11, offset: 5.5, peak: .14, band: .118, max: 858, hit: true },
  { period: 11, offset: 8.25, peak: .1, band: .046, max: 858, hit: false },
]

const HORIZON = 18
const TAU = Math.PI * 2
const D2R = Math.PI / 180

type Body = {
  key: string
  g: HTMLButtonElement
  halo: HTMLElement; ping: HTMLElement; dot: HTMLElement; spark: HTMLElement; label: HTMLElement
  baseScale: number; active: boolean; R: number
  pulseT: number; pingT: number; lastWave: number
  hop: number; hs: number; ds: number; sk: number; po: number; ps: number; top: number
}

export default function StudioRadarSignals({ platforms, onPlatform }: {
  platforms: RecordData | null; onPlatform: (platform: string) => void
}) {
  const { platformLabel } = useStudioPrivacy()
  const coverage = platforms ? studioPlatforms.filter(item => (studioKnownNumber(platforms[item.key]) || 0) > 0).length : null
  const figRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const cvsRef = useRef<HTMLCanvasElement>(null)
  const blipsRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<SVGCircleElement>(null)
  const coreRef = useRef<SVGCircleElement>(null)
  const edgeRef = useRef<SVGCircleElement>(null)

  useEffect(() => {
    const fig = figRef.current, stage = stageRef.current, cvs = cvsRef.current
    const blips = blipsRef.current
    const hole = [glowRef.current, coreRef.current, edgeRef.current]
    if (!fig || !stage || !cvs || !blips || hole.some(node => !node)) return
    const ctx = cvs.getContext('2d')
    if (!ctx) return

    const panel = fig.closest('.workspace-overview') as HTMLElement | null
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(2, window.devicePixelRatio || 1)

    let CW = 0, CH = 0, OY = 140
    const CX = 2
    let waveGrad: CanvasGradient | null = null
    let raf = 0
    let last = 0

    const waves = WAVE_SPEC.map(spec => ({ ...spec, R: 0, prev: 0, op: 0, id: 0, lastPh: 0, eid: 0 }))

    const bodies = studioPlatforms.map<Body | null>(platform => {
      const g = blips.querySelector<HTMLButtonElement>('[data-platform="' + platform.key + '"]')
      if (!g) return null
      const pick = (selector: string) => g.querySelector<HTMLElement>(selector) as HTMLElement
      const count = platforms ? studioKnownNumber(platforms[platform.key] ?? 0) : null
      const active = count !== null && count > 0
      return {
        key: platform.key,
        g, halo: pick('.blip-halo'), ping: pick('.blip-ping'), dot: pick('.blip-dot'),
        spark: pick('.blip-spark'), label: pick('.blip-label'),
        baseScale: active ? 1 : .78, active, R: 0,
        pulseT: 1, pingT: 1, lastWave: -1,
        hop: -1, hs: -1, ds: -1, sk: -1, po: -1, ps: -1, top: -1,
      }
    }).filter((body): body is Body => body !== null)

    /* 波按面板宽度铺开（上限 340），而不是被雷达栏的 210px 卡死 ——
       波要能越过栏边界推出去，才有「一圈圈荡开」的空间感，而不是刚起就消失。
       清屏像素仍只占整块面板的一小部分，主线程喂得满帧。 */
    const sizeCanvas = () => {
      const w = Math.min(340, panel ? panel.clientWidth : fig.clientWidth)
      const h = stage.clientHeight
      if (!w || !h) return
      CW = w; CH = h
      cvs.width = Math.round(w * dpr)
      cvs.height = Math.round(h * dpr)
      cvs.style.width = w + 'px'
      cvs.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      waveGrad = ctx.createLinearGradient(0, 0, w, 0)
      const palette = getComputedStyle(fig)
      for (const [index, position] of [0, .15, .3, .45, .58, .7, .8, .9, 1].entries()) {
        const color = palette.getPropertyValue(`--ui-radar-system-wave-${index}`).trim()
        if (!color) { waveGrad = null; return }
        waveGrad.addColorStop(position, color)
      }
    }

    const layout = () => {
      const sr = stage.getBoundingClientRect()
      /* 奇点落在整张卡片的垂直中线上，而不是 stage 的中线 ——
         顶部让出「已激活 N 个来源平台」这一行之后，stage 的重心是偏下的，
         按 stage 算会把黑洞又拽回上半张卡。 */
      const pr = panel ? panel.getBoundingClientRect() : null
      const cy = pr ? pr.top + pr.height / 2 : sr.top + sr.height / 2
      OY = Math.max(26, Math.min(sr.height - 26, cy - sr.top))
      /* 左栏加宽到 250 之后，星群还是按原来的 158 半径缩在左边，
         和「191」之间留出一大块空地 —— 星群要跟着栏宽一起铺开，
         外圈才够到数字那一边。上限 1.2：再大最外圈的星会顶到卡片上边框。 */
      const k = Math.min(1.2, (sr.width - 16) / 200)
      for (const body of bodies) {
        const orbit = ORBITS[body.key]
        body.R = orbit ? orbit.r * k : 0
      }

      for (const node of hole) {
        node?.setAttribute('cx', String(CX))
        node?.setAttribute('cy', String(OY))
      }

      /* 环纹圆心跟奇点走（stage 的左边缘），不是雷达栏的左边缘 ——
         否则环和黑洞会错开一整个 padding 的距离。 */
      if (panel) {
        const pr = panel.getBoundingClientRect()
        panel.style.setProperty('--radar-cx', (sr.left - pr.left + CX).toFixed(1) + 'px')
        panel.style.setProperty('--radar-cy', (sr.top - pr.top + OY).toFixed(1) + 'px')
      }

      sizeCanvas()
    }

    const drawWaves = () => {
      ctx.clearRect(0, 0, CW, CH)
      if (!waveGrad) return
      ctx.strokeStyle = waveGrad
      for (const w of waves) {
        if (w.op <= .0015 || w.R < 1 || w.R > CW + 30) continue
        /* 余晖：波前身后三道逐级衰减的尾迹，让波看起来是「扫过去」而不是一个圆 */
        for (let k = 3; k >= 1; k--) {
          const rk = w.R - k * 5.5
          if (rk < 4) continue
          ctx.beginPath()
          ctx.arc(CX, OY, rk, 0, TAU)
          ctx.lineWidth = .7
          ctx.globalAlpha = w.op * .19 * Math.pow(.55, k - 1)
          ctx.stroke()
        }
        ctx.beginPath()
        ctx.arc(CX, OY, w.R, 0, TAU)
        ctx.lineWidth = .95
        ctx.globalAlpha = w.op
        ctx.stroke()
        /* 很薄的一层柔光，只为了让线不割眼 */
        ctx.lineWidth = 3.2
        ctx.globalAlpha = w.op * w.band
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    const place = (p: Body, t: number, dt: number) => {
      const orbit = ORBITS[p.key]
      if (!orbit) return
      const w = TAU / orbit.period
      const th = (orbit.base + orbit.span * orbit.dir * Math.sin(t * w + orbit.ph)) * D2R
      const x = CX + p.R * Math.cos(th)
      const y = OY + p.R * Math.sin(th) - LIFT

      /* 波前刚好跨过这颗星时触发，而不是等波整体扫完再统一亮 */
      if (!reduce) {
        for (const wv of waves) {
          if (wv.hit && wv.eid !== p.lastWave && p.R > wv.prev && p.R <= wv.R) {
            p.pulseT = 0; p.pingT = 0; p.lastWave = wv.eid
            break
          }
        }
      }

      if (p.pulseT < 1) p.pulseT = Math.min(1, p.pulseT + dt / .26)
      if (p.pingT < 1) p.pingT = Math.min(1, p.pingT + dt / .5)

      const f = Math.sin(Math.PI * p.pulseT)
      p.g.style.transform = 'translate3d(' + x.toFixed(3) + 'px,' + y.toFixed(3) + 'px,0)'

      /* 每帧只在变化超过阈值时才写样式，避免无谓的样式重算 */
      const hop = (p.active ? .008 : .003) + f * (p.active ? .16 : .07)
      if (Math.abs(hop - p.hop) > .004) { p.halo.style.opacity = hop.toFixed(3); p.hop = hop }

      const hs = p.baseScale * (1 + f * .34)
      if (Math.abs(hs - p.hs) > .003) { p.halo.style.transform = 'scale(' + hs.toFixed(3) + ')'; p.hs = hs }

      const ds = p.baseScale * (1 + f * .46)
      if (Math.abs(ds - p.ds) > .002) { p.dot.style.transform = 'scale(' + ds.toFixed(3) + ')'; p.ds = ds }

      const sk = f * (p.active ? .8 : .42)
      if (Math.abs(sk - p.sk) > .03) { p.spark.style.opacity = sk.toFixed(3); p.sk = sk }

      const top = (p.active ? .56 : .36) + f * .38
      if (Math.abs(top - p.top) > .01) { p.label.style.opacity = top.toFixed(3); p.top = top }

      const po = .3 * Math.pow(1 - p.pingT, 1.6) * (p.active ? 1 : .4)
      if (Math.abs(po - p.po) > .01) { p.ping.style.opacity = po.toFixed(3); p.po = po }
      const ps = .6 + 2.8 * p.pingT
      if (Math.abs(ps - p.ps) > .02) { p.ping.style.transform = 'scale(' + ps.toFixed(3) + ')'; p.ps = ps }
    }

    const frame = (now: number) => {
      if (!last) last = now
      const dt = Math.min(.05, (now - last) / 1000)
      last = now
      const t = now / 1000

      for (let i = 0; i < waves.length; i++) {
        const w = waves[i]
        const ph = ((t + w.offset) % w.period) / w.period
        if (ph < w.lastPh) w.id++
        w.lastPh = ph
        w.R = w.max * ph
        /* 每道波独立编号，保证每一道强波都能点亮平台星 */
        w.eid = w.id * 8 + i
        /* 淡入按绝对半径算（22→90px），不随行程漂移：波刚出奇点是透明的，
           长大到 90px 才全亮，近场不会形成「套在黑洞上的光圈」 */
        const fin = Math.min(1, Math.max(0, (w.R - 22) / 68))
        w.op = w.peak * fin * Math.pow(1 - ph, 1.05)
      }

      drawWaves()
      for (const body of bodies) place(body, t, dt)
      for (const w of waves) w.prev = w.R

      if (!reduce) raf = requestAnimationFrame(frame)
    }

    layout()
    /* 首次挂载时 stage 可能还没拿到高度，下一帧再量一次 */
    raf = requestAnimationFrame(() => { layout(); frame(performance.now()) })

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => layout()) : null
    observer?.observe(fig)
    window.addEventListener('resize', layout)

    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
      window.removeEventListener('resize', layout)
    }
  }, [platforms])

  return (
    <figure className="radar-figure radar-system" ref={figRef}>
      <div className="radar-system-stage" ref={stageRef} aria-label={studioPlatforms.length + '个平台采集信号'}>
        <canvas className="radar-wave-canvas" ref={cvsRef} aria-hidden="true" />
        <svg className="radar-system-svg" aria-hidden="true">
          <defs>
            <radialGradient id="rs-hole-glow">
              <stop offset="40%" stopColor="var(--ui-mask-81ef715e)" stopOpacity="0" />
              <stop offset="53%" stopColor="var(--ui-radar-system-core-glow)" stopOpacity=".065" />
              <stop offset="74%" stopColor="var(--ui-radar-signal)" stopOpacity=".022" />
              <stop offset="100%" stopColor="var(--ui-radar-signal)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="rs-hole-core">
              <stop offset="0%" stopColor="var(--ui-mask-81ef715e)" stopOpacity="1" />
              <stop offset="76%" stopColor="var(--ui-mask-81ef715e)" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--ui-radar-system-core-edge)" stopOpacity="1" />
            </radialGradient>
          </defs>
          <g>
            <circle ref={glowRef} cx="2" cy="140" r="58" fill="url(#rs-hole-glow)" />
            <circle ref={coreRef} cx="2" cy="140" r={HORIZON} fill="url(#rs-hole-core)" />
            <circle ref={edgeRef} cx="2" cy="140" r={HORIZON + .5} fill="none" stroke="var(--ui-radar-system-core-border)" strokeWidth="1" />
          </g>
        </svg>
        <div className="radar-blips" ref={blipsRef}>
          {studioPlatforms.map(platform => {
            const signal = SIGNAL[platform.key]
            const count = platforms ? studioKnownNumber(platforms[platform.key] ?? 0) : null
            return (
              <button key={platform.key} type="button" className="radar-blip"
                data-platform={platform.key} data-active={count !== null && count > 0}
                style={{ color: signal ? signal.color : undefined }}
                title={platformLabel(platform.key, platform.label) + ' · ' + studioCount(count) + ' 条'}
                aria-label={platformLabel(platform.key, platform.label) + '，查看采集内容'}
                onClick={() => onPlatform(platform.key)}>
                <span className="blip-halo" aria-hidden="true" />
                <span className="blip-ping" aria-hidden="true" />
                <span className="blip-dot" aria-hidden="true" />
                <span className="blip-spark" aria-hidden="true" />
                <em className="blip-label">{platformLabel(platform.key, platform.label)}</em>
              </button>
            )
          })}
        </div>
      </div>
      {/* 统计行压在左栏底部，和中间那组「ASR / 正文 / Token」三格同一条底边 */}
      <figcaption className="radar-total">
        <span className="radar-total-label">已激活</span>
        <strong>{studioCount(coverage)}</strong>
        <span className="radar-total-label">个来源平台</span>
      </figcaption>
    </figure>
  )
}
