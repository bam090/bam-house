import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Quaternion, Vector3 } from 'three'
import type { Group } from 'three'
import { catFocus } from './Occlusion'
import { palette } from './palette'
import { DECK_HEIGHT, FLOOR_HEIGHT, groundHeight, isWalkable } from './walkable'

// 고양이가 밀어서 굴릴 수 있는 장난감 공 둘이다.
// 매 화면마다 고양이가 공에 닿았는지 보고 닿았으면 고양이가 움직이는 방향으로 공을 민다.
// 공은 마찰로 점점 느려지고 벽이나 가구에 닿으면 튕겨 나온다.
// 바닥이 낮아지는 곳(거실 계단과 데크)으로 굴러가면 중력으로 떨어져서 아래 바닥에 내려앉는다.

/** 거실 바닥의 장면 높이. 공을 그리는 group이 이 높이에 놓여 있다. */
const FLOOR_Y = DECK_HEIGHT + FLOOR_HEIGHT
/** 고양이 몸 가운데에서 공 가운데까지 이 거리 안이면 닿은 것으로 본다. */
const TOUCH = 0.3
/** 공이 바닥에서 구를 때 1초에 잃는 빠르기의 비율. 클수록 빨리 멈춘다. */
const FRICTION = 1.4
/** 벽에 튕길 때 남는 빠르기의 비율 */
const BOUNCE = 0.5
/** 고양이가 민 빠르기에 곱하는 값. 1보다 크면 공이 고양이보다 조금 빨리 굴러간다. */
const KICK = 1.25
/** 1초마다 아래로 당기는 속도의 크기. 고양이와 같은 값이다. */
const GRAVITY = 14
/** 거실 러그의 범위와 두께. 러그 위에서는 공을 러그 두께만큼 띄워서 그린다. */
const RUG = { minX: -1.6, maxX: 4.6, minZ: -3.0, maxZ: 2.2, top: 0.021 } as const

interface Ball {
  x: number
  z: number
  /** 공 아랫면의 장면 높이 */
  y: number
  vx: number
  vz: number
  /** 위아래 빠르기. 떨어질 때 음수다. */
  vy: number
  radius: number
}

// 공 아래 바닥의 높이. 가구 범위는 공의 반지름 정도(0.06m)만 넓혀서 본다.
// 고양이처럼 0.22m를 넓히면 공이 가구 앞에서 너무 일찍 튕긴다.
function floorUnder(x: number, z: number, y: number) {
  return groundHeight(x, z, y + 0.03, false, 0.06)
}

// 공이 높이 y로 그 자리에 갈 수 있는지 본다. 걷는 자리 안이고 공보다 높은 가구가 없어야 한다.
// 바닥이 공보다 낮으면 갈 수 있다. 그 자리에서 떨어진다.
function free(x: number, z: number, y: number) {
  return isWalkable(x, z, y) && floorUnder(x, z, y) <= y + 0.03
}

// 매 화면마다 새 객체를 만들지 않도록 계산용 객체를 미리 만든다.
const axis = new Vector3()
const spin = new Quaternion()

