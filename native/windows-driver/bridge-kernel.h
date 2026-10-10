// Copyright (c) 2026 Iñaki Abadia. MIT licensed.
#pragma once
#include "bridge-buffer.h"
extern MicbridgeBuffer g_MicbridgeBuffer;
extern KSPIN_LOCK g_MicbridgeLock;

inline void MicbridgeReset(bool active) {
    KIRQL previous;
    KeAcquireSpinLock(&g_MicbridgeLock, &previous);
    g_MicbridgeBuffer.Reset(active);
    KeReleaseSpinLock(&g_MicbridgeLock, previous);
}
inline void MicbridgeFlush() {
    KIRQL previous;
    KeAcquireSpinLock(&g_MicbridgeLock, &previous);
    g_MicbridgeBuffer.Reset(g_MicbridgeBuffer.running);
    KeReleaseSpinLock(&g_MicbridgeLock, previous);
}
inline void MicbridgeTransfer(unsigned char* data, ULONG length, bool capture) {
    KIRQL previous;
    KeAcquireSpinLock(&g_MicbridgeLock, &previous);
    if (capture) g_MicbridgeBuffer.Read(data, length);
    else g_MicbridgeBuffer.Write(data, length);
    KeReleaseSpinLock(&g_MicbridgeLock, previous);
}
