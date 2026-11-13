from pathlib import Path
import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.storage import markdown_body_hash, read_page_split


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("WIT_PAGES_ROOT", str(tmp_path))
    (tmp_path / "a.md").write_text(
        """---
id: "a"
title: "Alpha"
parent: ""
tags: ["x"]
created: "2026-01-01"
---
Hello
""",
        encoding="utf-8",
    )
    (tmp_path / "b.md").write_text(
        """---
id: "b"
title: "Beta"
parent: "a"
tags: ["x", "y"]
created: "2026-01-02"
---
World
""",
        encoding="utf-8",
    )
    return TestClient(app)


def test_list_pages(client: TestClient) -> None:
    r = client.get("/pages")
    assert r.status_code == 200
    data = r.json()
    assert len(data["pages"]) == 2
    assert data["tags_index"]["x"] == ["a", "b"]


def test_get_page(client: TestClient) -> None:
    r = client.get("/pages/b")
    assert r.status_code == 200
    data = r.json()
    assert data["markdown_body"].strip() == "World"
    assert data.get("editor_overlay") in (None, "")
    assert data.get("overlay_stale") is False


def test_put_roundtrip(client: TestClient) -> None:
    r = client.put("/pages/b", json={"markdown_body": "Updated\n"})
    assert r.status_code == 200
    body = client.get("/pages/b").json()["markdown_body"]
    assert "Updated" in body


def test_editor_overlay_sidecar(client: TestClient, tmp_path: Path) -> None:
    ov = '{"version":2,"document":[]}\n'
    r = client.put(
        "/pages/b",
        json={"markdown_body": "# Title\n", "editor_overlay": ov},
    )
    assert r.status_code == 200
    sidecar = tmp_path / ".wit" / "editor" / "b.json"
    assert sidecar.is_file()
    stamped = json.loads(sidecar.read_text(encoding="utf-8"))
    assert stamped["version"] == 3
    assert stamped["document"] == []
    split = read_page_split("b")
    assert split is not None
    _, body = split
    assert stamped["markdown_sha256"] == markdown_body_hash(body)
    data = client.get("/pages/b").json()
    assert data["markdown_body"].strip() == "# Title"
    assert data["overlay_stale"] is False
    assert json.loads(data["editor_overlay"]) == stamped


def test_editor_overlay_delete(client: TestClient, tmp_path: Path) -> None:
    ov = '{"version":2,"document":[]}\n'
    client.put(
        "/pages/b",
        json={"markdown_body": "Hi\n", "editor_overlay": ov},
    )
    assert (tmp_path / ".wit" / "editor" / "b.json").is_file()
    r = client.put("/pages/b", json={"markdown_body": "Hi\n", "editor_overlay": ""})
    assert r.status_code == 200
    assert not (tmp_path / ".wit" / "editor" / "b.json").exists()
    assert client.get("/pages/b").json().get("editor_overlay") in (None, "")


def test_patch_parent(client: TestClient, tmp_path: Path) -> None:
    r = client.patch("/pages/b/meta", json={"parent": ""})
    assert r.status_code == 200
    text = (tmp_path / "b.md").read_text(encoding="utf-8")
    assert 'parent: ""' in text or "parent: ''" in text or "parent:" in text


def test_patch_order(client: TestClient, tmp_path: Path) -> None:
    r = client.patch("/pages/a/meta", json={"order": 3})
    assert r.status_code == 200
    assert r.json()["id"] == "a"
    text = (tmp_path / "a.md").read_text(encoding="utf-8")
    assert "order: 3" in text


def test_rename_page_id(client: TestClient, tmp_path: Path) -> None:
    ov = '{"version":2,"document":[]}\n'
    client.put("/pages/a", json={"markdown_body": "Text\n", "editor_overlay": ov})
    stamped = (tmp_path / ".wit" / "editor" / "a.json").read_text(encoding="utf-8")
    r = client.patch("/pages/a/meta", json={"new_id": "alpha-root"})
    assert r.status_code == 200
    assert r.json()["id"] == "alpha-root"
    assert not (tmp_path / "a.md").exists()
    assert (tmp_path / "alpha-root.md").is_file()
    assert not (tmp_path / ".wit" / "editor" / "a.json").exists()
    assert (tmp_path / ".wit" / "editor" / "alpha-root.json").read_text(
        encoding="utf-8"
    ) == stamped
    text_a = (tmp_path / "alpha-root.md").read_text(encoding="utf-8")
    assert "id: alpha-root" in text_a or 'id: "alpha-root"' in text_a
    text_b = (tmp_path / "b.md").read_text(encoding="utf-8")
    assert 'parent: alpha-root' in text_b or "parent: alpha-root" in text_b
    assert client.get("/pages/a").status_code == 404
    assert client.get("/pages/alpha-root").status_code == 200