export function Toys() {
  // 줄무늬 공과 털실 공. 화면에 그릴 group을 공마다 하나씩 잡는다.
  const balls = useRef<Ball[]>([
    { x: 3.6, z: -2.25, y: FLOOR_Y, vx: 0, vz: 0, vy: 0, radius: 0.06 },
    { x: 3.78, z: -2.38, y: FLOOR_Y, vx: 0, vz: 0, vy: 0, radius: 0.05 },
  ])
  const groups = useRef<(Group | null)[]>([])
  const lastCat = useRef<Vector3 | null>(null)

  // 개발 서버에서만 브라우저 콘솔에 __toyBalls를 연다. 화면 확인할 때 공의 자리와 빠르기를 읽고 바꾸는 데 쓴다.
  // import.meta.env.DEV는 npm run dev일 때만 true라서 배포한 사이트에는 생기지 않는다.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const target = window as unknown as Record<string, unknown>
    target.__toyBalls = balls.current
    return () => {
      delete target.__toyBalls
    }
  }, [])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    // 고양이가 이번 화면에 움직인 거리로 빠르기를 구한다. 순간 이동(화면 확인 함수)처럼 크게 튀면 무시한다.
    const previous = lastCat.current ?? catFocus.clone()
    const catVX = (catFocus.x - previous.x) / Math.max(delta, 0.001)
    const catVZ = (catFocus.z - previous.z) / Math.max(delta, 0.001)
    const teleported = Math.hypot(catFocus.x - previous.x, catFocus.z - previous.z) > 0.5
    lastCat.current = catFocus.clone()
    const catFoot = catFocus.y - 0.35

    balls.current.forEach((ball, index) => {
      const onGround = ball.y <= floorUnder(ball.x, ball.z, ball.y) + 0.001

      // 1. 고양이가 닿으면 민다. 고양이 발과 공이 같은 바닥에 있을 때만 민다.
      const dx = ball.x - catFocus.x
      const dz = ball.z - catFocus.z
      const distance = Math.hypot(dx, dz)
      const catSpeed = Math.hypot(catVX, catVZ)
      if (!teleported && Math.abs(catFoot - ball.y) < 0.1 && distance < TOUCH && catSpeed > 0.3) {
        // 고양이가 공 쪽으로 다가올 때만 민다. 공에서 멀어지는 중이면 그대로 둔다.
        if (catVX * dx + catVZ * dz > 0) {
          ball.vx = catVX * KICK
          ball.vz = catVZ * KICK
        }
        // 공을 고양이 몸 밖으로 밀어내서 서로 겹치지 않게 한다.
        const push = (TOUCH - distance) / Math.max(distance, 0.001)
        const nx = ball.x + dx * push
        const nz = ball.z + dz * push
        if (free(nx, nz, ball.y)) {
          ball.x = nx
          ball.z = nz
        }
      }

      // 2. 굴러간다. 막히면 막힌 쪽 빠르기를 거꾸로 돌려서 튕긴다.
      const stepX = ball.vx * delta
      const stepZ = ball.vz * delta
      if (free(ball.x + stepX, ball.z + stepZ, ball.y)) {
        ball.x += stepX
        ball.z += stepZ
      } else if (free(ball.x + stepX, ball.z, ball.y)) {
        ball.x += stepX
        ball.vz *= -BOUNCE
      } else if (free(ball.x, ball.z + stepZ, ball.y)) {
        ball.z += stepZ
        ball.vx *= -BOUNCE
      } else {
        ball.vx *= -BOUNCE
        ball.vz *= -BOUNCE
      }

      // 3. 발밑 바닥이 공보다 낮으면 떨어진다. 바닥에 닿으면 조금 튀어 올랐다가 내려앉는다.
      const ground = floorUnder(ball.x, ball.z, ball.y)
      if (ball.y > ground + 0.001 || ball.vy > 0) {
        ball.vy -= GRAVITY * delta
        ball.y += ball.vy * delta
        if (ball.y <= ground) {
          ball.y = ground
          ball.vy = ball.vy < -1 ? -ball.vy * 0.3 : 0
        }
      } else {
        ball.y = ground
        ball.vy = 0
      }

      // 4. 바닥에 있을 때만 마찰로 느려진다. 아주 느려지면 멈춘다.
      if (onGround) {
        const keep = Math.exp(-FRICTION * delta)
        ball.vx *= keep
        ball.vz *= keep
        if (Math.hypot(ball.vx, ball.vz) < 0.02) {
          ball.vx = 0
          ball.vz = 0
        }
      }

      // 5. 굴러간 거리만큼 돈다. 도는 축은 굴러가는 방향에 바닥에서 직각인 방향이다.
      const group = groups.current[index]
      if (!group) return
      const rolled = Math.hypot(stepX, stepZ)
      if (rolled > 0) {
        axis.set(stepZ, 0, -stepX).normalize()
        // setFromAxisAngle은 축과 각도로 회전을 만든다. premultiply로 지금 회전 위에 더한다.
        spin.setFromAxisAngle(axis, rolled / ball.radius)
        group.quaternion.premultiply(spin)
      }
      // 공을 그리는 group은 거실 바닥 높이에 놓여 있어서 장면 높이에서 거실 바닥 높이를 뺀다.
      const onRug = Math.abs(ball.y - FLOOR_Y) < 0.01 && ball.x > RUG.minX && ball.x < RUG.maxX && ball.z > RUG.minZ && ball.z < RUG.maxZ
      group.position.set(ball.x, ball.y - FLOOR_Y + ball.radius + (onRug ? RUG.top : 0.002), ball.z)
    })

    // 6. 같은 높이의 두 공이 겹치면 서로 밀어내고 빠르기를 맞바꾼다.
    const [a, b] = balls.current
    const gap = Math.hypot(b.x - a.x, b.z - a.z)
    const reach = a.radius + b.radius
    if (gap < reach && gap > 0.0001 && Math.abs(a.y - b.y) < 0.05) {
      const nx = (b.x - a.x) / gap
      const nz = (b.z - a.z) / gap
      const overlap = (reach - gap) / 2
      if (free(a.x - nx * overlap, a.z - nz * overlap, a.y)) {
        a.x -= nx * overlap
        a.z -= nz * overlap
      }
      if (free(b.x + nx * overlap, b.z + nz * overlap, b.y)) {
        b.x += nx * overlap
        b.z += nz * overlap
      }
      ;[a.vx, b.vx] = [b.vx, a.vx]
      ;[a.vz, b.vz] = [b.vz, a.vz]
    }
  })

  return (
    <group>
      {/* 줄무늬 공. 초록 공에 흰 띠 하나 */}
      <group ref={(node) => { groups.current[0] = node }} position={[3.6, 0.081, -2.25]}>
        <mesh castShadow>
          <sphereGeometry args={[0.06, 10, 8]} />
          <meshStandardMaterial color={palette.green} flatShading roughness={0.8} />
        </mesh>
        <mesh>
          <torusGeometry args={[0.06, 0.008, 6, 20]} />
          <meshStandardMaterial color={palette.white} flatShading roughness={0.9} />
        </mesh>
      </group>
      {/* 털실 공. 파란 공에 흰 실 두 가닥이 엇갈려 감긴다. */}
      <group ref={(node) => { groups.current[1] = node }} position={[3.78, 0.071, -2.38]}>
        <mesh castShadow>
          <sphereGeometry args={[0.05, 10, 8]} />
          <meshStandardMaterial color={palette.blue} flatShading roughness={0.8} />
        </mesh>
        {[[0.6, 0.4, 0], [-0.5, 1.2, 0.3]].map((rotation, index) => (
          <mesh key={index} rotation={rotation as [number, number, number]}>
            <torusGeometry args={[0.051, 0.005, 6, 20]} />
            <meshStandardMaterial color={palette.white} flatShading roughness={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
