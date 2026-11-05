'use client'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Inputs, State } from '@/lib/hvac/model'

/**
 * Cena 3D explicativa do split: ambiente interno, fachada, condensadora com o compressor
 * e o capacitor visíveis por dentro, tubulação com o gás circulando, quadro elétrico com o
 * sensor de corrente. Tudo procedural; reage ao modelo físico em tempo real.
 */

const EDGE = 0x94a3b8
const YELLOW = 0xf7e921

/** Temperatura → cor: azul (frio) → ciano → laranja → vermelho (quente). */
const STOPS: [number, number][] = [[-15, 0.66], [12, 0.54], [32, 0.11], [60, 0.05], [95, 0.0]]
function tempColor(t: number, out = new THREE.Color()) {
  let h = STOPS[0][1]
  if (t >= STOPS[STOPS.length - 1][0]) h = STOPS[STOPS.length - 1][1]
  else for (let i = 0; i < STOPS.length - 1; i++) {
    const [t0, h0] = STOPS[i]
    const [t1, h1] = STOPS[i + 1]
    if (t >= t0 && t < t1) h = h0 + ((t - t0) / (t1 - t0)) * (h1 - h0)
  }
  return out.setHSL(h, 0.9, 0.55)
}

function solid(geo: THREE.BufferGeometry, color: number, opacity: number, edgeOpacity = 0.55) {
  const g = new THREE.Group()
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
  const mesh = new THREE.Mesh(geo, mat)
  const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: EDGE, transparent: true, opacity: edgeOpacity }))
  g.add(mesh, lines)
  return { g, mat, lines }
}

type Label = { key: string; pos: THREE.Vector3; el: HTMLDivElement }

const VIEWS = {
  geral: { label: 'Visão geral', pos: [1.9, 2.6, 6.3], target: [1.1, 1.25, 0.3] },
  cond: { label: 'Condensadora', pos: [1.45, 1.5, 3.2], target: [2.95, 0.5, 0.35] },
  quadro: { label: 'Quadro + sensor', pos: [-0.1, 1.85, 1.9], target: [-0.3, 1.55, 0.05] },
  evap: { label: 'Evaporadora', pos: [-1.2, 1.9, 2.3], target: [-1.6, 2.25, 0.1] },
} as const
export type ViewKey = keyof typeof VIEWS

