$ErrorActionPreference = 'Stop'

$workspace = Join-Path $PSScriptRoot '..'
$pagesRoot = Join-Path $workspace '_pages\ai-agents-with-mcp'
$englishDir = Join-Path $pagesRoot 'en'
$koreanDir = Join-Path $pagesRoot 'ko'
$koreanSource = Join-Path $workspace '_drafts\ai-agents-with-mcp\AI_Agents_with_MCP_ko.md'
$content = Get-Content -LiteralPath $koreanSource -Raw -Encoding utf8

function Get-FrontMatter {
    param(
        [string]$Title,
        [string]$Permalink,
        [string]$Language,
        [int]$Order
    )

    $safeTitle = $Title.Replace("'", "''")
    return @" 
---
title: '$safeTitle'
author: Kyle Stratis
layout: post
permalink: $Permalink
lang: $Language
book_order: $Order
---

"@
}

$sectionPattern = '<section class="(?:front-matter|book-section)" data-source="([^"]+)" markdown="1">\s*(.*?)\s*</section>'
$matches = [regex]::Matches($content, $sectionPattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)

if ($matches.Count -ne 9) {
    throw "Expected 9 Korean book sections, found $($matches.Count)."
}

$order = 0
foreach ($match in $matches) {
    $sourceName = $match.Groups[1].Value
    $body = $match.Groups[2].Value.Trim() + "`n"
    $titleMatch = [regex]::Match($body, '(?m)^#\s+(.+)$')
    if (-not $titleMatch.Success) {
        throw "No title heading found for $sourceName."
    }

    if ($sourceName -eq 'brief_table_of_contents.md') {
        $outputName = 'brief_table_of_contents_ko.md'
        $permalink = '/AI_Agent_with_MCP/ko/index.html'
    }
    elseif ($sourceName -eq 'about_the_author.md') {
        $outputName = 'about_the_author_ko.md'
        $permalink = '/AI_Agent_with_MCP/ko/about_the_author.html'
        $order = 8
    }
    else {
        $chapterNumber = [regex]::Match($sourceName, 'chapter_(\d+)\.md').Groups[1].Value
        $outputName = "chapter_${chapterNumber}_ko.md"
        $permalink = "/AI_Agent_with_MCP/ko/chapter_${chapterNumber}.html"
        $order = [int]$chapterNumber
    }

    $body = [regex]::Replace($body, '\]\(chapter_([1-7])/', ']({{ site.baseurl }}/assets/ai-agents-with-mcp/chapter_$1/')
    $body = [regex]::Replace($body, '\(chapter_([1-7])\.md', '(../chapter_$1.html')

    $frontMatter = Get-FrontMatter -Title $titleMatch.Groups[1].Value -Permalink $permalink -Language 'ko' -Order $order
    Set-Content -LiteralPath (Join-Path $koreanDir $outputName) -Value ($frontMatter + $body) -Encoding utf8 -NoNewline
}

$englishFiles = @(
    @{ Name = 'brief_table_of_contents.md'; Permalink = '/AI_Agent_with_MCP/index.html'; Order = 0 },
    @{ Name = 'chapter_1.md'; Permalink = '/AI_Agent_with_MCP/chapter_1.html'; Order = 1 },
    @{ Name = 'chapter_2.md'; Permalink = '/AI_Agent_with_MCP/chapter_2.html'; Order = 2 },
    @{ Name = 'chapter_3.md'; Permalink = '/AI_Agent_with_MCP/chapter_3.html'; Order = 3 },
    @{ Name = 'chapter_4.md'; Permalink = '/AI_Agent_with_MCP/chapter_4.html'; Order = 4 },
    @{ Name = 'chapter_5.md'; Permalink = '/AI_Agent_with_MCP/chapter_5.html'; Order = 5 },
    @{ Name = 'chapter_6.md'; Permalink = '/AI_Agent_with_MCP/chapter_6.html'; Order = 6 },
    @{ Name = 'chapter_7.md'; Permalink = '/AI_Agent_with_MCP/chapter_7.html'; Order = 7 },
    @{ Name = 'about_the_author.md'; Permalink = '/AI_Agent_with_MCP/about_the_author.html'; Order = 8 }
)

foreach ($entry in $englishFiles) {
    $path = Join-Path $englishDir $entry.Name
    $body = Get-Content -LiteralPath $path -Raw -Encoding utf8
    if ($body.StartsWith('---')) {
        continue
    }

    $titleMatch = [regex]::Match($body, '(?m)^#\s+(.+)$')
    if (-not $titleMatch.Success) {
        throw "No title heading found for $($entry.Name)."
    }

    $body = [regex]::Replace($body, '\]\(chapter_([1-7])/', ']({{ site.baseurl }}/assets/ai-agents-with-mcp/chapter_$1/')
    $body = [regex]::Replace($body, '\(chapter_([1-7])\.md', '(chapter_$1.html')
    $frontMatter = Get-FrontMatter -Title $titleMatch.Groups[1].Value -Permalink $entry.Permalink -Language 'en' -Order $entry.Order
    Set-Content -LiteralPath $path -Value ($frontMatter + $body.TrimStart()) -Encoding utf8 -NoNewline
}

Write-Output "Generated $($matches.Count) Korean pages and prepared $($englishFiles.Count) English pages."
