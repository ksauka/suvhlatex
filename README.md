# suvhlatex

`suvhlatex` is a small local web app for editing and compiling LaTeX projects without needing Overleaf or a university email address.

It provides:

- built-in project starters for a normal document, an ACL-style paper, and an ARMRT-style technical report;
- a browser editor for `.tex`, `.bib`, `.sty`, and other text files;
- local PDF compilation through `pdflatex`, `xelatex`, or `lualatex`;
- compilation logs and an in-browser PDF preview;
- safe import of existing LaTeX ZIP files;
- shallow cloning of HTTPS/SSH Git repositories while preserving their `.git` folders;
- optional password protection for the local workspace;
- optional Docker/Podman compilation isolation.

The ACL and ARMRT starters are intentionally self-contained, lightweight starting points. They are not a replacement for the official conference or journal class files. You can import the official class/style files in a ZIP project when you need exact submission formatting.

## Run it

From this directory:

```bash
conda activate suvhlatex
python3 server.py
```

Open <http://127.0.0.1:8765>.

## Install as a local desktop app

On Debian or Ubuntu, the installer can prepare the Python environment, verify the LaTeX tools, install the recommended TeX Live/BibTeX/Biber packages, and create an application-menu launcher:

```bash
./install.sh --install-tex
```

After installation, launch `suvhlatex` from the application menu or run:

```bash
./run.sh
```

The launcher starts the local server and opens the web app in your browser. No account or internet connection is needed after the required packages have been installed. The installer uses Conda when it is available and otherwise creates a project-local Python virtual environment. The system TeX packages are installed separately because they are not Python dependencies.

## Build downloadable Linux releases

The repository includes builders for an Ubuntu/Debian package and an AppImage. GitHub Releases also build a Windows executable, installer, and portable ZIP:

```bash
packaging/build-deb.sh
APPIMAGETOOL=/path/to/appimagetool packaging/build-appimage.sh
```

Pushing a tag such as `v0.1.0` runs `.github/workflows/release.yml`, which publishes both files to GitHub Releases. A GitHub Pages site can link its download buttons to the latest release assets. The Debian package installs the required TeX dependencies through Ubuntu/Debian's package manager. The AppImage still uses the host's Python and TeX installation; use the `.deb` when you want dependency installation handled by the operating system.

On Ubuntu or Debian, download the `.deb` from a GitHub Release and double-click it to install, or run:

```bash
sudo apt install ./suvhlatex_0.1.0_all.deb
```

After installation, launch `suvhlatex` from the applications menu. Its projects are stored in your user data directory, not inside the installed package.

The `suvhlatex` Conda environment is cloned from the existing `dsagent` environment. It provides the Python runtime and supporting tools; the LaTeX compilers remain the system TeX Live installation and are available inside the environment.

The Windows installer bundles the Python application and opens the same local browser editor. Install MiKTeX or TeX Live separately for PDF compilation; see [README-WINDOWS.md](README-WINDOWS.md).

If `conda` is not on your shell `PATH`, initialize it once with:

```bash
source ~/miniconda3/etc/profile.d/conda.sh
conda activate suvhlatex
```

The app uses the first available LaTeX engine in this order:

1. `SUVHLATEX_ENGINE` if set;
2. `pdflatex`;
3. `xelatex`;
4. `lualatex`.

For example:

```bash
SUVHLATEX_ENGINE=xelatex python3 server.py
```

## Configuration

You can configure the app without typing settings on every launch. Copy `.env.example` to `.env` for a simple local setup, or copy `config.example.json` to `config.json` for structured settings:

```bash
cp .env.example .env
```

Configuration precedence is:

1. shell environment variables;
2. `.env`;
3. `config.json`;
4. built-in defaults.

`.env` and `config.json` are ignored by Git. Keep passwords in `.env` or the shell environment, not in a committed configuration file. You can point to alternate files with `SUVHLATEX_ENV_FILE` and `SUVHLATEX_CONFIG`.

## Project storage

Projects are stored in `data/projects/<project-id>/`. Each project is ordinary files on disk, so it is easy to back up or add to Git. The generated PDF and auxiliary compiler files live in each project's `build/` directory.

Use **Import ZIP** to bring in a repository snapshot or existing Overleaf export. The ZIP importer rejects path traversal entries and limits extracted content to 20 MB.

Use **Clone Git repo** to make a shallow clone into `data/projects/<project-id>/`. HTTPS and SSH URLs are supported. Git credentials are not collected by suvhlatex; configure Git/SSH authentication on the machine first.

## Authentication and compiler isolation

By default the app binds only to `127.0.0.1` and has no login prompt. To protect it with a single local password:

```bash
SUVHLATEX_PASSWORD='use-a-long-random-password' python3 server.py
```

For stronger compilation isolation, install Docker or Podman and run:

```bash
SUVHLATEX_COMPILE_MODE=container python3 server.py
```

Container mode uses the `texlive/texlive:latest` image by default. Override it with `SUVHLATEX_TEX_IMAGE`. Compilation runs with networking disabled, dropped Linux capabilities, a read-only container root filesystem, resource limits, and `-no-shell-escape`. The project directory is the only writable mount.

`SUVHLATEX_COMPILE_MODE=auto` uses a container when Docker/Podman is available and otherwise falls back to the local LaTeX engine. The local mode is convenient for development but is not a security boundary for untrusted LaTeX source.

## Tests

```bash
python3 -m unittest discover -s tests -v
```

## Security boundary

This is still a local-first single-user application. It does not provide multi-user accounts, role-based access, TLS, or a hardened production sandbox. Non-loopback binds are refused unless `SUVHLATEX_PASSWORD` is set and `SUVHLATEX_COMPILE_MODE=container` is selected. Do not expose it directly to the public internet without a reverse proxy with TLS, stronger authentication, storage quotas, audit logging, and a reviewed container setup.
