// 포트폴리오에 표시할 프로젝트 내용을 한곳에 모아 둔 파일이다.
// TV 화면과 물건 패널과 일반 화면이 모두 이 파일을 읽는다.
// 문구나 링크를 바꿀 때는 이 파일만 고치면 된다.

export type ProjectStatus = 'done' | 'in-progress' | 'planned'

export interface ProjectLink {
  label: string
  url: string
}

export interface Project {
  /** 코드에서 프로젝트를 구분하는 고유 이름 */
  id: string
  /** 화면에 보이는 프로젝트 이름 */
  title: string
  /** 한 줄 설명 */
  summary: string
  /** 만들게 된 이유. 팀 프로젝트처럼 해당 없는 경우는 비워 둔다. */
  reason?: string
  /** 맡은 일. 한 문장으로 적는다. */
  role?: string
  /** 팀 프로젝트의 기간과 인원 */
  team?: string
  status: ProjectStatus
  links: ProjectLink[]
}

export const projects: Project[] = [
  {
    id: 'todakfit',
    title: '토닥핏',
    summary: '식단과 몸 상태를 기록하는 모바일 우선 생활 기록 웹앱',
    reason: '다이어트를 하면서 기존 관리 앱에서 겪은 불편을 직접 고쳐 보려고 만들었습니다.',
    role: '기획부터 구현까지 혼자 진행',
    status: 'in-progress',
    // 저장소가 비공개라서 링크를 넣지 않았다. 공개로 바꾸면 추가한다.
    links: [],
  },
  {
    id: 'bamdev',
    title: 'BAM.dev',
    summary: '개념을 읽고 자신의 말로 설명하고 직접 코드로 옮기는 개발 학습 서비스',
    reason: '공부하면서 개념 학습과 문제 풀이를 한곳에서 하고 싶어서 만들었습니다.',
    role: '학습 서비스 전체를 혼자 구현',
    status: 'done',
    links: [
      { label: '사이트', url: 'https://bamdev.store' },
      { label: 'GitHub', url: 'https://github.com/bam090/BAM.dev' },
    ],
  },
  {
    id: 'sql-lab',
    title: 'SQL Lab',
    summary: '상품 데이터로 SELECT부터 JOIN까지 연습하는 SQL 실습 서비스',
    reason: 'SQL을 배울 때 설치 없이 바로 쿼리를 실행하고 결과를 비교할 곳이 필요해서 만들었습니다.',
    role: '브라우저에서 PostgreSQL을 실행하는 실습 환경 구현',
    status: 'done',
    links: [
      { label: '사이트', url: 'https://sql-lab.store' },
      { label: 'GitHub', url: 'https://github.com/bam090/sql-product-lab' },
    ],
  },
  {
    id: 'efy',
    title: 'EFY',
    summary: '사용자와 전문가가 견적 요청과 제안으로 만나는 일상 서비스 매칭 플랫폼',
    role: '팀장. 인증과 회원 구현 및 초기 설정과 배포와 문서 담당',
    team: '2026.10.26 ~ 11.06 · 백엔드 5인 · 부트캠프 2차 프로젝트',
    status: 'done',
    links: [
      { label: '사이트', url: 'https://port-0-efy-api-mw1zsbylfe8cd41c.sel3.cloudtype.app' },
      { label: 'GitHub', url: 'https://github.com/prgrms-aibe-devcourse/AIBE8-Project2-Team01' },
    ],
  },
  {
    id: 'festival',
    title: '축제 어때',
    summary: '전국 축제를 찾고 주변 맛집과 카페와 숙소를 골라서 일정을 만드는 축제 추천 서비스',
    role: 'Supabase 인증과 일정 기능 구현 및 문서 담당',
    team: '3인 · 부트캠프 1차 프로젝트',
    status: 'done',
    links: [
      { label: '사이트', url: 'https://qkdtkd77.github.io/AIBE8_Project1_Team_ACE/' },
      { label: 'GitHub', url: 'https://github.com/qkdtkd77/AIBE8_Project1_Team_ACE' },
    ],
  },
  {
    id: 'project-3',
    title: '3차 프로젝트',
    summary: '부트캠프 3차 팀 프로젝트',
    status: 'planned',
    links: [],
  },
  {
    id: 'llm',
    title: 'LLM 직접 만들어 보기',
    summary: 'LLM의 동작 원리를 직접 구현하면서 익히는 학습 프로젝트',
    status: 'planned',
    links: [],
  },
  {
    id: 'fridge',
    title: '우리집 냉장고',
    summary: '냉장고 속 식품의 소비기한을 관리하고 남은 재료로 만들 음식을 알려 주는 서비스',
    reason: '장을 본 뒤에 소비기한을 넘겨서 버리는 식품이 많아서 구상했습니다.',
    status: 'planned',
    links: [],
  },
  {
    id: 'workout-log',
    title: '운동로그',
    summary: '운동기구를 켜기만 하면 운동 강도와 시간을 자동으로 기록하는 서비스',
    reason: '실내자전거와 연동된다던 앱이 수동 입력이어서 기록을 그만두게 된 경험에서 구상했습니다.',
    status: 'planned',
    links: [],
  },
]
