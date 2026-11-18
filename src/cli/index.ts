#!/usr/bin/env node
import "dotenv/config";
import { runCli } from "./command.js";

process.exitCode = await runCli();
