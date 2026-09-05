# Landing copy audit

Audited 2026-09-05. Counts use whitespace-delimited words. No sentence is over 22 words and none uses a banned plain-words term.

| Landing text | Words | Result |
| --- | ---: | --- |
| Delivery receipt for freelancers | 4 | Pass |
| Record delivered work and client acceptance | 6 | Pass |
| For freelancers who need a clear handoff record before a final invoice or payment dispute. | 14 | Pass |
| Opens a completed sample receipt. | 5 | Pass |
| Files stay on this device | 5 | Pass |
| No account needed | 3 | Pass |
| Works offline after the first visit | 6 | Pass |
| List what you delivered | 5 | Pass |
| Select files to fingerprint them in this browser. | 8 | Pass |
| Or add a completed service. | 5 | Pass |
| Example: Brand launch files | 4 | Pass |
| No delivery items yet. | 4 | Pass |
| Add file fingerprints or a completed service. | 7 | Pass |
| Include a delivery channel, revision round, or contract reference. | 9 | Pass |
| Do not include secrets. | 4 | Pass |
| This receipt does not hold work, collect money, or replace your contract. | 12 | Pass |
| Legal effect depends on your agreement and jurisdiction. | 8 | Pass |
| The link contains the manifest and its hash. | 8 | Pass |
| It never contains file bytes. | 5 | Pass |
| Send this link with the actual files. | 8 | Pass |
| Your client can review the fixed manifest and send back a response code. | 13 | Pass |
| Paste the response code your client sends. | 8 | Pass |
| The app checks it against this receipt and manifest. | 10 | Pass |
| Create a receipt above. | 5 | Pass |
| It remains in this browser until you delete it. | 9 | Pass |
| File hashes identify selected bytes without uploading the files. | 9 | Pass |
| Use your usual drive or email for the actual files and send the acknowledgement link. | 15 | Pass |
| The client’s acceptance or decline includes the receipt, manifest hash, name, and UTC time. | 14 | Pass |
| It does not host your files, hold money, collect payment, or provide legal advice. | 14 | Pass |
| Export records you need to keep. | 6 | Pass |

Controls use verb-first labels: **Try it with sample data**, **Make a receipt with my delivery**, **Fingerprint files**, **Add service**, **Seal this delivery**, **Copy link**, **Download PDF**, **Download JSON**, **Export all JSON**, **Import JSON**, **Reset demo**, and **Start for real**.

## Terminology

| Concept | One term used |
| --- | --- |
| The owner’s record | receipt |
| Items delivered | delivery items |
| Client-facing URL | acknowledgement link |
| Client’s result | response code |
| File fingerprint | SHA-256 hash |
| Isolated try-out | demo |
