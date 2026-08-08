# Releasing FileForge to PyPI

This document outlines the setup and procedure for publishing `fileforge-server` to PyPI using **GitHub Actions** and **PyPI Trusted Publishing (OIDC)** without storing long-lived API tokens.

---

## 1. Initial Setup (One-Time Configuration)

### GitHub Configuration
1. Navigate to your GitHub repository: `https://github.com/<owner>/<repo>`
2. Go to **Settings** → **Environments**.
3. Click **New environment**.
4. Name the environment exactly `pypi` and click **Configure environment**.

### PyPI Configuration
1. Log in to [PyPI](https://pypi.org).
2. Go to **Account Settings** → **Publishing** → **Add a new trusted publisher**.
3. Select **GitHub Actions**.
4. Configure the details:
   - **PyPI Project Name**: `fileforge-server`
   - **Owner / Organization**: Your GitHub username or organization name
   - **Repository Name**: Your repository name (e.g., `fileforge`)
   - **Workflow Name**: `publish.yml`
   - **Environment Name**: `pypi`
5. Click **Add publisher**.

---

## 2. Release Procedure

When you are ready to publish a new release:

### Step 1: Update Version Number
Update the version string in `pyproject.toml` and `src/fileforge/__init__.py`:

```toml
# pyproject.toml
[project]
version = "0.1.0"
```

```python
# src/fileforge/__init__.py
__version__ = "0.1.0"
```

### Step 2: Commit and Push Changes
```bash
git add pyproject.toml src/fileforge/__init__.py
git commit -m "release: bump version to v0.1.0"
git push origin main
```

### Step 3: Create and Push Tag
Tag the release with a `v` prefix matching the version:

```bash
git tag v0.1.0
git push origin v0.1.0
```

---

## 3. Automated Workflow Execution

Pushing a tag starting with `v` triggers `.github/workflows/publish.yml` on GitHub Actions:

1. **Environment Setup**: Runs on `ubuntu-latest` with Python `3.11`.
2. **Compilation Check**: Runs `python -m compileall` to check for syntax errors.
3. **Test Suite**: Runs `pytest` to ensure all unit tests pass.
4. **Package Build**: Executes `python -m build` to build both wheel (`.whl`) and source distribution (`.tar.gz`).
5. **Package Check**: Validates package metadata and formatting using `python -m twine check dist/*`.
6. **Artifact Storage**: Uploads `dist/` contents as workflow artifacts.
7. **Trusted Publish**: Authenticates via OpenID Connect (OIDC) and publishes the package to PyPI under `fileforge-server`.

---

## 4. Critical Release Rules

> [!IMPORTANT]
> **PyPI Version Immutability**  
> PyPI versions are strictly immutable. Once version `0.1.0` is published, PyPI will reject any attempt to re-upload files under that same version number. If a mistake occurs, you must increment the version (e.g., to `0.1.1`) and push a new tag (`v0.1.1`).
