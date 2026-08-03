# Claude handoff: Focus Today — Plan Groups redesign

## Cilj

Implementirati frontend redizajn sekcije `Plan groups` i proširenih lista aplikacija na ekranu dnevne analitike:

- Sačuvati gornju karticu današnjeg plana i njen progress bar.
- Ne menjati backend, SQL, enforcement, pragove, navigaciju niti ostatak analitike.
- Isti model stanja implementirati u React Native fallbacku i u Swift `DeviceActivityReport` prikazu koji se koristi na stvarnom iPhone-u.
- Postojeći dizajn iz sheetova koristiti kao univerzalni izvor, a ne praviti posebne Today-only kopije.
- Plan sačuvati kao `docs/focus-today-plan-groups-redesign.md`.

## Model stanja

Redosled određivanja stanja:

1. Nepoznato korišćenje → `pending`.
2. Eksplicitno blokirana grupa/aplikacija ili postojeća normalizovana zero-minute blokada → `blocked`.
3. Nema efektivnog limita → `noLimit`.
4. `used < limit` → `limitActive`.
5. `used === limit` → `atLimit`.
6. `used > limit` → `overLimit`.

| Stanje | Vizuelni tretman | Tekst |
|---|---|---|
| `pending` | Neutralna parchment/white kartica | `PENDING`, korišćenje `—` |
| `noLimit` | Postojeći neutralni inactive izgled | `NO LIMIT` i zabeleženo vreme |
| `limitActive` | Postojeći blue-purple limit dizajn | Za nulu `LIMIT SET`; inače `ON TRACK` i preostalo vreme |
| `blocked` | Postojeći rose blocked dizajn i lock | Bez progress bara |
| `atLimit` | Svetlo zlatna boja i pun progress bar | `AT LIMIT` |
| `overLimit` | Scarlet/red, mali `!` preko gornjeg ugla group/app slike | `OVER BY Xm`; pun statičan progress bar |

Dodatna pravila:

- Boja predstavlja stanje, nikada kategoriju ili nasumično dodeljen identitet.
- Ako blokirana grupa ima zabeleženo današnje korišćenje, ostaje rose sa lock ikonom i dobija `RECORDED` i `Xm RECORDED TODAY`. Ne prikazivati je kao prekoračenje jer Apple report obuhvata i korišćenje pre aktiviranja plana.
- `blocked` i `overLimit` moraju ostati jasno različiti: lock naspram `!`.
- `Always Blocked` ostaje zasebna sekcija. Njena stanja su `PENDING`, `PROTECTED` ili `Xm RECORDED TODAY`.
- U Essentials-only planu obične Plan group kartice zameniti jednom mirnom protected karticom:
  - naslov: `ESSENTIALS ONLY`
  - opis: `Only essential apps are available during this plan.`
  - `Always Blocked` ostaje zasebno prikazan.
- Apple-generated `__other` prikazati poslednji kao neutralni `Other activity` red. Ne tretirati ga kao plan grupu i ne uključivati ga u child-state brojanje.

## Grupe i aplikacije

- Grupa uvek dobija boju prema sopstvenom pravilu i korišćenju.
- Stanje child aplikacija ne sme menjati boju cele grupe.
- Collapsed grupa može imati samo sekundarni signal:
  - `1 APP OVER` / `N APPS OVER`
  - ako nema prekoračenja: `1 APP AT LIMIT` / `N APPS AT LIMIT`
  - `over` ima prioritet nad `at limit`.
- Child signal se ne prikazuje dok su app podaci pending.
- Proširena aplikacija koristi istih šest stanja kao grupa.
- Aplikacija bez sopstvenog limita unutar limitirane grupe dobija `USES GROUP BOUNDARY` ili `NO INDIVIDUAL LIMIT`; ne predstavljati je kao da izbegava grupni limit.
- Aplikacije u blokiranoj grupi dobijaju `GROUP BLOCKED`; njihovi dormant individualni limiti se ne prikazuju kao aktivni.
- Zadržati postojeći redosled grupa i aplikacija.
- Samo jedna grupa može biti proširena u istom trenutku.

## Implementacija i arhitektura

- Iz `AppRulesBoard.tsx` izdvojiti reusable shell postojećeg `GroupRuleCard` dizajna.
- Iz `GroupLimitSheet.tsx` izdvojiti reusable shell postojećeg `AppRuleCard` dizajna.
- Sheetovi i Today analytics moraju koristiti te iste komponente; ne duplirati njihov izgled u zasebnim Today komponentama.
- Proširiti `GroupSeal` markerom `none | lock | warning`.
- Uvesti zajedničke prezentacione tipove:

