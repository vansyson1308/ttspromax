param(
    [switch]$WithLocal,
    [string]$Python = "python"
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")
$venv = Join-Path $repoRoot ".voiceover-venv"

if (-not (Get-Command $Python -ErrorAction SilentlyContinue)) {
    throw "Python 3.10-3.12 was not found. Install Python and retry."
}

& $Python -c "import sys; assert (3, 10) <= sys.version_info[:2] < (3, 13), 'Python 3.10-3.12 is required'"
if ($LASTEXITCODE -ne 0) { throw "Unsupported Python version." }

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    throw "FFmpeg is required. Install it and ensure ffmpeg.exe is on PATH."
}
if (-not (Get-Command ffprobe -ErrorAction SilentlyContinue)) {
    throw "FFprobe is required. Install it and ensure ffprobe.exe is on PATH."
}

if (-not (Test-Path $venv)) {
    & $Python -m venv $venv
}

$venvPython = Join-Path $venv "Scripts\python.exe"
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r (Join-Path $PSScriptRoot "requirements-cloud.txt")

if ($WithLocal) {
    if (-not (Get-Command nvidia-smi -ErrorAction SilentlyContinue)) {
        throw "VoxCPM2 local setup requires an NVIDIA driver and nvidia-smi."
    }
    $gpuMemory = nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits |
        ForEach-Object { [int]($_.Trim()) } |
        Measure-Object -Maximum
    if (-not $gpuMemory.Maximum -or $gpuMemory.Maximum -lt 7500) {
        throw "VoxCPM2 local setup requires an NVIDIA GPU with approximately 8 GB VRAM."
    }
    & $venvPython -m pip install -r (Join-Path $PSScriptRoot "requirements-local.txt")
}

& $venvPython (Join-Path $PSScriptRoot "voiceover.py") doctor
Write-Host ""
Write-Host "Voice-over environment is ready: $venv"
Write-Host "VoxCPM2 weights are downloaded lazily on the first local synthesis."
