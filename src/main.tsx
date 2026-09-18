import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

// Preserve links shared before the SEO migration, such as /#/cultivar/bloodgood.
// Fragments are never sent to the server, so convert them before React reads the URL.
const legacyHashPath = window.location.hash.match(/^#\/(.+)$/)?.[1];
if (legacyHashPath) {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  window.history.replaceState(null, "", `${basePath}/${legacyHashPath}${window.location.search}`);
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("未找到 #root 挂载节点");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
