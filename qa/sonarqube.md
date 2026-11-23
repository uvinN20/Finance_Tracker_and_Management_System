# SonarQube Cloud analysis

The repository is connected to SonarQube Cloud. The GitHub Actions workflow runs the scan when the repository variable SONAR_ENABLED is set to true; sonar-project.properties identifies the project and the generated Jest LCOV report.

## Latest recorded scan

- Branch: qa/initial-setup
- GitHub Actions run: [45240678768](https://github.com/uvinN20/Finance_Tracker_and_Management_System/actions/runs/45240678768)
- SonarQube Cloud project: [Finora](https://sonarcloud.io/dashboard?id=uvinN20_Finance_Tracker_and_Management_System&branch=qa%2Finitial-setup)
- Analysis step: succeeded
- Quality Gate: passed
- New-code coverage: 93.6% (required minimum 80%)
- Bugs: 0
- Vulnerabilities: 0
- Code smells: 0

Coverage exclusions apply to automated tests and QA harness tools, which are not production code. Application source remains in the coverage scope.

## Repository configuration

The workflow uses these GitHub Actions settings:

- Secret SONAR_TOKEN: analysis token; do not commit or share it.
- Variable SONAR_ENABLED: true.
- Variable SONAR_HOST_URL: https://sonarcloud.io.
- Variable SONAR_ORGANIZATION: the SonarQube Cloud organization key.

The project key in sonar-project.properties must match the imported SonarQube Cloud project. The workflow runs after tests/build generate coverage data. Scan results appear in the project dashboard and GitHub Actions run.

## Local scan alternative

1. Run npm run test:coverage from backend to create backend/coverage/lcov.info.
2. Install SonarScanner CLI and set SONAR_TOKEN and SONAR_HOST_URL in the local shell. For SonarQube Cloud, also provide the organization key.
3. From the repository root run sonar-scanner.
4. Review the analysis in SonarQube Cloud and record the Quality Gate and metrics for the branch scanned.

See [SonarQube Cloud's GitHub setup guide](https://docs.sonarsource.com/sonarqube-cloud/getting-started/github) and [GitHub Actions integration](https://docs.sonarsource.com/sonarqube-server/2025.6/devops-platform-integration/github-integration/adding-analysis-to-github-actions-workflow).
