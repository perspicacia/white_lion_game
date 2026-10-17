# 순수 게임 상태 함수 테스트 계약

## 목적

핵심 규칙을 Canvas, DOM, Web Audio와 분리한다. 테스트는 실제 시간을 기다리지 않고 상태와 `dt`를 직접 전달한다. 같은 초기 상태, 같은 seed, 같은 입력은 항상 같은 결과를 만들어야 한다.

## 권장 공개 API

이름은 달라도 되지만 아래 역할과 관찰 가능 값은 제공되어야 한다.

```js
const state = createInitialState({ seed, element: null });
const result = reduceGame(state, action);
const next = step(result.state, dt, rng);
const snapshot = getPublicSnapshot(next);
```

권장 action:

```text
SELECT_ELEMENT(fire|ice)
START
JUMP
ATTACK
PAUSE
RESUME
RESTART_TO_SELECT
NEXT_STAGE
SET_VOLUME(0..1)
SET_REDUCED_MOTION(boolean)
```

함수는 `{ state, events }` 형태로 결과를 반환하는 것이 좋다. `events`는 화면·오디오가 소비하며, 순수 규칙은 직접 소리를 재생하거나 DOM을 바꾸지 않는다.

## 필수 상태

```text
mode: select | running | paused | respawning | stageClear | bossFight | won
element: null | fire | ice
stageIndex: 0..2
distance, checkpointDistance
score, checkpointScore
hp: 0..5
player: { y, vy, jumpCount, attackCooldown, attackTimer, invulnerable }
obstacles[], enemies[], pickups[], projectiles[]
boss: null | { hp, x, groundY, alpha, attackTimer, hitCooldown, defeatedTimer }
settings: { volume, reducedMotion }
```

`boss.groundY`는 렌더링 기준선이며 패배 중에도 바뀌지 않아야 한다. 이미지의 투명 여백 보정은 렌더 계층의 `footOffsetY`로 처리하고 물리 y값과 섞지 않는다.

## 불변 조건

매 `reduceGame`과 `step` 뒤 검사한다.

- 모든 숫자는 유한값이다.
- `0 <= hp <= 5`, `0 <= stageIndex <= 2`, `0 <= volume <= 1`이다.
- `checkpointDistance <= distance`는 일반 실행 중 성립한다. 부활 직후에는 둘이 같다.
- `jumpCount`는 0, 1, 2 중 하나다.
- `paused`, `stageClear`, `won`에서 `step`은 게임 진행 상태를 바꾸지 않는다.
- 제거된 객체는 다시 충돌하거나 점수를 주지 않는다.
- 동일 공격이 같은 적/보스에게 한 번만 피해를 준다.
- 불/얼음에 따른 기계적 상수 분기가 없다.
- 보스 패배 상태에서 `x`, `groundY`, 수직 위치와 충돌 경계는 고정되고 `alpha`만 감소한다.

## 단위 테스트 계약

### 1. 초기화와 시작

- `createInitialState()`는 `mode=select`, `element=null`, `hp=5`, `score=0`, `stageIndex=0`, `distance=0`이다.
- `SELECT_ELEMENT`만으로 달리기 시작 여부를 명확히 정한다. 권장 계약은 선택과 동시에 `running`이다.
- 유효하지 않은 속성은 거절하거나 안전한 기본값으로 정규화하되 테스트로 고정한다.
- 게임 시작 이벤트는 정확히 한 번 발생하고 `audio-unlock` 요청 이벤트를 포함할 수 있다.

### 2. 시간 진행과 자동 달리기

- `running`에서 `distance += speed[stage] * dt`이며 1단계도 체감 가능한 최소 속도를 만족한다.
- `speed[0] < speed[1] < speed[2]`이고 장애물 간격은 반대로 감소한다.
- `dt <= 0`, `NaN`, `Infinity`는 무시한다.
- 큰 dt는 예를 들어 0.05초 이하 조각으로 처리하거나 clamp한다.
- 같은 총 시간을 60Hz와 120Hz로 진행한 결과의 거리·점프 착지는 허용 오차 안에서 같다.

