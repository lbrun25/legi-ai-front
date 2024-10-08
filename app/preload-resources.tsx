'use client'

import ReactDOM from 'react-dom'

export function PreloadResources() {
  ReactDOM.preload("/mike.mp4", { as: "video", type: "video/mp4", fetchPriority: "high" })
  ReactDOM.preload("/mike.webm", { as: "video", type: "video/webm", fetchPriority: "high" })
  ReactDOM.preload("/mike-logo-42.webp", { as: "image", fetchPriority: "high" });
  return null;
}
