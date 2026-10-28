$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command py -ErrorAction SilentlyContinue }
if (-not $python) {
  Write-Host 'Python not found. You can double-click start.bat, or run: node tests/serve.js' -ForegroundColor Yellow
  Read-Host 'Press Enter to exit'
  exit 1
}

$port = 8899
$found = $false
for ($p = 8899; $p -le 8999; $p++) {
  $listener = $null
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $p)
    $listener.Start()
    $listener.Stop()
    $port = $p
    $found = $true
    break
  } catch {
    if ($listener) { try { $listener.Stop() } catch { } }
  }
}

if (-not $found) {
  Write-Host 'No free port. Double-click start.bat instead.' -ForegroundColor Yellow
  Read-Host 'Press Enter to exit'
  exit 1
}

$job = Start-Job -ScriptBlock {
  param($dir, $p, $py)
  Set-Location -LiteralPath $dir
  & $py -m http.server $p --bind 127.0.0.1
} -ArgumentList $PSScriptRoot, $port, $python.Source

Start-Sleep -Milliseconds 1000
$url = "http://127.0.0.1:$port/"
Start-Process $url

Write-Host ''
Write-Host '  Leek Finance RPG is running' -ForegroundColor Green
Write-Host "  $url" -ForegroundColor Cyan
Write-Host ''
Write-Host '  Online: /online.html  (configure Supabase first)' -ForegroundColor DarkGray
Write-Host '  Keep this window open. Press Ctrl+C to stop.' -ForegroundColor DarkGray
Write-Host ''

try {
  Wait-Job $job | Out-Null
} finally {
  Stop-Job $job -ErrorAction SilentlyContinue
  Remove-Job $job -Force -ErrorAction SilentlyContinue
}
