# Remotion integration

1. Confirm `package.json` identifies a Remotion project.
2. Locate registrations such as `registerRoot()` and `<Composition>`. Collect composition IDs.
3. If no composition was requested:
   - Use the only registered composition.
   - If multiple IDs exist, ask the user to choose.
4. Put generated media under `public/audio/` and reference it with:

   ```tsx
   import {Audio, staticFile} from "remotion";

   <Audio src={staticFile("audio/voiceover.wav")} />
   ```

5. Read the generated metadata JSON. Set the target composition duration to at least:

   ```ts
   Math.ceil(metadata.durationInSeconds * fps)
   ```

6. Preserve an existing duration when it is longer or includes deliberate intro/outro frames. If the composition uses calculated metadata, extend its existing `calculateMetadata()` path instead of creating a competing duration source.
7. Run the repository's existing typecheck, test, or build scripts. Show the exact composition and files changed.

Do not make a generic search-and-replace across every composition. Do not add an `<Audio>` element twice when narration already exists.
