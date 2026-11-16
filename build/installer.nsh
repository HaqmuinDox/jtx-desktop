; Let the user choose the Desktop and Start Menu shortcuts individually.
;
; electron-builder already creates both shortcuts (addDesktopLink /
; addStartMenuLink run before customInstall) and writes KeepShortcuts="true"
; to the registry. On an update it takes the "keep" branch and the installer
; runs silently, so it never recreates a shortcut the user declined and the
; page below is skipped — the choice persists across updates for free.
; We only need to remove, on a fresh install, the shortcut(s) the user unchecked.
;
; shortcut: delete-only. Re-running the installer can remove a shortcut but not
;   re-add a previously declined one (we don't recreate). Upgrade to
;   create-if-checked if users need to re-enable a shortcut without reinstalling.

!include nsDialogs.nsh
!include LogicLib.nsh

; All installer-only; the uninstaller pass never emits code that uses them and
; NSIS (with warnings-as-errors) rejects unused variables.
!ifndef BUILD_UNINSTALLER
Var ShortcutPageDialog
Var DesktopCheckbox
Var StartMenuCheckbox
Var CreateDesktopShortcut    ; "0" only when the user unchecked it; "" on silent/update
Var CreateStartMenuShortcut
!endif

!macro customPageAfterChangeDir
  Page custom ShortcutOptionsPageCreate ShortcutOptionsPageLeave
!macroend

; These page functions exist only in the installer pass. NSIS warns about
; unreferenced install functions in the uninstaller build and electron-builder
; treats warnings as errors, so guard them out there.
!ifndef BUILD_UNINSTALLER
Function ShortcutOptionsPageCreate
  ; No MUI_HEADER_TEXT here: this file is parsed before MUI2 is included, so
  ; that macro isn't defined yet. A label in the page body carries the heading.
  nsDialogs::Create 1018
  Pop $ShortcutPageDialog
  ${If} $ShortcutPageDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 12u "Choose which shortcuts to create:"
  Pop $0

  ${NSD_CreateCheckbox} 0 18u 100% 12u "Create a &Desktop shortcut"
  Pop $DesktopCheckbox
  ${NSD_Check} $DesktopCheckbox

  ${NSD_CreateCheckbox} 0 36u 100% 12u "Create a &Start Menu shortcut"
  Pop $StartMenuCheckbox
  ${NSD_Check} $StartMenuCheckbox

  nsDialogs::Show
FunctionEnd

Function ShortcutOptionsPageLeave
  ${NSD_GetState} $DesktopCheckbox   $CreateDesktopShortcut
  ${NSD_GetState} $StartMenuCheckbox $CreateStartMenuShortcut
FunctionEnd
!endif

!macro customInstall
  ; Vars are "" when the page didn't run (silent install / update), so an
  ; unchecked box is the only thing that removes a shortcut.
  ${If} $CreateDesktopShortcut == 0
    WinShell::UninstShortcut "$newDesktopLink"
    Delete "$newDesktopLink"
  ${EndIf}
  ${If} $CreateStartMenuShortcut == 0
    WinShell::UninstShortcut "$newStartMenuLink"
    Delete "$newStartMenuLink"
  ${EndIf}
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend
