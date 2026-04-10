$headers = @{
    'Authorization' = 'token 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'
    'Accept' = 'application/vnd.github+json'
}

$body = @{
    title = "feat: lazy-load face-api via dynamic import (fix materials biometrics error)"
    head = "feat/deploy-lazyfaceapi"
    base = "master"
    body = "Corrige biometria na pagina de materiais usando import dinamico do face-api.js. Dispara deploy automatico no Vercel ao mesclar."
} | ConvertTo-Json

$params = @{
    Uri = "https://api.github.com/repos/gfmcosta08/reserva/pulls"
    Method = "Post"
    Headers = $headers
    ContentType = "application/json"
    Body = $body
}

try {
    $result = Invoke-RestMethod @params
    Write-Host "PR Created: $($result.html_url)"
} catch {
    Write-Host "Error: $_"
    Write-Host "Response: $($_.Exception.Response)"
}
