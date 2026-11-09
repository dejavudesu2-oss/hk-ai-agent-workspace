# Continuous Integration & Infrastructure Test Plan (T22)

## 1. Overview of GitHub Actions CI Pipeline

The pipeline is defined in [`.github/workflows/ci.yml`](file:///C:/Users/rain2/.gemini/antigravity/scratch/hk-ai-agent-workspace/.github/workflows/ci.yml) and runs on all pushes and pull requests to `master` and `main`. It contains two separate jobs:

### Job 1: `build-and-test`
- **Environment**: `ubuntu-latest` with Node.js 20.
- **Tasks**:
  1. `npm ci || npm install`: installs all root and workspace dependencies.
  2. `npm test`: executes all automated unit and integration tests (path normalization, streaming parser, VFS, cost guard, failover, preview security).
  3. `npm run test:chat`: runs cross-platform Node fetch SSE stream verification.
  4. `npm run build`: builds the Next.js production bundle with dynamic API routes.
- **Verification Status**: Tested and passing locally.

---

### Job 2: `infra-smoke-test`
> **STATUS**: `[UNTESTED-locally]`
> **Reason**: The local development machine runs Windows without a native Linux kernel, preventing direct execution of the gVisor `runsc` binary. This job is intended to run on GitHub's native Ubuntu 22.04/24.04 runners.

- **Tasks**:
  1. Installs gVisor `runsc` via the official Google Cloud gVisor APT repository.
  2. Configures the Docker daemon with `sudo runsc install` and restarts the Docker service.
  3. Tests container execution with strict cgroup resource constraints:
     - `--runtime=runsc`
     - `--memory=256m`
     - `--cpus=0.5`
     - `--pids-limit=64`
  4. Verifies network egress controls:
     - Confirms package registries (`registry.npmjs.org`) are reachable.
     - Confirms cloud metadata endpoint (`169.254.169.254`) is unreachable/blocked.
  5. Verifies container timeout enforcement:
     - Starts an intentionally long-running container (`sleep 10`) under a 3-second watchdog deadline (`timeout 3s`), verifying clean process termination.

---

## 2. Exact Steps to Run on GitHub

To trigger and verify this workflow on GitHub:

### Step 1: Ensure Git Commits are Clean
```bash
git status
```

### Step 2: Create a Private GitHub Repository
Using GitHub CLI:
```bash
gh repo create hk-ai-agent --private --source=. --remote=origin
```
*(Or create a new private repo via github.com and add the remote:)*
```bash
git remote add origin git@github.com:<your-org>/hk-ai-agent.git
```

### Step 3: Push Master Branch to Remote
```bash
git branch -M master
git push -u origin master
```

### Step 4: Monitor Workflow Runs
1. Open the repository on GitHub in your browser:
   `https://github.com/<your-org>/hk-ai-agent/actions`
2. You will see the latest commit trigger the **CI / CD Pipeline** workflow.
3. Verify both jobs complete successfully:
   - `Build & Test (ubuntu-latest)` -> Green checkmark (approx 45s)
   - `Infra Smoke Test (Docker + runsc) [UNTESTED-locally]` -> Green checkmark (approx 60s)

### Step 5: Manual Dispatch (Optional)
If you want to trigger the workflow manually:
```bash
gh workflow run ci.yml
gh run watch
```
