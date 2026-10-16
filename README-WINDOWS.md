# suvhlatex on Windows

The Windows package starts the local suvhlatex server and opens the editor in your browser. Project files are stored in:

`%LOCALAPPDATA%\suvhlatex\data`

Run the Windows installer for each new release. It detects the existing suvhlatex installation, stops the running launcher if necessary, replaces the application in the same folder, and preserves your projects and settings.

PDF compilation requires a Windows LaTeX distribution. Install either:

- [MiKTeX](https://miktex.org/download), or
- [TeX Live for Windows](https://www.tug.org/texlive/windows.html).

Make sure `pdflatex`, `bibtex`, or `biber` is available on `PATH`. suvhlatex itself does not need an internet connection after the application and LaTeX distribution are installed.
