/// <reference path="../worker-configuration.d.ts" />

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return env.ASSETS.fetch(request)
  },
}
