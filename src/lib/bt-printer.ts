const PRINTER_SERVICE_UUIDS = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "00001101-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];

const PRINTER_CHAR_UUIDS = [
  "00002af1-0000-1000-8000-00805f9b34fb",
  "0000fee9-0000-1000-8000-00805f9b34fb",
  "49535343-1e4d-4bd9-ba61-23c647249616",
];

let btDevice: BluetoothDevice | null = null;
let btCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
let statusCallback: ((connected: boolean, name: string) => void) | null = null;
let logCallback: ((msg: string) => void) | null = null;

export function setBtCallbacks(opts: {
  onStatus?: (connected: boolean, name: string) => void;
  onLog?: (msg: string) => void;
}) {
  statusCallback = opts.onStatus || null;
  logCallback = opts.onLog || null;
}

function btLog(msg: string) {
  console.log("[BT]", msg);
  logCallback?.(msg);
}

function notifyStatus(connected: boolean, name: string) {
  statusCallback?.(connected, name);
}

export function isBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

export function isPrinterConnected(): boolean {
  return !!btCharacteristic;
}

export function getPrinterName(): string {
  return btDevice?.name || "Thermal Printer";
}

export async function connectPrinter(): Promise<boolean> {
  if (!navigator.bluetooth) {
    btLog("Web Bluetooth not supported");
    return false;
  }

  try {
    btDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: PRINTER_SERVICE_UUIDS,
    });
  } catch (e: unknown) {
    const err = e as Error;
    btLog("Device selection cancelled: " + err.message);
    return false;
  }

  btLog("Connecting...");

  let server: BluetoothRemoteGATTServer | null = null;
  for (let i = 1; i <= 3; i++) {
    try {
      if (i > 1) await new Promise((r) => setTimeout(r, 1200));
      server = await btDevice.gatt!.connect();
      btLog("GATT connected attempt " + i);
      break;
    } catch (e: unknown) {
      const err = e as Error;
      btLog("GATT attempt " + i + " failed: " + err.message);
      if (i === 3) {
        btLog("Cannot connect after 3 attempts");
        return false;
      }
    }
  }

  if (!server) return false;

  let allServices: BluetoothRemoteGATTService[] = [];
  try {
    allServices = await server.getPrimaryServices();
    btLog("Found " + allServices.length + " services");
  } catch {
    /* Primary services fetch fallback */
  }

  let service: BluetoothRemoteGATTService | null = null;
  for (const uuid of PRINTER_SERVICE_UUIDS) {
    try {
      service = await server.getPrimaryService(uuid);
      btLog("Service: " + uuid);
      break;
    } catch {
      /* Try next UUID */
    }
  }

  if (!service && allServices.length > 0) {
    service = allServices[0];
    btLog("Using first service: " + service.uuid);
  }

  if (!service) {
    btLog("No printer service found");
    return false;
  }

  let chars: BluetoothRemoteGATTCharacteristic[] = [];
  try {
    chars = await service.getCharacteristics();
  } catch {
    for (const uuid of PRINTER_CHAR_UUIDS) {
      try {
        const c = await service.getCharacteristic(uuid);
        chars.push(c);
        break;
      } catch {
        /* Try next characteristic */
      }
    }
  }

  btCharacteristic = null;
  for (const tx of PRINTER_CHAR_UUIDS) {
    const f = chars.find((c) => c.uuid === tx);
    if (f && (f.properties.write || f.properties.writeWithoutResponse)) {
      btCharacteristic = f;
      break;
    }
  }

  if (!btCharacteristic) {
    btCharacteristic =
      chars.find((c) => c.properties.write || c.properties.writeWithoutResponse) || null;
  }

  if (!btCharacteristic) {
    btLog("No writable channel found");
    return false;
  }

  const name = btDevice.name || "Thermal Printer";
  btLog("Connected: " + name);
  notifyStatus(true, name);

  btDevice.addEventListener("gattserverdisconnected", () => {
    btLog("Disconnected");
    btCharacteristic = null;
    btDevice = null;
    notifyStatus(false, "");
  });

  return true;
}

