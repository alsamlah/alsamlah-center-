# sync-agent-brain.ps1
# Syncs .codex skill files into agent-brain/ so Obsidian can see them
# Run this after any session where you updated SKILL.md or lessons.md
# Usage: .\scripts\sync-agent-brain.ps1

$Root = "C:\Users\USER\OneDrive\Documents\alsamlah"

$files = @(
    @{
        Source = "$Root\.codex\skills\ALSAMLAH-assistant\SKILL.md"
        Dest   = "$Root\agent-brain\SKILL.md"
        Label  = "SKILL.md"
    },
    @{
        Source = "$Root\.codex\skills\ALSAMLAH-assistant\tasks\lessons.md"
        Dest   = "$Root\agent-brain\lessons.md"
        Label  = "lessons.md"
    },
    @{
        Source = "$Root\.codex\skills\ALSAMLAH-assistant\references\deep-context.md"
        Dest   = "$Root\agent-brain\deep-context.md"
        Label  = "deep-context.md"
    }
)

Write-Host ""
Write-Host "Syncing .codex files to agent-brain..." -ForegroundColor Cyan

foreach ($f in $files) {
    if (Test-Path $f.Source) {
        Copy-Item -Path $f.Source -Destination $f.Dest -Force
        Write-Host "  + $($f.Label) synced" -ForegroundColor Green
    } else {
        Write-Host "  ! $($f.Label) source not found" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Done! Obsidian will now show updated SKILL, lessons, deep-context." -ForegroundColor Green
Write-Host "Note: agent-brain/ files are READ-ONLY mirrors. Edit .codex/ originals only." -ForegroundColor Yellow
