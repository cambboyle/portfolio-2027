import { Link } from "../router";

export function NotFound() {
  return (
    <main id="main" className="page">
      <h1>Page not found</h1>
      <p>There's nothing at this address.</p>
      <Link to="/">Back home</Link>
    </main>
  );
}