def test_rename_duplicate_rejected(client: TestClient) -> None:
    r = client.patch("/pages/a/meta", json={"new_id": "b"})
    assert r.status_code == 400


def test_create_page_root(client: TestClient, tmp_path: Path) -> None:
    r = client.post("/pages", json={"title": "Gamma"})
    assert r.status_code == 200
    assert r.json()["id"] == "gamma"
    path = tmp_path / "gamma.md"
    assert path.is_file()
    text = path.read_text(encoding="utf-8")
    assert "id: gamma" in text or 'id: "gamma"' in text
    listed = client.get("/pages").json()["pages"]
    ids = {p["id"] for p in listed}
    assert "gamma" in ids


def test_create_page_under_parent(client: TestClient, tmp_path: Path) -> None:
    r = client.post("/pages", json={"title": "Child", "parent": "a"})
    assert r.status_code == 200
    rid = r.json()["id"]
    meta = next(p for p in client.get("/pages").json()["pages"] if p["id"] == rid)
    assert meta["parent"] == "a"


def test_create_page_bad_parent(client: TestClient) -> None:
    r = client.post("/pages", json={"title": "Orphan", "parent": "missing"})
    assert r.status_code == 400


def test_delete_leaf_page(client: TestClient, tmp_path: Path) -> None:
    client.put(
        "/pages/b",
        json={
            "markdown_body": "Bye\n",
            "editor_overlay": '{"version":2,"document":[]}\n',
        },
    )
    assert (tmp_path / ".wit" / "editor" / "b.json").is_file()
    r = client.delete("/pages/b")
    assert r.status_code == 204
    assert not (tmp_path / "b.md").exists()
    assert not (tmp_path / ".wit" / "editor" / "b.json").exists()
    listed = {p["id"] for p in client.get("/pages").json()["pages"]}
    assert "b" not in listed


def test_delete_page_with_children_rejected(client: TestClient) -> None:
    r = client.delete("/pages/a")
    assert r.status_code == 409


def test_delete_missing_page(client: TestClient) -> None:
    assert client.delete("/pages/nope").status_code == 404


def test_duplicate_warning(client: TestClient, tmp_path: Path) -> None:
    (tmp_path / "dup2.md").write_text(
        """---
id: "a"
title: "Dup"
parent: ""
---
""",
        encoding="utf-8",
    )
    r = client.get("/pages")
    assert r.status_code == 200
    data = r.json()
    assert len(data["duplicate_warnings"]) == 1
    assert data["duplicate_warnings"][0]["id"] == "a"


def test_stale_overlay_omitted_when_markdown_edited(
    client: TestClient, tmp_path: Path
) -> None:
    ov = '{"version":2,"document":[{"id":"keep","type":"paragraph","content":[]}]}'
    client.put(
        "/pages/b",
        json={"markdown_body": "Original\n", "editor_overlay": ov},
    )
    sidecar = tmp_path / ".wit" / "editor" / "b.json"
    stamped = sidecar.read_text(encoding="utf-8")
    path = tmp_path / "b.md"
    path.write_text(
        path.read_text(encoding="utf-8").replace("Original", "Edited on disk"),
        encoding="utf-8",
    )
    data = client.get("/pages/b").json()
    assert "Edited on disk" in data["markdown_body"]
    assert data["overlay_stale"] is True
    assert data.get("editor_overlay") in (None, "")
    assert sidecar.read_text(encoding="utf-8") == stamped


def test_v2_overlay_without_hash_kept_after_disk_edit(
    client: TestClient, tmp_path: Path
) -> None:
    overlay_dir = tmp_path / ".wit" / "editor"
    overlay_dir.mkdir(parents=True)
    raw = '{"version":2,"document":[]}'
    (overlay_dir / "b.json").write_text(raw, encoding="utf-8")
    path = tmp_path / "b.md"
    path.write_text(
        path.read_text(encoding="utf-8").replace("World", "Changed"),
        encoding="utf-8",
    )
    data = client.get("/pages/b").json()
    assert "Changed" in data["markdown_body"]
    assert data["overlay_stale"] is False
    assert data["editor_overlay"] == raw


def test_delete_overlay(client: TestClient, tmp_path: Path) -> None:
    client.put(
        "/pages/b",
        json={
            "markdown_body": "Hi\n",
            "editor_overlay": '{"version":2,"document":[]}',
        },
    )
    sidecar = tmp_path / ".wit" / "editor" / "b.json"
    assert sidecar.is_file()
    r = client.delete("/pages/b/overlay")
    assert r.status_code == 200
    assert r.json()["status"] == "deleted"
    assert not sidecar.exists()
    data = client.get("/pages/b").json()
    assert data.get("editor_overlay") in (None, "")
    assert data["overlay_stale"] is False
    again = client.delete("/pages/b/overlay")
    assert again.status_code == 200
    assert again.json()["status"] == "deleted"
    assert client.delete("/pages/missing/overlay").status_code == 404


