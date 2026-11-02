// =============================================================
//  고양이서가 카페 — 설정 파일
//  제품 주소, GLB 파일 경로, 고양이 목록은 여기만 고치면 됩니다.
// =============================================================

export const CONFIG = {
  // 같은 room 이름으로 들어온 사람끼리 만납니다. 주소 뒤에 ?room=이름 을 붙이면 다른 방.
  roomPrefix: 'catseoga-cafe-v1',

  // ---------------------------------------------------------
  // 가구 = 실제 제품
  //   glb: null 이면 코드로 만든 기본 모델을 씁니다.
  //   glb: 'models/ormi.glb' 처럼 경로를 넣으면 그 파일로 바뀝니다.
  //   솔리드웍스는 보통 mm 단위로 내보내므로 scale: 0.001 이 맞을 때가 많습니다.
  //   (카페 방 단위는 1 = 1m)
  //   고양이가 오르내리는 자리(계단 위 · 숨숨집 안)는 js/furniture.js 의 ORMI_NAV / CUSTOMB_NAV 에
  //   제품 기준 좌표(m)로 적혀 있어 GLB로 바꿔도 그대로 쓰입니다. 실제 치수가 다르면 그 숫자만 고치세요.
  // ---------------------------------------------------------
  products: {
    ormi: {
      name: '오르미캣타워',
      desc: '계단 프레임 · 숨숨집 상자 · 옆 수납칸',
      url: 'https://smartstore.naver.com/', // ← 오르미캣타워 스마트스토어 주소로 바꾸세요
      glb: null,          // 예: 'models/ormi.glb'
      scale: 1,
      rotationY: 0,       // 도(degree)
      offset: [0, 0, 0],  // GLB 원점이 어긋나 있으면 여기서 맞춤 (m)
    },
    customB: {
      name: '커스텀B 월캣타워',
      desc: '오르미를 벽을 따라 이어 붙인 월캣타워',
      url: 'https://smartstore.naver.com/', // ← 커스텀B 스마트스토어 주소로 바꾸세요
      glb: null,          // 예: 'models/custom-b.glb'
      scale: 1,
      rotationY: 0,
      offset: [0, 0, 0],
    },
  },

  // 카페 고양이들
  cats: [
    { id: 'cheese',   name: '치즈',   pattern: 'cheese',   desc: '노랑 줄무늬, 간식에 진심' },
    { id: 'samsaek',  name: '삼색이', pattern: 'calico',   desc: '삼색 얼룩, 카페 터줏대감' },
    { id: 'godeung',  name: '고등어', pattern: 'mackerel', desc: '회색 고등어무늬, 캣타워 꼭대기 담당' },
    { id: 'tux',      name: '턱시도', pattern: 'tuxedo',   desc: '흰 양말 신은 신사' },
    { id: 'kkamang',  name: '까망',   pattern: 'black',    desc: '노란 눈의 까만 고양이, 숨숨집 애호가' },
  ],
};
