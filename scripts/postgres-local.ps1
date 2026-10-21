param([ValidateSet('start', 'stop', 'status')][string]$Action = 'status')
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskData = [IO.Path]::GetFullPath((Join-Path $taskRoot '.tmp/postgres-local/data'))
if (-not $taskData.StartsWith($taskRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Directorio fuera del proyecto' }
if (-not (Test-Path -LiteralPath (Join-Path $taskData 'PG_VERSION'))) { throw 'La instancia local todavía no está inicializada' }
$taskPgCtl = Join-Path $env:ProgramFiles 'PostgreSQL/18/bin/pg_ctl.exe'
switch ($Action) {
  'start' {
    & $taskPgCtl -D $taskData status *> $null
    if ($LASTEXITCODE -eq 0) { Write-Output 'PostgreSQL local ya está iniciado en 127.0.0.1:55432'; exit 0 }
    & $taskPgCtl -D $taskData -l (Join-Path $taskRoot '.tmp/postgres-local/postgres.log') -w -t 30 start
  }
  'stop' { & $taskPgCtl -D $taskData -m fast -w -t 30 stop }
  'status' { & $taskPgCtl -D $taskData status }
}
exit $LASTEXITCODE
