$ErrorActionPreference = "Stop"

if (-not (Test-Path ".git")) {
    throw "Run this check from an initialized Git repository."
}

$tracked = @(git ls-files)
if ($LASTEXITCODE -ne 0) { throw "Unable to list tracked files." }

$tooLarge = @()
foreach ($path in $tracked) {
    if (Test-Path -LiteralPath $path) {
        $file = Get-Item -LiteralPath $path
        if ($file.Length -ge 95MB) {
            $tooLarge += "$path ($([math]::Round($file.Length / 1MB, 1)) MB)"
        }
    }
}
if ($tooLarge.Count -gt 0) {
    throw "Tracked files exceed the 95 MB safety limit:`n$($tooLarge -join "`n")"
}

$secretPatterns = @(
    'FISH_API_KEY\s*=\s*["''][^"'']+["'']',
    'github_pat_[A-Za-z0-9_]{20,}',
    'gh[opusr]_[A-Za-z0-9]{30,}',
    'sk-[A-Za-z0-9_-]{32,}'
)
$findings = @()
foreach ($path in $tracked) {
    if (-not (Test-Path -LiteralPath $path)) { continue }
    $file = Get-Item -LiteralPath $path
    if ($file.Length -gt 5MB) { continue }
    $content = Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue
    foreach ($pattern in $secretPatterns) {
        if ($content -match $pattern) {
            $findings += $path
            break
        }
    }
}
if ($findings.Count -gt 0) {
    throw "Possible secrets found in tracked files: $($findings -join ', ')"
}

Write-Host "Repository check passed: $($tracked.Count) tracked files, no oversized files or obvious secrets."
