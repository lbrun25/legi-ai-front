'use client'

import ReactDOM from 'react-dom'

export function PreloadResources() {
  ReactDOM.preload("/mike.mov", { as: "video", type: "video/mp4", fetchPriority: "high" })
  ReactDOM.preload("/mike.webm", { as: "video", type: "video/webm", fetchPriority: "high" })
  ReactDOM.preload("/mike-logo-42.png", { as: "image", fetchPriority: "high" });
  return null;
}
