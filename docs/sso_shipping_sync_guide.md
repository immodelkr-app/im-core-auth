# 통합 회원(SSO) 기본 배송지 API 연동 및 동기화 가이드 (MOCA, IMFF, model_beauty)

본 가이드는 통합 회원 시스템(`im-core-auth`)에 새로 추가된 기본 배송지 정보를 각 클라이언트 서비스 앱(MOCA, IMFF, model_beauty)에서 조회하고 실시간으로 동기화하는 방법을 설명합니다.

---

## 1. 개요 및 연동 흐름
1. **회원별 기본 배송지 필드 (nullable):**
   - `shipping_recipient` (text): 기본 배송지 수령인 이름 (실명)
   - `shipping_phone` (text): 수령인 연락처 (휴대폰 번호)
   - `shipping_zipcode` (text): 우편번호 (5자리)
   - `shipping_address` (text): 기본 주소 (도로명/지번)
   - `shipping_detail` (text): 상세 주소 (동·호수 등)

2. **기본 연동 흐름:**
   - **조회**: 마이페이지 진입 시 혹은 주문서(Checkout) 진입 시 유저 ID 또는 휴대폰 번호로 기본 배송지 정보를 불러옵니다.
   - **수정/동기화**: 마이페이지 "기본 배송지 설정"에서 정보를 수정하고 저장하거나, 주문서에서 "기본 배송지로 저장"을 체크한 뒤 결제 시, 통합 API를 호출하여 최신 기본 배송지 정보를 갱신합니다.

---

## 2. API 스펙 안내

모든 API는 헤더에 보안을 위해 `x-api-secret` 토큰 값을 포함해야 합니다.
```http
x-api-secret: {API_SECRET_KEY}
```

### A. 유저 정보 조회 (ID 기준)
마스터 유저의 UUID를 알고 있는 경우 사용합니다.

* **요청:**
  - `GET /api/auth/user/:id`
* **응답 예시 (200 OK):**
  ```json
  {
    "success": true,
    "user": {
      "id": "76d8bfa2-35fc-4fa0-822e-a5e27a6f23c9",
      "phone_number": "01012345678",
      "name": "홍길동",
      "integrated_points": 2400,
      "shipping_recipient": "홍길동",
      "shipping_phone": "01012345678",
      "shipping_zipcode": "06159",
      "shipping_address": "서울특별시 강남구 테헤란로 427",
      "shipping_detail": "위워크 타워 10층",
      "created_at": "2026-06-24T12:00:00Z",
      "updated_at": "2026-07-04T12:30:00Z"
    }
  }
  ```

### B. 유저 정보 조회 (휴대폰 번호 기준)
휴대폰 번호(숫자만 정규화되어 처리됨)로 유저를 조회할 때 사용합니다.

* **요청:**
  - `GET /api/auth/user/phone/:phone` (예: `/api/auth/user/phone/01012345678`)
* **응답 예시 (200 OK):**
  - 조회 스펙은 ID 기준 조회 결과와 동일하게 5개 배송지 필드를 포함하여 반환합니다.

### C. 유저 정보 동기화 및 업데이트 (ID 기준 PATCH)
특정 마스터 유저 ID로 배송지를 업데이트합니다.

* **요청:**
  - `PATCH /api/auth/user/:id`
  - **Body (JSON):**
    ```json
    {
      "shipping_recipient": "김철수",
      "shipping_phone": "01098765432",
      "shipping_zipcode": "04524",
      "shipping_address": "서울특별시 중구 세종대로 110",
      "shipping_detail": "서울시청 1층"
    }
    ```
* **응답 예시 (200 OK):**
  ```json
  {
    "success": true,
    "user": {
      "id": "76d8bfa2-35fc-4fa0-822e-a5e27a6f23c9",
      "phone_number": "01012345678",
      "shipping_recipient": "김철수",
      "shipping_phone": "01098765432",
      "shipping_zipcode": "04524",
      ...
    }
  }
  ```

### D. 통합 유저 동기화 및 업데이트 (공용 PATCH)
ID 또는 휴대폰 번호 중 하나를 골라 간편하게 동기화할 수 있는 API 엔드포인트입니다.

* **요청:**
  - `PATCH /api/auth/sync`
  - **Body (JSON):** (식별을 위한 `phoneNumber` 또는 `masterUserId` 중 하나는 필수)
    ```json
    {
      "phoneNumber": "01012345678",
      "shipping_recipient": "이영희",
      "shipping_phone": "01055554444",
      "shipping_zipcode": "46340",
      "shipping_address": "경기도 성남시 분당구 판교역로 166",
      "shipping_detail": "카카오판교오피스 5층"
    }
    ```
* **응답 예시 (200 OK):**
  - 업데이트된 마스터 유저 정보 반환 (`{ "success": true, "user": { ... } }`)

---

## 3. 클라이언트 앱 UI/UX 구현 시 주의사항

### A. 마이페이지 (MyPage)
- **주소 찾기 서비스 연동**: 우편번호 및 도로명 주소를 신뢰성 있게 입력받기 위해 카카오 우편번호 서비스 또는 우체국 주소 찾기 API를 적용해 주세요.
- **저장 시 API 호출**: 저장 버튼을 누르면 `PATCH /api/auth/user/:id` 또는 `PATCH /api/auth/sync` API를 호출해 통합 DB에 실시간 갱신합니다.

### B. 주문서 (Checkout)
- **자동 완성**: 결제화면 진입 시 통합 유저 API를 호출하여 배송지 정보(`shipping_address` 등)가 존재한다면 주문서 배송 폼에 **자동 기입(Prefill)**해 줍니다.
- **"기본 배송지로 저장" 기능**: 사용자가 결제 단계에서 새로운 주소를 작성할 수 있으므로, 하단에 `[ ] 기본 배송지로 저장` 체크박스를 표시합니다. 체크 후 결제 성공 시 `PATCH /api/auth/sync`를 호출하여 최신 기본 배송지 정보를 업데이트해 주세요.