export default function SplitScene({ x, s }: { x: Inputs; s: State }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<ViewKey>('geral')
  const live = useRef({ x, s, view, moving: 0 })
  live.current.x = x
  live.current.s = s
  if (live.current.view !== view) {
    live.current.view = view
    live.current.moving = 1.2 // segundos de transição
  }

  useEffect(() => {
    const mount = mountRef.current
    const labelLayer = labelsRef.current
    if (!mount || !labelLayer) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 100)
    camera.position.set(1.9, 2.6, 6.3)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(1.1, 1.25, 0.3)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 1.2
    controls.maxDistance = 13
    controls.minPolarAngle = 0.35
    controls.maxPolarAngle = 1.45
    controls.minAzimuthAngle = -1.2
    controls.maxAzimuthAngle = 1.2
    controls.update()

    const disposables: { dispose: () => void }[] = []
    const track = <T extends { dispose: () => void }>(o: T) => (disposables.push(o), o)

    // ---------- Chão e paredes ----------
    const groundPts: number[] = []
    for (let gx = -3.4; gx <= 4.8; gx += 0.25) for (let gz = 0; gz <= 3; gz += 0.25) groundPts.push(gx, 0, gz)
    const groundGeo = track(new THREE.BufferGeometry())
    groundGeo.setAttribute('position', new THREE.Float32BufferAttribute(groundPts, 3))
    scene.add(new THREE.Points(groundGeo, track(new THREE.PointsMaterial({ color: 0x334155, size: 0.03 }))))

    const backWall = solid(track(new THREE.BoxGeometry(8.2, 3, 0.1)), 0x0f172a, 0.55, 0.25)
    backWall.g.position.set(0.7, 1.5, -0.05)
    scene.add(backWall.g)
    const sideWall = solid(track(new THREE.BoxGeometry(0.1, 3, 2.6)), 0x0f172a, 0.18, 0.2)
    sideWall.g.position.set(1.0, 1.5, 1.25)
    scene.add(sideWall.g)

    // Textos no chão: interno / externo
    const zoneLabel = (text: string, px: number) => {
      const c = document.createElement('canvas')
      c.width = 512
      c.height = 96
      const ctx = c.getContext('2d')!
      ctx.font = '600 52px monospace'
      ctx.fillStyle = 'rgba(148,163,184,0.45)'
      ctx.fillText(text, 8, 66)
      const tex = track(new THREE.CanvasTexture(c))
      const m = new THREE.Mesh(track(new THREE.PlaneGeometry(1.8, 0.34)), track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })))
      m.rotation.x = -Math.PI / 2
      m.position.set(px, 0.01, 2.4)
      scene.add(m)
    }
    zoneLabel('AMBIENTE', -1.6)
    zoneLabel('ÁREA EXTERNA', 2.9)

    // ---------- Evaporadora ----------
    const evap = solid(track(new THREE.BoxGeometry(1.1, 0.32, 0.24)), 0xe2e8f0, 0.12)
    evap.g.position.set(-1.6, 2.35, 0.13)
    scene.add(evap.g)
    const filterMat = track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }))
    const filter = new THREE.Mesh(track(new THREE.PlaneGeometry(1.0, 0.2)), filterMat)
    filter.rotation.x = -Math.PI / 2
    filter.position.set(-1.6, 2.515, 0.13)
    scene.add(filter)
    // Ar frio saindo por baixo
    const AIR_N = 70
    const airGeo = track(new THREE.BufferGeometry())
    const airPos = new Float32Array(AIR_N * 3)
    const airAge = new Float32Array(AIR_N).map(() => Math.random())
    airGeo.setAttribute('position', new THREE.BufferAttribute(airPos, 3))
    const airMat = track(new THREE.PointsMaterial({ color: 0x67e8f9, size: 0.05, transparent: true, opacity: 0.7, depthWrite: false }))
    scene.add(new THREE.Points(airGeo, airMat))

    // ---------- Quadro elétrico + sensor ----------
    const panel = solid(track(new THREE.BoxGeometry(0.4, 0.55, 0.1)), 0x1e293b, 0.6)
    panel.g.position.set(-0.3, 1.3, 0.05)
    scene.add(panel.g)
    const breaker = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.16, 0.06)), track(new THREE.MeshBasicMaterial({ color: 0xe5e7eb })))
    breaker.position.set(-0.3, 1.36, 0.12)
    scene.add(breaker)
    const clampMat = track(new THREE.MeshBasicMaterial({ color: YELLOW }))
    const clamp = new THREE.Mesh(track(new THREE.TorusGeometry(0.07, 0.022, 10, 24)), clampMat)
    clamp.rotation.x = Math.PI / 2
    clamp.position.set(-0.3, 1.72, 0.1)
    scene.add(clamp)
    const ringMat = track(new THREE.MeshBasicMaterial({ color: YELLOW, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }))
    const ring = new THREE.Mesh(track(new THREE.RingGeometry(0.1, 0.115, 40)), ringMat)
    ring.position.copy(clamp.position).add(new THREE.Vector3(0, 0, 0.02))
    scene.add(ring)

    const cablePath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.3, 1.55, 0.1),
      new THREE.Vector3(-0.3, 2.75, 0.1),
      new THREE.Vector3(1.0, 2.8, 0.1),
      new THREE.Vector3(2.15, 2.8, 0.1),
      new THREE.Vector3(2.2, 1.1, 0.25),
      new THREE.Vector3(2.6, 0.9, 0.45),
    ], false, 'catmullrom', 0.1)
    scene.add(new THREE.Mesh(track(new THREE.TubeGeometry(cablePath, 80, 0.012, 6)), track(new THREE.MeshBasicMaterial({ color: 0x64748b }))))
    // Pulsos de corrente pelo cabo
    const PULSE_N = 10
    const pulseGeo = track(new THREE.SphereGeometry(0.02, 8, 8))
    const pulseMat = track(new THREE.MeshBasicMaterial({ color: YELLOW }))
    const pulses = new THREE.InstancedMesh(pulseGeo, pulseMat, PULSE_N)
    pulses.frustumCulled = false
    scene.add(pulses)

    // ---------- Condensadora (carcaça transparente para ver por dentro) ----------
    const CU = new THREE.Vector3(2.95, 0.5, 0.45)
    const cond = solid(track(new THREE.BoxGeometry(1.15, 0.8, 0.44)), 0xe2e8f0, 0.07, 0.6)
    cond.g.position.copy(CU)
    scene.add(cond.g)
    for (const dx of [-0.45, 0.45]) {
      const foot = new THREE.Mesh(track(new THREE.BoxGeometry(0.12, 0.1, 0.4)), track(new THREE.MeshBasicMaterial({ color: 0x334155 })))
      foot.position.set(CU.x + dx, 0.05, CU.z)
      scene.add(foot)
    }
    // Serpentina (aletas) nas faces de trás e esquerda
    const finPts: number[] = []
    for (let i = 0; i <= 28; i++) {
      const fx = CU.x - 0.56 + (i * 1.12) / 28
      finPts.push(fx, CU.y - 0.36, CU.z - 0.2, fx, CU.y + 0.36, CU.z - 0.2)
    }
    for (let i = 0; i <= 12; i++) {
      const fz = CU.z - 0.2 + (i * 0.4) / 12
      finPts.push(CU.x - 0.565, CU.y - 0.36, fz, CU.x - 0.565, CU.y + 0.36, fz)
    }
    const finGeo = track(new THREE.BufferGeometry())
    finGeo.setAttribute('position', new THREE.Float32BufferAttribute(finPts, 3))
    const finMat = track(new THREE.LineBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.5 }))
    scene.add(new THREE.LineSegments(finGeo, finMat))
    // Sujeira / folhas na serpentina
    const DIRT_N = 90
    const dirtGeo = track(new THREE.CircleGeometry(0.05, 6))
    const dirtMat = track(new THREE.MeshBasicMaterial({ color: 0x8b5a2b, side: THREE.DoubleSide }))
    const dirt = new THREE.InstancedMesh(dirtGeo, dirtMat, DIRT_N)
    const dummy = new THREE.Object3D()
    for (let i = 0; i < DIRT_N; i++) {
      const onLeft = i % 3 !== 0
      if (onLeft) {
        dummy.position.set(CU.x - 0.575, CU.y - 0.33 + Math.random() * 0.66, CU.z - 0.18 + Math.random() * 0.36)
        dummy.rotation.set(0, Math.PI / 2, Math.random() * 3)
      } else {
        dummy.position.set(CU.x - 0.54 + Math.random() * 1.08, CU.y - 0.33 + Math.random() * 0.66, CU.z - 0.215)
        dummy.rotation.set(0, 0, Math.random() * 3)
      }
      dummy.scale.setScalar(0.8 + Math.random() * 1.1)
      dummy.updateMatrix()
      dirt.setMatrixAt(i, dummy.matrix)
    }
    dirt.count = 0
    dirt.frustumCulled = false
    scene.add(dirt)
    // Ventilador (grade + pás) na frente, lado esquerdo
    const fanC = new THREE.Vector3(CU.x - 0.22, CU.y, CU.z + 0.225)
    const grill = new THREE.Mesh(track(new THREE.RingGeometry(0.29, 0.3, 48)), track(new THREE.MeshBasicMaterial({ color: EDGE, transparent: true, opacity: 0.7, side: THREE.DoubleSide })))
    grill.position.copy(fanC)
    scene.add(grill)
    const fan = new THREE.Group()
    fan.position.copy(fanC).add(new THREE.Vector3(0, 0, -0.03))
    const bladeMat = track(new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.55, side: THREE.DoubleSide }))
    const bladeGeo = track(new THREE.CircleGeometry(0.26, 16, -0.25, 0.5))
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(bladeGeo, bladeMat)
      blade.rotation.z = (b * 2 * Math.PI) / 3
      fan.add(blade)
    }
    scene.add(fan)
    // Compressor
    const compGroup = new THREE.Group()
    compGroup.position.set(CU.x + 0.3, 0.42, CU.z)
    const compBody = new THREE.Mesh(track(new THREE.CylinderGeometry(0.12, 0.12, 0.42, 24)), track(new THREE.MeshBasicMaterial({ color: 0x475569 })))
    const compEdges = new THREE.LineSegments(track(new THREE.EdgesGeometry(compBody.geometry, 30)), track(new THREE.LineBasicMaterial({ color: 0xcbd5e1 })))
    const compDome = new THREE.Mesh(track(new THREE.SphereGeometry(0.12, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), compBody.material)
    compDome.position.y = 0.21
    compGroup.add(compBody, compEdges, compDome)
    scene.add(compGroup)
    const compMat = compBody.material as THREE.MeshBasicMaterial
    // Capacitor
    const capGroup = new THREE.Group()
    capGroup.position.set(CU.x + 0.45, 0.72, CU.z + 0.08)
    const capMat = track(new THREE.MeshBasicMaterial({ color: 0x94a3b8 }))
    const capBody = new THREE.Mesh(track(new THREE.CylinderGeometry(0.045, 0.045, 0.13, 16)), capMat)
    capGroup.add(capBody, new THREE.LineSegments(track(new THREE.EdgesGeometry(capBody.geometry, 30)), track(new THREE.LineBasicMaterial({ color: 0xe5e7eb }))))
    scene.add(capGroup)

    // ---------- Tubulação ----------
    const suctionPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.05, 2.3, 0.1),
      new THREE.Vector3(0.6, 2.3, 0.1),
      new THREE.Vector3(2.05, 2.3, 0.1),
      new THREE.Vector3(2.1, 0.55, 0.15),
      new THREE.Vector3(2.3, 0.4, 0.3),
      new THREE.Vector3(CU.x + 0.2, 0.4, CU.z - 0.05),
    ], false, 'catmullrom', 0.1)
    const liquidPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(CU.x - 0.1, 0.25, CU.z - 0.12),
      new THREE.Vector3(2.3, 0.25, 0.25),
      new THREE.Vector3(1.95, 0.45, 0.12),
      new THREE.Vector3(1.9, 2.4, 0.1),
      new THREE.Vector3(0.6, 2.42, 0.1),
      new THREE.Vector3(-1.05, 2.42, 0.1),
    ], false, 'catmullrom', 0.1)
    const suctionMat = track(new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 }))
    const liquidMat = track(new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.35 }))
    scene.add(new THREE.Mesh(track(new THREE.TubeGeometry(suctionPath, 120, 0.035, 8)), suctionMat))
    scene.add(new THREE.Mesh(track(new THREE.TubeGeometry(liquidPath, 120, 0.022, 8)), liquidMat))
    const FLOW_N = 40
    const flowGeo = track(new THREE.SphereGeometry(0.03, 8, 8))
    const flowSucMat = track(new THREE.MeshBasicMaterial({ color: 0x38bdf8 }))
    const flowLiqMat = track(new THREE.MeshBasicMaterial({ color: 0xf97316 }))
    const flowSuc = new THREE.InstancedMesh(flowGeo, flowSucMat, FLOW_N)
    const flowLiq = new THREE.InstancedMesh(flowGeo, flowLiqMat, FLOW_N)
    flowSuc.frustumCulled = flowLiq.frustumCulled = false
    scene.add(flowSuc, flowLiq)
    // Vazamento: névoa saindo da conexão (porca flange)
    const leakAt = new THREE.Vector3(2.3, 0.4, 0.3)
    const flare = new THREE.Mesh(track(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 6)), track(new THREE.MeshBasicMaterial({ color: 0xd4a017 })))
    flare.rotation.z = Math.PI / 2
    flare.position.copy(leakAt)
    scene.add(flare)
    const LEAK_N = 60
    const leakGeo = track(new THREE.BufferGeometry())
    const leakPos = new Float32Array(LEAK_N * 3)
    const leakVel = new Float32Array(LEAK_N * 3)
    const leakAge = new Float32Array(LEAK_N).map(() => Math.random())
    leakGeo.setAttribute('position', new THREE.BufferAttribute(leakPos, 3))
    const leakMat = track(new THREE.PointsMaterial({ color: 0xe0f2fe, size: 0.06, transparent: true, opacity: 0, depthWrite: false }))
    scene.add(new THREE.Points(leakGeo, leakMat))

    // ---------- Sol (temperatura externa) ----------
    const sunMat = track(new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.8 }))
    const sun = new THREE.Mesh(track(new THREE.SphereGeometry(0.22, 24, 16)), sunMat)
    sun.position.set(3.9, 2.75, -0.3)
    scene.add(sun)

    // ---------- Rótulos (HTML sobre o canvas) ----------
    const mkLabel = (key: string, pos: THREE.Vector3): Label => {
      const el = document.createElement('div')
      el.className = 'absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[10px] sm:text-[11px] pointer-events-none border transition-colors'
      labelLayer.appendChild(el)
      return { key, pos, el }
    }
    const labels = [
      mkLabel('evap', new THREE.Vector3(-1.6, 2.62, 0.13)),
      mkLabel('sensor', new THREE.Vector3(-0.3, 1.86, 0.1)),
      mkLabel('cond', new THREE.Vector3(CU.x - 0.35, 1.05, CU.z)),
      mkLabel('comp', new THREE.Vector3(CU.x + 0.3, 0.28, CU.z + 0.25)),
      mkLabel('cap', new THREE.Vector3(CU.x + 0.5, 0.95, CU.z + 0.08)),
      mkLabel('leak', leakAt.clone().add(new THREE.Vector3(-0.15, 0.12, 0))),
      mkLabel('pipes', new THREE.Vector3(0.4, 2.52, 0.1)),
      mkLabel('sun', new THREE.Vector3(3.9, 3.1, -0.3)),
    ]

    const resize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      renderer.setSize(w, h, false)
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    const col = new THREE.Color()
    const v = new THREE.Vector3()
    let raf = 0
    let last = performance.now()
    let flowPhase = 0
    let fanAngle = 0
    let pulsePhase = 0

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      // O timestamp do rAF pode ser anterior ao performance.now() da montagem: dt nunca negativo.
      const dt = THREE.MathUtils.clamp((now - last) / 1000, 0, 0.05)
      last = now
      const t = now / 1000
      const { x, s } = live.current
      if (live.current.moving > 0) {
        const goal = VIEWS[live.current.view]
        const k = 1 - Math.exp(-dt * 5)
        camera.position.lerp(v.set(goal.pos[0], goal.pos[1], goal.pos[2]), k)
        controls.target.lerp(v.set(goal.target[0], goal.target[1], goal.target[2]), k)
        live.current.moving -= dt
      }
      const running = s.trips.length === 0
      const anim = reduceMotion ? 0 : 1

      // Fluxo de gás: velocidade ∝ vazão mássica; nº de partículas ∝ carga
      const flowSpeed = running ? (s.massFlow / 0.02) * 0.12 : 0
      flowPhase += dt * flowSpeed * anim
      const nVisible = Math.max(4, Math.round(FLOW_N * Math.min(1, x.charge)))
      flowSuc.count = nVisible
      flowLiq.count = nVisible
      for (let i = 0; i < nVisible; i++) {
        const u = (((i / nVisible + flowPhase) % 1) + 1) % 1
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(1)
        dummy.position.copy(suctionPath.getPointAt(u))
        dummy.updateMatrix()
        flowSuc.setMatrixAt(i, dummy.matrix)
        dummy.position.copy(liquidPath.getPointAt(u))
        dummy.updateMatrix()
        flowLiq.setMatrixAt(i, dummy.matrix)
      }
      flowSuc.instanceMatrix.needsUpdate = true
      flowLiq.instanceMatrix.needsUpdate = true
      tempColor(s.tEvap, col)
      flowSucMat.color.copy(col)
      suctionMat.color.copy(col)
      tempColor(s.tCond, col)
      flowLiqMat.color.copy(col)
      liquidMat.color.copy(col)

      // Evaporadora: filtro escurece; jato de ar diminui
      filterMat.color.setRGB(1 - 0.55 * x.filterBlock, 1 - 0.65 * x.filterBlock, 1 - 0.8 * x.filterBlock)
      filterMat.opacity = 0.3 + 0.6 * x.filterBlock
      const airflow = running ? 1 - 0.5 * x.filterBlock : 0.15
      tempColor(s.tEvap + 6, col)
      airMat.color.copy(col)
      for (let i = 0; i < AIR_N; i++) {
        airAge[i] += dt * 0.6 * airflow * anim
        if (airAge[i] > 1) airAge[i] -= 1
        const a = airAge[i]
        const lane = (i % 10) / 9 - 0.5
        airPos[i * 3] = -1.6 + lane * 0.9
        airPos[i * 3 + 1] = 2.18 - a * 1.1 * airflow
        airPos[i * 3 + 2] = 0.25 + a * 0.9 * airflow
      }
      airGeo.attributes.position.needsUpdate = true
      airMat.opacity = 0.15 + 0.55 * airflow

      // Condensadora: sujeira, ventilador, serpentina quente
      dirt.count = Math.round(DIRT_N * Math.min(1, x.condBlock / 0.8))
      fanAngle += dt * (running ? 14 * (1 - 0.5 * x.condBlock) : 0) * anim
      fan.rotation.z = -fanAngle
      tempColor(s.tCond, col)
      finMat.color.copy(col)

      // Compressor: cor pela temperatura de descarga; vibra quando liga
      tempColor(s.tDischarge - 25, col)
      compMat.color.copy(col).multiplyScalar(0.75)
      const shake = running ? 0.004 + 0.02 * s.ripple : 0
      compGroup.position.x = CU.x + 0.3 + Math.sin(t * 90) * shake * anim
      compGroup.position.z = CU.z + Math.cos(t * 77) * shake * anim

      // Capacitor: degradado → vermelho pulsando e estufado
      const capBad = x.capLoss
      capMat.color.setRGB(0.58 + 0.4 * capBad, 0.64 - 0.5 * capBad, 0.72 - 0.6 * capBad)
      if (capBad > 0.05) capMat.color.multiplyScalar(0.8 + 0.2 * Math.sin(t * 6))
      capGroup.scale.set(1 + 0.25 * capBad, 1, 1 + 0.25 * capBad)

      // Vazamento
      const leak = Math.max(0, 1 - x.charge)
      leakMat.opacity = Math.min(0.85, leak * 2.2)
      for (let i = 0; i < LEAK_N; i++) {
        leakAge[i] += dt * 0.8 * anim
        if (leakAge[i] > 1) {
          leakAge[i] = 0
          leakVel[i * 3] = -0.2 - Math.random() * 0.3
          leakVel[i * 3 + 1] = 0.15 + Math.random() * 0.4
          leakVel[i * 3 + 2] = (Math.random() - 0.5) * 0.4
        }
        const a = leakAge[i]
        leakPos[i * 3] = leakAt.x + leakVel[i * 3] * a
        leakPos[i * 3 + 1] = leakAt.y + leakVel[i * 3 + 1] * a
        leakPos[i * 3 + 2] = leakAt.z + leakVel[i * 3 + 2] * a
      }
      leakGeo.attributes.position.needsUpdate = true

      // Sensor: pulsos ∝ corrente; anel de transmissão
      pulsePhase += dt * (running ? 0.25 : 0) * anim
      pulses.count = running ? PULSE_N : 0
      for (let i = 0; i < PULSE_N; i++) {
        const u = (((i / PULSE_N + pulsePhase) % 1) + 1) % 1
        dummy.position.copy(cablePath.getPointAt(u))
        dummy.scale.setScalar(0.6 + 0.5 * (s.irms / 6.28))
        dummy.updateMatrix()
        pulses.setMatrixAt(i, dummy.matrix)
      }
      pulses.instanceMatrix.needsUpdate = true
      const rp = (t * 0.8) % 1
      ring.scale.setScalar(1 + rp * 2.5 * anim)
      ringMat.opacity = 0.6 * (1 - rp)

      // Sol
      const heat = THREE.MathUtils.clamp((x.tAmb - 15) / 27, 0, 1)
      sunMat.color.setHSL(0.15 - 0.12 * heat, 1, 0.55)
      sun.scale.setScalar(0.7 + 0.7 * heat)

      controls.update()
      renderer.render(scene, camera)

      // Rótulos
      const w = mount.clientWidth
      const h = mount.clientHeight
      const text: Record<string, [string, 'ok' | 'bad' | 'info' | 'hide']> = {
        evap: x.filterBlock > 0.05 ? [`⚠ Filtro ${Math.round(x.filterBlock * 100)}% sujo`, 'bad'] : ['Evaporadora', 'ok'],
        sensor: [`Sensor SCT · ${s.irms.toFixed(2)} A`, 'info'],
        cond: x.condBlock > 0.05 ? [`⚠ Condensador ${Math.round(x.condBlock * 100)}% obstruído`, 'bad'] : ['Condensadora', 'ok'],
        comp: running ? [`Compressor · ${s.tDischarge.toFixed(0)} °C`, s.tDischarge > 105 ? 'bad' : 'ok'] : ['⛔ Compressor parado', 'bad'],
        cap: x.capLoss > 0.05 ? [`⚠ Capacitor −${Math.round(x.capLoss * 100)}%`, 'bad'] : ['Capacitor 35 µF', 'ok'],
        leak: leak > 0.02 ? [`⚠ Vazamento · carga ${Math.round(x.charge * 100)}%`, 'bad'] : ['', 'hide'],
        pipes: ['Linhas de sucção e líquido', 'ok'],
        sun: [`${x.tAmb.toFixed(1)} °C`, 'ok'],
      }
      for (const L of labels) {
        const [txt, kind] = text[L.key]
        v.copy(L.pos)
        if (L.key === 'comp') v.x = compGroup.position.x
        v.project(camera)
        const visible = kind !== 'hide' && v.z < 1
        L.el.style.display = visible ? 'block' : 'none'
        if (!visible) continue
        L.el.style.left = `${((v.x + 1) / 2) * w}px`
        L.el.style.top = `${((1 - v.y) / 2) * h}px`
        if (L.el.textContent !== txt) L.el.textContent = txt
        const cls = kind === 'bad' ? 'bg-red-500/15 border-red-400/60 text-red-300' : kind === 'info' ? 'bg-signal/15 border-signal/60 text-signal' : 'bg-black/50 border-white/15 text-white/75'
        if (L.el.dataset.kind !== kind) {
          L.el.dataset.kind = kind
          L.el.classList.remove(...['bg-red-500/15', 'border-red-400/60', 'text-red-300', 'bg-signal/15', 'border-signal/60', 'text-signal', 'bg-black/50', 'border-white/15', 'text-white/75'])
          L.el.classList.add(...cls.split(' '))
        }
      }
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      labels.forEach(L => L.el.remove())
      disposables.forEach(d => d.dispose())
      scene.traverse(o => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return (
    <div className="relative rounded-xl border border-white/10 bg-[radial-gradient(ellipse_at_top,#111827,#05080d)] overflow-hidden">
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-3 py-2 font-mono text-[11px] text-white/50 pointer-events-none">
        <span>vista 3D · arraste para girar, role para aproximar</span>
        <span className="hidden sm:flex items-center gap-3">
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-sky-400 inline-block" />frio</span>
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-orange-400 inline-block" />quente</span>
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-signal inline-block" />sinal elétrico</span>
        </span>
      </div>
      <div className="absolute bottom-0 inset-x-0 z-10 flex flex-wrap gap-1.5 p-2.5">
        {(Object.keys(VIEWS) as ViewKey[]).map(k => (
          <button
            key={k}
            onClick={() => {
              setView(k)
              live.current.view = k
              live.current.moving = 1.2
            }}
            className={`px-2.5 py-1 rounded-md border font-mono text-[11px] backdrop-blur transition-colors ${view === k ? 'border-signal bg-signal text-black' : 'border-white/15 bg-black/50 text-white/75 hover:border-signal hover:text-signal'}`}
          >
            {VIEWS[k].label}
          </button>
        ))}
      </div>
      <div ref={mountRef} className="relative w-full aspect-[4/3] sm:aspect-[16/9] cursor-grab active:cursor-grabbing" />
      <div ref={labelsRef} className="absolute inset-0 pointer-events-none" />
    </div>
  )
}
