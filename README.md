# ActionBox JavaScript / TypeScript SDK

Node.js client for the hosted [ActionBox](https://actionbox.cloud) API,
with TypeScript types.

## Install

Requires Node.js 18 or newer. Use a currently supported Node.js LTS release.

```sh
npm install @actionbox/sdk
```

Create a Source in ActionBox and store its key in `ACTIONBOX_API_KEY`.

```js
import { ActionboxClient } from "@actionbox/sdk";

const client = new ActionboxClient({ apiKey: process.env.ACTIONBOX_API_KEY });
const decision = await client.ask({
  title: "Proceed with the operation?",
  options: ["Approve", "Reject"],
});
console.log(decision);
```

The client uses `https://api.actionbox.cloud`. Run it in trusted server
environments; do not bundle Source keys into browser applications.

## Development

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm pack
```

## Documentation and contributions

- [ActionBox documentation](https://actionbox.cloud/docs)
- [Contributing](CONTRIBUTING.md)
- [Report a vulnerability](SECURITY.md)

## License

This client is MIT licensed; see [LICENSE](LICENSE).
ActionBox is proprietary hosted software. This repository contains its client.
