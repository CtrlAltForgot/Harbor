# Unraid and Docker

Map `/config` to persistent appdata. Map incomplete, complete, and media locations explicitly. Prefer a common Unraid share/filesystem when atomic moves or hardlinks matter. Configure PUID/PGID to match the share owner, avoid privileged mode, and use read/write access only for destinations Harbor manages.

Never assume `/mnt/user` and `/mnt/cache` are the same filesystem. Harbor's organizer will capability-check atomic rename and hardlinks and fall back to verified copy. The mover must not operate on incomplete files. Keep staging and final path strategy consistent with your cache policy.

Start with `HARBOR_PAIRING_CODE` set to a unique secret. The current image is an evaluation build using mock downloads.
