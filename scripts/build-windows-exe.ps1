param(
    [switch]$SkipWebBuild,
    [string]$OutputName = "MRP JI.exe"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.IO.Compression.FileSystem

$projectRoot = Split-Path -Parent $PSScriptRoot
$outputRoot = Join-Path $projectRoot "outputs\windows"
$workRoot = Join-Path $projectRoot "build\windows-exe"
$payloadRoot = Join-Path $workRoot "payload"
$payloadZip = Join-Path $workRoot "mrp-payload.zip"
$versionFile = Join-Path $workRoot "payload-version.txt"
$launcherSource = Join-Path $projectRoot "desktop\launcher\MrpLauncher.cs"
$serverSource = Join-Path $projectRoot "desktop\server.mjs"
$nodeSource = "C:\Users\PRODUCAO-2.0\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

if (-not (Test-Path -LiteralPath $nodeSource)) {
    $nodeCommand = Get-Command node.exe -ErrorAction Stop
    $nodeSource = $nodeCommand.Source
}

if (-not (Test-Path -LiteralPath $csc)) {
    throw "Compilador C# do Windows não encontrado."
}

if (-not $SkipWebBuild) {
    $pnpm = "C:\Users\PRODUCAO-2.0\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"
    if (-not (Test-Path -LiteralPath $pnpm)) {
        $pnpm = (Get-Command pnpm.cmd -ErrorAction Stop).Source
    }

    & $pnpm run build
    if ($LASTEXITCODE -ne 0) {
        throw "A compilação web falhou."
    }
}

$requiredPaths = @(
    (Join-Path $projectRoot "dist\client"),
    (Join-Path $projectRoot "dist\server"),
    (Join-Path $projectRoot "node_modules\vinext\dist"),
    $launcherSource,
    $serverSource,
    $nodeSource
)

foreach ($requiredPath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Arquivo necessário não encontrado: $requiredPath"
    }
}

if (Test-Path -LiteralPath $workRoot) {
    $resolvedWork = [System.IO.Path]::GetFullPath($workRoot)
    $resolvedBuild = [System.IO.Path]::GetFullPath((Join-Path $projectRoot "build"))
    if (-not $resolvedWork.StartsWith($resolvedBuild, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Diretório temporário fora da pasta de build."
    }
    Remove-Item -LiteralPath $workRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $payloadRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $payloadRoot "runtime") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $payloadRoot "vinext") -Force | Out-Null
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $projectRoot "dist") -Destination $payloadRoot -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot "node_modules\vinext\dist") `
    -Destination (Join-Path $payloadRoot "vinext") -Recurse
Copy-Item -LiteralPath $nodeSource -Destination (Join-Path $payloadRoot "runtime\node.exe")
Copy-Item -LiteralPath $serverSource -Destination (Join-Path $payloadRoot "server.mjs")

# Vinext indexes static files with Windows path separators. Normalize the
# packaged cache keys so browser URLs such as /assets/app.css resolve correctly.
$staticCachePath = Join-Path $payloadRoot "vinext\dist\server\static-file-cache.js"
$staticCacheSource = [System.IO.File]::ReadAllText($staticCachePath)
$cacheNeedle = 'const pathname = "/" + relativePath;'
if (-not $staticCacheSource.Contains($cacheNeedle)) {
    throw "NÃ£o foi possÃ­vel aplicar a correÃ§Ã£o de arquivos estÃ¡ticos do Vinext."
}
$staticCacheSource = $staticCacheSource.Replace(
    $cacheNeedle,
    'const pathname = "/" + relativePath.replaceAll(path.sep, "/");'
)
[System.IO.File]::WriteAllText(
    $staticCachePath,
    $staticCacheSource,
    (New-Object System.Text.UTF8Encoding($false))
)

[System.IO.Compression.ZipFile]::CreateFromDirectory(
    $payloadRoot,
    $payloadZip,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false)

$payloadHash = (Get-FileHash -LiteralPath $payloadZip -Algorithm SHA256).Hash.ToLowerInvariant()
$payloadVersion = $payloadHash.Substring(0, 16)
[System.IO.File]::WriteAllText($versionFile, $payloadVersion, [System.Text.Encoding]::UTF8)

$outputExe = Join-Path $outputRoot $OutputName
$references = @(
    "/reference:System.dll",
    "/reference:System.Core.dll",
    "/reference:System.Drawing.dll",
    "/reference:System.Windows.Forms.dll",
    "/reference:System.IO.Compression.dll",
    "/reference:System.IO.Compression.FileSystem.dll"
)

$compilerArguments = @(
    "/nologo",
    "/target:winexe",
    "/platform:x64",
    "/optimize+",
    "/out:$outputExe",
    "/resource:$payloadZip,MrpPayload",
    "/resource:$versionFile,MrpPayloadVersion"
) + $references + @($launcherSource)

& $csc $compilerArguments
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $outputExe)) {
    throw "Não foi possível gerar o executável."
}

$outputInfo = Get-Item -LiteralPath $outputExe
Write-Host ""
Write-Host "Executável criado:"
Write-Host $outputInfo.FullName
Write-Host ("Tamanho: {0:N1} MB" -f ($outputInfo.Length / 1MB))
