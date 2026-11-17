# Snowdrop 뒷발·허벅지·꼬리 수정

2026-11-17. 앉기와 눕기에서 뒷발 일부가 묻히고 허벅지에서 면이 튀어나오던 문제를 수정했다. 꼬리는 쉬는 자세에서도 원래 굽은 형태와 단면을 유지하도록 바꿨다. 기본 밤하우스와 별도 미리보기가 같은 작업본을 사용한다.

## 확인 화면과 저장 파일

- 밤하우스: `http://127.0.0.1:5173/?cat=snowdrop`
- 별도 미리보기: `http://127.0.0.1:5174/snowdrop-review.html`
- 미리보기의 ‘다리 가까이’, ‘반대쪽 다리’, ‘뒤 사선’과 자세 전환 슬라이더로 확인한다.
- 작업본: `public/models/characters/snowdrop/snowdrop-volume.glb`, `snowdrop-volume.blend`
- 정지 자세: `snowdrop-sit-volume-static.glb`, `snowdrop-lie-volume-static.glb`
- 실제 브라우저 캡처: `docs/snowdrop-review/paw-tail-*.jpg`

원본 Meshy와 Skater Cat 파일은 보존했다. 기존 고양이 선택 메뉴도 유지한다. X 앉기, C 눕기, 3.00m/s 이동과 기존 걷기 주기는 그대로다. 추가 프로그램이나 패키지는 설치하지 않았다.

## 원인과 수정

기존 늘어남 검사만으로는 서로 관통하는 표면을 찾아내지 못했다. 수정 전 앉기에서 뒤쪽 삼각형 교차 81쌍, 눕기에서 544쌍이 검출됐다. 일부 발목·종아리 가중치가 두꺼운 허벅지 표면까지 움직였고 꼬리 마디의 서로 다른 회전은 단면을 변형했다.

허벅지 겉살을 받치는 보조 뼈 2개를 추가했다. 원래 동작용 뼈 28개를 포함해 총 30개다. 골반·아래 다리·꼬리의 가중치를 분리하고, 접힌 뒷발목의 높이와 뒷발 위치를 조정했다. 보행 중 보조 뼈는 허벅지 움직임을 일부 따라간다.

뒷발끝과 허벅지 중심부를 제외한 접힘 부위에는 국소 보정을 적용한다. 앉기·눕기의 끝 자세와 중간 자세 4개, 걷기 한 주기의 표본 8개를 사용한다. 보정에서 연결선이 지나치게 늘어나지 않도록 길이 제약을 둔다. CPU 검사와 정지 메시 추출도 웹 셰이더와 같은 순서로 자세 보정 후 dual quaternion 스키닝을 계산한다.

쉬는 자세에서는 꼬리 마디에 같은 회전을 적용해 원래 굽은 꼬리 형태를 유지한다. 꼬리의 가중치가 뒷발목까지 번지지 않도록 범위도 수정했다.

## 검증 결과

- `check-cat-folds.mjs`: 정지 자세·클립 중간·실제 애니메이터 전환 230개 표본에서 뒤쪽 표면 교차 0건. 같은 정점을 공유하는 이웃 면은 제외하고 교차선 길이 0.0005 모델 단위 이상을 검사했다.
- 꼬리에만 연결된 부분의 연결선 4,438개를 검사했다. 쉬는 자세와 전환 중 길이 변화는 최대 0.0523%였다. 몸통과 섞이는 꼬리 뿌리는 이 단면 수치의 대상이 아니다.
- `check-cat-surface.mjs`: 14개 전환·중간 입력·귀 털기·점프 진입 검사 통과. 연결선 늘어남은 최대 3.821배, 동일 위치 정점의 이음새 벌어짐은 0이었다.
- `check-snowdrop-volume.mjs`: 5개 클립과 전환·착지 검사 통과. 가장 낮은 정점은 -0.001334 모델 단위로, 씬 배율 0.64에서 약 0.85mm다. 허벅지 중심부의 정점 분포 지표는 기준 대비 최소 0.950이었다. 이 지표는 정확한 해부학적 부피가 아니라 수축 회귀를 찾는 검사다.
- `check-cat-motion.ts`, `check-dual-quaternion.mjs`, `check-walk.ts` 통과. `npm run build`와 변경 파일 Oxlint도 통과했다. 기존 번들 크기 경고는 남아 있다.
- 원본 SHA-256, UV, 내장 이미지 3장의 바이트 일치를 확인했다. 결과는 `snowdrop-source-preservation.json`에 저장했다.
- Blender 4.5.10에서 37,416개 정점, 30개 뼈, 동작 5개를 확인하고 Preserve Volume을 켠 작업본을 저장했다.

브라우저에서는 앉기·눕기의 양쪽 근접 옆면과 뒤 사선, 자세 전환 중간, 걷기 12.5%·62.5%를 확인했다. 밤하우스에서는 X/C 전환과 3.00m/s 이동을 확인했고 제자리 점프 후 원래 바닥 높이로 돌아왔다. 표시된 최고 상승량은 0.76m였다. 두 화면의 브라우저 오류 로그는 0건이었다.

이 결과는 검사한 표본과 시점에 대한 확인이다. 빠른 이동에서 남는 발 미끄러짐은 이번 수정의 해결 범위가 아니다. 일반 GLB 뷰어의 선형 스키닝은 웹의 dual quaternion 결과와 다를 수 있으므로 제공한 미리보기나 Blender 작업본으로 동작을 확인한다.

## 재생성과 검사

```sh
node scripts/build-snowdrop.mjs --volume
node scripts/export-snowdrop-volume-stills.mjs
node scripts/check-cat-folds.mjs
node scripts/check-cat-surface.mjs
node scripts/check-snowdrop-volume.mjs
node scripts/check-cat-motion.ts
node scripts/check-dual-quaternion.mjs
node scripts/check-walk.ts
npm run build
```

Blender 저장 스크립트는 `scripts/save-snowdrop-volume.py`다. 표면 교차 검사는 기존 Drei 의존성으로 설치된 `three-mesh-bvh`를 사용한다.
