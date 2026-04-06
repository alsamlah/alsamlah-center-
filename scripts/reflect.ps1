# reflect.ps1
# Memento-style reflection: checks if recent changes followed known lessons
# Usage: .\scripts\reflect.ps1              (last commit)
#        .\scripts\reflect.ps1 -Deep        (last 5 commits, detailed)
#        .\scripts\reflect.ps1 -CommitHash abc123  (specific commit)

param(
    [switch]$Deep,
    [string]$CommitHash,
    [string]$ProjectRoot = "C:\Users\USER\OneDrive\Documents\alsamlah"
)

$lessonsPath = Join-Path $ProjectRoot ".codex\skills\ALSAMLAH-assistant\tasks\lessons.md"
$skillPath = Join-Path $ProjectRoot ".codex\skills\ALSAMLAH-assistant\SKILL.md"

# Get changed files
if ($CommitHash) {
    $changedFiles = git -C $ProjectRoot diff-tree --no-commit-id --name-only -r $CommitHash
} elseif ($Deep) {
    $changedFiles = git -C $ProjectRoot diff --name-only HEAD~5..HEAD
} else {
    $changedFiles = git -C $ProjectRoot diff --name-only HEAD~1..HEAD
}

if (-not $changedFiles) {
    Write-Host "No changed files found." -ForegroundColor Yellow
    exit 0
}

# Read lessons
$lessonsContent = [System.IO.File]::ReadAllText($lessonsPath, [System.Text.Encoding]::UTF8)

# Build keyword map from file paths
$relevantLessons = @()
$fileKeywords = @{}

foreach ($file in $changedFiles) {
    $fileName = [System.IO.Path]::GetFileNameWithoutExtension($file)
    $keywords = @($fileName)

    # Add component-level keywords
    if ($file -match "Pages[/\\]") { $keywords += "Razor", "Page", "UI" }
    if ($file -match "Services[/\\]") { $keywords += "Service" }
    if ($file -match "Controllers[/\\]") { $keywords += "Controller", "API" }
    if ($file -match "\.css$") { $keywords += "CSS", "style", "dark mode", "RTL" }
    if ($file -match "app\.js$") { $keywords += "JS", "interop", "localStorage" }
    if ($file -match "MainLayout") { $keywords += "Sidebar", "layout", "navigation" }
    if ($file -match "SidebarMenuConfig") { $keywords += "Sidebar", "menu", "navigation" }
    if ($file -match "EntryService") { $keywords += "Entry", "save", "learning loop" }
    if ($file -match "EntryDetail|ScanPage") { $keywords += "invoice", "line item", "financial" }
    if ($file -match "Migration") { $keywords += "migration", "database", "FK" }
    if ($file -match "Export|Pdf|Excel") { $keywords += "export", "PDF", "Excel", "EPPlus", "QuestPDF" }

    $fileKeywords[$file] = $keywords
}

# Search lessons for each file's keywords
$lessonBlocks = $lessonsContent -split '(?=## \[\d{4}-\d{2}-\d{2}\])'
$matchedLessons = @()

foreach ($file in $changedFiles) {
    foreach ($keyword in $fileKeywords[$file]) {
        foreach ($block in $lessonBlocks) {
            if ($block -match [regex]::Escape($keyword) -and $block -match '## \[(\d{4}-\d{2}-\d{2})\]') {
                $date = $Matches[1]
                $title = ($block -split "`n")[0].Trim()
                $weight = if ($block -match '\*{0,2}Weight\*{0,2}:\s*(HIGH|MEDIUM|LOW)') { $Matches[1] } else { "UNKNOWN" }
                $matchedLessons += [PSCustomObject]@{
                    File = $file
                    Keyword = $keyword
                    LessonTitle = $title
                    Weight = $weight
                    Date = $date
                }
            }
        }
    }
}

# Deduplicate
$matchedLessons = $matchedLessons | Sort-Object LessonTitle -Unique

# Output report
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Memento Reflect Report" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Changed files: $($changedFiles.Count)" -ForegroundColor White
foreach ($f in $changedFiles) { Write-Host "  $f" -ForegroundColor DarkGray }
Write-Host ""

if ($matchedLessons.Count -eq 0) {
    Write-Host "No matching lessons found for changed files." -ForegroundColor Green
    Write-Host "If this commit involved a correction, write a new lesson!" -ForegroundColor Yellow
} else {
    Write-Host "Relevant lessons ($($matchedLessons.Count)):" -ForegroundColor Yellow
    Write-Host ""
    foreach ($lesson in $matchedLessons) {
        $color = switch ($lesson.Weight) { "HIGH" { "Red" } "MEDIUM" { "Yellow" } default { "DarkGray" } }
        Write-Host "  [$($lesson.Weight)] $($lesson.LessonTitle)" -ForegroundColor $color
        Write-Host "    Triggered by: $($lesson.File) (keyword: $($lesson.Keyword))" -ForegroundColor DarkGray
    }
    Write-Host ""
    Write-Host "Did you follow ALL relevant lessons above?" -ForegroundColor Yellow
    Write-Host "If not, write a lesson entry for what went wrong." -ForegroundColor Yellow
}

# Check lesson count for evolution trigger
$lessonCount = ($lessonsContent | Select-String -Pattern '## \[\d{4}-\d{2}-\d{2}\]' -AllMatches).Matches.Count
$sinceLastEvolve = 0
$lastEvolveMarker = Join-Path $ProjectRoot ".codex\skills\ALSAMLAH-assistant\tasks\.last-evolve-count"
if (Test-Path $lastEvolveMarker) {
    $lastCount = [int](Get-Content $lastEvolveMarker -Raw).Trim()
    $sinceLastEvolve = $lessonCount - $lastCount
}

if ($sinceLastEvolve -ge 5) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host "  SKILL EVOLUTION SUGGESTED" -ForegroundColor Magenta
    Write-Host "  $sinceLastEvolve new lessons since last SKILL.md review" -ForegroundColor Magenta
    Write-Host "  Run: .\scripts\evolve-skills.ps1" -ForegroundColor Magenta
    Write-Host "========================================" -ForegroundColor Magenta
}

Write-Host ""
