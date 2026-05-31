$blogDir = "c:\Users\Usuario\Documents\ORAN DOLAR\blog"
$files = Get-ChildItem -Path $blogDir -Filter "*.html" | Where-Object { $_.Name -ne "index.html" }

$authorHtml = @"
</h1>
<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border);">
  <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--bg-surface-3); display: flex; align-items: center; justify-content: center; font-weight: bold; color: var(--gold);">CM</div>
  <div>
    <div style="font-size: 14px; font-weight: 600; color: var(--text);">Carlos Mendoza</div>
    <div style="font-size: 12px; color: var(--text-dim);">Revisión Editorial - Mayo 2026</div>
  </div>
</div>
"@

$metaHtml = @"
</title>
  <meta name="author" content="Carlos Mendoza">
"@

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    
    if ($content -notmatch "Carlos Mendoza") {
        $content = $content -replace "</h1>", $authorHtml
        $content = $content -replace "</title>", $metaHtml
        
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        Write-Host "Updated $($file.Name)"
    }
}
Write-Host "Done"
