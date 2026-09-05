import { useEffect, useMemo, useRef, useState } from 'react';
import type { Program, ProgramRegistry, SevenDayPlan } from '../types';
import {
  SITUATION_FACTS,
  buildHandoffMessage,
  buildPlainCard,
  buildScript,
  readingGrade,
  translationStatus,
} from '../lib/hallway';
import { readNotes } from '../lib/listen';
import type { Reading } from '../lib/listen';
import { appendTranscript, isVoiceAvailable, startListening } from '../lib/voice';
import type { VoiceSession } from '../lib/voice';

type Beat = 'translate' | 'say' | 'hand';

const BEATS: { id: Beat; label: string; sub: string }[] = [
  { id: 'translate', label: 'What it is', sub: 'in plain words' },
  { id: 'say', label: 'Say it', sub: '90 seconds' },
  { id: 'hand', label: 'Send it', sub: 'before you walk away' },
];

/** The pill label for a program, in the register the connector would use. */
function shortLabel(program: Program): string {
  return program.plain?.job_said_out_loud ?? program.provider_short;
}

/**
 * The hallway flow. One column, big targets, three beats.
 *
 * This is the primary screen because it matches the moment: standing up, one
 * hand, ninety seconds. The longer analysis still exists behind the other tabs
 * for when there is a table and time.
 */
