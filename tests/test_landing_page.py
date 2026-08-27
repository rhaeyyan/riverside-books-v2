"""Tests for the landing page entry points spec.

Covers `web/index.html`, served at `/` by the static mount in
`backend/api/main.py` (not gated on a frontend build, unlike `/shop` and
`/staff`). These assertions are structural/string-based since the landing
page is static HTML with no framework.
"""

from __future__ import annotations

import re

import pytest
from fastapi.testclient import TestClient

from backend.api.main import app


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as c:
        yield c


def _extract_between(text: str, start_marker: str, end_marker: str) -> str:
    """Return the substring from the first `start_marker` to the next
    `end_marker` after it (or end of string if `end_marker` isn't found)."""
    start = text.find(start_marker)
    assert start != -1, f"could not find {start_marker!r} in document"
    end = text.find(end_marker, start)
    if end == -1:
        return text[start:]
    return text[start:end]


def test_landing_page_served_at_root(client: TestClient):
    response = client.get("/")
    assert response.status_code == 200


def test_old_rule_item_copy_is_gone(client: TestClient):
    response = client.get("/")
    assert "Live stock, not a guess" not in response.text


def test_rule_section_has_exactly_two_items_labeled_01_and_02(client: TestClient):
    response = client.get("/")
    text = response.text
    rule_section = _extract_between(text, 'class="rule"', "<section")
    labels = re.findall(r">(\d{2})</div>", rule_section)
    assert labels == ["01", "02"], (
        f"expected exactly two rule items labeled 01, 02 in order; got {labels}"
    )


def test_footer_no_longer_has_staff_sign_in_link(client: TestClient):
    response = client.get("/")
    assert "Staff sign in" not in response.text


def test_header_has_customer_sign_in_and_discrete_staff_link(client: TestClient):
    response = client.get("/")
    text = response.text
    header = _extract_between(text, "<header", "</header>")

    assert re.search(r"sign[\s-]?in", header, re.IGNORECASE), (
        "expected a customer sign-in control in the header"
    )

    staff_link = re.search(
        r'<(a|button)[^>]*href="/staff/"[^>]*>', header, re.IGNORECASE
    )
    assert staff_link is not None, (
        "expected a discrete staff-link control pointing to /staff/ in the header"
    )


def test_inline_script_references_customer_endpoints_and_storage_key(
    client: TestClient,
):
    """§5.3 (v0.5): email/password login and registration, not phone lookup.

    /api/customers/lookup no longer exists at all -- see
    test_no_reference_to_removed_lookup_endpoint below.
    """
    response = client.get("/")
    text = response.text

    scripts = re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", text, re.DOTALL)
    inline_script = "\n".join(scripts)

    assert inline_script.strip() != "", "expected an inline <script> block"
    assert "/api/customers/login" in inline_script
    assert "/api/customers" in inline_script
    assert "riverside_customer" in inline_script


def test_no_reference_to_removed_lookup_endpoint(client: TestClient):
    """The v0.4 phone-lookup endpoint was removed outright in v0.5, not kept
    alongside email/password -- nothing on the page should still call it."""
    response = client.get("/")
    assert "/api/customers/lookup" not in response.text


def test_signin_dialog_has_email_and_password_fields(client: TestClient):
    response = client.get("/")
    text = response.text
    dialog = _extract_between(text, 'id="riverside-signin-dialog"', "</dialog>")

    assert re.search(r'type="email"', dialog), "expected an email input"
    assert re.search(r'type="password"', dialog), "expected a password input"
    assert "sign up" in dialog.lower(), (
        "expected a way to switch to a sign-up flow in the dialog"
    )
