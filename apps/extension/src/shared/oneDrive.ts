/** Public application configuration. Never put OAuth secrets or tokens here. */
export const ONEDRIVE_CLIENT_ID = '5ec63453-0f1c-418e-b29b-4f47ea912f4b';
export const ONEDRIVE_ORIGINS = [
  'https://login.microsoftonline.com/*',
  'https://graph.microsoft.com/*',
];
export const ONEDRIVE_SYNC_KEY = 'tn_onedrive_sync';
export const ONEDRIVE_REMOTE_APPLY_KEY = 'tn_onedrive_remote_apply';
export const ONEDRIVE_AUTO_ALARM = 'tn_onedrive_auto';
export const ONEDRIVE_PERIODIC_ALARM = 'tn_onedrive_periodic';

export interface OneDriveState {
  enabled: boolean;
  status: 'disconnected' | 'syncing' | 'ok' | 'error' | 'reconnect';
  deviceId?: string;
  driveId?: string;
  lastSyncedAt?: number;
  lastError?: string;
  tombstones?: import('@tabnotes/shared').SyncTombstone[];
}

export interface OneDriveStatus extends Omit<OneDriveState, 'tombstones'> {
  connected: boolean;
  permissionsGranted: boolean;
  supportedIdentity: boolean;
  googleEnabled: boolean;
}
