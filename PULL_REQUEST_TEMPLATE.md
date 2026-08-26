Prepare Syllabusandstars submodule (add .gitmodules + placeholder)

This PR adds a .gitmodules file and a placeholder directory at packages/syllabusandstars to declare the intended submodule.

Why
- Prepares the repository to reference the existing Syllabusandstars repository as a submodule.
- The actual gitlink (the special commit created by `git submodule add`) is best created from a local clone — instructions below.

What changed
- .gitmodules (declares the submodule path / url / branch)
- packages/syllabusandstars/README.md (instructions + context)
- packages/syllabusandstars/.gitkeep (placeholder)

Next steps (local)
1. git fetch origin
2. git checkout add/syllabusandstars
3. git submodule add https://github.com/RyanrealAF/Syllabusandstars.git packages/syllabusandstars
4. git commit -m "Add syllabusandstars submodule"
5. git push origin add/syllabusandstars

If you prefer me to finish the final gitlink step remotely, I can attempt it — let me know and I will proceed.
