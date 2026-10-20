import pytest

from app.core.phone import normalize_ar_phone


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("+54 9 341 555-1234", "5493415551234"),
        ("0341 15 555-1234", "5493415551234"),
        ("3415551234", "5493415551234"),
        ("5493415551234", "5493415551234"),
        ("(011) 15-5555-1234", "5491155551234"),
        ("+54 11 5555 1234", "5491155551234"),
        ("03541 15 412345", "5493541412345"),
        ("0054 9 341 555 1234", "5493415551234"),
    ],
)
def test_normalizes_common_formats(raw, expected):
    assert normalize_ar_phone(raw) == expected


@pytest.mark.parametrize("raw", ["", "123", "15-555-1234", "341 555 12345 678"])
def test_rejects_invalid_numbers(raw):
    with pytest.raises(ValueError):
        normalize_ar_phone(raw)
