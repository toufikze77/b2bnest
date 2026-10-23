# Phase 11b screenshots (MOCKED data)

Taken at 1440 px and 390 px in the local test harness with the real components and **mocked** data: no production data,
no Stripe. The legacy subscriber (`billing-legacy-*`) is a mocked Business customer on the earlier £35/month price; the
seat line (`members-seat-line-*`) is a mocked legacy Business pool of 2 companies with seat caps off.

| File | Shows |
|---|---|
| `pricing-monthly-*`, `pricing-annual-*` | Solo / Business (most popular) / Scale, users and admins, AI credits |
| `billing-legacy-*` | Settings → Billing for an existing subscriber: their real price and limits, "not applied yet" |
| `members-seat-line-*` | Members & roles seat line: users and admins, the plan's limits, "not applied yet" |
| `savings-calculator-*` | Homepage calculator using the Business plan, with HMRC kept and its honest note |
