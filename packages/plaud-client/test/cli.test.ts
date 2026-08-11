import { describe, expect, it } from "bun:test";
import { runCli } from "../src/cli.js";

describe("CLI Tool", () => {
  it("prints help message for --help and help", async () => {
    let output = "";
    const originalLog = console.log;
    console.log = (msg: string) => {
      output += msg + "\n";
    };

    try {
      await runCli(["--help"]);
      expect(output).toContain("Plaud API CLI tool");
      expect(output).toContain("login");
      expect(output).toContain("logout");
    } finally {
      console.log = originalLog;
    }
  });

  it("prints version for --version", async () => {
    let output = "";
    const originalLog = console.log;
    console.log = (msg: string) => {
      output += msg + "\n";
    };

    try {
      await runCli(["--version"]);
      expect(output).toContain("plaud-client v0.1.0");
    } finally {
      console.log = originalLog;
    }
  });

  it("runs logout command successfully", async () => {
    let output = "";
    const originalLog = console.log;
    console.log = (msg: string) => {
      output += msg + "\n";
    };

    try {
      await runCli(["logout"]);
      expect(output).toContain("Logged out successfully");
    } finally {
      console.log = originalLog;
    }
  });
});
