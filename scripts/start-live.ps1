param(
    [int]$ApiPort = 8097
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot '.env.live'
if (-not (Test-Path -LiteralPath $envPath)) {
    throw '.env.live 파일이 없습니다. docs/local-live-data.md를 확인해 주세요.'
}

$settings = @{}
foreach ($line in Get-Content -LiteralPath $envPath) {
    if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $settings[$matches[1]] = $matches[2]
    }
}
if ($settings.DB_NAME -ne 'devjob_live' -or $settings.DB_PORT -ne '55450' -or
    $settings.DB_HOST -ne '127.0.0.1') {
    throw '고정 DB 설정이 예상한 devjob_live/127.0.0.1:55450과 다릅니다.'
}

Push-Location $repoRoot
try {
    docker compose -p devjob-live --env-file .env.live up -d postgres
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL 기동에 실패했습니다.' }
    $jar = Join-Path $repoRoot 'backend\build\libs\devjob-backend-0.0.1-SNAPSHOT.jar'
    if (-not (Test-Path -LiteralPath $jar)) {
        throw 'Backend JAR이 없습니다. backend에서 gradlew.bat bootJar를 먼저 실행해 주세요.'
    }
    foreach ($key in $settings.Keys) {
        [Environment]::SetEnvironmentVariable($key, $settings[$key], 'Process')
    }
    $env:SERVER_PORT = [string]$ApiPort
    $java = Join-Path $env:JAVA_HOME 'bin\java.exe'
    if (-not (Test-Path -LiteralPath $java)) { $java = 'java.exe' }
    $process = Start-Process -FilePath $java -ArgumentList @('-jar', $jar) `
        -WorkingDirectory (Join-Path $repoRoot 'backend') `
        -RedirectStandardOutput (Join-Path $repoRoot 'backend-live.log') `
        -RedirectStandardError (Join-Path $repoRoot 'backend-live-error.log') `
        -WindowStyle Hidden -PassThru
    Write-Output "DevJob API started on port $ApiPort (PID $($process.Id)); DB=devjob_live:55450"
} finally {
    Pop-Location
}
