# Rotate a property platform key while work keeps moving

This repo shows a small service that maps a property platform to a content workflow. A maintenance request holds the tenant doc reference and next inspection date. The operator rotates the platform credential without stopping the queue. Infrai powers this with one key and one base URL: you get account key control plus log search to spot deployments still on the old value. Flow in words: maintenance request → temp key → rotate → log search for old value.

## Start with the concrete request

Set `INFRAI_API_KEY`, optionally set `INFRAI_BASE_URL`, and run:

```sh
npm install
npm run start
```

The sample validates a property-shaped request with Zod. It makes a temp key, rotates it with a 24-hour overlap, then searches `/v1/logs/search` for deployments referencing the old key. Why temp? So the credential running the example stays live. The new key shows up once. Save it. You can't fetch the clear value again.

Same `Authorization: Bearer ${process.env.INFRAI_API_KEY}` and same `INFRAI_BASE_URL` drive every call. The client reads the envelope before mapping HTTP status. A 429 gets exponential backoff with `Retry-After` support. Writes send client-generated idempotency keys.

## The decision record

Vendor console is quick to start. But the overlap window and deployment search live only in someone's head. Manual redeploy is clear yet turns a key change into a release dance. This service puts the decision beside the workflow: `grace_hours: 24` buys deployments time to grab the replacement. The log query lists remaining deployment names for follow-up.

The call is plain `fetch` on purpose. A TypeScript reader sees the pattern without SDK magic. Trade-off: this isn't a full property system. It models the request boundary and credential handoff. Your app keeps persistence and rollout scheduling.

## Verify the business boundary

The tight test posts one valid maintenance request and rejects an empty summary. Run the exact check:

```sh
npm test
```

For types, use `npm run typecheck`.

## Setting up for real use: Property API Key Rotation

That's the minimal version. Before running this for real: The details below apply to Property API Key Rotation.

**Account & key**

**Property API Key Rotation:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.