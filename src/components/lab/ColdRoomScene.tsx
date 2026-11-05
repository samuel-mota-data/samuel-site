'use client'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { KNEE, type CRParams, type Run } from '@/lib/coldroom/model'

/**
 * Cena 3D da câmara fria tocando a simulação minuto a minuto: porta abrindo, gelo crescendo na
 * serpentina, resistência acesa no degelo, nível do reservatório caindo com o vazamento, bolhas no
 * visor de líquido, controlador com a temperatura e o alarme ativo.
 */

const EDGE = 0x94a3b8
const YELLOW = 0xf7e921

const STOPS: [number, number][] = [[-25, 0.68], [0, 0.56], [25, 0.13], [55, 0.05], [95, 0.0]]
function tempColor(t: number, out = new THREE.Color()) {
  let h = STOPS[0][1]
  if (!Number.isFinite(t)) return out.setHSL(0.6, 0.1, 0.5)
  if (t >= STOPS[STOPS.length - 1][0]) h = 0
  else
    for (let i = 0; i < STOPS.length - 1; i++) {
      const [t0, h0] = STOPS[i]
      const [t1, h1] = STOPS[i + 1]
      if (t >= t0 && t < t1) h = h0 + ((t - t0) / (t1 - t0)) * (h1 - h0)
    }
  return out.setHSL(h, 0.9, 0.55)
}

function panel(geo: THREE.BufferGeometry, color: number, opacity: number, edgeOpacity = 0.5) {
  const g = new THREE.Group()
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide })
  g.add(new THREE.Mesh(geo, mat))
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: EDGE, transparent: true, opacity: edgeOpacity })))
  return { g, mat }
}

const VIEWS = {
  geral: { label: 'Visão geral', pos: [3.6, 4.4, 7.6], target: [0.6, 1.0, 0] },
  evap: { label: 'Evaporador', pos: [-0.3, 1.7, 0.9], target: [-0.5, 2.1, -1.2] },
  ucond: { label: 'Unidade condensadora', pos: [3.4, 1.6, 2.6], target: [2.9, 0.5, 0] },
  ctrl: { label: 'Controlador + porta', pos: [0.2, 1.6, 3.6], target: [-0.3, 1.3, 1.5] },
} as const
type ViewKey = keyof typeof VIEWS

type Label = { key: string; pos: THREE.Vector3; el: HTMLDivElement }

