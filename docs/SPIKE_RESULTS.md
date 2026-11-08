# P1-B04 spike results

Filled in by a human after running the deploy and Gemini spikes. Decision (Cloudflare or Render) is announced to the team.

| What                            | Value            |
| ------------------------------- | ---------------- |
| Date                            |                  |
| Worker URL                      |                  |
| `/api/health` status            |                  |
| Image payload size (base64, KB) |                  |
| `/api/_spike/echo` HTTP status  |                  |
| `/api/_spike/echo` `ms`         |                  |
| CPU limit error in dashboard    | yes / no         |
| Gemini latency (`ms`)           |                  |
| Gemini output sane?             | yes / no (notes) |
| Decision: Cloudflare or Render  |                  |
| Notes                           |                  |

Commands used (see card P1-B04):

```
pnpm --filter @sp/api exec wrangler login
pnpm --filter @sp/api exec wrangler deploy
# then curl the Worker URL /api/health and POST a downscaled phone photo to /api/_spike/echo
pnpm --filter @sp/tools exec tsx src/spike-gemini.ts <image path> [dish|label]
```