```ts
type FocusBoundaryAppearance =
  | 'pending'
  | 'noLimit'
  | 'limitActive'
  | 'blocked'
  | 'atLimit'
  | 'overLimit';

type FocusSecondarySignal =
  | { kind: 'childOver'; count: number }
  | { kind: 'childAtLimit'; count: number }
  | { kind: 'recordedWhileBlocked'; minutes: number }
  | null;
```

- Napraviti čist resolver i jedan memoizovan prolaz koji sirove usage/rule podatke pretvara u view modele.
- Swift report mora pratiti istu tabelu stanja, precedence i copy, iako ne može deliti React Native komponente.
- Ne menjati backend kontrakte ili podatke samo radi prezentacije. Ako postojeći podaci ne mogu izraziti neko definisano stanje, prijaviti konkretan konflikt pre širenja scope-a.

## Izgled, pristupačnost i performanse

- Koristiti postojeće tokene: parchment/inactive, `RULE_TONES.limit`, `RULE_TONES.blocked`, postojeći gold i `C.red`.
- Sačuvati tipografiju, radius, spacing, shadows i vizuelni jezik sheetova; dozvoljena su samo mala poboljšanja koja ostaju u trenutnim okvirima dizajna.
- Boja ne sme biti jedini signal: koristiti lock, `!`, status chip i jasan tekst.
- Accessibility label mora obuhvatiti naziv, stanje, korišćenje/limit i expanded/collapsed status.
- Proveriti narrow iPhone širine, duge nazive, large text, safe area, tabularne brojeve i clipping.
- Expand/collapse animacija: Reanimated na UI threadu u RN-u i native SwiftUI animacija u reportu, približno 180–230 ms.
- Poštovati Reduce Motion.
- Bez `Animated.Value`, `PanResponder`, JS-thread animacija, Lottie feedbacka i novih animacionih dependency-ja.
- Bez nested app drawers i nested virtualized lista.
- Koristiti stabilne ključeve, memoizovane kartice/view modele i statičke palette/gradient/SVG definicije. Usage refresh ne sme svakih 30 sekundi rekonstruisati nepotrebna dekorativna stabla.
- Haptic samo pri direktnom expand/collapse tapu; nikada pri pozadinskom usage osvežavanju.
- Za novi platform-specific RN kod koristiti projekatski Expo obrazac i `process.env.EXPO_OS`; koristiti `useWindowDimensions` samo kada je stvarno potreban responsive proračun.
- Expo MCP koristiti kao pomoć za proveru Expo/Reanimated kompatibilnosti, smoothnessa i reduced-motion ponašanja, ali postojeći repo i `AGENTS.md` ostaju izvor istine.

## Provera i acceptance kriterijumi

Obavezni scenariji:

- Pending grupa i pending child aplikacija.
- No-limit grupa sa i bez korišćenja.
- Limit sa `0`, ispod limita, tačno na granici i preko limita.
- Konfigurisana blokada bez korišćenja i sa recorded-today korišćenjem.
- Child `over`/`at limit` signal i njihov prioritet.
- App bez individualnog limita koja nasleđuje grupnu granicu.
- Aplikacije unutar blokirane grupe.
- Essentials-only plan.
- `Always Blocked`.
- `Other activity`.
- Dugi nazivi, large text i Reduce Motion.

Verifikacija:

- Pokrenuti postojeće focus model/resolver testove i dodati table-driven testove za sva stanja i granične vrednosti.
- Pokrenuti ESLint, TypeScript proveru, focus plugin testove i relevantan Expo export.
- Proveriti React Native fallback.
- Proveriti Swift report/Xcode build na podržanom macOS okruženju.
- Ručno testirati rapid expand/collapse i periodično usage osvežavanje na stvarnom iPhone-u.
- Ako Swift/Xcode ili telefon nisu dostupni, to jasno navesti kao neizvršenu proveru; ne tvrditi da je native deo verifikovan.

## Prompt koji se zajedno sa planom daje Claude-u

