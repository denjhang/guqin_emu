$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win {
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
    [DllImport("user32.dll")] public static extern IntPtr SetForegroundWindow(IntPtr h);
    public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
Write-Host ("screen: {0}x{1}" -f $screen.Width, $screen.Height)

$procs = Get-Process | Where-Object { $_.ProcessName -match 'qemu|emulator' }
if (-not $procs) { Write-Host 'no qemu/emulator process found'; exit 1 }

foreach ($p in $procs) {
    $h = $p.MainWindowHandle
    Write-Host ("pid={0} name={1} title='{2}' handle={3}" -f $p.Id, $p.ProcessName, $p.MainWindowTitle, $h)
    if ($h -eq 0) { Write-Host '  (no main window handle, skipping)'; continue }
    $r = New-Object Win+RECT
    [void][Win]::GetWindowRect($h, [ref]$r)
    $w = $r.Right - $r.Left
    $ht = $r.Bottom - $r.Top
    Write-Host ("  rect: L={0} T={1} R={2} B={3} size={4}x{5}" -f $r.Left, $r.Top, $r.Right, $r.Bottom, $w, $ht)
    $x = [int](($screen.Width - $w) / 2)
    $y = [int](($screen.Height - $ht) / 2)
    if ($x -lt 0) { $x = 0 }
    if ($y -lt 0) { $y = 0 }
    Write-Host ("  target: x={0} y={1}" -f $x, $y)
    [void][Win]::SetWindowPos($h, [IntPtr]::Zero, $x, $y, $w, $ht, 0x0004 -bor 0x0040 -bor 0x0020)
    [void][Win]::ShowWindow($h, 9)
    [void][Win]::SetForegroundWindow($h)
    Write-Host '  centered'
}
