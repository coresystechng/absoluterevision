import { renderToString } from "react-dom/server"
import { StaticRouter } from "react-router-dom/server"
import App from "./App"

/** Only public pages call this renderer; private routes remain browser-only. */
export function renderPublicPage(pathname: string) {
  return renderToString(<StaticRouter location={pathname}><App /></StaticRouter>)
}
