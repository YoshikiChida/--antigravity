export interface NotificationSettings {
  enabled: boolean;
  deadlineDay: number;   // 毎月何日が提出期限 (1-31)
  remindDays: number[];  // 何日前に通知 e.g. [7, 3, 1, 0]
  notifyTime: string;    // 通知時刻 "HH:MM" (日本時間)
}

const SETTINGS_KEY = 'yamatoNotifSettings';
const LAST_NOTIFIED_KEY = 'yamatoLastNotifDate';

export const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  deadlineDay: 25,
  remindDays: [7, 3, 1],
  notifyTime: '09:00',
};

export function loadNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

export function saveNotificationSettings(s: NotificationSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

export async function checkAndNotify(settings: NotificationSettings): Promise<void> {
  if (!settings.enabled) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator)) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  if (localStorage.getItem(LAST_NOTIFIED_KEY) === todayStr) return;

  const d = today.getDate();
  const m = today.getMonth();
  const y = today.getFullYear();

  const deadlineDay = settings.deadlineDay;
  const deadline = d <= deadlineDay
    ? new Date(y, m, deadlineDay)
    : new Date(y, m + 1, deadlineDay);
  deadline.setHours(0, 0, 0, 0);

  const daysUntil = Math.round((deadline.getTime() - today.getTime()) / 86400000);
  if (!settings.remindDays.includes(daysUntil)) return;

  // 設定時刻より前なら通知しない
  const [notifyH, notifyM] = (settings.notifyTime || '00:00').split(':').map(Number);
  const nowFull = new Date();
  if (nowFull.getHours() * 60 + nowFull.getMinutes() < notifyH * 60 + notifyM) return;

  const reg = await navigator.serviceWorker.ready;
  const dl = `${deadline.getMonth() + 1}/${deadline.getDate()}`;
  const body =
    daysUntil === 0
      ? `⚠️ 今日が交番提出期限（${dl}）です！アプリを確認してください。`
      : daysUntil === 1
      ? `📅 明日が交番提出期限（${dl}）です。確認をお忘れなく。`
      : `📅 交番提出まであと ${daysUntil} 日です（期限: ${dl}）`;

  await reg.showNotification('交番管理システム', {
    body,
    icon: '/favicon.svg',
    tag: 'deadline-reminder',
    requireInteraction: daysUntil === 0,
  });

  localStorage.setItem(LAST_NOTIFIED_KEY, todayStr);
}
