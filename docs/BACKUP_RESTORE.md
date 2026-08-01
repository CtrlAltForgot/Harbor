# Backup and restore

Stop the container, then back up the entire `/config` mapping. It contains SQLite state and its WAL files. Restore the directory with the same ownership before starting Harbor. Media and staging paths are separate and must be backed up according to your library policy. A consistent online export and restore validation UI is planned for Milestone 4.
