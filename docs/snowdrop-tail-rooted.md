# Snowdrop 꼬리 연결부 수정

이 문서는 이전 작업본의 기록이다. 현재 적용본과 재생성 명령은 [꼬리 곡선·표면 수정 기록](snowdrop-tail-smooth.md)을 참고한다.

2026-11-18. 꼬리가 엉덩이 중앙이 아닌 한쪽에서 시작하는 것처럼 보이는 현상을 수정했다.

## 원인과 변경

Blender에서 골반 `Spine`과 꼬리 뿌리 `Tail`의 기본 X 좌표가 모두 -0.075임을 확인했다. 위치 오류가 아니라 첫 뼈에 집중한 중립 회전이 원인이었다. 기존 대기 동작은 첫 뼈를 약 50도 돌린 상태에서 좌우로 흔들어 연결부 표면까지 끌고 움직였다.

뿌리의 중립 회전을 없애고 두 번째부터 네 번째 마디에 꼬리의 휜 방향을 나눠 보정했다. 뿌리는 약 ±1.6도 이내로 움직이며 중간과 끝 마디가 시간차를 두고 따라온다. 주기는 7.2초다. 메시·UV·텍스처·가중치·13개 보정 형상과 꼬리 외의 동작 데이터는 그대로 보존했다.

- 적용본: `public/models/characters/snowdrop/snowdrop-tail-rooted.glb`
- 편집본: `public/models/characters/snowdrop/snowdrop-tail-rooted.blend`
- 재생성: `blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/refine-snowdrop-rest.py -- --tail-only`
- 비교: `/snowdrop-review.html?compare=rest`. 왼쪽은 `snowdrop-tail-balanced.glb`, 오른쪽은 새 작업본이며 같은 타이밍으로 재생한다.

## 확인 결과

`node scripts/check-cat-motion.ts`, `node scripts/check-snowdrop-rest.mjs`, `npm run build`가 통과했다. Blender 편집본을 다시 열어 뼈 30개, Basis 포함 형상 키 14개와 클립 9개를 확인했다.

앉은 자세에서 연결부 표면이 기준 자세에서 벗어나는 최대 거리는 0.06879에서 0.01147 모델 단위로 줄었다. 씬 배율 0.64에서는 약 4.4cm에서 0.7cm로 줄어든 값이다. 눕기는 0.00432 모델 단위였다. 뿌리 뼈의 위치는 좌우 흔들림 중 변하지 않는다. 이전 모델은 연결부 이동 검사에서 실패한다.

꼬리 굵기는 각 마디의 축에 수직인 얇은 단면으로 검사한다. 모든 마디를 뿌리의 고정 평면에 투영하면 꺾인 꼬리를 얇아진 것으로 오인하므로 마디별 회전도 반영했다. 앉기·눕기 반복 중 단면 너비 비율은 0.936~1.025였다. 발 접지, 좌우 흔들림, 루프 연결과 일어서기 후 이동 검사도 통과했다.

Blender 앞·옆·뒤·사선 렌더, 웹 후면·윗면 양쪽 흔들림과 앉기→눕기 중간 자세를 확인했다. 밤하우스 거실에서 X 앉기와 C 눕기를 확인했으며 콘솔 오류는 없었다. 검수 화면은 `cat-reference/tail-rooted-review/`, 수치 결과는 `snowdrop-tail-rooted-validation.json`에 저장했다. 기존 표면의 작은 굴곡은 이번 작업에서 다시 조형하지 않았다.
