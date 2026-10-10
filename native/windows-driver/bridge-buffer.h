// Copyright (c) 2026 Iñaki Abadia. MIT licensed.
#pragma once

// Callers serialize access. Frames are 48 kHz stereo PCM16 (four bytes).
// No allocation, CRT calls, or floating point in the kernel streaming path.
struct MicbridgeBuffer {
    static constexpr unsigned Capacity = 4800; // bounded to 100 ms
    unsigned frames[Capacity] = {};
    unsigned head = 0, count = 0;
    bool running = false;

    void Reset(bool active) { head = count = 0; running = active; }
    void Write(const unsigned char* bytes, unsigned length) {
        if (!running) return;
        for (unsigned i = 0; i + 3 < length; i += 4) {
            if (count == Capacity) { head = (head + 1) % Capacity; --count; }
            unsigned tail = (head + count) % Capacity;
            frames[tail] = unsigned(bytes[i]) | (unsigned(bytes[i + 1]) << 8)
                | (unsigned(bytes[i + 2]) << 16) | (unsigned(bytes[i + 3]) << 24);
            ++count;
        }
    }
    void Read(unsigned char* bytes, unsigned length) {
        unsigned i = 0;
        for (; i + 3 < length; i += 4) {
            unsigned value = 0;
            if (running && count) { value = frames[head]; head = (head + 1) % Capacity; --count; }
            bytes[i] = static_cast<unsigned char>(value);
            bytes[i + 1] = static_cast<unsigned char>(value >> 8);
            bytes[i + 2] = static_cast<unsigned char>(value >> 16);
            bytes[i + 3] = static_cast<unsigned char>(value >> 24);
        }
        for (; i < length; ++i) bytes[i] = 0;
    }
};
