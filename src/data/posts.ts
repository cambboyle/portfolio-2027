export interface Post {
  slug: string;
  title: string;
  date: string;
  body: string[]; // one string per paragraph
}

// Newest first. Add a post by adding an object here.
export const posts: Post[] = [
  {
    slug: "drawing-a-pagoda-in-characters",
    title: "Drawing a pagoda in characters",
    date: "2026-10-27",
    body: [
      "The picture on the home page is a photo shrunk to a grid of 150 by 116 characters. Each cell gets a character from its brightness, or a line character where there is an edge, and a colour from the photo.",
      "A script does that once ahead of time and saves the result. The browser only redraws it and adds the movement.",
    ],
  },
];
