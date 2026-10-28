import { useEffect, useRef } from "react";
import { ExternalLink, Link, usePath } from "./router";
import { Home } from "./pages/Home";
import { Projects, Project } from "./pages/Projects";
import { Blog, Post } from "./pages/Blog";
import { About } from "./pages/About";
import { NotFound } from "./pages/NotFound";
import { pageMeta } from "./meta";

function Nav({ path }: { path: string }) {
  const item = (to: string, label: string) => {
    const current = path === to || (to !== "/" && path.startsWith(to));
    return (
      <li>
        <Link to={to} current={current}>
          {current ? <b>{label}</b> : label}
        </Link>
      </li>
    );
  };
  return (
    <nav className="nav" aria-label="Main">
      <ul>
        {item("/", "home")}
        {item("/projects", "projects")}
        {item("/notes", "notes")}
        {item("/about", "about")}
        <li><ExternalLink href="https://github.com/cambboyle">github</ExternalLink></li>
        <li><ExternalLink href="https://www.linkedin.com/in/cbb00/">linkedin</ExternalLink></li>
      </ul>
    </nav>
  );
}

export function App({ initialPath }: { initialPath?: string }) {
  const path = usePath(initialPath);
  const first = useRef(true);
  useEffect(() => {
    const { title, description } = pageMeta(path);
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    // After moving to another page, put keyboard focus at the top of the new content (and let screen readers
    // announce it), as a normal page load would. Skip the first render so the page doesn't steal focus on load.
    if (first.current) first.current = false;
    else document.getElementById("main")?.focus({ preventScroll: true });
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
