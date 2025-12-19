# Script para descargar modelos de face-api.js
# Ejecutar desde la raíz del proyecto: .\download-models.ps1

$modelsDir = "lib\models"
$baseUrl = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"

# Crear directorio si no existe
if (-not (Test-Path $modelsDir)) {
	New-Item -ItemType Directory -Path $modelsDir -Force | Out-Null
	Write-Host "Directorio creado: $modelsDir" -ForegroundColor Green
}

# Lista de archivos necesarios para TinyFaceDetector
$files = @(
	"tiny_face_detector_model-weights_manifest.json",
	"tiny_face_detector_model-shard1"
)

Write-Host ""
Write-Host "Descargando modelos de face-api.js..." -ForegroundColor Cyan
Write-Host "Destino: $modelsDir" -ForegroundColor Gray
Write-Host ""

$success = 0
$failed = 0

foreach ($file in $files) {
	$url = "$baseUrl/$file"
	$destination = Join-Path $modelsDir $file
    
	try {
		Write-Host "Descargando: $file..." -NoNewline
		Invoke-WebRequest -Uri $url -OutFile $destination -ErrorAction Stop
		Write-Host " OK" -ForegroundColor Green
		$success++
	}
	catch {
		Write-Host " ERROR" -ForegroundColor Red
		Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
		$failed++
	}
}

Write-Host ""
Write-Host "Resultado:" -ForegroundColor Cyan
Write-Host "Descargados: $success archivos" -ForegroundColor Green
if ($failed -gt 0) {
	Write-Host "Fallidos: $failed archivos" -ForegroundColor Red
}

# Verificar tamaños
Write-Host ""
Write-Host "Tamaños de archivo:" -ForegroundColor Cyan
Get-ChildItem $modelsDir | ForEach-Object {
	$sizeKB = [math]::Round($_.Length / 1KB, 2)
	Write-Host "$($_.Name): $sizeKB KB" -ForegroundColor Gray
}

if ($success -eq $files.Count) {
	Write-Host ""
	Write-Host "Modelos descargados correctamente!" -ForegroundColor Green
	Write-Host ""
}
else {
	Write-Host ""
	Write-Host "Algunos archivos no se pudieron descargar." -ForegroundColor Yellow
	Write-Host "Descargalos manualmente desde:" -ForegroundColor Yellow
	Write-Host "https://github.com/justadudewhohacks/face-api.js/tree/master/weights" -ForegroundColor Gray
	Write-Host ""
}