### 3. 2단 점프

- 지면에서 첫 `JUMP`: `jumpCount=1`, `vy<0`, `jump` 이벤트 1회.
- 공중에서 두 번째 `JUMP`: `jumpCount=2`, 두 번째 점프 속도 적용, 이벤트 1회.
- 착지 전 세 번째 `JUMP`: 상태와 이벤트 변화 없음.
- 착지: y는 정확히 지면으로 clamp되고 `vy=0`, `jumpCount=0`.
- `paused`, `select`, `respawning`, `stageClear`, `won`에서는 점프 거절.
- 브라우저 계층은 `KeyboardEvent.repeat`를 무시하며, 이 규칙은 입력 어댑터 테스트에서 확인한다.

### 4. 공격

- `ATTACK` 성공 시 공격 객체/시간과 `attack` 이벤트가 한 번 생성된다.
- 쿨다운 중 입력은 아무 변화가 없다.
- 일반 적 명중: 적 제거, 점수 증가, `enemyDefeated`와 `fireDefeatSound` 또는 `iceDefeatSound` 이벤트.
- 돌·문턱은 공격으로 제거되지 않고 점수를 주지 않는다.
- 불/얼음의 공격 속도, 크기, 피해량, 수명, 범위, 쿨다운은 같은 상수다.

### 5. 피격과 무적

- `applyDamage(state, sourceId)` 또는 동등 규칙은 무적이 아닐 때 `hp -= 1`, `hit` 이벤트 1회.
- hp가 1 이상 남으면 거리, 스테이지, 체크포인트, 점수, 적 배치는 유지된다.
- 같은 충돌이 이어져도 무적 시간 동안 추가 피해가 없다.
- 다른 피해원도 무적 시간 동안 거절된다.
- hp가 0이면 `respawning`으로 전환하고 즉시 `running`으로 되돌리지 않는다.
- 부활 후 hp=5, 거리=최근 체크포인트, 점수=checkpointScore, 점프/공격/투사체가 정리되고 짧은 부활 무적이 적용된다.

### 6. 체크포인트

- 200m, 400m, 600m…을 처음 통과할 때만 저장 이벤트가 한 번 난다.
- 한 프레임에서 경계를 크게 넘겨도 놓치지 않는다.
- 스테이지 목표 거리와 같거나 큰 지점은 체크포인트보다 스테이지 완료가 우선한다.
- 저장 시 거리와 점수를 함께 보존한다.
- 부활 위치 바로 앞의 충돌 객체는 제거/비활성화해 연속 사망을 막는다.

### 7. 코인과 먹이

- 수집 충돌은 한 번만 점수를 준다.
- 코인과 먹이의 점수 상수는 명시한다.
- 먹이는 hp를 1 회복하되 5를 넘지 않는다.
- `pickupCoin`, `pickupFood` 이벤트가 서로 다르다.
- 아이템 생성기의 목표 y는 점프 궤적 함수로 계산한 최고점 band 안이다. 테스트는 `apexY - tolerance <= itemCenterY <= apexY + tolerance`를 검사한다.
- 지면 플레이어 충돌 상자와 아이템 충돌 상자는 겹치지 않아야 한다.

### 8. 일시정지·계속·처음부터

- `PAUSE`: running/bossFight → paused, 이전 모드를 `resumeMode`로 저장.
- paused에서 step(3초): 거리, 물리, 쿨다운, 애니메이션용 게임 시계, 적과 보스가 모두 불변.
- `RESUME`: 정확히 `resumeMode`로 복귀. 실제 벽시계 차이를 시뮬레이션 dt로 넣지 않는다.
- `RESTART_TO_SELECT`: `mode=select`, `element=null`, 모든 진행값 초기화. 설정(음량/감소된 움직임)은 유지해도 되지만 계약을 고정한다.

### 9. 스테이지 전환

