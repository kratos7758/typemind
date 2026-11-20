import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// `server-only` throws outside a React Server environment; it is a no-op guard for tests.
vi.mock("server-only", () => ({}));
