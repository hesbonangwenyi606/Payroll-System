<#
.SYNOPSIS
Set a Vercel environment variable using Vercel REST API and optionally redeploy using the Vercel CLI.

USAGE
.
  ./set-vercel-env.ps1 -ProjectId pj_123 -Name VITE_API_URL -Value https://payroll-api.onrender.com -Redeploy

REQUIREMENTS
- PowerShell 7+ recommended
- Environment variable VERCEL_TOKEN must be set to a personal token
- Vercel CLI installed if using -Redeploy
#>

param(
  [Parameter(Mandatory=$true)][string]$ProjectId,
  [Parameter(Mandatory=$true)][string]$Name,
  [Parameter(Mandatory=$true)][string]$Value,
  [string]$Target = 'production',
  [switch]$Redeploy
)

if (-not $env:VERCEL_TOKEN) {
  Write-Error "VERCEL_TOKEN environment variable is required. Create a token at https://vercel.com/account/tokens"
  exit 1
}

Write-Host "Setting environment variable '$Name' for project '$ProjectId' (target: $Target)"

$body = @{
  key = $Name
  value = $Value
  target = @($Target)
  type = 'encrypted'
} | ConvertTo-Json

try {
  $resp = Invoke-RestMethod -Method Post -Uri "https://api.vercel.com/v9/projects/$ProjectId/env" -Headers @{ Authorization = "Bearer $($env:VERCEL_TOKEN)"; 'Content-Type' = 'application/json' } -Body $body
} catch {
  Write-Error "Failed to set env var: $_"
  exit 1
}

Write-Host "Env var set successfully. Response:`n$($resp | ConvertTo-Json -Depth 5)"

if ($Redeploy) {
  if (Get-Command vercel -ErrorAction SilentlyContinue) {
    Write-Host "Triggering redeploy using vercel CLI..."
    vercel --prod --token $env:VERCEL_TOKEN --confirm
  } else {
    Write-Warning "vercel CLI not found; install it with 'npm i -g vercel' to enable automatic redeploy."
  }
}
