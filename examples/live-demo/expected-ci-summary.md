# AgentScope CI Summary

Task: Fix login redirect bug (fix-login-redirect-bug)
Scope Hash: sha256:be8af5fd67cb37b04c93ff0969d39a76b335b594719a64a482178ac0d5132165

Risk Score: 55 / 100
Risk Level: high

Denied Actions:
- Read .env.local [blocked_paths:.env*]

Asked Actions:
- Write package.json [high_risk:package.json]

High-Risk Actions:
- Write package.json [high_risk:package.json]

Top Risk Factors:
- high_risk_approval_required (+25)
- blocked_path_denied (+20)
- mixed_blocked_and_high_risk (+10)

Recommendations:
- Review why the agent attempted to access blocked paths.
- Manually review high-risk file changes before merging.
Evidence Path: <project>/.agentscope/evidence/latest.json
