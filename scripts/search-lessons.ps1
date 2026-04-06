# search-lessons.ps1
# Memento-style skill routing: find relevant lessons by keyword
# Usage: .\scripts\search-lessons.ps1 "EPPlus"
#        .\scripts\search-lessons.ps1 "sidebar" -WeightFilter HIGH
#        .\scripts\search-lessons.ps1 "EntryService" -Category PATTERN

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$Query,
    [ValidateSet("HIGH","MEDIUM","LOW","ALL")]
    [string]$WeightFilter = "ALL",
    [string]$Category = "ALL",
    [string]$ProjectRoot = "C:\Users\USER\OneDrive\Documents\alsamlah"
)

$lessonsPath = Join-Path $ProjectRoot ".codex\skills\ALSAMLAH-assistant\tasks\lessons.md"
$content = [System.IO.File]::ReadAllText($lessonsPath, [System.Text.Encoding]::UTF8)

# Split into individual lesson blocks
$blocks = $content -split '(?=## \[\d{4}-\d{2}-\d{2}\])'
$results = @()

foreach ($block in $blocks) {
    if ($block -notmatch '## \[(\d{4}-\d{2}-\d{2})\]') { continue }

    # Check if query matches (case-insensitive)
    $queryWords = $Query -split '\s+'
    $matchScore = 0
    foreach ($word in $queryWords) {
        if ($block -match [regex]::Escape($word)) { $matchScore++ }
    }
    if ($matchScore -eq 0) { continue }

    # Extract fields
    $date = if ($block -match '## \[(\d{4}-\d{2}-\d{2})\]') { $Matches[1] } else { "unknown" }
    $title = ($block -split "`n")[0].Trim()
    $weight = if ($block -match '\*{0,2}Weight\*{0,2}:\s*(HIGH|MEDIUM|LOW)') { $Matches[1] } else { "UNKNOWN" }
    $cat = if ($block -match '\*{0,2}Category\*{0,2}:\s*(\[.+?\](?:\[.+?\])*)') { $Matches[1] } else { "UNKNOWN" }
    $rule = if ($block -match '\*{0,2}Rule for next time\*{0,2}:\s*(.+)') { $Matches[1].Trim() } else { "" }
    $superseded = if ($block -match '\*{0,2}Superseded by\*{0,2}:\s*(.+)') { $Matches[1].Trim() } else { "none" }

    # Apply filters
    if ($WeightFilter -ne "ALL" -and $weight -ne $WeightFilter) { continue }
    if ($Category -ne "ALL" -and $cat -notmatch $Category) { continue }
    if ($superseded -ne "none") { continue } # Skip superseded lessons by default

    $results += [PSCustomObject]@{
        Date = $date
        Title = $title
        Weight = $weight
        Category = $cat
        Rule = $rule
        MatchScore = $matchScore
        Superseded = $superseded
    }
}

# Sort by weight (HIGH first), then match score, then date
$weightOrder = @{ "HIGH" = 0; "MEDIUM" = 1; "LOW" = 2; "UNKNOWN" = 3 }
$results = $results | Sort-Object { $weightOrder[$_.Weight] }, { -$_.MatchScore }, Date -Descending

# Display
Write-Host ""
Write-Host "Lesson search: '$Query'" -ForegroundColor Cyan
if ($WeightFilter -ne "ALL") { Write-Host "  Weight filter: $WeightFilter" -ForegroundColor DarkGray }
if ($Category -ne "ALL") { Write-Host "  Category filter: $Category" -ForegroundColor DarkGray }
Write-Host "  Found: $($results.Count) lessons" -ForegroundColor DarkGray
Write-Host ""

foreach ($r in $results) {
    $color = switch ($r.Weight) { "HIGH" { "Red" } "MEDIUM" { "Yellow" } default { "White" } }
    Write-Host "[$($r.Weight)] $($r.Title)" -ForegroundColor $color
    if ($r.Rule) {
        # Truncate rule to 120 chars for display
        $ruleDisplay = if ($r.Rule.Length -gt 120) { $r.Rule.Substring(0, 120) + "..." } else { $r.Rule }
        Write-Host "  Rule: $ruleDisplay" -ForegroundColor DarkGray
    }
    Write-Host ""
}

if ($results.Count -eq 0) {
    Write-Host "No lessons found matching '$Query'." -ForegroundColor Yellow
    Write-Host "Try broader keywords or remove filters." -ForegroundColor DarkGray
}
