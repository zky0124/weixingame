param([string]$Node路径='')
$ErrorActionPreference='Stop'
if (-not $Node路径) {
    $localRuntime='G:\游戏开发环境\运行时\node-v24.15.0-win-x64\node.exe'
    if (Test-Path -LiteralPath $localRuntime) { $Node路径=$localRuntime }
    else { $Node路径=(Get-Command node -ErrorAction Stop).Source }
}
& $Node路径 (Join-Path $PSScriptRoot '本地试玩服务.cjs')
