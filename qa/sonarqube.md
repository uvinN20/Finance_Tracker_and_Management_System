# SonarQube analysis setup

The repository contains `sonar-project.properties` with backend/frontend source folders, Jest test paths, exclusions, and the Jest LCOV report path. The GitHub Actions workflow includes an optional SonarQube Cloud scan. It stays skipped until the repository variable `SONAR_ENABLED` is set to `true`.

## Enable SonarQube Cloud

1. Sign in to SonarQube Cloud with the GitHub account that owns the Finora fork, create/connect the organization, and import this repository.
2. Make sure the Sonar project key matches `sonar.projectKey` in the root properties file. Copy the Sonar organization key.
3. In GitHub repository **Settings → Secrets and variables → Actions**, add:
   - Secret `SONAR_TOKEN`: a project analysis token generated in SonarQube Cloud.
   - Variable `SONAR_ENABLED`: `true`.
   - Variable `SONAR_HOST_URL`: `https://sonarcloud.io` (or the host URL shown for your SonarQube Cloud region).
   - Variable `SONAR_ORGANIZATION`: the organization key from SonarQube Cloud.
4. Push the QA branch or open a pull request to `main`. The scan runs after the workflow's test/build steps generate the coverage report. Read the result in the SonarQube Cloud project and the GitHub Actions run.

Never commit or share the token. SonarQube Cloud requires the matching project key and organization and an analysis token with access to the project; see [SonarQube Cloud GitHub setup](https://docs.sonarsource.com/sonarqube-cloud/getting-started/github) and its [GitHub Actions integration](https://docs.sonarsource.com/sonarqube-server/2025.6/devops-platform-integration/github-integration/adding-analysis-to-github-actions-workflow).

## Local scan alternative

1. Run `npm run test:coverage` from `backend` to create `backend/coverage/lcov.info`.
2. Install SonarScanner CLI and have a reachable SonarQube server or SonarQube Cloud project.
3. Set `SONAR_TOKEN` and `SONAR_HOST_URL` in the local shell. For SonarQube Cloud, also supply the organization key.
4. From the repository root run `sonar-scanner` (and add `-Dsonar.organization=...` for SonarQube Cloud).
5. Save the server's analysis result and quality-gate metrics as evidence.

No scan result is claimed yet: this environment has no SonarQube account/token or reachable SonarQube server. The workflow and settings above are prepared for when those credentials are configured.
