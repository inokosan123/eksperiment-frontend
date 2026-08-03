# Focus → App Blocking / Web Protection: Expo Go native crash investigation

Датум: 2026-08-03  
Статус: форензички план; без измене дизајна, анимација, enforcement-а, SQL-а или Swift логике  
Последњи phone резултат: и LAN и tunnel потпуно гасе Expo Go

## 1. Тачан симптом

На физичком iPhone-у, у Expo Go development окружењу:

1. Home, Library, Inner и главни Focus екран могу да се отворе.
2. Притисак на `APP BLOCKING` покушава да отвори `/day-plans`.
3. Притисак на `WEB PROTECTION` покушава да отвори `/clean-sight`.
4. У оба случаја Expo Go процес се потпуно угаси и iOS врати корисника на Home Screen.
5. Нема React Native RedBox-а, JavaScript stack trace-а ни recoverable error екрана.

Ово није обична React render грешка. Потпуни process exit најчешће значи native exception/abort, iOS termination или Jetsam (memory-pressure termination). Apple изричито наводи да Jetsam док је апликација у foreground-у кориснику изгледа као crash.

## 2. Хронологија онога што је мењано и проверено

### 2.1. Focus Today Plan Groups редизајн

Договорен је frontend редизајн Plan Groups стања (`pending`, `noLimit`, `limitActive`, `blocked`, `atLimit`, `overLimit`), Essentials-only и Always Blocked presentation, уз заједничке RN shell компоненте и семантички усклађен Swift daily report.

Claude имплементација је дотакла кластер око:

- `TodayUsageBreakdown.tsx` и `todayUsageModel.ts`;
- `AppRulesBoard.tsx`, `GroupLimitSheet.tsx`, `GroupSeal.tsx`;
- Today detail и reusable card shell-ова;
- `AnastaActivityReport.swift` и Focus тестова.

Post-Claude стање је сачувано у:

```text
.tmp/focus-plan-groups-post-claude-20260803-1145
```

### 2.2. Неуспешни workaround покушаји

Током раније дијагностике привремено су испробани loading/defer механизми и смањивање mount рада. Покушаји који су мењали или уклањали Lottie/Reanimated/визуелне ефекте нису решили crash и нису прихватљив коначни правац. Дизајн и анимације морају остати.

Привремени `InteractionManager/surfaceReady` и `ConfirmModal mountOnDemand` правци нису доказали узрок и уклоњени су. Механизам који одлаже примену плана до после затварања sheet-а је посебна, раније договорена заштита и није део иницијалног route mount-а.

### 2.3. Reanimated/Worklets runtime усклађивање

Урађено је:

- exact pin `react-native-reanimated@4.1.1`;
- exact `react-native-worklets@0.5.1`;
- уклоњен ручни `react-native-reanimated/plugin` из Babel конфигурације;
- задржан `babel-preset-expo`, који управља Worklets трансформацијом;
- проверено да dependency tree нема дупле Reanimated/Worklets инстанце;
- додат `test:expo-runtime` regression check;
- Metro cache је очишћен и Expo Go поново покретан.

Crash је остао. Зато локални duplicate runtime или погрешан package pin више није водећа хипотеза. И даље мора да се потврди која је стварна Expo Go native верзија инсталирана на телефону, јер JavaScript package tree не може да промени native библиотеке у App Store Expo Go бинарном фајлу.

### 2.4. Форензички rollback Claude Plan Groups кластера

У reachable Git историји није пронађен засебан Aug-02 Claude commit. Из Git loose-object временских трагова ипак су пронађени и враћени byte-for-byte pre-Claude blob-ови за кључне датотеке:

