import { getApiAuthToken, getApiBaseUrl } from "@/api/client";

export type RealtimeContext = {
  patientId?: string;
  page?: string;
};

export type RealtimeEvent<TPayload = unknown> = {
  id: string;
  entity: string;
  action: string;
  resourceId: string;
  patientId?: string;
  pages: string[];
  payload: TPayload;
};

export type RealtimeMessage =
  | {
      type: "connected";
      accountId: number;
    }
  | {
      type: "contextUpdated";
      context: RealtimeContext;
    }
  | {
      type: "event";
      event: RealtimeEvent;
    }
  | {
      type: "pong";
    };

type RealtimeListener = (event: RealtimeEvent) => void;

let socket: WebSocket | null = null;
let reconnectTimeout: number | undefined;
let reconnectEnabled = false;
let context: RealtimeContext = {};
const listeners = new Set<RealtimeListener>();

export function connectRealtime() {
  reconnectEnabled = true;

  if (
    socket &&
    (socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING)
  ) {
    return socket;
  }

  const token = getApiAuthToken();

  if (!token) {
    return null;
  }

  socket = new WebSocket(buildRealtimeUrl(token));

  socket.addEventListener("open", () => {
    sendRealtimeContext();
  });

  socket.addEventListener("message", (message) => {
    const parsed = parseRealtimeMessage(message.data);

    if (parsed?.type !== "event") {
      return;
    }

    for (const listener of listeners) {
      listener(parsed.event);
    }
  });

  socket.addEventListener("close", () => {
    socket = null;
    if (reconnectEnabled) {
      scheduleRealtimeReconnect();
    }
  });

  socket.addEventListener("error", () => {
    socket?.close();
  });

  return socket;
}

export function disconnectRealtime() {
  reconnectEnabled = false;

  if (reconnectTimeout !== undefined) {
    window.clearTimeout(reconnectTimeout);
    reconnectTimeout = undefined;
  }

  socket?.close();
  socket = null;
}

export function setRealtimeContext(nextContext: RealtimeContext) {
  context = nextContext;
  sendRealtimeContext();
}

export function subscribeRealtime(listener: RealtimeListener) {
  listeners.add(listener);
  connectRealtime();

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      disconnectRealtime();
    }
  };
}

function scheduleRealtimeReconnect() {
  if (listeners.size === 0 || reconnectTimeout !== undefined) {
    return;
  }

  reconnectTimeout = window.setTimeout(() => {
    reconnectTimeout = undefined;
    connectRealtime();
  }, 1000);
}

function sendRealtimeContext() {
  if (socket?.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(
    JSON.stringify({
      type: "setContext",
      patientId: context.patientId,
      page: context.page,
    }),
  );
}

function parseRealtimeMessage(data: unknown): RealtimeMessage | null {
  if (typeof data !== "string") {
    return null;
  }

  try {
    return JSON.parse(data) as RealtimeMessage;
  } catch {
    return null;
  }
}

function buildRealtimeUrl(token: string) {
  const baseUrl = getApiBaseUrl();

  if (!baseUrl) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/realtime/ws?token=${encodeURIComponent(token)}`;
  }

  const websocketUrl = baseUrl.replace(/^http/, "ws");
  return `${websocketUrl}/realtime/ws?token=${encodeURIComponent(token)}`;
}
