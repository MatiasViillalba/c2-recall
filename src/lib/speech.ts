// Pronunciación con la síntesis de voz del sistema (gratis y offline en iPhone, Windows y Android).
let voicesCache: SpeechSynthesisVoice[] = [];

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  voicesCache = window.speechSynthesis.getVoices();
  return voicesCache;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = () => loadVoices();
}

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function englishVoices(): SpeechSynthesisVoice[] {
  const voices = voicesCache.length ? voicesCache : loadVoices();
  return voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
}

function pickVoice(preferredURI?: string): SpeechSynthesisVoice | undefined {
  const voices = englishVoices();
  if (preferredURI) {
    const v = voices.find((x) => x.voiceURI === preferredURI);
    if (v) return v;
  }
  // Preferimos inglés británico (CPE es un examen británico).
  return voices.find((v) => v.lang === 'en-GB' && /natural|premium|enhanced|daniel|serena|kate|libby|sonia/i.test(v.name))
    ?? voices.find((v) => v.lang === 'en-GB')
    ?? voices.find((v) => v.lang.startsWith('en'));
}

export function speak(text: string, opts: { rate?: number; voiceURI?: string } = {}): void {
  if (!speechAvailable()) return;
  const clean = text.replace(/\{\{|\}\}/g, '').replace(/_{2,}/g, '…').replace(/\s*\/\s*/g, ', ').replace(/\(.*?\)/g, '');
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  const voice = pickVoice(opts.voiceURI);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? 'en-GB';
  u.rate = opts.rate ?? 0.95;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (speechAvailable()) window.speechSynthesis.cancel();
}
