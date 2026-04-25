import WaitlistForm from "./waitlist-form";

export default function Home() {
  return (
    <>
      <div className="grain" aria-hidden />
      <main className="relative z-[2] mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-6 pt-8 pb-16 md:px-12 md:pt-12">
        <Masthead />
        <Hero />
        <Divider label="What lands in your inbox" />
        <ShowNotes />
        <Divider label="Colophon" />
        <Footer />
      </main>
    </>
  );
}

function Masthead() {
  return (
    <header className="reveal reveal-1 flex items-baseline justify-between border-b border-rule pb-4">
      <div className="flex items-baseline gap-3">
        <span
          className="text-ink font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight"
          style={{ fontVariationSettings: "'SOFT' 50, 'WONK' 1, 'opsz' 144" }}
        >
          Ninety
        </span>
        <span className="hidden font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-muted sm:inline">
          — show notes, in the time it takes to brew a coffee
        </span>
      </div>
      <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.22em] text-muted">
        Vol. 01 / Waitlist Open
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative grid grid-cols-1 gap-10 pt-14 pb-20 md:grid-cols-12 md:gap-8 md:pt-20 md:pb-28">
      <div className="md:col-span-7">
        <p className="reveal reveal-1 mb-8 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.3em] text-accent">
          <span className="inline-block h-1.5 w-1.5 -translate-y-[2px] rounded-full bg-accent align-middle" />
          <span className="ml-2">A new kind of post-production</span>
        </p>

        <h1
          className="reveal reveal-2 font-[family-name:var(--font-display)] text-[clamp(3rem,8vw,6.5rem)] leading-[0.95] tracking-[-0.02em] text-ink"
          style={{ fontVariationSettings: "'SOFT' 70, 'WONK' 1, 'opsz' 144" }}
        >
          Podcast{" "}
          <span
            className="italic"
            style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 0, 'opsz' 144" }}
          >
            show&nbsp;notes
          </span>
          ,<br />
          written in{" "}
          <span className="relative whitespace-nowrap text-accent">
            ninety seconds
            <svg
              aria-hidden
              className="absolute -bottom-3 left-0 h-3 w-full"
              viewBox="0 0 400 14"
              preserveAspectRatio="none"
            >
              <path
                d="M2 9 Q 100 2, 200 8 T 398 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
          .
        </h1>

        <p className="reveal reveal-3 mt-10 max-w-xl text-lg leading-relaxed text-ink-soft md:text-xl">
          Upload your episode. Get chaptered timestamps, pull quotes, guest bios,
          and a ready-to-paste post — formatted for Apple, Spotify, YouTube, and
          your substack.{" "}
          <span className="italic text-muted">No transcription babysitting.</span>
        </p>

        <div className="reveal reveal-4 mt-10">
          <WaitlistForm />
        </div>

        <p className="reveal reveal-5 mt-5 font-[family-name:var(--font-mono)] text-[11px] tracking-wide text-muted">
          No spam. One email when we open the doors.{" "}
          <span className="text-ink-soft">420 hosts</span> already on the list.
        </p>
      </div>

      <aside className="reveal reveal-4 relative md:col-span-5">
        <Clock />
      </aside>
    </section>
  );
}

function Clock() {
  return (
    <figure className="relative mx-auto flex aspect-square w-full max-w-[420px] flex-col items-center justify-center rounded-full border border-rule bg-paper-deep/60 p-8">
      <figcaption className="absolute top-8 left-1/2 -translate-x-1/2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-muted">
        Runtime
      </figcaption>

      <div
        className="font-[family-name:var(--font-display)] text-[clamp(4rem,14vw,7rem)] leading-none tracking-tight text-ink tabular-nums"
        style={{ fontVariationSettings: "'SOFT' 90, 'WONK' 1, 'opsz' 144" }}
      >
        01:30
      </div>

      <div className="mt-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em] text-accent">
        start · to · publish
      </div>

      <svg
        aria-hidden
        className="mt-6 h-10 w-40 text-ink-soft"
        viewBox="0 0 160 40"
      >
        {Array.from({ length: 24 }).map((_, i) => {
          const h = 8 + Math.abs(Math.sin(i * 0.9) * 22) + (i % 3) * 2;
          return (
            <rect
              key={i}
              x={i * 7}
              y={20 - h / 2}
              width="3"
              height={h}
              rx="1.5"
              fill="currentColor"
              className="bar"
              style={{ animationDelay: `${i * 0.06}s` }}
            />
          );
        })}
      </svg>

      <div className="pointer-events-none absolute inset-6 rounded-full border border-dashed border-rule" />
    </figure>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="reveal reveal-5 flex items-center gap-4 pt-4">
      <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] text-muted">
        § {label}
      </span>
      <div className="h-px flex-1 bg-rule" />
    </div>
  );
}

const notes = [
  {
    t: "00:00:12",
    title: "Chapter markers",
    body: "Automatic chapter detection with titles you can edit, exported for Apple Podcasts and YouTube.",
  },
  {
    t: "00:00:31",
    title: "Timestamped highlights",
    body: "The three moments listeners replay, pulled as quotable snippets your audience can share.",
  },
  {
    t: "00:00:54",
    title: "Guest bios + links",
    body: "Bios, socials, and every book, tool, and URL mentioned — linked, spell-checked, and ready to paste.",
  },
  {
    t: "00:01:18",
    title: "Platform-ready formatting",
    body: "Spotify description, Apple show notes, YouTube chapters, and a clean Substack post. One export each.",
  },
  {
    t: "00:01:30",
    title: "Published.",
    body: "Ninety seconds from upload to publish-ready copy. You spend the rest of the afternoon making the next episode.",
  },
];

function ShowNotes() {
  return (
    <section className="reveal reveal-6 grid grid-cols-1 gap-x-12 gap-y-10 pt-10 pb-16 md:grid-cols-12">
      <h2
        className="font-[family-name:var(--font-display)] text-4xl leading-[1.05] tracking-tight text-ink md:col-span-4 md:text-5xl"
        style={{ fontVariationSettings: "'SOFT' 60, 'WONK' 0, 'opsz' 96" }}
      >
        Five things,
        <br />
        <span className="italic text-accent">every time.</span>
      </h2>

      <ol className="md:col-span-8">
        {notes.map((n, i) => (
          <li
            key={n.t}
            className="group grid grid-cols-[auto_1fr] gap-x-6 border-t border-rule py-6 first:border-t-0 first:pt-0 md:gap-x-10"
          >
            <span className="pt-1 font-[family-name:var(--font-mono)] text-xs tracking-wider text-accent tabular-nums">
              {n.t}
            </span>
            <div>
              <h3
                className="font-[family-name:var(--font-display)] text-2xl leading-tight tracking-tight text-ink"
                style={{ fontVariationSettings: "'SOFT' 50, 'WONK' 0, 'opsz' 48" }}
              >
                <span className="mr-3 font-[family-name:var(--font-mono)] text-xs text-muted tabular-nums">
                  0{i + 1}
                </span>
                {n.title}
              </h3>
              <p className="mt-2 max-w-[52ch] text-base leading-relaxed text-ink-soft">
                {n.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-6 flex flex-col items-start justify-between gap-3 pt-4 md:flex-row md:items-center">
      <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-muted">
        © {new Date().getFullYear()} Ninety. Set in Fraunces &amp; Newsreader.
      </p>
      <a
        href="mailto:hello@growthx.club"
        className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.25em] text-ink-soft hover:text-accent"
      >
        hello@growthx.club →
      </a>
    </footer>
  );
}