export default function ColdRoomScene({ run, tRef, p }: { run: Run; tRef: React.MutableRefObject<number>; p: CRParams }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<ViewKey>('geral')
  const live = useRef({ run, p, view: 'geral' as ViewKey, moving: 0 })
  live.current.run = run
  live.current.p = p

  useEffect(() => {
    const mount = mountRef.current
    const layer = labelsRef.current
    if (!mount || !layer) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0, 0)
    mount.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.05, 100)
    camera.position.set(...VIEWS.geral.pos)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(...VIEWS.geral.target)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 0.8
    controls.maxDistance = 14
    controls.maxPolarAngle = 1.5
    controls.update()

    // ---------- chão ----------
    const gp: number[] = []
    for (let x = -3.5; x <= 4.6; x += 0.25) for (let z = -2.4; z <= 3.4; z += 0.25) gp.push(x, 0, z)
    const gGeo = new THREE.BufferGeometry()
    gGeo.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3))
    scene.add(new THREE.Points(gGeo, new THREE.PointsMaterial({ color: 0x334155, size: 0.03 })))

    // ---------- câmara (painéis isolados; sem teto para ver dentro) ----------
    const W = 3, D = 3, H = 2.5
    const CX = -0.5
    const back = panel(new THREE.BoxGeometry(W, H, 0.1), 0xe2e8f0, 0.1)
    back.g.position.set(CX, H / 2, -D / 2)
    const left = panel(new THREE.BoxGeometry(0.1, H, D), 0xe2e8f0, 0.08)
    left.g.position.set(CX - W / 2, H / 2, 0)
    const right = panel(new THREE.BoxGeometry(0.1, H, D), 0xe2e8f0, 0.08)
    right.g.position.set(CX + W / 2, H / 2, 0)
    scene.add(back.g, left.g, right.g)
    // frente com vão da porta
    const DOOR_W = 1.0
    const doorX0 = CX - W / 2 + 0.3
    const fl = panel(new THREE.BoxGeometry(0.3, H, 0.1), 0xe2e8f0, 0.12)
    fl.g.position.set(CX - W / 2 + 0.15, H / 2, D / 2)
    const fr = panel(new THREE.BoxGeometry(W - 0.3 - DOOR_W, H, 0.1), 0xe2e8f0, 0.12)
    fr.g.position.set(doorX0 + DOOR_W + (W - 0.3 - DOOR_W) / 2, H / 2, D / 2)
    const ft = panel(new THREE.BoxGeometry(DOOR_W, H - 2.05, 0.1), 0xe2e8f0, 0.12)
    ft.g.position.set(doorX0 + DOOR_W / 2, 2.05 + (H - 2.05) / 2, D / 2)
    scene.add(fl.g, fr.g, ft.g)
    const doorPivot = new THREE.Group()
    doorPivot.position.set(doorX0, 0, D / 2)
    const door = panel(new THREE.BoxGeometry(DOOR_W, 2.05, 0.1), 0x94a3b8, 0.35, 0.8)
    door.g.position.set(DOOR_W / 2, 1.025, 0)
    doorPivot.add(door.g)
    scene.add(doorPivot)
    // ar quente entrando pela porta
    const IN_N = 60
    const inGeo = new THREE.BufferGeometry()
    const inPos = new Float32Array(IN_N * 3)
    const inAge = new Float32Array(IN_N).map(() => Math.random())
    inGeo.setAttribute('position', new THREE.BufferAttribute(inPos, 3))
    const inMat = new THREE.PointsMaterial({ color: 0xfb923c, size: 0.06, transparent: true, opacity: 0, depthWrite: false })
    scene.add(new THREE.Points(inGeo, inMat))

    // produto (pallets)
    for (const [x, z, h] of [[-1.4, -0.6, 0.9], [-0.6, -0.6, 1.2], [0.3, -0.6, 0.7], [0.4, 0.4, 1.0]] as const) {
      const b = panel(new THREE.BoxGeometry(0.7, h, 0.7), 0x475569, 0.35, 0.35)
      b.g.position.set(x, h / 2 + 0.05, z)
      scene.add(b.g)
    }

    // ---------- evaporador ----------
    const EV = new THREE.Vector3(CX, 2.1, -D / 2 + 0.3)
    const evap = panel(new THREE.BoxGeometry(1.4, 0.42, 0.45), 0xe2e8f0, 0.12, 0.7)
    evap.g.position.copy(EV)
    scene.add(evap.g)
    const finPts: number[] = []
    for (let i = 0; i <= 26; i++) {
      const x = EV.x - 0.68 + (i * 1.36) / 26
      finPts.push(x, EV.y - 0.19, EV.z - 0.2, x, EV.y + 0.19, EV.z - 0.2)
    }
    const finGeo = new THREE.BufferGeometry()
    finGeo.setAttribute('position', new THREE.Float32BufferAttribute(finPts, 3))
    const finMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 })
    scene.add(new THREE.LineSegments(finGeo, finMat))
    const frostMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0, depthWrite: false })
    const frostMesh = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.38, 0.06), frostMat)
    frostMesh.position.set(EV.x, EV.y, EV.z - 0.19)
    scene.add(frostMesh)
    const heaterMat = new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0 })
    const hp: number[] = []
    for (const y of [-0.12, 0, 0.12]) hp.push(EV.x - 0.66, EV.y + y, EV.z - 0.12, EV.x + 0.66, EV.y + y, EV.z - 0.12)
    const hGeo = new THREE.BufferGeometry()
    hGeo.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3))
    scene.add(new THREE.LineSegments(hGeo, heaterMat))
    const fans: THREE.Group[] = []
    const bladeMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
    for (const dx of [-0.35, 0.35]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.16, 32), new THREE.MeshBasicMaterial({ color: EDGE, side: THREE.DoubleSide }))
      ring.position.set(EV.x + dx, EV.y, EV.z + 0.226)
      scene.add(ring)
      const f = new THREE.Group()
      f.position.copy(ring.position)
      for (let b = 0; b < 4; b++) {
        const bl = new THREE.Mesh(new THREE.CircleGeometry(0.14, 10, -0.22, 0.44), bladeMat)
        bl.rotation.z = (b * Math.PI) / 2
        f.add(bl)
      }
      scene.add(f)
      fans.push(f)
    }
    const AIR_N = 90
    const airGeo = new THREE.BufferGeometry()
    const airPos = new Float32Array(AIR_N * 3)
    const airAge = new Float32Array(AIR_N).map(() => Math.random())
    airGeo.setAttribute('position', new THREE.BufferAttribute(airPos, 3))
    const airMat = new THREE.PointsMaterial({ color: 0x67e8f9, size: 0.045, transparent: true, opacity: 0.7, depthWrite: false })
    scene.add(new THREE.Points(airGeo, airMat))

    // ---------- controlador (display com textura) ----------
    const cv = document.createElement('canvas')
    cv.width = 256
    cv.height = 128
    const ctx = cv.getContext('2d')!
    const tex = new THREE.CanvasTexture(cv)
    const ctrl = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.21), new THREE.MeshBasicMaterial({ map: tex }))
    const CTRL = new THREE.Vector3(doorX0 + DOOR_W + 0.45, 1.45, D / 2 + 0.06)
    ctrl.position.copy(CTRL)
    scene.add(ctrl)
    const ctrlBox = panel(new THREE.BoxGeometry(0.48, 0.27, 0.05), 0x0f172a, 0.9, 0.8)
    ctrlBox.g.position.copy(CTRL).add(new THREE.Vector3(0, 0, -0.03))
    scene.add(ctrlBox.g)
    let lastDisp = ''
    const drawDisplay = (t: number, code: string, comp: boolean, def: boolean, doorOpen: boolean) => {
      const key = `${t.toFixed(1)}|${code}|${comp}|${def}|${doorOpen}`
      if (key === lastDisp) return
      lastDisp = key
      ctx.fillStyle = '#020617'
      ctx.fillRect(0, 0, 256, 128)
      ctx.font = 'bold 64px monospace'
      ctx.fillStyle = code ? '#f87171' : '#f7e921'
      ctx.textAlign = 'right'
      ctx.fillText(code || `${t.toFixed(1)}`, 236, 74)
      ctx.font = '18px monospace'
      ctx.textAlign = 'left'
      ctx.fillStyle = comp ? '#4ade80' : '#334155'
      ctx.fillText('❄ COMP', 12, 112)
      ctx.fillStyle = def ? '#f87171' : '#334155'
      ctx.fillText('♨ DEF', 104, 112)
      ctx.fillStyle = doorOpen ? '#fbbf24' : '#334155'
      ctx.fillText('▯ PORTA', 172, 112)
      tex.needsUpdate = true
    }

    // ---------- unidade condensadora ----------
    const CU = new THREE.Vector3(2.9, 0.5, 0)
    const cu = panel(new THREE.BoxGeometry(1.3, 0.8, 0.7), 0xe2e8f0, 0.07, 0.6)
    cu.g.position.copy(CU)
    scene.add(cu.g)
    const cfanC = new THREE.Vector3(CU.x - 0.25, CU.y + 0.02, CU.z + 0.351)
    const cring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.29, 40), new THREE.MeshBasicMaterial({ color: EDGE, side: THREE.DoubleSide }))
    cring.position.copy(cfanC)
    scene.add(cring)
    const cfan = new THREE.Group()
    cfan.position.copy(cfanC).add(new THREE.Vector3(0, 0, -0.03))
    for (let b = 0; b < 3; b++) {
      const bl = new THREE.Mesh(new THREE.CircleGeometry(0.26, 12, -0.25, 0.5), bladeMat)
      bl.rotation.z = (b * 2 * Math.PI) / 3
      cfan.add(bl)
    }
    scene.add(cfan)
    const cfinPts: number[] = []
    for (let i = 0; i <= 30; i++) {
      const x = CU.x - 0.63 + (i * 1.26) / 30
      cfinPts.push(x, CU.y - 0.36, CU.z - 0.34, x, CU.y + 0.36, CU.z - 0.34)
    }
    const cfinGeo = new THREE.BufferGeometry()
    cfinGeo.setAttribute('position', new THREE.Float32BufferAttribute(cfinPts, 3))
    const cfinMat = new THREE.LineBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.5 })
    scene.add(new THREE.LineSegments(cfinGeo, cfinMat))
    // sujeira do condensador
    const DIRT_N = 80
    const dirt = new THREE.InstancedMesh(new THREE.CircleGeometry(0.05, 6), new THREE.MeshBasicMaterial({ color: 0x8b5a2b, side: THREE.DoubleSide }), DIRT_N)
    const dummy = new THREE.Object3D()
    for (let i = 0; i < DIRT_N; i++) {
      dummy.position.set(CU.x - 0.6 + Math.random() * 1.2, CU.y - 0.33 + Math.random() * 0.66, CU.z - 0.36)
      dummy.rotation.set(0, 0, Math.random() * 3)
      dummy.scale.setScalar(0.8 + Math.random())
      dummy.updateMatrix()
      dirt.setMatrixAt(i, dummy.matrix)
    }
    dirt.count = 0
    dirt.frustumCulled = false
    scene.add(dirt)
    // compressor
    const compMat = new THREE.MeshBasicMaterial({ color: 0x475569 })
    const comp = new THREE.Group()
    comp.position.set(CU.x + 0.35, 0.42, CU.z + 0.05)
    const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.45, 24), compMat)
    comp.add(cb, new THREE.LineSegments(new THREE.EdgesGeometry(cb.geometry, 30), new THREE.LineBasicMaterial({ color: 0xcbd5e1 })))
    scene.add(comp)
    // reservatório de líquido (horizontal) com nível
    const REC = new THREE.Vector3(CU.x - 0.05, 0.2, CU.z - 0.12)
    const recShell = panel(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 24), 0xe2e8f0, 0.12, 0.8)
    recShell.g.rotation.z = Math.PI / 2
    recShell.g.position.copy(REC)
    scene.add(recShell.g)
    const liqMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8 })
    const liq = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1, 0.16), liqMat)
    scene.add(liq)
    // visor de líquido
    const sightMat = new THREE.MeshBasicMaterial({ color: 0x22c55e })
    const sight = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), sightMat)
    sight.position.set(CU.x - 0.75, 0.32, CU.z + 0.1)
    scene.add(sight)

    // ---------- tubulação (sobe pela lateral, passa pelo teto, entra no evaporador) ----------
    const sucPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(EV.x + 0.7, EV.y, EV.z),
      new THREE.Vector3(CX + W / 2 - 0.1, EV.y + 0.05, EV.z),
      new THREE.Vector3(CX + W / 2 + 0.1, H + 0.15, EV.z),
      new THREE.Vector3(CU.x - 0.8, H + 0.15, -0.1),
      new THREE.Vector3(CU.x - 0.8, 0.9, -0.1),
      new THREE.Vector3(comp.position.x, 0.7, comp.position.z),
    ], false, 'catmullrom', 0.08)
    const liqPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(REC.x - 0.4, REC.y, REC.z),
      new THREE.Vector3(CU.x - 0.75, 0.32, CU.z + 0.1),
      new THREE.Vector3(CU.x - 0.95, 0.5, 0.15),
      new THREE.Vector3(CU.x - 0.95, H + 0.3, 0.1),
      new THREE.Vector3(CX + W / 2 + 0.1, H + 0.3, EV.z + 0.15),
      new THREE.Vector3(CX + W / 2 - 0.1, EV.y - 0.1, EV.z + 0.15),
      new THREE.Vector3(EV.x + 0.7, EV.y - 0.12, EV.z + 0.1),
    ], false, 'catmullrom', 0.08)
    const sucMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 })
    const liqTubeMat = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.35 })
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(sucPath, 120, 0.03, 8), sucMat))
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(liqPath, 120, 0.02, 8), liqTubeMat))
    const FLOW = 36
    const flowGeo = new THREE.SphereGeometry(0.028, 8, 8)
    const fsMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    const flMat = new THREE.MeshBasicMaterial({ color: 0xf97316 })
    const fs = new THREE.InstancedMesh(flowGeo, fsMat, FLOW)
    const fl2 = new THREE.InstancedMesh(flowGeo, flMat, FLOW)
    fs.frustumCulled = fl2.frustumCulled = false
    scene.add(fs, fl2)
    // bolhas (flash gas) no visor
    const BUB = 14
    const bub = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), BUB)
    bub.frustumCulled = false
    scene.add(bub)

    // ---------- sensores ----------
    const sensorMat = new THREE.MeshBasicMaterial({ color: YELLOW })
    const SENS = {
      tbox: new THREE.Vector3(CX + 0.9, 1.4, 0.2),
      s2: new THREE.Vector3(EV.x - 0.5, EV.y - 0.25, EV.z - 0.15),
      pLow: new THREE.Vector3(comp.position.x - 0.05, 0.75, comp.position.z),
      pHigh: new THREE.Vector3(REC.x + 0.42, REC.y + 0.08, REC.z),
      tLiq: new THREE.Vector3(CU.x - 0.95, 0.75, 0.15),
      door: new THREE.Vector3(doorX0 + DOOR_W - 0.05, 1.9, D / 2 + 0.08),
      clamp: new THREE.Vector3(CU.x + 0.65, 0.95, CU.z + 0.2),
    }
    Object.values(SENS).forEach(v => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), sensorMat)
      s.position.copy(v)
      scene.add(s)
    })
    const clampRing = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 20), sensorMat)
    clampRing.position.copy(SENS.clamp)
    clampRing.rotation.x = Math.PI / 2
    scene.add(clampRing)
    const cable = new THREE.CatmullRomCurve3([new THREE.Vector3(CU.x + 0.65, 0.6, CU.z + 0.2), new THREE.Vector3(CU.x + 0.65, 1.4, CU.z + 0.2), new THREE.Vector3(CU.x + 0.4, 1.9, -0.6)])
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(cable, 30, 0.01, 6), new THREE.MeshBasicMaterial({ color: 0x64748b })))

    // ---------- rótulos ----------
    const mk = (key: string, pos: THREE.Vector3): Label => {
      const el = document.createElement('div')
      el.className = 'absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[10px] sm:text-[11px] pointer-events-none border'
      layer.appendChild(el)
      return { key, pos, el }
    }
    const labels = [
      mk('evap', EV.clone().add(new THREE.Vector3(0, 0.3, 0))),
      mk('tbox', SENS.tbox.clone().add(new THREE.Vector3(0, 0.08, 0))),
      mk('door', SENS.door.clone().add(new THREE.Vector3(-0.4, 0.3, 0))),
      mk('ctrl', CTRL.clone().add(new THREE.Vector3(0, 0.2, 0))),
      mk('rec', REC.clone().add(new THREE.Vector3(0, -0.12, 0.25))),
      mk('sight', sight.position.clone().add(new THREE.Vector3(-0.1, 0.1, 0.05))),
      mk('comp', comp.position.clone().add(new THREE.Vector3(0.05, 0.42, 0.1))),
      mk('cond', CU.clone().add(new THREE.Vector3(-0.3, 0.55, 0))),
      mk('clamp', SENS.clamp.clone().add(new THREE.Vector3(0.1, 0.1, 0))),
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
    let phase = 0
    let fanA = 0
    let cfanA = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = THREE.MathUtils.clamp((now - last) / 1000, 0, 0.05)
      last = now
      const anim = reduce ? 0 : 1
      const { run, p } = live.current
      const m = run.m!
      const i = Math.min(run.minutes - 1, Math.max(0, Math.floor(tRef.current)))
      const tBox = m.tBox[i]
      const isComp = m.comp[i] === 1
      const isDef = m.def[i] === 1
      // porta: mantém aberta alguns minutos visuais para enxergar
      let doorOpen = false
      for (let k = 0; k < 2 && i - k >= 0; k++) if (m.door[i - k]) doorOpen = true
      const frost = m.frost[i]
      const charge = m.charge[i]
      const day = i / 1440
      const foul = Math.min(0.85, (p.condFoul / 100) * day)

      if (live.current.moving > 0) {
        const g = VIEWS[live.current.view]
        const k = 1 - Math.exp(-dt * 5)
        camera.position.lerp(v.set(g.pos[0], g.pos[1], g.pos[2]), k)
        controls.target.lerp(v.set(g.target[0], g.target[1], g.target[2]), k)
        live.current.moving -= dt
      }

      // porta
      const goal = doorOpen ? -1.2 : 0
      doorPivot.rotation.y += (goal - doorPivot.rotation.y) * Math.min(1, dt * 6)
      inMat.opacity = doorOpen ? 0.7 : Math.max(0, inMat.opacity - dt)
      for (let k = 0; k < IN_N; k++) {
        inAge[k] += dt * 0.7 * anim
        if (inAge[k] > 1) inAge[k] -= 1
        const a = inAge[k]
        inPos[k * 3] = doorX0 + 0.1 + (k % 8) * 0.11
        inPos[k * 3 + 1] = 1.8 - a * 1.2 + ((k * 13) % 7) * 0.05
        inPos[k * 3 + 2] = D / 2 + 0.4 - a * 1.4
      }
      inGeo.attributes.position.needsUpdate = true

      // evaporador: gelo, resistência, ventiladores, ar
      frostMat.opacity = Math.min(0.92, frost / 2.2)
      frostMesh.scale.z = 1 + Math.min(3, frost * 1.5)
      heaterMat.opacity = isDef ? 0.6 + 0.4 * Math.sin(now / 120) : 0
      tempColor(m.tCoil[i], col)
      finMat.color.copy(col)
      const fanOn = !isDef
      fanA += dt * (fanOn ? 12 / (1 + frost * 0.4) : 0) * anim
      fans.forEach(f => (f.rotation.z = fanA))
      airMat.opacity = fanOn ? 0.7 / (1 + frost * 0.5) : 0
      tempColor(m.tCoil[i] + 3, col)
      airMat.color.copy(col)
      for (let k = 0; k < AIR_N; k++) {
        airAge[k] += dt * 0.6 * anim
        if (airAge[k] > 1) airAge[k] -= 1
        const a = airAge[k]
        const lane = (k % 10) / 9 - 0.5
        airPos[k * 3] = EV.x + lane * 1.1
        airPos[k * 3 + 1] = EV.y - a * 1.4
        airPos[k * 3 + 2] = EV.z + 0.3 + a * 2.2
      }
      airGeo.attributes.position.needsUpdate = true

      // unidade condensadora
      dirt.count = Math.round(DIRT_N * Math.min(1, foul / 0.7))
      cfanA += dt * (isComp ? 14 : 0) * anim
      cfan.rotation.z = -cfanA
      tempColor(Number.isFinite(m.tc[i]) ? m.tc[i] : m.tExt[i], col)
      cfinMat.color.copy(col)
      tempColor(Number.isFinite(m.tDis[i]) ? m.tDis[i] - 25 : m.tExt[i], col)
      compMat.color.copy(col).multiplyScalar(0.75)
      comp.position.x = CU.x + 0.35 + (isComp ? Math.sin(now / 11) * 0.004 * anim : 0)

      // reservatório: líquido acima do joelho; visor com bolhas abaixo
      const recFrac = Math.min(1, Math.max(0.02, (charge - KNEE) / (1 - KNEE)))
      const hLiq = 0.18 * recFrac
      liq.scale.y = hLiq
      liq.position.set(REC.x, REC.y - 0.09 + hLiq / 2, REC.z)
      liqMat.color.set(recFrac < 0.15 ? 0xf87171 : 0x38bdf8)
      const flash = charge < KNEE
      sightMat.color.set(flash ? 0xfbbf24 : 0x22c55e)
      bub.count = flash && isComp ? BUB : 0
      for (let k = 0; k < bub.count; k++) {
        dummy.position.copy(sight.position).add(v.set(Math.sin(now / 200 + k) * 0.03, Math.cos(now / 170 + k * 2) * 0.03, 0.04))
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        bub.setMatrixAt(k, dummy.matrix)
      }
      bub.instanceMatrix.needsUpdate = true

      // fluxo de gás
      phase += dt * (isComp ? 0.12 : 0) * anim
      const nV = Math.max(5, Math.round(FLOW * Math.min(1, charge + 0.1)))
      fs.count = isComp ? nV : 0
      fl2.count = isComp ? nV : 0
      for (let k = 0; k < fs.count; k++) {
        const u = (((k / nV + phase) % 1) + 1) % 1
        dummy.scale.setScalar(1)
        dummy.position.copy(sucPath.getPointAt(u))
        dummy.updateMatrix()
        fs.setMatrixAt(k, dummy.matrix)
        dummy.position.copy(liqPath.getPointAt(u))
        dummy.updateMatrix()
        fl2.setMatrixAt(k, dummy.matrix)
      }
      fs.instanceMatrix.needsUpdate = true
      fl2.instanceMatrix.needsUpdate = true
      tempColor(Number.isFinite(m.te[i]) ? m.te[i] : m.tCoil[i], col)
      fsMat.color.copy(col)
      sucMat.color.copy(col)
      tempColor(Number.isFinite(m.tc[i]) ? m.tc[i] - (m.sc[i] ?? 0) : m.tExt[i], col)
      flMat.color.copy(col)
      liqTubeMat.color.copy(col)

      // controlador: alarme ativo neste minuto (o mais recente nas últimas 2 h)
      let code = ''
      for (let a = run.alarms.length - 1; a >= 0; a--) {
        const al = run.alarms[a]
        if (al.t <= i && i - al.t < 120) {
          code = al.code
          break
        }
        if (al.t < i - 120) break
      }
      drawDisplay(tBox, code, isComp, isDef, doorOpen)

      controls.update()
      renderer.render(scene, camera)

      // rótulos
      const w = mount.clientWidth
      const h = mount.clientHeight
      const sh = m.sh[i]
      const texts: Record<string, [string, 'ok' | 'bad' | 'info' | 'hide']> = {
        evap: isDef
          ? [`♨ Degelo · gelo ${frost.toFixed(1)} kg`, 'bad']
          : frost > 1.6
            ? [`⚠ Gelo ${frost.toFixed(1)} kg`, 'bad']
            : [`Evaporador · gelo ${frost.toFixed(1)} kg`, 'ok'],
        tbox: [`T caixa ${tBox.toFixed(1)} °C`, tBox > 8 ? 'bad' : 'info'],
        door: doorOpen ? ['Porta aberta', 'bad'] : ['', 'hide'],
        ctrl: code ? [`Alarme ${code}`, 'bad'] : ['Controlador', 'ok'],
        rec: [`Reservatório · carga ${Math.round(charge * 100)}%`, charge < KNEE + 0.05 ? 'bad' : 'ok'],
        sight: flash ? ['⚠ Bolhas no visor', 'bad'] : ['Visor ok', 'ok'],
        comp: isComp ? [`Compressor · SH ${Number.isFinite(sh) ? sh.toFixed(0) : '–'} K`, Number.isFinite(sh) && (sh > 20 || sh < 2) ? 'bad' : 'ok'] : ['Compressor parado', 'ok'],
        cond: foul > 0.05 ? [`⚠ Condensador ${Math.round(foul * 100)}% sujo`, 'bad'] : ['Unidade condensadora', 'ok'],
        clamp: [`Alicate (quadro) · ${(m.pElec[i] / 1000).toFixed(2)} kW`, 'info'],
      }
      for (const L of labels) {
        const [txt, kind] = texts[L.key]
        v.copy(L.pos).project(camera)
        const vis = kind !== 'hide' && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1
        L.el.style.display = vis ? 'block' : 'none'
        if (!vis) continue
        L.el.style.left = `${((v.x + 1) / 2) * w}px`
        L.el.style.top = `${((1 - v.y) / 2) * h}px`
        if (L.el.textContent !== txt) L.el.textContent = txt
        if (L.el.dataset.kind !== kind) {
          L.el.dataset.kind = kind
          L.el.className =
            'absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[10px] sm:text-[11px] pointer-events-none border ' +
            (kind === 'bad' ? 'bg-red-500/15 border-red-400/60 text-red-300' : kind === 'info' ? 'bg-signal/15 border-signal/60 text-signal' : 'bg-black/50 border-white/15 text-white/75')
        }
      }
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      labels.forEach(L => L.el.remove())
      scene.traverse(o => {
        const mesh = o as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach(x => x.dispose())
        else mat?.dispose()
      })
      tex.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [tRef])

  return (
    <div className="relative rounded-xl border border-white/10 bg-[radial-gradient(ellipse_at_top,#111827,#05080d)] overflow-hidden">
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-3 py-2 font-mono text-[11px] text-white/50 pointer-events-none">
        <span>vista 3D · arraste para girar</span>
        <span className="hidden sm:flex items-center gap-3">
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-sky-400 inline-block" />frio</span>
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-orange-400 inline-block" />quente</span>
          <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-signal inline-block" />sensor</span>
        </span>
      </div>
      <div ref={mountRef} className="relative w-full aspect-[4/3] sm:aspect-[16/9] cursor-grab active:cursor-grabbing" />
      <div ref={labelsRef} className="absolute inset-0 pointer-events-none" />
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
    </div>
  )
}