```text
Implement the attached plan in this repository:

C:\Users\User\Desktop\eksperiment-frontend

The implementation plan is:

docs/focus-today-plan-groups-redesign.md

This is an implementation task, not another planning exercise. Read AGENTS.md and the complete plan before editing, then inspect the existing Focus flow and current uncommitted changes.

Hard boundaries

- Work only inside the repository above.
- C:\Users\User\Desktop\Daily-Christian is reference-only and must never be modified.
- Preserve the dirty worktree and all user changes. Do not reset, restore, overwrite, reformat, or remove unrelated work.
- Keep the change narrowly scoped to Plan groups and their expanded app rows in Today/daily analytics.
- Do not redesign the top Today's Plan card, its progress bar, navigation, charts, normal overview, backend enforcement, SQLite/persistence, schemas, thresholds, or plan activation logic.
- Do not stage, commit, push, or open a PR unless explicitly requested.

Design source of truth

Use the already polished group and app designs as the source of truth:

- AppRulesBoard / GroupRuleCard
- GroupLimitSheet / AppRuleCard
- ProtectionRegister
- GroupSeal
- Existing RULE_TONES and design tokens

Extract and reuse shared card shells so sheets and Today analytics remain visually universal. Do not create approximate Today-only copies and do not introduce a second design system.

State colors must communicate state, never category:

- pending: neutral parchment with PENDING
- no limit: neutral parchment with NO LIMIT
- active finite limit: established blue-purple limit style
- configured blocked: established rose style with lock
- exactly at limit: light gold with AT LIMIT
- over limit: scarlet/red with a small warning ! over the image and OVER BY Xm

Configured blocked and over-limit are different concepts and must never look interchangeable. If a configured blocked item has usage recorded earlier today, keep the lock/rose design and show factual RECORDED / Xm RECORDED TODAY copy. Do not claim that a violation occurred.

Implement the full state, child-rollup, inherited-boundary, Essentials-only, Always Blocked, and Other activity behavior exactly as defined in the plan. Preserve current sorting.

Native parity is mandatory

The real iPhone path uses the Swift DeviceActivityReport, so completing only the React Native fallback is incomplete. Implement semantically identical states, precedence, copy, markers, and Essentials-only behavior in both:

1. React Native fallback
2. Native Swift report extension

Performance and interaction requirements

- Keep only one group expanded at a time.
- Use react-native-reanimated and react-native-gesture-handler for new RN interaction motion; use native SwiftUI animation in the report.
- Keep expand/collapse around 180–230 ms and support Reduce Motion.
- Do not use Animated.Value, Animated.timing/spring, PanResponder, JS-thread gesture animation, Lottie, or a new dependency.
- Do not add nested app drawers or nested virtualized lists.
- Build normalized view models in one memoized pass.
- Memoize cards and use stable IDs/keys.
- Keep palettes, gradients, and SVG definitions stable so the periodic usage refresh does not reconstruct unnecessary decorative trees.
- Never trigger haptics from background refresh. A light selection haptic is allowed only on a direct expand/collapse tap.
- Use the project's Expo conventions. For new platform branches prefer process.env.EXPO_OS. Avoid Dimensions.get; use responsive flex/gap patterns or useWindowDimensions only when necessary.
- If Expo MCP is available, use it to validate Expo/Reanimated compatibility, smooth transitions, and reduced-motion behavior. Do not let it override the repository architecture or AGENTS.md.

Visual and accessibility quality

- Preserve the current typography, spacing rhythm, continuous rounded shapes, shadows, and parchment visual language.
- Make only restrained improvements that fit the existing product.
- Test narrow iPhone widths, long group/app names, large text, safe areas, tabular time values, truncation, and clipping.
- Color cannot be the only state signal. Keep textual chips plus lock/warning markers.
- Accessibility labels must communicate the item name, state, usage/limit, and expanded/collapsed status.
- Make the ! marker readable but subtle; it must not resemble the configured-block lock.
- Avoid excessive comments, broad refactors, and unrelated formatting.

Implementation workflow

1. Inspect the current model/resolvers and both rendering paths.
2. Add or update pure resolver tests for the complete state table and exact boundaries.
3. Extract reusable visual shells without changing existing sheet behavior.
4. Implement the RN Today presentation.
5. Implement matching Swift presentation.
6. Run focused tests after each layer, followed by TypeScript, lint, focus plugin checks, relevant Expo export, and native build checks where available.
7. Manually verify rapid expand/collapse, usage refresh, Reduce Motion, and visual parity on a real iPhone when available.

Do not silently invent backend behavior. If the existing data contradicts the plan or cannot express a required state, stop that part and report the precise data/interface conflict instead of widening the scope.

Your final response must include:

- What behavior changed.
- Which shared components/resolvers were introduced or reused.
- Confirmation that RN and Swift paths were both addressed.
- Tests and builds actually run, with results.
- Any remaining real-device or Xcode validation.
- Any pre-existing failures or dirty-worktree conflicts you preserved.
```
