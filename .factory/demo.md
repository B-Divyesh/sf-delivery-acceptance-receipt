# Demo sandbox

- URL: `/demo` (the catalog and README entry point).
- Sample: a completed Northstar Coffee launch delivery from Mara Vale Studio. It includes a PDF file fingerprint, a completed service, an acknowledgement, and Inez Rahman’s acceptance.
- Storage: the demo uses the separate IndexedDB database `demo:delivery-receipt`. Real records use `delivery-receipt`. Demo pages, including `/ack/demo/<payload>`, never open the real database.
- Reset: **Reset demo** clears and reseeds only `demo:delivery-receipt`.
- Exit: **Start for real** opens `/` and discards the visitor’s current demo view. It does not copy demo records into real storage.
- Offline: after `/demo` has loaded once and the service worker controls the page, the sample and receipt creation work offline.
