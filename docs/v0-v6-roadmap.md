# AgentScope V0-V6 Roadmap

Current implementation status:

```txt
V2.2  done     Scope Review / Override UX
V2.3  done     Multi-task Scope History
V3.0  done     Local Policy Gate CLI (`agentscope gate`)
V3.1  done     CI workflow template
V3.2  done     Repo-local reusable GitHub Action
V3.3  done     CI Summary Output (`agentscope ci-summary`)
V3.4  done     Release hardening / demo polish (v0.1.0)
V4    planned  SARIF / PR comments / Team Policy Registry
```

The local + CI loop is complete and local-only / CI-only. It implements a repo-local reusable GitHub Action and a human-readable CI summary, but does **not** implement Marketplace Action publishing, SARIF, PR comments, GitHub API calls, remote/team policy, cloud sync, or branch protection integration. Those remain planned.

## 鎬讳綋璺嚎

AgentScope 鐨勫紑鍙戣矾绾垮垎涓轰竷涓樁娈碉細

V0: 鏈湴鍘熷瀷
V1: Claude Code MVP
V2: Scope Auto Inference 娣卞寲
V3: Evidence + Policy Gate
V4: Team Policy Registry
V5: Multi-Agent Governance
V6: Enterprise Governance

鏍稿績涓荤嚎锛?

Task
鈫?Scope Auto Inference
鈫?Human Approval
鈫?Runtime Enforcement
鈫?Evidence Package
鈫?Risk Scoring
鈫?Policy Gate

## 褰撳墠杩涘害姒傝

```txt
V0    鉁?done    鏈湴 Task Scope Contract + git diff check
V1.0  鉁?done    Core Policy Engine (ToolEvent 鈫?PolicyDecision)
V1.1  鉁?done    Claude Code PreToolUse translator + hook entrypoint
V1.2  鉁?done    Claude Code hook installer + live runtime enforcement
V1.3  鉁?done    Evidence Event Recorder
V1.4  鉁?done    Deterministic Risk Score V1
V1.5  鉁?done    GitHub-ready demo polish (README / examples / docs / packaging)
V2.0  鉁?done    Scope Inference V2 (deterministic classifier + rule packs)
V2.1  鉁?done    Policy Config Improvements (.agentscope/config.yaml + effective config)
V2.2  鈻?current  Scope Review / Override UX (scope explain/diff/apply + start override flags)
V3    鈴?planned Evidence + Policy Gate + GitHub Action
V4    鈴?planned Team Policy Registry
V5    鈴?planned Multi-Agent Governance
V6    鈴?planned Enterprise Governance
```

Policy Gate 鍜?GitHub Action 浠嶅睘浜?V3锛?*灏氭湭瀹炵幇**锛汿eam Policy Registry 灞炰簬 V4锛?*灏氭湭瀹炵幇**銆俈2.2 鍙仛 scope review/override UX锛坄scope explain` / `scope diff` / `scope apply`銆乣start` 鐨?override flags銆佺函鍑芥暟 `applyScopeOverride` / `diffScopes`锛夛紝override 鍙奖鍝嶅崟涓?active scope銆?*涓嶄慨鏀?config.yaml**銆佷笉鏀瑰彉 runtime enforcement 璇箟銆?

## V0锛氭湰鍦板師鍨嬬増

### 鐩爣

楠岃瘉 AgentScope 鏈€鏍稿績鐨勪綋楠岋細

agentscope start "Fix login redirect bug"

鑳藉鐢熸垚涓€涓?Task Scope Contract锛屽苟鐢ㄥ畠妫€鏌ュ綋鍓?git diff 鏄惁瓒婄晫銆?

V0 涓嶉渶瑕佹帴鍏?Claude Code銆?

V0 鐨勭洰鏍囨槸璇佹槑锛?

鑷劧璇█浠诲姟鍙互杞崲鎴愭渶灏忔潈闄愯竟鐣屻€?

### 蹇呴』瀹炵幇

