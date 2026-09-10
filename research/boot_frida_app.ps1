$ErrorActionPreference = 'Continue'
$env:PATH = "D:\android-sdk\platform-tools;$env:PATH"

Write-Host "waiting for boot_completed (up to ~250s)..."
$booted = $false
for ($i = 1; $i -le 50; $i++) {
    $b = (adb shell getprop sys.boot_completed 2>$null) -replace '[\r\n]', ''
    if ($b -eq '1') { Write-Host "BOOTED after ${i}x5s"; $booted = $true; break }
    Start-Sleep -Seconds 5
}
if (-not $booted) { Write-Host 'boot NOT completed, aborting'; exit 1 }

Write-Host 'adb root...'
adb root 2>&1 | Out-Null
Start-Sleep -Seconds 3

Write-Host 'starting frida-server...'
adb shell "chmod 755 /data/local/tmp/frida-server 2>/dev/null; nohup /data/local/tmp/frida-server -D >/dev/null 2>&1 &" 2>&1 | Out-Null
Start-Sleep -Seconds 3

Write-Host 'process check (frida|guqin):'
adb shell "ps -A | grep -E 'frida|guqin'"

Write-Host 'launching App (cn.guqindashi.app)...'
adb shell monkey -p cn.guqindashi.app -c android.intent.category.LAUNCHER 1 2>&1 | Out-Null
Start-Sleep -Seconds 8

Write-Host 'screenshot to confirm UI state...'
adb shell screencap -p /sdcard/s.png 2>&1 | Out-Null
$out = "C:\Users\Administrator\AppData\Local\Temp\app_boot.png"
adb pull /sdcard/s.png $out 2>&1 | Select-Object -Last 1
Write-Host "saved: $out"
