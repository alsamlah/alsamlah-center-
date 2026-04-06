# sync-version.ps1
# Usage: .\scripts\sync-version.ps1 -Version "v78.38"
# Updates version string in all key MD files at once.
# Run this after every release to keep all docs in sync.

param(
    [Parameter(Mandatory=$true)]
    [string]$Version,
    [string]$Date = (Get-Date -Format "yyyy-MM-dd")
)

$Root = "C:\Users\USER\OneDrive\Documents\alsamlah"

$files = @(
    "$Root\AI_CONTEXT.md",
    "$Root\CLAUDE.md",
    "$Root\SESSION_PRIMER.md",
    "$Root\README.md",
    "$Root\PROJECT_SOURCE_OF_TRUTH.md",
    "$Root\.codex\skills\ALSAMLAH-assistant\SKILL.md",
    "$Root\docs\ai_memory\00_index\INDEX.md",
    "$Root\docs\ai_memory\00_index\ARCHITECTURE_OVERVIEW.md",
    "$Root\docs\ai_memory\AI_ONBOARDING_PROMPT.md",
    "$Root\docs\ai_memory\05_backlog\NEXT_STEPS.md"
)

$updated = @()
$skipped = @()

foreach ($file in $files) {
    if (-not (Test-Path $file)) {
        $skipped += $file
        continue
    }

    $content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
    $original = $content

    $content = $content -replace 'v\d+\.\d+(\.\d+)? \(\d{4}-\d{2}-\d{2}\)', "$Version ($Date)"
    $content = $content -replace '(?<=Version[:\s]+)v\d+\.\d+(\.\d+)?(?!\s*\()', $Version
    $content = $content -replace '(?<=Version[:\s]+)v\d+\.\d+(\.\d+)?(?=\s+\([a-zA-Z])', $Version
    $content = $content -replace '(?<=version[:\s]+\*\*?)v\d+\.\d+(\.\d+)?(?=\*?\*?)', $Version
    $content = $content -replace '(?<=codebase )v\d+\.\d+(\.\d+)?', $Version
    $content = $content -replace '(?<=Updated: )\d{4}-\d{2}-\d{2}', $Date
    $content = $content -replace '(?<=Docs sync: )\d{4}-\d{2}-\d{2}', $Date

    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file, $content, [System.Text.Encoding]::UTF8)
        $updated += (Split-Path $file -Leaf)
    } else {
        $skipped += (Split-Path $file -Leaf)
    }
}

Write-Host ''
Write-Host "Version sync complete - $Version ($Date)" -ForegroundColor Green
Write-Host ''
Write-Host 'Updated:' -ForegroundColor Cyan
$updated | ForEach-Object { Write-Host "  + $_" -ForegroundColor Green }
Write-Host ''
if ($skipped.Count -gt 0) {
    Write-Host 'No change needed:' -ForegroundColor DarkGray
    $skipped | ForEach-Object { Write-Host "  - $_" -ForegroundColor DarkGray }
}

# Auto-sync agent-brain mirrors
Write-Host ''
Write-Host 'Syncing agent-brain Obsidian mirrors...' -ForegroundColor Cyan
& "$Root\scripts\sync-agent-brain.ps1"

Write-Host ''
Write-Host 'Next steps:' -ForegroundColor Yellow
Write-Host '  1. Review changes in VS Code (Source Control tab)' -ForegroundColor Yellow
Write-Host '  2. Run proof packs' -ForegroundColor Yellow
Write-Host ('  3. Commit: docs: sync all files to ' + $Version) -ForegroundColor Yellow
