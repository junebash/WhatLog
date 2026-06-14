import { randomBytes } from "node:crypto"

/**
 * Generating an id reads the system's randomness — a side effect — so we model
 * it as an injectable capability. Tests pass a deterministic stub; production
 * passes the real one.
 */
export type GenerateId = () => string

/** 4 random bytes rendered as hex = an 8-character id (e.g. "a3f8c2d1"). */
export const generateIdImpl: GenerateId = () => randomBytes(4).toString("hex")
