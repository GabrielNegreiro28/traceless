# Traceless

> For whistleblowers, Traceless finds the details in a report that could reveal who wrote it — on the device, before anything is sent.

**Status:** work in progress (built for the #BuildHybridAI hackathon).

Anonymous reporting channels protect the sender, but the report itself often gives the reporter away: a unique role, a shift, a location, a personal date. Traceless uses on-device AI (Gemini Nano through Firebase AI Logic hybrid inference) to flag those details and suggest safer rewrites. Only text the reporter has reviewed and approved ever reaches the cloud.

## Quick start

Requirements: Node.js 24 (see `.nvmrc`).

```bash
npm ci
cp .env.example .env.local   # then fill in your Firebase web config
npm run dev
```

Useful scripts: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run ci` (everything CI runs).

## License

[Apache License 2.0](LICENSE)