1. CLI 鍩虹妗嗘灦
2. `agentscope init`
3. `agentscope start "<task>"`
4. Task Scope Contract 鍒濈増鐢熸垚
5. 鐢ㄦ埛纭娴佺▼
6. `.agentscope/current-scope.yaml`
7. `agentscope show`
8. `agentscope check`
9. 鍩轰簬 git diff 鐨?scope 妫€鏌?

### 鎺ㄨ崘鍛戒护

agentscope init

鐢熸垚锛?

.agentscope/
  config.yaml
  current-scope.yaml
  scopes/
  evidence/

agentscope start "Fix login redirect bug"

鐢熸垚锛?

task:
  id: fix-login-redirect
  title: "Fix login redirect bug"

confidence: 0.62

allowed_paths:
  - src/**
  - tests/**

blocked_paths:
  - .env*
  - migrations/**
  - .github/**

allowed_commands:
  - npm test
  - npm run lint

high_risk:
  - package.json
  - package-lock.json
  - pnpm-lock.yaml

agentscope check

杈撳嚭锛?

Scope Check

鉁?src/auth/login.ts is within allowed paths
鉁?tests/auth/login.test.ts is within allowed paths
鈿?package.json is high risk
鉂?.github/workflows/deploy.yml is blocked

### V0 Scope Inference 瑙勫垯

V0 鍙仛绠€鍗曟帹鏂細

- 璇诲彇 package.json
- 璇嗗埆 npm / pnpm / yarn
- 璇嗗埆 test / lint scripts
- 鏍规嵁浠诲姟鍏抽敭璇嶅尮閰嶈矾寰勫悕
- 榛樿 blocked_paths
- 榛樿 high_risk paths
- 榛樿 allowed_paths 鍥為€€鍒?src/** 鍜?tests/**

涓嶅仛澶嶆潅 AST銆?
涓嶅仛 LLM銆?
涓嶅仛 git history 娣卞害鍒嗘瀽銆?
涓嶅仛 import graph銆?

### V0 涓嶅仛

- Claude Code hooks
- Claude Code adapter
- GitHub Action
- Evidence Package 瀹屾暣 schema
- Risk Scoring 瀹屾暣瑙勫垯
- MCP
- Web UI
- 澶?agent
- 浜戠鏈嶅姟

### V0 楠屾敹鏍囧噯

鍦ㄤ竴涓湡瀹?repo 涓彲浠ュ畬鎴愶細

agentscope init
agentscope start "Fix login redirect bug"
agentscope check

骞跺緱鍒板悎鐞嗙殑 scope check 缁撴灉銆?

---

## V1锛欳laude Code MVP

### 褰撳墠鐘舵€?

V1 鎷嗗垎涓?V1.0鈥揤1.4 瀛愰樁娈碉紝杩涘害濡備笅锛?

- 鉁?**V1.0 宸插畬鎴?* 鈥?agent-agnostic policy engine锛坄ToolEvent` 鈫?`PolicyDecision`锛孭olicyEngine銆丆ommandMatcher锛夈€?
- 鉁?**V1.1 宸插畬鎴?* 鈥?Claude Code PreToolUse payload schema + dry-run hook translator锛坄agentscope hook claude-code pre-tool-use`锛夈€?
- 鉁?**V1.2 宸插畬鎴?* 鈥?Claude Code hook installer銆俙agentscope install claude-code` 鎶?PreToolUse hook 瀹夊叏娉ㄥ叆 Claude Code settings锛屽疄鐜?**live runtime enforcement**锛歊ead / Edit / Write / Bash 鍦ㄨ繍琛屾椂鍙?Task Scope Contract 绾︽潫銆?
  - 榛樿鍐欏叆 `.claude/settings.local.json`锛屼粎 `--shared` 鎵嶅啓鍏?`.claude/settings.json`銆?
  - 鏀寔 Windows / POSIX 缁濆璺緞褰掍竴鍖栦负 repo-relative path锛岃法骞冲彴 glob 鍖归厤涓€鑷淬€?
  - live demo锛歊ead `.env.local` 鈫?**deny**锛汦dit `package.json` 鈫?**ask**锛汦dit `src/auth/login.ts` 鈫?**allow**銆?
- 鉁?**V1.3 宸插畬鎴?* 鈥?Evidence Event Recorder + Evidence Package銆傛瘡娆?live policy decision 杩藉姞鍒?`.agentscope/evidence/latest.json`锛沗agentscope evidence show` / `evidence clear` / `report` 鍙敤锛涗粎璁板綍 governance metadata銆?
- 鉁?**V1.4 宸插畬鎴?* 鈥?Risk Score V1銆俙agentscope risk` / `agentscope risk --json` 浠?Evidence Package 璁＄畻纭畾鎬?0鈥?00 椋庨櫓鍒嗭紙low / medium / high / critical锛夛紝闄?per-factor 鍒嗚В涓?recommendations锛沗agentscope report` 鐜板凡鍖呭惈 risk score銆?
  - 绾嚱鏁?`calculateRiskScore`锛氬悓涓€ evidence 杈撳叆寰楀埌鍚屼竴杈撳嚭锛屼笉璋?LLM銆佷笉鑱旂綉銆佷笉渚濊禆鏃堕棿銆佷笉璇绘枃浠跺唴瀹广€佷笉鏀?hook 琛屼负銆?
  - **涓嶆槸 Policy Gate**锛歳isk / report 閮戒笉璁鹃潪闆?exit code銆佹棤 threshold銆佷笉 fail CI銆侾olicy Gate 灞炰簬鍚庣画 V3銆?

涓嬮潰杩欎竴鑺?V1 鐨勨€滃繀椤诲疄鐜扳€濇槸鍘熷 MVP 瑙勫垝锛岀幇宸插叏閮ㄨ惤鍦帮細Event log / Evidence Package锛圴1.3锛夈€丷isk Scoring锛圴1.4锛夊潎宸插疄鐜般€備粎 GitHub Action / Policy Gate 浠嶅睘浜?V3锛屽皻鏈疄鐜般€?

### 鐩爣

鍋氬嚭绗竴涓彲寮€婧愬彂甯冦€佸彲褰曞埗 demo 鐨勭増鏈€?

V1 鏍稿績浣撻獙锛?

1. AgentScope 鐢熸垚 Task Scope Contract
2. 鐢ㄦ埛纭
3. Claude Code 鍚姩
4. Claude Code 灏濊瘯瓒婄晫鎿嶄綔
5. AgentScope 鎷︽埅
6. 鐢熸垚 evidence.json
7. 杈撳嚭 risk score

### 蹇呴』瀹炵幇

1. Claude Code adapter
2. Claude Code hook 瀹夎
3. PreToolUse 绛栫暐鎷︽埅
4. Read / Edit / Write / Bash 鏀寔
5. Event log
6. Evidence Package V1
7. Risk Scoring V1
8. Markdown report V1

### 鎺ㄨ崘鍛戒护

agentscope install claude-code

浣滅敤锛?

- 妫€娴?`.claude/settings.json`
- 澶囦唤鍘熸湁 settings
- 娉ㄥ叆 AgentScope hooks
- 閰嶇疆 PreToolUse hook
- 鎸囧悜 current-scope.yaml

agentscope start "Fix login redirect bug"

claude

agentscope evidence

agentscope report

agentscope risk

### V1 绛栫暐鍐崇瓥

鏀寔鍐崇瓥锛?

- allow
- deny
- ask
- warn

绛栫暐锛?

Read:
- 鍛戒腑 blocked_paths 鈫?deny
- 鍏朵粬 鈫?allow

Edit / Write:
- 鍛戒腑 blocked_paths 鈫?deny
- 鍛戒腑 high_risk 鈫?ask 鎴?warn
- 涓嶅湪 allowed_paths 鈫?ask 鎴?deny
- 鍦?allowed_paths 鈫?allow

Bash:
- 鍛戒腑 dangerous_commands 鈫?deny
- 鍦?allowed_commands 鈫?allow
- 鏈煡鍛戒护 鈫?ask 鎴?warn

### V1 Dangerous Command Patterns

榛樿鍗遍櫓鍛戒护锛?

- rm -rf *
- curl * | sh
- wget * | sh
- chmod 777 *
- git push --force
- sudo *
- dd if=*
- mkfs*
- kubectl apply *
- terraform apply *

### V1 Evidence Package

V1 evidence 鏂囦欢锛?

.agentscope/evidence/latest.json

鍩虹瀛楁锛?

{
  "version": "0.1",
  "task": {
    "id": "fix-login-redirect",
    "title": "Fix login redirect bug"
  },
  "scope": {
    "scope_hash": "sha256:...",
    "allowed_paths": ["src/auth/**", "tests/auth/**"],
    "blocked_paths": [".env*", "migrations/**", ".github/**"],
    "allowed_commands": ["npm test", "npm run lint"],
    "high_risk": ["package.json", "pnpm-lock.yaml"]
  },
  "events": [],
  "diff": {
    "changed_files": []
  },
  "risk": {
    "score": 0,
    "level": "low",
    "factors": []
  }
}

### V1 Risk Scoring

鍒濈増瑙勫垯锛?

- +40 淇敼 blocked_paths
- +25 淇敼 high_risk paths
- +20 鍙戠敓 denied action
- +20 鎵ц闈?allowed command
- +15 淇敼 allowed_paths 澶栨枃浠?
- -10 鎵€鏈変慨鏀归兘鍦?allowed_paths
- -15 娴嬭瘯鍛戒护鎴愬姛

鍒嗙骇锛?

- 0-24 Low
- 25-49 Medium
- 50-79 High
- 80+ Critical

### V1 涓嶅仛

- 澶?agent
- GitHub Action
- Team Policy Registry
- Scope Auto Inference 娣卞害浼樺寲
- Web dashboard
- MCP 涓撻」鍔熻兘
- 浜戠鏈嶅姟

### V1 楠屾敹鏍囧噯

鑳藉褰曞埗瀹屾暣 demo锛?

agentscope start "Fix login redirect bug"
claude

Claude 灏濊瘯璇诲彇 .env.local锛岃 AgentScope 鎷︽埅銆?

Claude 淇敼 src/auth/login.ts銆?

Claude 鎵ц npm test銆?

agentscope report 杈撳嚭锛?

- task
- scope
- events
- blocked actions
- risk score

---

## V2锛歋cope Auto Inference 娣卞寲鐗?

### 鐩爣

鎶?AgentScope 鐨勬姢鍩庢渤鍋氭繁銆?

V2 瑕佽绯荤粺鏇村噯纭湴鑷姩鎺ㄦ柇鏈浠诲姟鐨勬渶灏忔潈闄愯竟鐣屻€?

### 蹇呴』瀹炵幇

1. Repo Scanner
2. Project Type Detection
3. Task Keyword Matcher
4. Git History Signal
5. Test Mapping
6. Import Graph Signal 鍒濈増
7. Confidence Scoring
8. Rationale 杈撳嚭
9. Scope Diff

### Repo Scanner

璇嗗埆锛?

- src/
- app/
- pages/
- routes/
- components/
- tests/
- __tests__/
- spec/
- e2e/
- migrations/
- infra/
- .github/

璇嗗埆椤圭洰绫诲瀷锛?

- Next.js
- React
- Vue
- Express
- NestJS
- FastAPI
- Django
- Spring Boot
- Monorepo

杈撳嚭 repo profile锛?

{
  "framework": "nextjs",
  "package_manager": "pnpm",
  "source_roots": ["src", "app"],
  "test_roots": ["tests", "__tests__"],
  "high_risk_roots": ["migrations", ".github", "infra"]
}

### Task Keyword Matcher

浠诲姟锛?

Fix login redirect bug

鎻愬彇鍏抽敭璇嶏細

- login
- redirect
- auth
- session
- route

鍖归厤璺緞锛?

- src/auth/**
- src/routes/login/**
- tests/auth/**

鍖归厤鏂囦欢锛?

- login.ts
- auth.ts
- session.ts
- redirect.ts
- login.test.ts

### Git History Signal

浣跨敤 git log 鏌ユ壘锛?

- 鏈€杩戠浉鍏冲彉鏇存枃浠?
- 缁忓父涓€璧蜂慨鏀圭殑鏂囦欢
- 鍘嗗彶 bugfix 娑夊強璺緞

渚嬪锛?

src/auth/login.ts appeared in 7 recent auth-related commits.
tests/auth/login.test.ts often changes with src/auth/login.ts.

### Test Mapping

浠庢簮鏂囦欢鎺ㄦ柇娴嬭瘯鏂囦欢锛?

src/auth/login.ts

鍙兘瀵瑰簲锛?

- tests/auth/login.test.ts
- src/auth/__tests__/login.test.ts
- src/auth/login.spec.ts

杈撳嚭 required tests锛?

required_commands:
  - npm test -- auth

濡傛灉鏃犳硶绮剧‘鎺ㄦ柇锛屽洖閫€锛?

allowed_commands:
  - npm test

### Import Graph Signal

V2 鍏堟敮鎸?TypeScript / JavaScript銆?

杞婚噺瑙ｆ瀽锛?

- import statements
- export statements
- relative imports

鐩殑锛?

- 鎵炬簮鏂囦欢鍜屾祴璇曟枃浠跺叧绯?
- 鎵惧彈褰卞搷妯″潡
- 鎻愰珮 confidence

涓嶈鍦?V2 鍋氬畬鏁磋瑷€鏈嶅姟鍣ㄣ€?

### Confidence Scoring

杈撳嚭锛?

confidence: 0.87

鍒嗙骇锛?

- 0.90+ high
- 0.70-0.89 medium-high
- 0.50-0.69 medium
- <0.50 low锛岄渶瑕佺敤鎴风紪杈?

### Rationale

蹇呴』瑙ｉ噴涓轰粈涔堟帹鏂繖浜涜矾寰勶細

rationale:
  - "Task contains auth-related keywords: login, redirect"
  - "Matched src/auth/login.ts by filename"
  - "Matched tests/auth/login.test.ts by test mapping"
  - "Recent commits for login modified src/auth/session.ts"

### Scope Diff

濡傛灉鐢ㄦ埛缂栬緫 scope锛屾樉绀哄樊寮傦細

You added:
+ src/routes/**

You removed:
- tests/auth/**

Warning:
Removing tests/auth/** may reduce test evidence quality.

### V2 涓嶅仛

- LLM 榛樿鎺ㄦ柇
- 浜戠绱㈠紩
- 澶嶆潅 AST
- 澶?agent
- 浼佷笟 dashboard

鍙互鏀寔鍙€夛細

agentscope start "Fix login redirect bug" --ai-infer

浣嗛粯璁ゅ繀椤绘槸鏈湴鎺ㄦ柇銆?

### V2 楠屾敹鏍囧噯

瀵逛簬甯歌浠诲姟鑳界敓鎴愬悎鐞?scope锛?

- Fix login redirect bug
- Update navbar style
- Add validation to signup form
- Fix payment webhook test
- Update CI node version
- Add database migration for users

---

## V3锛欵vidence + Policy Gate 鎴愮啛鐗?

### 鐩爣

璁?AgentScope 杩涘叆宸ョ▼娴佺▼銆?

V3 鐨勬牳蹇冿細

Evidence Package 鎴愪负鏈哄櫒鍙獙璇佺殑瀹¤浜х墿銆?
Policy Gate 鎴愪负 CI 鐨勫垽鏂緷鎹€?

### 蹇呴』瀹炵幇

1. Evidence schema 绋冲畾鍖?
2. scope_hash
3. diff_hash
4. transcript_hash
5. evidence_hash
6. Test Evidence
7. GitHub Action
8. PR Check Summary
9. Policy Gate Rules
10. SARIF 杈撳嚭鍙€?

### Evidence Schema

鏂囦欢锛?

agentscope-evidence.schema.json

瀛楁锛?

{
  "version": "1.0",
  "task": {},
  "scope": {},
  "agent": {},
  "events": [],
  "diff": {},
  "commands": [],
  "tests": [],
  "blocked_actions": [],
  "risk": {},
  "hashes": {}
}

### Hashes

scope_hash:

璇佹槑 session 浣跨敤鐨勬槸鍝唤 scope銆?

diff_hash:

璇佹槑 evidence 瀵瑰簲鐨勬槸褰撳墠 diff銆?

transcript_hash:

璇佹槑 evidence 瀵瑰簲鏌愪釜鐪熷疄 agent session銆?

evidence_hash:

璇佹槑 evidence 鏈韩鏈绡℃敼銆?

### Test Evidence

璁板綍锛?

{
  "tests": [
    {
      "command": "npm test",
      "exit_code": 0,
      "started_at": "...",
      "ended_at": "...",
      "verified": true
    }
  ]
}

### V3 Current Boundary

V3 is split into narrow CI phases:

- V3.0: local `agentscope gate`
- V3.1: direct GitHub Actions workflow template
- V3.2: repo-local reusable `action.yml`
- V3.3: CI summary output (`agentscope ci-summary`)
- V3.4: release hardening / demo polish (v0.1.0)

Current repo-local action usage:

```yaml
- name: Run AgentScope Gate
  uses: ./
  with:
    package-manager: pnpm
```

The action is a thin wrapper. It runs `agentscope gate --json`, writes `.agentscope/ci/gate-result.json`, exposes `status`, `score`, `level`, and `result-path`, then exits with the gate command's exit code.

The CI integration does not implement Marketplace Action publishing, SARIF, PR comments, GitHub API calls, file content inspection, or command output capture. Those remain planned.

### Policy Gate Rules

閰嶇疆锛?

policy_gate:
  fail_on:
    - critical_risk
    - modified_blocked_path
    - missing_evidence
    - missing_scope_hash

  warn_on:
    - high_risk_path_changed
    - tests_missing
    - blocked_action_occurred

  thresholds:
    max_risk_score: 70

### PR 杈撳嚭

AgentScope Policy Gate

Risk: 37/100 Medium

鉁?Scope Adherence
鉁?No protected files modified
鉁?Tests verified
鈿?package.json changed
鈿?One blocked action occurred

### V3 楠屾敹鏍囧噯

鍦?GitHub PR 涓樉绀?AgentScope check銆?

CI 鑳介獙璇侊細

- evidence.json 鏄惁瀛樺湪
- diff_hash 鏄惁鍖归厤
- scope_hash 鏄惁瀛樺湪
- 鏄惁淇敼 blocked paths
- risk score 鏄惁瓒呰繃闃堝€?

---

## V4锛歍eam Policy Registry

### 鐩爣

璁?AgentScope 浠庝釜浜哄伐鍏峰崌绾т负鍥㈤槦宸ュ叿銆?

V4 瑙ｅ喅锛?

涓嶅悓鍥㈤槦銆佷笉鍚屼换鍔＄被鍨嬮渶瑕佸彲澶嶇敤 policy 妯℃澘銆?

### 蹇呴』瀹炵幇

1. Policy Templates
2. Team Registry
3. Policy Inheritance
4. CODEOWNERS 闆嗘垚
5. Organization Defaults
6. Policy Doctor

### 鍐呯疆妯℃澘

- docs-only
- frontend-bugfix
- backend-bugfix
- fullstack-feature
- dependency-update
- database-migration
- ci-change
- security-fix
- refactor
- test-only

### Team Registry

璺緞锛?

.agentscope/policies/
  frontend-bugfix.yaml
  backend-bugfix.yaml
  migration.yaml
  security-fix.yaml

鍛戒护锛?

agentscope start --template frontend-bugfix "Fix navbar dropdown"

### Policy Inheritance

鏀寔锛?

extends: base

allowed_paths:
  - src/components/**

blocked_paths:
  - migrations/**

base policy锛?

base:
  blocked_paths:
    - .env*
    - secrets/**
  dangerous_commands:
    - rm -rf *
    - curl * | sh

### CODEOWNERS 闆嗘垚

濡傛灉淇敼楂樻晱璺緞锛?

- payments/**
- infra/**
- security/**
- .github/**

鍒欙細

- 澧炲姞 risk score
- 瑕佹眰 owner review
- 鎴栬繘鍏?warn / fail

### Organization Defaults

鏀寔锛?

.agentscope/org-policy.yaml

绀轰緥锛?

global_blocked_paths:
  - .env*
  - prod/**
  - customer-data/**

global_dangerous_commands:
  - git push --force
  - kubectl apply *
  - terraform apply *

### Policy Doctor

鍛戒护锛?

agentscope policy doctor

妫€鏌ワ細

- policy 鏄惁鍐茬獊
- allowed_paths 鏄惁瑕嗙洊 blocked_paths
- required_commands 鏄惁瀛樺湪
- 妯℃澘鏄惁寮曠敤涓嶅瓨鍦ㄨ矾寰?
- risk rules 鏄惁閲嶅
- policy inheritance 鏄惁寰幆

### V4 楠屾敹鏍囧噯

鍥㈤槦鍙互缁存姢 `.agentscope/policies/`銆?

寮€鍙戣€呭彲浠ヨ繍琛岋細

agentscope start --template backend-bugfix "Fix webhook retry"

CI 浣跨敤鍚屼竴濂?policy gate銆?

---

## V5锛歁ulti-Agent Governance

### 鐩爣

浠?Claude Code 涓撳睘鍗囩骇涓哄 agent 缁熶竴娌荤悊灞傘€?

AgentScope 闀挎湡瀹氫綅涓嶆槸 Claude Code Extension锛岃€屾槸锛?

Open Policy + Evidence Layer for AI Coding Agents

### 蹇呴』瀹炵幇

1. Agent Adapter Interface
2. Unified Tool Event Model
3. Adapter Capability Matrix
4. Evidence Import
5. 澶?agent check
6. MCP 浣滀负 tool source 澶勭悊

### Agent Adapter Interface

interface AgentAdapter {
  name: string
  install(): Promise<void>
  enforce(scope: ScopeContract): Promise<void>
  collectEvidence(): Promise<EvidencePackage>
  uninstall(): Promise<void>
}

鏀寔鏂瑰悜锛?

- claude-code
- codex
- cursor
- gemini-cli
- custom

### Unified Tool Event Model

缁熶竴浜嬩欢锛?

{
  "agent": "claude-code",
  "event_type": "tool_call",
  "tool_source": "builtin",
  "tool_name": "Edit",
  "action": "write",
  "target": "src/auth/login.ts",
  "decision": "allow",
  "timestamp": "..."
}

MCP 宸ュ叿锛?

{
  "tool_source": "mcp",
  "tool_name": "github.create_pr"
}

MCP 涓嶄綔涓轰骇鍝佹牳蹇冿紝鍙綔涓?tool source銆?

### Adapter Capability Matrix

涓嶅悓 agent 鏀寔绋嬪害涓嶅悓锛?

Claude Code:
- enforcement: full
- evidence: full
- transcript: full

Cursor:
- enforcement: partial
- evidence: partial
- transcript: unavailable

Codex:
- enforcement: partial
- evidence: partial

Custom:
- enforcement: none
- evidence: import-only

AgentScope 瑕佽瘹瀹炴樉绀鸿兘鍔涚煩闃点€?

### Evidence Import

鍏佽瀵煎叆鍏朵粬 agent 鏃ュ織锛?

agentscope import --agent custom ./agent-log.json

鐒跺悗浠嶇劧鍙互锛?

agentscope check
agentscope risk

### V5 楠屾敹鏍囧噯

AgentScope Core 涓?Claude Code 瑙ｈ€︺€?

Claude Code 浠嶆槸鏈€浣虫敮鎸侊紝浣嗘牳蹇冩娊璞″凡缁忔敮鎸佸 agent銆?

---

## V6锛欵nterprise Governance

### 鐩爣

璁?AgentScope 鍏峰浼佷笟绾ф不鐞嗚兘鍔涖€?

V6 涓嶆槸鏃╂湡鐩爣锛屼絾鏋舵瀯瑕侀鐣欐墿灞曠┖闂淬€?

### 鍙兘鍔熻兘

1. Central Policy Server
2. Signed Evidence Package
3. OPA / Rego 闆嗘垚
4. SIEM / Audit Log 闆嗘垚
5. Dashboard
6. Organization Risk Analytics

### Central Policy Server

鍛戒护锛?

agentscope server

鍔熻兘锛?

- policy 鍒嗗彂
- evidence 鏀堕泦
- risk dashboard
- team audit
- session 鏌ヨ

### Signed Evidence Package

瀵?evidence 绛惧悕锛?

- scope_hash
- diff_hash
- transcript_hash
- evidence_hash
- signature

鐩爣锛?

闃叉浜嬪悗绡℃敼 evidence銆?

### OPA / Rego 闆嗘垚

鏀寔浼佷笟绛栫暐锛?

deny[msg] {
  input.diff.modified_paths[_] == ".github/workflows/deploy.yml"
  not input.task.template == "ci-change"
  msg := "CI workflow modified outside ci-change task"
}

### SIEM / Audit Log 闆嗘垚

杈撳嚭鍒帮細

- Datadog
- Splunk
- OpenTelemetry
- CloudWatch
- Elastic

### Dashboard

灞曠ず锛?

- AI sessions 鏁伴噺
- blocked actions 鏁伴噺
- high risk PRs
- risk trends
- repo risk ranking
- agent risk comparison
- policy violations

### Organization Risk Analytics

绀轰緥锛?

杩囧幓 30 澶╋細

- Claude Code sessions: 420
- High risk PRs: 19
- Blocked .env access: 37
- Missing tests: 82
- Most common violation: package.json changed outside dependency-update

## 瀹為檯寮€鍙戦『搴忓缓璁?

### 绗?1 鍛?

瀹屾垚 V0锛?

- CLI
- config
- task scope contract
- basic repo scanner
- basic diff check

### 绗?2-3 鍛?

瀹屾垚 V1锛?

- Claude Code adapter
- PreToolUse hook
- Read/Edit/Write/Bash policy
- event log
- evidence.json
- risk score
- markdown report

### 绗?4-5 鍛?

瀹屾垚 V2锛?

- repo profile
- task keyword matching
- test mapping
- git history signal
- confidence score
- rationale

### 绗?6 鍛?

瀹屾垚 V3锛?

- evidence schema
- diff_hash
- scope_hash
- GitHub Action
- PR comment
- risk threshold

### 绗?7-8 鍛?

瀹屾垚 V4锛?

- policy templates
- policy inheritance
- team registry
- policy doctor

## 鍔熻兘浼樺厛绾?

鏈€楂樹紭鍏堢骇锛?

1. agentscope start
2. Task Scope Contract
3. Scope Auto Inference 鍒濈増
4. Human Approval
5. Claude Code Adapter
6. Runtime Policy Enforcement
7. Evidence Package
8. Risk Scoring
9. Policy Gate
10. Team Policy Registry

## 鏃╂湡涓嶈鍋?

涓嶈鍦?V0-V2 鍋氾細

- Web dashboard
- 澶?agent 瀹屾暣鏀寔
- MCP 涓撻」绠＄悊
- LLM-as-judge
- 浜戠 policy server
- 澶嶆潅瀹夊叏鎵弿
- 澶嶆潅 AST 鍒嗘瀽
- IDE 鎻掍欢
- 浼佷笟 SSO
- 鍙鍖?session replay
