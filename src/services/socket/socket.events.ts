export enum SocketEvent {
  // Tracking
  LOCATION_UPDATE = 'tracking:location_update',
  STATUS_CHANGE = 'tracking:status_change',

  // Chat
  NEW_MESSAGE = 'chat:new_message',
  MESSAGE_READ = 'chat:message_read',
  USER_ONLINE = 'chat:user_online',
  USER_OFFLINE = 'chat:user_offline',

  // Runs
  RUN_ASSIGNED = 'run:assigned',
  RUN_UPDATED = 'run:updated',

  // Notifications
  NOTIFICATION = 'notification:new',
}
