import { posts } from "./data/posts";
import { projects } from "./data/projects";

export interface Meta {
  title: string;
  description: string;
}

const SITE = "Cameron Boyle";
const HOME = "Full stack JavaScript developer in Newport, Wales. Building with React, Node and Go, and learning AWS and security.";

/** Search results show about 160 characters, so cut longer text at a word and add an ellipsis. */
function clip(text: string, max = 160) {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

/** The title and description for a path. Used by the browser as you move around, and by the build to write each page's HTML. */
export function pageMeta(path: string): Meta {
  const project = path.startsWith("/projects/") ? projects.find((p) => p.slug === path.slice(10)) : undefined;
  const post = path.startsWith("/notes/") ? posts.find((p) => p.slug === path.slice(7)) : undefined;
  if (path === "/") return { title: SITE, description: HOME };
  if (path === "/projects") return { title: `Projects · ${SITE}`, description: "Things I've built: Tallgrass, NetKit, CamDex and Crate, with the thinking behind each one." };
  if (path === "/notes") return { title: `Notes · ${SITE}`, description: "Notes on what I'm building and learning." };
  if (path === "/about") return { title: `About · ${SITE}`, description: "Full stack developer in Newport, Wales, learning Go, AWS, Linux and security." };
  if (project) return { title: `${project.name} · ${SITE}`, description: clip(project.blurb) };
  if (post) return { title: `${post.title} · ${SITE}`, description: clip(post.body[0]) };
  return { title: `Page not found · ${SITE}`, description: "There's nothing at this address." };
}

/** Every real page, for the build to write out as HTML and list in the sitemap. */
export const routes = [
  "/",
  "/projects",
  "/notes",
  "/about",
  ...projects.filter((p) => p.study).map((p) => `/projects/${p.slug}`),
  ...posts.map((p) => `/notes/${p.slug}`),
];
