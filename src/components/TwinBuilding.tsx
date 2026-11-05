'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { STATUS_COLOR, type TwinEvent, type UnitStatus } from '@/lib/twin'

type Props = {
  onEvent?: (e: TwinEvent) => void
  className?: string
}

// Três torres com um ponto por unidade. Tudo é procedural: nenhuma tela ou modelo real.
const TOWERS = [
  { x: -3.1, floors: 7, cols: 2, label: 'A' },
  { x: 0, floors: 6, cols: 2, label: 'B' },
  { x: 3.1, floors: 8, cols: 2, label: 'C' },
]
const FLOOR_H = 0.62
const TOWER_W = 1.9
const TOWER_D = 1.3

function pickStatus(): UnitStatus {
  const r = Math.random()
  if (r < 0.72) return 'ok'
  if (r < 0.84) return 'warn'
  if (r < 0.89) return 'alert'
  return 'off'
}

export default function TwinBuilding({ onEvent, className }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      return // sem WebGL: o fundo do hero continua bonito sozinho
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x080c14, 14, 26)

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
    camera.position.set(0, 4.2, 15)
    camera.lookAt(0, 2.1, 0)

    const world = new THREE.Group()
    scene.add(world)

    // Chão: grade de pontos em disco
    const groundPts: number[] = []
    for (let x = -9; x <= 9; x += 0.6) {
      for (let z = -9; z <= 9; z += 0.6) {
        if (x * x + z * z < 80) groundPts.push(x, 0, z)
      }
    }
    const groundGeo = new THREE.BufferGeometry()
    groundGeo.setAttribute('position', new THREE.Float32BufferAttribute(groundPts, 3))
    world.add(new THREE.Points(groundGeo, new THREE.PointsMaterial({ color: 0x334155, size: 0.035, transparent: true, opacity: 0.7 })))

    const edgeMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.28 })
    const slabMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.1 })
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.55, depthWrite: false })

    type Unit = { id: string; mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; status: UnitStatus; flash: number; pos: THREE.Vector3 }
    const units: Unit[] = []
    const dotGeo = new THREE.SphereGeometry(0.075, 12, 12)

    TOWERS.forEach(t => {
      const h = t.floors * FLOOR_H + 0.35
      const tower = new THREE.Group()
      tower.position.x = t.x

      // Volume e arestas
      const box = new THREE.BoxGeometry(TOWER_W, h, TOWER_D)
      box.translate(0, h / 2, 0)
      tower.add(new THREE.Mesh(box, glassMat))
      tower.add(new THREE.LineSegments(new THREE.EdgesGeometry(box), edgeMat))

      // Lajes
      for (let f = 1; f < t.floors + 1; f++) {
        const y = f * FLOOR_H
        const pts = [
          new THREE.Vector3(-TOWER_W / 2, y, TOWER_D / 2),
          new THREE.Vector3(TOWER_W / 2, y, TOWER_D / 2),
          new THREE.Vector3(TOWER_W / 2, y, -TOWER_D / 2),
          new THREE.Vector3(-TOWER_W / 2, y, -TOWER_D / 2),
          new THREE.Vector3(-TOWER_W / 2, y, TOWER_D / 2),
        ]
        tower.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), slabMat))
      }

      // Unidades (ponto na fachada frontal)
      for (let f = 0; f < t.floors; f++) {
        for (let c = 0; c < t.cols; c++) {
          const status = pickStatus()
          const mat = new THREE.MeshBasicMaterial({ color: STATUS_COLOR[status], transparent: true, opacity: 0.9 })
          const mesh = new THREE.Mesh(dotGeo, mat)
          const x = (c - (t.cols - 1) / 2) * (TOWER_W / t.cols)
          const y = f * FLOOR_H + FLOOR_H / 2 + 0.05
          mesh.position.set(x, y, TOWER_D / 2 + 0.02)
          tower.add(mesh)
          const pos = new THREE.Vector3(t.x + x, y, TOWER_D / 2 + 0.02)
          units.push({ id: `${t.label}-${String(f + 1)}0${c + 1}`, mesh, mat, status, flash: 0, pos })
        }
      }

      // Caixa d'água no topo
      const tank = new THREE.CylinderGeometry(0.28, 0.28, 0.32, 18, 1, true)
      tank.translate(0, h + 0.16, -0.2)
      tower.add(new THREE.LineSegments(new THREE.EdgesGeometry(tank, 30), edgeMat))

      world.add(tower)
    })

    // Anéis de transmissão (pacote subindo da unidade para a rede)
    type Ring = { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number }
    const rings: Ring[] = []
    const ringGeo = new THREE.RingGeometry(0.12, 0.15, 32)
    function emitRing(u: Unit) {
      const mat = new THREE.MeshBasicMaterial({ color: STATUS_COLOR[u.status], transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
      const mesh = new THREE.Mesh(ringGeo, mat)
      mesh.position.copy(u.pos)
      mesh.position.z += 0.01
      world.add(mesh)
      rings.push({ mesh, mat, t: 0 })
    }

    // Tamanho
    function resize() {
      const w = mount!.clientWidth
      const h = mount!.clientHeight
      renderer.setSize(w, h, false)
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      camera.aspect = w / h
      // Em telas estreitas, recua a câmera para caber as três torres
      camera.position.z = w < 520 ? 21 : 15
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    // Arrastar para girar
    let targetRot = -0.35
    let rot = targetRot
    let dragging = false
    let lastX = 0
    const el = renderer.domElement
    el.style.touchAction = 'pan-y'
    el.style.cursor = 'grab'
    const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; el.style.cursor = 'grabbing' }
    const move = (e: PointerEvent) => {
      if (!dragging) return
      targetRot += (e.clientX - lastX) * 0.008
      lastX = e.clientX
    }
    const up = () => { dragging = false; el.style.cursor = 'grab' }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)

    // Telemetria simulada
    const tick = window.setInterval(() => {
      const u = units[Math.floor(Math.random() * units.length)]
      const status = pickStatus()
      u.status = status
      u.mat.color.set(STATUS_COLOR[status])
      u.flash = 1
      if (status !== 'off') emitRing(u)
      const liters = status === 'off' ? 0 : status === 'alert' ? 180 + Math.round(Math.random() * 120) : status === 'warn' ? 90 + Math.round(Math.random() * 60) : Math.round(Math.random() * 60)
      onEventRef.current?.({ unit: u.id, status, liters })
    }, reduceMotion ? 2400 : 1100)

    // Loop
    let raf = 0
    let visible = true
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
    io.observe(mount)
    const clock = new THREE.Clock()

    function frame() {
      raf = requestAnimationFrame(frame)
      if (!visible) return
      const dt = Math.min(clock.getDelta(), 0.05)
      if (!dragging && !reduceMotion) targetRot += dt * 0.06
      rot += (targetRot - rot) * 0.08
      world.rotation.y = rot

      const time = clock.elapsedTime
      units.forEach((u, i) => {
        u.flash = Math.max(0, u.flash - dt * 1.6)
        const base = u.status === 'off' ? 0.35 : 0.75 + Math.sin(time * 2 + i) * 0.12
        u.mat.opacity = Math.min(1, base + u.flash)
        const s = 1 + u.flash * 0.9
        u.mesh.scale.setScalar(s)
      })

      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]
        r.t += dt
        const s = 1 + r.t * 5
        r.mesh.scale.setScalar(s)
        r.mat.opacity = Math.max(0, 0.8 - r.t * 0.9)
        if (r.t > 0.9) {
          world.remove(r.mesh)
          r.mat.dispose()
          rings.splice(i, 1)
        }
      }

      renderer.render(scene, camera)
    }
    frame()

    return () => {
      cancelAnimationFrame(raf)
      clearInterval(tick)
      ro.disconnect()
      io.disconnect()
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      scene.traverse(obj => {
        const o = obj as THREE.Mesh
        o.geometry?.dispose()
        const m = o.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(m)) m.forEach(x => x.dispose())
        else m?.dispose()
      })
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} className={className} aria-hidden />
}
