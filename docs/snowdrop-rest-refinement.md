# Snowdrop 앉기·눕기 자세 수정

최신 적용본과 검증 결과는 [뒷발·표면 추가 수정 기록](snowdrop-rest-paws.md)에 정리했다. 아래는 `992bc71`에 저장한 직전 작업본의 기록이다.

2026-11-18: `snowdrop-modeling-prompt.md`를 적용해 가슴·목·꼬리 뿌리를 추가로 다듬고 뒷발 위치와 꼬리 살랑거림을 수정했다.

## 참고 자료

사용자가 저장한 `docs/cat-reference/white-turkish-angora-sitting-*.png`와 `white-turkish-angora-lying-*.png`에 실제 고양이 사진을 추가로 대조했다.

- [앉은 Burmilla 수컷 사진](https://commons.wikimedia.org/wiki/File:Burmilla_male-cat.jpg): 낮게 놓인 골반, 앞으로 받치는 뒷발, 세워진 앞다리와 둥근 허벅지를 참고했다. Armin Tafertshofer 촬영, Abujoy 보정, CC BY-SA 3.0/GFDL.
- [누운 American Shorthair 사진](https://commons.wikimedia.org/wiki/File:American_Shorthair_Fond_Blanc.jpg): 낮은 가슴, 앞으로 놓인 앞발과 접힌 뒷다리의 관계를 참고했다. Desaix83 / odin_aka_zero-one, CC BY-SA 3.0.

외부 사진은 관찰용으로 열어 확인했다. 프로젝트에는 복사하지 않았다.

## 변경 내용

- Blender 5.2.4에서 골반 높이와 몸통 각도를 조정했다. 앉기는 골반을 낮추고 뒷발을 앞으로 받치도록 구성했다. 눕기는 가슴을 낮추고 앞발의 과도한 전방 이동을 줄였다.
- 접힌 허벅지 표면을 마스크로 다듬고 둥근 볼륨을 복원했다. 꼬리 연결부는 임시 voxel remesh 표면을 이용해 보정했다. 웹 모델의 원래 토폴로지와 UV는 유지했다.
- 중간 자세와 끝 자세에 보정 형상 및 노멀을 저장했다. 앉기와 눕기의 혼합 구간에는 별도 `RestBlendFold` 보정을 적용한다. 웹의 발 접지 IK와 같은 목표 위치를 내보냈다.
- 기존 얼굴·수염·텍스처·기본 메시·가중치와 Walk·Jump·EarFlick 데이터는 그대로 보존했다. 걷기 속도는 3m/s이며 X 앉기, C 눕기와 일어서기 후 이동 규칙도 유지했다.
- 옆면 레퍼런스의 완만한 목–가슴 곡선을 기준으로 앉을 때의 둥근 앞가슴 돌출을 줄였다. 목 뒤와 어깨로 이어지는 면도 별도 마스크로 다듬었다.
- 뒷발을 이전 자세보다 앉기에서 0.030, 눕기에서 0.045 모델 단위만큼 앞으로 옮겼다. 양쪽 발의 높이와 앞뒤 위치를 같게 유지하고 발끝 형상은 보존했다.
- 꼬리 뿌리의 높이와 각도를 함께 조정했다. 뼈 축을 기준으로 반지름을 복원하던 방식은 연결부 요철을 다시 만들었다. 실제 메시의 단면 중심과 두 방향의 두께를 기준으로 복원하도록 바꿨다.
- Blender에서 다섯 꼬리 마디에 0.3초씩 시간차를 둔 7.2초 `TailSway` 클립을 만들었다. 대기·걷기뿐 아니라 앉기와 눕기에서도 작은 폭으로 이어진다. 점프 중에는 잦아든다.

## 작업본과 재생성

- 웹 적용본: `public/models/characters/snowdrop/snowdrop-rest-polished.glb`
- 편집본: `public/models/characters/snowdrop/snowdrop-rest-polished.blend`
- 생성 기록: `public/models/characters/snowdrop/snowdrop-rest-polished-build.json`
- 비교 화면: `/snowdrop-review.html?compare=rest`
- 다각도 렌더와 브라우저 화면: `docs/cat-reference/rest-polished-review/`

원본 `snowdrop-volume.glb`와 `snowdrop-volume.blend`, 직전 작업본 `snowdrop-rest-refined.glb`와 `.blend`는 보존했다. 직전 외형으로 되돌리려면 `src/scene/cat-motion.ts`의 `SNOWDROP_MODEL_FILE`을 `snowdrop-rest-refined.glb`로 변경한다. 새 꼬리 클립이 없는 모델은 기존 꼬리 클립 생성 함수를 사용한다. 기존 기본 고양이는 씬의 고양이 선택 메뉴에서 전환할 수 있다.

Blender 전문 스킬의 `bx_sculpt.py`, `bx_review.py`를 사용하는 생성 명령은 다음과 같다.

```sh
blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/refine-snowdrop-rest.py
```

## 검증

```sh
node scripts/check-snowdrop-rest.mjs
node scripts/check-cat-motion.ts
node scripts/check-walk.ts
npm run build
```

수치 결과는 `docs/snowdrop-rest-polished-validation.json`에 저장한다. 앉기·눕기 각각 61개 프레임에서 발 접지, 좌우 뒷발, 꼬리 단면과 Blender/웹 IK 일치를 검사한다. 각 휴식 자세의 꼬리 살랑거림도 73개 시점에서 바닥 침범과 굵기를 검사한다. 별도 동작 검사는 자세 전환, 일어서기 후 이동, 걷기 루프, 귀·꼬리 동작과 점프를 포함한다.

최종 작업본은 위 검사와 빌드를 통과했다. 정지 자세와 살랑거림을 포함한 꼬리 뿌리 너비 지표는 기준의 0.963~1.012 범위였다. 양쪽 뒷발 높이는 0.027 모델 단위로 일치했다. 기존 `snowdrop-rest-refined.glb`를 새 동작 검사에 넣으면 `Tail_002`의 움직임이 너무 작다는 검사에서 실패한다. 저장한 Blender 파일을 다시 열어 30개 뼈, 보정 형상 13개와 `TailSway` 클립도 확인했다.

웹 비교 화면에서는 정면·양쪽 측면·뒤 사선, 실내 낮·그늘, 앉기↔눕기 전환 중간과 휴식 중 꼬리 움직임을 확인했다. 밤하우스 거실에서는 X 앉기와 C 눕기, 이동 입력 직후 `일어서기 · 0.00 m/s`를 유지한 다음 이동하는 순서를 확인했다. 최종 재로드 후 새 브라우저 오류는 없었다. 제작 중 미리보기의 선택 항목 추가 오류는 수정했다. 빌드의 기존 500kB 초과 청크 경고는 남는다.

원본의 모든 표면을 다시 만든 작업은 아니다. 강한 사선광에서는 턱 아래의 작은 음영 경계와 허벅지의 미세한 요철이 보인다. 일반 플레이 시점과 근접 시점을 모두 비교할 수 있도록 작업 전후 화면을 남겼다.
