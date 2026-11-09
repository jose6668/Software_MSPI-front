[CmdletBinding()]
param(
    [Parameter(Mandatory)] [ValidatePattern('^[a-z0-9][a-z0-9_-]*$')] [string] $BackendProject,
    [Parameter(Mandatory)] [string] $TlsDirectory,
    [ValidateRange(1024,65535)] [int] $Port = 6443
)
$ErrorActionPreference = 'Stop'
$network = 'mspi-front-api'
$directory = (Resolve-Path -LiteralPath $TlsDirectory).Path
for ($parent = Get-Item -LiteralPath $directory; $parent; $parent = $parent.Parent) {
    if (Test-Path -LiteralPath (Join-Path $parent.FullName '.git')) {
        throw 'El material TLS debe quedar fuera de Git.'
    }
}
foreach ($file in 'server.p12','server-password.txt','ca.crt') {
    if (-not (Test-Path -LiteralPath (Join-Path $directory $file) -PathType Leaf)) {
        throw "Falta $file en la carpeta TLS indicada."
    }
}
$backends = @(docker ps -q --filter "label=com.docker.compose.project=$BackendProject" --filter 'label=com.docker.compose.service=backend')
if ($LASTEXITCODE -ne 0 -or $backends.Count -ne 1) {
    throw 'Arranca el backend del proyecto Docker indicado.'
}
$backend = $backends[0]
$description = docker network inspect $network 2>$null
if ($LASTEXITCODE -ne 0) {
    docker network create --internal $network | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la red privada del frontend.' }
    $description = docker network inspect $network
}
$info = $description | ConvertFrom-Json
if (-not $info.Internal) { throw 'La red del frontend debe ser interna.' }
foreach ($endpoint in $info.Containers.PSObject.Properties) {
    if ($endpoint.Name.StartsWith($backend)) { continue }
    $labels = docker inspect --format '{{json .Config.Labels}}' $endpoint.Name | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or $labels.'com.docker.compose.project' -ne 'mspi-frontend-lab' -or
        $labels.'com.docker.compose.service' -ne 'frontend') {
        throw 'La red interna contiene otro servicio. Use un único backend de laboratorio.'
    }
}

$attachments = docker inspect --format '{{json .NetworkSettings.Networks}}' $backend | ConvertFrom-Json
$attachment = $attachments.PSObject.Properties[$network]
if (-not $attachment) {
    docker network connect --alias mspi-api $network $backend
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo conectar el backend a la red interna.' }
} elseif ($attachment.Value.Aliases -notcontains 'mspi-api') {
    throw 'El backend está en la red interna sin el alias mspi-api.'
}
$env:MSPI_FRONT_TLS_DIR = $directory.Replace('\','/')
$env:MSPI_FRONT_PORT = "$Port"
$env:MSPI_FRONT_NETWORK = $network
$compose = Join-Path $PSScriptRoot '../compose.yaml'
docker compose -p mspi-frontend-lab -f $compose up -d --build
if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar el frontend en Docker.' }
Write-Output "MSPI disponible en https://localhost:$Port"
