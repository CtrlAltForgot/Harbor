# Harbor security

Harbor is designed for a trusted home LAN. Do not expose the Harbor API, qBittorrent Web UI, or peer ports through a public reverse proxy unless you understand and accept the risk.

Report a security problem privately through GitHub's **Security → Report a vulnerability** feature when available. Do not include pairing codes, qBittorrent passwords, TMDB tokens, private tracker URLs, or private share names in a public issue.

The generated `.env`, `INSTALLATION.txt`, SQLite databases, and application data are intentionally excluded from Git. Pairing tokens are stored as hashes. Provider credentials remain server-side and are not returned through the settings API.