| Датотека | Враћени blob |
|---|---|
| `todayUsageModel.ts` | `178c1da9725692f6532813197b87182d606c8552` |
| `TodayUsageBreakdown.tsx` | `8c5f10dd5d6252c4bdccea6b497ab184d3ded895` |
| `AnastaActivityReport.swift` | `90387533b5a234d018b34c248ae7b166cd99af23` |
| `GroupSeal.tsx` | `ae9773e0a708278c5d39caa20d8c63672a4e75f5` |
| `GroupLimitSheet.tsx` | `c7dab180f1468e87f5bd934e2814efd33020f738` |
| `AppRulesBoard.tsx` | `d2a75c40e765faee61ebcf336afe8a01d0c95f31` |
| `tests/focus-v4.test.ts` | `d78b188a93d0ed09239c3a471c328c9195dd95cc` |

`TodayDetailView.tsx` је враћен на pre-Claude/HEAD садржај, а Claude-only `focus-group-card.tsx` и `focus-app-card.tsx` су уклоњени. Неповезане касније измене у прљавом worktree-ју су сачуване.

После rollback-а су прошли TypeScript, Focus тестови (92/92), plugin тест, runtime check, lint без нових error-а и iOS Expo export. Физички iPhone је после тога и даље имао исти потпуни Expo Go crash.

Закључак: Plan Groups RN/Swift presentation кластер има јаку временску корелацију са почетком проблема, али exact rollback није уклонио crash. Он зато није доказани директни узрок `/day-plans` или `/clean-sight` process exit-а.

## 3. Тренутно runtime окружење

Локални start script покреће:

- Expo Go target, не development client;
- Metro преко LAN-а на фиксном порту `8082`;
- portable Node `v22.23.1`;
- `--clear` када се користи `npm run start:clear`;
- Expo SDK 54, React Native 0.81.5, React 19.1;
- New Architecture/Fabric и Hermes;
- Reanimated 4.1.1, Worklets 0.5.1, Screens 4.16.x и SVG 15.12.1.

Живи Metro manifest је проверен преко стварне LAN адресе. Он исправно објављује:

```text
runtimeVersion=exposdk:54.0.0
hostUri=192.168.0.23:8082
lazy=true
transform.asyncRoutes=true
transform.engine=hermes
transform.bytecode=1
```

Дакле, LAN host није погрешно замењен са `127.0.0.1`. Али iOS route-ови се у development-у заиста lazy bundle-ују и учитавају тек при првој навигацији.

## 4. Да ли LAN има лимит величине Focus фајла?

Ни Expo ни Metro не документују фиксни LAN лимит величине React component фајла после кога Expo Go мора да угаси процес. LAN и tunnel су различити начини транспорта истог development manifest-а и JavaScript bundle-а. Прекинут или недоступан bundle request би нормално требало да произведе network/Metro/JavaScript грешку, не silent iOS process exit.

Локалне величине такође не указују на „један превелик фајл“:

| Модул | Тренутна величина |
|---|---:|
| `DayPlanHubView.tsx` | око 53 KB / 1086 линија |
| `PurityView.tsx` | око 113 KB / 2102 линије |
| `dayPlanStore.ts` | око 119 KB / 3199 линија |

То нису саме по себи критичне величине. `dayPlanStore` је већ учитан на главном Focus екрану, пре клика на било коју од две картице.

Количина кода ипак може индиректно да буде фактор ако први lazy route load:

- доведе до Expo Router/Metro lazy-chunk проблема;
- направи кратак memory peak у Expo Go/Hermes-у;
- истовремено покрене native Stack transition, Reanimated layout animations и mount великог view tree-а;
- активира native API који није у Expo Go бинарном runtime-у.

Зато LAN није проглашен кривцем, али `LAN versus tunnel` остаје користан A/B тест транспорта.

## 5. Заједнички пут две crash навигације

Главни Focus екран користи:

```text
APP BLOCKING    -> router.push('/day-plans')  -> DayPlanHubView
WEB PROTECTION  -> router.push('/clean-sight')-> PurityView
```

Оба су root native Stack screen-а са `slide_from_right`. Оба су у development-у Expo Router async routes, што значи React Suspense + route-based lazy bundling при првом клику.

Оба екрана такође позивају `usePermissionGate`. Тај hook:

- чита permission из већ учитаног `dayPlanStore`-а;
- mount-ује затворен permission dialog;
- користи `requireOptionalNativeModule('AnastaFocus')` fallback.

