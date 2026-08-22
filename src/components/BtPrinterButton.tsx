import { useEffect, useState } from "react";
import { Bluetooth, BluetoothOff, Loader2, X } from "lucide-react";
import {
  isBluetoothSupported,
  isPrinterConnected,
  connectPrinter,
  disconnectPrinter,
  setBtCallbacks,
} from "@/lib/bt-printer";

export function BtPrinterButton() {
  const [supported, setSupported] = useState(false);
  const [connected, setConnected] = useState(false);
  const [printerName, setPrinterName] = useState("");
  const [scanning, setScanning] = useState(false);
  const [log, setLog] = useState("");
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    setSupported(isBluetoothSupported());
  }, []);

  useEffect(() => {
    setBtCallbacks({
      onStatus: (isConnected, name) => {
        setConnected(isConnected);
        setPrinterName(name);
        setScanning(false);
      },
      onLog: (msg) => {
        setLog(msg);
      },
    });
  }, []);

  const handleConnect = async () => {
    setScanning(true);
    setLog("Scanning...");
    await connectPrinter();
    setScanning(false);
  };

  const handleDisconnect = () => {
    disconnectPrinter();
    setConnected(false);
    setPrinterName("");
  };

  if (!supported) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 no-print">
      {showLog && log && (
        <div className="mb-2 rounded-lg border bg-card p-3 text-xs shadow-lg max-w-[260px]">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-medium">Printer Log</span>
            <button onClick={() => setShowLog(false)} className="text-muted-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
          <p className="text-muted-foreground break-all">{log}</p>
        </div>
      )}

      {connected ? (
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => setShowLog(!showLog)}
            className="text-xs text-muted-foreground hover:underline"
          >
            {printerName}
          </button>
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-2 rounded-full border bg-card px-4 py-2.5 text-sm font-medium shadow-lg hover:opacity-90"
          >
            <Bluetooth className="h-4 w-4 text-green-500" />
            Connected
          </button>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          disabled={scanning}
          className="flex items-center gap-2 rounded-full border bg-card px-4 py-2.5 text-sm font-medium shadow-lg hover:opacity-90 disabled:opacity-60"
        >
          {scanning ? (
            <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
          ) : (
            <BluetoothOff className="h-4 w-4 text-muted-foreground" />
          )}
          {scanning ? "Scanning..." : "Connect Printer"}
        </button>
      )}
    </div>
  );
}
