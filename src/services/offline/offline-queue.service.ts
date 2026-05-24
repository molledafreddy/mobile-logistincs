import { NetInfoService as NetInfo } from '../netinfo';
import { DeliveryRunsService } from '../api/delivery-runs.service';
import { TrackingService } from '../api/tracking.service';
import { ChatService } from '../api/chat.service';
import { ExpensesService } from '../api/expenses.service';
import type { LocationUpdate, ExpenseCategory } from '../../types';

const _map = new Map<string, string>();
const store = {
  set: (key: string, value: string) => _map.set(key, value),
  getString: (key: string) => _map.get(key),
};
const QUEUE_KEY = 'pending_operations';

type OpType = 'stop_status' | 'location_update' | 'message' | 'expense';

interface BaseOp {
  id: string;
  type: OpType;
  createdAt: number;
  retries: number;
}

interface StopStatusOp extends BaseOp {
  type: 'stop_status';
  payload: {
    runId: string;
    stopId: string;
    status: 'delivered' | 'failed';
    receiverName?: string;
    notes?: string;
    reason?: string;
  };
}

interface LocationOp extends BaseOp {
  type: 'location_update';
  payload: { runId: string } & LocationUpdate;
}

interface MessageOp extends BaseOp {
  type: 'message';
  payload: {
    conversationId: string;
    content: string;
    tempId: string;
  };
}

interface ExpenseOp extends BaseOp {
  type: 'expense';
  payload: {
    category: ExpenseCategory;
    amount: string;
    description: string;
    expenseDate: string;
    currency?: string;
  };
}

type QueuedOp = StopStatusOp | LocationOp | MessageOp | ExpenseOp;

const MAX_RETRIES = 5;
const MAX_LOCATION_OPS = 50;

// ─── Serialization ───────────────────────────────────────────────────────────

function readQueue(): QueuedOp[] {
  try {
    const raw = store.getString(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedOp[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(ops: QueuedOp[]): void {
  store.set(QUEUE_KEY, JSON.stringify(ops));
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const OfflineQueue = {
  enqueueStopStatus(payload: StopStatusOp['payload']): void {
    const queue = readQueue();
    queue.push({ id: `stop-${Date.now()}`, type: 'stop_status', payload, createdAt: Date.now(), retries: 0 });
    writeQueue(queue);
  },

  enqueueLocation(runId: string, location: LocationUpdate): void {
    let queue = readQueue();
    const locationOps = queue.filter((op) => op.type === 'location_update');
    if (locationOps.length >= MAX_LOCATION_OPS) {
      const nonLocationOps = queue.filter((op) => op.type !== 'location_update') as QueuedOp[];
      queue = nonLocationOps.concat(locationOps.slice(-MAX_LOCATION_OPS + 1));
    }
    queue.push({ id: `loc-${Date.now()}`, type: 'location_update', payload: { runId, ...location }, createdAt: Date.now(), retries: 0 });
    writeQueue(queue);
  },

  enqueueMessage(payload: MessageOp['payload']): void {
    const queue = readQueue();
    queue.push({ id: `msg-${Date.now()}`, type: 'message', payload, createdAt: Date.now(), retries: 0 });
    writeQueue(queue);
  },

  enqueueExpense(payload: ExpenseOp['payload']): void {
    const queue = readQueue();
    queue.push({ id: `exp-${Date.now()}`, type: 'expense', payload, createdAt: Date.now(), retries: 0 });
    writeQueue(queue);
  },

  pendingCount(): number {
    return readQueue().length;
  },

  pendingMessages(): MessageOp[] {
    return readQueue().filter((op): op is MessageOp => op.type === 'message');
  },

  async flush(): Promise<void> {
    const queue = readQueue();
    if (!queue.length) return;

    const failed: QueuedOp[] = [];

    // Separate location ops so they can be flushed in a single bulk call
    const locationOps = queue.filter((op): op is LocationOp => op.type === 'location_update');
    const otherOps = queue.filter((op): op is Exclude<QueuedOp, LocationOp> => op.type !== 'location_update');

    // ── Non-location ops (one request each) ──────────────────────────────────
    for (const op of otherOps) {
      try {
        if (op.type === 'stop_status') {
          const { runId, stopId, status, receiverName, notes, reason } = op.payload;
          if (status === 'delivered') {
            await DeliveryRunsService.markStopDone(runId, stopId, { signedBy: receiverName, notes });
          } else {
            await DeliveryRunsService.reportStopIncident(runId, stopId, { reason: reason ?? notes ?? 'Entrega fallida' });
          }
        } else if (op.type === 'message') {
          const { conversationId, content } = op.payload;
          await ChatService.sendMessage(conversationId, content);
        } else if (op.type === 'expense') {
          await ExpensesService.createExpense(op.payload);
        }
      } catch {
        const updated = { ...op, retries: op.retries + 1 };
        if (updated.retries < MAX_RETRIES) failed.push(updated);
      }
    }

    // ── Location ops (single bulk request) ───────────────────────────────────
    if (locationOps.length > 0) {
      try {
        const locations = locationOps.map(({ payload }) => {
          const { runId: _runId, ...loc } = payload;
          return loc;
        });
        await TrackingService.sendLocationBulk(locations);
      } catch {
        // If the bulk call fails, re-queue all location ops
        for (const op of locationOps) {
          const updated = { ...op, retries: op.retries + 1 };
          if (updated.retries < MAX_RETRIES) failed.push(updated);
        }
      }
    }

    writeQueue(failed);
  },

  startAutoSync(): () => void {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        this.flush();
      }
    });
    return unsubscribe;
  },
};
