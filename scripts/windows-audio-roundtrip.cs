using System;
using System.Runtime.InteropServices;
using System.Threading;

// Disposable-runner integration check: a real PCM tone must cross the installed
// driver's playback/recording endpoints. Never opens a default/physical device.
public static class CableRoundtrip {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] struct Caps {
    public ushort manufacturer, product; public uint version;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string name;
    public uint formats; public ushort channels, reserved;
    public uint support; // waveInGetDevCaps writes the common prefix only.
  }
  [StructLayout(LayoutKind.Sequential, Pack = 2)] struct Format {
    public ushort format, channels; public uint rate, bytes;
    public ushort block, bits, extra;
  }
  [StructLayout(LayoutKind.Sequential)] struct Header {
    public IntPtr data; public uint length, recorded; public UIntPtr user;
    public uint flags, loops; public IntPtr next; public UIntPtr reserved;
  }
  [DllImport("winmm.dll")] static extern uint waveOutGetNumDevs();
  [DllImport("winmm.dll")] static extern uint waveInGetNumDevs();
  [DllImport("winmm.dll", CharSet = CharSet.Unicode)] static extern uint waveOutGetDevCapsW(UIntPtr id, out Caps caps, uint size);
  [DllImport("winmm.dll", CharSet = CharSet.Unicode)] static extern uint waveInGetDevCapsW(UIntPtr id, out Caps caps, uint size);
  [DllImport("winmm.dll")] static extern uint waveOutOpen(out IntPtr handle, uint id, ref Format format, IntPtr callback, IntPtr instance, uint flags);
  [DllImport("winmm.dll")] static extern uint waveInOpen(out IntPtr handle, uint id, ref Format format, IntPtr callback, IntPtr instance, uint flags);
  [DllImport("winmm.dll")] static extern uint waveOutPrepareHeader(IntPtr handle, IntPtr header, uint size);
  [DllImport("winmm.dll")] static extern uint waveInPrepareHeader(IntPtr handle, IntPtr header, uint size);
  [DllImport("winmm.dll")] static extern uint waveOutUnprepareHeader(IntPtr handle, IntPtr header, uint size);
  [DllImport("winmm.dll")] static extern uint waveInUnprepareHeader(IntPtr handle, IntPtr header, uint size);
  [DllImport("winmm.dll")] static extern uint waveOutWrite(IntPtr handle, IntPtr header, uint size);
  [DllImport("winmm.dll")] static extern uint waveInAddBuffer(IntPtr handle, IntPtr header, uint size);
  [DllImport("winmm.dll")] static extern uint waveInStart(IntPtr handle);
  [DllImport("winmm.dll")] static extern uint waveOutReset(IntPtr handle);
  [DllImport("winmm.dll")] static extern uint waveInReset(IntPtr handle);
  [DllImport("winmm.dll")] static extern uint waveOutClose(IntPtr handle);
  [DllImport("winmm.dll")] static extern uint waveInClose(IntPtr handle);
  static void Check(uint result, string operation) { if (result != 0) throw new Exception(operation + " failed: " + result); }
  static uint Find(bool input) {
    for (uint index = 0; index < (input ? waveInGetNumDevs() : waveOutGetNumDevs()); index++) {
      Caps caps;
      uint result = input ? waveInGetDevCapsW(new UIntPtr(index), out caps, 80)
        : waveOutGetDevCapsW(new UIntPtr(index), out caps, 84);
      if (result == 0 && caps.name != null && caps.name.StartsWith(input ? "Micbridge Microphone" : "CABLE Input", StringComparison.OrdinalIgnoreCase)) return index;
    }
    throw new Exception("Expected VB-CABLE " + (input ? "recording" : "playback") + " endpoint not found; refusing default-device fallback.");
  }
  public static string Run() {
    var format = new Format { format = 1, channels = 2, rate = 48000, bytes = 192000, block = 4, bits = 16 };
    IntPtr input = IntPtr.Zero, output = IntPtr.Zero;
    uint size = (uint)Marshal.SizeOf(typeof(Header));
    var tone = new short[96000];
    for (int index = 0; index < tone.Length / 2; index++) tone[index * 2] = tone[index * 2 + 1] = (short)(12000 * Math.Sin(2 * Math.PI * 1000 * index / 48000));
    IntPtr source = Marshal.AllocHGlobal(tone.Length * 2), destination = Marshal.AllocHGlobal(48000 * 12);
    IntPtr inHeader = Marshal.AllocHGlobal((int)size), outHeader = Marshal.AllocHGlobal((int)size);
    bool inPrepared = false, outPrepared = false;
    try {
      Marshal.Copy(tone, 0, source, tone.Length);
      Marshal.StructureToPtr(new Header { data = destination, length = 48000 * 12 }, inHeader, false);
      Marshal.StructureToPtr(new Header { data = source, length = (uint)(tone.Length * 2) }, outHeader, false);
      Check(waveInOpen(out input, Find(true), ref format, IntPtr.Zero, IntPtr.Zero, 0), "Capture open");
      Check(waveOutOpen(out output, Find(false), ref format, IntPtr.Zero, IntPtr.Zero, 0), "Playback open");
      Check(waveInPrepareHeader(input, inHeader, size), "Capture prepare"); inPrepared = true;
      Check(waveOutPrepareHeader(output, outHeader, size), "Playback prepare"); outPrepared = true;
      Check(waveInAddBuffer(input, inHeader, size), "Capture queue");
      Check(waveInStart(input), "Capture start");
      Thread.Sleep(100);
      Check(waveOutWrite(output, outHeader, size), "Tone playback");
      Thread.Sleep(3500);
      Check(waveInReset(input), "Capture finish");
      var header = (Header)Marshal.PtrToStructure(inHeader, typeof(Header));
      if (header.recorded < 192000) throw new Exception("Capture returned insufficient audio: " + header.recorded);
      var captured = new short[header.recorded / 2];
      Marshal.Copy(destination, captured, 0, captured.Length);
      double energy = 0; int peak = 0, crossings = 0, nonzero = 0; bool negative = false;
      // Measure one stereo channel with hysteresis. Resampling can create tiny
      // +/-1 samples around silence; those are not actual 1 kHz signal cycles.
      for (int index = 0; index < captured.Length; index += 2) {
        int sample = captured[index]; energy += (double)sample * sample;
        peak = Math.Max(peak, Math.Abs(sample));
        if (Math.Abs(sample) > 100) nonzero++;
        if (sample < -2000) negative = true;
        if (negative && sample > 2000) { crossings++; negative = false; }
      }
      double rms = Math.Sqrt(energy / (captured.Length / 2)) / 32768;
      if (rms < 0.08 || peak < 8000 || nonzero < 30000 || crossings < 800 || crossings > 1300)
        throw new Exception("PCM roundtrip did not preserve the expected tone: RMS=" + rms + ", peak=" + peak + ", crossings=" + crossings);
      return "VB-CABLE PCM roundtrip passed: 48 kHz stereo, RMS=" + rms.ToString("F3") + ", peak=" + peak + ", 1 kHz cycles=" + crossings;
    } finally {
      if (input != IntPtr.Zero) { waveInReset(input); if (inPrepared) waveInUnprepareHeader(input, inHeader, size); waveInClose(input); }
      if (output != IntPtr.Zero) { waveOutReset(output); if (outPrepared) waveOutUnprepareHeader(output, outHeader, size); waveOutClose(output); }
      Marshal.FreeHGlobal(source); Marshal.FreeHGlobal(destination); Marshal.FreeHGlobal(inHeader); Marshal.FreeHGlobal(outHeader);
    }
  }
}