Међутим, `focusNativeBridge` и optional Anasta module су већ импортовани и коришћени у root `FocusNativeCoordinator`-у и на главном Focus екрану. У Expo Go-у custom Swift `AnastaFocus` модул не постоји и optional lookup треба да врати `null`. Зато је `usePermissionGate` важан за аудит, али тренутно није јачи доказ од заједничког async native Stack пута.

## 6. Шта је већ искључено или значајно ослабљено

| Хипотеза | Статус | Разлог |
|---|---|---|
| Swift daily report директно руши Expo Go | Практично искључено | App Store Expo Go не садржи локални Anasta Swift модул ни Device Activity extension. |
| Plan Groups presentation код је директни узрок | Значајно ослабљено | Кључни кластер је exact rollback-ован; crash је идентичан. |
| Једна Lottie/Reanimated декорација је очигледни узрок | Непотврђено и не сме се насумично уклањати | Анимације су постојале док је екран радио; два различита route-а сада падају. |
| Локални duplicate Reanimated/Worklets | Искључено локалним audit-ом | Exact SDK 54 верзије и једна dependency инстанца. |
| Погрешна LAN адреса у manifest-у | Искључено | Живи iOS manifest користи `192.168.0.23:8082`. |
| Фиксни LAN „file-size лимит“ | Веома мало вероватно | Нема таквог документованог ограничења; величине модула нису екстремне. |
| Обична React render грешка | Веома мало вероватно | Нема RedBox-а; гаси се цео iOS процес. |

## 7. Рангиране преостале хипотезе

### A. Expo Router async route + native Stack development race

Најјачи тренутни заједнички траг:

- оба падајућа екрана су lazy route-ови;
- crash се јавља баш на првом `router.push`/route load-у;
- живи manifest потврђује `lazy=true` и `transform.asyncRoutes=true`;
- Expo документација async routes означава као alpha;
- root layout истовремено користи `unstable_settings`, а Expo упозорава да `unstable_settings` не ради са development async routes;
- route push иде кроз `react-native-screens` native stack док се нови tree и Reanimated entering animations истовремено монтирају.

Ограда: async routes конфигурација постоји дуже од Claude измене и раније је радила. Зато сама конфигурација није потпуна историјска дијагноза; могућ је latent bug који се појавио после раста route graph-а, cache/runtime промене или Expo Go update-а.

### B. Стварни Expo Go бинарни SDK не одговара SDK 54 JavaScript runtime-у

Пројекат служи `exposdk:54.0.0`. Expo документација наводи да физички iPhone из App Store-а може да има само актуелну Expo Go native верзију, док је SDK 54 iOS device download страница сада означена као unavailable. Ако се Expo Go аутоматски ажурирао, локално исправни Reanimated 4.1.1 не гарантује да native Reanimated/Screens/Worklets у телефону припадају SDK 54.

Ограда: чињеница да Home и Focus уопште раде сугерише да телефон можда још има SDK 54-compatible Expo Go. Зато се ово не сме прогласити узроком без Expo Go version/About податка.

### C. iOS native exception у Screens/Fabric/Reanimated view lifecycle-у

Native stack push, Reanimated entering animations и animated SVG view-ови могу да се сусретну у истом native mount циклусу. Reanimated документација посебно напомиње `nativeID` и view-flattening ограничења у New Architecture layout animations.

Ово се решава тек ако `.ips` stack покаже `RNSScreen`, `RCTComponentViewRegistry`, Reanimated/Worklets или SVG frame-ове. До тада се анимације не уклањају и дизајн се не деградира.

### D. Jetsam / memory peak при lazy route load-у

Потпуни повратак на iOS Home без RedBox-а одговара и Jetsam сценарију. Dev Hermes bytecode, Metro lazy segment, велики app state и mount више sheet/modal tree-ова могу кратко повећати меморију. Саме TS датотеке нису довољно велике да то докажу.

Само `JetsamEvent...ips` са process/reason подацима може да потврди овај правац.

