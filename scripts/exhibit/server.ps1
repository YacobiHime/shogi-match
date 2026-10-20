# 展示用のローカルサーバー(Windows PowerShell 5.1以上)。docs/exhibit-design.md
# app フォルダーを http://127.0.0.1:<port>/ で配信し、Chrome を開く。
# 将棋エンジン(WASM)のために、COOP/COEP のヘッダーを付ける(ファイルを直接開くと、エンジンは動かない)。
# インターネットにはつながない。ほかのPCからは見えない(127.0.0.1だけで待つ)。
param(
  [int]$Port = 8765,
  [switch]$Kiosk,
  [switch]$NoBrowser
)
$ErrorActionPreference = 'Stop'
$sep = [System.IO.Path]::DirectorySeparatorChar
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'app'))
if (-not (Test-Path (Join-Path $root 'game.html'))) {
  Write-Host "app フォルダーが見つかりません: $root"
  exit 1
}

$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'; '.txt' = 'text/plain; charset=utf-8'
  '.wasm' = 'application/wasm'; '.data' = 'application/octet-stream'
  '.webp' = 'image/webp'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'
  '.mp3' = 'audio/mpeg'; '.ogg' = 'audio/ogg'; '.wav' = 'audio/wav'; '.woff2' = 'font/woff2'
}

# 空いているポートで待つ(同じポートを使うと、記録が同じ場所に残る)。
$listener = $null
for ($candidate = $Port; $candidate -lt $Port + 20; $candidate++) {
  try {
    $attempt = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback), $candidate
    $attempt.Start()
    $listener = $attempt
    $Port = $candidate
    break
  } catch {
    $listener = $null
  }
}
if (-not $listener) {
  Write-Host 'ポートを開けませんでした。ほかのソフトを閉じてから、もう一度試してください。'
  exit 1
}
$url = "http://127.0.0.1:$Port/game.html?exhibit=1"

function Send-Response($stream, [int]$status, [string]$reason, [byte[]]$body, [string]$type, [bool]$headOnly) {
  $header = "HTTP/1.1 $status $reason`r`n" +
    "Content-Type: $type`r`n" +
    "Content-Length: $($body.Length)`r`n" +
    "Cross-Origin-Opener-Policy: same-origin`r`n" +
    "Cross-Origin-Embedder-Policy: require-corp`r`n" +
    "Cross-Origin-Resource-Policy: same-origin`r`n" +
    "Cache-Control: no-cache`r`n" +
    "Connection: close`r`n`r`n"
  $bytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($bytes, 0, $bytes.Length)
  if (-not $headOnly -and $body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
}

function Read-RequestLine($stream) {
  $buffer = New-Object byte[] 16384
  $total = 0
  while ($total -lt $buffer.Length) {
    $count = $stream.Read($buffer, $total, $buffer.Length - $total)
    if ($count -le 0) { break }
    $total += $count
    $text = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $total)
    if ($text.Contains("`r`n`r`n")) { return $text.Split("`r`n")[0] }
  }
  if ($total -eq 0) { return $null }
  return [System.Text.Encoding]::ASCII.GetString($buffer, 0, $total).Split("`r`n")[0]
}

function Resolve-AppFile([string]$target) {
  $path = $target.Split('?')[0].Split('#')[0]
  $path = [System.Uri]::UnescapeDataString($path)
  if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }
  $relative = $path.TrimStart('/').Replace('/', [string]$sep)
  $full = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
  # app フォルダーの外は配信しない。
  if (-not $full.StartsWith($root + $sep, [System.StringComparison]::OrdinalIgnoreCase)) { return $null }
  if (Test-Path -LiteralPath $full -PathType Container) { $full = Join-Path $full 'index.html' }
  if (Test-Path -LiteralPath $full -PathType Leaf) { return $full }
  return $null
}

