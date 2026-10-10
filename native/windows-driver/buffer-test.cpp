#include "bridge-buffer.h"
#include <cassert>
#include <vector>
int main() {
    MicbridgeBuffer queue;
    unsigned char input[] = {1,2,3,4,5,6,7,8}, output[12];
    queue.Read(output, 12);
    for (auto value : output) assert(value == 0);
    queue.Reset(true); queue.Write(input, 8); queue.Read(output, 12);
    for (unsigned i = 0; i < 8; ++i) assert(output[i] == input[i]);
    for (unsigned i = 8; i < 12; ++i) assert(output[i] == 0);
    // Overflow keeps the newest frames; wraparound preserves frame order.
    std::vector<unsigned char> many((MicbridgeBuffer::Capacity + 1) * 4, 0);
    many[4] = 42; many[many.size() - 4] = 99;
    queue.Write(many.data(), static_cast<unsigned>(many.size()));
    assert(queue.count == MicbridgeBuffer::Capacity);
    queue.Read(output, 4); assert(output[0] == 42);
    std::vector<unsigned char> rest((MicbridgeBuffer::Capacity - 1) * 4);
    queue.Read(rest.data(), static_cast<unsigned>(rest.size()));
    assert(rest[rest.size() - 4] == 99); assert(queue.count == 0);
    queue.Write(input, 8); queue.Reset(false); queue.Read(output, 12);
    for (auto value : output) assert(value == 0);
    queue.Write(input, 8); assert(queue.count == 0);
    queue.Reset(true); queue.Write(input, 3); assert(queue.count == 0);
}