def test_put_overlay_only_leaves_markdown_untouched(
    client: TestClient, tmp_path: Path
) -> None:
    path = tmp_path / "b.md"
    before = path.read_text(encoding="utf-8")
    r = client.put(
        "/pages/b",
        json={"editor_overlay": '{"version":2,"document":[]}'},
    )
    assert r.status_code == 200
    assert path.read_text(encoding="utf-8") == before
    sidecar = tmp_path / ".wit" / "editor" / "b.json"
    assert sidecar.is_file()
    stamped = json.loads(sidecar.read_text(encoding="utf-8"))
    assert stamped["version"] == 3
    assert stamped["document"] == []
    split = read_page_split("b")
    assert split is not None
    _, body = split
    assert stamped["markdown_sha256"] == markdown_body_hash(body)


def test_put_requires_a_field(client: TestClient) -> None:
    r = client.put("/pages/b", json={})
    assert r.status_code == 400


def test_list_returns_cleaned_style(client: TestClient, tmp_path: Path) -> None:
    (tmp_path / "a.md").write_text(
        """---
id: "a"
title: "Alpha"
parent: ""
tags: ["x"]
created: "2026-01-01"
version: "2"
authors:
  - "Ada"
  - ""
  - 3
  - "Lin"
style:
  typeface: literary
  measure: book
  opener: auto
  scene_break: ornament
---
Hello
""",
        encoding="utf-8",
    )
    page = next(p for p in client.get("/pages").json()["pages"] if p["id"] == "a")
    assert page["style"] == {
        "measure": "book",
        "scene_break": "ornament",
    }
    assert page["version"] == "2"
    assert page["authors"] == ["Ada", "Lin"]
    child = next(p for p in client.get("/pages").json()["pages"] if p["id"] == "b")
    assert child["style"] is None
    assert child["version"] is None
    assert child["authors"] is None


def test_list_cleans_version_and_authors(client: TestClient, tmp_path: Path) -> None:
    (tmp_path / "a.md").write_text(
        """---
id: "a"
title: "Alpha"
parent: ""
version: 2
authors: "Ada"
style:
  opener: title
---
Hello
""",
        encoding="utf-8",
    )
    page = next(p for p in client.get("/pages").json()["pages"] if p["id"] == "a")
    assert page["version"] is None
    assert page["authors"] is None
    assert page["style"] == {"opener": "title"}


def test_create_page_omits_style_version_and_authors(
    client: TestClient, tmp_path: Path
) -> None:
    created = client.post("/pages", json={"title": "Gamma"}).json()
    text = (tmp_path / f"{created['id']}.md").read_text(encoding="utf-8")
    assert "style:" not in text
    assert "version:" not in text
    assert "authors:" not in text


def test_list_drops_bad_style_fields(client: TestClient, tmp_path: Path) -> None:
    (tmp_path / "a.md").write_text(
        """---
id: "a"
title: "Alpha"
parent: ""
style:
  measure: wide
  scene_break: nope
  plain: plain
---
Hello
""",
        encoding="utf-8",
    )
    page = next(p for p in client.get("/pages").json()["pages"] if p["id"] == "a")
    assert page["style"] == {"measure": "wide"}


def test_list_ignores_non_mapping_style(client: TestClient, tmp_path: Path) -> None:
    (tmp_path / "a.md").write_text(
        """---
id: "a"
title: "Alpha"
parent: ""
style: literary
---
Hello
""",
        encoding="utf-8",
    )
    page = next(p for p in client.get("/pages").json()["pages"] if p["id"] == "a")
    assert page["style"] is None


def test_body_save_and_meta_patch_leave_style_on_disk(
    client: TestClient, tmp_path: Path
) -> None:
    (tmp_path / "b.md").write_text(
        """---
id: "b"
title: "Beta"
version: " draft "
authors:
  - "Ada"
parent: "a"
style:
  measure: wide
  typeface: blog
  scene_break: nope
---
World
""",
        encoding="utf-8",
    )
    assert client.put("/pages/b", json={"markdown_body": "Updated\n"}).status_code == 200
    assert client.patch("/pages/b/meta", json={"order": 4}).status_code == 200
    text = (tmp_path / "b.md").read_text(encoding="utf-8")
    assert "measure: wide" in text or 'measure: "wide"' in text
    assert "typeface: blog" in text or 'typeface: "blog"' in text
    assert "nope" in text
    detail = client.get("/pages/b").json()
    assert detail["frontmatter"]["style"]["scene_break"] == "nope"
    listed = next(p for p in client.get("/pages").json()["pages"] if p["id"] == "b")
    assert listed["style"] == {"measure": "wide"}
    assert detail["frontmatter"]["version"] == " draft "
    assert detail["frontmatter"]["authors"] == ["Ada"]
    assert "draft" in text
    assert listed["version"] == "draft"
    assert listed["authors"] == ["Ada"]