function Handle-Client($client) {
  try {
    $client.ReceiveTimeout = 5000
    $client.SendTimeout = 10000
    $stream = $client.GetStream()
    $line = Read-RequestLine $stream
    if (-not $line) { return }
    $parts = $line.Split(' ')
    $method = $parts[0]
    if ($parts.Length -lt 2 -or ($method -ne 'GET' -and $method -ne 'HEAD')) {
      Send-Response $stream 405 'Method Not Allowed' ([System.Text.Encoding]::UTF8.GetBytes('405')) 'text/plain; charset=utf-8' $false
      return
    }
    $file = Resolve-AppFile $parts[1]
    if (-not $file) {
      Send-Response $stream 404 'Not Found' ([System.Text.Encoding]::UTF8.GetBytes('404')) 'text/plain; charset=utf-8' ($method -eq 'HEAD')
      return
    }
    $extension = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
    $type = $types[$extension]
    if (-not $type) { $type = 'application/octet-stream' }
    Send-Response $stream 200 'OK' ([System.IO.File]::ReadAllBytes($file)) $type ($method -eq 'HEAD')
  } catch {
    # 途中で切れた接続は捨てる(展示を止めない)。
  } finally {
    $client.Close()
  }
}

function Find-Chrome {
  $candidates = @()
  foreach ($hive in @('HKCU:', 'HKLM:')) {
    try {
      $key = "$hive\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"
      if (Test-Path $key) {
        $value = (Get-ItemProperty $key).'(default)'
        if ($value) { $candidates += $value }
      }
    } catch { }
  }
  foreach ($base in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA)) {
    if ($base) { $candidates += (Join-Path $base 'Google\Chrome\Application\chrome.exe') }
  }
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
  }
  return $null
}

# 展示用のChromeの記録の置き場所。ふだん使うChromeとは別にする(記録が混ざらず、キオスク表示で開ける)。
$profileBase = $env:LOCALAPPDATA
if (-not $profileBase) { $profileBase = $PSScriptRoot }
$profileDir = Join-Path $profileBase 'shogi-match-exhibit'
$browserStarted = $false
if (-not $NoBrowser) {
  $chrome = Find-Chrome
  $flags = @("--user-data-dir=`"$profileDir`"", '--no-first-run', '--no-default-browser-check', '--disable-features=Translate', '--autoplay-policy=no-user-gesture-required')
  if ($Kiosk) { $flags += @('--kiosk', $url) } else { $flags += @('--start-maximized', "--app=$url") }
  if ($chrome) {
    Start-Process -FilePath $chrome -ArgumentList $flags | Out-Null
    $browserStarted = $true
  } else {
    Write-Host 'Chrome が見つかりませんでした。ふだんのブラウザで開きます。'
    Start-Process $url | Out-Null
  }
}

Write-Host ''
Write-Host "  将棋の展示を配信しています: $url"
Write-Host '  この黒い画面は閉じないでください。'
if ($Kiosk) { Write-Host '  キオスク表示は Alt + F4 で閉じられます。' }
Write-Host '  展示を終えるときは、Chrome を閉じてから、この画面を閉じます。'
Write-Host ''

# 展示用のChromeが閉じたら、サーバーも止める(見つけられないときは、この画面を閉じるまで動き続ける)。
function Test-ExhibitChrome {
  try {
    $found = Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" -ErrorAction Stop |
      Where-Object { $_.CommandLine -and $_.CommandLine.Contains('shogi-match-exhibit') }
    return [bool]$found
  } catch {
    return $true
  }
}

$lastCheck = [DateTime]::UtcNow
$graceUntil = [DateTime]::UtcNow.AddSeconds(30)
try {
  while ($true) {
    if ($listener.Pending()) {
      Handle-Client ($listener.AcceptTcpClient())
      continue
    }
    Start-Sleep -Milliseconds 15
    $now = [DateTime]::UtcNow
    if ($browserStarted -and $now -gt $graceUntil -and ($now - $lastCheck).TotalSeconds -ge 5) {
      $lastCheck = $now
      if (-not (Test-ExhibitChrome)) { break }
    }
  }
} finally {
  $listener.Stop()
}
