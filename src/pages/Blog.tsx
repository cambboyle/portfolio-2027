import { posts } from "../data/posts";
import { Link } from "../router";

export function Blog() {
  return (
    <main id="main" className="page">
      <h1>Notes</h1>
      <ul className="list">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link to={`/notes/${p.slug}`}>{p.title}</Link>
            <p className="muted">{p.date}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}

export function Post({ slug }: { slug: string }) {
  const post = posts.find((p) => p.slug === slug);
  if (!post) {
    return (
      <main id="main" className="page">
        <h1>Not found</h1>
        <Link to="/notes">Back to notes</Link>
      </main>
    );
  }
  return (
    <main id="main" className="page">
      <h1>{post.title}</h1>
      <p className="muted">{post.date}</p>
      {post.body.map((para, i) => (
        <p key={i}>{para}</p>
      ))}
      <Link to="/notes">Back to notes</Link>
    </main>
  );
}