### E. Заједнички mount boundary (`usePermissionGate`, hidden native Modal или други shared component)

Оба route-а mount-ују permission gate и више затворених sheet/modal компоненти. Ако crash log покаже UIKit presentation/Modal frame-ове, ове компоненте треба mount-овати само када су стварно видљиве, уз потпуно исти видљив дизајн и понашање.

Тренутно је ова хипотеза нижа јер су gate и optional native bridge постојали пре проблема, а Anasta optional module се већ учитава на root-у без crash-а.

## 8. Дијагностички редослед без нарушавања дизајна

### Корак 1: забележити стварни iPhone runtime

Пре нове измене забележити:

- Expo Go version/build из Expo Go Settings/About;
- iPhone модел и iOS верзију;
- да ли је Expo Go недавно ажуриран;
- тачно време једног свежег crash-а.

Ово потврђује или обара SDK 54 native-runtime хипотезу.

### Корак 2: узети native `.ips` или Jetsam извештај

На iPhone-у:

1. `Settings → Privacy & Security → Analytics & Improvements → Analytics Data`.
2. Одмах после репродукције потражити најновији запис са именом `Expo Go`, `Exponent` или сличним Expo process именом.
3. Ако њега нема, потражити `JetsamEvent` запис за исто време.
4. Поделити цео `.ips` фајл, не screenshot само првих редова.

Кључна поља су `Exception Type`, `Termination Reason`, crashed thread/backtrace, process name, iOS build и код Jetsam-а `reason`, `rpages`, `lifetimeMax` и `largestProcess`.

### Корак 3: LAN/tunnel A/B без измене кода

1. Угасити Metro на 8082.
2. Покренути `npm run start:tunnel:clear`.
3. Потпуно force-close Expo Go, поново га отворити и скенирати нови QR.
4. Тестирати истим редом: Home → Focus → App Blocking; затим поново Focus → Web Protection.

Тумачење:

| Резултат | Закључак |
|---|---|
| Tunnel ради, LAN пада | Мрежни/route-chunk transport је стварни фактор; не дирати UI. |
| И LAN и tunnel падају | LAN transport није узрок; наставити на async route A/B. |

Резултат 2026-08-03: и tunnel је произвео исти потпуни process exit за Focus route. LAN, router/firewall и локални Wi-Fi transport више нису водећи узрок.

### Корак 4: iOS async-routes A/B, једина прва config измена

У `expo-router` plugin конфигурацији привремено поставити `ios: false` за `asyncRoutes`, без промене web/Android политике. После тога `npm run start:clear` и проверити да iOS manifest више нема `lazy=true`/`transform.asyncRoutes=true`.

Ово не мења layout, Lottie, Reanimated, sheet понашање ни business logic. Мења само development bundling стратегију.

Статус 2026-08-03: A/B конфигурација је припремљена са `ios: false`; потребан је потпуно нов `npm run start:clear` процес да би Metro manifest преузео измену.

Тумачење:

| Резултат | Коначни правац |
|---|---|
| Оба route-а постану стабилна | Задржати iOS async routes искљученим док Expo Router alpha пут не буде доказано стабилан; додати manifest regression check. |
| Crash остане | Вратити config или га не проглашавати исправком; одлучити према `.ips` stack-у. |

Корисна додатна контрола је cold deep link директно на `/day-plans`: ако cold route mount ради, а push из Focus-а пада, проблем је ближи native Stack transition-у; ако оба падају, проблем је у route evaluation/mount-у или memory/runtime-у.

### Корак 5: проверити matching Anasta development build

Овај пројекат садржи локални Swift `AnastaFocus` модул и Apple Device Activity extension. Expo Go их никада не извршава. За стварни Focus acceptance потребан је SDK-matched development build инсталиран на iPhone-у, затим Metro преко:

```text
npm run start:dev-client:clear
```

Ако matching development build ради, а Expo Go пада, узрок је Expo Go native runtime/compatibility, не дизајн екрана. Ако оба падају, `.ips` из development build-а ће бити далеко кориснији јер припада нашем бинарном фајлу и може да се symbolicate-ује.

