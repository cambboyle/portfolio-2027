import { useEffect } from "react";
import { Link, usePath } from "./router";
import { Home } from "./pages/Home";
import { Projects, Project } from "./pages/Projects";
import { Blog, Post } from "./pages/Blog";
import { About } from "./pages/About";
import { NotFound } from "./pages/NotFound";
import { pageMeta } from "./meta";

function Nav({ path }: { path: string }) {
  const item = (to: string, label: string) => (
    <li>
      <Link to={to}>{path === to || (to !== "/" && path.startsWith(to)) ? <b>{label}</b> : label}</Link>
    </li>
  );
  return (
    <nav className="nav">
      <ul>
        {item("/", "home")}
        {item("/projects", "projects")}
        {item("/notes", "notes")}
        {item("/about", "about")}
        <li><a href="https://github.com/cambboyle" target="_blank" rel="noreferrer">github</a></li>
        <li><a href="https://www.linkedin.com/in/cbb00/" target="_blank" rel="noreferrer">linkedin</a></li>
      </ul>
    </nav>
  );
}

export function App({ initialPath }: { initialPath?: string }) {
  const path = usePath(initialPath);
  useEffect(() => {
    const { title, description } = pageMeta(path);
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  }, [path]);
  let page;
  if (path === "/projects") page = <Projects />;
  else if (path.startsWith("/projects/")) page = <Project slug={path.slice(10)} />;
  else if (path === "/notes") page = <Blog />;
  else if (path.startsWith("/notes/")) page = <Post slug={path.slice(7)} />;
  else if (path === "/about") page = <About />;
  else if (path === "/") page = <Home />;
  else page = <NotFound />;
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Nav path={path} />
      {page}
    </>
  );
}
