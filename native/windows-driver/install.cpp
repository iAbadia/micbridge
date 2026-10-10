// Copyright (c) 2026 Iñaki Abadia. MIT licensed.
#define UNICODE
#define _UNICODE
#include <windows.h>
#include <setupapi.h>
#include <newdev.h>
#include <devguid.h>
#include <cstdio>
#include <cwchar>
#pragma comment(lib, "setupapi.lib")
#pragma comment(lib, "newdev.lib")
#pragma comment(lib, "uuid.lib")
static const wchar_t HardwareId[] = L"ROOT\\Micbridge";
static bool IsOurs(HDEVINFO devices, SP_DEVINFO_DATA* device) {
    wchar_t ids[4096] = {};
    if (!SetupDiGetDeviceRegistryPropertyW(devices, device, SPDRP_HARDWAREID,
        nullptr, reinterpret_cast<PBYTE>(ids), sizeof(ids), nullptr)) return false;
    for (const wchar_t* id = ids; *id; id += wcslen(id) + 1)
        if (_wcsicmp(id, HardwareId) == 0) return true;
    return false;
}
int wmain(int argc, wchar_t** argv) {
    if (argc < 2 || (wcscmp(argv[1], L"install") && wcscmp(argv[1], L"remove"))) {
        fwprintf(stderr, L"Usage: MicbridgeDriverSetup install <absolute INF path> | remove\n"); return 2;
    }
    const bool installing = !wcscmp(argv[1], L"install");
    if (installing && argc != 3) return 2;
    HDEVINFO devices = SetupDiGetClassDevsW(&GUID_DEVCLASS_MEDIA, nullptr, nullptr, DIGCF_PRESENT);
    if (devices == INVALID_HANDLE_VALUE) return 1;
    bool exists = false, failed = false;
    for (DWORD index = 0; ; ++index) {
        SP_DEVINFO_DATA device = {}; device.cbSize = sizeof(device);
        if (!SetupDiEnumDeviceInfo(devices, index, &device)) break;
        if (!IsOurs(devices, &device)) continue;
        exists = true;
        if (!installing && !SetupDiCallClassInstaller(DIF_REMOVE, devices, &device)) failed = true;
    }
    SetupDiDestroyDeviceInfoList(devices);
    if (!installing) return failed ? 1 : 0;
    wchar_t inf[MAX_PATH];
    DWORD length = GetFullPathNameW(argv[2], MAX_PATH, inf, nullptr);
    if (!length || length >= MAX_PATH || GetFileAttributesW(inf) == INVALID_FILE_ATTRIBUTES) return 2;
    HDEVINFO created = INVALID_HANDLE_VALUE;
    SP_DEVINFO_DATA device = {}; device.cbSize = sizeof(device);
    if (!exists) {
        created = SetupDiCreateDeviceInfoList(&GUID_DEVCLASS_MEDIA, nullptr);
        if (created == INVALID_HANDLE_VALUE) return 1;
        // A single stable instance prevents multiple devices sharing the bridge.
        const wchar_t multiId[] = L"ROOT\\Micbridge\0";
        if (!SetupDiCreateDeviceInfoW(created, L"ROOT\\MICBRIDGE\\0000", &GUID_DEVCLASS_MEDIA,
            L"Micbridge Virtual Audio", nullptr, 0, &device)
            || !SetupDiSetDeviceRegistryPropertyW(created, &device, SPDRP_HARDWAREID,
                reinterpret_cast<const BYTE*>(multiId), sizeof(multiId))
            || !SetupDiCallClassInstaller(DIF_REGISTERDEVICE, created, &device)) {
            fwprintf(stderr, L"Device registration failed: %lu\n", GetLastError());
            SetupDiDestroyDeviceInfoList(created); return 1;
        }
    }
    BOOL reboot = FALSE;
    BOOL success = UpdateDriverForPlugAndPlayDevicesW(nullptr, HardwareId, inf, INSTALLFLAG_FORCE, &reboot);
    DWORD error = GetLastError();
    if (created != INVALID_HANDLE_VALUE) {
        if (!success) SetupDiCallClassInstaller(DIF_REMOVE, created, &device);
        SetupDiDestroyDeviceInfoList(created);
    }
    if (!success) { fwprintf(stderr, L"Driver installation failed: %lu\n", error); return 1; }
    return reboot ? 3010 : 0;
}