export default function HallwayView({
  plan,
  registry,
}: {
  plan: SevenDayPlan;
  registry: ProgramRegistry;
}) {
  const [beat, setBeat] = useState<Beat>('translate');
  const [facts, setFacts] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [programId, setProgramId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [reading, setReading] = useState<Reading | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const session = useRef<VoiceSession | null>(null);
  const voiceAvailable = isVoiceAvailable();

  // A microphone left open because the component went away is the kind of bug
  // that would end this project's credibility faster than a wrong phone number.
  useEffect(() => () => session.current?.stop(), []);

  const recommended = plan.recommendedOption?.program ?? null;

  // The recommended program leads, but every program in the registry is
  // reachable, including the two that cannot be translated. Those two are the
  // point: a connector needs to know which programs they must not vouch for.
  const programs = useMemo(() => {
    const rest = registry.programs.filter((p) => p.id !== recommended?.id);
    return recommended ? [recommended, ...rest] : rest;
  }, [registry, recommended]);

  const program = programs.find((p) => p.id === programId) ?? programs[0] ?? null;

  const status = useMemo(() => (program ? translationStatus(program) : null), [program]);

  const card = useMemo(
    () => (program ? buildPlainCard(program, registry, facts) : null),
    [program, registry, facts],
  );
  const script = useMemo(
    () => (program ? buildScript(program, facts) : null),
    [program, facts],
  );
  const message = useMemo(
    () => (program && card ? buildHandoffMessage(program, registry, facts, plan.profile) : ''),
    [program, card, registry, facts, plan.profile],
  );

  if (!program || !status) {
    return (
      <div className="hallway">
        <section className="empty">
          <h3>Not your area, and that is the right answer.</h3>
          <p>
            This one is about <strong>{plan.profile.pathway}</strong>. Say so, and point them at a{' '}
            <strong>{plan.profile.handoffOwnerType}</strong>. Guessing costs you more than not
            knowing.
          </p>
        </section>
      </div>
    );
  }

  const toggleFact = (id: string) =>
    setFacts((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));

  const listen = () => {
    const result = readNotes(notes, registry);
    setReading(result);
    setFacts(result.factIds);
    if (result.programId) setProgramId(result.programId);
  };

  const clearNotes = () => {
    setNotes('');
    setReading(null);
    setInterim('');
  };

  const stopVoice = () => {
    session.current?.stop();
    session.current = null;
    setListening(false);
    setInterim('');
  };

  const toggleVoice = () => {
    if (listening) {
      stopVoice();
      return;
    }
    setVoiceError(null);
    const started = startListening({
      onFinal: (text) => setNotes((prev) => appendTranscript(prev, text)),
      onInterim: setInterim,
      onError: (message) => {
        setVoiceError(message);
        stopVoice();
      },
      onEnd: () => {
        session.current = null;
        setListening(false);
        setInterim('');
      },
    });
    if (!started) {
      setVoiceError('This browser cannot do dictation. Type it instead.');
      return;
    }
    session.current = started;
    setListening(true);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copy this:', text);
    }
  };

  return (
    <div className="hallway">
      <div className="phone">
        <div className="switcher">
          <p className="switcher-label">They asked about</p>
          <div className="switcher-pills">
            {programs.map((p) => {
              const ok = translationStatus(p).canTranslate;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`pill${p.id === program.id ? ' pill-on' : ''}${ok ? '' : ' pill-mute'}`}
                  onClick={() => setProgramId(p.id)}
                >
                  {shortLabel(p)}
                  {!ok && <span className="pill-warn" aria-label="do not vouch for this one" />}
                </button>
              );
            })}
          </div>
        </div>

        {!status.canTranslate ? (
          <div className="beat-body refusal">
            <h3>I am not going to give you words for this one.</h3>
            <p className="refusal-why">{status.refusal}</p>
            <h4>Say this instead</h4>
            <p className="refusal-instead">{status.whatToSayInstead}</p>
            <p className="refusal-note">
              This program stays on the list on purpose. A directory would show it, someone would
              spend a week on it, and the connector who sent them there would wear it.
            </p>
          </div>
        ) : (
          <>
            <div className="beats">
              {BEATS.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  className={beat === b.id ? 'beat active' : 'beat'}
                  onClick={() => setBeat(b.id)}
                >
                  <span className="beat-n">{i + 1}</span>
                  <span className="beat-label">{b.label}</span>
                  <span className="beat-sub">{b.sub}</span>
                </button>
              ))}
            </div>

            <details className="whatyouknow">
              <summary>
                What did they tell you? <span className="chip-count">{facts.length} tapped</span>
              </summary>

              <div className="notes">
                <label htmlFor="notes">
                  {voiceAvailable ? 'Say or type what you remember, in your words.' : 'Type what you remember, in your words.'}
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="wants to get into computers, works days at the warehouse, no car, mom says money is tight"
                  rows={3}
                />
                {listening && (
                  <p className="notes-interim">
                    <span className="listening-dot" />
                    {interim || 'Listening. Talk normally.'}
                  </p>
                )}

                <div className="notes-actions">
                  {voiceAvailable && (
                    <button
                      type="button"
                      className={listening ? 'notes-mic mic-on' : 'notes-mic'}
                      onClick={toggleVoice}
                    >
                      {listening ? 'Stop' : 'Speak'}
                    </button>
                  )}
                  <button type="button" className="notes-go" onClick={listen} disabled={!notes.trim()}>
                    Read it back
                  </button>
                  {reading && (
                    <button type="button" className="notes-clear" onClick={clearNotes}>
                      Clear
                    </button>
                  )}
                </div>
                {voiceError && <p className="notes-error">{voiceError}</p>}

                <p className="notes-privacy">
                  <strong>Typing stays on your phone.</strong> The matching runs here in the browser,
                  nothing is transmitted, and nothing is kept.
                  {voiceAvailable && (
                    <>
                      {' '}
                      <strong>Speaking does not.</strong> Your browser sends the audio to a speech
                      service to turn it into words, and for Chrome that service is Google's. If that
                      is not right for what you are about to say, type it. Either way: say what you
                      heard, not who said it.
                    </>
                  )}
                </p>
              </div>

              {reading && (
                <div className="reading">
                  {reading.heard.length > 0 ? (
                    <>
                      <p className="reading-head">Here is what I picked up, and why.</p>
                      <ul className="reading-list">
                        {reading.heard.map((h) => (
                          <li key={h.factId}>
                            <strong>{h.label}</strong>
                            <span className="reading-because">because you wrote "{h.becauseTheySaid}"</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="reading-head">
                      I did not pick anything up from that. Tap what applies below instead. People do
                      not talk in keywords.
                    </p>
                  )}
                  {reading.programBecause && (
                    <p className="reading-program">
                      Opened <strong>{shortLabel(program)}</strong>. {reading.programBecause}
                    </p>
                  )}
                  {reading.stillUnknown.length > 0 && (
                    <>
                      <p className="reading-head">Still worth asking</p>
                      <ul className="reading-ask">
                        {reading.stillUnknown.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  <p className="reading-check">
                    Check this before you use it. It matches words, it does not understand anyone.
                  </p>
                </div>
              )}

              <div className="chips">
                {SITUATION_FACTS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={facts.includes(f.id) ? 'chip on' : 'chip'}
                    onClick={() => toggleFact(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <p className="chips-note">
                Nothing is saved or sent. This only changes what you say next. Do not write down a
                person's business on their behalf.
              </p>
            </details>

            {beat === 'translate' && card && (
              <div className="beat-body">
                <h3>What it actually is</h3>
                <dl className="plain">
                  <dt>What it is</dt>
                  <dd>{card.whatItIs}</dd>
                  <dt>What you get</dt>
                  <dd>{card.whatYouGet}</dd>
                  <dt>When it meets</dt>
                  <dd>{card.whenItMeets}</dd>
                  <dt>What it costs</dt>
                  <dd>{card.whatItCosts}</dd>
                  <dt>What you need</dt>
                  <dd>
                    <ul>
                      {card.whatYouNeed.map((need) => (
                        <li key={need}>{need}</li>
                      ))}
                    </ul>
                  </dd>
                </dl>

                <h4 className="stops-head">What usually stops people</h4>
                <ul className="stops">
                  {card.whatUsuallyStopsPeople.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>

                <details className="translations">
                  <summary>
                    Where these words came from{' '}
                    <span className="chip-count">{card.translations.length} lines</span>
                  </summary>
                  <p className="translations-note">
                    Every plain sentence replaces one the program actually published. Both are here
                    so you can judge whether the translation is fair before you repeat it.
                  </p>
                  {card.translations.map((t) => (
                    <div key={t.page_says} className="translation">
                      <p className="page-says">
                        <span className="tlabel">The page says</span>
                        {t.page_says}
                      </p>
                      <p className="you-say">
                        <span className="tlabel">You say</span>
                        {t.you_say}
                      </p>
                      <a href={t.source_url} target="_blank" rel="noreferrer">
                        {t.source_url}
                      </a>
                    </div>
                  ))}
                </details>

                <p className="confirm-flag">
                  Confirm with the program directly: <strong>{card.confirmWith}</strong>. This was
                  looked up on{' '}
                  {new Date(card.readOn).toLocaleDateString('en-US', { dateStyle: 'long' })} and it
                  can change.
                </p>
              </div>
            )}

            {beat === 'say' && script && (
              <div className="beat-body">
                <h3>
                  Read this out loud
                  <span className="timer">about {script.estimatedSeconds} seconds</span>
                </h3>
                <div className="script-lines">
                  {script.lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
                <div className="the-ask">
                  <p className="ask-label">Then close. One ask, not a list.</p>
                  <p className="ask-text">{script.theAsk}</p>
                </div>

                <details className="tips">
                  <summary>How to ask about money and health without prying</summary>
                  <ul>
                    {script.askingTips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </details>

                <p className="grade">
                  Written to a grade{' '}
                  {readingGrade([...script.lines, script.theAsk].join(' ')).toFixed(1)} reading
                  level, and tested to stay there.
                </p>
              </div>
            )}

            {beat === 'hand' && (
              <div className="beat-body">
                <h3>Send it before you walk away</h3>
                <button type="button" className="share-button big" onClick={() => copy(message)}>
                  {copied ? 'Copied. Now paste it into a message.' : 'Copy the message'}
                </button>
                <pre className="message">{message}</pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
