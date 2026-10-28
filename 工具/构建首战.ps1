param([string]$Creator路径='G:\游戏开发环境\引擎\CocosCreator.exe')
$ErrorActionPreference='Stop'
$projectDir=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\游戏工程'))
if (-not (Test-Path -LiteralPath $Creator路径)) { throw '请传入本机Cocos Creator 3.8.8路径。' }
$configPath=Join-Path $PSScriptRoot '首战构建配置.json'
$buildArgs='configPath='+$configPath
$buildProcess=Start-Process -FilePath $Creator路径 -ArgumentList @('--project',('"{0}"' -f $projectDir),'--build',('"{0}"' -f $buildArgs)) -WindowStyle Hidden -Wait -PassThru
if ($buildProcess.ExitCode -ne 36) { throw "Creator构建退出码：$($buildProcess.ExitCode)，请检查工程temp/logs。" }
Write-Host '构建成功。运行 工具\启动首战试玩.ps1 后打开 http://127.0.0.1:7456/preview 。'
