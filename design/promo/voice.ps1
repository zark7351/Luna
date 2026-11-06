$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice.SelectVoice('Microsoft Huihui Desktop')
$voice.Rate = 2
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(24000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$lines = Get-Content -Raw -Encoding UTF8 -LiteralPath $env:CLAUDIE_SCRIPT | ConvertFrom-Json
try {
  for ($i=0; $i -lt $lines.Count; $i++) {
    $file = Join-Path $env:CLAUDIE_AUDIO ('line-' + $i + '.wav')
    $voice.SetOutputToWaveFile($file, $format)
    $voice.Speak($lines[$i].say.Replace('Claudy', [string][char]0x514B + [char]0x52B3 + [char]0x8FEA).Replace('Claude', [string][char]0x514B + [char]0x52B3 + [char]0x5FB7))
    $voice.SetOutputToNull()
  }
} finally { $voice.Dispose() }
