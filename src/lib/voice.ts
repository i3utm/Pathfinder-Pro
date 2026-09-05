/**
 * Talking instead of typing.
 *
 * The connector is walking back to his car. Typing is the thing standing
 * between the conversation and the notes, so this lets him say it out loud
 * instead.
 *
 * One thing has to be said plainly wherever this is used: dictation is not
 * local. The browser ships the audio to a speech service to turn it into text,
 * and for Chrome that service is Google's. Everything else in this app runs on
 * the phone and touches no network, so the difference matters and the UI has to
 * say so rather than letting the earlier promise quietly cover this too.
 */

/** The slice of the Web Speech API this uses. Not in every browser's types. */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function constructorFor(): SpeechRecognitionConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceAvailable(): boolean {
  return constructorFor() !== null;
}

export interface VoiceSession {
  stop(): void;
}

export interface VoiceHandlers {
  /** Fired for settled text, which is appended to the notes. */
  onFinal(text: string): void;
  /** Fired continuously while speaking, so the connector sees it working. */
  onInterim(text: string): void;
  onError(message: string): void;
  onEnd(): void;
}

/**
 * A dropped microphone permission and a browser that does not support this at
 * all are different problems, and a connector who is told the wrong one will
 * go looking in the wrong place.
 */
function explain(error: string): string {
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return 'Your browser blocked the microphone. Allow it in the address bar, or just type it instead.';
  }
  if (error === 'no-speech') return 'I did not hear anything. Try again, or type it instead.';
  if (error === 'network') return 'Dictation needs a connection and could not reach it. Type it instead.';
  return `Dictation stopped (${error}). Type it instead.`;
}

export function startListening(handlers: VoiceHandlers): VoiceSession | null {
  const Recognition = constructorFor();
  if (!Recognition) return null;

  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (result.isFinal) handlers.onFinal(result[0].transcript);
      else interim += result[0].transcript;
    }
    handlers.onInterim(interim);
  };
  recognition.onerror = (event) => handlers.onError(explain(event.error));
  recognition.onend = () => handlers.onEnd();

  recognition.start();
  return { stop: () => recognition.stop() };
}

/**
 * Fold a settled chunk of speech into the notes.
 *
 * Speech arrives without punctuation or capitals and with ragged spacing, and
 * the matcher downstream reads plain phrases, so the only job here is to keep
 * the words separated without doubling spaces.
 */
export function appendTranscript(existing: string, chunk: string): string {
  const clean = chunk.trim().replace(/\s+/g, ' ');
  if (!clean) return existing;
  if (!existing.trim()) return clean;
  return `${existing.replace(/\s+$/, '')} ${clean}`;
}
