import { REMINDER_ALERT_DURATION_MS } from '../shared/reminders';

type ReminderAudioMessage =
  | { target: 'tabnotes-reminder-audio'; type: 'START_REMINDER_AUDIO'; durationMs?: number }
  | { target: 'tabnotes-reminder-audio'; type: 'STOP_REMINDER_AUDIO' };

let audioContext: AudioContext | null = null;
let pulseTimer: ReturnType<typeof setInterval> | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;

function clearTimers() {
  if (pulseTimer) clearInterval(pulseTimer);
  if (stopTimer) clearTimeout(stopTimer);
  pulseTimer = null;
  stopTimer = null;
}

function stopAudio() {
  clearTimers();
  if (audioContext) {
    void audioContext.close().catch(() => undefined);
    audioContext = null;
  }
}

function playPulse() {
  if (!audioContext) return;

  const now = audioContext.currentTime;
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  gain.connect(audioContext.destination);

  const first = audioContext.createOscillator();
  first.type = 'sine';
  first.frequency.setValueAtTime(880, now);
  first.connect(gain);
  first.start(now);
  first.stop(now + 0.18);

  const second = audioContext.createOscillator();
  second.type = 'triangle';
  second.frequency.setValueAtTime(1174.66, now + 0.2);
  second.connect(gain);
  second.start(now + 0.2);
  second.stop(now + 0.42);
}

async function startAudio(durationMs = REMINDER_ALERT_DURATION_MS) {
  stopAudio();
  audioContext = new AudioContext();
  await audioContext.resume();
  playPulse();
  pulseTimer = setInterval(playPulse, 1500);
  stopTimer = setTimeout(stopAudio, Math.max(1000, durationMs));
}

chrome.runtime.onMessage.addListener((message: ReminderAudioMessage) => {
  if (message?.target !== 'tabnotes-reminder-audio') return;

  if (message.type === 'START_REMINDER_AUDIO') {
    void startAudio(message.durationMs).catch(() => undefined);
  }

  if (message.type === 'STOP_REMINDER_AUDIO') {
    stopAudio();
  }
});
