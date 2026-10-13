import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import App from "@/App"
import "@/styles/globals.css"

const app = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
)

const root = document.getElementById("root")!
const pathname = window.location.pathname.replace(/\/+$/, "") || "/"
const prerenderedPath = root.getAttribute("data-prerendered")
const tree = <React.StrictMode>{app}</React.StrictMode>
// A service-worker fallback can serve the homepage shell for an offline utility
// route. Hydrate only when the static page actually matches the requested route.
if (prerenderedPath === pathname || (prerenderedPath === "not-found" && pathname !== "/" && pathname !== "/pricing")) {
  ReactDOM.hydrateRoot(root, tree)
} else {
  ReactDOM.createRoot(root).render(tree)
}
