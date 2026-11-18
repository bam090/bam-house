# Snowdrop 꼬리 좌우 움직임

이 작업본의 뿌리 회전 편향은 이후 [꼬리 연결부 수정](snowdrop-tail-rooted.md)에서 보완했다. 아래는 수정 전 기록이다.

2026-11-18. 승인한 뒷발·엉덩이·꼬리 표면 작업을 `1d65bc0`에 커밋한 뒤 꼬리 애니메이션을 별도로 수정했다.

- 원래 왼쪽으로 휜 꼬리의 중립 방향을 몸의 중앙으로 맞췄다. 대기·걷기·앉기·눕기마다 회전축과 중심을 Blender에서 계산했다.
- 주기는 7.2초이며 다섯 마디가 0.3초씩 늦게 따라온다. 자세 전환에는 몸 동작과 같은 혼합 비율을 사용한다.
- 기준 `snowdrop-rest-paws.glb`의 기본 메시·UV·텍스처·가중치·13개 보정 형상과 꼬리 이외의 모든 클립 데이터가 그대로 보존되는지 자동 검사한다.
- 웹 적용본은 `public/models/characters/snowdrop/snowdrop-tail-balanced.glb`, 편집본은 같은 이름의 `.blend`다. 이전 파일은 보존했다.
- 재생성: `blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/refine-snowdrop-rest.py -- --tail-only`.
- 비교: `/snowdrop-review.html?compare=rest`. 왼쪽은 커밋한 `snowdrop-rest-paws.glb`, 오른쪽은 이번 꼬리 작업본이다.

`node scripts/check-cat-motion.ts`, `node scripts/check-snowdrop-rest.mjs`, `npm run build`가 통과했다. 대기·걷기·앉기·눕기에서 꼬리 끝이 몸의 좌우를 모두 지나는지 확인한다. 이전 모델은 이 검사에서 한쪽으로만 움직여 실패한다. 꼬리 두께·발 접지·루프 연결과 일어서기 후 이동 검사도 통과했다.

Blender 편집본에서 뼈 30개, Basis 포함 형상 키 14개와 동작 9개를 확인했다. 앞·옆·뒤·사선 렌더와 웹의 양쪽 최대 흔들림을 확인했다. 밤하우스 거실에서 X 앉기, C 눕기와 이동 전 일어서기를 확인했으며 콘솔 오류는 없었다. 자세 전환 중간 프레임도 비교 화면에서 확인했다.

검증 수치는 `snowdrop-tail-balanced-validation.json`, 렌더와 웹 화면은 `cat-reference/tail-balanced-review/`에 저장했다. 이번 변경은 꼬리 움직임만 다루며 승인한 휴식 자세의 미세한 표면 굴곡은 그대로다.
