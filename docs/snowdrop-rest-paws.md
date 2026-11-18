# Snowdrop 뒷발·엉덩이·꼬리 추가 수정

2026-11-18. 직전 고양이 작업을 `992bc71`에 커밋한 뒤 Blender 5.2.4에서 별도 작업본을 만들었다.

## 변경

- 사용자 눕기 레퍼런스의 정면·측면·윗면을 대조했다. 뒷발이 허벅지 앞쪽으로 길게 빠지는 자세를 줄이고 접힌 허벅지 아래로 모았다. 발목 관절은 허벅지 안쪽으로 접어 올렸다.
- 허벅지 표면을 다듬는 마스크에서 뒷발목을 분리했다. 발목 단면을 복원하고 발끝으로 이어지는 경계를 완화했다.
- 엉덩이 표면을 임시 voxel 표면에 맞춰 정리한 뒤 볼륨을 보완했다. 꼬리 표면의 작은 돌출을 완화하되 정점 이동량을 제한하고 뿌리 단면 복원은 유지했다.
- 얼굴·수염·기본 메시·UV·텍스처·가중치와 Walk·Jump·EarFlick 데이터는 원본과 일치한다. 이동 3m/s, X 앉기, C 눕기와 일어서기 후 이동은 유지한다.

## 작업본과 복구

- 웹 적용본: `public/models/characters/snowdrop/snowdrop-rest-paws.glb`
- 편집본: `public/models/characters/snowdrop/snowdrop-rest-paws.blend`
- 생성 스크립트: `scripts/refine-snowdrop-rest.py`
- 생성 기록: `public/models/characters/snowdrop/snowdrop-rest-paws-build.json`
- 비교 화면: `/snowdrop-review.html?compare=rest` — 왼쪽은 커밋한 직전 `snowdrop-rest-polished.glb`, 오른쪽은 새 작업본.
- 검수 화면: `docs/cat-reference/rest-paws-review/`

원본과 직전 GLB·Blender 파일을 보존했다. 되돌리려면 `src/scene/cat-motion.ts`의 `SNOWDROP_MODEL_FILE`을 `snowdrop-rest-polished.glb`로 바꾼다. 이번 추가 수정은 직전 커밋과 구분해 작업 트리에 남겼다.

## 확인 결과

`node scripts/check-snowdrop-rest.mjs`, `node scripts/check-cat-motion.ts`, `npm run build`가 통과했다. 저장한 Blender 파일을 다시 열어 뼈 30개, Basis를 포함한 형상 키 14개와 동작 6개도 확인했다.

앉기·눕기 각각 61개 프레임과 자세 전환 600개 프레임에서 뒷발목 단면 너비 지표는 기준의 0.940~1.000 범위였다. 접힌 길이에 영향을 받는 전체 점군 부피와 단면 두께를 구분해 검사한다. 직전 모델을 같은 검사에 넣으면 앉기 단면 0.717에서 실패한다. 별도 진단에서 직전 눕기는 0.681이었다. 결과는 `docs/snowdrop-rest-paws-validation.json`에 저장했다.

꼬리는 뿌리뿐 아니라 끝 방향까지 단면 검사 범위를 넓혔다. 정지 자세와 살랑거림에서 너비 지표는 0.929~1.012였다. 표면 수정에 따른 거리 변화는 최대 0.00586 모델 단위였다. 양쪽 뒷발의 목표 접지 높이는 0.027로 같다.

실제 웹 비교 화면에서 정면·양옆·뒤 사선, 앉기→눕기 0.16초와 역방향 0.20초의 중간 자세를 확인했다. 누운 채 꼬리 재생도 확인했다. 밤하우스 거실에서는 C 눕기와 X 앉기, 이동 입력 직후 위치를 유지한 채 `일어서기 · 0.00 m/s`가 된 다음 이동하는 순서를 확인했다. 씬 콘솔 오류는 없었다.

근접한 강한 사선광에서는 꼬리 연결부와 허벅지에 작은 굴곡·접힘 음영이 남는다. 전체 메시를 다시 토폴로지 작업한 결과는 아니며 화면에 보이는 모든 미세 요철이 없어졌다는 뜻은 아니다.