- 각 목표 거리에 도달하면 정확히 한 번 `stageClear`가 된다.
- 다음 단계 시작 시 hp=5, 거리/체크포인트=0, 점수는 유지된다.
- 3단계에서는 목표 직전 또는 별도 BOSS_TRIGGER에서 보스전으로 전환하며 거리는 보스전 동안 고정된다.
- 보스가 살아 있는 동안 `won`이 될 수 없다.

### 10. 보스 거리·공격·발 기준선

- 등장 직후 보스와 백사자 충돌 경계 사이 거리는 150px 이상이다.
- 보스 이동 함수는 전체 주기에서 최소 거리 제한을 지킨다.
- 보스 몸체 접촉은 피해원이 아니다. 피해원은 명시된 투사체/충격파다.
- 투사체 충돌 시 일반 피해 규칙과 같은 무적 시간을 사용한다.
- 백사자 공격 한 번은 보스 hp를 최대 1만 감소시킨다.
- 보스 hp가 0이면 투사체를 정리하고 `bossDefeated` 이벤트 1회.
- 보스 패배 타이머 동안 `boss.x`와 `boss.groundY`는 최초 값과 strictEqual, `alpha`는 매 step 이전 값 이하이고 0..1이다.
- `defeatedTimer` 종료 후 보스가 제거되고 `won`이 된다.

### 11. 이벤트/오디오 계약

필수 event type:

```text
start, jump, attack, hit, checkpoint, respawn,
pickupCoin, pickupFood,
enemyDefeatedFire, enemyDefeatedIce,
bossShot, bossHit, bossDefeated,
stageClear, won, pause, resume
```

- 사건 1회당 event 1회. 프레임이 여러 번 진행되어도 이미 처리한 사건을 반복 발행하지 않는다.
- `enemyDefeatedFire`와 `enemyDefeatedIce` 외의 규칙 상태는 동일하다.
- mute/volume는 오디오 어댑터의 출력만 바꾸고 게임 규칙은 바꾸지 않는다.

## 속성 기반 테스트

고정 예제 외에 seed 100개로 임의 입력을 생성한다.

1. 모든 step 뒤 불변 조건을 확인한다.
2. 불/얼음 쌍에 같은 입력을 주고 시각·오디오 이벤트의 속성별 이름을 정규화한 뒤 상태 전체를 비교한다.
3. 일시정지 구간 전후 상태가 정확히 이어지는지 확인한다.
4. 어떤 충돌 조합에서도 한 tick의 hp 감소량이 1보다 크지 않은지 확인한다.
5. 제거된 객체가 다시 점수나 피해를 만들지 않는지 확인한다.

## 브라우저 어댑터 계약

순수 엔진 밖에서 별도 테스트한다.

- Space/ArrowUp → JUMP, X/KeyX → ATTACK, P/Escape → PAUSE/RESUME.
- keydown의 `repeat=true`는 점프와 공격을 발행하지 않는다.
- 터치 `pointerdown`은 기본 동작을 막고 action을 한 번만 발행한다. pointerdown과 click이 중복 발행되지 않는다.
- 첫 속성 선택 또는 첫 조작이 AudioContext를 resume한다.
- `visibilitychange(hidden)`과 `blur`는 실행 중일 때만 PAUSE를 발행한다.
- 렌더러의 보스 draw y는 `groundLine - spriteHeight + footOffsetY`로 계산하고, 패배 알파가 draw y에 영향을 주지 않는다.

## 최소 자동 테스트 묶음

출시 전 최소한 다음 이름의 테스트가 있어야 한다.

1. `damage_does_not_reset_before_zero_hp`
2. `respawn_restores_latest_checkpoint_only_at_zero_hp`
3. `fire_and_ice_are_mechanically_identical_for_10000_ticks`
4. `double_jump_accepts_two_and_rejects_third`
5. `pause_freezes_every_timer_and_entity`
6. `restart_returns_to_element_select`
7. `pickup_height_requires_jump_and_is_reachable`
8. `enemy_defeat_emits_element_specific_audio_event`
9. `boss_keeps_minimum_distance_for_full_cycle`
10. `boss_feet_use_shared_ground_line`
11. `boss_defeat_changes_alpha_not_y`
12. `invalid_dt_never_corrupts_state`
