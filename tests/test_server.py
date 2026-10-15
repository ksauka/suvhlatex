import io
import os
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

import server


class ServerCoreTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.projects_root = Path(self.temp_dir.name) / "projects"
        self.projects_root.mkdir()
        self.root_patch = patch.object(server, "PROJECTS_ROOT", self.projects_root)
        self.root_patch.start()
        server.ensure_storage()

    def tearDown(self):
        self.root_patch.stop()
        self.temp_dir.cleanup()

    def test_create_project_writes_template_and_metadata(self):
        project = server.create_project("My First Paper", "acl")

        self.assertEqual(project["id"], "my-first-paper")
        self.assertEqual(project["template"], "acl")
        self.assertIn("main.tex", project["files"])
        self.assertIn("references.bib", project["files"])
        self.assertIn("twocolumn", (self.projects_root / project["id"] / "main.tex").read_text())

    def test_delete_project_removes_only_the_selected_project(self):
        project = server.create_project("remove-me", "standard")
        other = server.create_project("keep-me", "standard")

        server.delete_project(project["id"])

        self.assertFalse(server.project_path(project["id"]).exists())
        self.assertTrue(server.project_path(other["id"]).exists())

    def test_zip_import_rejects_path_traversal(self):
        archive_data = io.BytesIO()
        with zipfile.ZipFile(archive_data, "w") as archive:
            archive.writestr("../escape.tex", "bad")

        with self.assertRaises(ValueError):
            server.extract_zip(archive_data.getvalue(), "unsafe.zip")

        self.assertFalse((Path(self.temp_dir.name) / "escape.tex").exists())

    def test_zip_import_supports_nested_repository_folder(self):
        archive_data = io.BytesIO()
        with zipfile.ZipFile(archive_data, "w") as archive:
            archive.writestr("paper/main.tex", "\\documentclass{article}\\begin{document}Hello\\end{document}")
            archive.writestr("paper/refs.bib", "")

        project = server.extract_zip(archive_data.getvalue(), "paper.zip")

        self.assertEqual(project["main_file"], "paper/main.tex")
        self.assertIn("paper/refs.bib", project["files"])
        if server.choose_engine() is not None:
            result = server.compile_project(project["id"])
            self.assertTrue(result["ok"], result["log"])

    def test_main_file_selection_prefers_sigconf_and_persists_choice(self):
        project_root = self.projects_root / "acm-template"
        (project_root / "samples").mkdir(parents=True)
        (project_root / "samples" / "acmcp.tex").write_text("bad", encoding="utf-8")
        (project_root / "samples" / "sigconf.tex").write_text("good", encoding="utf-8")
        server.write_metadata(project_root, "ACM template", "imported")

        self.assertEqual(server.project_payload("acm-template")["main_file"], "samples/sigconf.tex")
        updated = server.set_main_file("acm-template", "samples/acmcp.tex")
        self.assertEqual(updated["main_file"], "samples/acmcp.tex")

    def test_bibliography_backend_detects_bibtex_and_biber(self):
        bibtex_file = self.projects_root / "bibtex.tex"
        bibtex_file.write_text("\\documentclass{article}\n\\bibliographystyle{plain}\n\\bibliography{refs}\n", encoding="utf-8")
        biber_file = self.projects_root / "biber.tex"
        biber_file.write_text("\\documentclass{article}\n\\usepackage{biblatex}\n\\addbibresource{refs.bib}\n", encoding="utf-8")

        self.assertEqual(server.bibliography_backend(bibtex_file), "bibtex")
        self.assertEqual(server.bibliography_backend(biber_file), "biber")

    def test_repository_url_validation_only_allows_remote_git_schemes(self):
        self.assertEqual(server.validate_repository_url("https://github.com/example/paper.git"), "https://github.com/example/paper.git")
        self.assertEqual(server.validate_repository_url("git@github.com:example/paper.git"), "git@github.com:example/paper.git")
        with self.assertRaises(ValueError):
            server.validate_repository_url("file:///tmp/repository")
        with self.assertRaises(ValueError):
            server.validate_repository_url("https://user:password@example.com/paper.git")

    def test_project_file_symlink_cannot_escape_project(self):
        project = server.create_project("symlink-check", "standard")
        project_root = server.project_path(project["id"])
        link = project_root / "outside.tex"
        link.symlink_to(Path(self.temp_dir.name) / "outside.tex")

        with self.assertRaises(ValueError):
            server.safe_project_file(project_root, Path("outside.tex"))

    def test_password_sessions_expire_and_can_be_removed(self):
        with patch.object(server, "PASSWORD", "secret"):
            token = server.create_session()
            self.assertTrue(server.valid_session(token))
            server.remove_session(token)
            self.assertFalse(server.valid_session(token))

    def test_configuration_precedence_and_dotenv_parsing(self):
        parsed = server.parse_dotenv_text("export SUVHLATEX_PORT='9000'\nNAME=value # comment\n# ignored\n")
        self.assertEqual(parsed["SUVHLATEX_PORT"], "9000")
        self.assertEqual(parsed["NAME"], "value")
        with patch.object(server, "DOTENV_VALUES", {"TEST_SETTING": "dotenv"}), patch.object(server, "CONFIG_VALUES", {"test": {"setting": "config"}}):
            with patch.dict(os.environ, {}, clear=False):
                os.environ.pop("TEST_SETTING", None)
                self.assertEqual(server.setting("TEST_SETTING", "test.setting", "default"), "dotenv")
                os.environ["TEST_SETTING"] = "environment"
                self.assertEqual(server.setting("TEST_SETTING", "test.setting", "default"), "environment")
                os.environ.pop("TEST_SETTING", None)

    def test_standard_template_compiles_when_latex_is_available(self):
        if server.choose_engine() is None:
            self.skipTest("No local LaTeX engine installed")

        for template_id in server.TEMPLATES:
            project = server.create_project(f"compile-check-{template_id}", template_id)
            result = server.compile_project(project["id"])

            self.assertTrue(result["ok"], f"{template_id}: {result['log']}")
            self.assertTrue(server.compiled_pdf_path(server.project_path(project["id"])).exists())


if __name__ == "__main__":
    unittest.main()
