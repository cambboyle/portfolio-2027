import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root")!;
// the built site already contains the page's HTML, so attach to it; the dev server sends an empty root
if (root.hasChildNodes()) hydrateRoot(root, <App />);
else createRoot(root).render(<App />);