### Корак 6: код мењати само према crash signature-у

- `Reanimated` / `Worklets` stack: проверити стварни binary version, cache и runtime match; не уклањати анимације.
- `RNSScreen` / `RCTComponentViewRegistry` / layout animation stack: сачувати исти визуелни дизајн, али стартовати entering/looped анимације после navigation `transitionEnd` и отказати shared-value анимације на blur/unmount.
- `JetsamEvent`: профилисати memory peak; lazy mount-овати затворене sheet/modal tree-ове и поделити route module graph без измене видљивог UI-а.
- UIKit `Modal`/presentation stack: mount-овати permission/confirm dialog само када је `visible=true`, уз исти изглед и интеракције.
- Hermes/JavaScript fatal stack: направити најмањи route-level reproduction и додати route `ErrorBoundary`; обична JS грешка сама не објашњава silent SIGKILL.
- Network/Metro stack без native exception-а: задржати tunnel или поправити LAN/router/firewall; не мењати Focus компоненте.

## 9. Acceptance критеријуми

Исправка је прихваћена тек када на физичком iPhone-у:

- Home, Library, Inner и Focus раде после cold start-а;
- `APP BLOCKING` и `WEB PROTECTION` се отворе и затворе најмање 10 пута;
- брз back/forward и background/foreground не угасе процес;
- Today detail и Focus analytics route-ови немају regression;
- Lottie, Reanimated entering/aura/SVG и navigation transitions визуелно остану непромењени;
- нема новог loading-only екрана који прикрива crash;
- нема измене Swift enforcement-а, SQL-а, persistence-а или backend уговора само ради Expo Go fallback-а;
- development build посебно потврди стварни Anasta Swift/Device Activity ток.

## 10. Извори

- [Expo: Async routes](https://docs.expo.dev/router/web/async-routes/)
- [Expo: Router settings and async-routes warning](https://docs.expo.dev/router/advanced/router-settings/)
- [Expo: Start developing over LAN or tunnel](https://docs.expo.dev/get-started/start-developing/)
- [Expo: Debugging runtime issues and native iOS logs](https://docs.expo.dev/debugging/runtime-issues/)
- [Expo: Development builds FAQ](https://docs.expo.dev/develop/development-builds/faq/)
- [Expo: Add custom native code](https://docs.expo.dev/workflow/customizing/)
- [Expo Go for SDK 54 on physical iOS](https://expo.dev/go?device=true&platform=ios&sdkVersion=54)
- [Expo SDK 54 reference](https://docs.expo.dev/versions/v54.0.0/)
- [Expo SDK 54 react-native-screens version](https://docs.expo.dev/versions/v54.0.0/sdk/screens/)
- [Reanimated troubleshooting and Expo Go version matching](https://docs.swmansion.com/react-native-reanimated/docs/guides/troubleshooting/)
- [Reanimated entering/exiting animation New Architecture remarks](https://docs.swmansion.com/react-native-reanimated/docs/3.x/layout-animations/entering-exiting-animations/)
- [Apple: Diagnosing issues using crash reports and device logs](https://developer.apple.com/documentation/xcode/diagnosing-issues-using-crash-reports-and-device-logs)
- [Apple: Analyzing a crash report](https://developer.apple.com/documentation/xcode/analyzing-a-crash-report)
- [Apple: Identifying high-memory use with Jetsam reports](https://developer.apple.com/documentation/xcode/identifying-high-memory-use-with-jetsam-event-reports)

## 11. Одлука

Следећи потез није ново редизајнирање и није уклањање анимација. Најкраћи доказни пут је:

```text
Expo Go version + свеж .ips
        ↓
LAN/tunnel A/B
        ↓
iOS asyncRoutes=false A/B
        ↓
matching Anasta development build
        ↓
само stack-specific код исправка
```

Овај редослед чува све касније дизајнерске измене и спречава да се поново „лечи“ цела апликација због проблема који припада једном runtime слоју.
