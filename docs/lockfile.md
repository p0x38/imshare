# Instance Locking

imshare uses an operating-system-managed exclusive file lock to prevent multiple server instances from running against the same data directory.

The lock file is named `.lock` and is created in the server's working directory.

## How It Works

At startup, imshare:

1. Opens `.lock` without truncating or replacing it.
2. Attempts to acquire a non-blocking exclusive operating-system lock.
3. Continues startup if the lock is acquired.
4. Exits with an error if another process already holds the lock.

The lock remains held for the lifetime of the process. During shutdown, imshare closes the file descriptor and releases the lock.

The operating system also releases the lock when the process terminates unexpectedly.

## Important Notes

- **Do not delete `.lock` while imshare is running.** The file must remain stable while its lock is held.
- **Do not replace or recreate the lock file.** Different processes could otherwise lock different file objects and both believe they own the instance lock.
- **Do not use PID-based stale lock detection.** Checking whether a PID is alive and then deleting the lock file introduces a time-of-check-to-time-of-use (TOCTOU) race condition.
- **The existence of `.lock` does not indicate that an instance is running.** The OS lock state determines ownership.
- **All instances must use the same lock file.** Running instances from different working directories may not coordinate with each other.
- The lock is intended for local filesystems. Network filesystems may have different locking semantics.

## Frequently Asked Questions

### Why does `.lock` remain after imshare exits?

The file is intentionally persistent. Its existence does not mean the lock is still held. The operating system releases the lock when its owning process closes the file descriptor or terminates.

### Do I need to remove `.lock` before starting imshare?

No. imshare automatically attempts to acquire the exclusive lock. An existing but unlocked file is perfectly fine.

### What happens if imshare crashes?

The operating system releases the process's file lock. The next instance can acquire it without manually removing `.lock`.

### Why not store the process ID in `.lock`?

A PID alone cannot reliably establish lock ownership. PIDs can be reused, and checking process state before deleting a lock file creates a race condition.

### Why not delete stale lock files automatically?

Deleting a lock file can be unsafe if another process acquires or recreates it between the ownership check and deletion. Keeping the file persistent avoids this class of race condition.

### Can I run multiple imshare instances?

Not against the same lock file. Each instance must acquire its own exclusive lock before starting.

### Is this a security boundary?

No. The lock is a coordination mechanism for cooperating processes, not an access-control or security boundary. File permissions and filesystem protections are still important.
