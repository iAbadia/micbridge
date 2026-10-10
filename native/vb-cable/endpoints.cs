using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;

// Use Windows' supported endpoint property store; never edit the signed INF.
public static class MicbridgeCableEndpoints {
  [StructLayout(LayoutKind.Sequential)] struct Key {
    public Guid format; public uint id;
    public Key(string guid, uint pid) { format = new Guid(guid); id = pid; }
  }
  [StructLayout(LayoutKind.Explicit, Size = 24)] struct Value {
    [FieldOffset(0)] public ushort type;
    [FieldOffset(8)] public IntPtr text;
  }
  [DllImport("ole32.dll")] static extern int PropVariantClear(ref Value value);
  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class Enumerator {}
  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface Devices {
    [PreserveSig] int EnumAudioEndpoints(int flow, uint state, out Collection collection);
    [PreserveSig] int GetDefaultAudioEndpoint(int flow, int role, out Device device);
    [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out Device device);
    [PreserveSig] int RegisterEndpointNotificationCallback(IntPtr callback);
    [PreserveSig] int UnregisterEndpointNotificationCallback(IntPtr callback);
  }
  [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface Collection {
    [PreserveSig] int GetCount(out uint count);
    [PreserveSig] int Item(uint index, out Device device);
  }
  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface Device {
    [PreserveSig] int Activate(ref Guid iid, uint context, IntPtr parameters, out IntPtr instance);
    [PreserveSig] int OpenPropertyStore(uint access, out Store store);
    [PreserveSig] int GetId(out IntPtr id);
    [PreserveSig] int GetState(out uint state);
  }
  [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface Store {
    [PreserveSig] int GetCount(out uint count);
    [PreserveSig] int GetAt(uint index, out Key key);
    [PreserveSig] int GetValue(ref Key key, out Value value);
    [PreserveSig] int SetValue(ref Key key, ref Value value);
    [PreserveSig] int Commit();
  }
  static string Read(Store store, Key key) {
    Value value;
    Marshal.ThrowExceptionForHR(store.GetValue(ref key, out value));
    try { return value.type == 31 ? Marshal.PtrToStringUni(value.text) : ""; }
    finally { PropVariantClear(ref value); }
  }
  public static int RenameMicrophone() { return Scan(true, new List<string>()); }
  public static int GetBaseMicrophoneCount() { return Scan(false, new List<string>()); }
  public static string[] GetMicrophoneNames() { var names = new List<string>(); Scan(false, names); return names.ToArray(); }
  static int Scan(bool rename, List<string> names) {
    Devices devices = (Devices)new Enumerator();
    Collection collection = null;
    int renamed = 0;
    try {
      Marshal.ThrowExceptionForHR(devices.EnumAudioEndpoints(1, 1, out collection));
      uint count; Marshal.ThrowExceptionForHR(collection.GetCount(out count));
      for (uint index = 0; index < count; index++) {
        Device device = null; Store store = null;
        try {
          Marshal.ThrowExceptionForHR(collection.Item(index, out device));
          Marshal.ThrowExceptionForHR(device.OpenPropertyStore(0, out store));
          string publisher = Read(store, new Key("026e516e-b814-414b-83cd-856d6fef4822", 2));
          Key friendly = new Key("a45c254e-df1c-4efd-8020-67d146a850e0", 14);
          string name = Read(store, friendly);
          if (publisher != "VB-Audio Virtual Cable" || (name.IndexOf("CABLE Output", StringComparison.OrdinalIgnoreCase) < 0
            && name != "Micbridge Microphone (VB-CABLE)")) continue;
          names.Add(name);
          if (!rename) { renamed++; continue; }
          if (name == "Micbridge Microphone (VB-CABLE)") { renamed++; continue; }
          Marshal.ReleaseComObject(store); store = null;
          Marshal.ThrowExceptionForHR(device.OpenPropertyStore(2, out store));
          Value value = new Value { type = 31, text = Marshal.StringToCoTaskMemUni("Micbridge Microphone (VB-CABLE)") };
          try { Marshal.ThrowExceptionForHR(store.SetValue(ref friendly, ref value)); Marshal.ThrowExceptionForHR(store.Commit()); }
          finally { PropVariantClear(ref value); }
          renamed++;
        } finally {
          if (store != null) Marshal.ReleaseComObject(store);
          if (device != null) Marshal.ReleaseComObject(device);
        }
      }
    } finally {
      if (collection != null) Marshal.ReleaseComObject(collection);
      Marshal.ReleaseComObject(devices);
    }
    return renamed;
  }
}
