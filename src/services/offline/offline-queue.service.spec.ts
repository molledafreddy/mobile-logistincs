import { DeliveryRunsService } from '../api/delivery-runs.service';
import { TrackingService } from '../api/tracking.service';
import { ChatService } from '../api/chat.service';
import { ExpensesService } from '../api/expenses.service';

// Must start with "mock" so babel-jest can reference them inside jest.mock factories
const mockData: Record<string, string> = {};

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => mockData[key],
    set: (key: string, val: string) => {
      mockData[key] = val;
    },
    delete: (key: string) => {
      delete mockData[key];
    },
  }),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(),
}));

jest.mock('../api/delivery-runs.service', () => ({
  DeliveryRunsService: { markStopDone: jest.fn(), reportStopIncident: jest.fn() },
}));
jest.mock('../api/tracking.service', () => ({
  TrackingService: { sendLocation: jest.fn(), sendLocationBulk: jest.fn() },
}));
jest.mock('../api/chat.service', () => ({
  ChatService: { sendMessage: jest.fn() },
}));
jest.mock('../api/expenses.service', () => ({
  ExpensesService: { createExpense: jest.fn() },
}));

// Import after mocks are set up
import { OfflineQueue } from './offline-queue.service';

const QUEUE_KEY = 'pending_operations';

function readQueue() {
  const raw = mockData[QUEUE_KEY];
  return raw ? JSON.parse(raw) : [];
}

beforeEach(() => {
  Object.keys(mockData).forEach((k) => delete mockData[k]);
  jest.clearAllMocks();
});

