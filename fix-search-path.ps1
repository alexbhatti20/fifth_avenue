$lines = [System.IO.File]::ReadAllLines("$PSScriptRoot\supabase\zoiro-complete-database.sql")
$newLines = [System.Collections.Generic.List[string]]::new()
$added = 0
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].Trim() -eq 'AS $function$') {
        if ($i -gt 0 -and $lines[$i-1].Trim() -like '*search_path*') {
            $newLines.Add($lines[$i])
        } else {
            $newLines.Add(" SET search_path = 'public'")
            $newLines.Add($lines[$i])
            $added++
        }
    } else {
        $newLines.Add($lines[$i])
    }
}
[System.IO.File]::WriteAllLines("$PSScriptRoot\supabase\zoiro-complete-database.sql", $newLines)
Write-Host "Added search_path to $added functions. Total lines now: $($newLines.Count)"
