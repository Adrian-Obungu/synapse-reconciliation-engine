$Global:SimulatorMode = "SUCCESS"
$Listener = [System.Net.HttpListener]::new()
$Listener.Prefixes.Add("http://127.0.0.1:8080/")
try {
    $Listener.Start()
    Write-Host "=========================================================" -ForegroundColor Cyan
    Write-Host "       SYNAPSE eTIMS POWERSHELL 7 HIGH-FIDELITY SERVER    " -ForegroundColor Green
    Write-Host "=========================================================" -ForegroundColor Cyan
    Write-Host "Listening actively on: http://127.0.0.1:8080/" -ForegroundColor Yellow
    Write-Host "CLOSE THIS WINDOW TO TERMINATE THE SERVER." -ForegroundColor Red
} catch {
    Write-Error "Failed to bind port 8080: $_"
    exit
}

while ($Listener.IsListening) {
    try {
        $Context = $Listener.GetContext()
        $Request = $Context.Request
        $Response = $Context.Response
        
        try {
            $Response.ContentType = "application/json"
            $Response.Headers.Add("Server", "PowerShell7-eTIMS-Simulator")

            $RequestBody = ""
            if ($Request.HasEntityBody) {
                $Reader = [System.IO.StreamReader]::new($Request.InputStream)
                $RequestBody = $Reader.ReadToEnd()
                $Reader.Close()
            }

            if ($Request.RawUrl -eq "/admin/config" -and $Request.HttpMethod -eq "GET") {
                $ResponseData = @{ status = "operational"; current_mode = $Global:SimulatorMode }
                $ResponseJson = $ResponseData | ConvertTo-Json -Compress
                $Response.StatusCode = 200
            }
            elseif ($Request.RawUrl -eq "/admin/config" -and $Request.HttpMethod -eq "POST") {
                $Payload = ConvertFrom-Json $RequestBody
                $TargetMode = $Payload.mode.ToUpper()
                if ($TargetMode -in @("SUCCESS", "RATE_LIMIT", "TIMEOUT")) {
                    $Global:SimulatorMode = $TargetMode
                    $ResponseData = @{ msg = "Mode altered to $TargetMode" }
                    $Response.StatusCode = 200
                } else {
                    $ResponseData = @{ error = "Invalid mode." }
                    $Response.StatusCode = 400
                }
                $ResponseJson = $ResponseData | ConvertTo-Json -Compress
            }
            elseif ($Request.RawUrl -eq "/api/v1/transmit-invoice" -and $Request.HttpMethod -eq "POST") {
                $Payload = ConvertFrom-Json $RequestBody
                if ($Global:SimulatorMode -eq "RATE_LIMIT") {
                    $ResponseJson = @{ detail = "API rate limit exceeded." } | ConvertTo-Json -Compress
                    $Response.StatusCode = 429
                }
                elseif ($Global:SimulatorMode -eq "TIMEOUT") {
                    Start-Sleep -Seconds 2
                    $ResponseJson = @{ detail = "Gateway timeout." } | ConvertTo-Json -Compress
                    $Response.StatusCode = 503
                }
                else {
                    $InvoiceNum = "KRA2026$(Get-Random -Min 100000000 -Max 999999999)"
                    $ResponseData = @{
                        status = "CERTIFIED"
                        invoiceNumber = $InvoiceNum
                        kraReceiptSignature = "S1NG-$([Guid]::NewGuid().Guid.Substring(0,8).ToUpper())"
                        qrCodeMetadata = "https://etims.kra.go.ke/verify/v=1&num=$InvoiceNum"
                        amountValidated = $Payload.amount_ksh
                    }
                    $ResponseJson = $ResponseData | ConvertTo-Json -Compress
                    $Response.StatusCode = 200
                }
            }
            else {
                $ResponseJson = @{ error = "Not Found" } | ConvertTo-Json -Compress
                $Response.StatusCode = 404
            }

            # Write data payload to response buffer stream
            $Buffer = [System.Text.Encoding]::UTF8.GetBytes($ResponseJson)
            $Response.ContentLength64 = $Buffer.Length
            $Response.OutputStream.Write($Buffer, 0, $Buffer.Length)
            
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $($Request.HttpMethod) $($Request.RawUrl) -> StatusCode: $($Response.StatusCode)" -ForegroundColor Gray
            
        } catch {
            Write-Host "Internal routing error: $_" -ForegroundColor Red
            $Response.StatusCode = 500
        } finally {
            # This guarantees the connection closes NO MATTER WHAT, preventing terminal hangs
            $Response.Close()
        }
    } catch {
        Write-Host "Listener dropped a connection." -ForegroundColor DarkGray
    }
}