describe('OfflineQueue', () => {
  describe('enqueueStopStatus', () => {
    it('adds a stop_status op to the queue', () => {
      OfflineQueue.enqueueStopStatus({ runId: 'r1', stopId: 's1', status: 'delivered' });
      const queue = readQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0]).toMatchObject({ type: 'stop_status', payload: { runId: 'r1', stopId: 's1', status: 'delivered' }, retries: 0 });
    });
  });

  describe('enqueueMessage', () => {
    it('adds a message op to the queue', () => {
      OfflineQueue.enqueueMessage({ conversationId: 'c1', content: 'hello', tempId: 'tmp-1' });
      const queue = readQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0]).toMatchObject({ type: 'message', payload: { conversationId: 'c1', content: 'hello' } });
    });
  });

  describe('enqueueExpense', () => {
    it('adds an expense op to the queue', () => {
      OfflineQueue.enqueueExpense({ category: 'fuel', amount: 50.0 });
      const queue = readQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0]).toMatchObject({ type: 'expense', payload: { category: 'fuel', amount: 50.0 } });
    });
  });

  describe('enqueueLocation', () => {
    it('caps location ops at MAX_LOCATION_OPS (50)', () => {
      for (let i = 0; i < 55; i++) {
        OfflineQueue.enqueueLocation('r1', { lat: i, lng: 0, timestamp: i });
      }
      const queue = readQueue();
      const locationOps = queue.filter((op: { type: string }) => op.type === 'location_update');
      expect(locationOps.length).toBeLessThanOrEqual(50);
    });
  });

  describe('pendingCount', () => {
    it('returns the total number of queued ops', () => {
      OfflineQueue.enqueueMessage({ conversationId: 'c1', content: 'hi', tempId: 't1' });
      OfflineQueue.enqueueExpense({ category: 'toll', amount: 10 });
      expect(OfflineQueue.pendingCount()).toBe(2);
    });
  });

  describe('pendingMessages', () => {
    it('returns only message ops', () => {
      OfflineQueue.enqueueMessage({ conversationId: 'c1', content: 'hi', tempId: 't1' });
      OfflineQueue.enqueueExpense({ category: 'food', amount: 20 });
      const msgs = OfflineQueue.pendingMessages();
      expect(msgs).toHaveLength(1);
      expect(msgs[0].type).toBe('message');
    });
  });

  describe('flush', () => {
    // ── Non-location ops ──────────────────────────────────────────────────────

    it('calls the correct service for each non-location op type and clears the queue', async () => {
      (DeliveryRunsService.markStopDone as jest.Mock).mockResolvedValue({});
      (ChatService.sendMessage as jest.Mock).mockResolvedValue({});
      (ExpensesService.createExpense as jest.Mock).mockResolvedValue({});

      OfflineQueue.enqueueStopStatus({ runId: 'r1', stopId: 's1', status: 'delivered' });
      OfflineQueue.enqueueMessage({ conversationId: 'c1', content: 'msg', tempId: 't1' });
      OfflineQueue.enqueueExpense({ category: 'fuel', amount: 30 });

      await OfflineQueue.flush();

      expect(DeliveryRunsService.markStopDone).toHaveBeenCalledWith('r1', 's1', expect.objectContaining({ signedBy: undefined }));
      expect(ChatService.sendMessage).toHaveBeenCalledWith('c1', 'msg');
      expect(ExpensesService.createExpense).toHaveBeenCalledWith(expect.objectContaining({ category: 'fuel', amount: 30 }));
      expect(TrackingService.sendLocationBulk).not.toHaveBeenCalled();
      expect(readQueue()).toHaveLength(0);
    });

    it('keeps failed non-location ops with retries incremented', async () => {
      (ChatService.sendMessage as jest.Mock).mockRejectedValue(new Error('network'));

      OfflineQueue.enqueueMessage({ conversationId: 'c1', content: 'fail', tempId: 't1' });
      await OfflineQueue.flush();

      const queue = readQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].retries).toBe(1);
    });

    it('drops non-location ops that exceed MAX_RETRIES (5)', async () => {
      (ChatService.sendMessage as jest.Mock).mockRejectedValue(new Error('network'));

      OfflineQueue.enqueueMessage({ conversationId: 'c1', content: 'fail', tempId: 't1' });

      for (let i = 0; i < 5; i++) {
        await OfflineQueue.flush();
      }
      expect(readQueue()).toHaveLength(0);
    });

    it('does nothing when queue is empty', async () => {
      await OfflineQueue.flush();
      expect(ChatService.sendMessage).not.toHaveBeenCalled();
      expect(TrackingService.sendLocationBulk).not.toHaveBeenCalled();
    });

    // ── Location bulk ops ─────────────────────────────────────────────────────

    it('sends all location ops in a single sendLocationBulk call', async () => {
      (TrackingService.sendLocationBulk as jest.Mock).mockResolvedValue(undefined);

      OfflineQueue.enqueueLocation('r1', { lat: 1, lng: 2, timestamp: 1000 });
      OfflineQueue.enqueueLocation('r1', { lat: 3, lng: 4, timestamp: 2000 });
      OfflineQueue.enqueueLocation('r2', { lat: 5, lng: 6, timestamp: 3000 });

      await OfflineQueue.flush();

      expect(TrackingService.sendLocationBulk).toHaveBeenCalledTimes(1);
      const [points] = (TrackingService.sendLocationBulk as jest.Mock).mock.calls[0];
      expect(points).toHaveLength(3);
      expect(points[0]).toMatchObject({ lat: 1, lng: 2 });
      expect(points[1]).toMatchObject({ lat: 3, lng: 4 });
      expect(points[2]).toMatchObject({ lat: 5, lng: 6 });
      expect(readQueue()).toHaveLength(0);
    });

    it('does not include runId in the bulk payload', async () => {
      (TrackingService.sendLocationBulk as jest.Mock).mockResolvedValue(undefined);

      OfflineQueue.enqueueLocation('run-xyz', { lat: 10, lng: 20, timestamp: 1000 });

      await OfflineQueue.flush();

      const [points] = (TrackingService.sendLocationBulk as jest.Mock).mock.calls[0];
      expect(points[0]).not.toHaveProperty('runId');
    });

    it('does not call sendLocation (individual) for location ops', async () => {
      (TrackingService.sendLocationBulk as jest.Mock).mockResolvedValue(undefined);

      OfflineQueue.enqueueLocation('r1', { lat: 1, lng: 2, timestamp: 1000 });

      await OfflineQueue.flush();

      expect(TrackingService.sendLocation).not.toHaveBeenCalled();
    });

    it('re-queues all location ops if the bulk call fails', async () => {
      (TrackingService.sendLocationBulk as jest.Mock).mockRejectedValue(new Error('network'));

      OfflineQueue.enqueueLocation('r1', { lat: 1, lng: 2, timestamp: 1000 });
      OfflineQueue.enqueueLocation('r1', { lat: 3, lng: 4, timestamp: 2000 });

      await OfflineQueue.flush();

      const queue = readQueue();
      expect(queue).toHaveLength(2);
      expect(queue[0].retries).toBe(1);
      expect(queue[1].retries).toBe(1);
    });

    it('drops all location ops after MAX_RETRIES bulk failures', async () => {
      (TrackingService.sendLocationBulk as jest.Mock).mockRejectedValue(new Error('network'));

      OfflineQueue.enqueueLocation('r1', { lat: 1, lng: 2, timestamp: 1000 });
      OfflineQueue.enqueueLocation('r1', { lat: 3, lng: 4, timestamp: 2000 });

      for (let i = 0; i < 5; i++) {
        await OfflineQueue.flush();
      }
      expect(readQueue()).toHaveLength(0);
    });

    it('processes location and non-location ops independently in the same flush', async () => {
      (ChatService.sendMessage as jest.Mock).mockResolvedValue({});
      (TrackingService.sendLocationBulk as jest.Mock).mockResolvedValue(undefined);

      OfflineQueue.enqueueMessage({ conversationId: 'c1', content: 'hi', tempId: 't1' });
      OfflineQueue.enqueueLocation('r1', { lat: 7, lng: 8, timestamp: 5000 });

      await OfflineQueue.flush();

      expect(ChatService.sendMessage).toHaveBeenCalledWith('c1', 'hi');
      expect(TrackingService.sendLocationBulk).toHaveBeenCalledTimes(1);
      expect(readQueue()).toHaveLength(0);
    });

    it('location failure does not prevent non-location ops from flushing', async () => {
      (TrackingService.sendLocationBulk as jest.Mock).mockRejectedValue(new Error('network'));
      (ChatService.sendMessage as jest.Mock).mockResolvedValue({});

      OfflineQueue.enqueueMessage({ conversationId: 'c1', content: 'hi', tempId: 't1' });
      OfflineQueue.enqueueLocation('r1', { lat: 1, lng: 2, timestamp: 1000 });

      await OfflineQueue.flush();

      expect(ChatService.sendMessage).toHaveBeenCalledWith('c1', 'hi');
      const queue = readQueue();
      // message succeeded, location failed → only location op remains
      expect(queue).toHaveLength(1);
      expect(queue[0].type).toBe('location_update');
      expect(queue[0].retries).toBe(1);
    });
  });
});
