import { projects } from "../data/projects";
import { Link } from "../router";

export function Projects() {
  return (
    <main id="main" className="page">
      <h1>Projects</h1>
      <ul className="list">
        {projects.map((p) => (
          <li key={p.slug}>
            {p.study ? <Link to={`/projects/${p.slug}`}>{p.name}</Link> : <b>{p.name}</b>}
            <p>{p.blurb}</p>
            <p className="muted">{p.stack}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}

export function Project({ slug }: { slug: string }) {
  const p = projects.find((x) => x.slug === slug);
  if (!p || !p.study) {
    return (
      <main id="main" className="page">
        <h1>Not found</h1>
        <Link to="/projects">Back to projects</Link>
      </main>
    );
  }
  return (
    <main id="main" className="page">
      <h1>{p.name}</h1>
      <p className="muted">{p.stack}</p>
      <ul className="links">
        {p.live && <li><a href={p.live} target="_blank" rel="noreferrer">live</a></li>}
        {p.docs && <li><a href={p.docs} target="_blank" rel="noreferrer">docs</a></li>}
        {p.repo && <li><a href={p.repo} target="_blank" rel="noreferrer">code</a></li>}
      </ul>
      <h2>The problem</h2>
      {p.study.problem.map((t, i) => (
        <p key={i}>{t}</p>
      ))}
      <h2>What I chose</h2>
      {p.study.choices.map((c, i) => (
        <div key={i}>
          <h3>{c.title}</h3>
          <p>{c.body}</p>
        </div>
      ))}
      <h2>The result</h2>
      {p.study.result.map((t, i) => (
        <p key={i}>{t}</p>
      ))}
      {p.study.next && p.study.next.length > 0 && (
        <>
          <h2>What I'd do next</h2>
          {p.study.next.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </>
      )}
      <p><Link to="/projects">Back to projects</Link></p>
    </main>
  );
}
