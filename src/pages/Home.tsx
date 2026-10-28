import { PagodaArt } from "../PagodaArt";

export function Home() {
  return (
    <main id="main" className="home">
      <section className="intro">
        <h1>Cameron Boyle</h1>
        <p className="tagline">I build things, break them, and keep learning how they work.</p>
        <p>Full stack developer from Newport, building at Novira Technologies.</p>
        <p>Learning Go, AWS and security.</p>
        <blockquote className="proverb">
          Fall seven times, stand up eight.
          <cite lang="ja">七転び八起き · Japanese proverb</cite>
        </blockquote>
      </section>
      <PagodaArt />
    </main>
  );
}
