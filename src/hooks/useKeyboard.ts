import { useEffect, useRef } from 'react'

// 지금 눌려 있는 키의 목록을 기억하는 훅이다.
// 키를 누를 때마다 화면을 다시 그릴 필요가 없어서 useState 대신 useRef를 쓴다.
export function useKeyboard() {
  const pressed = useRef(new Set<string>())

  useEffect(() => {
    const keys = pressed.current

    const handleDown = (event: KeyboardEvent) => {
      keys.add(event.code)
      // 방향키와 스페이스바가 페이지를 스크롤하지 않게 막는다.
      if (event.code.startsWith('Arrow') || event.code === 'Space') {
        event.preventDefault()
      }
    }
    const handleUp = (event: KeyboardEvent) => keys.delete(event.code)
    // 다른 창으로 넘어가면 키를 뗀 신호를 받지 못한다. 그래서 목록을 비운다.
    const handleBlur = () => keys.clear()

    window.addEventListener('keydown', handleDown)
    window.addEventListener('keyup', handleUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleDown)
      window.removeEventListener('keyup', handleUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  return pressed
}

// WASD 키를 좌우와 앞뒤 이동 값으로 바꾼다.
// x는 오른쪽이 +1이고 forward는 앞쪽이 +1이다.
export function readMove(keys: Set<string>) {
  let x = 0
  let forward = 0
  if (keys.has('KeyA')) x -= 1
  if (keys.has('KeyD')) x += 1
  if (keys.has('KeyW')) forward += 1
  if (keys.has('KeyS')) forward -= 1
  return { x, forward }
}

// 좌우 방향키를 시선 회전 값으로 바꾼다.
// 왼쪽이 +1이고 오른쪽이 -1이다.
export function readTurn(keys: Set<string>) {
  let turn = 0
  if (keys.has('ArrowLeft')) turn += 1
  if (keys.has('ArrowRight')) turn -= 1
  return turn
}

// 위아래 방향키를 시선의 높낮이 값으로 바꾼다.
// 위쪽 키는 시선을 올리고 아래쪽 키는 시선을 내린다.
export function readTilt(keys: Set<string>) {
  let tilt = 0
  if (keys.has('ArrowUp')) tilt += 1
  if (keys.has('ArrowDown')) tilt -= 1
  return tilt
}
