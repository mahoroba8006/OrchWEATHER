import { onRequest as __api_ai_comment_ts_onRequest } from "C:\\dev\\気象アプリ\\functions\\api\\ai-comment.ts"
import { onRequest as __api_archive_ts_onRequest } from "C:\\dev\\気象アプリ\\functions\\api\\archive.ts"

export const routes = [
    {
      routePath: "/api/ai-comment",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_ai_comment_ts_onRequest],
    },
  {
      routePath: "/api/archive",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_archive_ts_onRequest],
    },
  ]