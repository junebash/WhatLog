import { Effect } from "effect";

const greeting = Effect.succeed("hello from effect")
  .pipe(Effect.flatMap(Effect.log);

Effect.runSync(greeting);
