# 고양이서가 카페 (catseoga-cafe)

고양이서가 원목 캣타워가 놓인 **온라인 고양이 카페**입니다.
브라우저에서 바로 열리는 3D 공간으로, 닉네임만 정하면 들어가 다른 손님들과 말없이 함께 머물 수 있습니다.

- Three.js 3D (폰 · PC), 설치 · 가입 없음
- 동시 접속: Cloudflare 방 서버 (방 하나 50명, 방 개수는 설정으로 늘림). 서버 주소가 없으면 PeerJS P2P로 동작
- 실내 카페(카페 테이블 · 창가 바 · 라운지 소파 · 좌식 · 주문 카운터) + 문을 열고 나가는 정원(데크 · 파라솔 · 큰 나무 그네 · 연못 · 새 모이대 · 등불)
- 카페 고양이 5마리(치즈 · 삼색이 · 고등어 · 턱시도 · 까망)가 알아서 캣타워를 오르내리고, 숨숨집에서 자고, 식빵 굽고, 기지개 켜고, 정원에 나가 새를 구경하고, 손님 곁에 와서 앉습니다
- 고양이를 누르면 쓰다듬기(하트 + 골골송), 간식 주기
- 가구를 누르면 제품 카드 + "이 캣타워 보러 가기"
- 낮/밤, 빗소리 · 장작 소리 · 골골송(Web Audio)
- 2단계: 🐾 버튼 → 고양이 사진을 올리면 털색을 따서 내 고양이가 따라다님

## 조작

| 폰 | PC |
|---|---|
| 톡: 그 자리로 걷기 · 고양이 쓰다듬기 · 가구 카드 | 클릭 |
| 끌기: 시점 돌리기 | 드래그 |
| 꾹 누른 채 끌기: 손가락 쪽으로 걷기 | WASD · 방향키로 걷기, Q/E 회전 |
| 두 손가락: 크게 · 작게 | 마우스 휠 |
| 소파 · 창가 벤치 · 방석 · 바 의자를 누르면 앉기 | |

## 고치는 곳

**`js/config.js` 하나만 보면 됩니다.**

- 스마트스토어 주소: `products.ormi.url`, `products.customB.url`
- 고양이 이름 · 설명: `cats`
- 다른 방 만들기: 주소 뒤에 `?room=이름` (예: `…/catseoga-cafe/?room=event`)

### 솔리드웍스 GLB로 가구 바꾸기

1. 솔리드웍스에서 GLB(glTF) 로 내보내기 → `models/ormi.glb`, `models/custom-b.glb` 로 저장
2. `js/config.js` 에서 `glb: 'models/ormi.glb'` 처럼 경로 입력
3. 크기가 1000배로 보이면 `scale: 0.001` (솔리드웍스 mm → 카페 m)
4. 방향이 틀어지면 `rotationY: 90` 등, 원점이 어긋나면 `offset: [x, y, z]`
   - 카페 기준: 제품 앞면이 +Z, 바닥이 y=0, 길이 방향이 X
5. 고양이가 올라앉는 자리(계단 높이 등)는 `js/furniture.js` 의 `ORMI_NAV`, `CUSTOMB_NAV` 좌표(m)

GLB를 못 찾으면 자동으로 기본 모델로 돌아갑니다.

## 파일 구조

```
index.html            화면 틀
css/style.css         화면 위 UI
js/config.js          ★ 설정 (제품 주소 · GLB · 고양이)
js/main.js            시작 · 카메라 · 낮밤 · 손님 · 동기화
js/room.js            카페 실내 (벽 · 창 · 서가 · 테이블 · 바 · 소파 · 좌식 · 난로 · 카운터 · 정원 문)
js/garden.js          정원 (데크 · 파라솔 · 나무 그네 · 연못 · 화단 · 새 모이대 · 등불 · 비)
js/netServer.js       Cloudflare 방 서버 연결
server/               Cloudflare Workers + Durable Objects 방 서버
audio/                배경 음악 (bgm-day.mp3, bgm-night.mp3)
js/furniture.js       오르미캣타워 · 커스텀B 월캣타워 + GLB 교체
js/catModel.js        고양이 모델 · 무늬 · 자세
js/cats.js            고양이 행동 (방장 컴퓨터가 계산해 나눠 줌)
js/myCat.js           2단계: 사진 털색 추출 + 따라다니는 내 고양이
js/avatar.js          손님 캐릭터
js/net.js             PeerJS P2P (서버 없을 때, 방장 자동 교체)
js/audio.js           빗소리 · 장작 · 골골송 · 야옹
js/controls.js        톡 · 끌기 · 꾹 누르기 · 두 손가락 · 키보드
js/fx.js js/nav.js js/kit.js js/ui.js   효과 · 이동 · 재료 · UI
vendor/               three.js r160, PeerJS 1.5.4 (CDN 없이 동작)
models/               GLB 넣는 곳
```

## 방 서버 (Cloudflare) 처음 한 번 설정

1. Cloudflare 대시보드 → My Profile → API Tokens → Create Token → **Edit Cloudflare Workers** 템플릿으로 토큰 만들기
2. Cloudflare 대시보드 Workers 화면에서 **Account ID** 복사
3. GitHub 레포 → Settings → Secrets and variables → Actions → New repository secret
   - `CLOUDFLARE_API_TOKEN` = 1번 토큰
   - `CLOUDFLARE_ACCOUNT_ID` = 2번 ID
4. GitHub 레포 → Actions → **Deploy cafe server** → Run workflow

그러면 서버가 올라가고, 서버 주소가 `js/config.js` 의 `serverUrl` 에 자동으로 적힙니다.
이후 `server/` 를 고쳐 main 에 올리면 자동으로 다시 배포됩니다.

- 방 인원: `server/wrangler.toml` 의 `ROOM_CAP` (기본 50)
- 방 개수: `server/wrangler.toml` 의 `MAX_ROOMS` (기본 20 → 100으로 바꾸면 최대 5,000명)

## 동시 접속 방식 (서버 없이 쓸 때)

첫 손님이 방장(호스트)이 되고, 다음 손님들은 방장에게 연결합니다(별 모양).
고양이 움직임은 방장 컴퓨터가 계산해 모두에게 나눠 주므로 모두 같은 고양이를 봅니다.
방장이 나가면 남은 손님 중 한 명이 1~2초 안에 자동으로 이어받습니다.
신호 교환에는 PeerJS 무료 클라우드(0.peerjs.com)를 쓰며, 실제 데이터는 손님끼리 직접 오갑니다.
접속자가 아주 많아지면(대략 20~30명 이상) 방장 기기 부담이 커지므로 `?room=` 으로 방을 나누세요.

## 로컬에서 보기

```bash
python3 -m http.server 8000
```
→ http://localhost:8000
