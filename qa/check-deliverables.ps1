$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$requiredFiles = @(
  'README.md',
  '.github/workflows/qa-pipeline.yml',
  'sonar-project.properties',
  'backend/package.json',
  'backend/jest.config.js',
  'backend/jest.database.config.js',
  'backend/tests/app.integration.test.js',
  'backend/tests/database/financeApi.integration.test.js',
  'backend/tests/unit/accountController.test.js',
  'backend/tests/unit/authController.test.js',
  'backend/tests/unit/authMiddleware.test.js',
  'backend/tests/unit/budgetController.test.js',
  'backend/tests/unit/dashboardController.test.js',
  'backend/tests/unit/goalController.test.js',
  'backend/tests/unit/reportController.test.js',
  'backend/tests/unit/transactionController.test.js',
  'backend/tests/unit/transactionLifecycleController.test.js',
  'backend/features/finance.feature',
  'backend/features/step_definitions/finance.steps.js',
  'frontend/package.json',
  'qa/test-plan.md',
  'qa/check-deliverables.ps1',
  'qa/Finora-manual-results.csv',
  'qa/manual-test-cases.csv',
  'qa/requirements-traceability.md',
  'qa/black-box-design.md',
  'qa/white-box-analysis.md',
  'qa/security-test-matrix.md',
  'qa/defect-log.md',
  'qa/QA_EXECUTION_SUMMARY.md',
  'qa/postman/Finora API Smoke Tests.postman_collection.json',
  'qa/postman/README.md',
  'qa/selenium/package.json',
  'qa/selenium/smoke-test.cjs',
  'qa/selenium/README.md',
  'qa/jmeter/Finora API Load Test.jmx',
  'qa/jmeter/Finora Sustained API Benchmark.jmx',
  'qa/jmeter/README.md',
  'qa/performance/load-smoke.cjs',
  'qa/performance/README.md',
  'qa/sonarqube.md'
)

$missing = @($requiredFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $repoRoot $_) -PathType Leaf) })
$empty = @($requiredFiles | Where-Object {
  $path = Join-Path $repoRoot $_
  (Test-Path -LiteralPath $path -PathType Leaf) -and (Get-Item -LiteralPath $path).Length -eq 0
})
$casePath = Join-Path $repoRoot 'qa/manual-test-cases.csv'
$cases = @(Import-Csv -LiteralPath $casePath)
$caseCount = $cases.Count
$resultsPath = Join-Path $repoRoot 'qa/Finora-manual-results.csv'
$results = @(Import-Csv -LiteralPath $resultsPath)
$collectionPath = Join-Path $repoRoot 'qa/postman/Finora API Smoke Tests.postman_collection.json'
$collection = Get-Content -LiteralPath $collectionPath -Raw | ConvertFrom-Json
$jmxPath = Join-Path $repoRoot 'qa/jmeter/Finora API Load Test.jmx'
[xml]$jmx = Get-Content -LiteralPath $jmxPath -Raw
$sustainedJmxPath = Join-Path $repoRoot 'qa/jmeter/Finora Sustained API Benchmark.jmx'
[xml]$sustainedJmx = Get-Content -LiteralPath $sustainedJmxPath -Raw

$problems = @()
if ($missing.Count) { $problems += "Missing files: $($missing -join ', ')" }
if ($empty.Count) { $problems += "Empty files: $($empty -join ', ')" }
if ($caseCount -ne 60) { $problems += "Expected 60 manual cases; found $caseCount" }
if ($results.Count -ne 60) { $problems += "Expected 60 recorded manual results; found $($results.Count)" }
$scenarioById = @{}
foreach ($case in $cases) { $scenarioById[$case.ID] = $case.Scenario }
$scenarioMismatches = @($results | Where-Object { $scenarioById[$_.ID] -ne $_.Scenario })
if ($scenarioMismatches.Count) { $problems += "Manual result scenario mismatches: $($scenarioMismatches.Count)" }
if (@($collection.item).Count -ne 8) { $problems += "Expected 8 Postman requests; found $(@($collection.item).Count)" }
if (-not $jmx.DocumentElement) { $problems += 'JMeter plan XML has no document root' }
if (-not $sustainedJmx.DocumentElement) { $problems += 'Sustained JMeter plan XML has no document root' }

if ($problems.Count) {
  Write-Host 'FAIL: QA deliverable check'
  $problems | ForEach-Object { Write-Host "- $_" }
  exit 1
}

Write-Host "PASS: $($requiredFiles.Count) required files exist and are non-empty."
Write-Host "PASS: $caseCount test designs and $($results.Count) result rows match by ID/scenario; $(@($collection.item).Count) Postman requests; collection JSON and both JMeter plans parse."
Write-Host 'Note: presence/format checks do not mean manual cases or external scans have been executed.'