export function disconnectPrinter() {
  if (btDevice?.gatt?.connected) {
    btDevice.gatt.disconnect();
  }
  btCharacteristic = null;
  btDevice = null;
  notifyStatus(false, "");
  btLog("Disconnected");
}

// ESC/POS helpers
function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function centerText(text: string, width: number): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(pad) + text;
}

function lineChar(width: number, char = "-"): string {
  return char.repeat(width);
}

async function sendBytes(data: Uint8Array) {
  if (!btCharacteristic) throw new Error("Printer not connected");
  const chunkSize = 200;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    try {
      await btCharacteristic.writeValueWithoutResponse(chunk);
    } catch (e) {
      try {
        await btCharacteristic.writeValueWithResponse(chunk);
      } catch (e2) {
        throw new Error("Write failed: " + (e2 as Error).message);
      }
    }
    if (i + chunkSize < data.length) {
      await new Promise((r) => setTimeout(r, 20));
    }
  }
}

export interface ReceiptItem {
  name: string;
  unit: string;
  price: number;
  quantity: number;
}

export interface ReceiptData {
  orderNumber: string;
  customerName: string;
  flatNo: string;
  phone: string;
  altPhone?: string | null;
  communityName: string;
  blockName: string;
  packingNote?: string | null;
  items: ReceiptItem[];
  total: number;
  date?: string;
}

export async function printReceipt(receipt: ReceiptData): Promise<boolean> {
  if (!btCharacteristic) {
    btLog("No printer connected");
    return false;
  }

  const W = 32;
  const lines: string[] = [];
  const nl = () => lines.push("");
  const hr = () => lines.push(lineChar(W));
  const hrD = () => lines.push(lineChar(W, "="));

  lines.push(centerText("MANAPALLE MUTTON", W));
  nl();
  lines.push(centerText(receipt.date || new Date().toLocaleString(), W));
  lines.push(centerText("Call: 9030 90 1233", W));
  nl();
  hr();

  lines.push(receipt.customerName + "  " + receipt.orderNumber);
  lines.push("Flat: " + (receipt.flatNo || "-") + " | " + receipt.phone);
  lines.push(receipt.communityName + " / " + receipt.blockName);
  if (receipt.packingNote) {
    lines.push("Note: " + receipt.packingNote);
  }
  hr();

  const lineTotals: number[] = [];
  for (const it of receipt.items) {
    const amt = Math.round(Number(it.price) * Number(it.quantity));
    lineTotals.push(amt);
    const lhs = it.name + " " + it.unit;
    const amtStr = String(amt);
    const pad = W - lhs.length - amtStr.length;
    lines.push(lhs + " ".repeat(Math.max(1, pad)) + amtStr);
  }

  hr();
  const computedTotal = lineTotals.reduce((s, v) => s + v, 0);
  const totalStr = "TOTAL";
  const totalAmt = "Rs." + computedTotal;
  const tPad = W - totalStr.length - totalAmt.length;
  lines.push(totalStr + " ".repeat(Math.max(1, tPad)) + totalAmt);
  hr();
  nl();
  lines.push(centerText("Thank you! Visit again", W));
  nl();
  nl();
  nl();

  try {
    const ESC_INIT = new Uint8Array([0x1b, 0x40]);
    const ESC_CENTER = new Uint8Array([0x1b, 0x61, 0x01]);
    const ESC_LEFT = new Uint8Array([0x1b, 0x61, 0x00]);
    const LF = new Uint8Array([0x0a]);
    const CUT = new Uint8Array([0x1d, 0x56, 0x00]);

    const parts: Uint8Array[] = [ESC_INIT, ESC_CENTER];

    for (const line of lines) {
      if (line === "") {
        parts.push(LF);
      } else {
        parts.push(ESC_LEFT);
        parts.push(textToBytes(line));
        parts.push(LF);
      }
    }

    parts.push(CUT);

    let totalLen = 0;
    for (const p of parts) totalLen += p.length;
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const p of parts) {
      merged.set(p, offset);
      offset += p.length;
    }

    await sendBytes(merged);
    btLog("Receipt sent!");
    return true;
  } catch (e: unknown) {
    const err = e as Error;
    btLog("Print error: " + err.message);
    return false;
  }
}
