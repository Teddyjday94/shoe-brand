# Waits for a training run to exit, exports it, then fine-tunes on the full data set.
#   powershell -File ml/chain.ps1 -WaitPid 22784
param([int]$WaitPid, [string]$From = "foot", [string]$To = "foot2", [int]$Epochs = 30)
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$py = "$root\ml\.venv\Scripts\python.exe"
while (Get-Process -Id $WaitPid -ErrorAction SilentlyContinue) { Start-Sleep 30 }
& $py ml\train.py --export --name $From *> "ml\data\export-$From.log"
& $py ml\train.py --name $To --weights "ml\runs\$From\weights\best.pt" --epochs $Epochs *> "ml\data\train-$To.log"
