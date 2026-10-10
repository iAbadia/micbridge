!macro customInstall
  IfFileExists "$INSTDIR\resources\windows-driver\install.ps1" 0 micbridge_driver_done
  DetailPrint "Installing Micbridge virtual microphone (administrator approval required)…"
  nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -File "$INSTDIR\resources\windows-driver\install.ps1"'
  Pop $0
  Pop $1
  StrCmp $0 "0" micbridge_driver_done
  MessageBox MB_OK|MB_ICONSTOP "Micbridge virtual microphone could not be installed. Administrator approval and a Microsoft-signed driver are required. $1"
  Abort
  micbridge_driver_done:
!macroend
