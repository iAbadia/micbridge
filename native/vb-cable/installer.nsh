!include "nsDialogs.nsh"
!ifndef BUILD_UNINSTALLER
Var CableInstall
Var CableCheckbox
!endif

!macro customPageAfterChangeDir
  Page custom MicbridgeCablePage MicbridgeCableLeave

Function MicbridgeCablePage
  ${If} ${isUpdated}
    Abort
  ${EndIf}
  !insertmacro MUI_HEADER_TEXT "Windows virtual microphone" "Use your phone microphone in meeting and recording apps."
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 42u "Micbridge uses VB-Audio's signed VB-CABLE driver. This optional step opens the official driver installer and requires administrator approval. Restart Windows afterwards."
  Pop $0
  ${NSD_CreateCheckbox} 0 48u 100% 20u "Set up VB-CABLE virtual microphone (recommended)"
  Pop $CableCheckbox
  ${If} $CableInstall != ${BST_UNCHECKED}
    ${NSD_Check} $CableCheckbox
  ${EndIf}
  ${NSD_CreateLabel} 0 76u 100% 48u "VB-CABLE is donationware, separately licensed from Micbridge. All contributions are welcome. Professional use may require a paid license. Existing installations are reused without renaming; uninstalling Micbridge keeps the shared cable."
  Pop $0
  ${NSD_CreateLink} 0 128u 100% 14u "VB-Audio: download, donate and purchase licenses"
  Pop $0
  ${NSD_OnClick} $0 MicbridgeCableWebsite
  ${NSD_CreateLink} 0 147u 100% 14u "Read VB-CABLE licensing and distribution terms"
  Pop $0
  ${NSD_OnClick} $0 MicbridgeCableTerms
  nsDialogs::Show
FunctionEnd
Function MicbridgeCableWebsite
  Pop $0
  ExecShell "open" "https://vb-audio.com/Cable/"
FunctionEnd
Function MicbridgeCableTerms
  Pop $0
  ExecShell "open" "https://vb-audio.com/Services/licensing.htm"
FunctionEnd
Function MicbridgeCableLeave
  ${NSD_GetState} $CableCheckbox $CableInstall
FunctionEnd
!macroend

!macro customInstall
  ${If} $CableInstall == ${BST_CHECKED}
    DetailPrint "Setting up VB-CABLE. Please complete the VB-Audio installation window."
    nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\vb-cable\install.ps1" -Elevate'
    Pop $0
    Pop $1
    ${If} $0 == "3010"
      SetRebootFlag true
    ${ElseIf} $0 != "0"
      MessageBox MB_OK|MB_ICONEXCLAMATION "Micbridge was installed, but the virtual microphone setup did not finish. You can retry from Micbridge's Start menu shortcut: Set up virtual microphone. $1"
    ${EndIf}
  ${EndIf}
  CreateShortCut "$SMPROGRAMS\Micbridge virtual microphone setup.lnk" "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" '-NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\vb-cable\install.ps1" -Elevate' "$INSTDIR\Micbridge.exe"
!macroend
!macro customUnInstall
  Delete "$SMPROGRAMS\Micbridge virtual microphone setup.lnk"
!macroend
